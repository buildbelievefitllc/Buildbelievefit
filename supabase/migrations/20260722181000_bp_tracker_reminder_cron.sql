-- BP Tracker reminder cron.
-- Applied to production via apply_migration on 2026-07-22 (ledger stamps its own
-- version; filename version will differ — see DATABASE_SAFETY.md). Git record.
--
-- Fires send-bp-reminder twice daily at 8:00 AM and 8:00 PM America/Phoenix.
-- Arizona does not observe DST, so 15:00 UTC / 03:00 UTC hold year-round.
--
-- SECRET HANDLING: the shared secret is read from Supabase Vault by NAME
-- (bp_cron_secret) at run time — never hardcoded here. Until the operator
-- (1) sets the edge-function env BP_CRON_SECRET and (2) stores the SAME value
-- in Vault, the function simply returns 401/500 (harmless no-op, twice daily).
--
--   Activation (one time, values chosen by the operator — NOT in git):
--     supabase secrets set BP_CRON_SECRET='<strong-random>'   # edge function
--     select vault.create_secret('<same-strong-random>', 'bp_cron_secret');

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- cron.schedule(jobname,...) upserts by name — safe to re-run.
select cron.schedule(
  'bp-reminder-morning',
  '0 15 * * *',
  $job$
  select net.http_post(
    url     := 'https://ihclbceghxpuawymlvgi.supabase.co/functions/v1/send-bp-reminder',
    headers := jsonb_build_object(
      'Content-Type',    'application/json',
      'x-bp-cron-secret', coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'bp_cron_secret' limit 1), '')
    ),
    body    := '{}'::jsonb
  );
  $job$
);

select cron.schedule(
  'bp-reminder-evening',
  '0 3 * * *',
  $job$
  select net.http_post(
    url     := 'https://ihclbceghxpuawymlvgi.supabase.co/functions/v1/send-bp-reminder',
    headers := jsonb_build_object(
      'Content-Type',    'application/json',
      'x-bp-cron-secret', coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'bp_cron_secret' limit 1), '')
    ),
    body    := '{}'::jsonb
  );
  $job$
);

-- To remove:  select cron.unschedule('bp-reminder-morning');
--             select cron.unschedule('bp-reminder-evening');
