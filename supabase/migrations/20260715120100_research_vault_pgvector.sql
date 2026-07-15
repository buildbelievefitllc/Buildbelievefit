-- In-House Equity Mandate · native pgvector Research Vault (search stays in-DB)
-- ----------------------------------------------------------------------------
-- The entire semantic index and its queries live in our own Postgres. Embeddings
-- are 384-dim (Supabase Edge native gte-small); search is a native cosine (<=>)
-- operator behind an RPC. No hosted vector service, no outbound search call.
-- ----------------------------------------------------------------------------

create extension if not exists vector;

create table if not exists public.research_vault (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  category    text,
  abstract    text,
  content     text,
  embedding   vector(384),
  created_at  timestamptz not null default now()
);

comment on table public.research_vault is
  'In-House Equity · Research Vault corpus. embedding is gte-small (384-dim), populated by the bbf-embed-research edge fn via the AFTER INSERT/UPDATE OF content webhook. Cosine search via query_research_embeddings().';

-- Approximate-NN index (cosine). Lists sized for a small-but-growing corpus.
create index if not exists research_vault_embedding_idx
  on public.research_vault
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- RLS: authenticated may READ; writes remain service-role only (bypasses RLS).
alter table public.research_vault enable row level security;

drop policy if exists research_vault_auth_read on public.research_vault;
create policy research_vault_auth_read
  on public.research_vault
  for select
  to authenticated
  using (true);

-- Native cosine similarity search. similarity = 1 - cosine_distance.
create or replace function public.query_research_embeddings(
  query_embedding vector(384),
  match_threshold float default 0.0,
  match_count     int   default 5
)
returns table (
  id         uuid,
  title      text,
  category   text,
  abstract   text,
  similarity float
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    rv.id,
    rv.title,
    rv.category,
    rv.abstract,
    (1 - (rv.embedding <=> query_embedding))::float as similarity
  from public.research_vault rv
  where rv.embedding is not null
    and (1 - (rv.embedding <=> query_embedding)) >= match_threshold
  order by rv.embedding <=> query_embedding   -- nearest first (ascending distance)
  limit greatest(match_count, 1);
$$;

comment on function public.query_research_embeddings(vector, float, int) is
  'In-House Equity · native cosine (<=>) search over research_vault. Zero external search API.';

grant execute on function public.query_research_embeddings(vector, float, int)
  to authenticated, service_role;
