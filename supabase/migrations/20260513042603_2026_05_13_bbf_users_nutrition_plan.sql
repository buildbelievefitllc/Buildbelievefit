ALTER TABLE bbf_users
  ADD COLUMN IF NOT EXISTS nutrition_plan jsonb NULL,
  ADD COLUMN IF NOT EXISTS nutrition_plan_updated_at timestamptz NULL;

COMMENT ON COLUMN bbf_users.nutrition_plan IS
  'Phase 10 AI Nutrition Rotator — cloud-persisted meal plan envelope. When non-null, overrides the bbf-data.js / bbf-app.html MP[uid] seed.';
COMMENT ON COLUMN bbf_users.nutrition_plan_updated_at IS
  'Timestamp of last successful /api/rotate-nutrition write for this client.';