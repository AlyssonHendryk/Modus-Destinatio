-- Etapa 18.78: REVIEW DRAFT ONLY. NOT EXECUTED.
-- Records Auth Admin intent/outcome, never calls Auth or mutates profiles.
-- Requires the two previous migrations. Existing functions/ACLs are untouched.
-- Future backend must COMMIT intent before calling Auth Admin, then report only
-- a verified outcome. A timeout is unknown, not proof of failure.
-- All requests/results require a currently active administrator.
-- Actor identity is supplied exclusively by the JWT-validated backend.

BEGIN;

DO $preflight$
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Auth audit migration requires current_user = postgres';
  END IF;
  IF to_regclass('public.activity_logs') IS NULL
     OR to_regprocedure('private.activity_require_actor(uuid,uuid,boolean)') IS NULL THEN
    RAISE EXCEPTION 'Apply activity_logs and audited business RPC migrations first';
  END IF;
  IF (SELECT nspowner FROM pg_namespace WHERE nspname = 'private')
     IS DISTINCT FROM (SELECT oid FROM pg_roles WHERE rolname = 'postgres') THEN
    RAISE EXCEPTION 'Review private schema ownership';
  END IF;
  IF has_schema_privilege('anon', 'private', 'CREATE')
     OR has_schema_privilege('authenticated', 'private', 'CREATE')
     OR has_schema_privilege('service_role', 'private', 'CREATE') THEN
    RAISE EXCEPTION 'Application roles must not have CREATE on private';
  END IF;
END;
$preflight$;

-- No JSON, free-text errors, name, email, password or token is accepted.
-- INVOKER helper: reachable only from the new postgres-owned entry points.
CREATE FUNCTION private.activity_auth_admin_record(
  p_actor_id uuid, p_request_id uuid, p_operation text, p_outcome text,
  p_user_id uuid, p_stage text, p_reason_code text, p_compensation_result text
) RETURNS bigint
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $function$
DECLARE
  actor_role text;
  requested_action text;
  event_action text;
  event_details jsonb;
  intent public.activity_logs%ROWTYPE;
  previous_result public.activity_logs%ROWTYPE;
  target public.profiles%ROWTYPE;
  event_id bigint;
