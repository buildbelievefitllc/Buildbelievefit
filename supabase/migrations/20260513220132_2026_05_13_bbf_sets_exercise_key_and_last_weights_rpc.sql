ALTER TABLE bbf_sets
  ADD COLUMN IF NOT EXISTS exercise_key text NULL;

COMMENT ON COLUMN bbf_sets.exercise_key IS
  'Phase 5 — frontend exercise position key like "ex_0", "ex_1" matching localStorage d.w[uid][dk][ek] structure. Joins (day_key, exercise_key) uniquely identify an exercise slot across logging sessions.';

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