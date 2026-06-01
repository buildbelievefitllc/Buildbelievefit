-- Phase 3 · Smart Cardio · add cardio_structure_change to the proposal type enum.
-- Drop+recreate the CHECK constraint with the new value appended.
DO $$
DECLARE v_cname text;
BEGIN
  SELECT con.conname INTO v_cname
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace ns ON ns.oid = rel.relnamespace
  WHERE ns.nspname='public' AND rel.relname='bbf_pending_review' AND con.contype='c'
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
    'phase_advancement','adaptive_drill_candidate','transient_swap','youth_load_progression',
    -- Phase 3 addition
    'cardio_structure_change'
  ));

-- PAR-Q+ self-screen storage on bbf_users · adjacent to cardiac_clearance.
-- The screen itself is a JSONB { questions[], answers[], screened_at, version }
-- so the underlying instrument can evolve without schema churn.
ALTER TABLE public.bbf_users
  ADD COLUMN IF NOT EXISTS par_q_screen     jsonb,
  ADD COLUMN IF NOT EXISTS par_q_screened_at timestamptz;

COMMENT ON COLUMN public.bbf_users.par_q_screen IS
  'Phase 3 · Smart Cardio PAR-Q+ self-screen snapshot. JSONB { version, answers:{q1..q7}, flags:[], screened_at }. Drives cardiac_clearance state transitions · NEVER auto-set by AI · always user-attested.';