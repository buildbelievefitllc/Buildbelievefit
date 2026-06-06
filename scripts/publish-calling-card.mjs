#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// publish-calling-card.mjs — BBF Calling Card → TikTok (official Content Posting API)
// ─────────────────────────────────────────────────────────────────────────────
// The legitimate, ToS-compliant trigger: hands a local video to the
// `bbf-tiktok-publish` edge function over the official TikTok API. No browser, no
// cookies, no profile hijack — the edge function holds the OAuth token; this script
// just streams the file bytes to the upload URL TikTok hands back.
//
// FLOW: init (edge) → PUT chunks straight to TikTok → poll (edge) → video_id.
//
// USAGE
//   node scripts/publish-calling-card.mjs <video-path> "<caption>" [--live] [--privacy=SELF_ONLY]
//   node scripts/publish-calling-card.mjs --url=https://… "<caption>" [--live]   # PULL_FROM_URL
//   # …or just fill in the CALLING_CARD block below and run with no args.
//
// SAFETY: dry-run by DEFAULT. Nothing posts unless you pass --live (the edge function
// enforces the same gate independently). Privacy defaults to SELF_ONLY (private) —
// the only level an unaudited TikTok app may use; flip to PUBLIC_TO_EVERYONE only
// after the app passes TikTok's audit.
//
// ENV (.env, loaded automatically):
//   SUPABASE_URL           e.g. https://ihclbceghxpuawymlvgi.supabase.co
//   SUPABASE_ANON_KEY      Supabase anon/publishable key (gateway apikey header)
//   BBF_COACH_AGENT_TOKEN  the X-BBF-Admin-Token shared secret

import 'dotenv/config';
import { readFile, stat } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import process from 'node:process';

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  CALLING CARD — paste your live calling card here (or pass args instead).  ║
// ╚═══════════════════════════════════════════════════════════════════════════╝
const CALLING_CARD = {
  VIDEO_PATH: '',                                          // e.g. '/home/akeem/calling-card.mp4'
  CAPTION: 'Build. Believe. Fit. 💜 #BuildBelieveFit',
  PRIVACY: 'SELF_ONLY',                                    // SELF_ONLY until the app passes TikTok audit
};
// ─────────────────────────────────────────────────────────────────────────────

const MIME_BY_EXT = { '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm' };
const POLL_DELAY_MS = 3000;
const POLL_MAX_ATTEMPTS = 40; // ~2 min ceiling

// ─── arg parsing (args win over the CALLING_CARD block) ──────────────────────────
const argv = process.argv.slice(2);
const flags = Object.fromEntries(
  argv.filter((a) => a.startsWith('--')).map((a) => { const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true]; }),
);
const positionals = argv.filter((a) => !a.startsWith('--'));

const live = flags.live === true || String(process.env.LIVE).toLowerCase() === 'true';
const pullUrl = typeof flags.url === 'string' ? flags.url : '';
const videoPath = positionals[0] || CALLING_CARD.VIDEO_PATH;
const caption = positionals[1] || CALLING_CARD.CAPTION;
const privacy = (typeof flags.privacy === 'string' && flags.privacy) || CALLING_CARD.PRIVACY || 'SELF_ONLY';

// ─── env / edge endpoint ─────────────────────────────────────────────────────────
const { SUPABASE_URL, SUPABASE_ANON_KEY, BBF_COACH_AGENT_TOKEN } = process.env;
function requireEnv() {
  const missing = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'BBF_COACH_AGENT_TOKEN'].filter((k) => !process.env[k]);
  if (missing.length) fail(`Missing env: ${missing.join(', ')}. Add them to .env (see the header of this file).`);
}
const FN_URL = () => `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/bbf-tiktok-publish`;

function fail(msg) { console.error(`\n✗ ${msg}\n`); process.exit(1); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callEdge(payload) {
  const res = await fetch(FN_URL(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'X-BBF-Admin-Token': BBF_COACH_AGENT_TOKEN,
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let json; try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  if (!res.ok || json.error) {
    throw new Error(`edge ${res.status} ${json.error ?? ''}${json.detail ? ` — ${json.detail}` : ''}${json.hint ? ` (${json.hint})` : ''}`);
  }
  return json;
}

// PUT one byte range straight to the TikTok-hosted upload URL.
async function putChunk(uploadUrl, buf, chunk, total, mime) {
  const slice = buf.subarray(chunk.start, chunk.end + 1);
  // Content-Length is auto-set by undici from the body; Content-Range tells TikTok
  // where this chunk sits in the whole file.
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': mime,
      'Content-Range': `bytes ${chunk.start}-${chunk.end}/${total}`,
    },
    body: slice,
  });
  if (![200, 201, 206].includes(res.status)) {
    throw new Error(`chunk ${chunk.index} upload failed: HTTP ${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}`);
  }
  return res.status;
}

