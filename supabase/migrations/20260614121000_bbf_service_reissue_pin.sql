-- ═══════════════════════════════════════════════════════════════════════════
-- BBF SUPABASE — bbf_service_reissue_pin  (Phase 2 · welcome-email recovery)
-- ───────────────────────────────────────────────────────────────────────────
-- Service-role PIN re-issue, for the bbf-resend-welcome recovery worker.
--
-- bbf_admin_reset_user_pin (20260609170000) requires an admin SESSION token
-- (_bbf_is_admin_session) — fine for the Command Center, but the recovery worker
-- runs under the admin shared-secret / cron secret with NO admin vault session.
-- This is the same bcrypt + lockout-clear, gated ONLY to service_role, so the
-- worker can mint a fresh PIN for a PAID customer whose welcome email failed
-- (their original random PIN is unrecoverable — stored only as a bcrypt hash).
--
-- The plaintext PIN is hashed INSIDE the function; only the bcrypt digest is ever
-- persisted. Idempotent (CREATE OR REPLACE). Safe to re-apply.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.bbf_service_reissue_pin(p_uid text, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_rows integer;
begin
  if p_uid is null or length(trim(p_uid)) = 0 then
    raise exception 'missing_uid';
  end if;
  -- Numeric PIN only (client 6-digit) — reject anything else before hashing.
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

  -- Clear any lockout / failed-attempt counter so the re-issued PIN works at once.
  delete from public.bbf_pin_attempts where key = p_uid;

  return jsonb_build_object('ok', true, 'uid', p_uid);
end;
$$;

-- Service-role ONLY — never anon/authenticated (this mints credentials).
revoke all on function public.bbf_service_reissue_pin(text, text) from public, anon, authenticated;
grant execute on function public.bbf_service_reissue_pin(text, text) to service_role;

comment on function public.bbf_service_reissue_pin(text, text) is
  'Phase 2 recovery · service-role PIN re-issue for bbf-resend-welcome. Mirrors bbf_admin_reset_user_pin (bcrypt + lockout clear) but gated to service_role for the credential-dispatch recovery worker. Plaintext PIN hashed in-function; only the bcrypt digest persists.';
