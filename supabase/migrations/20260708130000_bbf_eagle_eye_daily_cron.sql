-- supabase/migrations/20260708130000_bbf_eagle_eye_daily_cron.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- BBF EAGLE EYE · DAILY AUTONOMOUS CYCLE — pg_cron registration.
--
-- Fires the secondary brain's closed-loop cycle once a day LIVE (dry_run=false):
--   scan every client → reconcile the interventions ledger (auto-resolve cleared
--   drifts · escalate stale nudges into the empathetic script) → dispatch new
--   plays (in-app nudges + founder-gated load proposals). Everything a plan-change
--   touches still routes through bbf_pending_review — the cron only lets Eagle Eye
--   DETECT + NUDGE + STAGE on its own; the founder still approves every plan move.
--
-- AUTH: the PROVEN prod pattern (bbf-card-distributor / recompute fleet) — pg_net
-- sends 'X-BBF-Admin-Token' read straight from Supabase Vault
-- (vault.decrypted_secrets → 'BBF_COACH_AGENT_TOKEN'), which the function's
-- existing admin gate accepts. No new secret to provision, no GUCs (unset in prod).
--
-- SCHEDULE: 05:45 UTC daily — after bbf-midnight-haiku (05:00) has refreshed the
-- daily briefs/protocols, so the cycle reconciles against the freshest signals.
-- Idempotent: unschedule-if-exists, then schedule.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bbf-eagle-eye-daily') THEN
    PERFORM cron.unschedule('bbf-eagle-eye-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'bbf-eagle-eye-daily',
  '45 5 * * *',
  $job$
  SELECT net.http_post(
    url     := 'https://ihclbceghxpuawymlvgi.supabase.co/functions/v1/bbf-eagle-eye',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'X-BBF-Admin-Token', (select decrypted_secret from vault.decrypted_secrets where name = 'BBF_COACH_AGENT_TOKEN')
               ),
    body    := jsonb_build_object('mode', 'run', 'dry_run', false)
  );
  $job$
);
