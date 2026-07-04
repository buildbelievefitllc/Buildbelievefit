-- ═══════════════════════════════════════════════════════════════════════════
-- BBF 90-Day Language Mastery · Closed-Loop Fluency Engine — substrate completion
-- ───────────────────────────────────────────────────────────────────────────
-- The relational substrate largely exists in prod (bbf_language_profiles ·
-- bbf_language_session_history · bbf_pimsleur_progress · bbf_immersion_sessions/
-- turns · bbf_vocab_mastery), and the Polyglot Sentinel (bbf-language-sentinel)
-- is deployed with its nightly 02:00 UTC cron. This migration completes the loop:
--
--   1. THE GRAM STANDARD (§0.1, enforced at the DATABASE): a CHECK constraint on
--      bbf_linguist_cue_ledger.translation rejects any stored translation carrying
--      a kilogram/pound lexeme (kilo/kg/lb/libra + the PT 'quilo' family + 'pound').
--      Mass crosses the language module ONLY as the {load_g} integer-gram slot.
--   2. bbf_log_language_attempt — the append-only ledger writer the three Mastery
--      Views call (Vocab Forge · The Path · Audio Dojo). Appends the session row
--      AND closes the loop on bbf_language_profiles: daily streak (consecutive-day
--      qualify), fluency EWMA (α=0.30), updated_at.
--   3. bbf_save_pimsleur_checkpoint / bbf_get_language_dashboard — the Audio Dojo
--      resume tracker + the one-read profile/checkpoint hydration for the Lab tab.
--
-- All vault-token gated (the same _bbf_uid_from_vault_token gate as the gym RPCs).
-- Additive + idempotent.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1 · THE GRAM STANDARD — database-level lexeme rejection ───────────────────
alter table public.bbf_linguist_cue_ledger
  drop constraint if exists bbf_cue_translation_gram_standard;
alter table public.bbf_linguist_cue_ledger
  add constraint bbf_cue_translation_gram_standard
  check (translation !~* '\m(kilo\w*|kgs?|lbs?|libras?|quilo\w*|pounds?)\M');

comment on constraint bbf_cue_translation_gram_standard on public.bbf_linguist_cue_ledger is
  'THE GRAM STANDARD (§0.1): a stored translation may never carry a kilogram/pound lexeme (kilo·kg·lb·libra·quilo·pound families). Mass crosses the language module only as the {load_g} integer-gram slot.';

-- ─── 2 · bbf_log_language_attempt — Mastery View ledger writer + profile loop ──
create or replace function public.bbf_log_language_attempt(
  p_session_token text,
  p_language      text,
  p_module        text,               -- vocab_gym | drill | pimsleur | immersion | phrase_kit
  p_items_total   int default 0,
  p_items_correct int default 0,
  p_fluency_score numeric default null, -- 0-100 for this session
  p_duration_s    int default null,
  p_items         jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid     uuid;
  v_lang    text := public._bbf_norm_taught_lang(p_language);
  v_module  text := case when p_module in ('vocab_gym','pimsleur','immersion','drill','phrase_kit','linguist','intention') then p_module else 'drill' end;
  v_score   numeric := least(greatest(coalesce(p_fluency_score,
                        case when coalesce(p_items_total,0) > 0
                             then round(100.0 * coalesce(p_items_correct,0) / p_items_total)
                             else 0 end), 0), 100);
  v_today   date := (now() at time zone 'utc')::date;
  v_phase   int;
  v_streak  int;
  v_ewma    numeric;
begin
  v_uid := public._bbf_uid_from_vault_token(p_session_token);
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'invalid_session'); end if;

  -- Carry the athlete's current phase (history.phase is NOT NULL; default Phase 1).
  select phase into v_phase from public.bbf_language_profiles where athlete_id = v_uid and language = v_lang;
  v_phase := coalesce(v_phase, 1);

  -- Append-only session ledger row.
  insert into public.bbf_language_session_history
    (athlete_id, language, module, phase, started_at, duration_s, items_total, items_correct, fluency_score, items)
  values
    (v_uid, v_lang, v_module, v_phase, now(), p_duration_s, coalesce(p_items_total,0), coalesce(p_items_correct,0), v_score, coalesce(p_items,'[]'::jsonb));

  -- Close the loop on the profile: consecutive-day streak + fluency EWMA (α=0.30).
  insert into public.bbf_language_profiles (athlete_id, language, phase, streak_current, streak_best, last_qualified_on, fluency_ewma, updated_at)
  values (v_uid, v_lang, 1, 1, 1, v_today, v_score, now())
  on conflict (athlete_id, language) do update set
    streak_current = case
      when public.bbf_language_profiles.last_qualified_on = v_today then public.bbf_language_profiles.streak_current
      when public.bbf_language_profiles.last_qualified_on = v_today - 1 then public.bbf_language_profiles.streak_current + 1
      else 1 end,
    streak_best = greatest(public.bbf_language_profiles.streak_best,
      case
        when public.bbf_language_profiles.last_qualified_on = v_today then public.bbf_language_profiles.streak_current
        when public.bbf_language_profiles.last_qualified_on = v_today - 1 then public.bbf_language_profiles.streak_current + 1
        else 1 end),
    last_qualified_on = v_today,
    fluency_ewma = round(coalesce(public.bbf_language_profiles.fluency_ewma, v_score) * 0.70 + v_score * 0.30, 2),
    updated_at = now()
  returning streak_current, fluency_ewma into v_streak, v_ewma;

  return jsonb_build_object('ok', true, 'language', v_lang, 'module', v_module,
                            'fluency_score', v_score, 'streak_current', v_streak, 'fluency_ewma', v_ewma);
