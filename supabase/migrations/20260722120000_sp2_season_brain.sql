-- ═══════════════════════════════════════════════════════════════════════════
-- SP-2 · SEASON BRAIN — game calendar, calendar-driven season state, and the
--        athlete-week override layer the weekly taper pass writes into.
-- ═══════════════════════════════════════════════════════════════════════════
-- Today "in-season" is a manual toggle and no engine knows when game day is.
-- This migration gives the platform a real season model:
--
--   • bbf_athlete_season — one row per athlete: season window + practice load.
--   • bbf_athlete_games  — upcoming game/competition dates (guardian/coach fed).
--   • bbf_set_my_season(uid, token, payload) — token-gated writer (the athlete/
--     guardian sets the season from the Sports Hub; coach can drive the same
--     RPC from the dossier later). Replaces FUTURE games only — history is kept.
--   • bbf_get_season_state(user_id) — deterministic season truth: in_season,
--     next game date, days-to-game. Zero AI, zero cost.
--   • bbf_athlete_week_overrides — the ONLY write target the Season Brain's
--     approved taper proposals land in: per-athlete, per-week jsonb overlay
--     (day focus notes + volume trims) merged into the served catalog block by
--     bbf_get_my_sport_block. AI never mutates the catalog or the protocol —
--     it proposes an overlay; founder approval writes it; it expires with its
--     week. (CALCULATOR-OFF-LLM: deterministic clamps at apply time.)
--   • bbf_apply_season_adjustment(p_action_id) — one-tap applier for
--     SEASON_TAPER Action-Inbox cards (service_role only). Volume multipliers
--     clamped to [0.5, 1.0] — a taper can only reduce, never add load.
--   • bbf_get_my_sport_block — REPLACED with override-aware + season-aware
--     version (adds `season` block + merges the current week's overlay).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.bbf_athlete_season (
  user_id       uuid PRIMARY KEY REFERENCES public.bbf_users(id) ON DELETE CASCADE,
  season_start  date,
  season_end    date,
  practice_days_per_week integer CHECK (practice_days_per_week BETWEEN 0 AND 7),
  sport         text,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    text NOT NULL DEFAULT 'athlete'   -- 'athlete' | 'guardian' | 'coach'
);

CREATE TABLE IF NOT EXISTS public.bbf_athlete_games (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.bbf_users(id) ON DELETE CASCADE,
  game_date  date NOT NULL,
  label      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, game_date)
);
CREATE INDEX IF NOT EXISTS bbf_athlete_games_next_idx ON public.bbf_athlete_games (user_id, game_date);

CREATE TABLE IF NOT EXISTS public.bbf_athlete_week_overrides (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.bbf_users(id) ON DELETE CASCADE,
  week_start date NOT NULL,                       -- Monday of the ISO week the overlay covers
  overrides  jsonb NOT NULL,                      -- { days: { "Day 5": { focus_note, volume_multiplier } }, rationale }
  source     text NOT NULL DEFAULT 'season_brain',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start, source)
);

ALTER TABLE public.bbf_athlete_season ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bbf_athlete_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bbf_athlete_week_overrides ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.bbf_athlete_season, public.bbf_athlete_games, public.bbf_athlete_week_overrides
  FROM public, anon, authenticated;

COMMENT ON TABLE public.bbf_athlete_week_overrides IS
  'SP-2 · founder-approved Season Brain weekly overlays on the served training week. AI proposes; bbf_apply_season_adjustment writes with deterministic clamps; bbf_get_my_sport_block merges; rows are inert once their week passes.';

