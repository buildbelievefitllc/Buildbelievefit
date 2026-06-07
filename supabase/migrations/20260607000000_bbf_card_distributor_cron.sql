-- bbf-card-distributor — Terminal Charlie · 12-hour autonomous drip scheduler.
-- ─────────────────────────────────────────────────────────────────────────────
-- Applied to project ihclbceghxpuawymlvgi via apply_migration (mirrored here for
-- repo source-of-truth, matching the bbf_posting_history convention).
--
-- pg_cron fires the EXISTING bbf-card-distributor twice daily via pg_net; the
-- distributor owns the atomic queue claim + flip rule, so this adds NO second
-- consumer of bbf_calling_cards_batch_v1 — it just automates the trigger.
--   • Cadence:  '0 */12 * * *'  → 00:00 and 12:00 UTC daily (every 12h)
--   • Volume:   limit:1 per fire = ~2 cards/day → drains the 100-card queue in ~50 days
--   • Channels: instagram + facebook only (TikTok benched)
--   • Auth:     X-BBF-Admin-Token read INLINE from vault.decrypted_secrets (never in git)
--   • Timeout:  45s for Meta upload/status-poll latency
--
-- Posting is a no-op (412 no_channel_configured) until the distributor's
-- META_TOKEN / META_IG_USER_ID (+ META_FB_PAGE_ID) are present in Vault — the cron
-- trigger fires regardless; channels light up when their secrets exist.

-- Idempotent: drop any prior instance of this job before (re)scheduling.
do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'bbf_card_distributor_drip';
end $$;

select cron.schedule(
  'bbf_card_distributor_drip',
  '0 */12 * * *',
  $cron$
    select net.http_post(
      url := 'https://ihclbceghxpuawymlvgi.supabase.co/functions/v1/bbf-card-distributor',
      body := '{"action":"distribute","live":true,"limit":1,"channels":["instagram","facebook"]}'::jsonb,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-BBF-Admin-Token', (select decrypted_secret from vault.decrypted_secrets where name = 'BBF_COACH_AGENT_TOKEN')
      ),
      timeout_milliseconds := 45000
    );
  $cron$
);
