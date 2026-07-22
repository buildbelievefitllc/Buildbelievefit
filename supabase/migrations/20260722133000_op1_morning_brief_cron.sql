-- ═══════════════════════════════════════════════════════════════════════════
-- OP-1 · MORNING COMMAND BRIEF — daily cron (09:00 UTC = 5:00 AM ET during DST)
-- ═══════════════════════════════════════════════════════════════════════════
-- One Sonnet call per day over pre-computed operational deltas → pinned
-- MORNING_BRIEF card in the Action Inbox with the top-3 approve/veto calls.
-- The admin token is injected from Vault inside Postgres — never leaves the DB.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bbf-morning-brief-daily') THEN
    PERFORM cron.unschedule('bbf-morning-brief-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'bbf-morning-brief-daily',
  '0 9 * * *',
  $job$
  SELECT net.http_post(
    url     := 'https://ihclbceghxpuawymlvgi.supabase.co/functions/v1/bbf-morning-brief',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-BBF-Admin-Token', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'BBF_COACH_AGENT_TOKEN' LIMIT 1)
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $job$
);