end;
$function$;

-- ─── 3 · bbf_save_pimsleur_checkpoint — the Audio Dojo resume tracker ──────────
create or replace function public.bbf_save_pimsleur_checkpoint(
  p_session_token text,
  p_language      text,
  p_lesson        int,
  p_fragment_seq  int default 0,
  p_position_ms   int default 0,
  p_listened_ms   int default 0,
  p_status        text default 'in_progress'   -- in_progress | completed
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid    uuid;
  v_lang   text := public._bbf_norm_taught_lang(p_language);
  v_lesson int  := greatest(coalesce(p_lesson, 1), 1);
  v_status text := case when p_status in ('in_progress','completed') then p_status else 'in_progress' end;
begin
  v_uid := public._bbf_uid_from_vault_token(p_session_token);
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'invalid_session'); end if;

  insert into public.bbf_pimsleur_progress
    (athlete_id, language, lesson_number, status, last_fragment_seq, last_position_ms, listened_ms_total, first_started_at, completed_at, updated_at)
  values
    (v_uid, v_lang, v_lesson, v_status, greatest(coalesce(p_fragment_seq,0),0), greatest(coalesce(p_position_ms,0),0),
     greatest(coalesce(p_listened_ms,0),0), now(), case when v_status = 'completed' then now() end, now())
  on conflict (athlete_id, language, lesson_number) do update set
    status            = v_status,
    last_fragment_seq = greatest(coalesce(excluded.last_fragment_seq,0), 0),
    last_position_ms  = greatest(coalesce(excluded.last_position_ms,0), 0),
    listened_ms_total = public.bbf_pimsleur_progress.listened_ms_total + greatest(coalesce(p_listened_ms,0),0),
    completed_at      = case when v_status = 'completed' then now() else public.bbf_pimsleur_progress.completed_at end,
    updated_at        = now();

  return jsonb_build_object('ok', true, 'language', v_lang, 'lesson', v_lesson, 'status', v_status);
end;
$function$;

-- ─── 4 · bbf_get_language_dashboard — one-read Lab hydration ───────────────────
create or replace function public.bbf_get_language_dashboard(
  p_session_token text,
  p_language      text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid  uuid;
  v_lang text := public._bbf_norm_taught_lang(p_language);
  v_prof jsonb;
  v_pim  jsonb;
begin
  v_uid := public._bbf_uid_from_vault_token(p_session_token);
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'invalid_session'); end if;

  select to_jsonb(x) into v_prof from (
    select phase, streak_current, streak_best, last_qualified_on, fluency_ewma, vocab_mastered, pimsleur_done, weak_clusters
      from public.bbf_language_profiles where athlete_id = v_uid and language = v_lang limit 1
  ) x;

  select to_jsonb(y) into v_pim from (
    select lesson_number, status, last_fragment_seq, last_position_ms, listened_ms_total
      from public.bbf_pimsleur_progress where athlete_id = v_uid and language = v_lang
     order by lesson_number desc limit 1
  ) y;

  return jsonb_build_object('ok', true, 'language', v_lang, 'profile', v_prof, 'pimsleur', v_pim);
end;
$function$;

grant execute on function public.bbf_log_language_attempt(text, text, text, int, int, numeric, int, jsonb) to anon, authenticated, service_role;
grant execute on function public.bbf_save_pimsleur_checkpoint(text, text, int, int, int, int, text)      to anon, authenticated, service_role;
grant execute on function public.bbf_get_language_dashboard(text, text)                                  to anon, authenticated, service_role;
