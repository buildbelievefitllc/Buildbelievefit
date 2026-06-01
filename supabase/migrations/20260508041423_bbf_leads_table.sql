-- Phase 19: Zapier + Formspree kill. Single source of truth for incoming
-- leads from Pathfinder + Nutrition Lite forms. Replaces the silent
-- Zapier webhook log and the Formspree backup-email trail.
--
-- source values: 'pathfinder' | 'nutrition_lite' | future form sources
-- payload jsonb: full original form submission for audit / re-processing
-- email is the join key against bbf_active_clients.vault_email when a
-- Pathfinder lead converts and pays via Stripe.

CREATE TABLE IF NOT EXISTS public.bbf_leads (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source      text NOT NULL,
  email       text NOT NULL,
  full_name   text,
  phone       text,
  tier        text,
  payload     jsonb,
  created_at  timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bbf_leads_email      ON public.bbf_leads (email);
CREATE INDEX IF NOT EXISTS idx_bbf_leads_source     ON public.bbf_leads (source);
CREATE INDEX IF NOT EXISTS idx_bbf_leads_created_at ON public.bbf_leads (created_at DESC);

GRANT SELECT, INSERT ON public.bbf_leads TO service_role;