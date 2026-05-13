-- Phase 5 · Server-Hydrated Autoregulation
-- ────────────────────────────────────────────────────────────────
-- Closes the data void in Phase 4: localStorage-only history meant a
-- new device fell back to BASELINE every time. This migration adds
-- the missing exercise_key column on bbf_sets (the frontend already
-- writes it; PostgREST has been silently dropping it because the
-- column never existed) and ships an aggregate RPC the workout view
-- calls per dayIdx.
--
-- Schema add is additive — no rewrites, no defaults to backfill.
-- Existing rows have exercise_key = NULL, which the RPC naturally
-- excludes via `WHERE exercise_key IS NOT NULL`.
-- ────────────────────────────────────────────────────────────────

ALTER TABLE bbf_sets
  ADD COLUMN IF NOT EXISTS exercise_key text NULL;

COMMENT ON COLUMN bbf_sets.exercise_key IS
  'Phase 5 — frontend exercise position key like "ex_0", "ex_1" matching localStorage d.w[uid][dk][ek] structure. Joins (day_key, exercise_key) uniquely identify an exercise slot across logging sessions.';

-- ────────────────────────────────────────────────────────────────
-- bbf_get_last_weights(target_uid text, target_day_idx int)
-- ────────────────────────────────────────────────────────────────
-- For a given user and day index (0-based, matching PLAN[i]) returns
-- jsonb { ok, day_idx, weights: { ex_0: 135, ex_1: 95, ... } } —
-- the most recent non-null weight per exercise position, across every
-- historical session that matches that day index.
--
-- day_key format on the row is "YYYY-MM-DD_d<N>"; we filter via POSIX
-- regex anchored at the end of the string so day 2 doesn't accidentally
-- match day 12 or day 20.
--
-- SECURITY DEFINER + GRANT to anon mirrors bbf_get_profile_metrics
-- and bbf_get_uid_map. RLS on bbf_sets stays as-is.
-- ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.bbf_get_last_weights(
  target_uid text,
  target_day_idx int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_pattern text;
  v_weights jsonb;
BEGIN
  IF target_uid IS NULL OR length(trim(target_uid)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'target_uid_required');
  END IF;
  IF target_day_idx IS NULL OR target_day_idx < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'target_day_idx_required');
  END IF;

  -- Accept slug or UUID (matches Phase 3 bbf_get_profile_metrics).
  IF target_uid ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_user_id := target_uid::uuid;
  ELSE
    SELECT id INTO v_user_id FROM bbf_users WHERE uid = target_uid LIMIT 1;
  END IF;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false, 'error', 'user_not_found',
      'day_idx', target_day_idx, 'weights', '{}'::jsonb
    );
  END IF;

  -- Anchored regex so '_d2$' doesn't bleed into '_d12$' / '_d20$'.
  v_pattern := '_d' || target_day_idx::text || '$';

  WITH ranked AS (
    SELECT
      exercise_key,
      weight_lbs,
      ROW_NUMBER() OVER (
        PARTITION BY exercise_key
        ORDER BY day_key DESC, set_number DESC NULLS LAST
      ) AS rn
    FROM bbf_sets
    WHERE user_id = v_user_id
      AND weight_lbs IS NOT NULL
      AND weight_lbs > 0
      AND exercise_key IS NOT NULL
      AND day_key ~ v_pattern
  )
  SELECT jsonb_object_agg(exercise_key, weight_lbs)
  INTO v_weights
  FROM ranked
  WHERE rn = 1;

  RETURN jsonb_build_object(
    'ok',      true,
    'day_idx', target_day_idx,
    'weights', COALESCE(v_weights, '{}'::jsonb)
  );
END;
$$;

COMMENT ON FUNCTION public.bbf_get_last_weights(text, int) IS
  'Phase 5 — server-authoritative last working weight per exercise slot for the given day index. Powers the cross-device Autoregulation Engine target banner.';

GRANT EXECUTE ON FUNCTION public.bbf_get_last_weights(text, int) TO anon, authenticated, service_role;
