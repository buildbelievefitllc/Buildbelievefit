-- 20260712130000_content_vault.sql
-- Marketing Content Vault — staged HeyGen video assets for the Digital Content
-- Manager (Marketing Vault grid + TikTok Manual Bridge). Applied to project
-- ihclbceghxpuawymlvgi via MCP apply_migration; mirrored here for version control.
--
-- RLS: SELECT is open (rows are public marketing CDN URLs + placeholder captions);
-- INSERT/UPDATE/DELETE have NO policies, so writes stay service-role only (the
-- seat/edit pipeline runs server-side). Realtime publishes row changes to the grid.

create extension if not exists pgcrypto;

create table if not exists public.content_vault (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  video_url        text not null,
  caption_body     text not null default 'STAGED MARKETING HOOK PLACEHOLDER',
  status           text not null default 'staged' check (status in ('staged', 'queued', 'published')),
  platform_targets text[] not null default '{}',
  bgm_source_url   text,
  created_at       timestamptz not null default now()
);

-- title unique (idempotent add)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'content_vault_title_key') then
    alter table public.content_vault add constraint content_vault_title_key unique (title);
  end if;
end $$;

alter table public.content_vault enable row level security;

-- Public READ policy (writes remain service-role only).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'content_vault' and policyname = 'content_vault_public_read'
  ) then
    create policy content_vault_public_read on public.content_vault for select using (true);
  end if;
end $$;

-- Realtime stream for the dashboard grid.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'content_vault'
     )
  then
    alter publication supabase_realtime add table public.content_vault;
  end if;
end $$;

comment on table public.content_vault is 'Marketing content vault — staged HeyGen video assets for the Digital Content Manager. RLS: public SELECT, service-role-only writes.';
comment on column public.content_vault.bgm_source_url is 'Optional background-music source muxed under the avatar VO; null when no genuine BGM was provided.';
