-- AI Studio · Science Hub — weekly exercise-science digest cache.
-- Applied to project ihclbceghxpuawymlvgi via apply_migration (mirrored here for
-- repo source-of-truth). Written only by the bbf-science-digest edge function
-- (service role); RLS enabled with NO policies, so anon/authenticated roles have
-- no direct access. The function reads/writes via the service-role key (bypasses RLS).
-- `scope` is the per-language cache key, e.g. 'exercise-science:en' / ':es' / ':pt'.

create table if not exists public.bbf_science_digest (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'exercise-science',
  items jsonb not null,
  model text,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists bbf_science_digest_scope_gen_idx
  on public.bbf_science_digest (scope, generated_at desc);

alter table public.bbf_science_digest enable row level security;

comment on table public.bbf_science_digest is
  'Weekly exercise-science digest cache for the AI Studio Science Hub. Written only by the bbf-science-digest edge function (service role). RLS is enabled with NO policies, so anon/authenticated roles have no direct access; the function reads/writes via the service-role key which bypasses RLS.';
