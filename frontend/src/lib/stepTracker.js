// src/lib/stepTracker.js
// ─────────────────────────────────────────────────────────────────────────────
// Live step-tracking app state. A module-level store (behind useSyncExternalStore,
// same pattern as useDailyReadiness.js) that:
//   • drives the native hardware pedometer (PedometerBridge → TYPE_STEP_COUNTER /
//     CMPedometer) and folds its live 'stepUpdate' deltas into shared state, and
//   • composes the day's live total (Health Connect / manual baseline + session
//     delta) and derives daily progress toward the step goal.
//
// Off native (plain browser / PWA) every control is a graceful no-op — `available`
// stays false and the UI hides — so the web build is unaffected (CLAUDE.md §6).
//
// Pure math (progress / composition / goal) lives in stepMath.js so it unit-tests
// without React; this module owns the effectful capture + subscription lifecycle.

import { useSyncExternalStore } from 'react';
import {
  DEFAULT_STEP_GOAL,
  clampGoal,
  composeDailySteps,
  computeStepProgress,
} from './stepMath.js';
import {
  hasPedometerBridge,
  pedometerAvailable,
  requestPedometerPermissions,
  startPedometer,
  stopPedometer,
  addStepListener,
} from '../native/pedometerBridge.js';

export { DEFAULT_STEP_GOAL, computeStepProgress } from './stepMath.js';

// ── Module store ─────────────────────────────────────────────────────────────
function initialState() {
  return {
    available: false, // hardware step sensor present + bridge callable
    active: false, // listener currently registered (capturing)
    sessionSteps: 0, // live delta since start() (hardware counter)
    dayBaseline: 0, // steps already logged today before this capture session
    dailySteps: 0, // composeDailySteps(dayBaseline, sessionSteps)
    goal: DEFAULT_STEP_GOAL,
    error: null,
  };
}

let state = initialState();
const subscribers = new Set();
let unsub = null; // native 'stepUpdate' remover
let starting = false; // single-flight guard for startStepTracking

function emit() { subscribers.forEach((fn) => fn()); }
function subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); }
function getSnapshot() { return state; }

// Replace the snapshot (new object ref only on change) and recompute the live total.
function patch(next) {
  state = { ...state, ...next };
  state.dailySteps = composeDailySteps(state.dayBaseline, state.sessionSteps);
  emit();
}

// Begin (or refresh) live capture. Seeds the day baseline + goal, requests the
// sensor permission, registers the stream, and folds every 'stepUpdate' into state.
// Idempotent: a second call updates baseline/goal without stacking listeners.
export async function startStepTracking({ dayBaseline = 0, goal = DEFAULT_STEP_GOAL } = {}) {
  patch({ dayBaseline: Math.max(0, Number(dayBaseline) || 0), goal: clampGoal(goal), error: null });

  if (!hasPedometerBridge()) {
    patch({ available: false });
    return { started: false, reason: 'no_bridge' };
  }
  if (starting) return { started: false, reason: 'in_flight' };
  starting = true;
  try {
    const avail = await pedometerAvailable();
    patch({ available: !!(avail && avail.available) });
    if (!avail || !avail.available) return { started: false, reason: 'unavailable' };

    const perm = await requestPedometerPermissions();
    if (perm && perm.granted === false) {
      patch({ error: 'permission_denied' });
      return { started: false, reason: 'permission_denied' };
    }

    if (!unsub) {
      unsub = await addStepListener((ev) => {
        const raw = ev && (ev.sessionSteps != null ? ev.sessionSteps : ev.steps);
        const n = Number(raw);
        if (Number.isFinite(n)) patch({ sessionSteps: Math.max(0, n) });
      });
    }
    await startPedometer();
    patch({ active: true });
    return { started: true };
  } catch (e) {
    patch({ active: false, error: String((e && e.message) || e) });
    return { started: false, reason: 'error' };
  } finally {
    starting = false;
  }
}

// Stop capture + tear down the listener. Safe to call anytime (no-op if idle).
export async function stopStepTracking() {
  try {
    if (unsub) { const u = unsub; unsub = null; u(); }
  } catch { /* already removed — non-fatal */ }
  try { await stopPedometer(); } catch { /* off-platform / already stopped */ }
  patch({ active: false });
}

// Update the goal (persist per-athlete overrides upstream if/when desired).
export function setStepGoal(goal) { patch({ goal: clampGoal(goal) }); }

// Re-seed the day baseline (e.g. after a Health Connect sync refreshes daily_steps).
export function setDayBaseline(n) { patch({ dayBaseline: Math.max(0, Number(n) || 0) }); }

// Hook: reactive step-tracker state + derived daily progress. Does NOT auto-start —
// the consumer decides when to begin capture (e.g. the Check-In surface on mount).
export function useStepTracker() {
  const s = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { ...s, progress: computeStepProgress(s.dailySteps, s.goal) };
}
