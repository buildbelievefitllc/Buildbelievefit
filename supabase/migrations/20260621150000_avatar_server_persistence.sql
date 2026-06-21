-- Phase 1: Avatar server persistence
-- Cross-device avatar sync to bbf_users.avatar, gated by a live vault session.
-- localStorage remains an instant client cache; the DB is the source of truth.

create or replace function public.bbf_set_avatar(p_session_token text, p_avatar text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_uid uuid;
begin
  -- Resolve identity from a live, unexpired vault session (no GoTrue).
  select s.user_id into v_uid
  from public.bbf_vault_sessions s
  where s.token::text = p_session_token
    and s.expires_at > now()
  limit 1;

  if v_uid is null then
    raise exception 'invalid_session';
  end if;

  -- Size guard: avatars are compressed ~256px JPEG data URLs (~15-70KB typical).
  -- Reject anything that would indicate an uncompressed/abusive payload.
  if p_avatar is not null and length(p_avatar) > 700000 then
    raise exception 'avatar_too_large';
  end if;

  update public.bbf_users
     set avatar = p_avatar
   where id = v_uid;

  return jsonb_build_object('ok', true);
end;
$function$;

create or replace function public.bbf_get_avatar(p_session_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_uid uuid;
  v_avatar text;
begin
  select s.user_id into v_uid
  from public.bbf_vault_sessions s
  where s.token::text = p_session_token
    and s.expires_at > now()
  limit 1;

  if v_uid is null then
    raise exception 'invalid_session';
  end if;

  select u.avatar into v_avatar
  from public.bbf_users u
  where u.id = v_uid;

  return jsonb_build_object('ok', true, 'avatar', v_avatar);
end;
$function$;

grant execute on function public.bbf_set_avatar(text, text) to anon, authenticated;
grant execute on function public.bbf_get_avatar(text) to anon, authenticated;

-- Surface the avatar in the Command Center sports roster so the CEO sees faces.
CREATE OR REPLACE FUNCTION public.bbf_admin_list_sports_athletes(p_session_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
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
      'avatar',            u.avatar,
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
$function$;
