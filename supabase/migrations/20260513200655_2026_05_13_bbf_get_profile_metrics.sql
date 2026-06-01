CREATE OR REPLACE FUNCTION public.bbf_get_profile_metrics(target_uid text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    'heatmap',        COALESCE(v_heatmap, '[]'::jsonb)
  );
END;
$$;

COMMENT ON FUNCTION public.bbf_get_profile_metrics(text) IS
  'Phase 3 Obj 1 — server-authoritative profile aggregates from bbf_logs. Replaces client-side calc in renderOverview() to eliminate cross-device desync.';

GRANT EXECUTE ON FUNCTION public.bbf_get_profile_metrics(text) TO anon, authenticated, service_role;