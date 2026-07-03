-- ═══════════════════════════════════════════════════════════════════════════
-- CRUCIBLE REMEDIATION BUNDLE — Wave A, step 15 (after all Phase 1/3 migrations,
-- before the edge fleet). Idempotent; safe to re-run.
-- Covers: S-1/S-2 (video_prescriptions), H-1/H-2 (missing UNIQUE keys),
-- C-2 (fulfillment replay serialization), and the athlete advisory-lock helper
-- consumed by the patched sentinels (C-1/H-1/H-2/H-4).
-- The bbf_video_prescriptions block is ALSO safe to hot-apply to production
-- immediately (it only tightens access; the sole writer uses the service role).
--
-- Verbatim from Fable's crucible-remediation.sql, PLUS the C-2 fix realized as a
-- CREATE OR REPLACE of bbf_stripe_fulfillment_transaction (the source migration
-- 20260601010000 is already applied to prod, so editing that file would not reach
-- the live DB; applying the replacement here does — per the CEO's "handle it in
-- the new remediation file" option).
-- ═══════════════════════════════════════════════════════════════════════════

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

-- ═══════════════════════════════════════════════════════════════════════════
-- C-2 · Serialize the Stripe replay guard. Reproduces bbf_stripe_fulfillment_
-- transaction VERBATIM from 20260601010000 with ONE added first statement:
--   perform pg_advisory_xact_lock(hashtextextended(p_event_id, 0));
-- so concurrent deliveries of the same event_id serialize — the second sees the
-- first's committed ledger row and returns replay:true instead of double-
-- provisioning + emailing a second (dead) PIN.
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.bbf_stripe_fulfillment_transaction(
  p_event_id   text,
  p_event_type text,
  p_session_id text,
  p_email      text,
  p_full_name  text,
  p_tier       text,
  p_pin        text
) returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_prov     json;
  v_username text;
  v_new_user boolean := false;
begin
  -- C-2 · serialize concurrent deliveries of the SAME event before the replay
  -- guard's check-then-act window. Released at commit (xact-scoped).
  perform pg_advisory_xact_lock(hashtextextended(p_event_id, 0));

  -- 0. Replay guard — already fulfilled, do nothing.
  if exists (select 1 from public.bbf_stripe_events where event_id = p_event_id) then
    return json_build_object('ok', true, 'replay', true, 'event_id', p_event_id);
  end if;

  -- 1. Active-client roster row (idempotent by vault_email).
  if not exists (select 1 from public.bbf_active_clients where vault_email = p_email) then
    insert into public.bbf_active_clients
      (client_name, client_email, vault_email, spectrum_tier, onboarding_status, liability_cleared)
    values
      (p_full_name, p_email, p_email, p_tier, 'Pending', true);
  end if;

  -- 2. Provision vault user (depends on the active-client row above).
  v_prov := public.bbf_provision_client_pin(p_email, p_pin, p_full_name);
  if coalesce((v_prov->>'ok')::boolean, false) then
    v_username := v_prov->>'username';
    v_new_user := true;
  elsif (v_prov->>'reason') = 'already_provisioned' then
    v_username := v_prov->>'existing_uid';   -- found existing user; not a failure
    v_new_user := false;
  else
    raise exception 'provision_failed: %', coalesce(v_prov->>'reason', 'unknown');
  end if;

  if v_username is null or length(v_username) = 0 then
    raise exception 'provision_no_username';
  end if;

  -- 3. Set subscription tier (raises invalid_tier / user_not_found /
  --    akeem_locked_to_sovereign → propagates → full rollback).
  perform public.bbf_admin_set_tier(v_username, p_tier);

  -- 4. Idempotency ledger write (race-guarded by the event_id PK).
  insert into public.bbf_stripe_events
    (event_id, event_type, session_id, email, tier, username)
  values
    (p_event_id, p_event_type, p_session_id, p_email, p_tier, v_username)
  on conflict (event_id) do nothing;

  return json_build_object(
    'ok', true, 'replay', false,
    'username', v_username, 'tier', p_tier, 'new_user', v_new_user
  );
end;
$function$;
