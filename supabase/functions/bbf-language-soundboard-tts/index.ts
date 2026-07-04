// supabase/functions/bbf-language-soundboard-tts/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// Language Mastery soundboard — cached ElevenLabs TTS gateway (Coach Akeem's voice
// clone, eleven_multilingual_v2). Fronts AdminLanguageRoadmap (Vocab Gym, Rio Ready,
// Voice Studio, Immersion Lab) and PimsleurAudioLab; the browser's free stock voice
// (speechFallback.js) stays the client-side fallback when this path is unavailable.
//
// Every distinct (lang, text) cue is a FIXED, closed-set string (vocab term, phrase,
// lesson line) — never freely generated — so a Postgres cache keyed by hash(lang|text)
// means each cue is billed to ElevenLabs at most once, ever; every repeat play is free.
//
// Request:
//   POST /functions/v1/bbf-language-soundboard-tts
//   { "text": "...", "lang": "es" | "pt" | "en" }
//   → 200 { ok:true, audio_base64, mime, bytes, cached }
//   | 200 { ok:false, reason }   (soft failure — client falls back to speakWithBrowser)
//
// FAILURE POSTURE: every code path returns HTTP 200 with { ok: bool } (mirrors bbf-tts-eleven).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type',
};
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

// Coach Akeem's Professional Voice Clone (CLAUDE.md §4 / scripts/README-coach-static.md) —
// multilingual so the SAME voice covers en/es/pt cues without a separate native persona.
const AKEEM_VOICE_ID    = 'ZbKDEqxkr8Ub4psNm5XD';
const VOICE_MODEL       = 'eleven_multilingual_v2';
const VOICE_SETTINGS    = { stability: 0.35, similarity_boost: 0.85, style: 0.15, use_speaker_boost: true };
const CACHE_VERSION     = 'v1'; // bump to deliberately bust the cache on a voice/model change
const MAX_TEXT_LEN      = 800;
const ELEVEN_TIMEOUT_MS = 20000;

function pgHeaders(key: string): HeadersInit {
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

function bg(p: Promise<unknown>) {
  const caught = p.catch((e) => { console.error('[bbf-language-soundboard-tts] bg task failed:', String((e as Error)?.message ?? e)); });
  try { (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime?.waitUntil?.(caught); } catch { /* best effort */ }
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function readCache(url: string, key: string, hash: string): Promise<{ audio_b64: string; mime: string; bytes: number } | null> {
  try {
    const r = await fetch(
      `${url}/rest/v1/bbf_language_soundboard_audio?cache_hash=eq.${encodeURIComponent(hash)}&select=audio_b64,mime,bytes&limit=1`,
      { headers: pgHeaders(key) },
    );
    if (!r.ok) return null;
    const rows = await r.json().catch(() => null);
    return (Array.isArray(rows) && rows[0]) || null;
  } catch { return null; }
}

async function bumpHit(url: string, key: string, hash: string) {
  await fetch(`${url}/rest/v1/bbf_language_soundboard_audio?cache_hash=eq.${encodeURIComponent(hash)}`, {
    method: 'PATCH',
    headers: { ...pgHeaders(key), Prefer: 'return=minimal' },
    body: JSON.stringify({ last_hit_at: new Date().toISOString() }),
  });
}

async function insertCache(url: string, key: string, row: Record<string, unknown>) {
  await fetch(`${url}/rest/v1/bbf_language_soundboard_audio`, {
    method: 'POST',
    headers: { ...pgHeaders(key), Prefer: 'return=minimal,resolution=ignore-duplicates' },
    body: JSON.stringify(row),
  });
}

async function synthesizeEleven(apiKey: string, text: string): Promise<{ ok: true; buf: Uint8Array } | { ok: false; status: number; detail: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ELEVEN_TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(AKEEM_VOICE_ID)}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify({ text, model_id: VOICE_MODEL, voice_settings: VOICE_SETTINGS }),
        signal: controller.signal,
      },
    );
    if (!res.ok) return { ok: false, status: res.status, detail: (await res.text().catch(() => '')).slice(0, 200) };
    return { ok: true, buf: new Uint8Array(await res.arrayBuffer()) };
  } catch (e) {
    const err = e as Error;
    return { ok: false, status: 0, detail: err.name === 'AbortError' ? `timeout_${ELEVEN_TIMEOUT_MS}ms` : err.message };
  } finally {
    clearTimeout(timeout);
  }
}

function toBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)) as any);
  }
  return btoa(binary);
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const SUPABASE_URL       = Deno.env.get('SUPABASE_URL');
  const SERVICE_KEY        = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');

  if (req.method === 'GET') {
    const url = new URL(req.url);
    if (url.searchParams.get('diag') === '1') {
      return jsonResponse({
        ok: true,
        diag: {
          has_supabase_url:       !!SUPABASE_URL,
          has_service_role_key:   !!SERVICE_KEY,
          has_elevenlabs_api_key: !!ELEVENLABS_API_KEY,
        },
      });
    }
    return jsonResponse({ ok: false, reason: 'method_not_allowed' }, 405);
  }

  if (req.method !== 'POST') return jsonResponse({ ok: false, reason: 'method_not_allowed' }, 405);
  if (!SUPABASE_URL || !SERVICE_KEY) return jsonResponse({ ok: false, reason: 'config_missing_supabase' }, 200);

  let payload: any;
  try { payload = await req.json(); }
  catch { return jsonResponse({ ok: false, reason: 'invalid_json' }, 400); }

  const { text, lang } = payload || {};
  if (typeof text !== 'string' || !text.trim()) return jsonResponse({ ok: false, reason: 'missing_text' }, 400);

  const safeLang = ['en', 'es', 'pt'].includes(lang) ? lang : 'es';
  const safeText = text.trim().slice(0, MAX_TEXT_LEN);
  const hash     = await sha256Hex(`${CACHE_VERSION}|${safeLang}|${safeText}`);

  // ─── 1. Cache check — a repeat cue never re-bills ElevenLabs ───
  const cached = await readCache(SUPABASE_URL, SERVICE_KEY, hash);
  if (cached?.audio_b64) {
    bg(bumpHit(SUPABASE_URL, SERVICE_KEY, hash));
    return jsonResponse({
      ok:           true,
      audio_base64: cached.audio_b64,
      mime:         cached.mime || 'audio/mpeg',
      bytes:        cached.bytes,
      cached:       true,
    });
  }

  // ─── 2. Cache miss — synthesize via ElevenLabs ───
  if (!ELEVENLABS_API_KEY) return jsonResponse({ ok: false, reason: 'config_missing_elevenlabs_key' }, 200);

  const t0  = Date.now();
  const tts = await synthesizeEleven(ELEVENLABS_API_KEY, safeText);
  const dur = Date.now() - t0;

  if (!tts.ok) {
    console.error(`[bbf-language-soundboard-tts] eleven_${tts.status}: ${tts.detail}`);
    return jsonResponse({ ok: false, reason: `tts_failed_${tts.status}` }, 200);
  }

  const audioBase64 = toBase64(tts.buf);
  const bytes        = tts.buf.length;

  bg(insertCache(SUPABASE_URL, SERVICE_KEY, {
    cache_hash: hash,
    lang:       safeLang,
    cue_text:   safeText,
    voice_id:   AKEEM_VOICE_ID,
    model_id:   VOICE_MODEL,
    audio_b64:  audioBase64,
    mime:       'audio/mpeg',
    bytes,
  }));

  console.log(`[bbf-language-soundboard-tts] lang=${safeLang} text_len=${safeText.length} audio_bytes=${bytes} gen_ms=${dur} cached=false`);

  return jsonResponse({ ok: true, audio_base64: audioBase64, mime: 'audio/mpeg', bytes, cached: false });
});
