// bbf-tts-eleven — ElevenLabs TTS gateway · data-driven voice routing
// ─────────────────────────────────────────────────────────────────────
// Accepts a feature key + text, resolves the voice_id from the public
// `voices` table (data-driven; swap voices later via SQL only), forwards
// to ElevenLabs /v1/text-to-speech/{voice_id}, returns the audio as
// base64-encoded MP3 inside JSON so the client can decode + play without
// any extra plumbing.
//
// Feature → voice mapping (live in public.voices):
//   phantom_eye      → Julius        (fitness · live vision check)
//   virtual_coach    → Julius        (fitness · live coach active)
//   nutrition_vision → Kelli LaShae  (nutrition · food frame)
//   virtual_chef     → Kelli LaShae  (nutrition · chef on call)
//
// Request:
//   POST /functions/v1/bbf-tts-eleven
//   { "feature": "phantom_eye", "text": "...", "model_id"?: string,
//     "voice_settings"?: { stability, similarity_boost, style, use_speaker_boost } }
//
// Response (200 OK · success):
//   { ok: true, voice_id, voice_name, category, audio_base64,
//     mime: "audio/mpeg", duration_ms_estimate, bytes }
//
// Response (200 OK · soft failure):
//   { ok: false, reason: "...", voice_id?, voice_name? }
//
// FAILURE POSTURE: every code path returns HTTP 200 with { ok: bool }.
// The frontend treats ok:false as "fall back to silent transcript".

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-bbf-admin-token',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

const MAX_TEXT_LEN          = 2500;   // ElevenLabs hard caps at ~2500 chars per request
const ELEVEN_TIMEOUT_MS     = 20000;
// eleven_flash_v2_5 → ~75ms first-byte latency (vs ~250-400ms on turbo).
// Same voices, slightly less expressive prosody — the latency win wins.
// To override per-request: POST with { model_id: 'eleven_turbo_v2_5' }.
const DEFAULT_MODEL_ID      = 'eleven_flash_v2_5';
const DEFAULT_VOICE_SETTINGS = {
  stability:         0.55,   // Bumped from 0.40 · pitch wobble report 2026-05-22.
                             // 0.40 was below ElevenLabs' "balanced" point (0.50)
                             // and produced mid-sentence pitch drift on both the
                             // Live Coach (Phantom Eye / Virtual Coach / Food Frame /
                             // Chef on Call) and the narrators (Julius / Kelli LaShae).
                             // 0.55 is just above balanced · still expressive,
                             // significantly less drift. Roll back to 0.40 if the
                             // voice starts sounding monotone.
  similarity_boost:  0.85,
  style:             0.00,   // Style transfer adds latency; off for snappier first-byte.
  use_speaker_boost: true,
};

// ─── Supabase voices-table lookup (REST, service role) ───────────────
async function fetchVoiceForFeature(feature: string, supabaseUrl: string, supabaseKey: string) {
  const url = `${supabaseUrl}/rest/v1/voices?feature=eq.${encodeURIComponent(feature)}&is_active=is.true&select=feature,voice_id,voice_name,category&limit=1`;
  try {
    const res = await fetch(url, {
      headers: {
        'apikey':        supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    if (!res.ok) {
      console.error(`[bbf-tts-eleven] voices fetch failed: HTTP ${res.status}`);
      return null;
    }
    const rows = await res.json();
    return (Array.isArray(rows) && rows[0]) || null;
  } catch (e) {
    console.error(`[bbf-tts-eleven] voices fetch error: ${(e as Error).message}`);
    return null;
  }
}

// ─── ElevenLabs TTS call w/ AbortController timeout ──────────────────
async function callElevenLabs(
  voiceId: string,
  text: string,
  modelId: string,
  voiceSettings: Record<string, unknown>,
  apiKey: string,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ELEVEN_TIMEOUT_MS);

  const requestBody = {
    text,
    model_id:       modelId,
    voice_settings: voiceSettings,
  };

  try {
    // output_format=mp3_44100_128 → 128 kbps MP3 @ 44.1 kHz · best balance
    // of file size + quality for browser playback through Web Audio.
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: {
          'xi-api-key':  apiKey,
          'Content-Type':'application/json',
          'Accept':      'audio/mpeg',
        },
        body:   JSON.stringify(requestBody),
        signal: controller.signal,
      },
    );

    if (!res.ok) {
      let errBody: any = null;
      try { errBody = await res.json(); } catch (_) { try { errBody = await res.text(); } catch (_) {} }
      console.error(`[bbf-tts-eleven] ElevenLabs API error: status=${res.status} body=${JSON.stringify(errBody).slice(0, 400)}`);
      return { ok: false as const, status: res.status, error: `elevenlabs_${res.status}`, body: errBody };
    }

    const buf = new Uint8Array(await res.arrayBuffer());
    return { ok: true as const, status: res.status, audio: buf };
  } catch (e) {
    const err = e as Error;
    const reason = err.name === 'AbortError' ? `timeout_${ELEVEN_TIMEOUT_MS}ms` : err.message;
    console.error(`[bbf-tts-eleven] ElevenLabs fetch threw: ${reason}`);
    return { ok: false as const, status: 0, error: reason };
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Base64 encoder for binary audio payload ─────────────────────────
function toBase64(bytes: Uint8Array): string {
  // Chunked to avoid call-stack blow-up on long buffers.
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)) as any);
  }
  return btoa(binary);
}

