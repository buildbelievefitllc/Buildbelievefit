-- In-House Equity Mandate · embed-webhook shared secret (zero manual injection)
-- ----------------------------------------------------------------------------
-- The research_vault → bbf-embed-research webhook authenticates with a shared
-- secret. The secret VALUE is generated inside Postgres (gen_random_uuid) and
-- stored encrypted in Supabase Vault — it never appears in migration text, git,
-- or any client bundle. The trigger reads it (SECURITY DEFINER) to sign each
-- call; the edge function reads it back via the service-role-only accessor below
-- to verify. No dashboard step, no CLI secret set.
-- ----------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'bbf_embed_webhook_secret') then
    perform vault.create_secret(
      replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
      'bbf_embed_webhook_secret',
      'Shared secret · research_vault embed webhook -> bbf-embed-research edge fn'
    );
  end if;
end $$;

-- Service-role-only accessor. The edge function (service role) calls this to
-- learn the expected secret; anon/authenticated are explicitly denied.
create or replace function public.bbf_embed_webhook_secret()
returns text
language sql
stable
security definer
set search_path = public, vault, pg_temp
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'bbf_embed_webhook_secret'
  limit 1;
$$;

revoke all on function public.bbf_embed_webhook_secret() from public, anon, authenticated;
grant execute on function public.bbf_embed_webhook_secret() to service_role;

comment on function public.bbf_embed_webhook_secret() is
  'In-House Equity · returns the embed-webhook shared secret from Vault. service_role only (edge fn verification).';
