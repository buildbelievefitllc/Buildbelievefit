-- supabase/migrations/20260620000000_bbf_rpe_audio.sql
-- bbf_rpe_audio — RPE education audio cache (ElevenLabs TTS + daily caching).
-- Caches daily audio explanations of RPE (Rate of Perceived Exertion) by language.
-- Service-role only; accessed by bbf-agentic-rpe-voice-explanation edge function.

CREATE TABLE IF NOT EXISTS public.bbf_rpe_audio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  language text NOT NULL,
  audio_url text NOT NULL,
  duration_seconds integer,
  voice_id text,
  voice_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookup by language + date
CREATE INDEX IF NOT EXISTS idx_bbf_rpe_audio_lang_date
  ON public.bbf_rpe_audio(language, DATE(created_at));

-- RLS: service role only
ALTER TABLE public.bbf_rpe_audio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bbf_rpe_audio_service_only ON public.bbf_rpe_audio;
CREATE POLICY bbf_rpe_audio_service_only
  ON public.bbf_rpe_audio FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.bbf_rpe_audio IS
  'Cached RPE education audio explanations (ElevenLabs TTS). One row per language per day.';
