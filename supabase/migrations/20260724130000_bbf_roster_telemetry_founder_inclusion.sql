-- ============================================================================
-- 20260724130000_bbf_roster_telemetry_founder_inclusion.sql
-- ----------------------------------------------------------------------------
-- Surface the founder (uid='akeem') in the Client Database Hub adherence radar.
--
-- The roster telemetry filters role IN ('client','athlete'), which excludes the
-- CEO account (role='trainer' — load-bearing for every admin gate, so we do NOT
-- change it). This adds a single `uid='akeem'` exception to the roster CTE so his
-- seeded active-client metrics score in the Founder Five hub. Every other
-- admin/trainer remains excluded by construction.
--
-- ONLY the roster CTE's WHERE clause changes; all scoring/output is byte-identical
-- to the prior definition. Applied via apply_migration (DATABASE_SAFETY.md RULE 2).
-- Mirrors the matching exception added to the bbf-admin-roster edge function's
-- `roster` action (which supplies the roster list this telemetry overlays by id).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.bbf_admin_roster_telemetry(p_session_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
     where (u.role in ('client', 'athlete') or u.uid = 'akeem') and u.deleted_at is null
  ),
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
  spark as (
    select r.id,
           jsonb_agg(coalesce(dl.day_tonnage, 0) order by gs.g desc) as sparkline
      from roster r
      cross join generate_series(0, 6) as gs(g)
      left join daylogs dl on dl.user_id = r.id and dl.date = v_today - gs.g
     group by r.id
  ),
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
$function$;
