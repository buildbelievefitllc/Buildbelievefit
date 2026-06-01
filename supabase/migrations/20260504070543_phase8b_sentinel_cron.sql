-- Phase 8b — Sentinel Protocol cron scheduler.
-- Daily 08:00 UTC invocation of the bbf-sentinel Edge Function.
--
-- Auth model: pg_net passes the x-cron-secret header from the
-- 'app.bbf_cron_secret' GUC. If the GUC is unset, the header
-- is empty and the function rejects with 401 — defensive
-- silent failure until the CEO completes the setup steps in
-- docs/SENTINEL_SETUP.md.
--
-- Idempotent: drops the existing job if present, then re-creates.

DO $$
BEGIN
  -- Remove a prior schedule with the same name so this script is rerunnable
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