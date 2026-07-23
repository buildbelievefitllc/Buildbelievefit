-- Move the morning BP reminder from 8:00 AM to 3:00 AM America/Phoenix.
-- Applied to production via apply_migration on 2026-07-23. Git record.
-- Arizona is UTC-7 year-round (no DST) → 3:00 AM AZ = 10:00 UTC.
-- (Evening reminder unchanged: 6:00 PM AZ = 01:00 UTC.)
-- cron.schedule(jobname,...) upserts by name; command body unchanged.
select cron.schedule(
  'bp-reminder-morning',
  '0 10 * * *',
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
