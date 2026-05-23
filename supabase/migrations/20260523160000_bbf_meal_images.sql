-- ═══════════════════════════════════════════════════════════════════════
-- bbf_meal_macros · image enrichment columns + meal-images storage bucket
-- ───────────────────────────────────────────────────────────────────────
-- The macros pipeline (Build B) keyed every meal by name_normalized.
-- This migration co-locates the generated meal image on the same row so
-- one cache layer serves both enrichments. A public Supabase Storage
-- bucket holds the PNG; the row stores its public URL.
-- ═══════════════════════════════════════════════════════════════════════

alter table public.bbf_meal_macros
  add column if not exists image_url           text,
  add column if not exists image_generated_at  timestamptz,
  add column if not exists image_prompt_used   text;

create index if not exists idx_bbf_meal_macros_has_image
  on public.bbf_meal_macros (name_normalized)
  where image_url is not null;

-- Public storage bucket for meal photos. Public so the <img> tag works
-- with no auth header · contents are non-sensitive (LLM-generated food
-- photography). Service role inserts/updates only.
insert into storage.buckets (id, name, public)
values ('meal-images', 'meal-images', true)
on conflict (id) do nothing;

drop policy if exists "meal_images_public_read" on storage.objects;
create policy "meal_images_public_read"
  on storage.objects for select
  using (bucket_id = 'meal-images');

drop policy if exists "meal_images_service_write" on storage.objects;
create policy "meal_images_service_write"
  on storage.objects for all
  to service_role
  using (bucket_id = 'meal-images')
  with check (bucket_id = 'meal-images');
