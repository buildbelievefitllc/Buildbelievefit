-- ═══════════════════════════════════════════════════════════════════════
-- Phase 1.4 · Budget kill-switch · daily spend ceiling + emergency_stop.
-- ───────────────────────────────────────────────────────────────────────
-- Single-row config table backs an instant cross-system kill switch. The
-- daily monitor function aggregates 24h spend from bbf_llm_calls and
-- flips emergency_stop = true if the soft ceiling is breached. Every
-- agentic orchestrator (Supabase edge + Render-side marketing) consults
-- this flag at the top of its handler and 429s when set.
--
-- DEFAULT CEILING · $10.00/day. Operator can raise via
--   update public.bbf_system_config set daily_spend_ceiling_usd = X where id=1;
--
-- CLEARING THE STOP · once spend has fallen below ceiling (or operator
-- has investigated), clear via:
--   update public.bbf_system_config
--     set emergency_stop = false,
--         emergency_stop_reason = null,
--         emergency_stop_at = null,
--         updated_at = now()
--   where id = 1;
--
-- The monitor function will NOT auto-clear · operator must explicitly
-- acknowledge the trip · prevents a flapping cycle where spend dips
-- below ceiling for one cron tick and silently rearms agents.
--
-- SCHEDULE · pg_cron · daily at 00:05 UTC. The orchestrators also call
-- bbf_check_daily_spend() at the top of their handlers as a defense-
-- in-depth check · catches runaway spend mid-day before the next cron.
-- ═══════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ─── bbf_system_config · single-row config ──────────────────────────────
create table if not exists public.bbf_system_config (
  id                        smallint primary key default 1 check (id = 1),
  emergency_stop            boolean      not null default false,
  daily_spend_ceiling_usd   numeric(10, 2) not null default 10.00,
  emergency_stop_reason     text,
  emergency_stop_at         timestamptz,
  ceiling_tripped_at        timestamptz,
  updated_at                timestamptz  not null default now()
);

-- Seed the single config row. ON CONFLICT DO NOTHING so re-applying
-- the migration on a populated db doesn't overwrite operator changes.
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

-- ─── bbf_check_daily_spend() · soft-ceiling monitor ─────────────────────
-- Aggregates last-24h spend from bbf_llm_calls, compares to ceiling,
-- flips emergency_stop = true if exceeded AND not already stopped.
-- Idempotent · safe to call from cron AND on-demand from orchestrators.
-- Returns the full diagnostic shape for callers to log/return.
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
  -- Aggregate spend over the last 24h. cost_usd nulls become 0.
  select coalesce(sum(cost_usd), 0)::numeric(12,4), count(*)
    into v_spend_usd, v_call_count
  from public.bbf_llm_calls
  where ts >= now() - interval '24 hours';

  -- Snapshot pre-state.
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

-- ─── pg_cron daily schedule ─────────────────────────────────────────────
-- Daily at 00:05 UTC. The orchestrators ALSO call this on every
-- invocation for mid-day fast feedback (cheap: one indexed sum query
-- over the last 24h on a tiny table).
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
