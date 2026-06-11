-- ═══════════════════════════════════════════════════════════════════════════
-- BBF — SOVEREIGN BIOMETRIC LEDGER (Auto-Regulation Engine, data layer)
-- ═══════════════════════════════════════════════════════════════════════════
-- Rolling biometric ledger + daily protocol log for the Sovereign Auto-Regulation
-- Engine. The Android Health Connect bridge lands a day's vitals here
-- (bbf_daily_biometrics); the client-side readiness engine
-- (frontend/src/lib/bbf-readiness-engine.ts) computes the Sovereign Readiness
-- Score + protocol from the trailing series and logs the result
-- (bbf_daily_protocols). Deterministic end to end — NO LLM is involved, so the
-- model router (CLAUDE.md §4) intentionally does not appear anywhere in this flow.
--
-- ⚠ ORDERED-SPEC DEVIATION (disclosed): the directive specified
-- `athlete_id referencing auth.users`. This platform's athletes do NOT live in
-- auth.users (custom vault-session auth; auth.users holds only a handful of
-- service identities) — they live in public.bbf_users, which every adjacent
-- wearable table (bbf_wearable_readings, cardio layer) references and which
-- public._bbf_uid_from_vault_token() resolves session tokens to. An auth.users FK
-- would make every athlete insert fail. athlete_id therefore references
-- public.bbf_users(id).
--
-- SECURITY MODEL (identical to the wearable/ACWR layer): tables are RLS ENABLED
-- + FORCED with ZERO policies — no role reads/writes them directly. The ONLY
-- access path is the SECURITY DEFINER RPCs below, each gated by the athlete's
-- vault session token via public._bbf_uid_from_vault_token().
--
-- IDEMPOTENT by construction (IF NOT EXISTS / CREATE OR REPLACE).
--
-- DEPENDS ON: public.bbf_users(id), public._bbf_uid_from_vault_token(text).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Rolling biometric ledger — one row per (athlete, calendar day) ─────────
CREATE TABLE IF NOT EXISTS public.bbf_daily_biometrics (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id             uuid NOT NULL REFERENCES public.bbf_users(id) ON DELETE CASCADE,
  date                   date NOT NULL,
  hrv_ms                 numeric  CHECK (hrv_ms IS NULL OR hrv_ms >= 0),
  sleep_minutes          integer  CHECK (sleep_minutes IS NULL OR (sleep_minutes >= 0 AND sleep_minutes <= 2880)),
  active_calories_burned numeric  CHECK (active_calories_burned IS NULL OR (active_calories_burned >= 0 AND active_calories_burned <= 20000)),
  daily_steps            integer  CHECK (daily_steps IS NULL OR (daily_steps >= 0 AND daily_steps <= 200000)),
  created_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_daily_biometrics UNIQUE (athlete_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_biometrics_athlete_date
  ON public.bbf_daily_biometrics (athlete_id, date DESC);

-- ─── 2. Daily protocol log — the engine's computed directive per day ───────────
CREATE TABLE IF NOT EXISTS public.bbf_daily_protocols (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id               uuid NOT NULL REFERENCES public.bbf_users(id) ON DELETE CASCADE,
  date                     date NOT NULL,
  readiness_score          numeric CHECK (readiness_score IS NULL OR (readiness_score >= 0 AND readiness_score <= 100)),
  training_volume_modifier numeric NOT NULL DEFAULT 1.0 CHECK (training_volume_modifier >= 0 AND training_volume_modifier <= 2),
  carb_target_pct          numeric CHECK (carb_target_pct IS NULL OR (carb_target_pct >= 0 AND carb_target_pct <= 100)),
  fat_target_pct           numeric CHECK (fat_target_pct IS NULL OR (fat_target_pct >= 0 AND fat_target_pct <= 100)),
  -- Full engine verdict: { engine, mode, cardio, protein_target_pct, directives[] … }
  directive_log            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_daily_protocols UNIQUE (athlete_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_protocols_athlete_date
  ON public.bbf_daily_protocols (athlete_id, date DESC);

-- ─── 3. RLS: enabled + FORCED, zero policies (deny-all direct access) ──────────
ALTER TABLE public.bbf_daily_biometrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bbf_daily_biometrics FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.bbf_daily_protocols  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bbf_daily_protocols  FORCE  ROW LEVEL SECURITY;

-- ─── 4. Athlete-gated upsert: today's vitals in → trailing 28-day series out ───
-- The returned series is the engine's baseline substrate (HRV baseline + prior-day
-- strain), so the client computes readiness from REAL history in one round trip.
CREATE OR REPLACE FUNCTION public.bbf_upsert_daily_biometrics(p_session_token text, p_day jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_date    date;
  v_id      uuid;
  v_series  jsonb;
BEGIN
  v_user_id := public._bbf_uid_from_vault_token(p_session_token);
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_session');
  END IF;

  v_date := nullif(p_day->>'date', '')::date;
  IF v_date IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_date');
  END IF;

  INSERT INTO public.bbf_daily_biometrics
    (athlete_id, date, hrv_ms, sleep_minutes, active_calories_burned, daily_steps)
  VALUES (
    v_user_id,
    v_date,
    nullif(p_day->>'hrv_ms', '')::numeric,
    nullif(p_day->>'sleep_minutes', '')::int,
    nullif(p_day->>'active_calories_burned', '')::numeric,
    nullif(p_day->>'daily_steps', '')::int
  )
  ON CONFLICT (athlete_id, date) DO UPDATE SET
    hrv_ms                 = excluded.hrv_ms,
    sleep_minutes          = excluded.sleep_minutes,
    active_calories_burned = excluded.active_calories_burned,
    daily_steps            = excluded.daily_steps
  RETURNING id INTO v_id;

  -- Trailing 28 days (newest first), the upserted day included.
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'date', b.date, 'hrv_ms', b.hrv_ms, 'sleep_minutes', b.sleep_minutes,
           'active_calories_burned', b.active_calories_burned, 'daily_steps', b.daily_steps
         ) ORDER BY b.date DESC), '[]'::jsonb)
    INTO v_series
  FROM public.bbf_daily_biometrics b
  WHERE b.athlete_id = v_user_id
    AND b.date <= v_date
    AND b.date >  v_date - 28;

  RETURN jsonb_build_object('ok', true, 'biometric_id', v_id, 'series', v_series);
END;
$function$;

-- ─── 5. Athlete-gated protocol log — persists the engine's computed verdict ────
CREATE OR REPLACE FUNCTION public.bbf_log_daily_protocol(p_session_token text, p_protocol jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_date    date;
  v_score   numeric;
  v_vol     numeric;
  v_id      uuid;
BEGIN
  v_user_id := public._bbf_uid_from_vault_token(p_session_token);
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_session');
  END IF;

  v_date := nullif(p_protocol->>'date', '')::date;
  IF v_date IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_date');
  END IF;

  v_score := nullif(p_protocol->>'readiness_score', '')::numeric;
  IF v_score IS NOT NULL AND (v_score < 0 OR v_score > 100) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_score');
  END IF;

  v_vol := coalesce(nullif(p_protocol->>'training_volume_modifier', '')::numeric, 1.0);
  IF v_vol < 0 OR v_vol > 2 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_volume_modifier');
  END IF;

  INSERT INTO public.bbf_daily_protocols
    (athlete_id, date, readiness_score, training_volume_modifier,
     carb_target_pct, fat_target_pct, directive_log)
  VALUES (
    v_user_id,
    v_date,
    v_score,
    v_vol,
    nullif(p_protocol->>'carb_target_pct', '')::numeric,
    nullif(p_protocol->>'fat_target_pct', '')::numeric,
    coalesce(p_protocol->'directive_log', '{}'::jsonb)
  )
  ON CONFLICT (athlete_id, date) DO UPDATE SET
    readiness_score          = excluded.readiness_score,
    training_volume_modifier = excluded.training_volume_modifier,
    carb_target_pct          = excluded.carb_target_pct,
    fat_target_pct           = excluded.fat_target_pct,
    directive_log            = excluded.directive_log,
    created_at               = now();

  SELECT id INTO v_id FROM public.bbf_daily_protocols
   WHERE athlete_id = v_user_id AND date = v_date;

  RETURN jsonb_build_object('ok', true, 'protocol_id', v_id);
END;
$function$;

-- ─── 6. THE READ BOUNDARY — ledger + latest protocol for the hub's mount fetch ──
CREATE OR REPLACE FUNCTION public.bbf_get_biometric_ledger(p_session_token text, p_days integer DEFAULT 28)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id  uuid;
  v_days     integer := greatest(1, least(coalesce(p_days, 28), 90));
  v_series   jsonb;
  v_protocol jsonb;
BEGIN
  v_user_id := public._bbf_uid_from_vault_token(p_session_token);
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_session');
  END IF;

  SELECT coalesce(jsonb_agg(r ORDER BY r.date DESC), '[]'::jsonb)
    INTO v_series
  FROM (
    SELECT b.date, b.hrv_ms, b.sleep_minutes, b.active_calories_burned, b.daily_steps
      FROM public.bbf_daily_biometrics b
     WHERE b.athlete_id = v_user_id
     ORDER BY b.date DESC
     LIMIT v_days
  ) r;

  SELECT to_jsonb(q) INTO v_protocol
  FROM (
    SELECT p.date, p.readiness_score, p.training_volume_modifier,
           p.carb_target_pct, p.fat_target_pct, p.directive_log, p.created_at
      FROM public.bbf_daily_protocols p
     WHERE p.athlete_id = v_user_id
     ORDER BY p.date DESC
     LIMIT 1
  ) q;

  RETURN jsonb_build_object(
    'ok', true,
    'as_of', current_date,
    'series', v_series,
    'latest_protocol', coalesce(v_protocol, 'null'::jsonb)
  );
END;
$function$;

-- ─── 7. Grants — token-gated RPCs callable with the anon key; nothing else ──────
REVOKE ALL ON FUNCTION public.bbf_upsert_daily_biometrics(text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bbf_log_daily_protocol(text, jsonb)      FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bbf_get_biometric_ledger(text, integer)  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bbf_upsert_daily_biometrics(text, jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.bbf_log_daily_protocol(text, jsonb)      TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.bbf_get_biometric_ledger(text, integer)  TO anon, authenticated, service_role;
