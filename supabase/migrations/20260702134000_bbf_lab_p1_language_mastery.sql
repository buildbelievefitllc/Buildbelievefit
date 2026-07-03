-- ═══════════════════════════════════════════════════════════════════════════
-- BBF LAB · PHASE 1 · MIGRATION 5/6 — 90-DAY LANGUAGE MASTERY (Closed-Loop)
-- ───────────────────────────────────────────────────────────────────────────
-- Source: LANGUAGE_MASTERY_CLOSED_LOOP_BLUEPRINT §1.1 (bbf_language_profiles),
--         §1.3 (bbf_vocab_mastery v2), §1.4 (immersion sessions/turns, cue ledger),
--         §3.4 (bbf_pimsleur_progress), §4.3 (bbf_language_session_history).
--
-- FK: athlete_id → public.bbf_users(id) (the language engine keys on the user
--     spine, per blueprint — NOT athlete_profiles).
-- GRAM CROSS-OVER (§0.1): cue templates store {load_g}/{body_mass_g} slots only;
--   banned lexemes (kilo/kg/lb/libra/quilo) are rejected at persist time (RPC layer).
-- ZERO LIVE API: vocab/pimsleur/drill surfaces read pre-baked audio + Postgres.
-- SECURITY: RLS enabled + forced + revoked from anon/authenticated on new tables.
--
-- ⚠ bbf_vocab_mastery ALREADY EXISTS (20260623140000): athlete_id → bbf_users(id),
--   constraint uq_vocab_mastery UNIQUE (athlete_id, term), and the live RPC
--   bbf_record_vocab_attempt does ON CONFLICT (athlete_id, term). This migration
--   WIDENS the constraint to (athlete_id, language, term) per §1.3 AND re-points
--   that RPC in the SAME transaction — otherwise the Vocab Gym write would break.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1 · bbf_language_profiles — the learner spine, one row per (athlete, language)
create table if not exists public.bbf_language_profiles (
  id                    uuid primary key default gen_random_uuid(),
  athlete_id            uuid not null references public.bbf_users(id) on delete cascade,
  language              text not null check (language in ('es','pt')),
  -- phase machine (the Polyglot Sentinel is the only writer of these three)
  phase                 smallint not null default 1 check (phase between 1 and 5),
                        -- 1 FOUNDATION · 2 ACCELERATION · 3 IMMERSION · 4 MASTERY SPRINT · 5 GRADUATED
  phase_started_on      date not null default current_date,
  protocol_started_on   date not null default current_date,
  -- streak structure (deterministic update rule §1.2)
  streak_current        integer not null default 0,
  streak_best           integer not null default 0,
  last_qualified_on     date,
  -- rolled fluency state (Part 4 trend math is the writer)
  fluency_ewma          numeric,                     -- EWMA of immersion scores, λ=0.30
  fluency_slope_14d     numeric,                     -- pts/day linear slope, 14d window
  vocab_mastered        integer not null default 0,  -- box_level=5 count (cached rollup)
  pimsleur_done         integer not null default 0,  -- completed lesson count
  phrases_mastered      integer not null default 0,  -- Real Ready kit, box_level≥4
  weak_clusters         jsonb not null default '[]', -- ranked §4.4 error clusters
  updated_at            timestamptz not null default now(),
  unique (athlete_id, language)
);

alter table public.bbf_language_profiles enable row level security;
alter table public.bbf_language_profiles force  row level security;
revoke all on table public.bbf_language_profiles from anon, authenticated;

comment on table public.bbf_language_profiles is
  'BBF Lab P1 · the polyglot learner spine (one row per athlete/language). All seven modules read it; only the Polyglot Sentinel RPCs write phase/streak/fluency. Service-role only.';

-- ─── 2 · bbf_vocab_mastery v2 (EXISTING) — from read-only mirror to live loop (§1.3)
alter table public.bbf_vocab_mastery
  add column if not exists language        text not null default 'es'
                             check (language in ('es','pt')),
  add column if not exists source          text not null default 'seed'
                             check (source in ('seed','phrase_kit','immersion_inject',
                                               'linguist_flag','pimsleur_vocab')),
  add column if not exists injected_from   uuid,           -- immersion session provenance
  add column if not exists due_at          timestamptz,    -- SRS schedule (§2.2 writer)
  add column if not exists lapses          integer not null default 0,  -- box resets count
  add column if not exists priority_boost  numeric not null default 0
                             check (priority_boost between 0 and 1),
  add column if not exists error_cluster   text;           -- §4.4 taxonomy tag, if injected

