// src/lib/languageSoundboardVoice.js
// ─────────────────────────────────────────────────────────────────────────────
// Language Mastery soundboard — Coach Akeem's ElevenLabs voice clone, baked STATIC
// (scripts/build-language-soundboard-cues.mjs + bbf-bake-language-soundboard →
// the public `language-fragments` bucket, mirroring the coach-static architecture).
// Every fixed cue was synthesized ONCE; speakBaked plays that static clip straight
// from the bucket's CDN — ZERO recurring ElevenLabs spend for existing content.
//
// Three-tier fallback, each tier only reached if the one before it is unavailable:
//   1. speakStatic — the pre-baked clip (fragment_key = hash(lang|text), see staticKeyFor)
//   2. speakSmart   → speakWithEleven — a live, cached synth via bbf-language-soundboard-tts
//                      (covers any NEW cue added after the last bake)
//   3. speakWithBrowser (speechFallback.js) — the free on-device voice, last resort
//
// speakBaked is the one call site every soundboard button/lesson step should use.

import { FUNCTIONS_BASE, SUPABASE_ANON_KEY } from './supabaseClient.js';
import { speakWithBrowser } from './speechFallback.js';

const MAX_LEN = 800; // mirrors the edge function's own clamp

// Content-hash fragment key — MUST match scripts/build-language-soundboard-cues.mjs's
// keyFor() exactly (sha256(lang|text), no version segment) so any call site resolves
// the right static clip from just (lang, text), with no shared manifest to keep in
// sync. Changing this derivation orphans every already-baked clip — don't.
async function staticKeyFor(lang, text) {
  const bytes = new TextEncoder().encode(`${lang}|${String(text ?? '').trim()}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hex = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `RDMP-${hex.slice(0, 20)}`;
}

function staticFragmentUrl(key) {
  const base = String(FUNCTIONS_BASE || '').replace(/\/functions\/v1$/, '/storage/v1/object/public');
  return `${base}/language-fragments/${key}.mp3`;
}

// Try the pre-baked static clip. Rejects (never baked, or the bucket is unreachable)
// so the caller falls through to the live/cached tier — the HEAD check keeps a
// missing clip from ever surfacing as a broken <audio> element.
async function speakStatic({ text, lang, onEnd, onError }) {
  const key = await staticKeyFor(lang, text);
  const url = staticFragmentUrl(key);
  const head = await fetch(url, { method: 'HEAD' });
  if (!head.ok) throw new Error('not_baked');

  const audio = new Audio(url);
  audio.onended = () => onEnd?.();
  audio.onerror = () => onError?.(new Error('Static clip playback failed.'));
  await audio.play();
  return { stop: () => { try { audio.pause(); } catch { /* noop */ } } };
}

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

// The soundboard's one true entry point: static baked clip → live cached synth →
// free browser voice. Same call shape as speakWithBrowser/speakSmart throughout.
export async function speakBaked({ text, lang = 'es', voiceGender, rate, pitch, onEnd, onError } = {}) {
  try {
    return await speakStatic({ text, lang, onEnd, onError });
  } catch {
    return speakSmart({ text, lang, voiceGender, rate, pitch, onEnd, onError });
  }
}
