-- ═══════════════════════════════════════════════════════════════
-- Phase 2 schema-gap migration
-- Date:    2026-05-04
-- Project: ihclbceghxpuawymlvgi (bbf-lab)
-- Author:  Claude (per CEO directive)
--
-- Purpose: Resolve PGRST204 / 42703 errors caused by frontend
--          payloads referencing columns that don't exist in the DB.
--
-- Scope (per CEO directive — minimum viable, additive only):
--   bbf_users  +  ghost_intervention_needed  boolean
--              +  access_status              text
--              +  somatic_cognitive_load     numeric
--              +  cns_friction_score         numeric
--              +  biomechanical_redline      boolean
--   bbf_sets   +  user_id                    uuid (FK → bbf_users.id)
--   bbf_logs   +  body_fat                   text
--
-- All operations use IF NOT EXISTS so re-running is a no-op.
-- No existing data is mutated.
--
-- To execute: paste this block into the Supabase SQL Editor and
--             run. Verify with the SELECTs at the bottom.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ─── bbf_users : sovereign-state columns ─────────────────────────
-- Types chosen to match how the frontend reads/writes them:
--   ghost_intervention_needed: bbf-sync.js uses !!profile.ghost_intervention_needed (bool)
--   access_status:             bbf-app.html stores 'unlocked'|'locked' strings
--   somatic_cognitive_load:    bbf-sync.js applies numOrNull and arithmetic
--   cns_friction_score:        bbf-sync.js stores numeric score
--   biomechanical_redline:     bbf-app.html uses !!intel.biomechanical_redline
ALTER TABLE public.bbf_users
  ADD COLUMN IF NOT EXISTS ghost_intervention_needed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS access_status             text    DEFAULT 'unlocked',
  ADD COLUMN IF NOT EXISTS somatic_cognitive_load    numeric,
  ADD COLUMN IF NOT EXISTS cns_friction_score        numeric,
  ADD COLUMN IF NOT EXISTS biomechanical_redline     boolean DEFAULT false;

-- ─── bbf_sets : direct-user FK (bypassing log_id join) ───────────
-- Frontend syncSet writes user_id directly. The existing log_id
-- column is preserved (sets joined via a log row remain valid);
-- this column is the alternative direct-FK path.
ALTER TABLE public.bbf_sets
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.bbf_users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS bbf_sets_user_id_idx ON public.bbf_sets(user_id);

-- ─── bbf_logs : body composition snapshot ────────────────────────
-- Frontend stores body_fat as text (allows '' as the empty default
-- as well as numeric strings like '17.4'). Kept text to avoid a
-- migration-time validation break on existing empty rows.
ALTER TABLE public.bbf_logs
  ADD COLUMN IF NOT EXISTS body_fat text;

COMMIT;

-- ═══════════════════════════════════════════════════════════════
-- Verification (run after the COMMIT above; optional)
-- ═══════════════════════════════════════════════════════════════
-- 1) Confirm bbf_users now has the five new columns:
--    SELECT column_name, data_type, column_default
--    FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='bbf_users'
--      AND column_name IN ('ghost_intervention_needed','access_status',
--                          'somatic_cognitive_load','cns_friction_score',
--                          'biomechanical_redline')
--    ORDER BY column_name;
--
-- 2) Confirm bbf_sets.user_id exists with FK to bbf_users:
--    SELECT column_name, data_type FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='bbf_sets' AND column_name='user_id';
--
-- 3) Confirm bbf_logs.body_fat exists:
--    SELECT column_name, data_type FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='bbf_logs' AND column_name='body_fat';
