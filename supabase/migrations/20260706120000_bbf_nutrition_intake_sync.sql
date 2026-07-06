-- ═══════════════════════════════════════════════════════════════════════════
-- BBF Lab · Nutrition Intake Sync — meal-log persistence + adherence read
-- ───────────────────────────────────────────────────────────────────────────
-- Closes the "log a meal → it persists → adherence vs the canonical daily target"
-- loop. Two pieces:
--   1. nutrition_intake_log.client_meal_key — a STABLE per-meal handle
--      (`<source>:<day>:<idx>`) so the tap-to-log wheel can idempotently LOG
--      (upsert) and UNLOG (delete) a specific meal card. Partial-unique on
--      (athlete_id, day, client_meal_key) → one row per logged card, re-logging
--      heals instead of duplicating.
--   2. bbf_nutrition_today(p_uid, p_session_token) — the vault-token-gated read
--      the Nutrition tab hydrates from: today's canonical target row (incl the
--      Tier-3 timing_plan), today's logged intake (by client_meal_key, so checked
--      state survives reload + crosses devices), and a 7-day kcal-adherence strip.
--
-- DISCIPLINE (unchanged): intake is DISPLAY/ADHERENCE ONLY — it never feeds the
-- daily target or any readiness score (Tier-1 discipline, §2.3). This migration
-- adds a read + a stable key; it does not wire intake into any engine.
-- Idempotent: ADD COLUMN IF NOT EXISTS · CREATE INDEX IF NOT EXISTS · CREATE OR REPLACE.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1 · stable per-card handle for idempotent log/unlog ────────────────────
alter table public.nutrition_intake_log
  add column if not exists client_meal_key text;

comment on column public.nutrition_intake_log.client_meal_key is
  'Stable per-meal-card handle (<source>:<day>:<idx>) written by bbf-meal-log so the tap-to-log wheel can idempotently upsert (log) and delete (unlog) a specific card. Null for non-wheel writers (e.g. vision scans).';

-- One row per logged card per athlete-day; re-logging the same card upserts.
-- FULL (not partial) unique index: PostgREST on_conflict can infer it, and NULLS
-- DISTINCT (Postgres default) keeps null-key rows (e.g. vision scans) unlimited.
create unique index if not exists uq_nil_athlete_day_mealkey
  on public.nutrition_intake_log (athlete_id, day, client_meal_key);

-- ─── 2 · the Nutrition tab hydration read ───────────────────────────────────
create or replace function public.bbf_nutrition_today(
  p_uid           text,
  p_session_token text
)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  v_user_id    uuid;
  v_profile_id uuid;
  v_day        date := (now() at time zone 'utc')::date;
  v_targets    jsonb;
  v_intake     jsonb;
  v_week       jsonb;
begin
  -- Authorize purely on the bearer token (mirror bbf_hub_hydration).
  if p_session_token is null or length(p_session_token) = 0 then
    return json_build_object('ok', false, 'error', 'invalid_session');
  end if;

  select s.user_id into v_user_id
    from public.bbf_vault_sessions s
    join public.bbf_users u
      on u.id = s.user_id
     and u.deleted_at is null
     and u.access_status is distinct from 'locked'
   where s.token::text = p_session_token
     and s.expires_at > now()
   limit 1;

  if v_user_id is null then
    return json_build_object('ok', false, 'error', 'invalid_session');
  end if;

  -- Earliest athlete profile; nutrition keys on it. Absent → degraded (targets null).
  select p.id into v_profile_id
    from public.athlete_profiles p
   where p.user_id = v_user_id
   order by p.created_at asc
   limit 1;

  -- Today's canonical target row (the SAME row the Hub NutritionCard reads),
  -- plus the Tier-3 timing_plan for the periodized (Sovereign) surface.
  if v_profile_id is not null then
    select to_jsonb(n) into v_targets from (
      select tier, tdee_kcal, protein_g, carbs_g, fat_g, creatine_g, day_type, timing_plan
        from public.athlete_nutrition_targets_daily
       where athlete_id = v_profile_id and day = v_day
       limit 1
    ) n;

    -- Today's logged intake, keyed by client_meal_key so the wheel rehydrates
    -- its checked cards from the SERVER (survives reload, crosses devices).
    select coalesce(jsonb_agg(jsonb_build_object(
             'client_meal_key', client_meal_key,
             'meal_slot',       meal_slot,
             'food_label',      food_label,
             'protein_g',       protein_g,
             'carbs_g',         carbs_g,
             'fat_g',           fat_g,
             'kcal',            kcal
           ) order by logged_at), '[]'::jsonb)
      into v_intake
      from public.nutrition_intake_log
     where athlete_id = v_profile_id and day = v_day;

    -- 7-day kcal adherence strip (oldest → today) for the Performance trend.
    select coalesce(jsonb_agg(jsonb_build_object(
             'day',           x.day,
             'consumed_kcal', x.consumed_kcal,
             'target_kcal',   x.target_kcal,
             'pct', case when x.target_kcal > 0
                         then least(round(100.0 * x.consumed_kcal / x.target_kcal)::int, 999)
                         else 0 end
           ) order by x.day), '[]'::jsonb)
      into v_week
      from (
        select (v_day - gs.n) as day,
               coalesce((select sum(kcal) from public.nutrition_intake_log nil
                          where nil.athlete_id = v_profile_id and nil.day = (v_day - gs.n)), 0) as consumed_kcal,
               coalesce((select tdee_kcal from public.athlete_nutrition_targets_daily t
                          where t.athlete_id = v_profile_id and t.day = (v_day - gs.n) limit 1), 0) as target_kcal
          from generate_series(0, 6) as gs(n)
      ) x;
  end if;

  return json_build_object(
    'ok',             true,
    'uid',            p_uid,
    'day',            v_day,
    'profile_id',     v_profile_id,
    'targets',        v_targets,               -- null → tab falls back to plan totals
    'intake',         coalesce(v_intake, '[]'::jsonb),
    'week_adherence', coalesce(v_week,   '[]'::jsonb)
  );
end;
$function$;

revoke all on function public.bbf_nutrition_today(text, text) from public;
grant execute on function public.bbf_nutrition_today(text, text) to anon, authenticated, service_role;