-- Widen the uniqueness key (athlete_id, term) → (athlete_id, language, term).
-- Existing rows backfill language='es', so no collision under the new key.
alter table public.bbf_vocab_mastery drop constraint if exists uq_vocab_mastery;
alter table public.bbf_vocab_mastery
  add constraint uq_vocab_mastery unique (athlete_id, language, term);

alter table public.bbf_vocab_mastery enable row level security;  -- re-assert (already enabled)

-- SRS due-set index (the Vocab Gym's session-start read: due_at ≤ now()).
create index if not exists idx_vocab_mastery_due
  on public.bbf_vocab_mastery (athlete_id, language, due_at);

-- Keep the LIVE RPC deployable after the constraint swap: re-point ON CONFLICT to
-- (athlete_id, language, term) and default language='es' (backward-compatible with
-- the current single-language callers). The schedule-aware v2 RPC (due_at / boost)
-- lands in the Language RPC-layer deliverable; this is the minimal non-breaking patch.
create or replace function public.bbf_record_vocab_attempt(p_session_token text, p_term text, p_correct boolean)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_uid uuid; v_box int;
begin
  v_uid := public._bbf_uid_from_vault_token(p_session_token);
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'invalid_session'); end if;
  if p_term is null or length(trim(p_term)) = 0 then return jsonb_build_object('ok', false, 'error', 'missing_term'); end if;
  insert into public.bbf_vocab_mastery (athlete_id, language, term, box_level, correct, attempts, last_reviewed)
  values (v_uid, 'es', trim(p_term), case when p_correct then 2 else 1 end, case when p_correct then 1 else 0 end, 1, now())
  on conflict (athlete_id, language, term) do update set
    box_level     = case when p_correct then least(5, public.bbf_vocab_mastery.box_level + 1) else 1 end,
    correct       = public.bbf_vocab_mastery.correct + case when p_correct then 1 else 0 end,
    attempts      = public.bbf_vocab_mastery.attempts + 1,
    last_reviewed = now()
  returning box_level into v_box;
  return jsonb_build_object('ok', true, 'term', trim(p_term), 'box_level', v_box);
end; $function$;

-- ─── 3 · bbf_immersion_sessions — the live-LLM roleplay session ledger (§1.4) ──
create table if not exists public.bbf_immersion_sessions (
  id             uuid primary key default gen_random_uuid(),
  athlete_id     uuid not null references public.bbf_users(id) on delete cascade,
  language       text not null check (language in ('es','pt')),
  scenario_key   text not null,
  phase          smallint not null,
  turn_count     integer not null default 0,
  avg_fluency    numeric,
  error_clusters jsonb not null default '{}',       -- { "ser_estar": 3, "gender": 1 }
  started_at     timestamptz not null default now(),
  ended_at       timestamptz
);

alter table public.bbf_immersion_sessions enable row level security;
alter table public.bbf_immersion_sessions force  row level security;
revoke all on table public.bbf_immersion_sessions from anon, authenticated;

create index if not exists idx_immersion_sessions_athlete
  on public.bbf_immersion_sessions (athlete_id, language, started_at desc);

-- ─── 4 · bbf_immersion_turns — per-turn record incl. the structured errors block ─
create table if not exists public.bbf_immersion_turns (
  id                 uuid primary key default gen_random_uuid(),
  session_id         uuid not null references public.bbf_immersion_sessions(id) on delete cascade,
  turn_num           integer not null,
  user_input         text not null,
  ai_reply           text not null,
  grammar_correction text,
  errors             jsonb not null default '[]',   -- the structured block, verbatim
  fluency_score      smallint check (fluency_score between 0 and 100),
  created_at         timestamptz not null default now(),
  unique (session_id, turn_num)
);

alter table public.bbf_immersion_turns enable row level security;
alter table public.bbf_immersion_turns force  row level security;
revoke all on table public.bbf_immersion_turns from anon, authenticated;

comment on table public.bbf_immersion_turns is
  'BBF Lab P1 · immersion turn log. errors[] carries the closed-taxonomy structured block ({term, cluster, severity}) that feeds the injection loop → Box-1 mandatory vocab. Service-role only.';

