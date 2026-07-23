-- 20260723063000_night_orchestrator_cron.sql
-- NIGHT SHIFT · Part 2.2: the 2:00 AM UTC batch orchestrator schedule.
-- Runs bbf-night-orchestrator daily: growth-plate load safeguards, the
-- missed-check-in compliance sweep, and the top-milestone → Kinetic Hyperframe
-- reel pre-bake — all deterministic, all landing as PENDING founder-approval
-- cards. Same Vault-injected shared-secret pattern as every other BBF cron:
-- the admin token never leaves Postgres.

select cron.unschedule(jobid) from cron.job where jobname = 'bbf-night-orchestrator-daily';

select cron.schedule(
  'bbf-night-orchestrator-daily',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://ihclbceghxpuawymlvgi.supabase.co/functions/v1/bbf-night-orchestrator',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-BBF-Admin-Token', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'BBF_COACH_AGENT_TOKEN' LIMIT 1)
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
