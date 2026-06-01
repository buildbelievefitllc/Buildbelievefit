-- Phase 2 progression sync: per-user × sport × position × phase boolean.
-- Upsert pattern: PostgREST POST with Prefer: resolution=merge-duplicates
-- targets the unique constraint below.
CREATE TABLE IF NOT EXISTS public.bbf_athlete_progression (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             uuid NOT NULL REFERENCES public.bbf_users(id) ON DELETE CASCADE,
  sport               text NOT NULL,
  position            text NOT NULL,
  phase               text NOT NULL CHECK (phase IN ('off','in')),
  protocol_completed  boolean NOT NULL DEFAULT false,
  completed_at        timestamptz,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bbf_athlete_progression_user_phase_uk
    UNIQUE (user_id, sport, position, phase)
);

CREATE INDEX IF NOT EXISTS bbf_athlete_progression_user_idx
  ON public.bbf_athlete_progression(user_id);

ALTER TABLE public.bbf_athlete_progression ENABLE ROW LEVEL SECURITY;

-- RLS: matches the bbf_audit_logs pattern (anon read/write). The frontend
-- only ever sends events for the currently-authenticated client. UPDATE is
-- needed so PostgREST upsert (Prefer: resolution=merge-duplicates) can run.
DROP POLICY IF EXISTS "Allow Anon Inserts" ON public.bbf_athlete_progression;
CREATE POLICY "Allow Anon Inserts" ON public.bbf_athlete_progression
  FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Allow Anon Select" ON public.bbf_athlete_progression;
CREATE POLICY "Allow Anon Select" ON public.bbf_athlete_progression
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Allow Anon Update" ON public.bbf_athlete_progression;
CREATE POLICY "Allow Anon Update" ON public.bbf_athlete_progression
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- Auto-stamp updated_at on every write; stamp completed_at the first time
-- protocol_completed flips to true. Clearing the flag clears completed_at.
CREATE OR REPLACE FUNCTION public.bbf_athlete_progression_set_timestamps()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'INSERT' THEN
    IF NEW.protocol_completed = true AND NEW.completed_at IS NULL THEN
      NEW.completed_at := now();
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.protocol_completed = true AND OLD.protocol_completed IS DISTINCT FROM true THEN
      NEW.completed_at := now();
    ELSIF NEW.protocol_completed = false THEN
      NEW.completed_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bbf_athlete_progression_timestamps_trg ON public.bbf_athlete_progression;
CREATE TRIGGER bbf_athlete_progression_timestamps_trg
  BEFORE INSERT OR UPDATE ON public.bbf_athlete_progression
  FOR EACH ROW EXECUTE FUNCTION public.bbf_athlete_progression_set_timestamps();