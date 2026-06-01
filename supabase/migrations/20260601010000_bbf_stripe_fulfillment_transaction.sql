-- ═══════════════════════════════════════════════════════════════
-- Transactional armor · bbf_stripe_fulfillment_transaction
-- ───────────────────────────────────────────────────────────────
-- Wraps the entire Stripe fulfillment write-path into ONE atomic
-- transaction so a mid-sequence DB failure can't leave a split-brain
-- state (e.g. a provisioned vault user with no idempotency-ledger row,
-- or an active-client row with no user). If any step raises, the whole
-- transaction rolls back; Stripe's retry then reprocesses cleanly.
--
-- Sequence (order is load-bearing — bbf_provision_client_pin REQUIRES
-- the bbf_active_clients row to exist first):
--   0. Replay guard: if event_id already in the ledger → no-op replay.
--   1. Insert bbf_active_clients (idempotent by vault_email).
--   2. bbf_provision_client_pin  (creates the vault user; idempotent —
--      'already_provisioned' is treated as success, not a failure).
--   3. bbf_admin_set_tier        (RAISES on invalid tier/uid → rollback).
--   4. Insert bbf_stripe_events ledger row (race-guarded ON CONFLICT).
--
-- Returns json: { ok, replay, username, tier, new_user }.
-- SECURITY DEFINER + locked search_path. Called by the stripe-webhook
-- edge function (service role).
-- ═══════════════════════════════════════════════════════════════

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
