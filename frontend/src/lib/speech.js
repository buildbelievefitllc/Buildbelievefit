// src/lib/speech.js
// ─────────────────────────────────────────────────────────────────────────────
// Two-tier voice narration for in-app study games.
//
//   Tier 1 (natural) — GET {PROXY}/api/tts, a free server-side proxy to Google's
//     TTS (no API key, no cost). Consistent, natural voice on every device. Played
//     via an <Audio> element, so cross-origin playback needs no CORS.
//   Tier 2 (fallback) — the browser's built-in speechSynthesis. Instant + offline;
//     used automatically whenever the network voice fails, is blocked, or the API
//     is unreachable — so narration can never fully break.
//
// narrate() is the entry point (network-first, auto-fallback). Content is English
// (the founder's curriculum language) regardless of the UI chrome language.

const PROXY_BASE = (import.meta.env.VITE_VOICE_PROXY_URL || 'https://buildbelievefit.onrender.com').replace(/\/$/, '');

// ── Tier 2 · Web Speech (fallback) ───────────────────────────────────────────
function synthSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';
}

function scoreVoice(v) {
  const n = (v.name || '').toLowerCase();
  let s = 0;
  if (/natural|neural/.test(n)) s += 6;
  if (/google/.test(n)) s += 4;
  if (/aria|jenny|guy|libby|sonia|ryan|enhanced|premium/.test(n)) s += 3;
  if (v.localService === false) s += 2;
  if (/^en-us/i.test(v.lang || '')) s += 1;
  return s;
}

function pickVoice(voices, prefix = 'en') {
  if (!voices || !voices.length) return null;
  const matched = voices.filter((v) => (v.lang || '').toLowerCase().startsWith(prefix));
  const pool = matched.length ? matched : voices;
  return pool.slice().sort((a, b) => scoreVoice(b) - scoreVoice(a))[0] || null;
}

let cachedVoice = null;
function resolveVoice() {
  if (!synthSupported()) return null;
  cachedVoice = pickVoice(window.speechSynthesis.getVoices(), 'en') || cachedVoice;
  return cachedVoice;
}

if (synthSupported()) {
  try {
    resolveVoice();
    window.speechSynthesis.addEventListener('voiceschanged', resolveVoice);
  } catch { /* older engines resolve at speak time */ }
}

function speakLocal(text, { rate = 0.98, pitch = 1 } = {}) {
  if (!synthSupported() || !text) return;
  const synth = window.speechSynthesis;
  try { synth.cancel(); } catch { /* ignore */ }
  const u = new window.SpeechSynthesisUtterance(String(text));
  const v = cachedVoice || resolveVoice();
  if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = 'en-US'; }
  u.rate = rate;
  u.pitch = pitch;
  try { synth.speak(u); } catch { /* ignore */ }
}

// ── Tier 1 · natural network voice (with auto-fallback to Tier 2) ─────────────
let currentAudio = null;
function stopAudio() {
  if (currentAudio) {
    try { currentAudio.pause(); currentAudio.src = ''; } catch { /* ignore */ }
    currentAudio = null;
  }
}

export function narrationSupported() {
  return typeof window !== 'undefined' && (typeof window.Audio === 'function' || synthSupported());
}

// Speak `text`, interrupting anything mid-utterance. Tries the natural network
// voice first; on any load/playback failure (before audio starts) it seamlessly
// falls back to the on-device voice.
export function narrate(text, { lang = 'en' } = {}) {
  if (typeof window === 'undefined' || !text) return;
  stopSpeaking();

  if (typeof window.Audio !== 'function') { speakLocal(text); return; }

  let started = false;
  let audio;
  const url = `${PROXY_BASE}/api/tts?lang=${encodeURIComponent(lang)}&text=${encodeURIComponent(text)}`;
  try { audio = new window.Audio(url); } catch { speakLocal(text); return; }
  currentAudio = audio;
  audio.addEventListener('playing', () => { started = true; }, { once: true });
  const fallback = () => {
    if (started) return;                       // already audible — don't double-speak
    if (currentAudio === audio) currentAudio = null;
    speakLocal(text);
  };
  audio.addEventListener('error', fallback, { once: true });
  const p = audio.play();
  if (p && typeof p.then === 'function') p.then(() => {}).catch(fallback);
}

export function stopSpeaking() {
  stopAudio();
  if (synthSupported()) { try { window.speechSynthesis.cancel(); } catch { /* ignore */ } }
}
