-- Phase 21: TDEE / Daily Burn calculator micro-lead capture.
-- Home for computed-and-bounced calculator prospects who have NOT completed the
-- full Pathfinder application (no PAR-Q, no liability waiver on file). Kept OUT of
-- bbf_leads (which represents actual screened applications) so Comlink triage
-- semantics stay honest: "Applications" (bbf_leads) vs "TDEE Signals" (this table)
-- are separate lanes, never merged. converted_lead_id is a best-effort breadcrumb,
-- backfilled by bbf-lead-capture when the same email later completes a full
-- Pathfinder application.
--
-- Applied live via mcp__Supabase__apply_migration on 2026-07-09; this file mirrors
-- that change into version control (repo convention — every live migration has a
-- matching checked-in file).

CREATE TABLE IF NOT EXISTS public.bbf_tdee_leads (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source            text NOT NULL CHECK (source IN ('tdee_calculator', 'daily_burn')),
  email             text NOT NULL,
  full_name         text,
  age               int,
  sex               text,
  weight_lbs        numeric,
  height_ft         int,
  height_in         int,
  activity_factor   numeric,
  goal              text,
  tdee_maintenance  int,
  tdee_target       int,
  macro_p           int,
  macro_c           int,
  macro_f           int,
  converted_lead_id uuid REFERENCES public.bbf_leads(id),
  created_at        timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bbf_tdee_leads_email      ON public.bbf_tdee_leads (email);
CREATE INDEX IF NOT EXISTS idx_bbf_tdee_leads_created_at ON public.bbf_tdee_leads (created_at DESC);

ALTER TABLE public.bbf_tdee_leads ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.bbf_tdee_leads TO service_role;
