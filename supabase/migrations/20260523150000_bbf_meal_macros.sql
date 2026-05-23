-- ═══════════════════════════════════════════════════════════════════════
-- bbf_meal_macros · server-side cache for LLM-resolved per-meal macros.
-- ───────────────────────────────────────────────────────────────────────
-- The static bbf_meals.json catalog is small and misses custom meal names
-- that coaches write into client plans. The bbf-meal-macros edge fn calls
-- Claude Haiku for unmatched names and caches the result here so every
-- subsequent client/device gets the value for free.
--
-- Lookup key is `name_normalized` (lowercased, punctuation-stripped) so
-- client + edge fn agree on cache hits regardless of formatting drift.
-- The cache benefits every user equally; no PII attached.
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists public.bbf_meal_macros (
  id                uuid primary key default gen_random_uuid(),
  name_normalized   text not null unique,
  name_display      text not null,
  lang              text not null default 'en',
  kcal              integer not null check (kcal >= 0),
  protein_g         integer not null check (protein_g >= 0),
  carbs_g           integer not null check (carbs_g >= 0),
  fat_g             integer not null check (fat_g >= 0),
  confidence        numeric(3,2) not null default 0.70 check (confidence >= 0 and confidence <= 1),
  source            text not null default 'claude_haiku',
  ingredients_hash  text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_bbf_meal_macros_name on public.bbf_meal_macros (name_normalized);

alter table public.bbf_meal_macros enable row level security;

-- Read · anyone (anon + authenticated). Cached macro values are non-
-- sensitive and the cache benefits every user.
drop policy if exists "bbf_meal_macros_read_all" on public.bbf_meal_macros;
create policy "bbf_meal_macros_read_all"
  on public.bbf_meal_macros for select
  using (true);

-- Write · service_role only. Edge functions upsert through the service
-- role; clients can never tamper with cached values directly.
drop policy if exists "bbf_meal_macros_service_write" on public.bbf_meal_macros;
create policy "bbf_meal_macros_service_write"
  on public.bbf_meal_macros for all
  to service_role
  using (true)
  with check (true);

-- Auto-bump updated_at on upsert.
create or replace function public.bbf_meal_macros_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_bbf_meal_macros_touch on public.bbf_meal_macros;
create trigger trg_bbf_meal_macros_touch
  before update on public.bbf_meal_macros
  for each row execute function public.bbf_meal_macros_touch_updated_at();
