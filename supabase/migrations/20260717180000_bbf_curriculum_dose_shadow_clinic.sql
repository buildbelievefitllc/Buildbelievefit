-- ═══════════════════════════════════════════════════════════════════════════
-- BBF Language Lab · CURRICULUM DOSE EXPANSION — Echo Chamber + Grammar Clinic
-- join the daily dose (Fable Fleet Sync · wave 4)
-- ───────────────────────────────────────────────────────────────────────────
-- The Guided Track's daily dose was frozen at 3 items (10 vocab · 1 syntax ·
-- 1 video) from before Echo Chamber (shadowing) and Grammar Clinic
-- (weak-cluster drills) existed. This widens it to 5: vocab · syntax · video ·
-- shadow · clinic — one completed Echo Chamber run and one completed Grammar
-- Clinic session per day, alongside the existing three.
--
-- METRIC NAMING: the dose metric is 'shadow' (not 'echo') — it matches the
-- module name Echo Chamber already writes to bbf_language_session_history
-- (20260717150000_bbf_shadow_clinic_modules.sql), so one vocabulary spans
-- both ledgers. 'clinic' already matches on both sides.
--
-- BACKWARD COMPATIBILITY: existing rows get echo_done/clinic_done = 0 via
-- column default; a day already completed_at-stamped under the OLD 3-item
-- dose stays completed (completed_at is never retroactively cleared) — no
-- athlete is punished for a rule change made after they cleared the day.
--
-- Function bodies below are full replacements built from the LIVE catalog
-- definitions (pg_get_functiondef, verified 2026-07-17 — this repo's file
-- history is drift-prone, see DATABASE_SAFETY.md) with the dose widened.
-- Applied via apply_migration; additive + idempotent.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1 · widen the day ledger with the two new dose counters ──────────────────
alter table public.bbf_curriculum_days
  add column if not exists echo_done   integer not null default 0,
  add column if not exists clinic_done integer not null default 0;

comment on column public.bbf_curriculum_days.echo_done is
  'Echo Chamber (shadowing) completed runs today — dose metric "shadow".';
comment on column public.bbf_curriculum_days.clinic_done is
  'Grammar Clinic completed sessions today — dose metric "clinic".';

-- ─── 2 · bbf_get_curriculum_track — 5-item hydration ───────────────────────────
create or replace function public.bbf_get_curriculum_track(
  p_session_token text,
  p_language      text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid   uuid;
  v_lang  text := public._bbf_norm_taught_lang(p_language);
  v_done  int;
  v_day   int;
  v_row   record;
begin
  v_uid := public._bbf_uid_from_vault_token(p_session_token);
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'invalid_session'); end if;

  select count(*) into v_done
    from public.bbf_curriculum_days
   where athlete_id = v_uid and language = v_lang and completed_at is not null;
  v_day := least(v_done + 1, 90);

  select vocab_done, syntax_done, video_done, echo_done, clinic_done, completed_at into v_row
    from public.bbf_curriculum_days
   where athlete_id = v_uid and language = v_lang and day_number = v_day;

  return jsonb_build_object(
    'ok', true, 'language', v_lang,
    'current_day', v_day,
    'days_completed', v_done,
    'requirements', jsonb_build_object('vocab', 10, 'syntax', 1, 'video', 1, 'shadow', 1, 'clinic', 1),
    'progress', jsonb_build_object(
      'vocab',  coalesce(v_row.vocab_done, 0),
      'syntax', coalesce(v_row.syntax_done, 0),
      'video',  coalesce(v_row.video_done, 0),
      'shadow', coalesce(v_row.echo_done, 0),
      'clinic', coalesce(v_row.clinic_done, 0)
    ),
    'day_complete', v_row.completed_at is not null
  );
end;
$function$;

