// scripts/upload-anatomy-assets.mjs
// ─────────────────────────────────────────────────────────────────────────────
// ONE-COMMAND DEPLOY for the Anatomy Arena realistic base-image layer.
//
// Uploads the three lane maps to the PUBLIC `anatomy-assets` bucket with a
// 1-year CDN cache header, then prints the public URLs + the exact `imageUrl`
// lines to paste into anatomyData.js. Mirrors the exercise-gifs asset design and
// the raw-Storage-REST + service-role pattern of compile-voice-vault.js (no npm
// dependency — pure Node 18+ global fetch, runs from anywhere).
//
//   Source files (WebP preferred, then AVIF/PNG/JPG) — one per lane:
//     push-anterior   → lane 'push'
//     pull-posterior  → lane 'pull'
//     legs-dual       → lane 'legs'
//   Looked up in ./assets/anatomy/ (override with ANATOMY_SRC_DIR=/path or argv[2]).
//
//   Credentials (auto-loaded from repo-root .env, or process.env):
//     SUPABASE_SERVICE_ROLE_KEY   a.k.a. SUPABASE_SERVICE_KEY
//     SUPABASE_URL                default https://ihclbceghxpuawymlvgi.supabase.co
//
//   Usage:
//     node scripts/upload-anatomy-assets.mjs                # upload found files
//     node scripts/upload-anatomy-assets.mjs ./my/art/dir   # custom source dir
//     DRY_RUN=1 node scripts/upload-anatomy-assets.mjs       # plan only, no writes

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

// ── minimal repo-root .env loader (no dotenv dependency) ─────────────────────
(function loadEnv() {
  try {
    const txt = fs.readFileSync(path.join(REPO_ROOT, '.env'), 'utf8');
    for (const line of txt.split('\n')) {
      const m = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (!m || process.env[m[1]] !== undefined) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      process.env[m[1]] = v;
    }
  } catch { /* no .env — rely on the real environment */ }
})();

const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://ihclbceghxpuawymlvgi.supabase.co').replace(/\/+$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';
const DRY_RUN = process.env.DRY_RUN === '1' || process.argv.includes('--dry-run');

const BUCKET = 'anatomy-assets';
const CACHE_CONTROL = '31536000';                       // 1-year CDN / browser cache (per-object header)
const SRC_DIR = path.resolve(process.argv[2] && !process.argv[2].startsWith('--')
  ? process.argv[2]
  : (process.env.ANATOMY_SRC_DIR || path.join(REPO_ROOT, 'assets', 'anatomy')));

// lane key → base filename (extension resolved from what's on disk)
const LANES = [
  { lane: 'push', base: 'push-anterior' },
  { lane: 'pull', base: 'pull-posterior' },
  { lane: 'legs', base: 'legs-dual' },
];
const EXT_ORDER = ['webp', 'avif', 'png', 'jpg', 'jpeg'];
const MIME = { webp: 'image/webp', avif: 'image/avif', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' };
const publicUrl = (key) => `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${key}`;

function resolveSource(base) {
  for (const ext of EXT_ORDER) {
    const p = path.join(SRC_DIR, `${base}.${ext}`);
    if (fs.existsSync(p)) return { path: p, ext, key: `${base}.${ext}` };
  }
  return null;
}

// Service-role upload via the Storage REST API. `cache-control: max-age=…`
// locks the 1-year CDN layer onto the object; x-upsert overwrites in place.
async function uploadOne(key, buf, contentType) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${key}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': contentType,
      'cache-control': `max-age=${CACHE_CONTROL}`,
      'x-upsert': 'true',
    },
    body: buf,
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}`);
}

async function main() {
  console.log(`\n🫀  Anatomy Arena asset deploy → bucket "${BUCKET}"`);
  console.log(`    source dir : ${SRC_DIR}`);
  console.log(`    cache      : max-age=${CACHE_CONTROL} (1 year)`);
  console.log(`    mode       : ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE UPLOAD'}\n`);

  const planned = LANES.map((l) => ({ ...l, src: resolveSource(l.base) }));
  const missing = planned.filter((p) => !p.src);
  if (missing.length) {
    console.log('⚠  Missing source files (drop them into the source dir, WebP preferred):');
    for (const m of missing) console.log(`     • ${m.base}.webp   (lane "${m.lane}")`);
    console.log('');
  }
  const ready = planned.filter((p) => p.src);
  if (!ready.length) {
    console.log('Nothing to upload yet — add the art and re-run. Utility is staged and ready.\n');
    return;
  }
  if (!DRY_RUN && !SERVICE_KEY) { console.error('FATAL: SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY) missing.'); process.exit(1); }

  const done = [];
  for (const p of ready) {
    const contentType = MIME[p.src.ext] || 'application/octet-stream';
    const kb = (fs.statSync(p.src.path).size / 1024).toFixed(0);
    if (DRY_RUN) { console.log(`   • would upload ${p.src.key}  (${kb} kB, ${contentType})`); done.push(p); continue; }
    try {
      await uploadOne(p.src.key, fs.readFileSync(p.src.path), contentType);   // eslint-disable-line no-await-in-loop
      console.log(`   ✓ ${p.src.key}  (${kb} kB)  →  ${publicUrl(p.src.key)}`);
      done.push(p);
    } catch (e) { console.error(`   ✗ ${p.src.key}: ${e?.message || e}`); }
  }

  if (done.length) {
    console.log('\n📋  Paste these into frontend/src/components/command/anatomyData.js:\n');
    for (const p of done) console.log(`     ${p.lane}: imageUrl: ANATOMY_ASSET_BASE + '${p.src.key}',`);
    console.log('\n   Then bump sw.js CACHE and deploy — the Arena cross-fades the realistic maps in.\n');
  }
}

main().catch((e) => { console.error('FATAL:', e?.message || e); process.exit(1); });