async function pollUntilDone(publishId) {
  let last = '';
  for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
    await sleep(POLL_DELAY_MS);
    const r = await callEdge({ action: 'poll', publish_id: publishId });
    if (r.status !== last) { console.log(`   … ${r.status}`); last = r.status; }
    if (r.complete) return r;
    if (r.failed) fail(`TikTok reported FAILED: ${r.fail_reason ?? 'unknown'} (publish_id ${publishId})`);
  }
  fail(`Timed out after ${(POLL_DELAY_MS * POLL_MAX_ATTEMPTS) / 1000}s waiting on publish_id ${publishId}. It may still finish — poll manually: { action:"poll", publish_id:"${publishId}" }`);
}

// ─── main ────────────────────────────────────────────────────────────────────────
console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║   BBF Calling Card → TikTok  ·  official Content Posting   ║');
console.log('╚══════════════════════════════════════════════════════════╝');
console.log(live ? '  MODE: 🔴 LIVE — this will post.' : '  MODE: 🟢 DRY RUN — nothing posts (add --live to publish).');
console.log(`  PRIVACY: ${privacy}${privacy === 'SELF_ONLY' ? '  (private — required until TikTok app audit clears)' : ''}`);
console.log('  NOTE: first run needs the one-time bbf-tiktok-oauth consent done.\n');

requireEnv();

let initPayload;
let mime = 'video/mp4';
let buf = null;
let videoSize = 0;

if (pullUrl) {
  console.log(`  Source: PULL_FROM_URL\n  URL:    ${pullUrl}`);
  initPayload = { action: 'init', live, source: 'PULL_FROM_URL', video_url: pullUrl, caption, privacy_level: privacy };
} else {
  if (!videoPath) fail('No video. Pass a path (node scripts/publish-calling-card.mjs <path> "caption") or set CALLING_CARD.VIDEO_PATH.');
  let info; try { info = await stat(videoPath); } catch { fail(`File not found: ${videoPath}`); }
  if (!info.isFile()) fail(`Not a file: ${videoPath}`);
  videoSize = info.size;
  mime = MIME_BY_EXT[extname(videoPath).toLowerCase()] || 'video/mp4';
  console.log(`  Source: FILE_UPLOAD\n  File:   ${basename(videoPath)} (${(videoSize / 1024 / 1024).toFixed(2)} MB, ${mime})`);
  initPayload = { action: 'init', live, source: 'FILE_UPLOAD', video_size: videoSize, caption, privacy_level: privacy };
}
console.log(`  Caption: ${caption}\n`);

try {
  // 1) init / dry-run
  const init = await callEdge(initPayload);
  if (!live || init.mode === 'dry_run') {
    console.log('  ── DRY RUN — edge gate passed, nothing posted ──');
    console.log(`  allowed_privacy: ${JSON.stringify(init.allowed_privacy ?? [])}`);
    if (init.chunk_plan) console.log(`  chunk_plan: ${init.chunk_plan.total_chunk_count} chunk(s), ${(init.chunk_plan.chunk_size / 1024 / 1024).toFixed(1)} MB each`);
    console.log('\n  ▶ Re-run with --live to publish.\n');
    process.exit(0);
  }

  console.log(`  ✓ init ok — publish_id ${init.publish_id}`);

  // 2) upload (FILE_UPLOAD only)
  if (!pullUrl) {
    if (!init.upload_url || !init.chunk_plan) fail('Edge did not return an upload_url / chunk_plan for FILE_UPLOAD.');
    buf = await readFile(videoPath);
    for (const chunk of init.chunk_plan.chunks) {
      const code = await putChunk(init.upload_url, buf, chunk, videoSize, mime);
      console.log(`  ✓ chunk ${chunk.index + 1}/${init.chunk_plan.total_chunk_count} uploaded (HTTP ${code})`);
    }
  }

  // 3) poll to completion
  console.log('  ⏳ finalizing on TikTok…');
  const done = await pollUntilDone(init.publish_id);

  console.log('\n  ✅ PUBLISHED');
  if (done.video_id) {
    console.log(`     video_id: ${done.video_id}`);
    console.log('     (feed this to bbf-signal-tracker to track impressions/CTR)');
  } else {
    console.log('     (no public post id returned — if privacy is SELF_ONLY the post is private/draft, as expected pre-audit)');
  }
  console.log('');
} catch (e) {
  fail(e?.message ?? String(e));
}
