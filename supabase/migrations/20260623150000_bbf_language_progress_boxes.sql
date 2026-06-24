-- 20260623150000_bbf_language_progress_boxes.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Adaptive SRS: bbf_get_language_progress also returns a per-term box map so the
-- Vocab Gym can weight question selection toward weak/unseen terms (Leitner-style
-- review). Additive only — the existing { ok, scores, mastery } shape is unchanged;
-- a new `boxes` { term: box_level } object is added.
CREATE OR REPLACE FUNCTION public.bbf_get_language_progress(p_session_token text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid; v_scores jsonb; v_mastery jsonb; v_boxes jsonb;
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
  SELECT coalesce(jsonb_object_agg(term, box_level), '{}'::jsonb)
    INTO v_boxes FROM public.bbf_vocab_mastery WHERE athlete_id = v_uid;
  RETURN jsonb_build_object('ok', true, 'scores', v_scores, 'mastery', v_mastery, 'boxes', v_boxes);
END; $function$;
