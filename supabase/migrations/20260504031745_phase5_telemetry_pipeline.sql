-- Phase 5 — Telemetry Pipeline Schema
-- Path C: dedicated load-telemetry tables, isolated from bbf_logs/bbf_sets.
-- See migrations/2026-05-04_phase5_telemetry_pipeline.sql for full context.

-- ─── bbf_athlete_load_logs : macro session telemetry ────────────
CREATE TABLE IF NOT EXISTS public.bbf_athlete_load_logs (
  log_id            uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  athlete_id        uuid        NOT NULL REFERENCES public.bbf_users(id) ON DELETE CASCADE,
  session_timestamp timestamptz NOT NULL DEFAULT now(),
  session_type      text        NOT NULL,
  duration_minutes  integer     NOT NULL CHECK (duration_minutes >= 0),
  srpe_intensity    integer     NOT NULL CHECK (srpe_intensity BETWEEN 1 AND 10),
  load_au           integer     GENERATED ALWAYS AS (duration_minutes * srpe_intensity) STORED,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bbf_athlete_load_logs_athlete_session_idx
  ON public.bbf_athlete_load_logs (athlete_id, session_timestamp DESC);

CREATE OR REPLACE FUNCTION public.bbf_athlete_load_logs_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS bbf_athlete_load_logs_updated_at_trg ON public.bbf_athlete_load_logs;
CREATE TRIGGER bbf_athlete_load_logs_updated_at_trg
  BEFORE UPDATE ON public.bbf_athlete_load_logs
  FOR EACH ROW EXECUTE FUNCTION public.bbf_athlete_load_logs_set_updated_at();

ALTER TABLE public.bbf_athlete_load_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow Anon Inserts" ON public.bbf_athlete_load_logs;
CREATE POLICY "Allow Anon Inserts" ON public.bbf_athlete_load_logs
  FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Allow Anon Select" ON public.bbf_athlete_load_logs;
CREATE POLICY "Allow Anon Select" ON public.bbf_athlete_load_logs
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Allow Anon Update" ON public.bbf_athlete_load_logs;
CREATE POLICY "Allow Anon Update" ON public.bbf_athlete_load_logs
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- ─── bbf_athlete_load_bouts : intra-session bouts ───────────────
CREATE TABLE IF NOT EXISTS public.bbf_athlete_load_bouts (
  set_id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  log_id          uuid        NOT NULL REFERENCES public.bbf_athlete_load_logs(log_id) ON DELETE CASCADE,
  bout_type       text        NOT NULL,
  exercise_name   text        NOT NULL,
  start_timestamp timestamptz NOT NULL,
  end_timestamp   timestamptz NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bbf_athlete_load_bouts_time_order_chk
    CHECK (end_timestamp >= start_timestamp)
);

CREATE INDEX IF NOT EXISTS bbf_athlete_load_bouts_log_id_idx
  ON public.bbf_athlete_load_bouts (log_id);

CREATE INDEX IF NOT EXISTS bbf_athlete_load_bouts_start_idx
  ON public.bbf_athlete_load_bouts (start_timestamp);

ALTER TABLE public.bbf_athlete_load_bouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow Anon Inserts" ON public.bbf_athlete_load_bouts;
CREATE POLICY "Allow Anon Inserts" ON public.bbf_athlete_load_bouts
  FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Allow Anon Select" ON public.bbf_athlete_load_bouts;
CREATE POLICY "Allow Anon Select" ON public.bbf_athlete_load_bouts
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Allow Anon Update" ON public.bbf_athlete_load_bouts;
CREATE POLICY "Allow Anon Update" ON public.bbf_athlete_load_bouts
  FOR UPDATE TO anon USING (true) WITH CHECK (true);