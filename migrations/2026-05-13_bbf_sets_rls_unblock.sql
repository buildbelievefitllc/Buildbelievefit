-- Phase 5 · bbf_sets RLS Unblock
-- ────────────────────────────────────────────────────────────────
-- bbf_sets had RLS enabled with ZERO policies — every PostgREST POST
-- from the frontend's syncSet() was silently denied. That's why
-- bbf_sets had 0 rows even with active clients logging workouts.
--
-- Adds INSERT + SELECT policies for anon, mirroring the
-- bbf_audit_logs Phase 9.5 pattern (Allow Anon Inserts / Allow Anon
-- Select). Permissive USING / WITH CHECK = true — to be tightened to
-- (user_id = auth.uid()) or admin-token in a future security pass.
--
-- No UPDATE / DELETE policies — sets are append-only. If a user
-- corrects a set, they re-INSERT and the most-recent-by-set_number
-- rule in bbf_get_last_weights() picks the latest.
-- ────────────────────────────────────────────────────────────────

ALTER TABLE bbf_sets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow Anon Insert Sets" ON bbf_sets;
CREATE POLICY "Allow Anon Insert Sets"
  ON bbf_sets FOR INSERT TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow Anon Select Sets" ON bbf_sets;
CREATE POLICY "Allow Anon Select Sets"
  ON bbf_sets FOR SELECT TO anon
  USING (true);
