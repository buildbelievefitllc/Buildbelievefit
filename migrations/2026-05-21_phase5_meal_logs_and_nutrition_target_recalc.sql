-- ════════════════════════════════════════════════════════════════════════
-- Phase 5 · Nutrition Tab Agentic Evolution · Operation Pantheon
-- Migration: bbf_meal_logs (transient daily intake) + proposal_type extend
-- ────────────────────────────────────────────────────────────────────────
-- · bbf_meal_logs is the TRANSIENT log table for daily food intake.
--   Routine writes from BBF_NUTRITION_INTEL go here · NEVER to
--   bbf_audit_logs (which is reserved for agentic actions). Keeps the
--   audit ledger clean and lets the wellbeing guardrail query daily
--   totals efficiently.
-- · proposal_type CHECK extended with 'nutrition_target_recalc' so the
--   Sunday Midnight Haiku weekly reconciliation can stage proposals
--   through the existing /api/proposal-submit pipeline.
-- ════════════════════════════════════════════════════════════════════════

-- 1. bbf_meal_logs · transient daily intake
CREATE TABLE IF NOT EXISTS public.bbf_meal_logs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES public.bbf_users(id) ON DELETE CASCADE,
  logged_at          timestamptz NOT NULL DEFAULT now(),
  log_date           date NOT NULL DEFAULT CURRENT_DATE,
  meal_slot          text,
  meal_name          text,
  calories           integer,
  protein_g          integer,
  carbs_g            integer,
  fats_g             integer,
  source             text NOT NULL DEFAULT 'manual',
  portion_confidence numeric,
  vision_payload     jsonb,
  metadata           jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS bbf_meal_logs_user_date_idx
  ON public.bbf_meal_logs (user_id, log_date DESC);
CREATE INDEX IF NOT EXISTS bbf_meal_logs_logged_at_idx
  ON public.bbf_meal_logs (logged_at DESC);

-- RLS · mirrors bbf_sets / bbf_logs anon-policy pattern · append-only
ALTER TABLE public.bbf_meal_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow Anon Insert Meal Logs" ON public.bbf_meal_logs;
CREATE POLICY "Allow Anon Insert Meal Logs"
  ON public.bbf_meal_logs FOR INSERT TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow Anon Select Meal Logs" ON public.bbf_meal_logs;
CREATE POLICY "Allow Anon Select Meal Logs"
  ON public.bbf_meal_logs FOR SELECT TO anon
  USING (true);

-- 2. Extend bbf_pending_review.proposal_type CHECK · add nutrition_target_recalc
ALTER TABLE public.bbf_pending_review
  DROP CONSTRAINT IF EXISTS bbf_pending_review_proposal_type_check;

ALTER TABLE public.bbf_pending_review
  ADD CONSTRAINT bbf_pending_review_proposal_type_check
  CHECK (proposal_type = ANY (ARRAY[
    'program_swap','program_create','program_progress',
    'nutrition_swap','nutrition_rotate','nutrition_macro_adjust','nutrition_target_recalc',
    'cardio_prescription','cardio_intensity_shift','cardio_structure_change',
    'prehab_assignment','prehab_escalation',
    'athlete_evolution','baseline_recompute',
    'cns_intervention','redline_override',
    'block_priority_shift','tier_upgrade','provision_override',
    'roster_action','custom',
    'phase_advancement','adaptive_drill_candidate','transient_swap','youth_load_progression'
  ]));
