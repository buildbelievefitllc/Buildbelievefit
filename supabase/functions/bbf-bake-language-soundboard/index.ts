// supabase/functions/bbf-bake-language-soundboard/index.ts
// ═══════════════════════════════════════════════════════════════════════════
// MARGIN GUARD — ONE-SHOT static bake for the Language Mastery soundboard
// (AdminLanguageRoadmap + PimsleurAudioLab), mirroring bbf-bake-coach-static.
// ───────────────────────────────────────────────────────────────────────────
// Takes { clips: [{ key, lang, text }] } (key is a content hash — see
// scripts/build-language-soundboard-cues.mjs / languageSoundboardVoice.js's
// staticKeyFor — NOT a positional slug), synthesizes each in Coach Akeem's
// cloned voice via ElevenLabs eleven_multilingual_v2, uploads the MP3 to the
// PUBLIC `language-fragments` Storage bucket at `<key>.mp3`, and upserts a row
// into `language_audio_fragments` (the bake coverage ledger). Once baked, the
// app plays the clip straight from the bucket's public CDN URL — ZERO
// recurring ElevenLabs spend. Idempotent: skips clips already in the bucket
// unless overwrite. Gated by bbf_app_config.language_soundboard_bake_secret.
// verify_jwt:false (custom shared-secret auth below).
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
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
const BUCKET = 'language-fragments';
const OUTPUT_FORMAT = 'mp3_44100_128';
const MAX_CLIPS = 60; // safety cap per request → each call finishes inside the edge wall-clock

function pgHeaders(key: string): HeadersInit {
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}
async function readSecret(url: string, key: string): Promise<string | null> {
  try {
    const r = await fetch(`${url}/rest/v1/bbf_app_config?key=eq.language_soundboard_bake_secret&select=value&limit=1`, { headers: pgHeaders(key) });
    if (!r.ok) return null;
    const rows = await r.json().catch(() => null);
    return Array.isArray(rows) && rows.length ? String(rows[0].value || '') : null;
  } catch { return null; }
}

async function listExisting(url: string, key: string): Promise<Set<string>> {
  const set = new Set<string>();
  let offset = 0;
  try {
    for (;;) {
      const r = await fetch(`${url}/storage/v1/object/list/${BUCKET}`, {
        method: 'POST',
        headers: pgHeaders(key),
        body: JSON.stringify({ prefix: '', limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } }),
      });
      if (!r.ok) break;
      const rows = await r.json().catch(() => []);
      const arr = Array.isArray(rows) ? rows : [];
      for (const o of arr) if (o?.name) set.add(String(o.name));
      if (arr.length < 1000) break;
      offset += 1000;
    }
  } catch { /* treat as empty → attempt all (upsert is safe) */ }
  return set;
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function estimateDurationMs(bytes: number): number {
  // mp3_44100_128 ≈ 128kbps = 16000 bytes/sec.
  return Math.round((bytes / 16000) * 1000);
}

const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