BEGIN
  actor_role := private.activity_require_actor(p_actor_id, p_request_id, true);
  IF p_operation IS NULL OR p_operation NOT IN ('creation', 'deletion')
     OR p_outcome IS NULL OR p_outcome NOT IN ('requested', 'succeeded', 'failed', 'unknown') THEN
    RAISE EXCEPTION 'Invalid Auth audit operation/outcome' USING ERRCODE = '22023';
  END IF;
  IF p_user_id = p_actor_id THEN
    RAISE EXCEPTION 'Employee operation cannot target its administrator' USING ERRCODE = '42501';
  END IF;
  IF p_operation = 'deletion' AND p_user_id IS NULL THEN
    RAISE EXCEPTION 'Deletion requires the employee UUID' USING ERRCODE = '22023';
  END IF;

  -- Serialize this request across actors and all four entry points. Hash
  -- collisions only add contention; comparisons below still use the full UUID.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_request_id::text, 0));
  requested_action := 'employee.' || p_operation || '_requested';

  -- A request belongs to one administrator and one Auth operation only.
  IF EXISTS (
    SELECT 1 FROM public.activity_logs l WHERE l.request_id = p_request_id
      AND (l.actor_id IS DISTINCT FROM p_actor_id OR l.entity_type <> 'profile'
        OR l.action NOT IN (
          requested_action,
          CASE p_operation WHEN 'creation' THEN 'employee.created' ELSE 'employee.deleted' END,
          'employee.' || p_operation || '_failed',
          'employee.' || p_operation || '_outcome_unknown'))
  ) THEN
    RAISE EXCEPTION 'request_id already belongs to another operation' USING ERRCODE = '22023';
  END IF;
  SELECT l.* INTO intent FROM public.activity_logs l
    WHERE l.request_id = p_request_id AND l.action = requested_action
    ORDER BY l.id LIMIT 1;

  IF p_outcome = 'requested' THEN
    IF p_stage IS NOT NULL OR p_reason_code IS NOT NULL OR p_compensation_result IS NOT NULL
       OR (p_operation = 'creation' AND p_user_id IS NOT NULL) THEN
      RAISE EXCEPTION 'Unexpected intent parameters' USING ERRCODE = '22023';
    END IF;
    IF intent.id IS NOT NULL THEN
      IF intent.entity_id IS DISTINCT FROM p_user_id::text THEN
        RAISE EXCEPTION 'Intent replay has a different employee' USING ERRCODE = '22023';
      END IF;
      -- Logging replay only: this does NOT authorize repeating the Auth call.
      RETURN intent.id;
    END IF;
    IF EXISTS (SELECT 1 FROM public.activity_logs l WHERE l.request_id = p_request_id) THEN
      RAISE EXCEPTION 'Request has events without a valid intent' USING ERRCODE = '22023';
    END IF;
    event_action := requested_action;
    event_details := jsonb_build_object('schema_version', 1);
    IF p_operation = 'deletion' THEN
      SELECT p.* INTO target FROM public.profiles p WHERE p.id = p_user_id FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Funcionário não encontrado.' USING ERRCODE = 'P0002';
      END IF;
      IF target.role IS DISTINCT FROM 'employee' THEN
        RAISE EXCEPTION 'Only employees may be deleted' USING ERRCODE = '42501';
      END IF;
      IF target.status = 'active' THEN
        RAISE EXCEPTION 'Desative o funcionário antes de excluí-lo.' USING ERRCODE = 'P0001';
      END IF;
      IF target.status IS DISTINCT FROM 'inactive' THEN
        RAISE EXCEPTION 'Invalid employee profile status' USING ERRCODE = '22023';
      END IF;
      event_details := event_details || jsonb_build_object('previous_status', target.status);
    END IF;
  ELSE
    IF intent.id IS NULL THEN
      RAISE EXCEPTION 'A committed compatible intent is required before an outcome'
        USING ERRCODE = '22023';
    END IF;
    IF p_operation = 'deletion' AND intent.entity_id IS DISTINCT FROM p_user_id::text THEN
      RAISE EXCEPTION 'Outcome employee differs from intent' USING ERRCODE = '22023';
    END IF;
    -- An initially unknown UUID may become known, but must never be lost or
    -- replaced afterwards. Check the entire request, not only its last event.
    IF EXISTS (
      SELECT 1 FROM public.activity_logs l
      WHERE l.request_id = p_request_id AND l.entity_id IS NOT NULL
        AND l.entity_id IS DISTINCT FROM p_user_id::text
    ) THEN
      RAISE EXCEPTION 'Known employee UUID cannot change across outcomes' USING ERRCODE = '22023';
    END IF;

    IF p_outcome = 'succeeded' THEN
      IF p_user_id IS NULL OR p_stage IS NOT NULL OR p_reason_code IS NOT NULL
         OR p_compensation_result IS NOT NULL THEN
        RAISE EXCEPTION 'Success requires a UUID and no failure metadata' USING ERRCODE = '22023';
      END IF;
      event_action := CASE p_operation WHEN 'creation' THEN 'employee.created' ELSE 'employee.deleted' END;
      event_details := jsonb_build_object('schema_version', 1);
    ELSE
      -- Only fixed codes, explicitly paired with the current backend stages.
      -- Post-create failure is confirmed ONLY after confirmed compensation.
      IF p_outcome = 'failed' THEN
        IF p_operation = 'creation' THEN
          IF NOT COALESCE(
            (p_stage = 'auth_create'
              AND p_reason_code IN ('account_exists', 'weak_password', 'auth_rejected')
              AND p_user_id IS NULL AND p_compensation_result IS NULL)
            OR
            (p_stage = 'profile_insert' AND p_reason_code = 'profile_write_failed'
              AND p_user_id IS NOT NULL AND p_compensation_result = 'succeeded'), false) THEN
            RAISE EXCEPTION 'Unconfirmed creation failure must be unknown' USING ERRCODE = '22023';
          END IF;
        ELSIF NOT COALESCE(p_stage = 'auth_delete' AND p_reason_code = 'auth_rejected'
                          AND p_compensation_result IS NULL, false) THEN
          RAISE EXCEPTION 'Unconfirmed deletion failure must be unknown' USING ERRCODE = '22023';
        END IF;
      ELSE
        IF p_operation = 'creation' THEN
          IF NOT COALESCE(
            (p_stage = 'auth_create' AND p_reason_code IN ('timeout', 'remote_outcome_unknown'))
            OR (p_stage = 'identity_check' AND p_reason_code = 'response_unverified')
            OR (p_stage = 'profile_lookup' AND p_reason_code IN ('lookup_failed', 'preexisting_profile'))
            OR (p_stage = 'profile_insert' AND p_reason_code = 'profile_write_outcome_unknown')
            OR (p_stage = 'compensation' AND p_reason_code = 'compensation_unconfirmed'), false) THEN
            RAISE EXCEPTION 'Invalid unknown creation outcome' USING ERRCODE = '22023';
          END IF;
          IF p_compensation_result IS NOT NULL
             AND p_compensation_result NOT IN ('not_attempted', 'unknown') THEN
            RAISE EXCEPTION 'Invalid uncertain compensation result' USING ERRCODE = '22023';
          END IF;
          IF p_compensation_result IS NOT NULL
             AND p_stage NOT IN ('profile_insert', 'compensation') THEN
            RAISE EXCEPTION 'Compensation metadata is not applicable to this stage' USING ERRCODE = '22023';
          END IF;
        ELSIF NOT COALESCE(
          ((p_stage = 'auth_delete' AND p_reason_code IN ('timeout', 'remote_outcome_unknown'))
            OR (p_stage = 'deletion_confirmation'
                AND p_reason_code IN ('confirmation_failed', 'profile_still_present')))
          AND p_compensation_result IS NULL, false) THEN
          RAISE EXCEPTION 'Invalid unknown deletion outcome' USING ERRCODE = '22023';
        END IF;
      END IF;
      event_action := 'employee.' || p_operation ||
        CASE p_outcome WHEN 'failed' THEN '_failed' ELSE '_outcome_unknown' END;
      event_details := jsonb_build_object('schema_version', 1,
        'stage', p_stage, 'reason_code', p_reason_code);
      IF p_compensation_result IS NOT NULL THEN
        event_details := event_details || jsonb_build_object('compensation_result', p_compensation_result);
      END IF;
    END IF;

    SELECT l.* INTO previous_result FROM public.activity_logs l
      WHERE l.request_id = p_request_id
        AND l.action IN (
          'employee.created', 'employee.deleted',
          'employee.creation_failed', 'employee.deletion_failed')
      ORDER BY l.id DESC LIMIT 1;
    IF previous_result.id IS NOT NULL THEN
      -- Terminal state takes precedence over deduplication of old unknowns.
      -- A replay must not depend on profiles that may since have changed.
      IF previous_result.action = event_action
         AND previous_result.entity_id IS NOT DISTINCT FROM p_user_id::text
         AND (p_outcome = 'succeeded' OR previous_result.details = event_details) THEN
        RETURN previous_result.id;
      END IF;
      RAISE EXCEPTION 'A final outcome is immutable' USING ERRCODE = '22023';
    END IF;

    -- Deduplicate against ALL earlier outcomes: unknown A -> unknown B -> A
    -- returns A's original ID rather than appending the same event again.
    SELECT l.id INTO event_id FROM public.activity_logs l
      WHERE l.request_id = p_request_id AND l.action = event_action
        AND l.entity_id IS NOT DISTINCT FROM p_user_id::text
        AND l.details = event_details
      ORDER BY l.id LIMIT 1;
    IF FOUND THEN
      RETURN event_id;
    END IF;

    -- Apply current-state checks only for a NEW event, never for a replay.
    IF p_outcome = 'failed' AND p_compensation_result = 'succeeded'
       AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = p_user_id) THEN
      RAISE EXCEPTION 'Confirmed compensation cannot leave an existing profile'
        USING ERRCODE = '22023';
    END IF;

    IF p_outcome = 'succeeded' THEN
      IF p_operation = 'creation' THEN
        SELECT p.* INTO target FROM public.profiles p WHERE p.id = p_user_id FOR SHARE;
        IF NOT FOUND OR target.role IS DISTINCT FROM 'employee'
           OR target.status IS DISTINCT FROM 'active' THEN
          RAISE EXCEPTION 'Creation success requires the confirmed active employee profile'
            USING ERRCODE = '22023';
        END IF;
        event_details := event_details || jsonb_build_object('role', target.role, 'status', target.status);
      ELSE
        IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = p_user_id) THEN
          RAISE EXCEPTION 'Deletion success requires confirmed profile absence'
            USING ERRCODE = '22023';
        END IF;
        event_details := event_details || jsonb_build_object(
          'previous_status', intent.details -> 'previous_status');
      END IF;
    END IF;
  END IF;

  INSERT INTO public.activity_logs (
    actor_id, actor_role, action, entity_type, entity_id, request_id, details
  ) VALUES (
    p_actor_id, actor_role, event_action, 'profile', p_user_id::text, p_request_id, event_details
  ) RETURNING id INTO event_id;
  RETURN event_id;
