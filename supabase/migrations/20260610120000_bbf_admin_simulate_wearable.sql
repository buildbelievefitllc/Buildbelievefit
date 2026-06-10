-- ═══════════════════════════════════════════════════════════════════════════
-- BBF — ADMIN WEARABLE SIMULATION (Dev Tools "Simulate CNS Breach")
-- ═══════════════════════════════════════════════════════════════════════════
-- Admin-only entry point for the Command Center Dev Tools panel: pushes a
-- simulated wearable reading (e.g. a compromised Health Connect sync — HRV<35,
-- sleep<240) for a target athlete, then returns the recomputed ACWR.
--
-- SECURITY: authorized by the ADMIN'S OWN vault session token via
-- _bbf_is_admin_session() — the exact self-validating pattern the Command Center
-- override RPCs use. It then calls the SAME ingest the bbf-wearable-ingest webhook
-- path runs (bbf_ingest_wearable_reading_admin). The shared webhook secret
-- (`wearable_ingest_token`) is NEVER exposed to the client — the admin proves
-- identity with their session, the privileged ingest stays server-side. This is the
-- secure equivalent of the webhook; it does not, and must not, ship a Vault secret
-- into the browser bundle (CLAUDE.md §7).

create or replace function public.bbf_admin_simulate_wearable(
  p_session_token text,
  p_uid           text,
  p_source        text,
  p_reading       jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user_id uuid;
  v_ingest  jsonb;
  v_date    date;
  v_acwr    jsonb;
  v_src     text := lower(coalesce(p_source, 'manual'));
begin
  if not public._bbf_is_admin_session(p_session_token) then
    return jsonb_build_object('ok', false, 'error', 'not_authorized');
  end if;
  if v_src not in ('whoop', 'apple', 'oura', 'manual') then v_src := 'manual'; end if;

  select id into v_user_id
    from public.bbf_users
   where uid = lower(coalesce(p_uid, '')) and deleted_at is null
   limit 1;
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'unknown_user');
  end if;

  -- Same privileged ingest the live webhook path calls (validates + upserts).
  v_ingest := public.bbf_ingest_wearable_reading_admin(v_user_id, v_src, p_reading);
  if coalesce((v_ingest->>'ok')::boolean, false) is not true then
    return v_ingest;  -- surface invalid_strain / missing_reading_date / unknown_user
  end if;

  v_date := nullif(p_reading->>'reading_date', '')::date;
  v_acwr := public._bbf_wearable_acwr(v_user_id, coalesce(v_date, current_date));

  return jsonb_build_object(
    'ok', true,
    'uid', lower(p_uid),
    'source', v_src,
    'reading_id', v_ingest->'reading_id',
    'acwr', v_acwr
  );
end;
$function$;

revoke all on function public.bbf_admin_simulate_wearable(text, text, text, jsonb) from public;
grant execute on function public.bbf_admin_simulate_wearable(text, text, text, jsonb) to anon, authenticated, service_role;
