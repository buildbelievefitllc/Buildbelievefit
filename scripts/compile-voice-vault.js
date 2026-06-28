#!/usr/bin/env node
/**
 * scripts/compile-voice-vault.js
 * ---------------------------------------------------------------------------
 * FRONT 6 — Zero-latency audio cache compiler.
 *
 * Parses bbf-lab-voice-scripts.json (25 pre-written scenarios), synthesizes each
 * via ElevenLabs (Akeem clone), uploads the MP3 to the `sovereign-audio-vault`
 * Supabase bucket under manifest-audio/{category}-{subject}.mp3, and writes
 * frontend/src/data/sovereignVaultManifest.json for the V4 Studio Vault dropdown.
 *
 * Sequential with a 1.5s delay (avoids HTTP 429). Uses the SERVICE ROLE key
 * (backend bypass) — supplied via env, NEVER committed.
 *
 * CRITICAL OVERRIDE — Script #4 (Accountability): the spoken text must read
 *   "…or maybe you were just completely wiped out after a massive day of building
 *    the empire…"   (the legacy "12-hour shift" phrasing is replaced.)
 *
 * Env:
 *   ELEVENLABS_API_KEY          (required for live)
 *   SUPABASE_URL                (default https://ihclbceghxpuawymlvgi.supabase.co)
 *   SUPABASE_SERVICE_ROLE_KEY   (required for live — backend upload bypass)
 *   SCRIPTS_FILE                (default ./bbf-lab-voice-scripts.json)
 *   MANIFEST_FILE               (default ./frontend/src/data/sovereignVaultManifest.json)
 *   DRY_RUN=1 | --dry-run       (parse + map + write manifest; no ElevenLabs/upload)
 *
 * Usage:
 *   ELEVENLABS_API_KEY=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/compile-voice-vault.js
 *   DRY_RUN=1 node scripts/compile-voice-vault.js     # offline validation
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://ihclbceghxpuawymlvgi.supabase.co').replace(/\/+$/, '');
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ELEVEN_KEY = process.env.ELEVENLABS_API_KEY || '';
const DRY_RUN = process.env.DRY_RUN === '1' || process.argv.includes('--dry-run');
const SCRIPTS_FILE = process.env.SCRIPTS_FILE || path.resolve(process.cwd(), 'bbf-lab-voice-scripts.json');
const MANIFEST_FILE = process.env.MANIFEST_FILE || path.resolve(process.cwd(), 'frontend/src/data/sovereignVaultManifest.json');

const BUCKET = 'sovereign-audio-vault';
const AKEEM_VOICE_ID = 'ZbKDEqxkr8Ub4psNm5XD';
const VOICE_MODEL = 'eleven_monolingual_v1';
const VOICE_SETTINGS = { stability: 0.71, similarity_boost: 0.85 };
const DELAY_MS = 1500;            // anti-429 throttle (CEO directive)
const DRY_DELAY_MS = 5;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pick = (o, ...keys) => { for (const k of keys) if (o && o[k] != null && o[k] !== '') return o[k]; return ''; };
// URL/storage-safe slug for the object path (kept identical for upload + manifest URL).
const slug = (s) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

// Normalize one raw script entry → a uniform record (tolerant of key variants).
function normalize(raw, i) {
  const category = String(pick(raw, 'category', 'Category') || 'general').trim();
  const subjectLine = String(pick(raw, 'subject_line', 'subjectLine', 'subject', 'title') || `script-${i + 1}`).trim();
  const scenario = String(pick(raw, 'scenario', 'Scenario') || '').trim();
  const duration = String(pick(raw, 'duration', 'target_duration', 'Duration') || '60s').trim();
  let text = String(pick(raw, 'script', 'text', 'body', 'content') || '').trim();

  // CRITICAL OVERRIDE — Script #4 (Accountability): replace the legacy "12-hour
  // shift" phrasing with the empire line; guarantee the empire clause is present.
  const isAccountability = i === 3 || /accountability/i.test(category) || /accountability/i.test(subjectLine) || /accountability/i.test(scenario);
  if (isAccountability) {
    const EMPIRE = 'or maybe you were just completely wiped out after a massive day of building the empire';
    if (/12[\s-]?hour shift/i.test(text)) {
      text = text.replace(/(or maybe you were just[^.]*?)?12[\s-]?hour shift[^.]*/i, EMPIRE);
    } else if (!/building the empire/i.test(text)) {
      // No legacy phrase found — append the empire beat so the override still lands.
      text = text ? `${text.replace(/\s*$/, '')} ${EMPIRE}.` : `${EMPIRE}.`;
    }
  }
  const key = `${slug(category)}-${slug(subjectLine)}`;
  return { i, category, subjectLine, scenario, duration, text, key };
}

