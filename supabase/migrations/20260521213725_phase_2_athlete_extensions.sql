-- ════════════════════════════════════════════════════════════════════════
-- OPERATION PANTHEON · PHASE 2 · ATHLETE PORTAL
-- ────────────────────────────────────────────────────────────────────────
--  1. Extend bbf_athlete_progression with mesocycle history columns so
--     BBF_INTEL.calculateAthleteProtocol can read historical context.
--  2. Extend bbf_pending_review.proposal_type enum to include the new
--     athlete-side proposal classes (phase_advancement, adaptive_drill_
--     candidate, transient_swap).
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.bbf_athlete_progression
  ADD COLUMN IF NOT EXISTS mesocycle_started_at  timestamptz,
  ADD COLUMN IF NOT EXISTS mesocycle_week        integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS target_phase          text,
  ADD COLUMN IF NOT EXISTS phase_history         jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS rpe_avg_last_3        numeric,
  ADD COLUMN IF NOT EXISTS friction_avg_last_3   numeric,
  ADD COLUMN IF NOT EXISTS guardian_consent      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS guardian_consent_at   timestamptz;

CREATE INDEX IF NOT EXISTS bbf_athlete_progression_user_phase_idx
  ON public.bbf_athlete_progression (user_id, phase, completed_at DESC);

COMMENT ON COLUMN public.bbf_athlete_progression.mesocycle_started_at IS
  'When the current mesocycle began · used by BBF_INTEL to compute weeks-in-block.';
COMMENT ON COLUMN public.bbf_athlete_progression.phase_history IS
  'JSONB array of { phase, started_at, ended_at, weeks } · gives the agentic engine cumulative mesocycle context.';
COMMENT ON COLUMN public.bbf_athlete_progression.guardian_consent IS
  'Youth-athlete tier safety lock · required true before any phase advancement proposal can be executed for a youth_athlete uid.';

-- Extend the proposal_type enum to cover Phase 2 routes. Postgres has no
-- native enum-alteration without dropping; we use a CHECK constraint so
-- the change is a simple ALTER. Capture the existing list verbatim from
-- the Phase 0 migration and append the four new types.
DO $$
DECLARE
  v_cname text;
BEGIN
  SELECT con.conname INTO v_cname
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace ns ON ns.oid = rel.relnamespace
  WHERE ns.nspname = 'public'
    AND rel.relname = 'bbf_pending_review'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%proposal_type%';
  IF v_cname IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.bbf_pending_review DROP CONSTRAINT ' || quote_ident(v_cname);
  END IF;
END $$;

ALTER TABLE public.bbf_pending_review
  ADD CONSTRAINT bbf_pending_review_proposal_type_check
  CHECK (proposal_type IN (
    'program_swap','program_create','program_progress',
    'nutrition_swap','nutrition_rotate','nutrition_macro_adjust',
    'cardio_prescription','cardio_intensity_shift',
    'prehab_assignment','prehab_escalation',
    'athlete_evolution','baseline_recompute',
    'cns_intervention','redline_override',
    'block_priority_shift','tier_upgrade','provision_override',
    'roster_action','custom',
    -- Phase 2 additions
    'phase_advancement',          -- mesocycle transition · requires guardian consent for youth_athlete
    'adaptive_drill_candidate',   -- novel drill Claude proposed · founder must vet content
    'transient_swap',             -- live mid-session swap recorded for audit (also writes bbf_logs)
    'youth_load_progression'      -- conservative ceiling override · always requires approval
  ));

COMMENT ON CONSTRAINT bbf_pending_review_proposal_type_check ON public.bbf_pending_review IS
  'Phase 2 · added phase_advancement, adaptive_drill_candidate, transient_swap, youth_load_progression for Athlete Portal contracts.';