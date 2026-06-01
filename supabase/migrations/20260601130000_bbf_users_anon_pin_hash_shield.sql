-- ═══════════════════════════════════════════════════════════════════════════
-- BBF SUPABASE — SHIELD bbf_users.pin_hash (and all sensitive cols) FROM anon
-- ═══════════════════════════════════════════════════════════════════════════
-- Closes the hole flagged after the Path 2 lockdown: bbf_users carried an
-- "Allow Anon Select" policy with qual=true, so the public anon key (shipped in
-- the client bundle) could read EVERY column of EVERY user — including the
-- bcrypt `pin_hash`, `email`, and clinical fields (par_q_screen,
-- cardiac_clearance, somatic_*, nutrition_plan, allergens, ...).
--
-- ── WHY THIS IS COLUMN-LEVEL, NOT A POLICY ─────────────────────────────────
-- RLS is ROW-level: a SELECT policy's USING clause filters which rows are
-- visible, it CANNOT hide a column. Shielding pin_hash from anon therefore
-- requires COLUMN privileges, which Postgres enforces independently of RLS.
-- We revoke anon's table-wide SELECT and re-grant SELECT on only the two
-- non-sensitive bootstrap columns (uid, name). After this:
--   • anon SELECT uid, name        -> allowed (active rows only, via RLS)
--   • anon SELECT pin_hash / email -> ERROR: permission denied for column
--   • anon SELECT *                -> ERROR (lacks privilege on other columns)
-- Two independent locks (column privilege + row policy) both protect the hash.
--
-- The PIN auth flow is unaffected: bbf_verify_user_pin / bbf_verify_admin_pin
-- are SECURITY DEFINER and read pin_hash as the function owner, bypassing both
-- RLS and these grants. service_role likewise bypasses everything.
--
-- ── ALSO CLOSED: the anon WRITE vector ─────────────────────────────────────
-- anon additionally held INSERT/UPDATE on bbf_users. Combined with the
-- pre-existing bbf_users_hide_soft_deleted policy (FOR ALL, public,
-- USING deleted_at IS NULL, no WITH CHECK), the public anon key could
-- OVERWRITE any active user's pin_hash/email/clinical fields — account
-- takeover, a strictly worse leak than reading the hash. anon never writes
-- bbf_users directly (registration -> Supabase Auth signUp + service_role;
-- PIN provisioning -> SECURITY DEFINER RPCs), so we revoke all anon DML.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Remove the qual=true all-columns anon read.
DROP POLICY IF EXISTS "Allow Anon Select" ON public.bbf_users;

-- 2. Strip ALL anon privileges (read + the dangerous INSERT/UPDATE), then
--    re-grant SELECT on ONLY the non-sensitive bootstrap columns. Column
--    GRANTs are an allowlist — every column not named here, pin_hash
--    included, is unreadable by anon; and anon can no longer write at all.
REVOKE ALL ON public.bbf_users FROM anon;
GRANT  SELECT (uid, name) ON public.bbf_users TO anon;

-- 3. Explicit, narrowly-named row policy so anon's permitted SELECT (limited to
--    the columns above) returns only active profiles — decoupled from the
--    pre-existing bbf_users_hide_soft_deleted policy.
DROP POLICY IF EXISTS "anon reads active profile bootstrap" ON public.bbf_users;
CREATE POLICY "anon reads active profile bootstrap" ON public.bbf_users
  FOR SELECT TO anon
  USING (deleted_at IS NULL);
