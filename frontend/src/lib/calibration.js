// src/lib/calibration.js
// ─────────────────────────────────────────────────────────────────────────────
// 30-Day Biometric Calibration — the pure progression brain (NO React, NO network).
//
// New athletes are NOT handed the full platform on Day 1. The calibration clock is
// anchored on the athlete's real intake timestamp (bbf_active_clients.created_at),
// broadcast at login by bbf_verify_user_pin as `calibration_started_at` and carried
// on the auth session. From that single anchor we derive a live "calibration day"
// and a phase, which gate the premium surfaces in three stages:
//
//   Phase 1 · The Baseline  (days 1–14)  → Smart Cardio LOCKED, Library LOCKED
//   Phase 2 · The Ignition  (days 15–29) → Smart Cardio UNLOCKED, Library LOCKED
//   Phase 3 · Sovereign     (day 30+)    → everything UNLOCKED (graduated)
//
// ⚠️ FAIL-OPEN (same doctrine as entitlements.js): an absent/invalid anchor resolves
// to GRADUATED, never to "Day 1". Existing clients (intake 30+ days ago) auto-graduate
// with zero disruption; an undatable account is never padlocked by this gate. The
// tier entitlement gate (entitlements.js) is ORTHOGONAL and still resolved FIRST —
// calibration only ever ADDS a temporal lock on top of a tier the athlete already owns.

export const CALIBRATION_WINDOW_DAYS = 30;

// Phase identifiers (the CEO's three-stage ladder).
export const CAL_PHASE = {
  BASELINE: 1,  // days 1–14  — "The Baseline"
  IGNITION: 2,  // days 15–29 — "The Ignition"
  SOVEREIGN: 3, // day 30+    — "The Vault" (graduated)
};

// Phase boundary days — the FIRST day of each post-Baseline phase.
export const IGNITION_DAY = 15;   // Smart Cardio unlocks
export const SOVEREIGN_DAY = 30;  // Library + dynamic AI audio unlock (graduation)

// Vault tab id → the calibration day on which it unlocks. A tab absent here is NOT
// calibration-gated. THIS MAP IS THE ENTIRE POLICY — re-point "the Library" to a
// different tab by editing one line.
export const CALIBRATION_GATE = {
  cardio: IGNITION_DAY,      // Smart Cardio — unlocks Phase 2 (Day 15)
  generator: SOVEREIGN_DAY,  // The Library (on-demand AI workout builder) — Phase 3 (Day 30)
};

const DAY_MS = 24 * 60 * 60 * 1000;

// The graduated sentinel — what every fail-open / no-anchor path returns. Frozen so
// callers can never mutate the shared object.
const GRADUATED = Object.freeze({
  day: null,
  phase: CAL_PHASE.SOVEREIGN,
  isGraduated: true,
  hasAnchor: false,
});

// Resolve the live calibration state from the intake anchor.
//   startedAtMs : epoch ms of bbf_active_clients.created_at (null/NaN if absent)
//   nowMs       : epoch ms "now" (injected so callers + tests stay deterministic)
export function computeCalibration(startedAtMs, nowMs) {
  const start = Number(startedAtMs);
  const now = Number(nowMs);
  if (!Number.isFinite(start) || start <= 0 || !Number.isFinite(now)) return GRADUATED;
  // Day 1 = intake day. Clock skew (now < start) clamps to Day 1, never 0/negative.
  const day = Math.max(1, Math.floor((now - start) / DAY_MS) + 1);
  return {
    day,
    phase: phaseForDay(day),
    isGraduated: day >= SOVEREIGN_DAY,
    hasAnchor: true,
  };
}

// Map a calibration day → its phase. Out-of-range / non-finite → graduated.
export function phaseForDay(day) {
  if (!Number.isFinite(day) || day >= SOVEREIGN_DAY) return CAL_PHASE.SOVEREIGN;
  if (day >= IGNITION_DAY) return CAL_PHASE.IGNITION;
  return CAL_PHASE.BASELINE;
}

// The calibration day a tab unlocks on (0 ⇒ not calibration-gated).
export function unlockDayForTab(tabId) {
  return Object.prototype.hasOwnProperty.call(CALIBRATION_GATE, tabId)
    ? CALIBRATION_GATE[tabId]
    : 0;
}

// Is this tab still calibration-locked in the given state? Ungated tab, graduated
// athlete, or undatable anchor → never locked (fail-open).
export function isTabCalibrationLocked(tabId, state = {}) {
  const unlockDay = unlockDayForTab(tabId);
  if (!unlockDay) return false;                       // not calibration-gated
  if (state.isGraduated || !state.hasAnchor) return false; // graduated / undatable → open
  return Number(state.day) < unlockDay;
}
