-- bbf-reel-distributor — daily drip cron (video twin of jobid 7 'bbf_card_distributor_drip').
-- ─────────────────────────────────────────────────────────────────────────────
-- Fires bbf-reel-distributor once a day with {"action":"distribute","live":true,"limit":1}.
-- limit:1 because each reel takes ~60-70s (Meta transcode), so we post one per run.
--
-- Mirrors the cards' cron EXACTLY on the auth pattern: the admin token is read from
-- Supabase Vault (BBF_COACH_AGENT_TOKEN) at run time and passed as X-BBF-Admin-Token —
-- the secret never lives in the job definition or any env config (CLAUDE.md §7).
--
-- Two deliberate, timing-driven departures from jobid 7:
--   • timeout_milliseconds 45000 -> 120000: a reel's IG transcode poll can run ~80s,
--     so 45s would log a false pg_net timeout even on a successful post. 120s stays
--     under the 150s edge request-idle limit.
--   • schedule 13:30 UTC (cards fire 13:00): +30 min offset so the two distributors
--     don't post to the same IG/FB account in the same minute.
--
-- cron.schedule() upserts by job name, so re-applying this migration is safe.

select cron.schedule(
  'bbf_reel_distributor_drip',
  '30 13 * * *',
  $job$
    select net.http_post(
      url := 'https://ihclbceghxpuawymlvgi.supabase.co/functions/v1/bbf-reel-distributor',
      body := '{"action":"distribute","live":true,"limit":1}'::jsonb,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-BBF-Admin-Token', (select decrypted_secret from vault.decrypted_secrets where name = 'BBF_COACH_AGENT_TOKEN')
      ),
      timeout_milliseconds := 120000
    );
  $job$
);
