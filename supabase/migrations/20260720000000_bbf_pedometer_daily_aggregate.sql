-- 20260720000000_bbf_pedometer_daily_aggregate.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Pedometer daily aggregation — the backend landing pad for the pedometer-sync
-- scheduler (pedometer-sync.yml → bbf-pedometer-sync edge fn → this RPC).
--
-- ADDITIVE ONLY: creates one new rollup table + one SECURITY DEFINER RPC. Touches
-- no existing table (no ALTER/DROP), so it cannot regress live data or hardening.
--
-- Source of truth: public.bbf_daily_biometrics(athlete_id, date, daily_steps).
-- Destination:     public.bbf_pedometer_daily — one rolling row per athlete.
--
-- Security (CLAUDE.md §7 + DATABASE_SAFETY.md §Phase 1.6 IDOR lesson): the RPC is
-- SECURITY DEFINER with a pinned search_path, takes NO caller-supplied athlete id
-- (it sweeps every athlete server-side), and EXECUTE is granted to service_role
-- ONLY — never anon/authenticated. The rollup table has RLS enabled with no public
-- policy (service-role-only by design; the expected rls_enabled_no_policy INFO
-- advisor is intentional, mirroring research_vault).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Rollup ledger: one row per athlete, refreshed each run ──
create table if not exists public.bbf_pedometer_daily (
  athlete_id       uuid        primary key,
  as_of            date        not null,
  steps_latest     integer,
  steps_7d_total   bigint,
  steps_7d_avg     numeric(10,2),
  steps_30d_avg    numeric(10,2),
  active_days_30d  integer     not null default 0,
  last_source      text,
  updated_at       timestamptz not null default now()
);

comment on table public.bbf_pedometer_daily is
  'Per-athlete rolling pedometer step aggregates, refreshed by bbf_aggregate_pedometer_daily(). Service-role-only.';

-- Lock the table down: RLS on, no policy, no anon/authenticated grants.
alter table public.bbf_pedometer_daily enable row level security;
revoke all on table public.bbf_pedometer_daily from anon, authenticated;
grant all on table public.bbf_pedometer_daily to service_role;

-- ── Aggregation RPC ──
create or replace function public.bbf_aggregate_pedometer_daily(p_source text default 'cron')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with agg as (
    select
      b.athlete_id,
      max(b.date)                                                          as as_of,
      (array_agg(b.daily_steps order by b.date desc))[1]                   as steps_latest,
      sum(b.daily_steps)  filter (where b.date >= current_date - 6)        as steps_7d_total,
      round(avg(b.daily_steps) filter (where b.date >= current_date - 6), 2)  as steps_7d_avg,
      round(avg(b.daily_steps) filter (where b.date >= current_date - 29), 2) as steps_30d_avg,
      count(*)            filter (where b.date >= current_date - 29)       as active_days_30d
    from public.bbf_daily_biometrics b
    where b.date >= current_date - 29
      and b.daily_steps is not null
    group by b.athlete_id
  )
  insert into public.bbf_pedometer_daily as p
    (athlete_id, as_of, steps_latest, steps_7d_total, steps_7d_avg, steps_30d_avg, active_days_30d, last_source, updated_at)
  select athlete_id, as_of, steps_latest,
         coalesce(steps_7d_total, 0), steps_7d_avg, steps_30d_avg,
         coalesce(active_days_30d, 0), p_source, now()
  from agg
  where as_of is not null
  on conflict (athlete_id) do update set
    as_of           = excluded.as_of,
    steps_latest    = excluded.steps_latest,
    steps_7d_total  = excluded.steps_7d_total,
    steps_7d_avg    = excluded.steps_7d_avg,
    steps_30d_avg   = excluded.steps_30d_avg,
    active_days_30d = excluded.active_days_30d,
    last_source     = excluded.last_source,
    updated_at      = now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.bbf_aggregate_pedometer_daily(text) is
  'Sweeps trailing 30-day pedometer data from bbf_daily_biometrics into bbf_pedometer_daily. Server-side, no caller id. service_role only.';

-- Grants: service_role only (never anon/authenticated).
revoke all on function public.bbf_aggregate_pedometer_daily(text) from public;
revoke all on function public.bbf_aggregate_pedometer_daily(text) from anon, authenticated;
grant execute on function public.bbf_aggregate_pedometer_daily(text) to service_role;
