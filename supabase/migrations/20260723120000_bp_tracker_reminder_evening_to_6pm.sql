-- Move the evening BP reminder from 8:00 PM to 6:00 PM America/Phoenix.
-- Applied to production via apply_migration on 2026-07-23. Git record.
-- Arizona is UTC-7 year-round (no DST) → 6:00 PM AZ = 01:00 UTC.
-- (Morning reminder unchanged: 8:00 AM AZ = 15:00 UTC.)
-- cron.schedule(jobname,...) upserts by name; command body unchanged.
select cron.schedule(
  'bp-reminder-evening',
  '0 1 * * *',
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