-- ── Token-gated season/games writer (athlete/guardian from the Sports Hub) ──
CREATE OR REPLACE FUNCTION public.bbf_set_my_season(
  p_uid           text,
  p_session_token text,
  p_payload       jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_id uuid;
  v_start   date;
  v_end     date;
  v_days    integer;
  v_games   jsonb;
  v_game    text;
  v_count   integer := 0;
BEGIN
  IF p_session_token IS NULL OR length(p_session_token) = 0 THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_session');
  END IF;
  SELECT s.user_id INTO v_user_id
    FROM public.bbf_vault_sessions s
    JOIN public.bbf_users u ON u.id = s.user_id AND u.deleted_at IS NULL
   WHERE s.token::text = p_session_token AND s.expires_at > now()
   LIMIT 1;
  IF v_user_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_session');
  END IF;

  BEGIN
    v_start := nullif(p_payload ->> 'season_start', '')::date;
    v_end   := nullif(p_payload ->> 'season_end', '')::date;
  EXCEPTION WHEN others THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_dates');
  END;
  IF v_start IS NOT NULL AND v_end IS NOT NULL AND v_end < v_start THEN
    RETURN json_build_object('ok', false, 'error', 'season_end_before_start');
  END IF;
  v_days := least(7, greatest(0, coalesce(nullif(p_payload ->> 'practice_days_per_week', '')::integer, 0)));

  INSERT INTO public.bbf_athlete_season (user_id, season_start, season_end, practice_days_per_week, sport, updated_at, updated_by)
  VALUES (v_user_id, v_start, v_end, v_days,
          left(coalesce(p_payload ->> 'sport', ''), 60),
          now(), CASE WHEN (p_payload ->> 'updated_by') IN ('guardian','coach') THEN p_payload ->> 'updated_by' ELSE 'athlete' END)
  ON CONFLICT (user_id) DO UPDATE
    SET season_start = excluded.season_start,
        season_end = excluded.season_end,
        practice_days_per_week = excluded.practice_days_per_week,
        sport = excluded.sport,
        updated_at = now(),
        updated_by = excluded.updated_by;

  -- Replace FUTURE games only (cap 30 — a season schedule, not a data dump).
  v_games := p_payload -> 'games';
  IF v_games IS NOT NULL AND jsonb_typeof(v_games) = 'array' THEN
    DELETE FROM public.bbf_athlete_games WHERE user_id = v_user_id AND game_date >= current_date;
    FOR v_game IN SELECT value #>> '{}' FROM jsonb_array_elements(v_games) LIMIT 30 LOOP
      BEGIN
        IF v_game::date >= current_date THEN
          INSERT INTO public.bbf_athlete_games (user_id, game_date)
          VALUES (v_user_id, v_game::date)
          ON CONFLICT (user_id, game_date) DO NOTHING;
          v_count := v_count + 1;
        END IF;
      EXCEPTION WHEN others THEN
        CONTINUE; -- skip unparseable entries; never fail the whole write
      END;
    END LOOP;
  END IF;

  RETURN json_build_object('ok', true, 'games_saved', v_count);
END;
$function$;

REVOKE ALL ON FUNCTION public.bbf_set_my_season(text, text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.bbf_set_my_season(text, text, jsonb) TO anon, authenticated, service_role;

-- ── Deterministic season truth ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bbf_get_season_state(p_user_id uuid)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT json_build_object(
    'has_season', s.user_id IS NOT NULL,
    'in_season', coalesce(current_date BETWEEN s.season_start AND s.season_end, false),
    'season_start', s.season_start,
    'season_end', s.season_end,
    'practice_days_per_week', s.practice_days_per_week,
    'next_game_date', g.game_date,
    'days_to_next_game', CASE WHEN g.game_date IS NULL THEN NULL ELSE (g.game_date - current_date) END
  )
  FROM (SELECT 1) one
  LEFT JOIN public.bbf_athlete_season s ON s.user_id = p_user_id
  LEFT JOIN LATERAL (
    SELECT game_date FROM public.bbf_athlete_games
     WHERE user_id = p_user_id AND game_date >= current_date
     ORDER BY game_date LIMIT 1
  ) g ON true;
$function$;

REVOKE ALL ON FUNCTION public.bbf_get_season_state(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bbf_get_season_state(uuid) TO service_role;

-- ── One-tap applier for SEASON_TAPER proposals (deterministic clamps) ───────
CREATE OR REPLACE FUNCTION public.bbf_apply_season_adjustment(p_action_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_card    record;
  v_prop    jsonb;
  v_user_id uuid;
  v_week    date;
  v_days    jsonb := '{}'::jsonb;
  v_key     text;
  v_val     jsonb;
  v_mult    numeric;
BEGIN
  SELECT * INTO v_card
    FROM public.coach_action_inbox
   WHERE id = p_action_id AND status = 'PENDING' AND type = 'SEASON_TAPER'
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'not_found_or_processed');
  END IF;

  v_prop := coalesce(v_card.proposed_plan_modification -> 'season_taper', '{}'::jsonb);
  v_user_id := nullif(v_prop ->> 'user_id', '')::uuid;
  BEGIN
    v_week := nullif(v_prop ->> 'week_start', '')::date;
  EXCEPTION WHEN others THEN
    v_week := NULL;
  END;
  IF v_user_id IS NULL OR v_week IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_payload');
  END IF;

  -- Deterministic clamp pass: only "Day 1".."Day 7" keys survive; volume
  -- multipliers clamp to [0.5, 1.0] (a taper reduces, never adds); focus
  -- notes cap at 200 chars. AI proposed it; this code disposes.
  FOR v_key, v_val IN SELECT key, value FROM jsonb_each(coalesce(v_prop -> 'days', '{}'::jsonb)) LOOP
    IF v_key !~ '^Day [1-7]$' THEN CONTINUE; END IF;
    v_mult := NULL;
    BEGIN
      v_mult := (v_val ->> 'volume_multiplier')::numeric;
    EXCEPTION WHEN others THEN
      v_mult := NULL;
    END;
    v_days := jsonb_set(v_days, ARRAY[v_key], jsonb_build_object(
      'focus_note', left(coalesce(v_val ->> 'focus_note', ''), 200),
      'volume_multiplier', CASE WHEN v_mult IS NULL THEN NULL ELSE round(least(1.0, greatest(0.5, v_mult)), 2) END
    ), true);
  END LOOP;

  INSERT INTO public.bbf_athlete_week_overrides (user_id, week_start, overrides, source)
  VALUES (v_user_id, v_week,
          jsonb_build_object('days', v_days, 'rationale', left(coalesce(v_prop ->> 'rationale', ''), 500)),
          'season_brain')
  ON CONFLICT (user_id, week_start, source) DO UPDATE
    SET overrides = excluded.overrides, created_at = now();

  UPDATE public.coach_action_inbox
     SET status = 'APPROVED', processed_at = now()
   WHERE id = p_action_id;

  RETURN json_build_object('ok', true, 'applied', 'season_taper', 'user_id', v_user_id, 'week_start', v_week);
END;
$function$;

REVOKE ALL ON FUNCTION public.bbf_apply_season_adjustment(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bbf_apply_season_adjustment(uuid) TO service_role;

-- ── bbf_get_my_sport_block v2 — season-aware + override-merging ─────────────
CREATE OR REPLACE FUNCTION public.bbf_get_my_sport_block(
  p_uid           text,
  p_session_token text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_id  uuid;
  v_sport    text;
  v_position text;
  v_email    text;
  v_tier     text := 'youth';
  v_phase    integer := 1;
  v_proto    text;
  v_row      record;
  v_season   json;
  v_override jsonb;
  v_week     date := date_trunc('week', current_date)::date;
BEGIN
  IF p_session_token IS NULL OR length(p_session_token) = 0 THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_session');
  END IF;

  SELECT s.user_id, u.sport, u."position", u.email
    INTO v_user_id, v_sport, v_position, v_email
    FROM public.bbf_vault_sessions s
    JOIN public.bbf_users u ON u.id = s.user_id AND u.deleted_at IS NULL
   WHERE s.token::text = p_session_token
     AND s.expires_at > now()
   LIMIT 1;
  IF v_user_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_session');
  END IF;

  SELECT coalesce(current_tier, 'youth') INTO v_tier
    FROM public.athlete_profiles WHERE user_id = v_user_id
    ORDER BY id LIMIT 1;
  v_tier := coalesce(v_tier, 'youth');

  SELECT ac.sports_protocol INTO v_proto
    FROM public.bbf_active_clients ac WHERE ac.vault_email = v_email LIMIT 1;
  IF v_proto IS NOT NULL THEN
    BEGIN
      v_phase := greatest(1, least(3, coalesce((v_proto::jsonb ->> 'phase_number')::integer, 1)));
    EXCEPTION WHEN others THEN
      v_phase := 1;
    END;
  END IF;

  v_season := public.bbf_get_season_state(v_user_id);

  SELECT overrides INTO v_override
    FROM public.bbf_athlete_week_overrides
   WHERE user_id = v_user_id AND week_start = v_week AND source = 'season_brain'
   ORDER BY created_at DESC LIMIT 1;

  SELECT * INTO v_row
    FROM public.bbf_sport_block_catalog c
   WHERE c.sport = public._bbf_normalize_sport_key(v_sport)
     AND c.phase = v_phase
     AND c.tier = v_tier
     AND c.status = 'approved'
     AND c.position_group IN (lower(coalesce(v_position, 'general')), 'general')
   ORDER BY CASE WHEN c.position_group = lower(coalesce(v_position, 'general')) THEN 0 ELSE 1 END
   LIMIT 1;

  IF v_row.id IS NULL THEN
    RETURN json_build_object('ok', true, 'block', NULL, 'phase', v_phase, 'tier', v_tier,
                             'season', v_season, 'week_overrides', v_override);
  END IF;

  RETURN json_build_object(
    'ok', true,
    'block', v_row.block,
    'phase', v_phase,
    'tier', v_tier,
    'sport', v_row.sport,
    'position_group', v_row.position_group,
    'catalog_id', v_row.id,
    'season', v_season,
    'week_overrides', v_override
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.bbf_get_my_sport_block(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.bbf_get_my_sport_block(text, text) TO anon, authenticated, service_role;

-- ── Sunday cron — the weekly Season Brain pass (18:00 UTC). The admin token is
--    injected from Vault INSIDE the database; it never leaves Postgres. ────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bbf-season-brain-weekly') THEN
    PERFORM cron.unschedule('bbf-season-brain-weekly');
  END IF;
END $$;

SELECT cron.schedule(
  'bbf-season-brain-weekly',
  '0 18 * * 0',
  $job$
  SELECT net.http_post(
    url     := 'https://ihclbceghxpuawymlvgi.supabase.co/functions/v1/bbf-season-brain',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-BBF-Admin-Token', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'BBF_COACH_AGENT_TOKEN' LIMIT 1)
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 240000
  );
  $job$
);
