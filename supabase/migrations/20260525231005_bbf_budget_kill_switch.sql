create extension if not exists pgcrypto;

create table if not exists public.bbf_system_config (
  id                        smallint primary key default 1 check (id = 1),
  emergency_stop            boolean      not null default false,
  daily_spend_ceiling_usd   numeric(10, 2) not null default 10.00,
  emergency_stop_reason     text,
  emergency_stop_at         timestamptz,
  ceiling_tripped_at        timestamptz,
  updated_at                timestamptz  not null default now()
);

insert into public.bbf_system_config (id) values (1)
on conflict (id) do nothing;

alter table public.bbf_system_config enable row level security;

drop policy if exists "bbf_system_config_service_only" on public.bbf_system_config;
create policy "bbf_system_config_service_only"
  on public.bbf_system_config for all
  to service_role
  using (true)
  with check (true);

comment on table public.bbf_system_config is
  'Single-row global config · id MUST be 1 · emergency_stop flag drives the cross-system budget kill-switch · service-role writes only';

create or replace function public.bbf_check_daily_spend()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_spend_usd   numeric(12, 4);
  v_call_count  bigint;
  v_ceiling     numeric(10, 2);
  v_was_stopped boolean;
  v_now_stopped boolean;
  v_tripped_now boolean;
begin
  select coalesce(sum(cost_usd), 0)::numeric(12,4), count(*)
    into v_spend_usd, v_call_count
  from public.bbf_llm_calls
  where ts >= now() - interval '24 hours';

  select daily_spend_ceiling_usd, emergency_stop
    into v_ceiling, v_was_stopped
  from public.bbf_system_config where id = 1;

  v_tripped_now := (v_spend_usd > v_ceiling) and (not v_was_stopped);

  if v_tripped_now then
    update public.bbf_system_config
       set emergency_stop        = true,
           emergency_stop_reason = format('daily_spend_exceeded: $%s > $%s (24h, %s calls)',
                                          v_spend_usd::text, v_ceiling::text, v_call_count::text),
           emergency_stop_at     = now(),
           ceiling_tripped_at    = now(),
           updated_at            = now()
     where id = 1;
  end if;

  select emergency_stop into v_now_stopped
  from public.bbf_system_config where id = 1;

  return jsonb_build_object(
    'spend_24h_usd',    v_spend_usd,
    'call_count_24h',   v_call_count,
    'ceiling_usd',      v_ceiling,
    'tripped_now',      v_tripped_now,
    'was_stopped',      v_was_stopped,
    'currently_stopped', v_now_stopped,
    'checked_at',       now()
  );
end
$$;

comment on function public.bbf_check_daily_spend() is
  'Phase 1.4 · 24h spend monitor · flips bbf_system_config.emergency_stop=true when bbf_llm_calls.cost_usd sum exceeds the ceiling · pg_cron daily + on-demand from orchestrators';

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
      from cron.job where jobname = 'bbf_daily_spend_check';
    perform cron.schedule(
      'bbf_daily_spend_check',
      '5 0 * * *',
      $cron$ select public.bbf_check_daily_spend(); $cron$
    );
  end if;
end $$;