END;
$function$;

CREATE FUNCTION public.audit_employee_creation_requested(p_actor_id uuid, p_request_id uuid)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  RETURN private.activity_auth_admin_record(p_actor_id, p_request_id,
    'creation', 'requested', NULL, NULL, NULL, NULL);
END;
$function$;

CREATE FUNCTION public.audit_employee_creation_result(
  p_actor_id uuid, p_request_id uuid, p_outcome text,
  p_user_id uuid DEFAULT NULL, p_stage text DEFAULT NULL,
  p_reason_code text DEFAULT NULL, p_compensation_result text DEFAULT NULL
) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  IF p_outcome IS NULL OR p_outcome NOT IN ('succeeded', 'failed', 'unknown') THEN
    RAISE EXCEPTION 'Result must be succeeded, failed or unknown' USING ERRCODE = '22023';
  END IF;
  RETURN private.activity_auth_admin_record(p_actor_id, p_request_id,
    'creation', p_outcome, p_user_id, p_stage, p_reason_code, p_compensation_result);
END;
$function$;

CREATE FUNCTION public.audit_employee_deletion_requested(
  p_actor_id uuid, p_request_id uuid, p_user_id uuid
) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  RETURN private.activity_auth_admin_record(p_actor_id, p_request_id,
    'deletion', 'requested', p_user_id, NULL, NULL, NULL);
