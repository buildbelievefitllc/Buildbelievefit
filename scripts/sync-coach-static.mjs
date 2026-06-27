// scripts/sync-coach-static.mjs
// ═══════════════════════════════════════════════════════════════════════════
// MARGIN GUARD — pull the baked static coach cues from the public `coach-static`
// Supabase Storage bucket into the repo at frontend/public/media/coach-static/,
// so the app serves them as repo-static assets (ZERO ElevenLabs spend at runtime).
//
// Run ONCE after bbf-bake-coach-static has finished uploading (GET ?status=1 →
// remaining: 0). Idempotent: skips files already present unless --force. Reads the
// slug list from the generated client manifest (single source of truth).
//
//   node scripts/sync-coach-static.mjs            # download missing clips
//   node scripts/sync-coach-static.mjs --force    # re-download everything
//   COACH_STATIC_BASE=<url> node scripts/sync-coach-static.mjs   # override bucket base
// ═══════════════════════════════════════════════════════════════════════════

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'frontend/public/media/coach-static');
const MANIFEST = path.join(ROOT, 'frontend/src/data/coachStaticManifest.json');

const LOCALES = ['en', 'es', 'pt'];
const FORCE = process.argv.includes('--force');
// Public base for the bbf-lab project's coach-static bucket (override via env).
const BASE = (process.env.COACH_STATIC_BASE
  || 'https://ihclbceghxpuawymlvgi.supabase.co/storage/v1/object/public/coach-static').replace(/\/+$/, '');

async function fetchWithRetry(url, attempts = 4) {
  let lastErr;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(url);
      if (res.ok) return Buffer.from(await res.arrayBuffer());
      if (res.status === 404) return null; // not baked yet → report, don't retry
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (e) { lastErr = e; }
    await new Promise((r) => setTimeout(r, 2 ** i * 500));
  }
  throw lastErr;
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const slugs = manifest.slugs || [];
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const jobs = [];
  for (const slug of slugs) for (const lc of LOCALES) jobs.push({ name: `${slug}.${lc}.mp3` });

  let downloaded = 0; let skipped = 0; const missing = [];
  // Modest parallelism keeps it quick without hammering the CDN.
  const POOL = 8;
  let idx = 0;
  async function worker() {
    while (idx < jobs.length) {
      const { name } = jobs[idx++];
      const dest = path.join(OUT_DIR, name);
      if (!FORCE && fs.existsSync(dest) && fs.statSync(dest).size > 0) { skipped += 1; continue; }
      const buf = await fetchWithRetry(`${BASE}/${name}`);
      if (!buf) { missing.push(name); continue; }
      fs.writeFileSync(dest, buf);
      downloaded += 1;
    }
  }
  await Promise.all(Array.from({ length: POOL }, () => worker()));

  const totalBytes = fs.readdirSync(OUT_DIR).filter((f) => f.endsWith('.mp3'))
    .reduce((a, f) => a + fs.statSync(path.join(OUT_DIR, f)).size, 0);
  console.log(`✓ coach-static sync: ${downloaded} downloaded · ${skipped} already present · ${missing.length} missing`);
  console.log(`  on disk: ${fs.readdirSync(OUT_DIR).filter((f) => f.endsWith('.mp3')).length} mp3 · ${(totalBytes / 1048576).toFixed(1)} MB → ${path.relative(ROOT, OUT_DIR)}`);
  if (missing.length) {
    console.log(`  ⚠ ${missing.length} not yet in the bucket (run the baker until status remaining:0):`);
    console.log('   ', missing.slice(0, 12).join(', ') + (missing.length > 12 ? ` … +${missing.length - 12}` : ''));
    process.exitCode = 2;
  }
}

main().catch((e) => { console.error('✗', e.message); process.exit(1); });
