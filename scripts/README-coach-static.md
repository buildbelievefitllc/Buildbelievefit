# Static Coach-Cue Library — Margin Guard

Hybrid audio architecture for BBF: **standardized, unchanging coaching cues are
static assets** (zero ElevenLabs spend per play); only **personalized** audio
(Sovereign Check-ins, Weekly Briefs, live RPE, affirmations) stays dynamic.

This covers the **exercise library**: every authorized program movement (Program
tab) and every prehab diagnostic-matrix drill (Prehab tab) — **110 slugs ×
en/es/pt = 330 clips**, all in Coach Akeem's cloned voice
(`ZbKDEqxkr8Ub4psNm5XD`, `eleven_multilingual_v2`).

## Pieces

| File | Role |
|---|---|
| `scripts/program_cues.authored.json` | Authored trilingual form cues for the 35 canonical program movements (Akeem "Floor Coach" voice). |
| `scripts/build-coach-static-manifest.mjs` | **Source of truth builder** (no API). Derives the 75 prehab cues from `prehabDiagnosticMatrix.json` (already trilingual) + program cues, emits the two generated artifacts below. |
| `frontend/src/data/coachStaticManifest.json` | GENERATED — lean client resolver (name→slug, slug list, kind). No script text ships to the browser. |
| `scripts/coach-static-scripts.json` | GENERATED — the slug→{en,es,pt} cue table the baker driver feeds. |
| `supabase/functions/bbf-bake-coach-static/` | Stateless ElevenLabs synth-proxy: takes `{path,text}` clips, uploads MP3s to the public `coach-static` Storage bucket. Secret-gated (`bbf_app_config.coach_static_bake_secret`). |
| `scripts/bake-coach-static.mjs` | **One-shot driver** — feeds the cue table to the baker in batches. |
| `scripts/sync-coach-static.mjs` | Mirrors the baked clips from the bucket into `frontend/public/media/coach-static/` (repo-static). |
| `frontend/src/components/vault/CoachVoiceNote.jsx` | Lazy static `<audio>` player. Slug mode serves from `/media/coach-static/` and falls back to the bucket CDN on a 404. |

## Regenerate (one-shot)

The clips were baked once (CEO-authorized). To rebuild after editing cues/catalog:

```bash
# 1. Rebuild the manifest + cue table from source (no API)
node scripts/build-coach-static-manifest.mjs

# 2. Bake via ElevenLabs → public coach-static bucket (needs the bake secret + anon key)
#    Keep concurrency low: the ElevenLabs plan caps concurrent synths.
BAKE_ANON=<supabase anon key> BAKE_SECRET=<coach_static_bake_secret> \
  node scripts/bake-coach-static.mjs

# 3. Mirror the bucket into the repo (needs egress to *.supabase.co)
node scripts/sync-coach-static.mjs

# 4. Verify the frontend
cd frontend && npm run lint && npm run build
```

The baker is idempotent — it skips clips already in the bucket, so re-running only
fills gaps. `bake-coach-static.mjs` retries failed batches; if your ElevenLabs plan
has a low concurrency cap, run smaller `BATCH` values sequentially.

## Notes

- Adding a program movement: add it (with aliases) to `PROGRAM_CANON` in the
  builder and an entry in `program_cues.authored.json`; the build fails loudly if
  any catalog movement is unmapped, guaranteeing 100% coverage.
- Prehab cues are **derived** from the matrix — no hand-authoring; add a drill to
  `prehabDiagnosticMatrix.json` and rebuild.
- Delivery: `CoachVoiceNote` prefers the repo path `/media/coach-static/`; until
  `sync-coach-static.mjs` mirrors the clips in, it auto-falls-back to the public
  bucket CDN, so the clips are live in production either way (still 100% static).
