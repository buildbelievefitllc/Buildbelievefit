ALTER TABLE bbf_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow Admin Update Audits" ON bbf_audit_logs;
CREATE POLICY "Allow Admin Update Audits" ON bbf_audit_logs FOR UPDATE USING (true) WITH CHECK (true);