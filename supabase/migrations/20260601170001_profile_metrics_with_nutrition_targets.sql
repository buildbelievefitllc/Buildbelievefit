-- Phase 21.3 — Dynamic TDEE: extend bbf_get_profile_metrics to additively carry
-- the user's nutrition targets so the Nutrition UI can render calories / macros /
-- fasting dynamically instead of hardcoded fallbacks. Body is the existing
-- function verbatim; only new DECLAREs, a nutrition read block, and new return
-- keys are added. Sources: bbf_users (metabolic_tier, somatic_fasting_hours, and
-- tdee/macros as baseline) preferring the AI-plan values on bbf_active_clients
-- (joined by email) when present. All new fields are nullable — the frontend
-- treats null as "not set" (no static fallback).
CREATE OR REPLACE FUNCTION public.bbf_get_profile_metrics(target_uid text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id    uuid;
  v_total      int := 0;
  v_streak     int := 0;
  v_best       int := 0;
  v_this_week  int := 0;
  v_this_month int := 0;
  v_avg        numeric := 0;
  v_first_date date;
  v_today      date := (now() at time zone 'UTC')::date;
  v_week_start date := (v_today - EXTRACT(DOW FROM v_today)::int)::date;
  v_month_start date := date_trunc('month', v_today::timestamp)::date;
  v_heatmap    jsonb := '[]'::jsonb;
  -- Nutrition targets (additive)
  v_email      text;
  v_tier       text;
  v_fast_hours numeric;
  v_tdee       int;
  v_mp         int;
  v_mc         int;
  v_mf         int;
  v_ac_tdee    int;
  v_ac_mp      int;
  v_ac_mc      int;
  v_ac_mf      int;
BEGIN
  IF target_uid IS NULL OR length(trim(target_uid)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'target_uid_required');
  END IF;

  IF target_uid ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_user_id := target_uid::uuid;
  ELSE
    SELECT id INTO v_user_id FROM bbf_users WHERE uid = target_uid LIMIT 1;
  END IF;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false, 'error', 'user_not_found',
      'total_sessions', 0, 'current_streak', 0, 'best_streak', 0,
      'this_week', 0, 'this_month', 0, 'avg_per_week', 0,
      'heatmap', '[]'::jsonb
    );
  END IF;

  -- ── Nutrition targets read (additive, dynamic TDEE) ──
  SELECT email, metabolic_tier, somatic_fasting_hours, tdee_target, macro_p, macro_c, macro_f
    INTO v_email, v_tier, v_fast_hours, v_tdee, v_mp, v_mc, v_mf
    FROM bbf_users WHERE id = v_user_id LIMIT 1;

  IF v_email IS NOT NULL THEN
    SELECT ac.tdee_target, ac.macro_p, ac.macro_c, ac.macro_f
      INTO v_ac_tdee, v_ac_mp, v_ac_mc, v_ac_mf
      FROM bbf_active_clients ac
      WHERE ac.vault_email = v_email
      ORDER BY ac.plans_generated_at DESC NULLS LAST
      LIMIT 1;
    v_tdee := COALESCE(v_ac_tdee, v_tdee);
    v_mp   := COALESCE(v_ac_mp, v_mp);
    v_mc   := COALESCE(v_ac_mc, v_mc);
    v_mf   := COALESCE(v_ac_mf, v_mf);
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE date >= v_week_start),
    COUNT(*) FILTER (WHERE date >= v_month_start),
    MIN(date)
  INTO v_total, v_this_week, v_this_month, v_first_date
  FROM bbf_logs
  WHERE user_id = v_user_id AND date IS NOT NULL;

  IF v_total > 0 THEN
    WITH session_days AS (
      SELECT DISTINCT date AS d
      FROM bbf_logs
      WHERE user_id = v_user_id AND date IS NOT NULL AND date <= v_today
    ),
    ranked AS (
      SELECT d, ROW_NUMBER() OVER (ORDER BY d) AS rn FROM session_days
    ),
    streaks AS (
      SELECT
        (d - (rn::int * INTERVAL '1 day'))::date AS anchor,
        MAX(d) AS streak_end,
        COUNT(*)::int AS streak_len
      FROM ranked
      GROUP BY (d - (rn::int * INTERVAL '1 day'))::date
    )
    SELECT
      COALESCE(MAX(streak_len) FILTER (WHERE streak_end >= v_today - 1), 0),
      COALESCE(MAX(streak_len), 0)
    INTO v_streak, v_best
    FROM streaks;

    IF v_first_date IS NOT NULL THEN
      v_avg := round(
        v_total::numeric / GREATEST(
          1,
          ceil((v_today - v_first_date)::numeric / 7)
        ),
        1
      );
    END IF;
  END IF;

  WITH days AS (
    SELECT (v_today - i)::date AS d FROM generate_series(29, 0, -1) AS i
  ),
  logged AS (
    SELECT DISTINCT date AS d
    FROM bbf_logs
    WHERE user_id = v_user_id AND date IS NOT NULL AND date >= v_today - 29
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'date',   to_char(days.d, 'YYYY-MM-DD'),
      'logged', logged.d IS NOT NULL
    )
    ORDER BY days.d
  )
  INTO v_heatmap
  FROM days
  LEFT JOIN logged ON logged.d = days.d;

  RETURN jsonb_build_object(
    'ok',             true,
    'total_sessions', v_total,
    'current_streak', v_streak,
    'best_streak',    v_best,
    'this_week',      v_this_week,
    'this_month',     v_this_month,
    'avg_per_week',   v_avg,
    'heatmap',        COALESCE(v_heatmap, '[]'::jsonb),
    'metabolic_tier', v_tier,
    'fasting_hours',  v_fast_hours,
    'tdee_target',    v_tdee,
    'macro_p',        v_mp,
    'macro_c',        v_mc,
    'macro_f',        v_mf
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.bbf_get_profile_metrics(text) TO anon, authenticated;
