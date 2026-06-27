// supabase/functions/bbf-bake-coach-static/index.ts
// ═══════════════════════════════════════════════════════════════════════════
// MARGIN GUARD — ONE-SHOT static coach-cue BAKER (stateless synth-proxy).
// ───────────────────────────────────────────────────────────────────────────
// The LOCAL driver (scripts/bake-coach-static.mjs) reads the committed cue table
// (scripts/coach-static-scripts.json — 110 slugs × en/es/pt) and POSTs batches of
// { path, text } here. This function synthesizes each cue in Coach Akeem's cloned
// voice via ElevenLabs eleven_multilingual_v2 and uploads the MP3 to the PUBLIC
// `coach-static` Storage bucket at <path>. scripts/sync-coach-static.mjs then pulls
// the bucket into the repo (frontend/public/media/coach-static/), after which the
// app plays the clips straight from the repo via <CoachVoiceNote slug=… /> — ZERO
// recurring ElevenLabs spend for standardized cues. NO Claude: scripts are fixed.
//
// Stateless by design: the cue TEXT rides in the request body, so the deployed
// function never bundles the library. Idempotent (skips clips already in the
// bucket unless overwrite). Gated by bbf_app_config.coach_static_bake_secret.
// verify_jwt:false (custom shared-secret auth below).
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-bbf-bake-secret',
};
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

// Coach Akeem's Professional Voice Clone + the BBF Lab voice physics (CLAUDE.md §4).
const AKEEM_VOICE_ID = 'ZbKDEqxkr8Ub4psNm5XD';
const BBF_VOICE_SETTINGS = { stability: 0.35, similarity_boost: 0.85, style: 0.15, use_speaker_boost: true };
const VOICE_MODEL = 'eleven_multilingual_v2';
const BUCKET = 'coach-static';
const MAX_CLIPS = 60; // safety cap per request → each call finishes inside the edge wall-clock

function pgHeaders(key: string): HeadersInit {
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}
async function readSecret(url: string, key: string): Promise<string | null> {
  try {
    const r = await fetch(`${url}/rest/v1/bbf_app_config?key=eq.coach_static_bake_secret&select=value&limit=1`, { headers: pgHeaders(key) });
    if (!r.ok) return null;
    const rows = await r.json().catch(() => null);
    return Array.isArray(rows) && rows.length ? String(rows[0].value || '') : null;
  } catch { return null; }
}

async function listExisting(url: string, key: string): Promise<Set<string>> {
  const set = new Set<string>();
  try {
    const r = await fetch(`${url}/storage/v1/object/list/${BUCKET}`, {
      method: 'POST',
      headers: pgHeaders(key),
      body: JSON.stringify({ prefix: '', limit: 2000, sortBy: { column: 'name', order: 'asc' } }),
    });
    if (r.ok) {
      const rows = await r.json().catch(() => []);
      for (const o of (Array.isArray(rows) ? rows : [])) if (o?.name) set.add(String(o.name));
    }
  } catch { /* treat as empty → attempt all (upsert is safe) */ }
  return set;
}

const SAFE_PATH = /^[a-z0-9][a-z0-9._-]*\.(en|es|pt)\.mp3$/;

