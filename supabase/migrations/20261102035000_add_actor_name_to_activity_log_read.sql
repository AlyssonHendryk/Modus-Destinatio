-- Etapa 20.2.1. REVIEW REQUIRED; do not execute automatically.
-- Adds only the current public profile name to the admin read projection.
-- Activity records remain immutable and are not backfilled or updated.

BEGIN;

DO $preflight$
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Activity-log read migration requires current_user = postgres';
  END IF;
  IF to_regclass('public.activity_logs') IS NULL
     OR to_regclass('public.profiles') IS NULL
     OR to_regprocedure('public.audit_list_activity_logs(uuid,uuid,text,timestamptz,timestamptz,integer,timestamptz,timestamptz,bigint)') IS NULL THEN
    RAISE EXCEPTION 'Required activity-log relation or read function is missing';
  END IF;
  -- Existing application and audit code use profiles.name. Verify that exact
  -- column rather than assuming a full_name-style schema.
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute a
    WHERE a.attrelid = 'public.profiles'::regclass
      AND a.attname = 'id' AND a.attnotnull AND a.atttypid = 'uuid'::regtype
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_attribute a
    WHERE a.attrelid = 'public.profiles'::regclass
      AND a.attname = 'name' AND a.atttypid = 'text'::regtype
  ) THEN
    RAISE EXCEPTION 'Expected public.profiles.id uuid and public.profiles.name text';
  END IF;
END;
$preflight$;

-- PostgreSQL cannot change a function OUT-column list with CREATE OR REPLACE.
-- Transactionality ensures callers observe either the old function or the full
-- replacement, never a partially created function.
DROP FUNCTION public.audit_list_activity_logs(
  uuid,uuid,text,timestamptz,timestamptz,integer,timestamptz,timestamptz,bigint
);

CREATE FUNCTION public.audit_list_activity_logs(
  p_actor_id uuid, p_user_id uuid, p_action text,
  p_date_from timestamptz, p_date_to timestamptz, p_limit integer,
  p_as_of timestamptz, p_before_at timestamptz, p_before_id bigint
) RETURNS TABLE (
  id bigint, occurred_at timestamptz, actor_id uuid, actor_role text,
  actor_name text, action text, entity_type text, entity_id text,
  request_id uuid, details jsonb
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  IF p_actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_actor_id AND p.role = 'admin' AND p.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Active administrator required' USING ERRCODE = '42501';
  END IF;
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100
     OR p_as_of IS NULL OR NOT isfinite(p_as_of)
     OR (p_date_from IS NOT NULL AND NOT isfinite(p_date_from))
     OR (p_date_to IS NOT NULL AND NOT isfinite(p_date_to))
     OR (p_date_from IS NOT NULL AND p_date_to IS NOT NULL AND p_date_from >= p_date_to)
     OR ((p_before_at IS NULL) <> (p_before_id IS NULL))
     OR (p_before_at IS NOT NULL AND (NOT isfinite(p_before_at) OR p_before_at > p_as_of))
     OR (p_before_id IS NOT NULL AND p_before_id <= 0) THEN
    RAISE EXCEPTION 'Invalid pagination or period' USING ERRCODE = '22023';
  END IF;
  IF p_action IS NOT NULL AND p_action NOT IN (
    'order.created', 'order.updated', 'order.deleted',
    'order.separation_started', 'order.separation_completed',
    'product.created', 'product.updated', 'product.deleted', 'stock.adjusted',
    'profile.name_updated', 'employee.status_updated',
    'employee.creation_requested', 'employee.created',
    'employee.creation_failed', 'employee.creation_outcome_unknown',
    'employee.deletion_requested', 'employee.deleted',
    'employee.deletion_failed', 'employee.deletion_outcome_unknown'
  ) THEN
    RAISE EXCEPTION 'Invalid action filter' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
    SELECT l.id, l.occurred_at, l.actor_id, l.actor_role,
      profile.actor_name, l.action, l.entity_type, l.entity_id,
      l.request_id, l.details
    FROM public.activity_logs l
    -- LATERAL + LIMIT guarantees one result per log even if a damaged profile
    -- relation ever has more than one matching actor row.
    LEFT JOIN LATERAL (
      SELECT p.name::text AS actor_name
      FROM public.profiles p
      WHERE p.id = l.actor_id
      LIMIT 1
    ) profile ON true
    WHERE (p_user_id IS NULL OR l.actor_id = p_user_id)
      AND (p_action IS NULL OR l.action = p_action)
      AND (p_date_from IS NULL OR l.occurred_at >= p_date_from)
      AND (p_date_to IS NULL OR l.occurred_at < p_date_to)
      AND l.occurred_at <= p_as_of
      AND (p_before_at IS NULL OR (l.occurred_at, l.id) < (p_before_at, p_before_id))
    ORDER BY l.occurred_at DESC, l.id DESC
    LIMIT (p_limit + 1);
END;
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION public.audit_list_activity_logs(
  uuid,uuid,text,timestamptz,timestamptz,integer,timestamptz,timestamptz,bigint
) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.audit_list_activity_logs(
  uuid,uuid,text,timestamptz,timestamptz,integer,timestamptz,timestamptz,bigint
) TO service_role;

DO $verification$
DECLARE
  function_oid oid := 'public.audit_list_activity_logs(uuid,uuid,text,timestamptz,timestamptz,integer,timestamptz,timestamptz,bigint)'::regprocedure;
BEGIN
  IF has_function_privilege('anon', function_oid, 'EXECUTE')
     OR has_function_privilege('authenticated', function_oid, 'EXECUTE')
     OR NOT has_function_privilege('service_role', function_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'Unexpected effective EXECUTE privileges';
  END IF;
END;
$verification$;

COMMIT;
