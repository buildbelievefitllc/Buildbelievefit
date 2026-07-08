-- supabase/migrations/20260708120000_bbf_eagle_eye_interventions.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- BBF EAGLE EYE · INTERVENTIONS LEDGER — the closed-loop action layer.
--
-- Eagle Eye already DETECTS when the daily readiness cue bucket and the weekly
-- report bucket drift apart. This table is where its ACTIONS live: for every
-- finding it decides to act on, one row tracks the play, the delivery channel,
-- the client-facing message, any staged approval-queue proposal, and — crucially
-- — the RESOLUTION (did the client climb out of the hurdle, or did it escalate?).
--
-- The engine (bbf-eagle-eye · mode:'run') writes/reconciles these rows; the client
-- Vault reads its own active in-app message through the function (service-role
-- mediated, so RLS stays service-only like bbf_weekly_briefs). Anything that would
-- change a client's prescribed plan is NOT applied here — it is staged into
-- bbf_pending_review (proposal_id) and the founder approves it. This ledger only
-- records that it was staged + delivered.

create table if not exists public.bbf_eagle_eye_interventions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.bbf_users(id) on delete cascade,
  finding_code      text not null,     -- e.g. COMPLIANCE_NO_LOGS, PUSH_VS_LOW_READINESS
  severity          text not null,     -- conflict | drift
  play              text not null,     -- nudge | load_proposal | deload_proposal | system_repair
  channel           text,              -- in_app | proposal | internal
  status            text not null default 'open', -- open|dispatched|acknowledged|resolved|escalated
  client_message    text,             -- the in-app nudge / empathetic escalation script (in the client's locale)
  locale            text default 'en',
  proposal_id       uuid,             -- link to bbf_pending_review when the play routes to the approval queue
  iso_year          integer,
  iso_week          integer,
  dispatched_at     timestamptz,
  acknowledged_at   timestamptz,
  resolved_at       timestamptz,
  resolution_reason text,             -- e.g. logs_resumed, readiness_landed, brief_regenerated
  escalated_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_eagle_eye_interventions_user
  on public.bbf_eagle_eye_interventions (user_id, status);
create index if not exists idx_eagle_eye_interventions_created
  on public.bbf_eagle_eye_interventions (created_at desc);

-- At most ONE live intervention per (user, finding_code) so a repeated scan never
-- fans out duplicate nudges for the same unresolved drift. A resolved/dismissed
-- row frees the slot for a future recurrence.
create unique index if not exists uq_eagle_eye_active_finding
  on public.bbf_eagle_eye_interventions (user_id, finding_code)
  where status in ('open', 'dispatched', 'acknowledged', 'escalated');

-- RLS: service_role only. The edge function mediates every read/write (admin cycle
-- + service-role client-nudge read), mirroring the bbf_weekly_briefs lockdown — no
-- client ever touches this table directly.
alter table public.bbf_eagle_eye_interventions enable row level security;
drop policy if exists "eagle_eye_interventions_service_only" on public.bbf_eagle_eye_interventions;
create policy "eagle_eye_interventions_service_only" on public.bbf_eagle_eye_interventions
  for all to service_role using (true) with check (true);

comment on table public.bbf_eagle_eye_interventions is
  'BBF Eagle Eye closed-loop action ledger: one row per dispatched cue-alignment intervention, tracked from dispatch → resolution/escalation. Plan changes route to bbf_pending_review; this only records the dispatch + delivery.';
