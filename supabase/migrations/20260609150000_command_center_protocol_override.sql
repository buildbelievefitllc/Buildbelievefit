-- Command Center manual override (read + force-update the engine payloads). Admin
-- self-validating RPCs (session token → admin role) — the bbf_validate_vault_session /
-- bbf_admin_set_tier pattern — so the Command Center calls them directly via
-- supabaseClient.rpc() WITHOUT re-deploying the 940-line bbf-admin-roster monolith.
-- The Commander never surrenders manual override of the Autonomous Referee.

create or replace function public._bbf_is_admin_session(p_session_token text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_uid uuid; v_role text; v_slug text;
begin
  if p_session_token is null or length(p_session_token) = 0 then return false; end if;
  v_uid := public._bbf_uid_from_vault_token(p_session_token);
  if v_uid is null then return false; end if;
  select role, uid into v_role, v_slug from public.bbf_users where id = v_uid and deleted_at is null limit 1;
  return (lower(coalesce(v_role, '')) in ('admin','trainer','coach') or lower(coalesce(v_slug, '')) = 'akeem');
end;
$$;

create or replace function public.bbf_admin_get_sports_protocol(p_session_token text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_email text; v_sp text;
begin
  if not public._bbf_is_admin_session(p_session_token) then raise exception 'not_authorized'; end if;
  select email into v_email from public.bbf_users where id = p_id and deleted_at is null limit 1;
  if v_email is null then return null; end if;
  select sports_protocol into v_sp from public.bbf_active_clients where vault_email = v_email limit 1;
  if v_sp is null then return null; end if;
  begin return v_sp::jsonb; exception when others then return jsonb_build_object('raw', v_sp); end;
end;
$$;

create or replace function public.bbf_admin_set_sports_protocol(p_session_token text, p_id uuid, p_protocol jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_email text; v_n integer;
begin
  if not public._bbf_is_admin_session(p_session_token) then raise exception 'not_authorized'; end if;
  if p_protocol is null then raise exception 'missing_protocol'; end if;
  select email into v_email from public.bbf_users where id = p_id and deleted_at is null limit 1;
  if v_email is null then raise exception 'athlete_not_found'; end if;
  update public.bbf_active_clients set sports_protocol = p_protocol::text where vault_email = v_email;
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'rows', v_n, 'phase_number', p_protocol->>'phase_number');
end;
$$;

create or replace function public.bbf_admin_set_meal_plan(p_session_token text, p_id uuid, p_plan jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_email text; v_stamp timestamptz := now();
begin
  if not public._bbf_is_admin_session(p_session_token) then raise exception 'not_authorized'; end if;
  if p_plan is null then raise exception 'missing_plan'; end if;
  select email into v_email from public.bbf_users where id = p_id and deleted_at is null limit 1;
  if v_email is null then raise exception 'athlete_not_found'; end if;
  update public.bbf_users set meal_plan = p_plan::text, plans_generated_at = v_stamp where id = p_id;
  update public.bbf_active_clients set meal_plan = p_plan::text, plans_generated_at = v_stamp where vault_email = v_email;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public._bbf_is_admin_session(text)                              from public;
grant execute on function public.bbf_admin_get_sports_protocol(text, uuid)             to anon, authenticated, service_role;
grant execute on function public.bbf_admin_set_sports_protocol(text, uuid, jsonb)      to anon, authenticated, service_role;
grant execute on function public.bbf_admin_set_meal_plan(text, uuid, jsonb)            to anon, authenticated, service_role;
grant execute on function public._bbf_is_admin_session(text)                           to anon, authenticated, service_role;