async function synthesize(apiKey: string, text: string, outputFormat: string): Promise<{ ok: true; buf: Uint8Array } | { ok: false; status: number; detail: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(AKEEM_VOICE_ID)}?output_format=${encodeURIComponent(outputFormat)}`,
      {
        method: 'POST',
        headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify({ text: String(text).slice(0, 800), model_id: VOICE_MODEL, voice_settings: BBF_VOICE_SETTINGS }),
        signal: controller.signal,
      },
    );
    if (!res.ok) return { ok: false, status: res.status, detail: (await res.text().catch(() => '')).slice(0, 160) };
    return { ok: true, buf: new Uint8Array(await res.arrayBuffer()) };
  } catch (e) {
    const err = e as Error;
    return { ok: false, status: 0, detail: err.name === 'AbortError' ? 'timeout_45000ms' : err.message };
  } finally { clearTimeout(timeout); }
}

async function uploadObject(url: string, key: string, path: string, bytes: Uint8Array): Promise<{ ok: true } | { ok: false; status: number; detail: string }> {
  try {
    const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${path}`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'audio/mpeg', 'x-upsert': 'true', 'Cache-Control': 'public, max-age=31536000, immutable' },
      body: bytes,
    });
    if (!res.ok) return { ok: false, status: res.status, detail: (await res.text().catch(() => '')).slice(0, 160) };
    return { ok: true };
  } catch (e) { return { ok: false, status: 0, detail: (e as Error).message }; }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
  if (!SUPABASE_URL || !SERVICE_KEY) return jsonResponse({ error: 'config_missing' }, 503);

  // Shared-secret gate (prevents random callers from burning ElevenLabs spend).
  const cfgSecret = await readSecret(SUPABASE_URL, SERVICE_KEY);
  if (!cfgSecret) return jsonResponse({ error: 'config_missing_secret', detail: 'Set bbf_app_config.coach_static_bake_secret.' }, 503);
  if (req.headers.get('x-bbf-bake-secret') !== cfgSecret) return jsonResponse({ error: 'unauthorized' }, 401);

  // GET ?status=1 → how many objects are already in the bucket (progress check).
  if (req.method === 'GET') {
    const existing = await listExisting(SUPABASE_URL, SERVICE_KEY);
    return jsonResponse({ ok: true, bucket: BUCKET, uploaded: existing.size, public_base: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}` });
  }

  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);
  if (!ELEVENLABS_API_KEY) return jsonResponse({ error: 'tts_unconfigured', detail: 'ELEVENLABS_API_KEY is not set.' }, 503);

  let payload: any = {};
  try { payload = await req.json(); } catch { return jsonResponse({ error: 'invalid_json' }, 400); }
  const outputFormat = String(payload?.output_format || 'mp3_44100_64');
  const overwrite = payload?.overwrite === true;
  const concurrency = Math.max(1, Math.min(6, Number(payload?.concurrency) || 3));

  const rawClips = Array.isArray(payload?.clips) ? payload.clips : [];
  if (!rawClips.length) return jsonResponse({ error: 'no_clips' }, 400);
  if (rawClips.length > MAX_CLIPS) return jsonResponse({ error: 'too_many_clips', detail: `max ${MAX_CLIPS} per request` }, 400);

  // Validate shape + path safety up front.
  const clips: Array<{ path: string; text: string }> = [];
  for (const c of rawClips) {
    const path = String(c?.path || '');
    const text = String(c?.text || '');
    if (!SAFE_PATH.test(path) || !text) return jsonResponse({ error: 'bad_clip', detail: path || '(empty)' }, 400);
    clips.push({ path, text });
  }

  const existing = overwrite ? new Set<string>() : await listExisting(SUPABASE_URL, SERVICE_KEY);
  const todo = clips.filter((c) => !existing.has(c.path));

  const baked: string[] = [];
  const failed: Array<{ path: string; detail: string }> = [];

  // Small concurrency pool — speeds the bake while staying gentle on ElevenLabs.
  let idx = 0;
  async function worker() {
    while (idx < todo.length) {
      const clip = todo[idx++];
      const tts = await synthesize(ELEVENLABS_API_KEY!, clip.text, outputFormat);
      if (!tts.ok) { failed.push({ path: clip.path, detail: `tts_${tts.status}:${tts.detail}` }); continue; }
      const up = await uploadObject(SUPABASE_URL!, SERVICE_KEY!, clip.path, tts.buf);
      if (!up.ok) { failed.push({ path: clip.path, detail: `upload_${up.status}:${up.detail}` }); continue; }
      baked.push(clip.path);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, todo.length) }, () => worker()));

  console.log(`[bbf-bake-coach-static] requested=${clips.length} baked=${baked.length} skipped=${clips.length - todo.length} failed=${failed.length} fmt=${outputFormat}`);
  return jsonResponse({
    ok: true,
    bucket: BUCKET,
    output_format: outputFormat,
    requested: clips.length,
    baked: baked.length,
    skipped_existing: clips.length - todo.length,
    failed,
    public_base: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}`,
  });
});
