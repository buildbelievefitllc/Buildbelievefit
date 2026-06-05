-- bbf-card-distributor — DB scaffolding for "The Distributor".
-- ─────────────────────────────────────────────────────────────────────────────
-- 1) public.bbf_get_vault_secret(text): a SECURITY DEFINER reader that lets the
--    edge function (running as service_role) pull a decrypted token out of
--    Supabase Vault by name. Locked to service_role ONLY — never anon/authenticated,
--    so a browser/JWT caller can never read a secret. This is how META_TOKEN /
--    TIKTOK_TOKEN (provisioned later by the CEO) reach the Distributor without ever
--    living in the function's env config or the client bundle (CLAUDE.md §7).
--
-- 2) Additive audit columns on bbf_calling_cards_batch_v1 (all nullable / defaulted,
--    so this never disturbs Bravo's render writes): posted_at, last_error, post_refs
--    (per-channel post ids), attempts. The Distributor writes these best-effort; the
--    status='posted' flip itself does not depend on them.
--
-- No secrets are created here. Read-only over vault; purely additive over the batch.

-- 1) Vault reader ───────────────────────────────────────────────────────────────
create or replace function public.bbf_get_vault_secret(p_name text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = p_name
  limit 1;
$$;

comment on function public.bbf_get_vault_secret(text) is
  'service_role-only reader for Supabase Vault secrets, used by bbf-card-distributor to pull social API tokens. Never grant to anon/authenticated.';

revoke all on function public.bbf_get_vault_secret(text) from public;
revoke all on function public.bbf_get_vault_secret(text) from anon;
revoke all on function public.bbf_get_vault_secret(text) from authenticated;
grant execute on function public.bbf_get_vault_secret(text) to service_role;

-- 2) Audit columns ──────────────────────────────────────────────────────────────
alter table public.bbf_calling_cards_batch_v1
  add column if not exists posted_at  timestamptz,
  add column if not exists last_error text,
  add column if not exists post_refs  jsonb,
  add column if not exists attempts   integer not null default 0;
