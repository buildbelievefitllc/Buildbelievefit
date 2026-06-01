ALTER TABLE bbf_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow Anon Insert Logs" ON bbf_logs;
CREATE POLICY "Allow Anon Insert Logs"
  ON bbf_logs FOR INSERT TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow Anon Select Logs" ON bbf_logs;
CREATE POLICY "Allow Anon Select Logs"
  ON bbf_logs FOR SELECT TO anon
  USING (true);