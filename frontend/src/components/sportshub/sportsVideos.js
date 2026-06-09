// src/components/sportshub/sportsVideos.js
// ─────────────────────────────────────────────────────────────────────────────
// Localized demonstration-video resolver for the Sports Hub daily protocol
// (DayProtocol workout/drills + the Native Sport Engine SportProtocol blocks).
//
// DECOUPLED FROM THE VAULT MAP — by design. exerciseVideos.VIDEO_MAP doubles as
// the hypertrophy generator's allow-list (generatorEngine "no hardwired video →
// never programmed"), so sport-specific drills (sprints, ladder, box jumps, skill
// work) must NOT be added there. This resolver instead:
//   1. reuses the AUTHORIZED, movement-specific clip when the lift is in the Vault
//      map (resolveVideoEntry — e.g. Bench Press, RDL, Pull-Up, Walking Lunge), then
//   2. falls back to a localized CATEGORY coaching clip (speed / power / strength)
//      so every athletic drill still renders a real demonstration.
// Either way the entry is a { en, es, pt } map (or flat id) → VideoSlot resolves it
// to the active language with EN fallback, so the videos respect the EN/ES/PT toggle.

import { resolveVideoEntry } from '../vault/exerciseVideos.js';

// Verified, localized category coaching clips. EN ids are authorized clips; ES/PT are
// the native-language variants sourced in Priority Delta/Echo (mirrored from the Sports
// Hub metric videos). A missing localized variant safely falls back to EN via pickLang.
export const CATEGORY_VIDEOS = {
  speed:    { en: '_DLIS8SySzs', es: 'BCWwSLLILqc', pt: 'eVZqiH0JzY4' }, // acceleration / max-velocity mechanics
  power:    { en: 'S_uZP4UH6J0', es: '3NY1W_Frnhg', pt: 'HuR_YoPhJ4c' }, // explosive / triple extension
  strength: { en: 'GxsLrTzyGUU', es: 'WwHuwfuK2qM', pt: '6IgdSQzI5_I' }, // maximal strength / hinge
};

// Keyword → category (first hit wins). Skill/agility/footwork → speed; jumps/throws/
// olympic lifts → power; everything else (squat/press/row/pull/carry/core) → strength.
const CATEGORY_RULES = [
  [/sprint|speed|tempo|dash|fly|accel|velocit|run|ladder|shuttle|agilit|cone|slide|footwork|backpedal|mirror|react|cut|change.?of.?direction|skip|wicket|skill|dribbl|touch|shoot|catch|handle|\bread|cover|close/i, 'speed'],
  [/jump|bound|plyo|hop|clean|snatch|throw|med.?ball|broad|depth|explos|power|toss|punch|slam|swing/i, 'power'],
];

function classify(name) {
  const s = String(name || '');
  for (const [re, cat] of CATEGORY_RULES) if (re.test(s)) return cat;
  return 'strength';
}

// Resolve an exercise/drill NAME to a localized video entry ({ en, es, pt } or flat
// id) — the authorized movement-specific clip first, else a localized category demo.
// Always returns a usable entry so the daily blocks never fall back to text-only.
export function resolveAthleticVideo(name) {
  return resolveVideoEntry(name) || CATEGORY_VIDEOS[classify(name)];
}
