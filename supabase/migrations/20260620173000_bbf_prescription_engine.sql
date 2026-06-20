-- ═══════════════════════════════════════════════════════════════════════════
-- BBF Dynamic Prescription Engine · clinical closed-loop feedback layer
-- ───────────────────────────────────────────────────────────────────────────
-- Shifts BBF Lab from static rehab templates to an adaptive, algorithmic
-- recovery/prehab model. Three tables + a pg_net tripwire that fires the
-- bbf-prescription-engine edge function on every post-session check-in.
--
-- Source data: proprietary clinical exercise library + diagnosis routing matrix
-- (hingelick.json · 80 movements across 7 regions incl. breathing_and_meditation),
-- seeded separately in 20260620173100_seed_clinical_exercises.sql.
--
-- DETERMINISTIC by design — no AI inference. Clinical/safety logic is rule-based
-- here, mirroring bbf-agentic-prehab (deterministic matrix) and
-- bbf-evaluate-athlete-progress (deterministic referee). No model-router route.
--
-- RLS posture (mirrors bbf_prehab_catalog / bbf_client_prehab):
--   clinical_exercises — public-read reference library; writes service-role only.
--   session_feedback   — per-client data; RLS on, NO policies (service-role only).
--   active_playlists   — per-client data; RLS on, NO policies (service-role only).
--
-- LOOP-SAFETY: the engine writes ONLY active_playlists, and the tripwire fires
-- ONLY on session_feedback INSERT → it can never recurse. Do not add a write-back
-- to session_feedback from the engine without a re-entry guard.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1 · clinical_exercises — master movement library ───────────────────────
create table if not exists public.clinical_exercises (
  id          text primary key,            -- stable slug from the library (e.g. 'sh_001')
  name        text not null,
  body_part   text not null,               -- shoulder|lower_body|knee|neck|upper_body|full_body|breathing_and_meditation
  type        text not null,               -- strengthening|mobility|prehab|recovery|mental_wellness
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
comment on table public.clinical_exercises is
  'Master clinical exercise library for the Dynamic Prescription Engine (seeded from hingelick.json). breathing_and_meditation rows are tagged type=mental_wellness. Public-read reference data; service-role writes.';

create index if not exists clinical_exercises_lookup_idx
  on public.clinical_exercises (body_part, type) where active;

alter table public.clinical_exercises enable row level security;
drop policy if exists clinical_exercises_public_read on public.clinical_exercises;
create policy clinical_exercises_public_read
  on public.clinical_exercises for select
  to anon, authenticated
  using (active);

-- ─── 2 · session_feedback — post-workout check-in ledger ────────────────────
-- target_area is an ADDITION to the directive's column list: the engine must
-- "generate the next day's playlist based on the user's target pain area", which
-- is not otherwise captured. Nullable → the engine falls back to 'full_body'.
create table if not exists public.session_feedback (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references public.bbf_users(id) on delete cascade,
  pain_score   smallint not null check (pain_score between 1 and 10),
  rpe_score    smallint not null check (rpe_score between 1 and 10),
  target_area  text,
  created_at   timestamptz not null default now()
);
comment on table public.session_feedback is
  'Post-workout check-in (pain 1-10, RPE 1-10, target_area). Each INSERT fires the bbf-prescription-engine tripwire. Per-client data; service-role only (written via edge fn).';

create index if not exists session_feedback_user_idx
  on public.session_feedback (user_id, created_at desc);

alter table public.session_feedback enable row level security;
-- Intentionally no policies: service role only (per-client data).

-- ─── 3 · active_playlists — generated daily prescription queue ──────────────
create table if not exists public.active_playlists (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references public.bbf_users(id) on delete cascade,
  target_area         text not null,
  action              text not null check (action in ('regress','progress','maintain')),
  intensity_modifier  numeric(3,2) not null,    -- 0.50 (regress) | 0.80 (maintain) | 1.10 (progress)
  exercises           jsonb not null,           -- ordered queue: 4 region movements + 1 mental_wellness finisher
  scheduled_for       date not null,            -- the day this queue is for (next day)
  status              text not null default 'active' check (status in ('active','superseded','completed')),
  pain_score          smallint,                 -- snapshot of the feedback that generated this queue
  rpe_score           smallint,
  source_feedback_id  uuid references public.session_feedback(id) on delete set null,
  created_at          timestamptz not null default now()
);
comment on table public.active_playlists is
  'Daily adaptive prescription queue generated by bbf-prescription-engine from a session_feedback check-in. exercises = 4 region movements (regress/progress/maintain by type) + 1 mental_wellness finisher (Champion''s Mindset). Per-client data; service-role only.';

create index if not exists active_playlists_user_idx
  on public.active_playlists (user_id, scheduled_for desc);
create index if not exists active_playlists_active_idx
  on public.active_playlists (user_id, target_area, scheduled_for) where status = 'active';

alter table public.active_playlists enable row level security;
-- Intentionally no policies: service role only (per-client data).

-- ─── Shared-secret config (idempotent; table already armed by the tripwire) ──
create table if not exists public.bbf_app_config (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);
alter table public.bbf_app_config enable row level security;
revoke all on table public.bbf_app_config from anon, authenticated;

-- ─── Tripwire: fire the engine on every check-in (fire-and-forget pg_net) ───
-- SHARED SECRET: the deploy toolset can't set edge-function env vars, so the
-- secret lives in bbf_app_config (key='prescription_engine_secret'), read by BOTH
-- this trigger and the function. The value is armed out-of-band (never committed).
create or replace function public._bbf_prescription_tripwire()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, net
as $$
declare
  v_fn_url text := 'https://ihclbceghxpuawymlvgi.supabase.co/functions/v1/bbf-prescription-engine';
  v_secret text;
begin
  select value into v_secret from public.bbf_app_config where key = 'prescription_engine_secret';
  -- Fire-and-forget. Wrapped so a pg_net hiccup can NEVER block the check-in write.
  begin
    perform net.http_post(
      url     := v_fn_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-BBF-Prescription-Secret', coalesce(v_secret, '')
      ),
      body    := jsonb_build_object(
        'feedback_id', NEW.id,
        'user_id',     NEW.user_id,
        'pain_score',  NEW.pain_score,
        'rpe_score',   NEW.rpe_score,
        'target_area', NEW.target_area,
        'created_at',  NEW.created_at
      )
    );
  exception when others then
    raise warning '[bbf prescription tripwire] net.http_post failed: %', sqlerrm;
  end;
  return NEW;
end;
$$;

drop trigger if exists bbf_session_feedback_tripwire on public.session_feedback;
create trigger bbf_session_feedback_tripwire
  after insert on public.session_feedback
  for each row
  execute function public._bbf_prescription_tripwire();
