-- In-House Equity Mandate · research_vault → bbf-embed-research webhook trigger
-- ----------------------------------------------------------------------------
-- Any row inserted, or whose `content` is updated, is auto-vectorized: the
-- trigger fires an async pg_net POST to the bbf-embed-research edge function,
-- signed with the Vault shared secret, carrying the row id + content in the
-- standard Supabase webhook envelope. The edge fn writes back the embedding
-- column — which is NOT watched here (trigger is `OF content`), so the write
-- back cannot re-trigger. pg_net is async: the INSERT/UPDATE never blocks.
-- ----------------------------------------------------------------------------

create or replace function public.tg_research_vault_embed()
returns trigger
language plpgsql
security definer
set search_path = public, vault, extensions, net, pg_temp
as $$
declare
  v_secret text;
  v_url    text := 'https://ihclbceghxpuawymlvgi.supabase.co/functions/v1/bbf-embed-research';
begin
  -- Nothing to embed if there is no content.
  if new.content is null or length(btrim(new.content)) = 0 then
    return new;
  end if;

  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'bbf_embed_webhook_secret'
  limit 1;

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type',   'application/json',
      'x-embed-secret', coalesce(v_secret, '')
    ),
    body    := jsonb_build_object(
      'type',   tg_op,
      'table',  'research_vault',
      'record', jsonb_build_object('id', new.id, 'content', new.content)
    )
  );

  return new;
end;
$$;

comment on function public.tg_research_vault_embed() is
  'In-House Equity · async pg_net webhook → bbf-embed-research, Vault-secret signed. Trigger is OF content so the embedding write-back cannot re-fire it.';

drop trigger if exists research_vault_embed_aiu on public.research_vault;
create trigger research_vault_embed_aiu
  after insert or update of content on public.research_vault
  for each row
  execute function public.tg_research_vault_embed();
