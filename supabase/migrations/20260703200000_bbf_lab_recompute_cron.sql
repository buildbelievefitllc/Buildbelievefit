-- ═══════════════════════════════════════════════════════════════════════════
-- BBF LAB · WAVE C — RECOMPUTE FLEET CRON REGISTRATION (audit D-3)
-- ───────────────────────────────────────────────────────────────────────────
-- The Phase-2 recompute fleet (workload/fueling/language sentinels · smart-cardio
-- router · sovereign stitch router · onboarding sweeper) had NO schedule registered
-- — deployed functions that would never run. This registers the pg_cron jobs.
--
-- AUTH: the established house pattern (bbf-resend-welcome-sweep / bbf-sentinel-daily):
-- pg_net sends 'x-cron-secret' from the 'app.bbf_cron_secret' GUC, which each
-- function matches against its CRON_SECRET env. Both sides are already configured
-- in prod (the existing sentinel + resend crons run on them). If the GUC were unset
-- the header is empty and every function 401s — a defensive no-op, never a breach.
--
-- FAN-OUT: workload/fueling/cardio/stitch are per-athlete engines (missing_athlete
-- on an empty body), so their jobs SELECT over athlete_profiles and fire one
-- net.http_post per athlete. language-sentinel + onboarding-sweeper accept {}.
--
-- NIGHTLY ORDER (UTC) follows the data-dependency chain (compressed cadence,
-- reconciled to the live production schedule):
--   01:00 workload  (floor ledger → rollups/ACWR/prehab)
--   01:30 fueling   (reads athlete_workload_daily → nightly Sovereign pass)
--   02:00 language  (independent SRS/trend/gates sweep)
--   02:15 cardio    (reads recovery/workload state → tomorrow's prescription)
--   02:45 stitch    (reads cardio + brief context → daily playlists)
--   */10  sweeper   (heals stuck onboarding pipelines)
-- Idempotent: unschedule-if-exists, then schedule.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE j text;
BEGIN
  FOREACH j IN ARRAY ARRAY[
    'bbf-workload-sentinel-nightly','bbf-fueling-sentinel-nightly',
    'bbf-smart-cardio-router-nightly','bbf-language-sentinel-nightly',
    'bbf-sovereign-stitch-router-morning','bbf-onboarding-sweeper-10min'
  ] LOOP
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = j) THEN
      PERFORM cron.unschedule(j);
    END IF;
  END LOOP;
END $$;

-- 01:00 UTC · workload rollups (per-athlete fan-out)
SELECT cron.schedule(
  'bbf-workload-sentinel-nightly',
  '0 1 * * *',
  $job$
  SELECT net.http_post(
    url     := 'https://ihclbceghxpuawymlvgi.supabase.co/functions/v1/bbf-workload-sentinel',
    headers := jsonb_build_object('Content-Type','application/json',
                 'x-cron-secret', current_setting('app.bbf_cron_secret', true)),
    body    := jsonb_build_object('athlete_id', p.id::text)
  ) FROM public.athlete_profiles p;
  $job$
);

-- 01:30 UTC · fueling nightly Sovereign pass (per-athlete; ledger-gated in-function)
SELECT cron.schedule(
  'bbf-fueling-sentinel-nightly',
  '30 1 * * *',
  $job$
  SELECT net.http_post(
    url     := 'https://ihclbceghxpuawymlvgi.supabase.co/functions/v1/bbf-fueling-sentinel',
    headers := jsonb_build_object('Content-Type','application/json',
                 'x-cron-secret', current_setting('app.bbf_cron_secret', true)),
    body    := jsonb_build_object('athlete_id', p.id::text, 'pass', 'nightly')
  ) FROM public.athlete_profiles p;
  $job$
);

-- 02:15 UTC · smart cardio router (per-athlete; after fueling)
SELECT cron.schedule(
  'bbf-smart-cardio-router-nightly',
  '15 2 * * *',
  $job$
  SELECT net.http_post(
    url     := 'https://ihclbceghxpuawymlvgi.supabase.co/functions/v1/bbf-smart-cardio-router',
    headers := jsonb_build_object('Content-Type','application/json',
                 'x-cron-secret', current_setting('app.bbf_cron_secret', true)),
    body    := jsonb_build_object('athlete_id', p.id::text)
  ) FROM public.athlete_profiles p;
  $job$
);

-- 02:00 UTC · language sentinel (whole-fleet sweep; ledger-gated per profile)
SELECT cron.schedule(
  'bbf-language-sentinel-nightly',
  '0 2 * * *',
  $job$
  SELECT net.http_post(
    url     := 'https://ihclbceghxpuawymlvgi.supabase.co/functions/v1/bbf-language-sentinel',
    headers := jsonb_build_object('Content-Type','application/json',
                 'x-cron-secret', current_setting('app.bbf_cron_secret', true)),
    body    := '{}'::jsonb
  );
  $job$
);

-- 02:45 UTC · sovereign stitch router (per-athlete daily playlist; after cardio)
SELECT cron.schedule(
  'bbf-sovereign-stitch-router-morning',
  '45 2 * * *',
  $job$
  SELECT net.http_post(
    url     := 'https://ihclbceghxpuawymlvgi.supabase.co/functions/v1/bbf-sovereign-stitch-router',
    headers := jsonb_build_object('Content-Type','application/json',
                 'x-cron-secret', current_setting('app.bbf_cron_secret', true)),
    body    := jsonb_build_object('athlete_id', p.id::text)
  ) FROM public.athlete_profiles p;
  $job$
);

-- every 10 min · onboarding auto-heal sweeper
SELECT cron.schedule(
  'bbf-onboarding-sweeper-10min',
  '*/10 * * * *',
  $job$
  SELECT net.http_post(
    url     := 'https://ihclbceghxpuawymlvgi.supabase.co/functions/v1/bbf-onboarding-sweeper',
    headers := jsonb_build_object('Content-Type','application/json',
                 'x-cron-secret', current_setting('app.bbf_cron_secret', true)),
    body    := '{}'::jsonb
  );
  $job$
);
