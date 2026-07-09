-- ═══════════════════════════════════════════════════════════════════════════
-- BBF Language Lab · CURRICULUM ENGINE — gated day-by-day Guided Track
-- ───────────────────────────────────────────────────────────────────────────
-- Upgrades the Language Lab from a static toolset to a dosed curriculum: one
-- ledger row per (athlete, language, day_number) tracks the daily checklist
-- (vocab cards · syntax rules · Video Vault reviews). A day COMPLETES when all
-- three metrics hit the daily dose; completion is the telemetry flag that
-- unlocks Day N+1 (current_day = completed-day count + 1, capped at 90).
--
-- BILINGUAL STATE MATRIX: the language column keys the whole track, so the
-- ES and PT curricula progress independently — a PT session can never bleed
-- into the ES ledger (same isolation contract as bbf_vocab_mastery v2).
--
-- Free-roam is preserved by design: nothing here gates the modular tools —
-- only the NEXT DAY'S checklist is gated, and only on the current day's dose.
--
-- SECURITY: same envelope as the Language Mastery engine (20260704120000) —
-- RLS enabled + forced + revoked; access ONLY via the vault-token SECURITY
-- DEFINER RPCs below (_bbf_uid_from_vault_token gate). Additive + idempotent.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1 · bbf_curriculum_days — the per-day checklist ledger ────────────────────
create table if not exists public.bbf_curriculum_days (
  id            uuid primary key default gen_random_uuid(),
  athlete_id    uuid not null references public.bbf_users(id) on delete cascade,
  language      text not null check (language in ('es','pt')),
  day_number    smallint not null check (day_number between 1 and 90),
  -- the daily dose counters (the RPC layer is the only writer)
  vocab_done    integer not null default 0,
  syntax_done   integer not null default 0,
  video_done    integer not null default 0,
  completed_at  timestamptz,                 -- the unlock flag for day N+1
  started_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (athlete_id, language, day_number)
);

alter table public.bbf_curriculum_days enable row level security;
alter table public.bbf_curriculum_days force  row level security;
revoke all on table public.bbf_curriculum_days from anon, authenticated;

create index if not exists idx_curriculum_days_track
  on public.bbf_curriculum_days (athlete_id, language, day_number desc);

comment on table public.bbf_curriculum_days is
  'BBF Language Lab · Curriculum Engine day ledger. One row per (athlete, language, day). completed_at is the telemetry flag that unlocks day N+1. Service-role/RPC only.';

-- ─── 2 · bbf_get_curriculum_track — one-read Guided Track hydration ────────────
-- Returns the active day, its dose requirements, the live counters, and the
-- completed-day count. The current day's row is created lazily by the progress
-- writer; an absent row reads as all-zeros here.
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

  select vocab_done, syntax_done, video_done, completed_at into v_row
    from public.bbf_curriculum_days
   where athlete_id = v_uid and language = v_lang and day_number = v_day;

  return jsonb_build_object(
    'ok', true, 'language', v_lang,
    'current_day', v_day,
    'days_completed', v_done,
    'requirements', jsonb_build_object('vocab', 10, 'syntax', 1, 'video', 1),
    'progress', jsonb_build_object(
      'vocab',  coalesce(v_row.vocab_done, 0),
      'syntax', coalesce(v_row.syntax_done, 0),
      'video',  coalesce(v_row.video_done, 0)
    ),
    'day_complete', v_row.completed_at is not null
  );
end;
$function$;

-- ─── 3 · bbf_log_curriculum_progress — the dose counter + unlock writer ────────
-- Increments one metric on the CURRENT day's row (lazily created). When all
-- three counters reach the daily dose, completed_at stamps — the unlock flag —
-- and the response reports the newly active day. Idempotent past completion:
-- extra module work after the day closes keeps counting on the NEXT day.
create or replace function public.bbf_log_curriculum_progress(
  p_session_token text,
  p_language      text,
  p_metric        text,               -- vocab | syntax | video
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
  v_metric   text := case when p_metric in ('vocab','syntax','video') then p_metric else null end;
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
    vocab_done, syntax_done, video_done, updated_at)
  values (v_uid, v_lang, v_day,
    case when v_metric = 'vocab'  then v_n else 0 end,
    case when v_metric = 'syntax' then v_n else 0 end,
    case when v_metric = 'video'  then v_n else 0 end,
    now())
  on conflict (athlete_id, language, day_number) do update set
    vocab_done  = public.bbf_curriculum_days.vocab_done  + case when v_metric = 'vocab'  then v_n else 0 end,
    syntax_done = public.bbf_curriculum_days.syntax_done + case when v_metric = 'syntax' then v_n else 0 end,
    video_done  = public.bbf_curriculum_days.video_done  + case when v_metric = 'video'  then v_n else 0 end,
    updated_at  = now()
  returning vocab_done, syntax_done, video_done, completed_at into v_row;

  -- The daily dose (10 vocab · 1 syntax · 1 video) all met → stamp the unlock flag.
  if v_row.completed_at is null
     and v_row.vocab_done >= 10 and v_row.syntax_done >= 1 and v_row.video_done >= 1 then
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
    'requirements', jsonb_build_object('vocab', 10, 'syntax', 1, 'video', 1),
    'progress', case when v_unlocked
      then jsonb_build_object('vocab', 0, 'syntax', 0, 'video', 0)   -- fresh day
      else jsonb_build_object('vocab', v_row.vocab_done, 'syntax', v_row.syntax_done, 'video', v_row.video_done) end,
    'day_complete', false,
    'unlocked_next', v_unlocked
  );
end;
$function$;

-- Vault-token gated (they authorize on the caller's own session internally), so
-- the client roles may execute — exactly like the Language Mastery RPCs.
grant execute on function public.bbf_get_curriculum_track(text, text)                to anon, authenticated, service_role;
grant execute on function public.bbf_log_curriculum_progress(text, text, text, int)  to anon, authenticated, service_role;

comment on function public.bbf_get_curriculum_track(text, text) is
  'Language Lab Curriculum Engine · one-read Guided Track hydration: active day + dose requirements + live counters, per language. Vault-token gated.';
comment on function public.bbf_log_curriculum_progress(text, text, text, int) is
  'Language Lab Curriculum Engine · dose counter writer (vocab|syntax|video). Stamps completed_at when the daily dose is met — the telemetry flag that unlocks day N+1.';
