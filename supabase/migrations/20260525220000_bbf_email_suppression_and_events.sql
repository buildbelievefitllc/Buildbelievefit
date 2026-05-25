-- ═══════════════════════════════════════════════════════════════════════
-- Phase 1.1 + 1.3 · Cross-system email suppression + Resend delivery events.
-- ───────────────────────────────────────────────────────────────────────
-- TWO tables · one trust ledger, one delivery flight recorder.
--
--   bbf_email_suppression · global "do not contact" ledger. Anything in
--     here gets hard-skipped by the marketing dispatcher before Resend is
--     called. Populated by:
--       · triage   · 'interested'     -> reason='active_inbound_lead'
--                  · 'not_interested' -> reason='unsubscribed'
--       · unsubscribe handler         -> reason='unsubscribed'
--       · Resend webhook events       -> reason='bounced' or 'complaint'
--
--   bbf_email_events · raw Resend delivery webhook log. Keyed by
--     message_id for join-back to bbf_outbound_athletes.resend_message_id.
--     Powers the delivery metrics surfaced in /api/v1/marketing/health.
--
-- RLS · service-role only on both. The marketing module is the only
-- writer; the admin /health route reads through that same key.
-- ═══════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ─── bbf_email_suppression ─────────────────────────────────────────────
-- email is the PK · idempotent re-insert is the desired semantics
-- (ON CONFLICT DO UPDATE on the call site). lowercase enforced via
-- CHECK so we never have to remember to .toLowerCase() at every callsite.
create table if not exists public.bbf_email_suppression (
  email          text primary key check (email = lower(email)),
  suppressed_at  timestamptz not null default now(),
  reason         text not null
);

create index if not exists idx_bbf_email_suppression_reason
  on public.bbf_email_suppression (reason);

create index if not exists idx_bbf_email_suppression_at
  on public.bbf_email_suppression (suppressed_at desc);

alter table public.bbf_email_suppression enable row level security;

drop policy if exists "bbf_email_suppression_service_only" on public.bbf_email_suppression;
create policy "bbf_email_suppression_service_only"
  on public.bbf_email_suppression for all
  to service_role
  using (true)
  with check (true);

comment on table public.bbf_email_suppression is
  'Cross-system do-not-contact ledger · Phase 1.3 · marketing dispatcher consults this before every send · service-role writes only · email PK is lowercase-enforced via CHECK constraint';

-- ─── bbf_email_events ──────────────────────────────────────────────────
-- Raw Resend delivery webhook log. event_type covers Resend's spec:
-- email.sent, email.delivered, email.bounced, email.opened, email.clicked,
-- email.complained. Other values are stored verbatim so future Resend
-- additions don't require a schema change.
create table if not exists public.bbf_email_events (
  id           uuid primary key default gen_random_uuid(),
  message_id   text,
  email        text,
  event_type   text not null,
  ts           timestamptz not null default now(),
  payload      jsonb not null default '{}'::jsonb
);

create index if not exists idx_bbf_email_events_message_id
  on public.bbf_email_events (message_id)
  where message_id is not null;

create index if not exists idx_bbf_email_events_email_ts
  on public.bbf_email_events (email, ts desc)
  where email is not null;

create index if not exists idx_bbf_email_events_type_ts
  on public.bbf_email_events (event_type, ts desc);

create index if not exists idx_bbf_email_events_ts
  on public.bbf_email_events (ts desc);

alter table public.bbf_email_events enable row level security;

drop policy if exists "bbf_email_events_service_only" on public.bbf_email_events;
create policy "bbf_email_events_service_only"
  on public.bbf_email_events for all
  to service_role
  using (true)
  with check (true);

comment on table public.bbf_email_events is
  'Resend delivery webhook flight recorder · Phase 1.1 · email.delivered / bounced / opened / complained etc · service-role writes only · powers delivery metrics in /api/v1/marketing/health';
