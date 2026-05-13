-- Phase 6 · bbf_logs RLS Unblock
-- ────────────────────────────────────────────────────────────────
-- Same pattern that bit bbf_sets in Phase 5 and bbf_audit_logs in
-- Phase 9.5: bbf_logs had RLS enabled with ZERO policies, so every
-- PostgREST POST from syncLog was silently denied. That's why
-- "Total Sessions" stays at 0 even after a workout completes — the
-- session row never lands, so bbf_get_profile_metrics counts zero.
--
-- Adds INSERT + SELECT policies for anon, mirroring the bbf_sets
-- shape (USING true / WITH CHECK true). To be tightened to
-- user_id = auth.uid() in a future security pass.
--
-- No UPDATE / DELETE policies — logs are append-only.
-- ────────────────────────────────────────────────────────────────

ALTER TABLE bbf_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow Anon Insert Logs" ON bbf_logs;
CREATE POLICY "Allow Anon Insert Logs"
  ON bbf_logs FOR INSERT TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow Anon Select Logs" ON bbf_logs;
CREATE POLICY "Allow Anon Select Logs"
  ON bbf_logs FOR SELECT TO anon
  USING (true);
