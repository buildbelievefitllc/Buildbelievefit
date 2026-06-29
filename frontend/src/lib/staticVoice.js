// src/lib/staticVoice.js
// ─────────────────────────────────────────────────────────────────────────────
// Operation Eviction — static-voice manifest resolver.
//
// The RPE / Affirmation / Weekly-Brief voiceovers are pre-rendered, permanent
// PUBLIC URLs in src/data/staticVoiceManifest.json (compiled by
// scripts/compile-voice-vault.js from bbf-static-voice-matrix.json). The runtime
// surfaces resolve their clip here instead of calling ElevenLabs live; on a miss,
// the caller degrades to the device-native voice (speechFallback.js).
//
// subject_line scheme (manifest `subjectLine`): {LANG}_{KIND}…
//   RPE         → EN_RPE_EXPLAIN
//   Affirmation → EN_AFF_01 … EN_AFF_14
//   Weekly Brief→ EN_WB_<SUBSTATUS>  (substatus comes verbatim from the engine,
//                 e.g. EN_WB_COMPLIANCE_NO_LOGS, EN_WB_PROGRESSION_NEW_MAX,
//                 EN_WB_PLATEAU_WITH_HIGH_RPE, EN_WB_NEUTRAL)

import manifest from '../data/staticVoiceManifest.json';

const BY_SUBJECT = new Map(manifest.map((m) => [String(m.subjectLine || '').toUpperCase(), m]));
const normLang = (lang) => (['en', 'es', 'pt'].includes(lang) ? lang : 'en').toUpperCase();

/** Resolve a manifest subject_line to its permanent public URL, or null on a miss. */
export function staticVoiceUrl(subjectLine) {
  if (!subjectLine) return null;
  return BY_SUBJECT.get(String(subjectLine).toUpperCase())?.url || null;
}

/** RPE education clip for a language. */
export function rpeExplainUrl(lang) {
  return staticVoiceUrl(`${normLang(lang)}_RPE_EXPLAIN`);
}

/** Daily affirmation clip for (language, affirmation id 1..14). */
export function affirmationUrl(lang, id) {
  return staticVoiceUrl(`${normLang(lang)}_AFF_${String(id).padStart(2, '0')}`);
}

/** Weekly-brief clip for (language, engine substatus); falls back to NEUTRAL. */
export function weeklyBriefUrl(lang, substatus) {
  const L = normLang(lang);
  return staticVoiceUrl(`${L}_WB_${String(substatus || 'NEUTRAL').toUpperCase()}`)
    || staticVoiceUrl(`${L}_WB_NEUTRAL`);
}
