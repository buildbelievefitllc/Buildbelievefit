// src/lib/speechNarrator.js
// ─────────────────────────────────────────────────────────────────────────────
// Native HTML5 Web Speech narrator (window.speechSynthesis) — zero-API TTS for
// the Coach Lab Research Vault audio scripts.
//
// PREMIUM VOICE FILTER: speechSynthesis.getVoices() is scanned for the
// high-quality OS voices ("Premium" / "Enhanced" tiers, Google US English,
// macOS/iOS "Samantha", Windows "Natural") before ever falling back to the
// basic default — the robotic fallback only plays when nothing better exists
// on the device. getVoices() populates asynchronously on some engines, so the
// cache re-primes on the voiceschanged event.
//
// SINGLE TRACK: every speak() cancels any active utterance first — one audio
// track at a time, platform-wide. Callers get the utterance back so they can
// verify identity in onEnd (a cancelled utterance still fires its end event,
// and must not clear the NEXT track's playing state).

const PREMIUM_MARKERS = ['premium', 'enhanced', 'google us english', 'samantha', 'natural'];

export const ttsSupported =
  typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

let voicesCache = [];
function refreshVoices() {
  try { voicesCache = window.speechSynthesis.getVoices() || []; } catch { voicesCache = []; }
}
if (ttsSupported) {
  refreshVoices();
  // Chrome/Edge load the voice list async — re-prime whenever it lands.
  try { window.speechSynthesis.addEventListener('voiceschanged', refreshVoices); } catch { /* older engines */ }
}

// Explicitly select a high-quality OS voice; basic default only as last resort.
export function pickPremiumVoice(langPrefix = 'en') {
  if (!ttsSupported) return null;
  if (!voicesCache.length) refreshVoices();
  const pool = voicesCache.filter((v) => String(v.lang || '').toLowerCase().startsWith(langPrefix));
  for (const marker of PREMIUM_MARKERS) {
    const hit = pool.find((v) => String(v.name || '').toLowerCase().includes(marker));
    if (hit) return hit;
  }
  return pool.find((v) => v.default) || pool[0] || null;
}

// Speak one script. Cancels anything already playing (single-track contract).
// Returns the utterance (identity token for onEnd guards), or null when TTS is
// unavailable / the text is empty.
// `lang` (e.g. 'es' | 'pt') selects a premium voice in THAT language — without
// it the narrator reads Spanish/Portuguese with an English voice (the Language
// Lab bug the Fable Fleet Sync fixed). Omitting `lang` keeps the English
// default for legacy callers (ResearchLibrary).
export function speakScript(text, { onEnd, rate = 1, pitch = 1, lang } = {}) {
  const script = String(text || '').trim();
  if (!ttsSupported || !script) return null;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(script);
  const voice = pickPremiumVoice(lang || 'en');
  if (voice) { u.voice = voice; u.lang = voice.lang; }
  else if (lang) { u.lang = lang; } // no local voice in that language — let the engine resolve the tag
  u.rate = rate;
  u.pitch = pitch;
  if (onEnd) { u.onend = onEnd; u.onerror = onEnd; }
  window.speechSynthesis.speak(u);
  return u;
}

export function stopSpeech() {
  if (ttsSupported) { try { window.speechSynthesis.cancel(); } catch { /* noop */ } }
}