function publicUrl(key) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/manifest-audio/${key}.mp3`;
}

async function ensureBucket() {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: 'POST',
    headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
  });
  if (!r.ok && r.status !== 409) {
    const t = (await r.text().catch(() => '')).toLowerCase();
    if (!t.includes('already exists') && !t.includes('duplicate')) console.warn(`  ⚠ ensureBucket ${r.status}: ${t.slice(0, 140)}`);
  }
}

async function synthesize(text) {
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${AKEEM_VOICE_ID}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': ELEVEN_KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: VOICE_MODEL, voice_settings: VOICE_SETTINGS }),
  });
  if (!r.ok) throw new Error(`elevenlabs_${r.status}: ${(await r.text().catch(() => '')).slice(0, 160)}`);
  return Buffer.from(await r.arrayBuffer());
}

async function upload(key, buf) {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/manifest-audio/${key}.mp3`, {
    method: 'POST',
    headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}`, 'Content-Type': 'audio/mpeg', 'x-upsert': 'true' },
    body: buf,
  });
  if (!r.ok) throw new Error(`upload_${r.status}: ${(await r.text().catch(() => '')).slice(0, 160)}`);
}

async function main() {
  if (!fs.existsSync(SCRIPTS_FILE)) {
    console.error(`FATAL: scripts file not found: ${SCRIPTS_FILE}\n(Place bbf-lab-voice-scripts.json at the repo root, or set SCRIPTS_FILE.)`);
    process.exit(1);
  }
  if (!DRY_RUN && (!ELEVEN_KEY || !SERVICE_ROLE)) {
    console.error('FATAL: live run needs ELEVENLABS_API_KEY and SUPABASE_SERVICE_ROLE_KEY. Set them, or use DRY_RUN=1.');
    process.exit(1);
  }
  let raw;
  try { raw = JSON.parse(fs.readFileSync(SCRIPTS_FILE, 'utf8')); }
  catch (e) { console.error('FATAL: could not parse scripts JSON:', e.message); process.exit(1); }
  const list = Array.isArray(raw) ? raw : (raw.scripts || raw.scenarios || raw.items || []);
  if (!Array.isArray(list) || !list.length) { console.error('FATAL: scripts file has no array of scenarios.'); process.exit(1); }

  const records = list.map(normalize);
  console.log(`\n🎙  Compiling ${records.length} voice scripts → ${BUCKET}/manifest-audio/${DRY_RUN ? '   [DRY RUN — no ElevenLabs/upload]' : ''}`);
  console.log(`    model=${VOICE_MODEL} stability=${VOICE_SETTINGS.stability} similarity=${VOICE_SETTINGS.similarity_boost} · ${DRY_RUN ? 'no delay' : `${DELAY_MS}ms between calls`}\n`);

  if (!DRY_RUN) await ensureBucket();

  const manifest = [];
  let ok = 0, fail = 0;
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const tag = `[${String(i + 1).padStart(2, '0')}/${records.length}] ${r.category} · ${r.subjectLine}`;
    try {
      if (!DRY_RUN) {
        if (!r.text) throw new Error('empty_script_text');
        const buf = await synthesize(r.text);
        await upload(r.key, buf);
        console.log(`${tag}  ✓  ${(buf.length / 1024).toFixed(0)}KB → ${r.key}.mp3`);
      } else {
        console.log(`${tag}  →  ${r.duration} · ${String(r.text).length} chars → ${r.key}.mp3  [DRY]`);
      }
      manifest.push({
        id: `audio_${r.key}`,
        category: r.category,
        subjectLine: r.subjectLine,
        scenario: r.scenario,
        duration: r.duration,
        url: publicUrl(r.key),
      });
      ok++;
    } catch (e) {
      fail++;
      console.log(`${tag}  ✗  ${e.message}`);
    }
    if (i < records.length - 1) await sleep(DRY_RUN ? DRY_DELAY_MS : DELAY_MS);
  }

  fs.mkdirSync(path.dirname(MANIFEST_FILE), { recursive: true });
  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`\n📝  Manifest written: ${manifest.length} entries → ${MANIFEST_FILE}`);
  console.log(`Done. ${ok}/${records.length} ok · failed: ${fail}\n`);
  process.exit(!DRY_RUN && fail > 0 ? 2 : 0);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
