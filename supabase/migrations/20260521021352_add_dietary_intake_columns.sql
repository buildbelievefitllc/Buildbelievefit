-- Phase 22 Sovereign Intake · persist dietary fields end-to-end
-- bbf_active_clients = the intake table (populated by /process from Pathfinder)
-- bbf_users          = the app credentials table (populated by /provision after Stripe)
-- Both need the dietary + macro fields so cross-device users can pick up
-- their actual preferences instead of falling back to Omnivore defaults.

ALTER TABLE public.bbf_active_clients
  ADD COLUMN IF NOT EXISTS dietary_profile text DEFAULT 'Omnivore',
  ADD COLUMN IF NOT EXISTS allergens       jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS food_likes      jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS food_dislikes   jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tdee_target     integer,
  ADD COLUMN IF NOT EXISTS macro_p         integer,
  ADD COLUMN IF NOT EXISTS macro_c         integer,
  ADD COLUMN IF NOT EXISTS macro_f         integer;

ALTER TABLE public.bbf_users
  ADD COLUMN IF NOT EXISTS dietary_profile text DEFAULT 'Omnivore',
  ADD COLUMN IF NOT EXISTS allergens       jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS food_likes      jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS food_dislikes   jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tdee_target     integer,
  ADD COLUMN IF NOT EXISTS macro_p         integer,
  ADD COLUMN IF NOT EXISTS macro_c         integer,
  ADD COLUMN IF NOT EXISTS macro_f         integer;

-- Light index on dietary_profile so future analytics (cohort splits, plan
-- variance by profile) don't full-table-scan.
CREATE INDEX IF NOT EXISTS bbf_users_dietary_profile_idx ON public.bbf_users (dietary_profile);
CREATE INDEX IF NOT EXISTS bbf_active_clients_dietary_profile_idx ON public.bbf_active_clients (dietary_profile);