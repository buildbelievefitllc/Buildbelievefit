-- ═══════════════════════════════════════════════════════════════════════════
-- BBF Language Lab · SHADOW + CLINIC modules — attempt-ledger whitelist widening
-- ───────────────────────────────────────────────────────────────────────────
-- Fable Fleet Sync wave 2. Two new closed-loop modules join the session ledger:
--   shadow — the Echo Chamber (line-by-line shadowing of the day's Fables scene:
--            narrator TTS → on-device SpeechRecognition → word-diff score).
--   clinic — the Grammar Clinic (weak-cluster targeted micro-drills; reads the
--            profile's weak_clusters that the Immersion engine already rolls up).
--
-- Two synchronized whitelists gate module values — BOTH must widen together:
--   1. the CHECK constraint on bbf_language_session_history.module
--   2. the coercing CASE inside bbf_log_language_attempt (unknown → 'drill')
--
-- The function body below is a faithful copy of the LIVE production definition
-- (pulled via pg_get_functiondef on 2026-07-17 — this repo's migration history
-- is drift-prone, see DATABASE_SAFETY.md; never trust the file over the catalog)
-- with ONLY the whitelist line changed. Applied via apply_migration.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1 · widen the history table's module CHECK ────────────────────────────────
alter table public.bbf_language_session_history
  drop constraint if exists bbf_language_session_history_module_check;
alter table public.bbf_language_session_history
  add constraint bbf_language_session_history_module_check
  check (module = any (array['vocab_gym'::text, 'pimsleur'::text, 'immersion'::text, 'drill'::text, 'phrase_kit'::text, 'linguist'::text, 'intention'::text, 'shadow'::text, 'clinic'::text]));

-- ─── 2 · widen the RPC's coercing whitelist (live-def copy, one line changed) ──
create or replace function public.bbf_log_language_attempt(
  p_session_token text,
  p_language      text,
  p_module        text,               -- vocab_gym | pimsleur | immersion | drill | phrase_kit | linguist | intention | shadow | clinic
  p_items_total   integer default 0,
  p_items_correct integer default 0,
  p_fluency_score numeric default null::numeric,
  p_duration_s    integer default null::integer,
  p_items         jsonb   default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid     uuid;
  v_lang    text := public._bbf_norm_taught_lang(p_language);
  v_module  text := case when p_module in ('vocab_gym','pimsleur','immersion','drill','phrase_kit','linguist','intention','shadow','clinic') then p_module else 'drill' end;
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

  select phase into v_phase from public.bbf_language_profiles where athlete_id = v_uid and language = v_lang;
  v_phase := coalesce(v_phase, 1);

  insert into public.bbf_language_session_history
    (athlete_id, language, module, phase, started_at, duration_s, items_total, items_correct, fluency_score, items)
  values
    (v_uid, v_lang, v_module, v_phase, now(), p_duration_s, coalesce(p_items_total,0), coalesce(p_items_correct,0), v_score, coalesce(p_items,'[]'::jsonb));

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

  return jsonb_build_object('ok', true, 'language', v_lang, 'module', v_module, 'phase', v_phase,
                            'fluency_score', v_score, 'streak_current', v_streak, 'fluency_ewma', v_ewma);
end;
$function$;

comment on function public.bbf_log_language_attempt(text, text, text, int, int, numeric, int, jsonb) is
  'Language Lab · append-only session ledger + streak/EWMA loop. Modules: vocab_gym|pimsleur|immersion|drill|phrase_kit|linguist|intention|shadow|clinic (unknown coerces to drill). Vault-token gated.';
