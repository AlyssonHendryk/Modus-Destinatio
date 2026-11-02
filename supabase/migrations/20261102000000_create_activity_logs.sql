-- Etapa 18.61: migration prepared for review; NOT executed.
-- Run only after explicit approval, as postgres. No business RPCs are created.
-- Deliberately not idempotent: existing objects require inspection, not reuse.
-- No foreign keys, payload-size cap, or changes to existing table privileges.

BEGIN;

DO $migration$
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'activity_logs migration requires current_user = postgres';
  END IF;
END;
$migration$;

-- No suitable private schema is declared in the repository.
-- Reuse private only if trusted; never change an existing schema's ACL/owner.
DO $private_schema$
DECLARE
  application_role text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'private') THEN
    EXECUTE 'CREATE SCHEMA private AUTHORIZATION postgres';
    EXECUTE 'REVOKE ALL PRIVILEGES ON SCHEMA private FROM PUBLIC, anon, authenticated, service_role';
  END IF;

  IF (SELECT nspowner FROM pg_namespace WHERE nspname = 'private')
     <> (SELECT oid FROM pg_roles WHERE rolname = 'postgres') THEN
    RAISE EXCEPTION 'Existing private schema must be reviewed: owner is not postgres';
  END IF;

  FOREACH application_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role']
  LOOP
    IF has_schema_privilege(application_role, 'private', 'CREATE') THEN
      RAISE EXCEPTION 'Unsafe private schema CREATE privilege: role=%', application_role;
    END IF;
  END LOOP;
END;
$private_schema$;

CREATE TABLE public.activity_logs (
  id bigint GENERATED ALWAYS AS IDENTITY
    (SEQUENCE NAME public.activity_logs_id_seq) PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  actor_id uuid NOT NULL,
  actor_role text NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NULL,
  request_id uuid NOT NULL,
  details jsonb NOT NULL,

  CONSTRAINT activity_logs_actor_role_ck
    CHECK (actor_role IN ('admin', 'employee')),

  CONSTRAINT activity_logs_entity_type_ck
    CHECK (entity_type IN ('order', 'product', 'profile')),

  -- This mapping also enforces the closed action catalog (Etapa 18.41).
  CONSTRAINT activity_logs_action_entity_ck CHECK (
    (entity_type = 'order' AND action IN (
      'order.created',
      'order.updated',
      'order.deleted',
      'order.separation_started',
      'order.separation_completed'
    ))
    OR (entity_type = 'product' AND action IN (
      'product.created',
      'product.updated',
      'product.deleted',
      'stock.adjusted'
    ))
    OR (entity_type = 'profile' AND action IN (
      'profile.name_updated',
      'employee.status_updated',
      'employee.creation_requested',
      'employee.created',
      'employee.creation_failed',
      'employee.creation_outcome_unknown',
      'employee.deletion_requested',
      'employee.deleted',
      'employee.deletion_failed',
      'employee.deletion_outcome_unknown'
    ))
  ),

  CONSTRAINT activity_logs_entity_id_required_ck CHECK (
    entity_id IS NOT NULL
    OR action IN (
      'employee.creation_requested',
      'employee.creation_failed',
      'employee.creation_outcome_unknown'
    )
  ),

  CONSTRAINT activity_logs_entity_id_nonblank_ck CHECK (
    entity_id IS NULL OR entity_id ~ '[^[:space:]]'
  ),

  CONSTRAINT activity_logs_profile_id_format_ck CHECK (
    entity_type <> 'profile'
    OR entity_id IS NULL
    OR entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ),

  -- Explicit existence/type checks prevent missing or JSON-null versions
  -- from passing a CHECK through SQL's three-valued logic.
  CONSTRAINT activity_logs_details_version_ck CHECK (
    jsonb_typeof(details) = 'object'
    AND details ? 'schema_version'
    AND jsonb_typeof(details -> 'schema_version') = 'number'
    AND details -> 'schema_version' = '1'::jsonb
  )
);

CREATE INDEX activity_logs_chronological_idx
  ON public.activity_logs (occurred_at DESC, id DESC);

CREATE INDEX activity_logs_actor_chronological_idx
  ON public.activity_logs (actor_id, occurred_at DESC, id DESC);

CREATE INDEX activity_logs_action_chronological_idx
  ON public.activity_logs (action, occurred_at DESC, id DESC);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
-- New table: FORCE RLS is off and no access policies are created.

REVOKE ALL PRIVILEGES ON TABLE public.activity_logs
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON SEQUENCE public.activity_logs_id_seq
  FROM PUBLIC, anon, authenticated, service_role;

-- Always raises; no elevated privileges are required for this protection.
-- Creation as postgres makes postgres the owner of all new objects.
CREATE FUNCTION private.prevent_activity_log_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = '55000',
    MESSAGE = 'activity_logs is append-only: UPDATE, DELETE and TRUNCATE are forbidden';
END;
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION private.prevent_activity_log_changes()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER activity_logs_prevent_update_delete
  BEFORE UPDATE OR DELETE ON public.activity_logs
  FOR EACH STATEMENT
  EXECUTE FUNCTION private.prevent_activity_log_changes();

CREATE TRIGGER activity_logs_prevent_truncate
  BEFORE TRUNCATE ON public.activity_logs
  FOR EACH STATEMENT
  EXECUTE FUNCTION private.prevent_activity_log_changes();

-- Fail closed if inherited/default grants still give application roles access.
-- Do not revoke privileges from unrelated roles or modify global defaults.
DO $verification$
DECLARE
  application_role text;
  privilege_name text;
BEGIN
  FOREACH application_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role']
  LOOP
    FOREACH privilege_name IN ARRAY ARRAY[
      'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'
    ]
    LOOP
      IF has_table_privilege(application_role, 'public.activity_logs', privilege_name) THEN
        RAISE EXCEPTION 'Residual activity_logs privilege: role=%, privilege=%',
          application_role, privilege_name;
      END IF;
    END LOOP;

    FOREACH privilege_name IN ARRAY ARRAY['USAGE', 'SELECT', 'UPDATE']
    LOOP
      IF has_sequence_privilege(application_role, 'public.activity_logs_id_seq', privilege_name) THEN
        RAISE EXCEPTION 'Residual activity_logs sequence privilege: role=%, privilege=%',
          application_role, privilege_name;
      END IF;
    END LOOP;

    IF has_function_privilege(application_role, 'private.prevent_activity_log_changes()', 'EXECUTE') THEN
      RAISE EXCEPTION 'Residual activity_logs protection-function EXECUTE: role=%',
        application_role;
    END IF;
  END LOOP;
END;
$verification$;

-- request_id correlates events; it is deliberately NOT unique.
-- Future protected business functions must validate event-specific details,
-- derive/verify the actor, and insert logs in the business transaction.
-- Ownership/DDL administration remains trusted: postgres can remove triggers.

COMMIT;
