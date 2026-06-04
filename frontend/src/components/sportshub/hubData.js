// src/components/sportshub/hubData.js
// ─────────────────────────────────────────────────────────────────────────────
// The Sports Hub — dashboard model + the pure calculation helpers the interactive
// performance tabs run on.
//
// buildHubModel() seeds the youth-athlete bring-up fixture (deterministic, NO
// network — swap for a real fetch hook when the youth-telemetry backend lands).
// The CALCULATORS (progressToward / computePowerIndex) are exported pure functions
// so the live, editable tabs recompute percentages against target thresholds in
// real time instead of painting hardcoded widths. Combine + size TARGETS resolve
// from the platform's real collegiate benchmark table (COMBINE_BENCHMARKS); only
// the athlete's CURRENT marks (a 15-year-old, below the line) are mocked.

import { COMBINE_BENCHMARKS } from '../sports/sportsData.js';

// 40-yard / shuttle style metrics are faster-is-better; everything else is
// higher-is-better. Mirrors the LOWER_IS_BETTER convention in sportsData.js.
export const LOWER_IS_BETTER = new Set(['forty']);

// Film-card status order — one tap advances assigned → in-review → reviewed → …
export const STATUS_CYCLE = ['assigned', 'in-review', 'complete'];

// Advance a status one step around STATUS_CYCLE (wraps).
export function nextStatus(current) {
  const i = STATUS_CYCLE.indexOf(current);
  return STATUS_CYCLE[(i + 1) % STATUS_CYCLE.length];
}

// Resolve the collegiate reference line for a sport+position, defaulting to
// football Offensive Line (the test athlete) when a code isn't mapped.
function benchmarkFor(profile) {
  const sport = COMBINE_BENCHMARKS[profile?.sportId] || COMBINE_BENCHMARKS.football;
  return sport[profile?.positionCode] || sport.OL || Object.values(sport)[0];
}

// % progress of a current mark toward its target, clamped 0–100. Handles the
// faster-is-better metrics (where "below target" means a HIGHER current number).
// Accepts strings (from <input>) — coerces and fails safe to 0 on a blank/NaN.
export function progressToward(current, target, lowerIsBetter) {
  const c = typeof current === 'number' ? current : parseFloat(current);
  const t = typeof target === 'number' ? target : parseFloat(target);
  if (!Number.isFinite(c) || !Number.isFinite(t) || t === 0) return 0;
  const pct = lowerIsBetter ? (t / c) * 100 : (c / t) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

// Composite 0–100 power index — the mean of peak-power and CMJ-power attainment
// against their targets. Pure + exported so the Explosive Power tab recomputes it
// live as the athlete's force-plate numbers are edited.
export function computePowerIndex(peakPowerW, cmjPowerW, { peakTargetW, cmjTargetW }) {
  const a = progressToward(peakPowerW, peakTargetW, false);
  const b = progressToward(cmjPowerW, cmjTargetW, false);
  return Math.round((a + b) / 2);
}

export function buildHubModel(profile) {
  const bench = benchmarkFor(profile);

  // ── Combine Metrics — current (mocked, age-15) vs collegiate OL target ──────
  const combineMetrics = [
    { key: 'forty', label: '40-Yard Dash', current: 5.61, unit: 's' },
    { key: 'vert', label: 'Vertical Jump', current: 24.5, unit: 'in' },
    { key: 'broad', label: 'Broad Jump', current: 88, unit: 'in' },
    { key: 'bench', label: 'Bench Press', current: 14, unit: 'reps' },
  ].map((m) => {
    const lowerIsBetter = LOWER_IS_BETTER.has(m.key);
    const target = bench[m.key];
    return { ...m, target, lowerIsBetter, progress: progressToward(m.current, target, lowerIsBetter) };
  });

  const power = {
    title: 'Explosive Power Output',
    peakPowerW: 4210,
    cmjPowerW: 3950,
    meanVelocity: 0.82, // m/s, trap-bar jump (velocity-based training)
    cmjHeightIn: 17.8,
    rfdTrend: '+8%', // rate of force development, last 4 weeks
    peakTargetW: 5200,
    cmjTargetW: 5000,
    // Peak-power across the last four sessions → rendered as a mini bar trend.
    series: [
      { label: 'W1', value: 3680 },
      { label: 'W2', value: 3840 },
      { label: 'W3', value: 4020 },
      { label: 'W4', value: 4210 },
    ],
  };
  power.index = computePowerIndex(power.peakPowerW, power.cmjPowerW, power);

  return {
    combine: { title: 'Combine Metrics', reference: 'Collegiate OL Benchmark', metrics: combineMetrics },
    power,

    // ── Size & Mass — anthropometrics; weight tracks toward a lineman frame ────
    size: {
      title: 'Size & Mass',
      reference: 'Collegiate OL Frame',
      heightIn: 73,
      wingspanIn: 78,
      bodyfatTrend: '−1.4%',
      weightLbs: 248,
      weightTarget: 275,
    },

    // ── Lineman-Specific Drill Progress (toggleable: mark complete) ────────────
    drills: {
      title: 'Lineman Drill Progress',
      items: [
        { name: 'Kick-Slide Pass Set', detail: 'Footwork depth & redirect vs edge', progress: 72, reps: '48 / 60 sets', done: false },
        { name: 'Hand Placement & Punch', detail: 'Inside hands, strike on contact', progress: 65, reps: '210 / 320 reps', done: false },
        { name: 'Pad Level & Leverage', detail: 'Hip hinge — win the low man', progress: 80, reps: '36 / 45 sets', done: false },
        { name: 'Drive Block / Sled Surge', detail: 'First-step explosion off the snap', progress: 58, reps: '88 / 150 reps', done: false },
        { name: 'Pull & Trap Mobility', detail: 'Pull flat, square to the target', progress: 44, reps: '40 / 90 reps', done: false },
      ],
    },

    // ── Positional Film Study (cycle status: assigned → in-review → complete) ──
    film: {
      title: 'Positional Film Study',
      clips: [
        { title: 'Hand Fit vs Bull Rush', concept: 'Anchor technique', duration: '12 min', status: 'assigned', notes: 2 },
        { title: 'Zone Combo Footwork', concept: 'Combo blocks', duration: '9 min', status: 'complete', notes: 3 },
        { title: 'Anchor vs Power Rusher', concept: 'Pass protection', duration: '15 min', status: 'in-review', notes: 1 },
        { title: 'First-Step Get-Off', concept: 'Run blocking', duration: '7 min', status: 'assigned', notes: 0 },
      ],
    },
  };
}
