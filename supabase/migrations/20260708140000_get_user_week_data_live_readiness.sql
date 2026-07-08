-- supabase/migrations/20260708140000_get_user_week_data_live_readiness.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- FIX · get_user_week_data readiness source — retired table → live ledger.
--
-- get_user_week_data (the week-telemetry RPC behind bbf-weekly-brief-scenario-engine
-- AND bbf-eagle-eye's weekly-bucket re-derivation) counted `readiness_logs` from the
-- RETIRED public.bbf_readiness table (last write 2026-05-31 · now always empty), so
-- EVERY client resolved to readiness_logs = 0. That forced the scenario engine into
-- the COMPLIANCE branch for the whole roster (locked_in needs readiness_logs >= 4),
-- inflating COMPLIANCE buckets — and, downstream, Eagle Eye's COMPLIANCE_LAG nudges
-- and its own READINESS_SOURCE_DRIFT findings.
--
-- The live readiness ledger is public.bbf_daily_protocols (athlete_id, date,
-- readiness_score) — the same source the dashboard, bbf-midnight-haiku, and
-- bbf-sovereign-briefing already read. This repoints read7 there. Everything else in
-- the function (sets7/sets14 volume + RPE + max-weight, the return shape, the
-- SECURITY DEFINER + grants) is unchanged.

create or replace function public.get_user_week_data(p_user_id uuid)
returns table (
  user_id              uuid,
  sessions_logged      integer,
  unique_days          integer,
  avg_rpe              double precision,
  readiness_logs       integer,
  app_open_days        integer,
  max_weight_this_week double precision,
  max_weight_last_week double precision,
  plateau_lift         text,
  plateau_weight       double precision,
  plateau_weeks        integer,
  progression_lift     text,
  progression_weight   double precision,
  pr_amount            double precision,
  rep_delta            integer
)
language sql
security definer
set search_path = public
as $$
  with sets7 as (
    select s.*, substring(s.day_key, 1, 10)::date as d
    from public.bbf_sets s
    where s.user_id = p_user_id
      and s.day_key ~ '^\d{4}-\d{2}-\d{2}'
      and substring(s.day_key, 1, 10)::date >= (current_date - 7)
  ),
  sets14 as (
    select s.*, substring(s.day_key, 1, 10)::date as d
    from public.bbf_sets s
    where s.user_id = p_user_id
      and s.day_key ~ '^\d{4}-\d{2}-\d{2}'
      and substring(s.day_key, 1, 10)::date >= (current_date - 14)
      and substring(s.day_key, 1, 10)::date <  (current_date - 7)
  ),
  -- LIVE readiness ledger (was public.bbf_readiness · retired/empty). One row per
  -- athlete/day; distinct-date guards against any duplicate protocol row.
  read7 as (
    select distinct p.date as rd
    from public.bbf_daily_protocols p
    where p.athlete_id = p_user_id
      and p.readiness_score is not null
      and p.date >= (current_date - 7)
  )
  select
    p_user_id,
    (select count(distinct d) from sets7)::integer,
    (select count(distinct d) from sets7)::integer,
    coalesce((select avg(rpe)::double precision from sets7 where rpe is not null), 0),
    (select count(*) from read7)::integer,
    (select count(distinct dd) from (
        select d as dd from sets7
        union
        select rd from read7
     ) u)::integer,
    coalesce((select max(weight_lbs) from sets7), 0),
    coalesce((select max(weight_lbs) from sets14), 0),
    null::text, null::double precision, null::integer,
    null::text, null::double precision, null::double precision, null::integer;
$$;

revoke all on function public.get_user_week_data(uuid) from public, anon, authenticated;
grant execute on function public.get_user_week_data(uuid) to service_role;
