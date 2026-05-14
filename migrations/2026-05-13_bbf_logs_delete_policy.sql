-- Phase 6 Final · Atomic Rollback DELETE Permission
-- ────────────────────────────────────────────────────────────────
-- The new syncSession atomic-rollback path needs to DELETE the just-
-- inserted bbf_logs row when the linked bbf_sets bulk POST fails or
-- returns a partial-drop count mismatch. Without this policy the
-- DELETE returns 401, the rollback can't complete, and the user
-- ends up with an orphan parent log every time the child insert fails.
--
-- Mirrors the existing Allow Anon Insert/Select Logs shape. Tighten
-- to user_id = auth.uid() in the same security pass that gates the
-- other permissive policies.
-- ────────────────────────────────────────────────────────────────

ALTER TABLE bbf_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow Anon Delete Logs" ON bbf_logs;
CREATE POLICY "Allow Anon Delete Logs"
  ON bbf_logs FOR DELETE TO anon
  USING (true);
