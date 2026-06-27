-- supabase/migrations/20260627000000_bbf_coach_static_bucket.sql
-- MARGIN GUARD — Storage home + bake gate for the STATIC coach-cue library
-- (program form cues + prehab drills). bbf-bake-coach-static synthesizes the
-- library ONCE via ElevenLabs and uploads each clip here; scripts/sync-coach-static.mjs
-- pulls them into the repo (frontend/public/media/coach-static/). Public-read so the
-- sync (and, as a CDN fallback, the app) can fetch without a token; service-write only.

insert into storage.buckets (id, name, public)
values ('coach-static', 'coach-static', true)
on conflict (id) do nothing;

drop policy if exists "coach_static_public_read" on storage.objects;
create policy "coach_static_public_read"
  on storage.objects for select
  using (bucket_id = 'coach-static');

drop policy if exists "coach_static_service_write" on storage.objects;
create policy "coach_static_service_write"
  on storage.objects for all
  to service_role
  using (bucket_id = 'coach-static')
  with check (bucket_id = 'coach-static');

-- Shared-secret gate for the one-time baker. Generated server-side (64 hex chars) so
-- no secret literal ever lands in the repo. Idempotent — a re-run never rotates it.
insert into public.bbf_app_config (key, value)
values (
  'coach_static_bake_secret',
  replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
)
on conflict (key) do nothing;