-- ─── 3 · bbf_log_curriculum_progress — 5-item dose counter + unlock writer ─────
create or replace function public.bbf_log_curriculum_progress(
  p_session_token text,
  p_language      text,
  p_metric        text,               -- vocab | syntax | video | shadow | clinic
  p_count         int default 1
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid      uuid;
  v_lang     text := public._bbf_norm_taught_lang(p_language);
  v_metric   text := case when p_metric in ('vocab','syntax','video','shadow','clinic') then p_metric else null end;
  v_n        int  := least(greatest(coalesce(p_count, 1), 1), 50);
  v_done     int;
  v_day      int;
  v_row      record;
  v_unlocked boolean := false;
begin
  v_uid := public._bbf_uid_from_vault_token(p_session_token);
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'invalid_session'); end if;
  if v_metric is null then return jsonb_build_object('ok', false, 'error', 'invalid_metric'); end if;

  select count(*) into v_done
    from public.bbf_curriculum_days
   where athlete_id = v_uid and language = v_lang and completed_at is not null;
  v_day := least(v_done + 1, 90);

  insert into public.bbf_curriculum_days (athlete_id, language, day_number,
    vocab_done, syntax_done, video_done, echo_done, clinic_done, updated_at)
  values (v_uid, v_lang, v_day,
    case when v_metric = 'vocab'  then v_n else 0 end,
    case when v_metric = 'syntax' then v_n else 0 end,
    case when v_metric = 'video'  then v_n else 0 end,
    case when v_metric = 'shadow' then v_n else 0 end,
    case when v_metric = 'clinic' then v_n else 0 end,
    now())
  on conflict (athlete_id, language, day_number) do update set
    vocab_done  = public.bbf_curriculum_days.vocab_done  + case when v_metric = 'vocab'  then v_n else 0 end,
    syntax_done = public.bbf_curriculum_days.syntax_done + case when v_metric = 'syntax' then v_n else 0 end,
    video_done  = public.bbf_curriculum_days.video_done  + case when v_metric = 'video'  then v_n else 0 end,
    echo_done   = public.bbf_curriculum_days.echo_done   + case when v_metric = 'shadow' then v_n else 0 end,
    clinic_done = public.bbf_curriculum_days.clinic_done + case when v_metric = 'clinic' then v_n else 0 end,
    updated_at  = now()
  returning vocab_done, syntax_done, video_done, echo_done, clinic_done, completed_at into v_row;

  -- The daily dose (10 vocab · 1 syntax · 1 video · 1 shadow · 1 clinic) all met → stamp the unlock flag.
  if v_row.completed_at is null
     and v_row.vocab_done >= 10 and v_row.syntax_done >= 1 and v_row.video_done >= 1
     and v_row.echo_done >= 1 and v_row.clinic_done >= 1 then
    update public.bbf_curriculum_days
       set completed_at = now(), updated_at = now()
     where athlete_id = v_uid and language = v_lang and day_number = v_day;
    v_unlocked := v_day < 90;
    v_done := v_done + 1;
    v_day := least(v_done + 1, 90);
  end if;

  return jsonb_build_object(
    'ok', true, 'language', v_lang,
    'current_day', v_day,
    'days_completed', v_done,
    'requirements', jsonb_build_object('vocab', 10, 'syntax', 1, 'video', 1, 'shadow', 1, 'clinic', 1),
    'progress', case when v_unlocked
      then jsonb_build_object('vocab', 0, 'syntax', 0, 'video', 0, 'shadow', 0, 'clinic', 0)   -- fresh day
      else jsonb_build_object('vocab', v_row.vocab_done, 'syntax', v_row.syntax_done, 'video', v_row.video_done, 'shadow', v_row.echo_done, 'clinic', v_row.clinic_done) end,
    'day_complete', false,
    'unlocked_next', v_unlocked
  );
end;
$function$;

comment on function public.bbf_get_curriculum_track(text, text) is
  'Language Lab Curriculum Engine · one-read Guided Track hydration: active day + dose requirements (vocab/syntax/video/shadow/clinic) + live counters, per language. Vault-token gated.';
comment on function public.bbf_log_curriculum_progress(text, text, text, int) is
  'Language Lab Curriculum Engine · dose counter writer (vocab|syntax|video|shadow|clinic). Stamps completed_at when the 5-item daily dose is met — the telemetry flag that unlocks day N+1.';
