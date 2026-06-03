// src/components/sportshub/hubData.js
// ─────────────────────────────────────────────────────────────────────────────
// The Sports Hub — mock dashboard model (scaffold fixture).
//
// Deterministic, NO network. This is the youth-athlete bring-up fixture, NOT a
// live data source: when the youth-telemetry backend lands, swap buildHubModel()
// for a real fetch hook (e.g. a bbf_get_athlete_telemetry RPC) — the section
// components consume this shape unchanged. Combine TARGETS resolve from the
// platform's real collegiate benchmark table (sportsData.COMBINE_BENCHMARKS) so
// the scaffold never invents reference numbers; only the athlete's CURRENT marks
// (a 15-year-old, below the collegiate line) are mocked.

import { COMBINE_BENCHMARKS } from '../sports/sportsData.js';

// 40-yard / shuttle style metrics are faster-is-better; everything else is
// higher-is-better. Mirrors the LOWER_IS_BETTER convention in sportsData.js.
const LOWER_IS_BETTER = new Set(['forty']);

// Resolve the collegiate reference line for a sport+position, defaulting to
// football Offensive Line (the test athlete) when a code isn't mapped.
function benchmarkFor(profile) {
  const sport = COMBINE_BENCHMARKS[profile?.sportId] || COMBINE_BENCHMARKS.football;
  return sport[profile?.positionCode] || sport.OL || Object.values(sport)[0];
}

// % progress of a current mark toward its target, clamped 0–100. Handles the
// faster-is-better metrics (where "below target" means a HIGHER current number).
function progressToward(current, target, lowerIsBetter) {
  if (!Number.isFinite(current) || !Number.isFinite(target) || target === 0) return 0;
  const pct = lowerIsBetter ? (target / current) * 100 : (current / target) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

export function buildHubModel(profile) {
  const bench = benchmarkFor(profile);

  // ── Combine Metrics — current (mocked, age-15) vs collegiate OL target ──────
  const rawCombine = [
    { key: 'forty', label: '40-Yard Dash', current: 5.61, unit: 's' },
    { key: 'vert', label: 'Vertical Jump', current: 24.5, unit: 'in' },
    { key: 'broad', label: 'Broad Jump', current: 88, unit: 'in' },
    { key: 'bench', label: 'Bench Press', current: 14, unit: 'reps' },
  ];
  const combineMetrics = rawCombine.map((m) => {
    const lowerIsBetter = LOWER_IS_BETTER.has(m.key);
    const target = bench[m.key];
    return {
      ...m,
      target,
      lowerIsBetter,
      progress: progressToward(m.current, target, lowerIsBetter),
    };
  });

  return {
    // Size is a load-bearing goal for a lineman — surface it up top.
    size: {
      height: "6'1\"",
      weight: 248,
      weightUnit: 'lbs',
      wingspan: '78"',
      bodyfatTrend: '−1.4%',
    },
    combine: {
      title: 'Combine Metrics',
      reference: 'Collegiate OL Benchmark',
      metrics: combineMetrics,
    },

    // ── Explosive Power Output — VBT / jump telemetry ─────────────────────────
    power: {
      title: 'Explosive Power Output',
      index: 78, // 0–100 composite power index
      peakPowerW: 4210,
      meanVelocity: 0.82, // m/s, trap-bar jump (velocity-based training)
      cmjHeightIn: 17.8, // countermovement jump
      cmjPowerW: 3950,
      rfdTrend: '+8%', // rate of force development, last 4 weeks
      // Peak-power across the last four sessions → rendered as a mini bar trend.
      series: [
        { label: 'W1', value: 3680 },
        { label: 'W2', value: 3840 },
        { label: 'W3', value: 4020 },
        { label: 'W4', value: 4210 },
      ],
    },

    // ── Lineman-Specific Drill Progress ───────────────────────────────────────
    drills: {
      title: 'Lineman Drill Progress',
      items: [
        { name: 'Kick-Slide Pass Set', detail: 'Footwork depth & redirect vs edge', progress: 72, reps: '48 / 60 sets' },
        { name: 'Hand Placement & Punch', detail: 'Inside hands, strike on contact', progress: 65, reps: '210 / 320 reps' },
        { name: 'Pad Level & Leverage', detail: 'Hip hinge — win the low man', progress: 80, reps: '36 / 45 sets' },
        { name: 'Drive Block / Sled Surge', detail: 'First-step explosion off the snap', progress: 58, reps: '88 / 150 reps' },
        { name: 'Pull & Trap Mobility', detail: 'Pull flat, square to the target', progress: 44, reps: '40 / 90 reps' },
      ],
    },

    // ── Positional Film Study ─────────────────────────────────────────────────
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
