-- ═══════════════════════════════════════════════════════════════════════════
-- BBF — ADMIN WEARABLE READINESS READ (live dossier telemetry)
-- ═══════════════════════════════════════════════════════════════════════════
-- Admin-only read of an athlete's latest bbf_wearable_readings row (HRV, sleep,
-- strain, recovery, resting HR) + the live ACWR, for the Command Center dossier.
-- Authorized by the ADMIN'S OWN vault session token via _bbf_is_admin_session()
-- (the override-RPC pattern). bbf_wearable_readings is RLS-forced with zero policies,
-- so this SECURITY DEFINER function is the only admin read path — no secret, no
-- direct table grant. Mirrors the athlete-gated bbf_get_wearable_readiness, but keyed
-- to a target uid and gated on an admin session instead of the athlete's own token.

create or replace function public.bbf_admin_get_wearable_readiness(
  p_session_token text,
  p_uid           text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user_id uuid;
  v_reading jsonb;
  v_date    date;
  v_acwr    jsonb;
begin
  if not public._bbf_is_admin_session(p_session_token) then
    return jsonb_build_object('ok', false, 'error', 'not_authorized');
  end if;

  select id into v_user_id
    from public.bbf_users
   where uid = lower(coalesce(p_uid, '')) and deleted_at is null
   limit 1;
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'unknown_user');
  end if;

  -- Latest reading (any source) — newest calendar day, then newest record.
  select to_jsonb(r), r.reading_date into v_reading, v_date
  from (
    select reading_date, source, readiness_score, strain, resting_hr, hrv_ms, sleep_minutes, recorded_at
      from public.bbf_wearable_readings
     where user_id = v_user_id
     order by reading_date desc, recorded_at desc
     limit 1
  ) r;

  v_acwr := public._bbf_wearable_acwr(v_user_id, coalesce(v_date, current_date));

  return jsonb_build_object(
    'ok', true,
    'uid', lower(p_uid),
    'has_data', (v_reading is not null),
    'reading', v_reading,
    'acwr', v_acwr
  );
end;
$function$;

revoke all on function public.bbf_admin_get_wearable_readiness(text, text) from public;
grant execute on function public.bbf_admin_get_wearable_readiness(text, text) to anon, authenticated, service_role;
