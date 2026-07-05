// src/lib/contextualVoiceover.js
// ─────────────────────────────────────────────────────────────────────────────
// CONTEXTUAL VOICEOVER LAYER — static-key → permanent-URL resolver.
//
// Three "explain the WHY" coach clips, synthesized ONCE in Coach Akeem's cloned
// voice (ElevenLabs multilingual_v2, locked physics) and shelved permanently in
// the public studio-audio-vault bucket by scripts/compile-voice-vault.js
// (VAULT_SCRIPTS=bbf-contextual-voiceover-scripts.json). The compiler stamps each
// clip's static key into `subjectLine`, so the frontend resolves a stable
// AUDIO_CTX_* key to its permanent URL here — no API, no synth, no backend ping.
//
// Same shape/discipline as sovereignManifest.js (the biometric-matrix resolver);
// kept in a SEPARATE manifest so re-compiling either deck never clobbers the other.

import manifest from '../data/contextualVoiceoverManifest.json';

// The three bound static keys (also each clip's `subjectLine` in the manifest).
export const AUDIO_CTX_HUB_CHECKIN = 'AUDIO_CTX_HUB_CHECKIN';
export const AUDIO_CTX_PROGRAM_RPE = 'AUDIO_CTX_PROGRAM_RPE';
export const AUDIO_CTX_POST_WORKOUT = 'AUDIO_CTX_POST_WORKOUT';
export const AUDIO_CTX_NUTRITION = 'AUDIO_CTX_NUTRITION';

// key (subjectLine) → entry (id, category, subjectLine, scenario, duration, url)
const BY_KEY = new Map(manifest.map((m) => [m.subjectLine, m]));

/** Resolve a static AUDIO_CTX key (or a full URL passed through) to a playable public URL. */
export function contextualAudioUrl(key) {
  if (!key) return null;
  // Defensive: accept a full URL verbatim if one is ever passed instead of a key.
  if (/^https?:\/\//i.test(key)) return key;
  return BY_KEY.get(key)?.url || null;
}

/** The full manifest entry for a key, or null. */
export function contextualAudioEntry(key) {
  return key ? BY_KEY.get(key) || null : null;
}

export { manifest as contextualManifest };
