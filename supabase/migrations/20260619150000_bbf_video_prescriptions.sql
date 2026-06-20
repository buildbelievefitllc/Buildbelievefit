-- BBF Video Prescriptions Logging (Optional Analytics)
-- Tracks CNS-triggered video prescription events for analytics & insights
-- Created: 2026-06-19

CREATE TABLE IF NOT EXISTS public.bbf_video_prescriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cns_state text NOT NULL,
    -- DECOMPRESS | BALANCED | ENERGIZED | GROUNDED
  video_id integer NOT NULL,
    -- Reference to the video library (1-30)
  source text NOT NULL,
    -- checkin | slider
  created_at timestamptz DEFAULT now()
);

-- Indexes for efficient queries
CREATE INDEX idx_video_prescriptions_user
  ON public.bbf_video_prescriptions(user_id, created_at DESC);

CREATE INDEX idx_video_prescriptions_state
  ON public.bbf_video_prescriptions(cns_state, created_at DESC);

CREATE INDEX idx_video_prescriptions_source
  ON public.bbf_video_prescriptions(source, created_at DESC);

-- Basic RLS: users can only read their own prescriptions
ALTER TABLE public.bbf_video_prescriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own video prescriptions"
  ON public.bbf_video_prescriptions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert video prescriptions"
  ON public.bbf_video_prescriptions
  FOR INSERT
  WITH CHECK (true);
