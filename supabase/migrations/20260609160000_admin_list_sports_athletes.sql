-- Command Center Sports Portal roster: every athlete with a staged sports_protocol,
-- joined to bbf_users so the admin can drill into ClientDossier (keyed on bbf_users id)
-- and use the manual overrides. Admin self-validating (the override-RPC pattern).
create or replace function public.bbf_admin_list_sports_athletes(p_session_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_rows jsonb;
begin
  if not public._bbf_is_admin_session(p_session_token) then raise exception 'not_authorized'; end if;
  select coalesce(jsonb_agg(r order by r->>'name'), '[]'::jsonb) into v_rows
  from (
    select jsonb_build_object(
      'id',                u.id,
      'user_id',           u.id,
      'uid',               u.uid,
      'name',              coalesce(nullif(u.name, ''), ac.client_name, u.uid),
      'email',             u.email,
      'subscription_tier', u.subscription_tier,
      'sport',             coalesce(nullif(ac.sports_protocol::jsonb->>'sport', ''), 'General'),
      'phase_number',      (ac.sports_protocol::jsonb->>'phase_number'),
      'current_phase',     (ac.sports_protocol::jsonb->>'current_phase')
    ) as r
    from public.bbf_active_clients ac
    join public.bbf_users u
      on lower(u.email) = lower(ac.vault_email) and u.deleted_at is null
    where ac.sports_protocol is not null
  ) s;
  return v_rows;
end;
$$;

revoke all on function public.bbf_admin_list_sports_athletes(text) from public;
grant execute on function public.bbf_admin_list_sports_athletes(text) to anon, authenticated, service_role;
