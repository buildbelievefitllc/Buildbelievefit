#!/usr/bin/env node
/**
 * scripts/compile-voice-vault.js
 * ---------------------------------------------------------------------------
 * FRONT 6 — ZERO-LATENCY AUDIO CACHE (Sovereign Vault marketing/mindset deck)
 *
 * Compiles the 25 pre-written BBF Lab voice scripts (bbf-lab-voice-scripts.json)
 * into permanent, pre-rendered MP3s so the V4 Studio loads them with ZERO live
 * generation latency / ZERO per-use ElevenLabs spend.
 *
 * ── SYNTHESIS PATH (why we route through the Edge Function) ─────────────────
 * The directive's literal plan was a DIRECT ElevenLabs call from this script.
 * That is blocked: the only ElevenLabs key reachable locally (in .env) is dead
 * (HTTP 401). The VALID key lives as a Supabase secret consumed by the LIVE
 * `bbf-studio-voiceover` Edge Function — which already synthesizes with the
 * LOCKED Akeem-clone physics (multilingual_v2 · stability 0.35 family, per the
 * CEO ruling) and deposits into the EXISTING `studio-audio-vault` bucket.
 *
 * So per script we:
 *   1. CACHE CHECK — HEAD the final manifest-audio URL; reuse if it exists.
 *   2. SYNTHESIZE  — POST the EXACT approved text to bbf-studio-voiceover with
 *      `provided_script` (skips the LLM; voices our words verbatim). The valid
 *      server-side key renders it and caches it at the function's slug path.
 *   3. RE-SHELVE   — copy that MP3 into the directive's clean, human-readable
 *      path:  studio-audio-vault/manifest-audio/{category}-{subject_line}.mp3
 *      (download the public object → re-upload via Storage REST w/ Service Key),
 *      then delete the interim slug object so the vault stays tidy.
 *   4. 1.5s delay between renders to stay under the HTTP 429 ceiling.
 *
 * OUTPUT — sovereignVaultManifest.json (repo root + frontend/src/data/), each:
 *   { id, category, subjectLine, scenario, duration, url }
 *
 * Credentials (auto-loaded from the repo-root .env, or process.env):
 *   BBF_COACH_AGENT_TOKEN        edge-function admin shared secret (synthesis)
 *   SUPABASE_SERVICE_ROLE_KEY    a.k.a. SUPABASE_SERVICE_KEY (re-shelve/copy)
 *   SUPABASE_URL                 default https://ihclbceghxpuawymlvgi.supabase.co
 *
 * Usage:
 *   node scripts/compile-voice-vault.js            # compile (cache-aware)
 *   node scripts/compile-voice-vault.js --force    # re-render every script
 *   DRY_RUN=1 node scripts/compile-voice-vault.js  # validate, no network
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// ── tolerant .env loader ──────────────────────────────────────────────────
// The repo .env mixes `KEY=VALUE` lines with loose `Name Value` lines (e.g.
// "ElevenLabs API Key a0oz..."). Index every line under a normalized key
// (alphanumerics only, uppercased) so both formats resolve.
function loadEnv() {
  const out = {};
  const file = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(file)) return out;
  for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    let key, val;
    const eq = line.indexOf('=');
    if (eq !== -1) {
      key = line.slice(0, eq).trim();
      val = line.slice(eq + 1).trim();
    } else {
      const m = line.match(/^(.*\S)\s+(\S+)$/);
      if (!m) continue;
      key = m[1].trim();
      val = m[2].trim();
    }
    val = val.replace(/^["']|["']$/g, '');
    out[key.replace(/[^a-z0-9]/gi, '').toUpperCase()] = val;
  }
  return out;
}
const ENV = loadEnv();
const envGet = (...names) => {
  for (const n of names) {
    if (process.env[n]) return process.env[n];
    const norm = n.replace(/[^a-z0-9]/gi, '').toUpperCase();
    if (ENV[norm]) return ENV[norm];
  }
  return '';
};

// ── config ────────────────────────────────────────────────────────────────
const SUPABASE_URL = (envGet('SUPABASE_URL') || 'https://ihclbceghxpuawymlvgi.supabase.co').replace(/\/+$/, '');
const SERVICE_KEY = envGet('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY');
const ADMIN = envGet('BBF_COACH_AGENT_TOKEN', 'BBF_ADMIN_TOKEN');
const ANON = envGet('SUPABASE_ANON_KEY');
const ENDPOINT = `${SUPABASE_URL}/functions/v1/bbf-studio-voiceover`;

const BUCKET = 'studio-audio-vault';   // EXISTING bucket — never create a new one (CEO override)
const PREFIX = 'manifest-audio';       // clean namespace for this deck inside the bucket

const DELAY_MS = 1500;                 // strict 1.5s between renders (anti-429)
const DRY_RUN = process.env.DRY_RUN === '1' || process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');

// Category → voice character (vibe). These vibes ARE the locked engine's matrix
// in bbf-studio-voiceover; mapping by content type gives each script the right
// delivery (and the vibe is part of the function's cache slug).
const VIBE_BY_CATEGORY = {
  Mindset: 'the_architect',
  Accountability: 'the_architect',
  Conditioning: 'the_mechanic',
  Biomechanics: 'the_mechanic',
  Prehab: 'the_mechanic',
  'Tendon Health': 'the_mechanic',
  Recovery: 'the_sanctuary',
  Nutrition: 'real_talk',
};
const vibeFor = (category) => VIBE_BY_CATEGORY[category] || 'the_architect';

const SCRIPTS_FILE = path.resolve(__dirname, '..', 'bbf-lab-voice-scripts.json');
const MANIFEST_FILES = [
  path.resolve(__dirname, '..', 'sovereignVaultManifest.json'),
  path.resolve(__dirname, '..', 'frontend', 'src', 'data', 'sovereignVaultManifest.json'),
];

// ── helpers ───────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slugify = (s) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const stableId = (category, subject) =>
  'audio_' + crypto.createHash('sha256').update(`${category}|${subject}`).digest('hex').slice(0, 8);
const toSeconds = (v) => {
  const n = parseInt(String(v == null ? '' : v).replace(/[^0-9.]/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : 60;
};

const manifestObjectPath = (item) => `${PREFIX}/${slugify(item.category)}-${slugify(item.subject_line)}.mp3`;
const publicUrl = (objPath) => `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${objPath}`;
const pgHeaders = () => ({ apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` });

async function vaultHas(objPath) {
  try { return (await fetch(publicUrl(objPath), { method: 'HEAD' })).ok; }
  catch { return false; }
}

// 2 · synthesize the EXACT approved text via the live Edge Function.
async function synthesizeViaEdge(item) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(ANON ? { apikey: ANON, Authorization: `Bearer ${ANON}` } : {}),
      'X-BBF-Admin-Token': ADMIN,
    },
    body: JSON.stringify({
      topic: item.subject_line,
      target_duration: toSeconds(item.target_duration),
      series: slugify(item.category),
      vibe: vibeFor(item.category),
      provided_script: item.script,   // voice our words verbatim — no LLM
    }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || !json.ok || !json.url) {
    return { ok: false, status: res.status, detail: json ? (json.error || json.detail || '') : 'no_body' };
  }
  return { ok: true, slugUrl: json.url, slug: json.slug, cached: !!json.cached };
}

async function download(url) {
  // The object is brand-new; allow a couple of quick retries for propagation.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url);
      if (r.ok) return Buffer.from(await r.arrayBuffer());
    } catch { /* retry */ }
    await sleep(400);
  }
  return null;
}

