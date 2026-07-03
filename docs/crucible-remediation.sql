-- ═══════════════════════════════════════════════════════════════════════════
-- CRUCIBLE REMEDIATION BUNDLE — apply as Wave A, step 15 (after all Phase 1/3
-- migrations, before the edge fleet). Idempotent; safe to re-run.
-- Covers: S-1/S-2 (video_prescriptions), H-1/H-2 (missing UNIQUE keys),
-- C-2 (fulfillment replay serialization), and the athlete advisory-lock helper
-- consumed by the patched sentinels (C-1/H-1/H-2/H-4).
-- The bbf_video_prescriptions block is ALSO safe to hot-apply to production
-- immediately (it only tightens access; the sole writer uses the service role).
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ── S-1 + S-2 · bbf_video_prescriptions: restore RLS, kill the anon INSERT ────
alter table public.bbf_video_prescriptions enable  row level security;
alter table public.bbf_video_prescriptions force   row level security;
drop policy if exists "Service role can insert video prescriptions" on public.bbf_video_prescriptions;
drop policy if exists "Users can read own video prescriptions"      on public.bbf_video_prescriptions; -- dead under vault-token auth (auth.uid() is null)
revoke all on table public.bbf_video_prescriptions from anon, authenticated;
-- Service role bypasses RLS; the writer (bbf-agentic-cns-video-prescription, once
-- patched per §7 S-3) uses the service key. If an athlete-facing read is ever
-- needed, add a vault-token SECURITY DEFINER RPC — never an auth.uid() policy.

-- ── H-1 · prehab_queue: the idempotency key the sentinel code already assumes ─
create unique index if not exists uq_prehab_active
  on public.prehab_queue (athlete_id, scheduled_for, joint_zone)
  where status in ('queued', 'served');

-- ── H-2 · cardio prescription + injury history: dedup keys for the cold-start ─
create unique index if not exists uq_cardio_rx_active
  on public.bbf_cardio_prescription (user_id, prescribed_for)
  where status = 'active';

create unique index if not exists uq_injury_intake
  on public.athlete_injury_history (athlete_id, joint_zone, reported_by);

-- Note: athlete_profiles(user_id) already has UNIQUE athlete_profiles_user_id_key
-- (migration 20260620170000) — H-3 is fixed in the orchestrator code (§7), not here.

-- ── C-1/H-1/H-2/H-4 · per-athlete advisory-lock helper for the nightly passes ─
-- Wrap each sentinel's per-athlete body and the orchestrator cascade with this
-- inside their transaction so overlapping cron fires serialize per athlete.
create or replace function public.bbf_try_athlete_lock(p_athlete uuid)
returns void language sql security definer set search_path to 'public' as $$
  select pg_advisory_xact_lock(hashtextextended(p_athlete::text, 0));
$$;
revoke all on function public.bbf_try_athlete_lock(uuid) from public;
grant execute on function public.bbf_try_athlete_lock(uuid) to service_role;

commit;

-- ═══════════════════════════════════════════════════════════════════════════
-- C-2 · Serialize the Stripe replay guard. Apply as a REPLACE of the existing
-- function OR add this single line as the first statement of the function body
-- in 20260601010000_bbf_stripe_fulfillment_transaction.sql (before the
-- `if exists (select 1 from public.bbf_stripe_events ...)` guard):
--
--   perform pg_advisory_xact_lock(hashtextextended(p_event_id, 0));
--
-- This forces concurrent deliveries of the same event_id to serialize, so the
-- second one sees the first's committed ledger row and returns replay:true
-- instead of double-provisioning + double-emailing a second (dead) PIN.
-- ═══════════════════════════════════════════════════════════════════════════
