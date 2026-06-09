// src/components/sportshub/sportsVideos.js
// ─────────────────────────────────────────────────────────────────────────────
// Demonstration-video resolver for the Sports Hub daily protocol (DayProtocol
// workout/drills + the Native Sport Engine SportProtocol blocks).
//
// STRICT ACCURACY (CEO order): only ever return an EXACT, verified clip for the
// movement. If a sport-specific drill (Box Jump, Defensive Slide, Sprint Intervals…)
// has no 1-to-1 entry in the authorized video map, return null — the renderer then
// shows a clean text-only row. We NEVER substitute a generic category clip: an
// inaccurate video (a Hip Thrust under "Box Jump") breaks trust.
//
// DECOUPLED FROM THE VAULT GENERATOR: this reads exerciseVideos.resolveVideoEntry
// (the authorized, localized { en, es, pt } map) for resolution only — it never adds
// keys to that map, so it can't widen the hypertrophy generator's allow-list.
// When an entry exists it is localized, so VideoSlot honors the EN/ES/PT toggle.

import { resolveVideoEntry } from '../vault/exerciseVideos.js';

// Resolve an exercise/drill NAME to its authorized localized video entry
// ({ en, es, pt } or flat id), or null when there is no verified 1-to-1 clip.
export function resolveAthleticVideo(name) {
  return resolveVideoEntry(name) || null;
}
