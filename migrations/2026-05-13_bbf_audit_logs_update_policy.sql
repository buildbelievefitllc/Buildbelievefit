-- Phase 9.5 Hotfix · Mark Resolved RLS Override
-- ────────────────────────────────────────────────────────────────
-- Symptom: "Mark Resolved" button in Sovereign Command Center optimistic-
-- ally hides the audit card, but bbf_audit_logs.resolved_at never updates
-- in the database. On next render the audit reappears.
--
-- Root cause: bbf_audit_logs has RLS enabled with policies only for
--   - "Allow Anon Inserts" (INSERT only)
--   - "Allow Anon Select"  (SELECT only)
-- No UPDATE policy. PostgREST PATCH then returns 200 with [] (zero rows
-- affected — RLS silently filters them out). The frontend resolveAudit
-- helper threw audit_not_found, which the click handler historically
-- treated as success (the parallel-tab dedupe pattern).
--
-- Fix: open the gate for UPDATE. Permissive USING/WITH CHECK = true so
-- any anon role can mark any audit resolved. This matches the existing
-- "Allow Anon Inserts" pattern (also USING(true)). To be tightened in a
-- future security pass with admin-token / JWT verification.
-- ────────────────────────────────────────────────────────────────

ALTER TABLE bbf_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow Admin Update Audits" ON bbf_audit_logs;
CREATE POLICY "Allow Admin Update Audits" ON bbf_audit_logs FOR UPDATE USING (true) WITH CHECK (true);