END;
$function$;

CREATE FUNCTION public.audit_employee_deletion_result(
  p_actor_id uuid, p_request_id uuid, p_user_id uuid, p_outcome text,
  p_stage text DEFAULT NULL, p_reason_code text DEFAULT NULL
) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  IF p_outcome IS NULL OR p_outcome NOT IN ('succeeded', 'failed', 'unknown') THEN
    RAISE EXCEPTION 'Result must be succeeded, failed or unknown' USING ERRCODE = '22023';
  END IF;
  RETURN private.activity_auth_admin_record(p_actor_id, p_request_id,
    'deletion', p_outcome, p_user_id, p_stage, p_reason_code, NULL);
END;
$function$;

-- Function-specific ACLs only; no changes to old RPCs, tables, sequences,
-- schema privileges, default privileges or business behavior.
DO $permissions$
DECLARE
  signature text;
  function_oid oid;
  application_role text;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'private.activity_auth_admin_record(uuid,uuid,text,text,uuid,text,text,text)',
    'public.audit_employee_creation_requested(uuid,uuid)',
    'public.audit_employee_creation_result(uuid,uuid,text,uuid,text,text,text)',
    'public.audit_employee_deletion_requested(uuid,uuid,uuid)',
    'public.audit_employee_deletion_result(uuid,uuid,uuid,text,text,text)'
  ]
  LOOP
    function_oid := to_regprocedure(signature);
    IF function_oid IS NULL THEN RAISE EXCEPTION 'Missing new function: %', signature; END IF;
    EXECUTE format('REVOKE ALL PRIVILEGES ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', signature);
    IF signature LIKE 'public.audit_employee_%' THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', signature);
    END IF;
    FOREACH application_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role']
    LOOP
      IF has_function_privilege(application_role, function_oid, 'EXECUTE')
         IS DISTINCT FROM (application_role = 'service_role' AND signature LIKE 'public.audit_employee_%') THEN
        RAISE EXCEPTION 'Unexpected effective EXECUTE: role=%, function=%', application_role, signature;
      END IF;
    END LOOP;
  END LOOP;
END;
$permissions$;

-- Integration/review limitations:
-- * These functions cannot verify Auth HTTP responses. A matching local profile
--   or its absence is only a consistency check, not proof of remote outcome.
-- * Backend MUST call requested separately before Auth and report success only
--   after its existing identity/profile checks. A single transaction spanning
--   Auth HTTP and these RPCs is not available. No Auth calls occur in this SQL.
-- * Result wrappers reject p_outcome='requested'; intent has its own entry.
-- * Creation compensation stays part of creation_failed/unknown, never a false
--   employee.deleted. An uncertain INSERT must not trigger blind compensation.
-- * Logging retries deduplicate; returning an intent ID does not mean Auth can
--   be repeated. No account-creation/deletion idempotency is promised.
-- * If actor becomes inactive between intent and outcome, the latter is denied;
--   intent remains for explicit reconciliation by the same active admin later.
-- * A different admin must use a new request after operational reconciliation;
--   this draft provides no cross-admin resolution endpoint or invented history.
-- * Intent records describe an authorized attempt, not a lock/reservation across
--   HTTP calls. Existing backend preconditions/compensation remain necessary.
-- * No FK, new table/index, business RPC replacement, or schema exposure change.

COMMIT;
