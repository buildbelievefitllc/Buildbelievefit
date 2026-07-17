// src/lib/speech.js
// ─────────────────────────────────────────────────────────────────────────────
// Lightweight Web Speech (speechSynthesis) wrapper for in-app voice narration.
//
// Chosen over a network TTS (ElevenLabs) for the game loop because it is:
//   • instant — no round-trip lag on every answer (immersion needs zero delay),
//   • offline — works with no network, matching the PWA standard,
//   • free + CSP-safe — no edge function, no API cost, no external host.
// To keep it "natural", pickVoice() ranks the device's installed voices and
// prefers the modern neural / cloud ones (Natural, Neural, Google, Microsoft)
// over the older robotic local fallbacks.
//
// Content is English (the founder's curriculum language) so we narrate with an
// English voice regardless of the UI chrome language.

function isSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';
}

function scoreVoice(v) {
  const n = (v.name || '').toLowerCase();
  let s = 0;
  if (/natural|neural/.test(n)) s += 6;         // Microsoft/Edge neural, Apple "…(Enhanced)"
  if (/google/.test(n)) s += 4;                 // Chrome's cloud voices
  if (/aria|jenny|guy|libby|sonia|ryan|enhanced|premium/.test(n)) s += 3;
  if (v.localService === false) s += 2;         // cloud voices are generally richer
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
  if (!isSupported()) return null;
  const voices = window.speechSynthesis.getVoices();
  cachedVoice = pickVoice(voices, 'en') || cachedVoice;
  return cachedVoice;
}

// Voices load asynchronously in most browsers — refresh the cache when they land.
if (isSupported()) {
  try {
    resolveVoice();
    window.speechSynthesis.addEventListener('voiceschanged', resolveVoice);
  } catch { /* older engines fire this differently; getVoices() at speak time still works */ }
}

export function speechSupported() {
  return isSupported();
}

// Speak `text`, cancelling anything mid-utterance first (so a fast tap interrupts
// the prompt narration cleanly). rate slightly under 1 reads more naturally.
export function speak(text, { rate = 0.98, pitch = 1 } = {}) {
  if (!isSupported() || !text) return;
  const synth = window.speechSynthesis;
  try { synth.cancel(); } catch { /* ignore */ }
  const u = new window.SpeechSynthesisUtterance(String(text));
  const v = cachedVoice || resolveVoice();
  if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = 'en-US'; }
  u.rate = rate;
  u.pitch = pitch;
  try { synth.speak(u); } catch { /* ignore */ }
}

export function stopSpeaking() {
  if (!isSupported()) return;
  try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
}
