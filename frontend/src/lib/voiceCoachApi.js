// src/lib/voiceCoachApi.js
// ─────────────────────────────────────────────────────────────────────────────
// AI Voice Coach client — fronts the bbf-tts-eleven edge function (the ElevenLabs
// TTS gateway). RESTORED to the React engine; the Live Vision camera path stays
// deprecated. Voice selection is DATA-DRIVEN server-side: we send a FEATURE key
// and the function resolves the voice_id from public.voices (virtual_coach →
// Julius, fitness). No voice ids or model strings live in the client.
//
//   POST {FUNCTIONS_BASE}/bbf-tts-eleven
//   headers: apikey + Authorization: Bearer <anon>   (gateway routing — this is a
//            global core feature, NOT admin-gated; mirrors prehabApi.js)
//   body:    { feature, text }
//   → 200    { ok:true,  voice_name, audio_base64, mime, duration_ms_estimate }
//          | { ok:false, reason }            (soft failure — degrade to silent)
//
// FAILURE POSTURE mirrors the edge function: every transport success is HTTP 200
// with { ok:bool }. We surface ok:false as a short, coded Error the button shows
// briefly — never a thrown stack, never a silent hang.

import { FUNCTIONS_BASE, SUPABASE_ANON_KEY } from './supabaseClient.js';

// The voices-table key for the Program tab's audio coaching session (fitness ·
// Julius). Named so callers never inline the wire string.
export const COACH_FEATURE = 'virtual_coach';

// ElevenLabs hard-caps a request at ~2500 chars; mirror it so an over-long cue is
// trimmed client-side rather than truncated mid-word server-side.
export const COACH_TEXT_MAX = 2500;

// Map the edge function's ok:false reason slugs to a short, athlete-facing line.
function reasonHint(reason) {
  switch (reason) {
    case 'voice_not_found':                return 'Coach voice is offline.';
    case 'config_missing_elevenlabs_key':  return 'Voice engine not configured.';
    case 'config_missing_supabase':        return 'Voice engine not configured.';
    case 'missing_text':                   return 'Nothing to read yet.';
    default:                               return 'Voice coach unavailable.';
  }
}

// Request synthesized coaching audio. Resolves to { audioBase64, mime, voiceName,
// durationMs } on success; throws a display-ready, coded Error otherwise. Pass an
// AbortSignal to cancel an in-flight synthesis (e.g. on unmount).
export async function requestCoachVoice({ feature = COACH_FEATURE, text, signal } = {}) {
  const cue = String(text ?? '').trim();
  if (!cue) {
    const e = new Error('Nothing to read yet.');
    e.code = 'empty_text';
    throw e;
  }

  const headers = { 'Content-Type': 'application/json' };
  // Gateway routing — without the anon key the request 401s at the edge before the
  // function runs. The anon/publishable key is safe in the bundle (RLS is the real
  // boundary); this function carries no admin gate.
  if (SUPABASE_ANON_KEY) {
    headers.apikey = SUPABASE_ANON_KEY;
    headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
  }

  let res;
  try {
    res = await fetch(`${FUNCTIONS_BASE}/bbf-tts-eleven`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ feature, text: cue.slice(0, COACH_TEXT_MAX) }),
      signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    const e = new Error('Network unreachable — the voice engine could not be reached.');
    e.code = 'network';
    e.cause = err;
    throw e;
  }

  const raw = await res.text();
  let body = null;
  try { body = raw ? JSON.parse(raw) : null; } catch { /* non-JSON body */ }

  if (!res.ok) {
    const slug = body?.reason || body?.error || raw || 'unknown error';
    const e = new Error(`Voice engine returned ${res.status} (${slug}).`);
    e.code = res.status;
    throw e;
  }
  if (!body?.ok || !body.audio_base64) {
    const e = new Error(reasonHint(body?.reason));
    e.code = body?.reason || 'tts_unavailable';
    throw e;
  }

  return {
    audioBase64: body.audio_base64,
    mime:        body.mime || 'audio/mpeg',
    voiceName:   body.voice_name || 'Coach',
    durationMs:  Number(body.duration_ms_estimate) || 0,
  };
}

// Decode a base64 audio payload into a playable object-URL. Returns the url plus a
// revoke() the caller MUST invoke (on ended / stop / unmount) so the blob is freed.
export function decodeAudio(audioBase64, mime = 'audio/mpeg') {
  const binary = atob(audioBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  return { url, revoke: () => URL.revokeObjectURL(url) };
}
