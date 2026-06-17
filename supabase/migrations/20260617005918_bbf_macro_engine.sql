-- ════════════════════════════════════════════════════════════════════════
-- BBF Deterministic Macro Engine — calculator-off-LLM, wave 1 (use case: macro reconciliation)
-- ────────────────────────────────────────────────────────────────────────
-- PURE MATH, ZERO AI. Two BBF-owned Postgres functions:
--
--  1. bbf_compute_macro_targets — Mifflin-St Jeor TDEE + goal-defined macro
--     split. Ported VERBATIM from the single source of truth
--     (frontend/src/components/vault/nutritionEngine.js calcTDEE/calcMacros and
--     the goal deltas in TDEECalculator.jsx): cut -500 / maintain 0 / gain +300;
--     protein 1.0 g/lb on a surplus else 0.9, fat 25% kcal, carbs = remainder.
--
--  2. bbf_reconcile_macro_targets — the weekly-trend recalc rule, encoding the
--     EXACT constants already live in bbf-midnight-haiku's Sunday Macro
--     Reconciliation (drift threshold 8%, min 3 logged days, 7-day window):
--     fire a recalc toward the observed 7-day average when intake has drifted.
--
-- NOTE (CEO call): the existing reconciliation already runs deterministically
-- inside bbf-midnight-haiku (a guardrail do-not-touch narrator). This codifies
-- the same math as a reusable, testable BBF-owned engine WITHOUT modifying that
-- function. Wiring midnight-haiku to call it is a separate, future step.
-- ════════════════════════════════════════════════════════════════════════

