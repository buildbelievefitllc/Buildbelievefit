-- 20260623130000_bbf_coach_knowledge_base.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- BBF Lab Continuous Knowledge Ecosystem · Pillar 1 — The Research Vault.
--
-- A private, founder-only catalog of structured study summaries. The CEO pastes a
-- PubMed abstract / lecture / textbook passage into the Coach Lab; the
-- bbf-coach-vault edge function asks Claude (via the model router) for a clean,
-- coaching-oriented JSON summary and stores it here. Rendered as glassmorphism
-- "Research Cards" that flip to the coaching application.
--
-- ACCESS MODEL: RLS enabled with NO anon/authenticated policies → the table is
-- fully sealed to those roles (mirrors bbf_science_digest). Every read/write goes
-- through the admin-gated bbf-coach-vault edge function using the service-role key
-- (which bypasses RLS), so the vault is reachable ONLY by the head coach.

create table if not exists public.coach_knowledge_base (
  id               uuid primary key default gen_random_uuid(),
  category         varchar(100) not null,   -- biomechanics | bioenergetics | nutrition | pediatric-athletics
  title            varchar(255) not null,
  source_citation  text,                    -- e.g. "J. Strength Cond. Res. (2026)"
  original_abstract text,                   -- truncated source text (provenance)
  claude_summary   jsonb not null,          -- { physiology_takeaways[], coaching_application, scientific_pitfalls }
  model            text,                    -- routing provenance (the model that summarized it)
  created_at       timestamptz not null default timezone('utc', now())
);

comment on table public.coach_knowledge_base is
  'BBF Lab Research Vault (Pillar 1). Founder-only study summaries. RLS on, no policies — service-role (bbf-coach-vault edge fn) access only.';

create index if not exists coach_knowledge_base_created_idx
  on public.coach_knowledge_base (created_at desc);
create index if not exists coach_knowledge_base_category_idx
  on public.coach_knowledge_base (category);

-- Seal it: RLS on, zero policies ⇒ anon/authenticated are fully denied; only the
-- service role (edge function) can touch it.
alter table public.coach_knowledge_base enable row level security;
