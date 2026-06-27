// scripts/bake-coach-static.mjs
// ═══════════════════════════════════════════════════════════════════════════
// MARGIN GUARD — ONE-SHOT driver for the static coach-cue bake.
// ───────────────────────────────────────────────────────────────────────────
// Reads the committed cue table (scripts/coach-static-scripts.json), batches the
// 110 slugs × en/es/pt, and POSTs the cue text to the bbf-bake-coach-static edge
// function, which synthesizes each in Coach Akeem's voice (ElevenLabs) and uploads
// the MP3 to the public `coach-static` Storage bucket. Idempotent: the function
// skips clips already in the bucket, so re-running only fills gaps. After this,
// run scripts/sync-coach-static.mjs to pull the clips into the repo.
//
// Run ONCE (the CEO-authorized one-time generation). Required env:
//   BAKE_URL     edge function URL (default: bbf-lab project)
//   BAKE_ANON    Supabase anon/publishable key (gateway apikey)
//   BAKE_SECRET  bbf_app_config.coach_static_bake_secret
// Optional: OUTPUT_FORMAT (default mp3_44100_64), BATCH (default 18).
//
//   BAKE_ANON=… BAKE_SECRET=… node scripts/bake-coach-static.mjs
// ═══════════════════════════════════════════════════════════════════════════

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SCRIPTS = path.join(ROOT, 'scripts/coach-static-scripts.json');

const URL_ = process.env.BAKE_URL || 'https://ihclbceghxpuawymlvgi.supabase.co/functions/v1/bbf-bake-coach-static';
const ANON = process.env.BAKE_ANON || '';
const SECRET = process.env.BAKE_SECRET || '';
const OUTPUT_FORMAT = process.env.OUTPUT_FORMAT || 'mp3_44100_64';
const BATCH = Math.max(1, Math.min(60, Number(process.env.BATCH) || 18));
const LOCALES = ['en', 'es', 'pt'];

if (!ANON || !SECRET) {
  console.error('✗ BAKE_ANON and BAKE_SECRET are required (see header).');
  process.exit(1);
}

function headers() {
  return {
    'Content-Type': 'application/json',
    apikey: ANON,
    Authorization: `Bearer ${ANON}`,
    'x-bbf-bake-secret': SECRET,
  };
}

async function postBatch(clips, attempt = 1) {
  try {
    const res = await fetch(URL_, { method: 'POST', headers: headers(), body: JSON.stringify({ clips, output_format: OUTPUT_FORMAT }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.ok) throw new Error(j.error ? `${j.error}${j.detail ? ' — ' + j.detail : ''}` : `HTTP ${res.status}`);
    return j;
  } catch (e) {
    if (attempt < 4) {
      await new Promise((r) => setTimeout(r, 2 ** attempt * 1000));
      return postBatch(clips, attempt + 1);
    }
    throw e;
  }
}

async function main() {
  const table = JSON.parse(fs.readFileSync(SCRIPTS, 'utf8'));
  const clips = [];
  for (const slug of Object.keys(table)) {
    for (const lc of LOCALES) {
      const text = table[slug]?.[lc];
      if (text) clips.push({ path: `${slug}.${lc}.mp3`, text });
    }
  }
  console.log(`baking ${clips.length} clips (${Object.keys(table).length} slugs × ${LOCALES.length}) · format ${OUTPUT_FORMAT} · batch ${BATCH}`);

  let baked = 0; let skipped = 0; const failed = [];
  for (let i = 0; i < clips.length; i += BATCH) {
    const batch = clips.slice(i, i + BATCH);
    try {
      const r = await postBatch(batch);
      baked += r.baked || 0;
      skipped += r.skipped_existing || 0;
      if (Array.isArray(r.failed)) failed.push(...r.failed);
      console.log(`  [${Math.min(i + BATCH, clips.length)}/${clips.length}] baked=${r.baked} skipped=${r.skipped_existing} failed=${r.failed?.length || 0}`);
    } catch (e) {
      console.error(`  ✗ batch @${i}: ${e.message}`);
      for (const c of batch) failed.push({ path: c.path, detail: e.message });
    }
  }

  console.log(`\n✓ bake complete: ${baked} baked · ${skipped} already present · ${failed.length} failed`);
  if (failed.length) {
    console.log('  failures:', failed.slice(0, 15).map((f) => `${f.path} (${f.detail})`).join('; ') + (failed.length > 15 ? ` … +${failed.length - 15}` : ''));
    process.exitCode = 2;
  } else {
    console.log('  → now run: node scripts/sync-coach-static.mjs');
  }
}

main().catch((e) => { console.error('✗', e.message); process.exit(1); });
