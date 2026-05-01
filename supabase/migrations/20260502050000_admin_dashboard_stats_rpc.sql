-- Phase 9 — Mastermind Portal Command Center stats from Supabase.
-- Replaces localStorage reads in mastermind-portal.html that 0'd out on
-- fresh browsers (no cached bbf_v7). Single-roundtrip RPC, mirrors the
-- bbf_get_uid_map / bbf_set_trial_status / bbf_verify_admin_pin pattern.

CREATE OR REPLACE FUNCTION public.bbf_get_admin_dashboard_stats()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total_clients', (SELECT count(*) FROM public.bbf_users
                       WHERE COALESCE(role,'client') = 'client'),
    'total_logs',    (SELECT count(*) FROM public.bbf_logs),
    'total_audits',  (SELECT count(*) FROM public.bbf_audit_logs)
  );
$$;

GRANT EXECUTE ON FUNCTION public.bbf_get_admin_dashboard_stats() TO anon, authenticated;

COMMENT ON FUNCTION public.bbf_get_admin_dashboard_stats() IS
  'Phase 9 — Mastermind Portal Command Center stats. Counts active clients, total logs, total audits. SECURITY DEFINER mirrors bbf_get_uid_map / bbf_set_trial_status pattern.';
