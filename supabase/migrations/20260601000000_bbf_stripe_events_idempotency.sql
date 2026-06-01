-- ═══════════════════════════════════════════════════════════════
-- Phase 18 follow-up · stripe-webhook idempotency ledger
-- ───────────────────────────────────────────────────────────────
-- Closes the open idempotency gap documented in
-- supabase/functions/stripe-webhook/index.ts: Stripe retries (network
-- blips, our 5xx responses, plain re-delivery) re-deliver the SAME
-- event.id, which previously re-ran provisioning (regenerating /
-- overwriting the client PIN) and re-sent the Brevo welcome email.
--
-- The webhook checks this ledger BEFORE any work (replay → short-circuit)
-- and records the event ONLY AFTER provision + tier succeed, keyed on the
-- Stripe event_id primary key.
--
-- NOTE: this table already exists in production (created out-of-band).
-- This migration is written `create table if not exists` to MATCH that
-- live schema exactly — it is a no-op in prod and a faithful reproduction
-- on a fresh environment. Columns/CHECK/PK mirror the deployed table:
--   event_id PK, event_type, session_id, email (lowercase CHECK), tier, username.
--
-- Service-role only: the webhook runs with SUPABASE_SERVICE_ROLE_KEY
-- (bypasses RLS). RLS is enabled with NO policies so no anon/authed
-- client can read or write it (§7 RLS posture).
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.bbf_stripe_events (
  event_id   text primary key,   -- Stripe event.id (evt_...)
  event_type text,               -- e.g. checkout.session.completed
  session_id text,               -- Stripe checkout session id, if any
  email      text,               -- provisioned email (lowercased)
  tier       text,               -- resolved subscription tier
  username   text,               -- provisioned vault username
  constraint bbf_stripe_events_email_lowercase_chk
    check (email is null or email = lower(btrim(email)))
);

comment on table public.bbf_stripe_events is
  'Idempotency ledger for stripe-webhook. One row per processed Stripe event.id; presence = already fulfilled. Service-role only.';

alter table public.bbf_stripe_events enable row level security;
-- Intentionally no policies: only the service role (RLS-exempt) touches this.