// 3 · re-shelve into the directive's clean manifest-audio/ path (Service Key).
async function vaultPut(objPath, buf) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${objPath}`, {
    method: 'POST',
    headers: {
      ...pgHeaders(),
      'Content-Type': 'audio/mpeg',
      'x-upsert': 'true',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
    body: buf,
  });
  if (!res.ok) return { ok: false, status: res.status, detail: (await res.text().catch(() => '')).slice(0, 160) };
  return { ok: true };
}

// best-effort cleanup of the interim slug object so the vault isn't duplicated.
async function vaultDelete(objPath) {
  try { await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${objPath}`, { method: 'DELETE', headers: pgHeaders() }); }
  catch { /* non-fatal */ }
}

// ── main ──────────────────────────────────────────────────────────────────
async function main() {
  if (!fs.existsSync(SCRIPTS_FILE)) { console.error(`FATAL: scripts file not found: ${SCRIPTS_FILE}`); process.exit(1); }
  let items;
  try { items = JSON.parse(fs.readFileSync(SCRIPTS_FILE, 'utf8')); }
  catch (e) { console.error('FATAL: could not parse scripts JSON:', e.message); process.exit(1); }
  if (!Array.isArray(items) || !items.length) { console.error('FATAL: scripts file is not a non-empty JSON array.'); process.exit(1); }

  if (!DRY_RUN) {
    if (!ADMIN) { console.error('FATAL: BBF_COACH_AGENT_TOKEN missing (needed to call bbf-studio-voiceover).'); process.exit(1); }
    if (!SERVICE_KEY) { console.error('FATAL: SUPABASE_SERVICE_ROLE_KEY missing (needed to re-shelve into manifest-audio/).'); process.exit(1); }
  }

  console.log(`\n🎙  Compiling ${items.length} scripts → ${BUCKET}/${PREFIX}/${DRY_RUN ? '   [DRY RUN — no network]' : ''}`);
  console.log(`    via ${ENDPOINT} (provided_script · locked Akeem physics)${FORCE ? ' · FORCE re-render' : ''}\n`);

  const manifest = [];
  let generated = 0, cached = 0, failed = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const objPath = manifestObjectPath(item);
    const finalUrl = publicUrl(objPath);
    const tag = `[${String(i + 1).padStart(2, '0')}/${items.length}] ${item.category} · ${item.subject_line}`;
    const entry = {
      id: stableId(item.category, item.subject_line),
      category: item.category,
      subjectLine: item.subject_line,
      scenario: item.scenario,
      duration: item.target_duration,
      url: finalUrl,
    };

    if (DRY_RUN) {
      console.log(`${tag}  →  ${objPath}  · vibe=${vibeFor(item.category)} · ${String(item.script || '').length} chars  [DRY]`);
      manifest.push(entry);
      continue;
    }

    // 1 · cache check on the FINAL path — skip the whole pipeline if we own it.
    if (!FORCE && (await vaultHas(objPath))) {
      console.log(`${tag}  ✓  CACHE HIT ($0)  →  ${finalUrl}`);
      manifest.push(entry);
      cached++;
      continue;
    }

    // 2 · synthesize via the edge function
    const syn = await synthesizeViaEdge(item);
    if (!syn.ok) {
      console.log(`${tag}  ✗  synth HTTP ${syn.status}: ${syn.detail}`);
      failed++;
      if (i < items.length - 1) await sleep(DELAY_MS);
      continue;
    }

    // 3 · re-shelve slug object → clean manifest-audio/ path, then drop the slug
    const buf = await download(syn.slugUrl);
    if (!buf) {
      console.log(`${tag}  ✗  could not download rendered audio (${syn.slugUrl})`);
      failed++;
      if (i < items.length - 1) await sleep(DELAY_MS);
      continue;
    }
    const put = await vaultPut(objPath, buf);
    if (!put.ok) {
      console.log(`${tag}  ✗  re-shelve ${put.status}: ${put.detail}`);
      failed++;
      if (i < items.length - 1) await sleep(DELAY_MS);
      continue;
    }
    if (syn.slug) await vaultDelete(`${syn.slug}.mp3`);

    console.log(`${tag}  ✓  ${syn.cached ? 'RENDERED(was-cached)' : 'GENERATED'} (${buf.byteLength} bytes)  →  ${finalUrl}`);
    manifest.push(entry);
    generated++;
    if (i < items.length - 1) await sleep(DELAY_MS);
  }

  for (const f of MANIFEST_FILES) {
    try {
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, JSON.stringify(manifest, null, 2) + '\n');
      console.log(`\n📝  Manifest written: ${manifest.length} entries → ${f}`);
    } catch (e) {
      console.error(`\n⚠️  Could not write manifest to ${f}: ${e.message}`);
    }
  }

  console.log(`\nDone. ${manifest.length}/${items.length} in manifest  (generated: ${generated}, cache hits: ${cached})  ·  failed: ${failed}\n`);
  process.exit(!DRY_RUN && failed > 0 ? 2 : 0);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
