ALTER TABLE bbf_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow Anon Delete Logs" ON bbf_logs;
CREATE POLICY "Allow Anon Delete Logs"
  ON bbf_logs FOR DELETE TO anon
  USING (true);