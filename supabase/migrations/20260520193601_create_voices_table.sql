-- ElevenLabs voice registry · data-driven voice assignment per feature.
-- Lookup key is `feature`. Swap voices later by updating voice_id rows;
-- no code change required.
CREATE TABLE IF NOT EXISTS public.voices (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature     text NOT NULL UNIQUE,
  voice_id    text NOT NULL,
  voice_name  text NOT NULL,
  category    text NOT NULL CHECK (category IN ('fitness','nutrition','sales','recovery','general')),
  is_active   boolean NOT NULL DEFAULT true,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS voices_feature_idx  ON public.voices (feature);
CREATE INDEX IF NOT EXISTS voices_category_idx ON public.voices (category);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.voices_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_voices_set_updated_at ON public.voices;
CREATE TRIGGER trg_voices_set_updated_at
  BEFORE UPDATE ON public.voices
  FOR EACH ROW EXECUTE FUNCTION public.voices_set_updated_at();

-- RLS — service role bypasses; anon/auth can SELECT active voices only.
ALTER TABLE public.voices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS voices_read_active ON public.voices;
CREATE POLICY voices_read_active ON public.voices
  FOR SELECT
  USING (is_active = true);

-- Seed: fitness side → Julius · nutrition side → Kelli LaShae.
-- Feature keys mirror the BBF_INTERCEPT registry so the frontend can
-- use the SAME key for both the first-click modal and the voice lookup.
INSERT INTO public.voices (feature, voice_id, voice_name, category, notes) VALUES
  ('phantom_eye',      'VlUmeC1Uzj3NnwiVR9K9', 'Julius',       'fitness',   'Live Vision Check · Program tab · real-time form audit'),
  ('virtual_coach',    'VlUmeC1Uzj3NnwiVR9K9', 'Julius',       'fitness',   'Live Coach Active · Program tab · audio coaching session'),
  ('nutrition_vision', 'Z5JpFCNFIz8Nhe4KEikq', 'Kelli LaShae', 'nutrition', 'Food Frame · Nutrition tab · food photo analysis'),
  ('virtual_chef',     'Z5JpFCNFIz8Nhe4KEikq', 'Kelli LaShae', 'nutrition', 'Chef on Call · Nutrition tab · audio nutrition coaching')
ON CONFLICT (feature) DO UPDATE SET
  voice_id   = EXCLUDED.voice_id,
  voice_name = EXCLUDED.voice_name,
  category   = EXCLUDED.category,
  notes      = EXCLUDED.notes,
  is_active  = true,
  updated_at = now();