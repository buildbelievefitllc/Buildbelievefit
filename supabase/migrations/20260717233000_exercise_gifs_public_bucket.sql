-- 20260717150000_exercise_gifs_public_bucket.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Exercise-GIF asset bucket — public CDN home for the Dual-Media quick-view
-- loops (frontend/src/components/vault/exerciseGifs.js resolves against
-- /storage/v1/object/public/exercise-gifs/<file>).
--
-- Read posture: PUBLIC. The bucket flag serves anonymous reads via the public
-- object endpoint; the explicit SELECT policy below additionally covers the
-- storage-API list/download path for anon + authenticated.
-- Write posture: SERVICE-ROLE ONLY. No INSERT/UPDATE/DELETE policies are
-- created, so client roles cannot upload or overwrite assets — ingestion runs
-- through the service key exclusively (CLAUDE.md §7).
--
-- Applied via mcp apply_migration per DATABASE_SAFETY.md RULE 2. The ledger
-- will stamp its own version for this file — expected, do not repair.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('exercise-gifs', 'exercise-gifs', true, 8388608, array['image/gif'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "exercise_gifs_public_read" on storage.objects;
create policy "exercise_gifs_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'exercise-gifs');
