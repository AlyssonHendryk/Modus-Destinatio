-- Etapa 18.86. REVIEW REQUIRED; NOT EXECUTED.
-- Read-only admin listing. Existing functions/ACLs are not modified.
BEGIN;

DO $preflight$
BEGIN
  IF current_user <> 'postgres' OR to_regclass('public.activity_logs') IS NULL THEN
    RAISE EXCEPTION 'Requires postgres and the activity_logs migration';
  END IF;
END;
$preflight$;

CREATE FUNCTION public.audit_list_activity_logs(
  p_actor_id uuid, p_user_id uuid, p_action text,
  p_date_from timestamptz, p_date_to timestamptz, p_limit integer,
  p_as_of timestamptz, p_before_at timestamptz, p_before_id bigint
) RETURNS TABLE (
  id bigint, occurred_at timestamptz, actor_id uuid, actor_role text,
  action text, entity_type text, entity_id text, request_id uuid, details jsonb
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  -- Do not call the business actor helper: it takes write row locks.
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
    SELECT l.id, l.occurred_at, l.actor_id, l.actor_role, l.action,
      l.entity_type, l.entity_id, l.request_id, l.details
    FROM public.activity_logs l
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

-- Keyset + fixed as_of avoids offset drift and excludes newer event times.
-- Separate HTTP calls do not share an MVCC snapshot: transactions committing
-- late with older occurred_at may require refreshing the listing. No attempt
-- is made to lock writers or hold database snapshots across HTTP requests.
-- FastAPI validates the signed cursor and response details allowlists.
COMMIT;
