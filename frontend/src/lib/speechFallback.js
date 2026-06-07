// src/lib/speechFallback.js
// ─────────────────────────────────────────────────────────────────────────────
// Browser-native "stock voice" TTS — the device's built-in window.speechSynthesis
// voice. Zero API key, zero cost, zero billing: the SAME mechanism the legacy app
// used (bbf-app.html: text → speechSynthesis.speak). It is the Voice Coach's
// graceful fallback when the premium ElevenLabs path is unavailable (e.g. a 401
// billing block) — and it steps aside again automatically once Julius is back.

// BBF lang code → BCP-47 tag for the utterance + voice matching.
const LANG_TAG = { en: 'en-US', es: 'es-ES', pt: 'pt-BR' };

export function browserSpeechSupported() {
  return typeof window !== 'undefined'
    && 'speechSynthesis' in window
    && typeof window.SpeechSynthesisUtterance !== 'undefined';
}

// Prime speechSynthesis INSIDE a user gesture. iOS/Safari refuse to speak an
// utterance triggered after an async hop (our fallback only fires after the
// ElevenLabs round-trip) unless the engine was first unlocked during the click
// itself. A silent whitespace utterance does that. Call synchronously from the
// click handler; cheap, idempotent, a no-op where unsupported.
export function warmUpSpeech() {
  if (!browserSpeechSupported()) return;
  try {
    const warm = new SpeechSynthesisUtterance(' ');
    warm.volume = 0;
    window.speechSynthesis.speak(warm);
  } catch { /* noop */ }
}

// Best available voice for a BCP-47 tag: exact match → language-prefix match →
// null (let the engine use its default for utter.lang).
function pickVoice(voices, tag) {
  if (!Array.isArray(voices) || !voices.length) return null;
  const lc = tag.toLowerCase();
  const prefix = lc.split('-')[0];
  return voices.find((v) => v.lang && v.lang.toLowerCase() === lc)
    || voices.find((v) => v.lang && v.lang.toLowerCase().startsWith(prefix))
    || null;
}

// getVoices() is populated asynchronously in Chrome (empty until 'voiceschanged').
// Resolve with whatever is available after the event or a short timeout — never hang.
function loadVoices(synth) {
  return new Promise((resolve) => {
    const existing = synth.getVoices();
    if (existing && existing.length) { resolve(existing); return; }
    let done = false;
    const finish = () => { if (done) return; done = true; resolve(synth.getVoices() || []); };
    if (synth.addEventListener) synth.addEventListener('voiceschanged', finish, { once: true });
    setTimeout(finish, 500);
  });
}

// Speak `text` with the stock browser voice. Resolves a controller with stop().
// onEnd fires on natural completion; onError on a genuine failure (our own cancel()
// is ignored). Throws (so the caller can flash) when the platform has no engine.
export async function speakWithBrowser({ text, lang = 'en', onEnd, onError } = {}) {
  if (!browserSpeechSupported()) {
    const e = new Error('Your browser has no built-in voice.');
    e.code = 'no_speech_synthesis';
    throw e;
  }
  const cue = String(text ?? '').trim();
  if (!cue) {
    const e = new Error('Nothing to read yet.');
    e.code = 'empty_text';
    throw e;
  }

  const synth = window.speechSynthesis;
  const tag = LANG_TAG[lang] || LANG_TAG.en;
  synth.cancel(); // clear the warm-up / any wedged utterance

  const voices = await loadVoices(synth);
  const utter = new SpeechSynthesisUtterance(cue);
  utter.lang = tag;
  const voice = pickVoice(voices, tag);
  if (voice) utter.voice = voice;
  utter.rate = 1;
  utter.pitch = 1;
  utter.onend = () => { onEnd?.(); };
  utter.onerror = (ev) => {
    if (ev?.error === 'canceled' || ev?.error === 'interrupted') return; // our own stop()
    onError?.(new Error('Stock voice playback failed.'));
  };

  synth.speak(utter);
  return { stop: () => { try { synth.cancel(); } catch { /* noop */ } } };
}
