-- ═══════════════════════════════════════════════════════════════════════════
-- BBF SUPABASE — ADD PLAN COLUMNS (Phase 4, Step A — Closed Loop bridge)
-- ═══════════════════════════════════════════════════════════════════════════
-- Adds workout_plan, meal_plan, and plans_generated_at columns to
-- bbf_active_clients so the Render Vault Engine (index.js /process endpoint)
-- can write Anthropic-generated Markdown back to the client's row.
--
-- This closes the previously open loop where /process generated plans but
-- had nowhere to store them — the Markdown was returned in the HTTP
-- response only and was lost the moment the response was discarded.
--
-- Step A of the 5-step Phase 4 bridge per Big Jim v2's V12 vision:
--   A. Schema columns (THIS migration)
--   B. Render writes Markdown back to columns after Anthropic generation
--   C. index.html doSubmit() calls /process directly (alongside Formspree+Zapier)
--   D. bbf-app.html reads + displays workout_plan / meal_plan for the user
--   E. Credential auto-provisioning + welcome email with username+PIN
--
-- All columns are nullable. Existing 4 bbf_active_clients rows will have
-- NULL plans. They'll backfill if their Pathfinder payload is re-processed,
-- or stay NULL forever (harmless).
--
-- See api/BIGJIM_V12_DIRECTIVE.md for the full vision context.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.bbf_active_clients
  ADD COLUMN IF NOT EXISTS workout_plan        TEXT,
  ADD COLUMN IF NOT EXISTS meal_plan           TEXT,
  ADD COLUMN IF NOT EXISTS plans_generated_at  TIMESTAMPTZ;
