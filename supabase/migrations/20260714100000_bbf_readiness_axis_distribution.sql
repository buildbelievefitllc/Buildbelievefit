-- ═══════════════════════════════════════════════════════════════════════════
-- BBF — Readiness axis distribution (biometric-matrix gap-sizing telemetry)
-- ───────────────────────────────────────────────────────────────────────────
-- The Sovereign biometric audio matrix (bbf-biometric-audio-matrix.json) is a
-- hand-curated 28-state grid the client snaps live telemetry to (nearest CNS,
-- then nearest Sleep/Stress/Load — see biometricMatch.js). Deciding which NEW
-- states are worth baking should be driven by which real CNS/Sleep/Stress
-- values athletes actually land on, not guesswork.
--
-- NO NEW LOGGING NEEDED: every input the router uses is ALREADY captured,
-- once per athlete per day, by the existing check-in pipeline:
--   • CNS       = bbf_daily_protocols.readiness_score          (first-class column)
--   • Sleep-axis = derived from bbf_daily_biometrics.sleep_minutes,
--                  EXACT SAME formula as telemetryFromReadiness() in
--                  biometricRouter.js: round((sleep_minutes/60/8)*100), else 70
--   • Stress-axis = derived from bbf_daily_biometrics.stress_level (1-10),
--                   EXACT SAME formula as telemetryFromReadiness(): round(x*10), else 50
-- (Load is excluded: it comes from the day's PROGRAM PLAN at render time, not
-- from the biometric ledger, so it isn't retroactively recoverable here.)
--
-- This is read-only analytics over data that already exists — no new table, no
-- new client round-trip, no change to the check-in pipeline. Gated identically
-- to every other admin-analytics RPC in this codebase (_bbf_is_admin_session),
-- because bbf_daily_protocols / bbf_daily_biometrics are RLS ENABLED + FORCED
-- with zero policies (deny-all direct access) — a bare VIEW would either see
-- nothing or (worse, if owned by a bypass-RLS role) leak every athlete's row to
-- any grantee, since non-invoker views evaluate RLS as the OWNER, not the
-- caller. A SECURITY DEFINER function with an explicit gate avoids that trap
-- entirely and matches house convention (mirrors bbf_admin_reset_user_pin).
--
-- Returns BOTH a bucketed histogram (each axis rounded to nearest 10 — the
-- exact resolution the matrix-expansion decision operates at) and the raw
-- per-day rows, so either "what are the common buckets" or "show me the actual
-- data points" can be answered from one call.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.bbf_admin_readiness_axis_distribution(
  p_session_token text,
  p_days          integer default 90
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_days   int := greatest(1, least(coalesce(p_days, 90), 365));
  v_result jsonb;
begin
  if not public._bbf_is_admin_session(p_session_token) then
    raise exception 'not_authorized';
  end if;

  -- ONE statement, ONE shared `axes` CTE — both the histogram and raw arrays
  -- are scalar subqueries against it. (A prior version split this into two
  -- separate WITH statements; CTEs do not survive across statement
  -- boundaries in plpgsql, so the second `SELECT ... FROM axes` failed with
  -- "relation axes does not exist" — caught in testing, fixed here.)
  with axes as (
    select
      p.athlete_id,
      p.date,
      round(p.readiness_score)::int as cns,
      case when b.sleep_minutes is not null and b.sleep_minutes > 0
           then least(100, greatest(0, round((b.sleep_minutes::numeric / 60 / 8) * 100)))::int
           else null end as sleep_axis,
      case when b.stress_level is not null and b.stress_level > 0
           then least(100, greatest(0, round(b.stress_level * 10)))::int
           else null end as stress_axis
    from public.bbf_daily_protocols p
    left join public.bbf_daily_biometrics b
      on b.athlete_id = p.athlete_id and b.date = p.date
    where p.readiness_score is not null
      and p.date >= current_date - v_days
  ),
  bucketed as (
    select
      (round(cns / 10.0) * 10)::int as cns_bucket,
      case when sleep_axis  is null then null else (round(sleep_axis  / 10.0) * 10)::int end as sleep_bucket,
      case when stress_axis is null then null else (round(stress_axis / 10.0) * 10)::int end as stress_bucket
    from axes
  )
  select jsonb_build_object(
    'ok', true,
    'days', v_days,
    'histogram', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'cns_bucket', cns_bucket, 'sleep_bucket', sleep_bucket, 'stress_bucket', stress_bucket, 'n', n
             ) order by n desc), '[]'::jsonb)
      from (
        select cns_bucket, sleep_bucket, stress_bucket, count(*) as n
        from bucketed
        group by cns_bucket, sleep_bucket, stress_bucket
      ) h
    ),
    'raw', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'athlete_id', athlete_id, 'date', date,
               'cns', cns, 'sleep_axis', sleep_axis, 'stress_axis', stress_axis
             ) order by date desc), '[]'::jsonb)
      from axes
    )
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.bbf_admin_readiness_axis_distribution(text, integer) from public;
grant execute on function public.bbf_admin_readiness_axis_distribution(text, integer) to anon, authenticated, service_role;

comment on function public.bbf_admin_readiness_axis_distribution(text, integer) is
  'Admin-gated. Buckets real CNS/Sleep/Stress telemetry (from the existing bbf_daily_protocols + bbf_daily_biometrics ledger) to the nearest 10, so biometric-audio-matrix expansion decisions are driven by which states athletes actually land on. No new logging — reads data already captured by the check-in pipeline.';
