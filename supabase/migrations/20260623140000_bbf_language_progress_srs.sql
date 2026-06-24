-- 20260623140000_bbf_language_progress_srs.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- 90-Day Language Mastery — cross-device persistence for the Vocab Gym.
-- Two tables, both vault-token gated via SECURITY DEFINER RPCs (RLS denies direct
-- access, exactly like bbf_daily_biometrics). athlete_id = bbf_users.id, resolved
-- from the caller's vault session token by public._bbf_uid_from_vault_token().

-- 1 · Per-mode game high scores + best streaks (Speed / Listen / Match / Sentence).
CREATE TABLE IF NOT EXISTS public.bbf_language_progress (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id  uuid NOT NULL REFERENCES public.bbf_users(id) ON DELETE CASCADE,
  mode        text NOT NULL,
  best_score  int  NOT NULL DEFAULT 0 CHECK (best_score  >= 0),
  best_streak int  NOT NULL DEFAULT 0 CHECK (best_streak >= 0),
  plays       int  NOT NULL DEFAULT 0 CHECK (plays >= 0),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_lang_progress UNIQUE (athlete_id, mode)
);

-- 2 · Per-term spaced repetition (Leitner boxes 1–5). One row per term the athlete
--     has been quizzed on; box rises on a correct answer, resets to 1 on a miss.
CREATE TABLE IF NOT EXISTS public.bbf_vocab_mastery (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id    uuid NOT NULL REFERENCES public.bbf_users(id) ON DELETE CASCADE,
  term          text NOT NULL,
  box_level     int  NOT NULL DEFAULT 1 CHECK (box_level BETWEEN 1 AND 5),
  correct       int  NOT NULL DEFAULT 0 CHECK (correct  >= 0),
  attempts      int  NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_reviewed timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_vocab_mastery UNIQUE (athlete_id, term)
);

-- Lock both down — only the SECURITY DEFINER RPCs below touch them.
ALTER TABLE public.bbf_language_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bbf_vocab_mastery     ENABLE ROW LEVEL SECURITY;

-- ── RPC · save a finished game's best score + streak (keeps the max, bumps plays) ──
CREATE OR REPLACE FUNCTION public.bbf_save_language_score(p_session_token text, p_mode text, p_score int, p_streak int)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid; v_bs int; v_bk int; v_pl int;
BEGIN
  v_uid := public._bbf_uid_from_vault_token(p_session_token);
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid_session'); END IF;
  IF p_mode IS NULL OR length(trim(p_mode)) = 0 THEN RETURN jsonb_build_object('ok', false, 'error', 'missing_mode'); END IF;
  INSERT INTO public.bbf_language_progress (athlete_id, mode, best_score, best_streak, plays, updated_at)
  VALUES (v_uid, trim(p_mode), GREATEST(coalesce(p_score,0),0), GREATEST(coalesce(p_streak,0),0), 1, now())
  ON CONFLICT (athlete_id, mode) DO UPDATE SET
    best_score  = GREATEST(public.bbf_language_progress.best_score,  GREATEST(coalesce(p_score,0),0)),
    best_streak = GREATEST(public.bbf_language_progress.best_streak, GREATEST(coalesce(p_streak,0),0)),
    plays       = public.bbf_language_progress.plays + 1,
    updated_at  = now()
  RETURNING best_score, best_streak, plays INTO v_bs, v_bk, v_pl;
  RETURN jsonb_build_object('ok', true, 'mode', trim(p_mode), 'best_score', v_bs, 'best_streak', v_bk, 'plays', v_pl);
END; $function$;

-- ── RPC · record one SRS attempt for a term (Leitner: +1 box on hit, reset to 1 on miss) ──
CREATE OR REPLACE FUNCTION public.bbf_record_vocab_attempt(p_session_token text, p_term text, p_correct boolean)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid; v_box int;
BEGIN
  v_uid := public._bbf_uid_from_vault_token(p_session_token);
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid_session'); END IF;
  IF p_term IS NULL OR length(trim(p_term)) = 0 THEN RETURN jsonb_build_object('ok', false, 'error', 'missing_term'); END IF;
  INSERT INTO public.bbf_vocab_mastery (athlete_id, term, box_level, correct, attempts, last_reviewed)
  VALUES (v_uid, trim(p_term), CASE WHEN p_correct THEN 2 ELSE 1 END, CASE WHEN p_correct THEN 1 ELSE 0 END, 1, now())
  ON CONFLICT (athlete_id, term) DO UPDATE SET
    box_level     = CASE WHEN p_correct THEN LEAST(5, public.bbf_vocab_mastery.box_level + 1) ELSE 1 END,
    correct       = public.bbf_vocab_mastery.correct + CASE WHEN p_correct THEN 1 ELSE 0 END,
    attempts      = public.bbf_vocab_mastery.attempts + 1,
    last_reviewed = now()
  RETURNING box_level INTO v_box;
  RETURN jsonb_build_object('ok', true, 'term', trim(p_term), 'box_level', v_box);
END; $function$;

-- ── RPC · load all progress for the signed-in athlete (game bests + mastery summary) ──
CREATE OR REPLACE FUNCTION public.bbf_get_language_progress(p_session_token text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid; v_scores jsonb; v_mastery jsonb;
BEGIN
  v_uid := public._bbf_uid_from_vault_token(p_session_token);
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid_session'); END IF;
  SELECT coalesce(jsonb_object_agg(mode, jsonb_build_object('best_score', best_score, 'best_streak', best_streak, 'plays', plays)), '{}'::jsonb)
    INTO v_scores FROM public.bbf_language_progress WHERE athlete_id = v_uid;
  SELECT jsonb_build_object(
    'terms',     count(*),
    'mastered',  count(*) FILTER (WHERE box_level >= 5),
    'reviewing', count(*) FILTER (WHERE box_level BETWEEN 2 AND 4),
    'learning',  count(*) FILTER (WHERE box_level = 1),
    'attempts',  coalesce(sum(attempts), 0),
    'correct',   coalesce(sum(correct), 0)
  ) INTO v_mastery FROM public.bbf_vocab_mastery WHERE athlete_id = v_uid;
  RETURN jsonb_build_object('ok', true, 'scores', v_scores, 'mastery', v_mastery);
END; $function$;
