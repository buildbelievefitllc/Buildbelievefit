// src/lib/stepMath.js
// ─────────────────────────────────────────────────────────────────────────────
// Pure step-progress math — no React, no native imports, so it unit-tests under
// `node --test` and can be shared by the store, the UI card, and any future
// consumer. The live capture + app-state wiring lives in stepTracker.js.

// Default daily step target. Greenfield: the app had no step goal, so this is the
// common 10k default; callers may override per-athlete (see stepTracker.setStepGoal).
export const DEFAULT_STEP_GOAL = 10000;

// Coerce a goal to a positive integer, falling back to the default. Null-safe.
export function clampGoal(goal) {
  const n = Number(goal);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : DEFAULT_STEP_GOAL;
}

// Compose the live daily total from the day's baseline (steps already logged today by
// Health Connect / manual entry, captured when tracking starts) + the live session
// delta from the hardware step counter. Both floored at 0; the next Health Connect
// sync replaces this estimate with the authoritative aggregate (never double-counts
// long-term — the overlap is only the steps taken during the active app session).
export function composeDailySteps(dayBaseline, sessionSteps) {
  const b = Math.max(0, Number(dayBaseline) || 0);
  const s = Math.max(0, Number(sessionSteps) || 0);
  return b + s;
}

// Daily progress toward a step target. Everything null-safe; pct clamped 0–100 for a
// progress bar, while `remaining` reports the true gap and `reached` flips at goal.
export function computeStepProgress(steps, goal = DEFAULT_STEP_GOAL) {
  const s = Math.max(0, Number(steps) || 0);
  const g = clampGoal(goal);
  const pct = Math.max(0, Math.min(100, Math.round((s / g) * 100)));
  return { steps: s, goal: g, pct, remaining: Math.max(0, g - s), reached: s >= g };
}