// Estimate playback duration from MP3 byte length @ 128 kbps. Conservative.
function estimateDurationMs(bytes: number): number {
  // 128 kbps = 16000 bytes/sec
  return Math.round((bytes / 16000) * 1000);
}

// ─── Handler ─────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  // GET /functions/v1/bbf-tts-eleven?diag=1  ·  one-shot health probe.
  // Surfaces which env vars are present (boolean only, no values) so we
  // can confirm ELEVENLABS_API_KEY landed without exposing the secret.
  if (req.method === 'GET') {
    const url = new URL(req.url);
    if (url.searchParams.get('diag') === '1') {
      return jsonResponse({
        ok: true,
        diag: {
          has_supabase_url:           !!Deno.env.get('SUPABASE_URL'),
          has_service_role_key:       !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
          has_anon_key:               !!Deno.env.get('SUPABASE_ANON_KEY'),
          has_elevenlabs_api_key:     !!Deno.env.get('ELEVENLABS_API_KEY'),
          elevenlabs_key_length:      (Deno.env.get('ELEVENLABS_API_KEY') || '').length,
        },
      });
    }
    return jsonResponse({ ok: false, reason: 'method_not_allowed' }, 405);
  }

  if (req.method !== 'POST') return jsonResponse({ ok: false, reason: 'method_not_allowed' }, 405);

  let payload: any;
  try { payload = await req.json(); }
  catch (_) { return jsonResponse({ ok: false, reason: 'invalid_json' }, 400); }

  const { feature, text, model_id, voice_settings } = payload || {};
  if (typeof feature !== 'string' || !feature.trim()) {
    return jsonResponse({ ok: false, reason: 'missing_feature' }, 400);
  }
  if (typeof text !== 'string' || !text.trim()) {
    return jsonResponse({ ok: false, reason: 'missing_text' }, 400);
  }

  const safeFeature = feature.slice(0, 64).toLowerCase();
  const safeText    = text.slice(0, MAX_TEXT_LEN);
  const safeModel   = (typeof model_id === 'string' && model_id) ? model_id.slice(0, 64) : DEFAULT_MODEL_ID;
  const safeSettings = (voice_settings && typeof voice_settings === 'object')
    ? { ...DEFAULT_VOICE_SETTINGS, ...voice_settings }
    : DEFAULT_VOICE_SETTINGS;

  // ─── 1. Resolve voice_id from data-driven Supabase table ───────
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY');
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('[bbf-tts-eleven] missing SUPABASE_URL or SUPABASE_*_KEY env');
    return jsonResponse({ ok: false, reason: 'config_missing_supabase' }, 200);
  }

  const voice = await fetchVoiceForFeature(safeFeature, SUPABASE_URL, SUPABASE_KEY);
  if (!voice || !voice.voice_id) {
    console.warn(`[bbf-tts-eleven] no active voice for feature=${safeFeature}`);
    return jsonResponse({ ok: false, reason: 'voice_not_found', feature: safeFeature }, 200);
  }

  // ─── 2. Synthesize ──────────────────────────────────────────────
  const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
  if (!ELEVENLABS_API_KEY) {
    console.error('[bbf-tts-eleven] missing ELEVENLABS_API_KEY env');
    return jsonResponse({
      ok:         false,
      reason:     'config_missing_elevenlabs_key',
      voice_id:   voice.voice_id,
      voice_name: voice.voice_name,
    }, 200);
  }

  const t0 = Date.now();
  const result = await callElevenLabs(voice.voice_id, safeText, safeModel, safeSettings, ELEVENLABS_API_KEY);
  const dur = Date.now() - t0;

  if (!result.ok) {
    return jsonResponse({
      ok:           false,
      reason:       result.error || 'tts_failed',
      status:       (result as any).status,
      eleven_body:  (result as any).body || null,
      voice_id:     voice.voice_id,
      voice_name:   voice.voice_name,
    }, 200);
  }

  const audioBase64 = toBase64(result.audio);
  const bytes       = result.audio.length;
  const durEstMs    = estimateDurationMs(bytes);

  console.log(`[bbf-tts-eleven] feature=${safeFeature} · voice=${voice.voice_name} (${voice.voice_id}) · text_len=${safeText.length} · audio_bytes=${bytes} · gen_ms=${dur} · play_est_ms=${durEstMs}`);

  return jsonResponse({
    ok:                   true,
    voice_id:             voice.voice_id,
    voice_name:           voice.voice_name,
    category:             voice.category,
    audio_base64:         audioBase64,
    mime:                 'audio/mpeg',
    duration_ms_estimate: durEstMs,
    bytes,
  }, 200);
});
