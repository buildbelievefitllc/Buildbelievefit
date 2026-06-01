DELETE FROM bbf_sets WHERE log_id IS NULL;

ALTER TABLE bbf_sets ALTER COLUMN log_id SET NOT NULL;

ALTER TABLE bbf_sets DROP CONSTRAINT IF EXISTS bbf_sets_log_id_fkey;

ALTER TABLE bbf_sets
  ADD CONSTRAINT bbf_sets_log_id_fkey
  FOREIGN KEY (log_id) REFERENCES bbf_logs(id) ON DELETE CASCADE;