-- Admin PIN reset — fills the gap between bbf_provision_client_pin (initial provisioning,
-- which refuses an already-provisioned user) and bbf_verify_user_pin (login-time lazy
-- bcrypt). Lets a verified admin SESSION reset/establish a client's PIN with a correctly
-- generated bcrypt hash (extensions.crypt + gen_salt('bf') — identical to provisioning),
-- and clears any stale lockout / failed-attempt counter so the account is immediately
-- accessible. Self-validating admin gate mirrors the Command Center override RPCs
-- (_bbf_is_admin_session, migration 20260609150000). The plaintext PIN is hashed inside
-- the RPC; only the bcrypt digest is ever persisted — never a raw/plaintext value.

create or replace function public.bbf_admin_reset_user_pin(
  p_session_token text,
  p_uid           text,
  p_pin           text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_rows    integer;
  v_cleared integer;
begin
  if not public._bbf_is_admin_session(p_session_token) then
    raise exception 'not_authorized';
  end if;
  if p_uid is null or length(trim(p_uid)) = 0 then
    raise exception 'missing_uid';
  end if;
  -- PINs are numeric (client 4-digit / admin 6-digit). Reject anything else so a
  -- malformed value can never reach the hash.
  if p_pin is null or p_pin !~ '^[0-9]{4,8}$' then
    raise exception 'invalid_pin';
  end if;

  update public.bbf_users
     set pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf'))
   where uid = p_uid
     and deleted_at is null;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'user_not_found';
  end if;

  -- Clear any lockout / failed-attempt counter so login is immediately accessible.
  delete from public.bbf_pin_attempts where key = p_uid;
  get diagnostics v_cleared = row_count;

  return jsonb_build_object('ok', true, 'uid', p_uid, 'rows', v_rows, 'lockout_cleared', v_cleared);
end;
$$;

revoke all on function public.bbf_admin_reset_user_pin(text, text, text) from public;
grant execute on function public.bbf_admin_reset_user_pin(text, text, text) to anon, authenticated, service_role;
