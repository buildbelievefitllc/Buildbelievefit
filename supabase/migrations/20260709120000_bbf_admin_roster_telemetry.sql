-- ═══════════════════════════════════════════════════════════════════════════
-- COMMAND CENTER · TELEMETRY & ADHERENCE RADAR — bbf_admin_roster_telemetry
--
-- One admin-gated batch RPC that scans the trailing 14 days of training logs
-- (bbf_logs + bbf_sets) and committed fueling (nutrition_daily_sync) for the
-- WHOLE roster in a single pass, so the Founder Five hub makes ONE call to
-- light up every card — never N per-client round-trips (the load-time
-- optimization mandate).
--
-- THE FLIGHT RISK ALGORITHM (7-day window):
--   • Workout adherence = completed training days (distinct log-days carrying
--     ≥1 set in the last 7d) ÷ assigned training days/week (workout_plan days
--     that carry exercises — rest days excluded).
--   • Macro adherence  = mean committed kcal-vs-target % (nutrition_daily_sync,
--     last 7d), clamped 0–100. Degrades gracefully: no sync rows ⇒ this axis
--     is simply absent and the score rests on training alone.
--   • Score = weighted mean of the AVAILABLE axes (workout .6 / macro .4,
--     renormalized when only one is present).
--   • Status:  🔴 red   — score < 50, OR a client WITH assigned work who has
--                         been silent ≥ 3 days (3+ days of zero logs).
--              🟡 yellow — score 50–84.
--              🟢 green  — score 85–100.
--              ⚪ insufficient — no plan AND never logged (a freshly-forged
--                         athlete is "new", not a false flight risk).
--
-- VOLUME LOAD: this-week tonnage (Σ reps × weight_lbs, last 7d) vs the prior
-- 7d, plus a 7-point daily sparkline (oldest→newest) for the card chart.
--
-- Optimization: bounded to 14 days, grouped once per client; the roster is ~10
-- rows / hundreds of sets — sub-millisecond. Idempotent: CREATE OR REPLACE.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.bbf_admin_roster_telemetry(
  p_session_token text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows  jsonb;
  v_today date := (now() at time zone 'UTC')::date;
begin
  if not public._bbf_is_admin_session(p_session_token) then
    return jsonb_build_object('ok', false, 'error', 'not_authorized');
  end if;

  with roster as (
    select u.id, u.email, u.workout_plan
      from public.bbf_users u
     where u.role in ('client', 'athlete') and u.deleted_at is null
  ),
  -- Assigned training days/week = plan days that actually carry exercises
  -- (rest days do not count against adherence). Guards non-JSON text plans.
  assigned as (
    select r.id,
           (left(btrim(coalesce(r.workout_plan, '')), 1) = '[') as has_plan,
           coalesce((
             select count(*) from jsonb_array_elements(
               case when left(btrim(coalesce(r.workout_plan, '')), 1) = '['
                    then r.workout_plan::jsonb else '[]'::jsonb end
             ) d
             where jsonb_array_length(coalesce(d->'exercises', '[]'::jsonb)) > 0
           ), 0)::int as assigned_days
      from roster r
  ),
  -- Per-log-day tonnage across the trailing 14 days (one row per client-day).
  daylogs as (
    select l.user_id, l.date,
           coalesce(sum(greatest(coalesce(s.reps, 0), 0)
                      * greatest(coalesce(s.weight_lbs, 0), 0)), 0)::bigint as day_tonnage,
           count(s.id) as set_count
      from public.bbf_logs l
      left join public.bbf_sets s on s.log_id = l.id
     where l.date >= v_today - 13
     group by l.user_id, l.date
  ),
  agg as (
    select r.id,
           count(distinct d.date) filter (where d.date >= v_today - 6 and d.set_count > 0)::int as completed_7d,
           max(d.date) as last_log_date,
           coalesce(sum(d.day_tonnage) filter (where d.date >= v_today - 6), 0)::bigint as ton_week,
           coalesce(sum(d.day_tonnage) filter (where d.date >= v_today - 13 and d.date <= v_today - 7), 0)::bigint as ton_prev
      from roster r
      left join daylogs d on d.user_id = r.id
     group by r.id
  ),
  -- 7-point daily sparkline (index 0 = 6 days ago … index 6 = today).
  spark as (
    select r.id,
           jsonb_agg(coalesce(dl.day_tonnage, 0) order by gs.g desc) as sparkline
      from roster r
      cross join generate_series(0, 6) as gs(g)
      left join daylogs dl on dl.user_id = r.id and dl.date = v_today - gs.g
     group by r.id
  ),
  -- Macro adherence (committed fueling) — via athlete_profiles link. Empty
  -- today ⇒ macro_days 0 ⇒ the axis is skipped in the score.
  macro as (
    select r.id,
           avg(least(greatest(coalesce(n.kcal_pct, 0), 0), 100)) as macro_pct,
           count(n.id)::int as macro_days
      from roster r
      left join public.athlete_profiles ap on ap.user_id = r.id
      left join public.nutrition_daily_sync n
             on n.athlete_id = ap.id and n.day >= v_today - 6
     group by r.id
  ),
  scored as (
    select r.id,
           a.has_plan, a.assigned_days,
           g.completed_7d, g.last_log_date, g.ton_week, g.ton_prev,
           sp.sparkline, m.macro_pct, m.macro_days,
           case when a.has_plan and a.assigned_days > 0
                then least(g.completed_7d::numeric / a.assigned_days, 1) end as workout_adh,
           case when m.macro_days > 0 then m.macro_pct / 100 end as macro_adh,
           case when g.last_log_date is not null then (v_today - g.last_log_date) end as days_since
      from roster r
      join assigned a on a.id = r.id
      join agg g      on g.id = r.id
      join spark sp   on sp.id = r.id
      join macro m    on m.id = r.id
  )
  select jsonb_agg(jsonb_build_object(
    'id', s.id,
    'adherence_score', score.v,
    'status',
      case
        when not (s.has_plan or s.last_log_date is not null) then 'insufficient'
        when score.v is not null and score.v < 50 then 'red'
        when s.has_plan and (s.days_since is null or s.days_since >= 3) then 'red'
        when score.v is null then 'insufficient'
        when score.v < 85 then 'yellow'
        else 'green'
      end,
    'workout_completed', s.completed_7d,
    'workout_assigned', s.assigned_days,
    'macro_days', s.macro_days,
    'days_since_log', s.days_since,
    'tonnage_week', s.ton_week,
    'tonnage_prev', s.ton_prev,
    'tonnage_trend',
      case
        when s.ton_week > s.ton_prev * 1.05 then 'up'
        when s.ton_week < s.ton_prev * 0.95 then 'down'
        when s.ton_week > 0 or s.ton_prev > 0 then 'flat'
        else null
      end,
    'sparkline', s.sparkline
  ))
    into v_rows
    from scored s
    cross join lateral (
      select case
        when s.workout_adh is not null and s.macro_adh is not null
          then round((s.workout_adh * 0.6 + s.macro_adh * 0.4) * 100)::int
        when s.workout_adh is not null then round(s.workout_adh * 100)::int
        when s.macro_adh is not null then round(s.macro_adh * 100)::int
        else null
      end as v
    ) score;

  return jsonb_build_object('ok', true, 'telemetry', coalesce(v_rows, '[]'::jsonb));
end;
$$;

grant execute on function public.bbf_admin_roster_telemetry(text) to anon, authenticated, service_role;
