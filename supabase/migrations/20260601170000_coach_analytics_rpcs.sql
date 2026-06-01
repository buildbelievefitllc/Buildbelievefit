-- ═══════════════════════════════════════════════════════════════════════════
-- BBF SUPABASE — COACH PORTAL ANALYTICS RPCs (admin-gated, read-only)
-- ═══════════════════════════════════════════════════════════════════════════
-- Aggregation layer for the Sovereign Command Center analytics charts. Both
-- functions are SECURITY DEFINER (so they can read across all athletes) but are
-- GATED by bbf_verify_admin_pin — only the verified Sovereign admin (akeem /
-- trainer) can pull any athlete's data. The per-user RLS read boundary for
-- clients is untouched; this is a separate, admin-only read path.
--
-- Brute-force protection is inherited from bbf_verify_admin_pin (IP-keyed
-- 3-strike / 15-min lockout via bbf_pin_attempts). A non-admin caller cannot
-- get results without the admin PIN and is locked out after 3 tries.
--
-- NOTE: p_admin_pin is the 6-digit admin PIN. If you later want to avoid the
-- coach UI re-sending the PIN per request, the clean follow-up is an admin
-- session-token table mirroring bbf_vault_sessions — not built here (the order
-- specified the bbf_verify_admin_pin gating pattern).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Reactive training analytics (30/60/90-day series) ──────────────────
CREATE OR REPLACE FUNCTION public.bbf_coach_client_analytics(
  p_admin_pin   text,
  p_uid         text,
  p_window_days int DEFAULT 30
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $function$
DECLARE
  v_auth      json;
  v_user_id   uuid;
  v_name      text;
  v_win       int  := CASE WHEN p_window_days IS NULL OR p_window_days <= 0 THEN 30
                           WHEN p_window_days > 365 THEN 365
                           ELSE p_window_days END;
  v_from      date;
  v_from_ts   timestamptz;
  v_volume    json;
  v_readiness json;
  v_freq      json;
  v_summary   json;
BEGIN
  -- Gate: admin PIN only.
  v_auth := public.bbf_verify_admin_pin(p_admin_pin);
  IF (v_auth->>'ok') IS DISTINCT FROM 'true' THEN
    RETURN json_build_object(
      'ok', false, 'error', 'unauthorized',
      'lockout_active',      coalesce((v_auth->>'lockout_active')::boolean, false),
      'retry_after_seconds', coalesce((v_auth->>'retry_after_seconds')::int, 0));
  END IF;

  SELECT id, name INTO v_user_id, v_name
    FROM public.bbf_users WHERE uid = p_uid AND deleted_at IS NULL LIMIT 1;
  IF v_user_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'user_not_found');
  END IF;

  v_from    := CURRENT_DATE - (v_win - 1);
  v_from_ts := now() - make_interval(days => v_win);

  -- Volume / tonnage per training day (sets joined to their log for the date).
  SELECT coalesce(json_agg(row_to_json(t) ORDER BY t.date), '[]'::json) INTO v_volume FROM (
    SELECT l.date AS date,
           sum(coalesce(s.reps,0) * coalesce(s.weight_lbs,0))::double precision AS tonnage_lbs,
           count(*)                                                             AS set_count,
           sum(coalesce(s.reps,0))                                             AS total_reps
    FROM public.bbf_sets s
    JOIN public.bbf_logs l ON l.id = s.log_id
    WHERE l.user_id = v_user_id AND l.date >= v_from
    GROUP BY l.date
  ) t;

  -- CNS readiness trend per day.
  SELECT coalesce(json_agg(row_to_json(t) ORDER BY t.date), '[]'::json) INTO v_readiness FROM (
    SELECT date(r."timestamp")                       AS date,
           round(avg(r.score)::numeric, 1)           AS avg_score,
           round(avg(r.sleep_quality)::numeric, 1)   AS avg_sleep_quality,
           round(avg(r.soreness_level)::numeric, 1)  AS avg_soreness,
           count(*)                                  AS readings
    FROM public.bbf_readiness r
    WHERE r.user_id = v_user_id AND r."timestamp" >= v_from_ts
    GROUP BY date(r."timestamp")
  ) t;

  -- Session frequency per day.
  SELECT coalesce(json_agg(row_to_json(t) ORDER BY t.date), '[]'::json) INTO v_freq FROM (
    SELECT l.date AS date, count(*) AS sessions
    FROM public.bbf_logs l
    WHERE l.user_id = v_user_id AND l.date >= v_from
    GROUP BY l.date
  ) t;

  SELECT json_build_object(
    'total_sessions',   (SELECT count(*) FROM public.bbf_logs l WHERE l.user_id=v_user_id AND l.date>=v_from),
    'total_sets',       (SELECT count(*) FROM public.bbf_sets s JOIN public.bbf_logs l ON l.id=s.log_id WHERE l.user_id=v_user_id AND l.date>=v_from),
    'total_tonnage_lbs',(SELECT coalesce(sum(coalesce(s.reps,0)*coalesce(s.weight_lbs,0)),0)::double precision FROM public.bbf_sets s JOIN public.bbf_logs l ON l.id=s.log_id WHERE l.user_id=v_user_id AND l.date>=v_from),
    'avg_readiness',    (SELECT round(avg(score)::numeric,1) FROM public.bbf_readiness WHERE user_id=v_user_id AND "timestamp">=v_from_ts),
    'avg_sleep_quality',(SELECT round(avg(sleep_quality)::numeric,1) FROM public.bbf_readiness WHERE user_id=v_user_id AND "timestamp">=v_from_ts),
    'avg_soreness',     (SELECT round(avg(soreness_level)::numeric,1) FROM public.bbf_readiness WHERE user_id=v_user_id AND "timestamp">=v_from_ts),
    'active_days',      (SELECT count(DISTINCT l.date) FROM public.bbf_logs l WHERE l.user_id=v_user_id AND l.date>=v_from)
  ) INTO v_summary;

  RETURN json_build_object(
    'ok', true,
    'uid', p_uid,
    'user_id', v_user_id,
    'name', v_name,
    'window_days', v_win,
    'from_date', v_from,
    'generated_at', now(),
    'summary', v_summary,
    'volume_series', v_volume,
    'readiness_series', v_readiness,
    'session_frequency', v_freq
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.bbf_coach_client_analytics(text, text, int) FROM public;
GRANT EXECUTE ON FUNCTION public.bbf_coach_client_analytics(text, text, int)
  TO anon, authenticated, service_role;

-- ─── 2. Body composition history ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bbf_coach_body_composition(
  p_admin_pin text,
  p_uid       text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $function$
DECLARE
  v_auth    json;
  v_user_id uuid;
  v_name    text;
  v_series  json;
  v_first   numeric;
  v_last    numeric;
  v_count   int;
BEGIN
  v_auth := public.bbf_verify_admin_pin(p_admin_pin);
  IF (v_auth->>'ok') IS DISTINCT FROM 'true' THEN
    RETURN json_build_object(
      'ok', false, 'error', 'unauthorized',
      'lockout_active',      coalesce((v_auth->>'lockout_active')::boolean, false),
      'retry_after_seconds', coalesce((v_auth->>'retry_after_seconds')::int, 0));
  END IF;

  SELECT id, name INTO v_user_id, v_name
    FROM public.bbf_users WHERE uid = p_uid AND deleted_at IS NULL LIMIT 1;
  IF v_user_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'user_not_found');
  END IF;

  -- Time series of body-fat readings. body_fat is free text; parse safely:
  -- strip non-numerics, and only cast when the result is a clean number.
  SELECT coalesce(json_agg(row_to_json(t) ORDER BY t.date), '[]'::json) INTO v_series FROM (
    SELECT l.date AS date,
           l.body_fat AS body_fat_raw,
           CASE WHEN regexp_replace(l.body_fat, '[^0-9.]', '', 'g') ~ '^[0-9]+(\.[0-9]+)?$'
                THEN regexp_replace(l.body_fat, '[^0-9.]', '', 'g')::numeric
                ELSE NULL END AS body_fat_pct
    FROM public.bbf_logs l
    WHERE l.user_id = v_user_id
      AND l.body_fat IS NOT NULL AND btrim(l.body_fat) <> ''
  ) t;

  -- First / last parsed reading for the progression delta.
  SELECT body_fat_pct INTO v_first FROM (
    SELECT l.date,
           CASE WHEN regexp_replace(l.body_fat,'[^0-9.]','','g') ~ '^[0-9]+(\.[0-9]+)?$'
                THEN regexp_replace(l.body_fat,'[^0-9.]','','g')::numeric ELSE NULL END AS body_fat_pct
    FROM public.bbf_logs l
    WHERE l.user_id=v_user_id AND l.body_fat IS NOT NULL
  ) z WHERE body_fat_pct IS NOT NULL ORDER BY date ASC LIMIT 1;

  SELECT body_fat_pct, cnt INTO v_last, v_count FROM (
    SELECT l.date,
           CASE WHEN regexp_replace(l.body_fat,'[^0-9.]','','g') ~ '^[0-9]+(\.[0-9]+)?$'
                THEN regexp_replace(l.body_fat,'[^0-9.]','','g')::numeric ELSE NULL END AS body_fat_pct,
           count(*) FILTER (WHERE regexp_replace(l.body_fat,'[^0-9.]','','g') ~ '^[0-9]+(\.[0-9]+)?$') OVER () AS cnt
    FROM public.bbf_logs l
    WHERE l.user_id=v_user_id AND l.body_fat IS NOT NULL
  ) z WHERE body_fat_pct IS NOT NULL ORDER BY date DESC LIMIT 1;

  RETURN json_build_object(
    'ok', true,
    'uid', p_uid,
    'user_id', v_user_id,
    'name', v_name,
    'generated_at', now(),
    'series', v_series,
    'progression', json_build_object(
      'first_pct', v_first,
      'last_pct',  v_last,
      'delta_pct', (v_last - v_first),
      'readings',  coalesce(v_count, 0)
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.bbf_coach_body_composition(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.bbf_coach_body_composition(text, text)
  TO anon, authenticated, service_role;
