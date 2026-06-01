ALTER TABLE bbf_sets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow Anon Insert Sets" ON bbf_sets;
CREATE POLICY "Allow Anon Insert Sets"
  ON bbf_sets FOR INSERT TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow Anon Select Sets" ON bbf_sets;
CREATE POLICY "Allow Anon Select Sets"
  ON bbf_sets FOR SELECT TO anon
  USING (true);