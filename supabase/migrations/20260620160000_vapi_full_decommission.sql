-- Decommission the legacy Vapi outbound-call subsystem (CEO order, 2026-06-20).
-- Vapi was retired from the product. This removes the DB plumbing that fed it:
-- the two daily pg_cron jobs, the evaluation functions they ran, the (empty)
-- call-tracking table, and the Vapi vault secrets. Supersedes the 2026-04-30
-- "Vapi Phase 1-5" migrations (their files are kept as the applied ledger).
-- NOTE: bbf_active_clients.client_phone is intentionally LEFT in place — it is
-- general client contact data, not Vapi-specific, and out of decommission scope.

-- 1. Stop + remove the scheduled jobs (guarded; no error if already gone).
do $$
begin
  if exists (select 1 from cron.job where jobname = 'vapi-daily-accountability-check') then
    perform cron.unschedule('vapi-daily-accountability-check');
  end if;
  if exists (select 1 from cron.job where jobname = 'vapi-daily-abandoned-cart-check') then
    perform cron.unschedule('vapi-daily-abandoned-cart-check');
  end if;
end $$;

-- 2. Drop the evaluation functions that fired the outbound webhook.
drop function if exists public.bbf_evaluate_streaks();
drop function if exists public.bbf_evaluate_abandoned_carts();

-- 3. Drop the (empty) call-tracking table + its RLS policy / constraints.
drop table if exists public.bbf_vapi_calls cascade;

-- 4. Remove the Vapi vault secrets.
delete from vault.secrets where name in ('bbf_vapi_invoke_token', 'VAPI_PHONE_NUMBER_ID');