-- 1. Mifflin-St Jeor TDEE + goal macro split ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.bbf_compute_macro_targets(
  p_age        int,
  p_sex        text,
  p_weight_lb  numeric,
  p_height_ft  int,
  p_height_in  int DEFAULT 0,
  p_activity   numeric DEFAULT 1.55,
  p_goal       text DEFAULT 'maintain'
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $function$
DECLARE
  v_goal     text := lower(trim(coalesce(p_goal, 'maintain')));
  v_adj      int;
  v_act      numeric := coalesce(NULLIF(p_activity, 0), 1.55);
  v_is_male  boolean := lower(trim(coalesce(p_sex, ''))) IN ('male', 'm', 'man');
  v_kg       numeric;
  v_cm       numeric;
  v_bmr      numeric;
  v_tdee     int;     -- maintenance
  v_target   int;     -- goal-adjusted
  v_p int; v_f int; v_c int;
BEGIN
  IF p_age IS NULL OR p_age <= 0 OR p_weight_lb IS NULL OR p_weight_lb <= 0 OR p_height_ft IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_anthropometrics');
  END IF;

  -- Goal → calorie delta (VERBATIM: TDEECalculator.jsx cut -500 / maintain 0 / gain +300).
  v_adj := CASE
    WHEN v_goal IN ('cut','lose','loss','fat_loss','deficit')            THEN -500
    WHEN v_goal IN ('gain','bulk','surplus','muscle','muscle_gain')      THEN  300
    WHEN v_goal IN ('maintain','maintenance','recomp','recomposition','')THEN  0
    WHEN v_goal ~ '^-?\d+$'                                              THEN  v_goal::int  -- explicit numeric delta
    ELSE 0
  END;

  -- Mifflin-St Jeor BMR (lb→kg, ft+in→cm), then BMR × activity = maintenance TDEE.
  v_kg  := p_weight_lb * 0.453592;
  v_cm  := ((p_height_ft * 12) + coalesce(p_height_in, 0)) * 2.54;
  v_bmr := CASE WHEN v_is_male
                THEN (10 * v_kg) + (6.25 * v_cm) - (5 * p_age) + 5
                ELSE (10 * v_kg) + (6.25 * v_cm) - (5 * p_age) - 161 END;
  v_tdee   := floor(v_bmr * v_act + 0.5);   -- round-half-up (matches JS Math.round, non-neg)
  v_target := v_tdee + v_adj;

  -- Macro split (VERBATIM calcMacros): protein 1.0 g/lb on a surplus else 0.9,
  -- fat 25% of kcal, carbs = remaining kcal / 4 (floored at 0).
  v_p := floor(p_weight_lb * (CASE WHEN v_adj > 0 THEN 1.0 ELSE 0.9 END) + 0.5);
  v_f := floor((v_target * 0.25) / 9 + 0.5);
  v_c := greatest(0, floor((v_target - (v_p * 4) - (v_f * 9))::numeric / 4 + 0.5));

  RETURN jsonb_build_object(
    'ok', true,
    'maintenance_tdee', v_tdee,
    'tdee_target',      v_target,
    'goal',             v_goal,
    'goal_adj',         v_adj,
    'macro_p',          v_p,
    'macro_c',          v_c,
    'macro_f',          v_f,
    'model',            'mifflin_st_jeor'
  );
END;
$function$;

COMMENT ON FUNCTION public.bbf_compute_macro_targets(int, text, numeric, int, int, numeric, text) IS
  'Mifflin-St Jeor TDEE + goal macro split, ported verbatim from nutritionEngine.js calcTDEE/calcMacros + TDEECalculator goal deltas (cut -500/maintain 0/gain +300). calculator-off-LLM wave 1.';

GRANT EXECUTE ON FUNCTION public.bbf_compute_macro_targets(int, text, numeric, int, int, numeric, text) TO anon, authenticated, service_role;


-- 2. Weekly-trend reconciliation rule ────────────────────────────────────────
-- Mirrors bbf-midnight-haiku's Sunday Macro Reconciliation EXACTLY:
--   drift threshold = 8%, min logged days = 3, window = 7 days; new targets are
--   the observed 7-day averages (the "after" the haiku stages for approval).
CREATE OR REPLACE FUNCTION public.bbf_reconcile_macro_targets(
  p_current_tdee numeric,
  p_avg7_kcal    numeric,
  p_logged_days  int,
  p_avg7_p       numeric DEFAULT NULL,
  p_avg7_c       numeric DEFAULT NULL,
  p_avg7_f       numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $function$
DECLARE
  c_threshold     numeric := 0.08;  -- NUTRITION_RECALC_DRIFT_THRESHOLD_PCT
  c_min_days      int     := 3;     -- NUTRITION_RECALC_MIN_LOGGED_DAYS
  c_window_days   int     := 7;     -- NUTRITION_RECALC_WINDOW_DAYS
  v_drift         numeric := NULL;
  v_recalc        boolean := false;
  v_reason        text;
BEGIN
  IF coalesce(p_logged_days, 0) < c_min_days THEN
    RETURN jsonb_build_object(
      'ok', true, 'recalc', false,
      'reason', 'insufficient_logged_days_' || coalesce(p_logged_days, 0),
      'drift_pct', NULL, 'drift_threshold', c_threshold,
      'logged_days', coalesce(p_logged_days, 0), 'window_days', c_window_days
    );
  END IF;

  IF p_current_tdee IS NOT NULL AND p_current_tdee > 0 THEN
    v_drift := abs(p_avg7_kcal - p_current_tdee) / p_current_tdee;
    IF v_drift < c_threshold THEN
      v_reason := 'drift_below_threshold';
      v_recalc := false;
    ELSE
      v_reason := 'drift_exceeds_threshold';
      v_recalc := true;
    END IF;
  ELSE
    -- No baseline target yet → adopt the observed average.
    v_reason := 'no_current_target';
    v_recalc := true;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'recalc', v_recalc,
    'reason', v_reason,
    'drift_pct', v_drift,
    'drift_threshold', c_threshold,
    'logged_days', p_logged_days,
    'window_days', c_window_days,
    'proposed', CASE WHEN v_recalc THEN jsonb_build_object(
        'tdee_target', floor(p_avg7_kcal + 0.5),
        'macro_p', CASE WHEN p_avg7_p IS NULL THEN NULL ELSE floor(p_avg7_p + 0.5) END,
        'macro_c', CASE WHEN p_avg7_c IS NULL THEN NULL ELSE floor(p_avg7_c + 0.5) END,
        'macro_f', CASE WHEN p_avg7_f IS NULL THEN NULL ELSE floor(p_avg7_f + 0.5) END
      ) ELSE NULL END
  );
END;
$function$;

COMMENT ON FUNCTION public.bbf_reconcile_macro_targets(numeric, numeric, int, numeric, numeric, numeric) IS
  'Weekly nutrition-target drift rule (8% threshold, 3 logged-day minimum, 7-day window) — same constants as bbf-midnight-haiku Sunday reconciliation; proposes the 7-day average as the new target. calculator-off-LLM wave 1.';

GRANT EXECUTE ON FUNCTION public.bbf_reconcile_macro_targets(numeric, numeric, int, numeric, numeric, numeric) TO anon, authenticated, service_role;
