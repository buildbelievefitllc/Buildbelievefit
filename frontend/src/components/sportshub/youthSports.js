// src/components/sportshub/youthSports.js
// ─────────────────────────────────────────────────────────────────────────────
// Youth intake — sport / position(or event) selection taxonomy.
//
// Ball sports reuse the canonical POSITION_GROUPS from the Sports Portal (whose
// `legacy` codes resolve REAL COMBINE_BENCHMARKS), so the intake choice flows
// straight through to the Hub's metric calculators. `field` flips the secondary
// input between Position and Event. Sport NAMES are trilingual (yi-sport-* in
// LangContext); position/event labels stay in the canonical English taxonomy
// (parity with the Sports Portal, which renders positions in English).

import { POSITION_GROUPS } from '../sports/sportsData.js';

// Track is not in the legacy ball-sport taxonomy — it carries its own EVENT groups
// (codes resolve hubData.TRACK_BENCHMARKS) and uses the "Event" secondary label.
const TRACK_EVENTS = [
  { label: 'Sprints (100 / 200m)', legacy: 'sprints' },
  { label: 'Distance (800m+)', legacy: 'distance' },
  { label: 'Jumps', legacy: 'jumps' },
  { label: 'Throws', legacy: 'throws' },
];

export const YOUTH_SPORTS = [
  { id: 'football', labelKey: 'yi-sport-football', field: 'position', options: POSITION_GROUPS.football },
  { id: 'basketball', labelKey: 'yi-sport-basketball', field: 'position', options: POSITION_GROUPS.basketball },
  { id: 'soccer', labelKey: 'yi-sport-soccer', field: 'position', options: POSITION_GROUPS.soccer },
  { id: 'baseball', labelKey: 'yi-sport-baseball', field: 'position', options: POSITION_GROUPS.baseball },
  { id: 'volleyball', labelKey: 'yi-sport-volleyball', field: 'position', options: POSITION_GROUPS.volleyball },
  { id: 'track', labelKey: 'yi-sport-track', field: 'event', options: TRACK_EVENTS },
];

export function getSport(id) {
  return YOUTH_SPORTS.find((s) => s.id === id) || null;
}

// Human label for a sport+code pair (Hub hero / dossier display). Falls back to
// the raw code so an unmapped value still renders something sane.
export function positionLabel(sportId, code) {
  const s = getSport(sportId);
  return s?.options.find((o) => o.legacy === code)?.label || code || '—';
}
