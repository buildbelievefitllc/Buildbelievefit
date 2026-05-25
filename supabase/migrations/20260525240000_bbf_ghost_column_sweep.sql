-- ═══════════════════════════════════════════════════════════════════════
-- Phase 2.3 · Ghost column sweep · 5 columns scheduled for drop
-- ───────────────────────────────────────────────────────────────────────
-- STATUS: DRAFTED · NOT YET APPLIED · waiting for operator go-signal
-- before execution. Migration file is committed to repo so it ships
-- with the audit trail; apply via `apply_migration` when ready.
--
-- AUDIT METHODOLOGY (recorded in MASTER_PLAN.md §2.3):
--   For each of the 308 columns across the 24 public.bbf_* tables we
--   ran a 5-layer dependency check:
--     1. live application code (Deno edge functions · Render Node
--        service · src/ + bbf-app.html + index.js + root .js engines)
--     2. stored functions in public schema (pg_proc.prosrc)
--     3. views in public schema (pg_views.definition)
--     4. foreign-key constraints in either direction (pg_constraint)
--     5. triggers + indexes + cross-schema functions
--
-- The 5 columns below have ZERO references in ALL FIVE layers. Their
-- data is either fully null, in an empty table, or a one-off historical
-- value with no live consumer. Safe to drop · zero application
-- breakage expected.
--
-- The single index that would be cascaded (idx_bbf_stripe_events_received_at)
-- is on an empty table and indexes a column nobody reads · the cascade
-- is benign.
-- ═══════════════════════════════════════════════════════════════════════

-- ─── 1. bbf_active_clients.liability_agreement ─────────────────────────
-- Legacy of the older provisioning flow. The current path uses
-- `liability_cleared` (set by stripe-webhook on every fresh provision).
-- 1 of 5 rows has a value (true); 4 are null. Replaced by liability_cleared.
alter table public.bbf_active_clients
  drop column if exists liability_agreement;

-- ─── 2. bbf_meal_macros.ingredients_hash ──────────────────────────────
-- Was scaffolded for an ingredient-fingerprint cache key never wired up.
-- bbf-meal-macros + bbf-meal-image both key on `name_normalized` instead.
-- Table currently 0 rows · zero data loss.
alter table public.bbf_meal_macros
  drop column if exists ingredients_hash;

-- ─── 3. bbf_stripe_events.received_at ─────────────────────────────────
-- Defaulted to NOW() at insert, never read. `created_at` (the table's
-- standard timestamp) covers "when did this event arrive" semantics.
-- Table currently 0 rows · zero data loss. The associated index
-- idx_bbf_stripe_events_received_at drops via CASCADE (empty table,
-- zero performance impact).
alter table public.bbf_stripe_events
  drop column if exists received_at;

-- ─── 4. bbf_users.last_login ──────────────────────────────────────────
-- Legacy session-tracking column. 7 rows in the table, 100% null · the
-- column was never populated by any code path. Session telemetry
-- (Phase 4.4 bbf_events) is the future home for login events.
alter table public.bbf_users
  drop column if exists last_login;

-- ─── 5. bbf_vapi_calls.vapi_call_id ───────────────────────────────────
-- Sibling columns `call_status` + `called_at` ARE used by the stored
-- functions bbf_evaluate_abandoned_carts + bbf_evaluate_streaks (kept).
-- `vapi_call_id` was never populated and is never read anywhere.
-- Table currently 0 rows · zero data loss.
alter table public.bbf_vapi_calls
  drop column if exists vapi_call_id;

-- ═══════════════════════════════════════════════════════════════════════
-- COLUMNS DELIBERATELY *NOT* DROPPED (initially flagged · DB-internal
-- use found in dependency sweep · keep):
--   bbf_pin_attempts.failed_count        · used by bbf_admin_clear_lockout,
--   bbf_pin_attempts.last_attempt_at       bbf_verify_admin_pin,
--   bbf_pin_attempts.locked_until          bbf_verify_user_pin
--   bbf_pin_attempts.window_started_at
--   bbf_system_config.ceiling_tripped_at · used by bbf_check_daily_spend
--   bbf_vapi_calls.call_status           · used by bbf_evaluate_abandoned_carts,
--   bbf_vapi_calls.called_at               bbf_evaluate_streaks
-- ═══════════════════════════════════════════════════════════════════════
