-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 2 · bbf-resend-welcome sweep — pg_cron scheduler (every 15 minutes).
-- ───────────────────────────────────────────────────────────────────────────
-- Unattended recovery: drives the bbf-resend-welcome Edge Function on a 15-min
-- cadence so a paid customer whose welcome email failed is re-issued credentials
-- automatically — no admin action required.
--
-- Auth model mirrors bbf-sentinel-daily (20260504070543): pg_net passes the
-- 'x-cron-secret' header from the 'app.bbf_cron_secret' GUC, which the function
-- matches against its CRON_SECRET env. If the GUC is unset the header is empty
-- and the function returns 401 (defensive no-op) — but the Sentinel cron already
-- runs on this same secret, so it is configured in prod.
--
-- Idempotent: drops any existing job of the same name, then re-creates.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bbf-resend-welcome-sweep') THEN
    PERFORM cron.unschedule('bbf-resend-welcome-sweep');
  END IF;
END $$;

SELECT cron.schedule(
  'bbf-resend-welcome-sweep',
  '*/15 * * * *',
  $job$
  SELECT net.http_post(
    url     := 'https://ihclbceghxpuawymlvgi.supabase.co/functions/v1/bbf-resend-welcome',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-cron-secret', current_setting('app.bbf_cron_secret', true)
               ),
    body    := '{}'::jsonb
  );
  $job$
);
