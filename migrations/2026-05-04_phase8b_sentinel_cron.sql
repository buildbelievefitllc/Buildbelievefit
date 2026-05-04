-- ═══════════════════════════════════════════════════════════════
-- Phase 8b — Sentinel Protocol cron scheduler
-- Date:    2026-05-04
-- Project: ihclbceghxpuawymlvgi (bbf-lab)
-- Author:  Claude (per CEO Phase 8b sign-off)
--
-- Schedules the bbf-sentinel Edge Function to run daily at 08:00 UTC
-- (≈ 01:00 MST — early-morning briefing slot for the CEO).
--
-- Auth model (matches the Edge Function's expectation):
--   pg_net passes the x-cron-secret header from the
--   'app.bbf_cron_secret' Postgres GUC. If the GUC is unset, the
--   header is empty, and the function rejects with 401 — defensive
--   silent failure until the CEO completes the setup steps in
--   docs/SENTINEL_SETUP.md.
--
-- Was applied via MCP at session time. This file exists for the
-- audit trail and re-application in fresh environments.
-- ═══════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bbf-sentinel-daily') THEN
    PERFORM cron.unschedule('bbf-sentinel-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'bbf-sentinel-daily',
  '0 8 * * *',
  $job$
  SELECT net.http_post(
    url     := 'https://ihclbceghxpuawymlvgi.supabase.co/functions/v1/bbf-sentinel',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-cron-secret', current_setting('app.bbf_cron_secret', true)
               ),
    body    := '{}'::jsonb
  );
  $job$
);

-- Verify (paste into SQL Editor after the COMMIT):
-- SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'bbf-sentinel-daily';
