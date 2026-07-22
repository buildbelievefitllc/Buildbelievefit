-- ═══════════════════════════════════════════════════════════════════════════
-- FUEL COMPANION · MEAL SNAPS — numeric nutrition telemetry from meal photos
-- ═══════════════════════════════════════════════════════════════════════════
-- Same privacy posture as the Kinematic Form Ledger: the meal PHOTO is
-- ephemeral (vision-call request memory only — no storage upload, no media
-- column). What persists is the numeric/text extraction: estimated macros
-- (post deterministic validation), confidence, the coaching note, and the
-- context it was scored against (eating-window state + readiness score).

CREATE TABLE IF NOT EXISTS public.bbf_meal_snaps (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid REFERENCES public.bbf_users(id) ON DELETE CASCADE,
  uid_slug         text NOT NULL,
  meal_name        text NOT NULL,
  kcal             integer NOT NULL CHECK (kcal BETWEEN 0 AND 4000),
  protein_g        integer NOT NULL CHECK (protein_g BETWEEN 0 AND 300),
  carbs_g          integer NOT NULL CHECK (carbs_g BETWEEN 0 AND 500),
  fat_g            integer NOT NULL CHECK (fat_g BETWEEN 0 AND 250),
  confidence       numeric CHECK (confidence BETWEEN 0 AND 1),
  coaching_note    text NOT NULL DEFAULT '',
  in_eating_window boolean,
  readiness_score  integer,
  locale           text,
  model            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.bbf_meal_snaps IS
  'Fuel Companion · meal-photo macro estimates (numeric/text ONLY — the photo never persists; no media columns by design). Deterministically validated before insert. RLS zero-policy: service_role writes via bbf-fuel-companion.';

CREATE INDEX IF NOT EXISTS bbf_meal_snaps_user_idx ON public.bbf_meal_snaps (user_id, created_at DESC);

ALTER TABLE public.bbf_meal_snaps ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.bbf_meal_snaps FROM public, anon, authenticated;
