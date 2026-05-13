-- Phase 10 · Scale Engine (One-Click AI Nutrition Rotator)
-- ────────────────────────────────────────────────────────────────
-- Adds cloud-persisted meal-plan storage to bbf_users so the admin
-- rotator can overwrite a client's plan via Gemini and have it
-- survive page reload / next-session login.
--
-- Shape stored in nutrition_plan jsonb matches the LIVE MP[uid]
-- envelope that RN() in bbf-app.html reads from:
--   { name, cal, goal, days: [{ day, meals: [{ m, i }] }] }
-- Zero RN() rewrite required — fetched plan drops straight into MP[uid].
--
-- nutrition_plan_updated_at is set server-side on each rotation; the
-- Command Center surfaces it in a future "last rotated" badge.
-- ────────────────────────────────────────────────────────────────
ALTER TABLE bbf_users
  ADD COLUMN IF NOT EXISTS nutrition_plan jsonb NULL,
  ADD COLUMN IF NOT EXISTS nutrition_plan_updated_at timestamptz NULL;

COMMENT ON COLUMN bbf_users.nutrition_plan IS
  'Phase 10 AI Nutrition Rotator — cloud-persisted meal plan envelope. When non-null, overrides the bbf-data.js / bbf-app.html MP[uid] seed.';
COMMENT ON COLUMN bbf_users.nutrition_plan_updated_at IS
  'Timestamp of last successful /api/rotate-nutrition write for this client.';
