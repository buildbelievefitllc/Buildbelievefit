#!/usr/bin/env node
/**
 * scripts/seed-audio-vault.js
 * ---------------------------------------------------------------------------
 * FRONT 5 — Batch-seed the Sovereign Studio audio vault.
 *
 * Reads master-vault-seed.json from the repo root and POSTs each pre-written
 * script to the LIVE bbf-studio-voiceover Edge Function. Because each item ships
 * a `provided_script`, the function skips the Anthropic/Haiku LLM entirely and
 * voices the EXACT text, then caches the MP3 in the studio-audio-vault bucket.
 *
 * Sequential, with a strict 2-second delay between requests. Each response is
 * logged so progress is visible in the terminal.
 *
 * Auth (server-to-server): X-BBF-Admin-Token === BBF_COACH_AGENT_TOKEN.
 *
 * Env:
 *   BBF_COACH_AGENT_TOKEN  (required for live)  admin shared secret
 *   SUPABASE_URL           (default https://ihclbceghxpuawymlvgi.supabase.co)
 *   SUPABASE_ANON_KEY      (optional gateway apikey)
 *   SEED_FILE              (default ./master-vault-seed.json)
 *   DRY_RUN=1 | --dry-run  (validate mapping/loop without calling the network)
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
const ENDPOINT = `${SUPABASE_URL}/functions/v1/bbf-studio-voiceover`;

const DELAY_MS = 2000;            // strict 2s between LIVE requests (CEO directive)
const DRY_DELAY_MS = 5;           // negligible pause in dry-run so validation is fast
const VIBE_DEFAULT = 'The Architect';

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
    series: item.series || '',
    vibe: VIBE_DEFAULT,
    provided_script: item.script,   // critical: ElevenLabs voices our EXACT text
  };
  const tag = `[${String(idx + 1).padStart(3, '0')}/${total}] ${item.exercise_name}`;

  if (DRY_RUN) {
    console.log(`${tag}  →  ${payload.target_duration}s · series="${payload.series}" · script=${String(item.script || '').length} chars  [DRY]`);
    return { ok: true, cached: false, dry: true };
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
      return { ok: true, cached: !!json.cached };
    }
    console.log(`${tag}  ✗  HTTP ${res.status}  ${json ? (json.error || '') : ''} ${json ? (json.detail || '') : ''}`.trim());
    return { ok: false };
  } catch (e) {
    console.log(`${tag}  ✗  network: ${e && e.message ? e.message : e}`);
    return { ok: false };
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

  let ok = 0, cached = 0, fail = 0;
  for (let i = 0; i < items.length; i++) {
    const r = await postItem(items[i], i, items.length);
    if (r.ok) { ok++; if (r.cached) cached++; } else { fail++; }
    if (i < items.length - 1) await sleep(DRY_RUN ? DRY_DELAY_MS : DELAY_MS);
  }

  console.log(`\nDone. ${ok}/${items.length} ok  (cache hits: ${cached}, fresh: ${ok - cached})  ·  failed: ${fail}\n`);
  process.exit(!DRY_RUN && fail > 0 ? 2 : 0);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
