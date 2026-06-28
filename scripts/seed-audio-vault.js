#!/usr/bin/env node
/**
 * scripts/seed-audio-vault.js
 * ---------------------------------------------------------------------------
 * FRONT 5 — Batch-seed the Sovereign Studio audio vault.
 *
 * Reads master-vault-seed.json from the repo root and POSTs each pre-written
 * script to the LIVE bbf-studio-voiceover Edge Function. Each item ships a
 * `provided_script`, so the function skips the Anthropic/Haiku LLM entirely and
 * voices the EXACT text, then caches the MP3 in the studio-audio-vault bucket.
 *
 * Sequential, with a strict 2-second delay between requests. Each response is
 * logged; after the run a manifest (exercise_name → vault URL) is written.
 *
 * DATA ALIGNMENT (so the V4 frontend gets cache HITS, not a 0% rate):
 *   series  "The Mechanic"  → form-fix           (existing V4 dropdown slug)
 *   series  "The Sanctuary" → recovery-protocol  (added to the V4 dropdown)
 *   vibe    default         → the-architect      (server resolves to the_architect)
 *   fallback                → slugify(anything unmatched)
 * The Edge Function keys its cache slug on (topic, duration, series, vibe, lang),
 * so these MUST match what the frontend later sends for the lookup to hit.
 *
 * Auth (server-to-server): X-BBF-Admin-Token === BBF_COACH_AGENT_TOKEN.
 *
 * Env:
 *   BBF_COACH_AGENT_TOKEN  (required for live)  admin shared secret
 *   SUPABASE_URL           (default https://ihclbceghxpuawymlvgi.supabase.co)
 *   SUPABASE_ANON_KEY      (optional gateway apikey)
 *   SEED_FILE              (default ./master-vault-seed.json)
 *   MANIFEST_FILE          (default ./frontend/src/data/audioVaultManifest.json)
 *   DRY_RUN=1 | --dry-run  (validate mapping/loop/manifest without the network)
 *
 * Usage:
 *   BBF_COACH_AGENT_TOKEN=*** node scripts/seed-audio-vault.js
 *   DRY_RUN=1 node scripts/seed-audio-vault.js        # offline validation
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://ihclbceghxpuawymlvgi.supabase.co').replace(/\/+$/, '');
const ANON = process.env.SUPABASE_ANON_KEY || '';
const ADMIN = process.env.BBF_COACH_AGENT_TOKEN || process.env.BBF_ADMIN_TOKEN || '';
const DRY_RUN = process.env.DRY_RUN === '1' || process.argv.includes('--dry-run');
const SEED_FILE = process.env.SEED_FILE || path.resolve(process.cwd(), 'master-vault-seed.json');
// Default to the file the V4 frontend imports (single source of truth) so a live
// run fills in the real vault URLs the UI's exercise datalist is built from.
const MANIFEST_FILE = process.env.MANIFEST_FILE || path.resolve(process.cwd(), 'frontend/src/data/audioVaultManifest.json');
const ENDPOINT = `${SUPABASE_URL}/functions/v1/bbf-studio-voiceover`;

const DELAY_MS = 2000;            // strict 2s between LIVE requests (CEO directive)
const DRY_DELAY_MS = 5;           // negligible pause in dry-run so validation is fast
const VIBE_DEFAULT = 'the-architect';

// Map the seed's human series names → the exact V4 frontend dropdown slugs so the
// cache key the seeder writes equals the key the UI later looks up. Anything not
// in the table falls back to a slugified form.
const SERIES_MAP = {
  'the mechanic': 'form-fix',
  'the sanctuary': 'recovery-protocol',
};
const slugify = (s) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const mapSeries = (name) => SERIES_MAP[String(name || '').trim().toLowerCase()] || slugify(name);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// "60s" | "60" | 60 → 60 (the Edge Function also parses this, belt-and-suspenders).
const toSeconds = (v) => {
  const n = parseInt(String(v == null ? '' : v).replace(/[^0-9.]/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : 30;
};

async function postItem(item, idx, total) {
  const payload = {
    topic: item.exercise_name,
    target_duration: toSeconds(item.target_duration),
    series: mapSeries(item.series),
    vibe: VIBE_DEFAULT,
    provided_script: item.script,   // critical: ElevenLabs voices our EXACT text
  };
  const tag = `[${String(idx + 1).padStart(3, '0')}/${total}] ${item.exercise_name}`;

  if (DRY_RUN) {
    console.log(`${tag}  →  ${payload.target_duration}s · series="${payload.series}" · vibe="${payload.vibe}" · script=${String(item.script || '').length} chars  [DRY]`);
    return { ok: true, cached: false, url: null };
  }

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(ANON ? { apikey: ANON, Authorization: `Bearer ${ANON}` } : {}),
        'X-BBF-Admin-Token': ADMIN,
      },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => null);
    if (res.ok && json && json.ok) {
      const state = json.cached ? 'CACHE HIT ($0)' : `GENERATED (${json.source || 'fresh'})`;
      console.log(`${tag}  ✓  ${state}  →  ${json.url}`);
      return { ok: true, cached: !!json.cached, url: json.url };
    }
    console.log(`${tag}  ✗  HTTP ${res.status}  ${json ? (json.error || '') : ''} ${json ? (json.detail || '') : ''}`.trim());
    return { ok: false, url: null };
  } catch (e) {
    console.log(`${tag}  ✗  network: ${e && e.message ? e.message : e}`);
    return { ok: false, url: null };
  }
}

async function main() {
  if (!DRY_RUN && !ADMIN) {
    console.error('FATAL: BBF_COACH_AGENT_TOKEN (admin token) is required for a live run. Set it, or use DRY_RUN=1.');
    process.exit(1);
  }
  if (!fs.existsSync(SEED_FILE)) {
    console.error(`FATAL: seed file not found: ${SEED_FILE}`);
    process.exit(1);
  }
  let items;
  try { items = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8')); }
  catch (e) { console.error('FATAL: could not parse seed JSON:', e.message); process.exit(1); }
  if (!Array.isArray(items) || items.length === 0) {
    console.error('FATAL: seed file is not a non-empty JSON array.');
    process.exit(1);
  }

  console.log(`\n🎙  Seeding ${items.length} scripts → ${ENDPOINT}${DRY_RUN ? '   [DRY RUN — no network]' : ''}`);
  console.log(`    vibe="${VIBE_DEFAULT}"  ·  ${DRY_RUN ? 'no delay' : `${DELAY_MS}ms between requests`}\n`);

  const manifest = {};   // exercise_name → returned vault URL
  let ok = 0, cached = 0, fail = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const r = await postItem(item, i, items.length);
    if (r.ok) {
      ok++;
      if (r.cached) cached++;
      // Manifest maps the exercise to its permanent vault URL (null in dry-run).
      manifest[item.exercise_name] = r.url;
    } else {
      fail++;
    }
    if (i < items.length - 1) await sleep(DRY_RUN ? DRY_DELAY_MS : DELAY_MS);
  }

  // Write the manifest the frontend can consume to map exercises → audio assets.
  try {
    fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2) + '\n');
    console.log(`\n📝  Manifest written: ${Object.keys(manifest).length} entries → ${MANIFEST_FILE}`);
  } catch (e) {
    console.error(`\n⚠️  Could not write manifest to ${MANIFEST_FILE}: ${e.message}`);
  }

  console.log(`Done. ${ok}/${items.length} ok  (cache hits: ${cached}, fresh: ${ok - cached})  ·  failed: ${fail}\n`);
  process.exit(!DRY_RUN && fail > 0 ? 2 : 0);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