-- ─── 5 · bbf_language_session_history — the uniform temporal spine (§4.3) ──────
create table if not exists public.bbf_language_session_history (
  id             uuid primary key default gen_random_uuid(),
  athlete_id     uuid not null references public.bbf_users(id) on delete cascade,
  language       text not null check (language in ('es','pt')),
  module         text not null check (module in
                   ('vocab_gym','pimsleur','immersion','drill','phrase_kit',
                    'linguist','intention')),
  mode           text,                          -- game mode / scenario key / lesson number
  phase          smallint not null,
  started_at     timestamptz not null,
  duration_s     integer,
  items_total    integer,
  items_correct  integer,
  fluency_score  numeric,                       -- immersion sessions only
  error_clusters jsonb not null default '{}',
  items          jsonb not null default '[]',   -- per-item log: [{term, box_before, box_after, correct, mode}]
  srs_snapshot   jsonb,                         -- {due_count, boxes_histogram} at start
  meta           jsonb not null default '{}',
  created_at     timestamptz not null default now()
);

alter table public.bbf_language_session_history enable row level security;
alter table public.bbf_language_session_history force  row level security;
revoke all on table public.bbf_language_session_history from anon, authenticated;

create index if not exists idx_lsh_athlete_lang_time
  on public.bbf_language_session_history (athlete_id, language, started_at desc);

comment on table public.bbf_language_session_history is
  'BBF Lab P1 · one row per session across all seven modules. items[] is the granular per-attempt record the metric definitions (box5_clearance_rate, etc.) read from. Service-role only.';

-- ─── 6 · bbf_pimsleur_progress — resume-aware lesson ledger (§3.4) ─────────────
create table if not exists public.bbf_pimsleur_progress (
  id                 uuid primary key default gen_random_uuid(),
  athlete_id         uuid not null references public.bbf_users(id) on delete cascade,
  language           text not null check (language in ('es','pt')),
  lesson_number      smallint not null,
  status             text not null default 'locked'
                       check (status in ('locked','available','in_progress','completed')),
  last_fragment_seq  integer,                    -- resume checkpoint (fragment boundary)
  last_position_ms   integer,                    -- virtual-timeline offset at checkpoint
  listened_ms_total  bigint not null default 0,  -- accumulated across all plays
  retries            integer not null default 0, -- full restarts after a completion
  first_started_at   timestamptz,
  completed_at       timestamptz,
  updated_at         timestamptz not null default now(),
  unique (athlete_id, language, lesson_number)
);

alter table public.bbf_pimsleur_progress enable row level security;
alter table public.bbf_pimsleur_progress force  row level security;
revoke all on table public.bbf_pimsleur_progress from anon, authenticated;

comment on table public.bbf_pimsleur_progress is
  'BBF Lab P1 · resume-aware Pimsleur ledger. Checkpoint at every fragment boundary; completion at ≥90% coverage AND final fragment played; N+1 unlocks on N completion. Service-role only.';

-- ─── 7 · bbf_linguist_cue_ledger — cache-first gram-slot translations (§1.4/§0.1) ─
create table if not exists public.bbf_linguist_cue_ledger (
  id              uuid primary key default gen_random_uuid(),
  cue_en          text not null,
  language        text not null check (language in ('es','pt')),
  translation     text not null,           -- template form: {load_g} slots, no literals
  phonetic        text not null,
  literal_meaning text not null,
  has_mass_slot   boolean not null default false,   -- §0.1 contract
  status          text not null default 'active' check (status in ('active','needs_review')),
  requested_by    uuid references public.bbf_users(id),
  created_at      timestamptz not null default now(),
  unique (cue_en, language)
);

alter table public.bbf_linguist_cue_ledger enable row level security;
alter table public.bbf_linguist_cue_ledger force  row level security;
revoke all on table public.bbf_linguist_cue_ledger from anon, authenticated;

comment on table public.bbf_linguist_cue_ledger is
  'BBF Lab P1 · cache-first Linguist ledger. Repeated cues resolve here (zero API). Mass rides {load_g}/{body_mass_g} slots resolved from bbf_sets.load_g / athlete_body_metrics.body_mass_g at display time; banned lexemes rejected at persist. Service-role only.';
