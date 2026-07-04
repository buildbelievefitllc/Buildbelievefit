// src/lib/languageSoundboardVoice.js
// ─────────────────────────────────────────────────────────────────────────────
// Language Mastery soundboard — ElevenLabs client (Coach Akeem's cloned voice,
// eleven_multilingual_v2). Fronts bbf-language-soundboard-tts, which caches every
// synthesized cue by hash(lang|text) server-side so a repeat vocab/phrase/lesson
// play never re-bills ElevenLabs. speakWithBrowser (speechFallback.js) remains the
// $0 fallback the function's own header comment already documents — speakSmart
// below is the one call site every soundboard button should use.

import { FUNCTIONS_BASE, SUPABASE_ANON_KEY } from './supabaseClient.js';
import { speakWithBrowser } from './speechFallback.js';

const MAX_LEN = 800; // mirrors the edge function's own clamp

// A zero-length, valid 8kHz/8-bit/mono WAV — silent, ~44 bytes, no network. Playing
// it SYNCHRONOUSLY inside the click gesture unlocks HTMLMediaElement autoplay on
// iOS/Safari, the same problem warmUpSpeech() solves for speechSynthesis. Call this
// from the SAME click handler as warmUpSpeech() before the async ElevenLabs fetch —
// once the async hop happens, a first-ever audio.play() is no longer gesture-linked.
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
let _unlockEl = null;
export function warmUpAudioPlayback() {
  try {
    if (!_unlockEl) _unlockEl = new Audio(SILENT_WAV);
    _unlockEl.volume = 0;
    _unlockEl.play().catch(() => { /* unsupported/blocked — the real play() below still tries */ });
  } catch { /* noop */ }
}

// Speak `text` in Coach Akeem's ElevenLabs voice. Resolves a controller with stop()
// once playback actually starts; rejects on any transport/API failure (missing key,
// network, non-2xx, ok:false) so the caller can fall back to the free browser voice.
// onEnd/onError fire once, for natural completion vs. a mid-playback failure.
export async function speakWithEleven({ text, lang = 'es', onEnd, onError } = {}) {
  const cue = String(text ?? '').trim();
  if (!cue) {
    const e = new Error('Nothing to read yet.');
    e.code = 'empty_text';
    throw e;
  }

  const headers = { 'Content-Type': 'application/json' };
  if (SUPABASE_ANON_KEY) {
    headers.apikey = SUPABASE_ANON_KEY;
    headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
  }

  const res = await fetch(`${FUNCTIONS_BASE}/bbf-language-soundboard-tts`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ text: cue.slice(0, MAX_LEN), lang }),
  });
  const raw = await res.text();
  let body = null;
  try { body = raw ? JSON.parse(raw) : null; } catch { /* non-JSON body */ }

  if (!res.ok || !body?.ok || !body.audio_base64) {
    const e = new Error(`Voice engine unavailable (${body?.reason || res.status}).`);
    e.code = body?.reason || 'tts_unavailable';
    throw e;
  }

  const binary = atob(body.audio_base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: body.mime || 'audio/mpeg' }));

  const audio = new Audio(url);
  audio.onended = () => { URL.revokeObjectURL(url); onEnd?.(); };
  audio.onerror = () => { URL.revokeObjectURL(url); onError?.(new Error('ElevenLabs playback failed.')); };
  await audio.play(); // may throw (autoplay policy) — caller's catch() falls back to the browser voice

  return { stop: () => { try { audio.pause(); } catch { /* noop */ } URL.revokeObjectURL(url); } };
}

// Best-available speech for the Language Mastery soundboard: Coach Akeem's
// ElevenLabs voice first, falling back to the free on-device voice on ANY failure
// (offline, ElevenLabs down, autoplay block, playback error). Same call shape as
// speakWithBrowser — every soundboard button/lesson step should call THIS, not
// either voice path directly.
export async function speakSmart({ text, lang = 'es', voiceGender, rate, pitch, onEnd, onError } = {}) {
  try {
    return await speakWithEleven({ text, lang, onEnd, onError });
  } catch {
    return speakWithBrowser({ text, lang, voiceGender, rate, pitch, onEnd, onError });
  }
}