async function synthesize(apiKey: string, text: string): Promise<{ ok: true; buf: Uint8Array } | { ok: false; status: number; detail: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(AKEEM_VOICE_ID)}?output_format=${encodeURIComponent(OUTPUT_FORMAT)}`,
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

async function upsertFragmentRow(url: string, key: string, row: Record<string, unknown>) {
  try {
    await fetch(`${url}/rest/v1/language_audio_fragments?on_conflict=fragment_key`, {
      method: 'POST',
      headers: { ...pgHeaders(key), Prefer: 'return=minimal,resolution=merge-duplicates' },
      body: JSON.stringify(row),
    });
  } catch { /* best effort — the bucket object is the source of truth for playback */ }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SERVICE_KEY) return jsonResponse({ error: 'config_missing' }, 503);

  // Shared-secret gate (prevents random callers from burning ElevenLabs spend).
  const cfgSecret = await readSecret(SUPABASE_URL, SERVICE_KEY);
  if (!cfgSecret) return jsonResponse({ error: 'config_missing_secret', detail: 'Set bbf_app_config.language_soundboard_bake_secret.' }, 503);
  if (req.headers.get('x-bbf-bake-secret') !== cfgSecret) return jsonResponse({ error: 'unauthorized' }, 401);

  // GET ?status=1 → how many objects are already in the bucket (progress check).
  if (req.method === 'GET') {
    const existing = await listExisting(SUPABASE_URL, SERVICE_KEY);
    return jsonResponse({ ok: true, bucket: BUCKET, uploaded: existing.size, public_base: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}` });
  }

  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
  if (!ELEVENLABS_API_KEY) return jsonResponse({ error: 'tts_unconfigured', detail: 'ELEVENLABS_API_KEY is not set.' }, 503);

  let payload: any = {};
  try { payload = await req.json(); } catch { return jsonResponse({ error: 'invalid_json' }, 400); }
  const overwrite = payload?.overwrite === true;
  const concurrency = Math.max(1, Math.min(6, Number(payload?.concurrency) || 3));

  const rawClips = Array.isArray(payload?.clips) ? payload.clips : [];
  if (!rawClips.length) return jsonResponse({ error: 'no_clips' }, 400);
  if (rawClips.length > MAX_CLIPS) return jsonResponse({ error: 'too_many_clips', detail: `max ${MAX_CLIPS} per request` }, 400);

  // Validate shape + key safety up front.
  const clips: Array<{ key: string; lang: string; text: string }> = [];
  for (const c of rawClips) {
    const key = String(c?.key || '');
    const lang = String(c?.lang || '');
    const text = String(c?.text || '');
    if (!SAFE_KEY.test(key) || !['en', 'es', 'pt'].includes(lang) || !text) {
      return jsonResponse({ error: 'bad_clip', detail: key || '(empty)' }, 400);
    }
    clips.push({ key, lang, text });
  }

  const existing = overwrite ? new Set<string>() : await listExisting(SUPABASE_URL, SERVICE_KEY);
  const todo = clips.filter((c) => !existing.has(`${c.key}.mp3`));

  const baked: string[] = [];
  const failed: Array<{ key: string; detail: string }> = [];

  // Small concurrency pool — speeds the bake while staying gentle on ElevenLabs.
  let idx = 0;
  async function worker() {
    while (idx < todo.length) {
      const clip = todo[idx++];
      const tts = await synthesize(ELEVENLABS_API_KEY!, clip.text);
      if (!tts.ok) { failed.push({ key: clip.key, detail: `tts_${tts.status}:${tts.detail}` }); continue; }
      const path = `${clip.key}.mp3`;
      const up = await uploadObject(SUPABASE_URL!, SERVICE_KEY!, path, tts.buf);
      if (!up.ok) { failed.push({ key: clip.key, detail: `upload_${up.status}:${up.detail}` }); continue; }

      const sha = await sha256Hex(`${clip.lang}|${clip.text}`);
      await upsertFragmentRow(SUPABASE_URL!, SERVICE_KEY!, {
        fragment_key:   clip.key,
        speaker_role:   'coach_akeem',
        language:       clip.lang,
        script_text:    clip.text,
        script_version: 1,
        sha256:         sha,
        storage_path:   `${BUCKET}/${path}`,
        public_url:     `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`,
        duration_ms:    estimateDurationMs(tts.buf.length),
        status:         'active',
      });

      baked.push(clip.key);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, todo.length) }, () => worker()));

  console.log(`[bbf-bake-language-soundboard] requested=${clips.length} baked=${baked.length} skipped=${clips.length - todo.length} failed=${failed.length}`);
  return jsonResponse({
    ok: true,
    bucket: BUCKET,
    requested: clips.length,
    baked: baked.length,
    skipped_existing: clips.length - todo.length,
    failed,
    public_base: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}`,
  });
});
