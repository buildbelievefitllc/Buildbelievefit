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

// Browsers surface several engines under one language tag — legacy desktop
// SAPI/eSpeak voices sound flatly robotic; neural/network voices ("Online
// (Natural)" on Edge, "Neural"/"Premium"/"Enhanced" on Chrome/Safari) sound
// far more natural and cost nothing extra. Score each candidate by name so
// the least robotic one wins — still $0, just a better pick from what the
// device already has installed.
const NATURAL_HINTS = [/online \(natural\)/i, /\bneural\b/i, /\bpremium\b/i, /\benhanced\b/i, /\bsiri\b/i, /\bgoogle\b/i, /\bnatural\b/i, /\bonline\b/i];
const ROBOTIC_HINTS = [/\bdesktop\b/i, /\bcompact\b/i, /espeak/i];
function voiceScore(v) {
  const name = String(v?.name || '');
  let score = 0;
  for (const re of NATURAL_HINTS) if (re.test(name)) score += 1;
  for (const re of ROBOTIC_HINTS) if (re.test(name)) score -= 2;
  return score;
}

// Edge/Chrome expose their online neural voices by first name — the SAME names
// Azure's short-codes use ("pt-BR-FranciscaNeural" → "Microsoft Francisca Online
// (Natural) - Portuguese (Brazil)"). A gender hint lets a caller ask for a male vs.
// female native speaker (e.g. a two-voice dialogue script) and get two genuinely
// distinct voices where the device has them, instead of the same voice twice.
const FEMALE_NAME_HINTS = [/francisca/i, /\bfemale\b/i, /\bwoman\b/i, /\bmulher\b/i, /\baria\b/i, /\bjenny\b/i, /samantha/i, /victoria/i, /\bzira\b/i, /raquel/i, /luciana/i, /\bmaria\b/i, /elena/i, /paulina/i];
const MALE_NAME_HINTS = [/ant[oô]nio/i, /\bguy\b/i, /\bmale\b/i, /\bhomem\b/i, /\bdaniel\b/i, /f[aá]bio/i, /humberto/i, /ricardo/i, /\bdiego\b/i, /\bpedro\b/i, /\bgeorge\b/i, /\bdavid\b/i, /\bjorge\b/i];
function genderScore(name, gender) {
  if (!gender) return 0;
  const same = gender === 'female' ? FEMALE_NAME_HINTS : MALE_NAME_HINTS;
  const opposite = gender === 'female' ? MALE_NAME_HINTS : FEMALE_NAME_HINTS;
  let score = 0;
  for (const re of same) if (re.test(name)) score += 4;
  for (const re of opposite) if (re.test(name)) score -= 4;
  return score;
}

// Best available voice for a BCP-47 tag: exact match → language-prefix match →
// null (let the engine use its default for utter.lang). Within the matching
// pool, prefer the least-robotic-sounding voice, then a name match for `gender`
// ('male' | 'female' | undefined) when the caller wants a specific speaker.
function pickVoice(voices, tag, gender) {
  if (!Array.isArray(voices) || !voices.length) return null;
  const lc = tag.toLowerCase();
  const prefix = lc.split('-')[0];
  const exact = voices.filter((v) => v.lang && v.lang.toLowerCase() === lc);
  const pool = exact.length ? exact : voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith(prefix));
  if (!pool.length) return null;
  const rank = (v) => voiceScore(v) + genderScore(String(v?.name || ''), gender);
  return pool.reduce((best, v) => (rank(v) > rank(best) ? v : best), pool[0]);
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
// `voiceGender` ('male' | 'female') asks pickVoice for a specific native speaker —
// e.g. a Pimsleur-style script alternating two distinct pt-BR voices. `rate` lets a
// caller slow speech down for language-learning clarity (Pimsleur lessons default
// to a touch under natural pace). When the device only has ONE voice for a language
// (so a gender hint can't be honored by voice choice), pitch is nudged slightly so
// the two "speakers" are still audibly distinct rather than identical.
export async function speakWithBrowser({ text, lang = 'en', voiceGender, rate, pitch, onEnd, onError } = {}) {
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
  const voice = pickVoice(voices, tag, voiceGender);
  if (voice) utter.voice = voice;
  utter.rate = rate ?? 1;
  const genderConfirmedByName = voice && genderScore(String(voice.name || ''), voiceGender) > 0;
  utter.pitch = pitch ?? (voiceGender && !genderConfirmedByName
    ? (voiceGender === 'female' ? 1.08 : 0.92)
    : 1);
  utter.onend = () => { onEnd?.(); };
  utter.onerror = (ev) => {
    if (ev?.error === 'canceled' || ev?.error === 'interrupted') return; // our own stop()
    onError?.(new Error('Stock voice playback failed.'));
  };

  synth.speak(utter);
  return { stop: () => { try { synth.cancel(); } catch { /* noop */ } } };
}
