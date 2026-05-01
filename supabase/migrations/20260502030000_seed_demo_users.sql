-- ============================================================================
-- BBF DEMO CLIENT SEED + slug → UUID resolver RPC
-- ============================================================================
-- Description:
--   1. Seed bbf_users rows for the 5 demo clients hardcoded in bbf-app.html
--      (the d.u dictionary at lines ~4335, 6282, 6495, 6810, 6944).
--   2. Expose a SECURITY DEFINER RPC that returns (uid, id) pairs so the
--      frontend can resolve slug → UUID without granting anon broad SELECT
--      on bbf_users (which would expose pin_hash et al).
--
--   Without this seed + RPC, every Supabase write/read keyed by user_id 400's
--   for demo clients: bbf-app.html passes the slug ('ana_bbf', etc.) as uid,
--   which then lands in uuid-typed user_id columns (bbf_audit_logs, bbf_logs,
--   bbf_sets) and Postgres rejects the cast.
--
--   bbf_users.uid (text UNIQUE) is the slug column.
--   bbf_users.id  (uuid PK)     is the FK target referenced by bbf_audit_logs,
--                                bbf_logs, bbf_sets, etc. — auto-generated
--                                via uuid_generate_v4().
--
--   Pattern matches the existing bbf_verify_admin_pin RPC (SECURITY DEFINER +
--   GRANT EXECUTE TO anon).
-- ============================================================================

-- 1. Seed demo client rows -----------------------------------------------------
INSERT INTO public.bbf_users (uid, name, role, metabolic_tier) VALUES
  ('ana_bbf',     'Ana',     'client', '12:12 Foundation'),
  ('jacky_bbf',   'Jacky',   'client', '12:12 Foundation'),
  ('suzanna_bbf', 'Suzanna', 'client', '12:12 Foundation'),
  ('jordan_bbf',  'Jordan',  'client', '12:12 Foundation'),
  ('wayne_bbf',   'Wayne',   'client', '12:12 Foundation')
ON CONFLICT (uid) DO NOTHING;

-- 2. Slug → UUID resolver RPC --------------------------------------------------
CREATE OR REPLACE FUNCTION public.bbf_get_uid_map()
RETURNS TABLE (uid text, id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.uid, u.id FROM public.bbf_users u WHERE u.uid IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.bbf_get_uid_map() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bbf_get_uid_map() TO anon, authenticated;
