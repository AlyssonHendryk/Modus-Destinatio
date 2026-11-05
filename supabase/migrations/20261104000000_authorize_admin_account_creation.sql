-- Review required. Apply manually before enabling administrative account creation.
-- Keeps the existing creation action catalog for historical compatibility.
-- employee.created details.role records the actual assigned role.
BEGIN;
DO $preflight$
BEGIN
  IF current_user <> 'postgres'
     OR to_regprocedure('private.activity_auth_admin_record(uuid,uuid,text,text,uuid,text,text,text)') IS NULL THEN
    RAISE EXCEPTION 'Requires postgres and the existing Auth audit migration';
  END IF;
END;
$preflight$;

-- Explicit, committed authorization to create a NEW admin account. No passwords,
-- emails or Auth responses. This table does not authorize editing existing roles.
CREATE TABLE private.admin_creation_requests (
  request_id uuid PRIMARY KEY,
  actor_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
REVOKE ALL ON TABLE private.admin_creation_requests FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.activity_auth_admin_record(
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
        IF NOT FOUND
           OR target.role IS DISTINCT FROM (
             CASE
               WHEN EXISTS (
                 SELECT 1 FROM private.admin_creation_requests r
                 WHERE r.request_id = p_request_id AND r.actor_id = p_actor_id
               ) THEN 'admin'
               ELSE 'employee'
             END
           )
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


CREATE FUNCTION public.audit_admin_creation_requested(p_actor_id uuid, p_request_id uuid)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE event_id bigint;
BEGIN
  PERFORM private.activity_require_actor(p_actor_id, p_request_id, true);
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text, 0));
  IF EXISTS (
    SELECT 1 FROM public.activity_logs l WHERE l.request_id = p_request_id
  ) AND NOT EXISTS (
    SELECT 1 FROM private.admin_creation_requests r
    WHERE r.request_id = p_request_id AND r.actor_id = p_actor_id
  ) THEN
    RAISE EXCEPTION 'Request already belongs to another operation' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM private.admin_creation_requests r
    WHERE r.request_id = p_request_id AND r.actor_id <> p_actor_id
  ) THEN
    RAISE EXCEPTION 'Request belongs to another administrator' USING ERRCODE = '42501';
  END IF;
  INSERT INTO private.admin_creation_requests(request_id, actor_id)
  VALUES(p_request_id, p_actor_id) ON CONFLICT DO NOTHING;
  event_id := private.activity_auth_admin_record(
    p_actor_id, p_request_id, 'creation', 'requested', NULL, NULL, NULL, NULL);
  RETURN event_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.audit_admin_creation_requested(uuid,uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.audit_admin_creation_requested(uuid,uuid) TO service_role;

CREATE FUNCTION public.audit_complete_admin_creation(
  p_actor_id uuid, p_request_id uuid, p_user_id uuid, p_name text
) RETURNS TABLE(id uuid, name text, role text, status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  PERFORM private.activity_require_actor(p_actor_id, p_request_id, true);
  IF p_user_id IS NULL OR p_user_id = p_actor_id OR p_name IS NULL
     OR char_length(btrim(p_name)) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'Invalid account profile' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM private.admin_creation_requests r
    WHERE r.request_id = p_request_id AND r.actor_id = p_actor_id
  ) THEN
    RAISE EXCEPTION 'Explicit administrator authorization required' USING ERRCODE = '42501';
  END IF;
  -- Insert only, never overwrite an existing identity. The profiles FK proves
  -- that this UUID exists in Auth; no password or token is stored here.
  INSERT INTO public.profiles(id, name, role, status)
  VALUES(p_user_id, btrim(p_name), 'admin', 'active');
  PERFORM private.activity_auth_admin_record(
    p_actor_id, p_request_id, 'creation', 'succeeded', p_user_id, NULL, NULL, NULL);
  RETURN QUERY SELECT p.id, p.name, p.role, p.status FROM public.profiles p WHERE p.id = p_user_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.audit_complete_admin_creation(uuid,uuid,uuid,text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.audit_complete_admin_creation(uuid,uuid,uuid,text) TO service_role;
-- Existing helper ACL is retained by CREATE OR REPLACE. Require active admin at
-- both intent and outcome; use the existing fixed-code partial-failure protocol.
COMMIT;
