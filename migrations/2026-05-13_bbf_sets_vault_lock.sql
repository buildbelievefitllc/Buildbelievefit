-- Phase 6 Vault Lock · NULL log_id Cannot Happen Again
-- ────────────────────────────────────────────────────────────────
-- The diagnostic showed 132 orphan bbf_sets rows (~78% of the table)
-- vs 37 properly linked. All orphans are from today's date — the
-- pre-Phase-6 inline SVS code path was still firing from cached
-- bundles on testing browsers.
--
-- Four-step lockdown:
--   1. PURGE existing orphans — no historical debris hauled into
--      the 6 AM client onboarding.
--   2. ALTER COLUMN log_id SET NOT NULL — DB-level guarantee.
--      Once applied, any code path that tries to insert NULL
--      log_id will 4xx, supa() returns null, syncSetsBulk throws,
--      user sees an alert. No more silent NULL writes.
--   3. DROP existing FK (which lacked ON DELETE CASCADE).
--   4. Re-create FK with ON DELETE CASCADE so the atomic-rollback
--      DELETE on bbf_logs auto-cleans linked bbf_sets — relational
--      integrity at the DB layer.
-- ────────────────────────────────────────────────────────────────

-- 1. Purge orphans
DELETE FROM bbf_sets WHERE log_id IS NULL;

-- 2. Enforce log_id is always present
ALTER TABLE bbf_sets ALTER COLUMN log_id SET NOT NULL;

-- 3. Drop the existing FK (it has no CASCADE)
ALTER TABLE bbf_sets DROP CONSTRAINT IF EXISTS bbf_sets_log_id_fkey;

-- 4. Re-create FK with ON DELETE CASCADE
ALTER TABLE bbf_sets
  ADD CONSTRAINT bbf_sets_log_id_fkey
  FOREIGN KEY (log_id) REFERENCES bbf_logs(id) ON DELETE CASCADE;
