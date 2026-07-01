// src/lib/scienceHubVoice.js
// ─────────────────────────────────────────────────────────────────────────────
// Science Hub "Listen" — static-voice manifest resolver.
//
// Every Science Hub study tab (Abstract · Methodology · Findings · Akeem's
// Practical Application × 8 studies = 32 clips) is pre-rendered ONCE in Coach
// Akeem's real ElevenLabs voice and stored as a permanent PUBLIC URL in the
// `coach-static` bucket (baked by the bbf-bake-coach-static edge function).
// scienceHubVoiceManifest.json maps (studyId, tabId) → that permanent URL, so
// the Listen button plays the premium voice at zero cost per listen. On a miss,
// the caller degrades to the device-native voice (speechFallback.js) — the same
// premium-primary / stock-voice-fallback pattern as vault/CoachAudioButton.jsx.

import manifest from '../data/scienceHubVoiceManifest.json';

const BY_KEY = new Map(manifest.map((m) => [`${m.studyId}::${m.tabId}`, m.url]));

/** Resolve a Science Hub clip to its permanent public URL, or null on a miss. */
export function scienceHubVoiceUrl(studyId, tabId) {
  if (!studyId || !tabId) return null;
  return BY_KEY.get(`${studyId}::${tabId}`) || null;
}
