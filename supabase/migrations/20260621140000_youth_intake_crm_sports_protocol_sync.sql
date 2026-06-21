-- 20260621140000_youth_intake_crm_sports_protocol_sync.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- LIVE OVERSIGHT SYNC. The in-app YouthIntake now stages the Native Sport Engine
-- protocol into bbf_active_clients.sports_protocol (the CRM table the Command Center
-- Sports Portal reads), keyed by the athlete's email — synchronously, in the same
-- RPC, no external call. So when an athlete completes OR changes their intake, the
-- Command Center reflects their current sport/phase immediately, with zero delay.
-- (Preserves the PAR-Q write, the athlete_profiles upsert, and the dietary safety net.)

CREATE OR REPLACE FUNCTION public.bbf_submit_youth_intake(p_uid text, p_session_token text, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id         uuid;
  v_now             timestamptz := now();
  v_yes             int;
  v_classified      text;
  v_snapshot        jsonb;
  v_birth           date;
  v_age             int;
  v_tier            text;
  v_gender          text;
  v_sport           text := nullif(p_payload->>'sport', '');
  v_position        text := nullif(p_payload->>'position', '');
  v_dietary         text[];
  v_email           text;
  v_name            text;
  v_locale          text;
  v_sports_protocol text;
  v_crm_synced      boolean := false;
begin
  if p_session_token is null or length(p_session_token) = 0 then
    return json_build_object('ok', false, 'error', 'invalid_session');
  end if;

  select s.user_id into v_user_id
    from public.bbf_vault_sessions s
    join public.bbf_users u on u.id = s.user_id and u.deleted_at is null
   where s.token::text = p_session_token
     and s.expires_at > now()
   limit 1;

  if v_user_id is null then
    return json_build_object('ok', false, 'error', 'invalid_session');
  end if;

  -- Identity bits for the CRM oversight sync (resolved server-side, never trusted from client).
  select email, name, coalesce(nullif(preferred_locale, ''), 'en')
    into v_email, v_name, v_locale
    from public.bbf_users where id = v_user_id;

  select count(*) into v_yes
    from jsonb_each(coalesce(p_payload->'answers', '{}'::jsonb)) e
   where e.value in ('true'::jsonb, '"yes"'::jsonb);
  v_classified := case when v_yes = 0 then 'self_attested'
                       when v_yes = 1 then 'restricted'
                       else 'contraindicated' end;

  v_snapshot := coalesce(p_payload, '{}'::jsonb) || jsonb_build_object(
    'version',     'parq+_2014',
    'classified',  v_classified,
    'screened_at', to_jsonb(v_now),
    'attested_by', p_uid,
    'source',      'youth_intake_gate'
  );

  update public.bbf_users
     set par_q_screen      = v_snapshot,
         par_q_screened_at = v_now,
         cardiac_clearance = v_classified,
         sport             = coalesce(v_sport, sport),
         "position"        = coalesce(v_position, "position")
   where id = v_user_id;

  begin
    v_birth := nullif(p_payload->>'birth_date', '')::date;
  exception when others then
    v_birth := null;
  end;

  v_gender := lower(nullif(p_payload->>'gender', ''));
  if v_gender not in ('male', 'female', 'coed') then
    v_gender := null;
  end if;

  v_dietary := coalesce(
    (select array_agg(x) from jsonb_array_elements_text(coalesce(p_payload->'dietary_restrictions', '[]'::jsonb)) x),
    '{}'::text[]
  );

  if v_birth is not null and v_sport is not null then
    v_age := extract(year from age(v_birth))::int;
    v_tier := case
                when v_age < 12 then 'youth'
                when v_age < 15 then 'middle_school'
                when v_age < 18 then 'high_school'
                else 'collegiate'
              end;

    insert into public.athlete_profiles
      (user_id, full_name, birth_date, gender, sport, "position", current_tier, preferred_language, dietary_restrictions)
    select v_user_id,
           coalesce(nullif(u.name, ''), p_uid, 'Athlete'),
           v_birth, v_gender, v_sport, v_position, v_tier,
           coalesce(nullif(u.preferred_locale, ''), 'en'),
           v_dietary
      from public.bbf_users u
     where u.id = v_user_id
    on conflict (user_id) do update set
      full_name            = excluded.full_name,
      birth_date           = excluded.birth_date,
      gender               = excluded.gender,
      sport                = excluded.sport,
      "position"           = excluded."position",
      current_tier         = excluded.current_tier,
      preferred_language   = excluded.preferred_language,
      dietary_restrictions = excluded.dietary_restrictions;
  end if;

  -- ── LIVE CRM OVERSIGHT SYNC ─────────────────────────────────────────────────
  -- Stage the client-built Native Sport Engine protocol into bbf_active_clients so
  -- the Command Center Sports Portal reflects this athlete's CURRENT sport/phase.
  -- Update every CRM row on the athlete's email; create one if none exists yet.
  v_sports_protocol := case
    when p_payload ? 'sports_protocol' and jsonb_typeof(p_payload->'sports_protocol') = 'object'
    then (p_payload->'sports_protocol')::text
    else null
  end;

  if v_email is not null and v_email <> '' and v_sports_protocol is not null then
    update public.bbf_active_clients
       set sports_protocol = v_sports_protocol,
           updated_at      = now()
     where lower(vault_email) = lower(v_email);
    if not found then
      insert into public.bbf_active_clients
        (vault_email, client_email, client_name, age, onboarding_status, preferred_language, sports_protocol)
      values
        (v_email, v_email, coalesce(nullif(v_name, ''), p_uid, 'Athlete'), v_age, 'Pending', v_locale, v_sports_protocol);
    end if;
    v_crm_synced := true;
  end if;

  return json_build_object(
    'ok', true,
    'screened_at', v_now,
    'cardiac_clearance', v_classified,
    'sport', v_sport,
    'position', v_position,
    'current_tier', v_tier,
    'dietary_restrictions', to_jsonb(v_dietary),
    'crm_synced', v_crm_synced
  );
end;
$function$;
