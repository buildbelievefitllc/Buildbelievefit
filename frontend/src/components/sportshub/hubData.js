// src/components/sportshub/hubData.js
// ─────────────────────────────────────────────────────────────────────────────
// The Sports Hub — sport-aware dashboard model + the pure calculation helpers the
// interactive performance tabs run on.
//
// buildHubModel(profile) now DERIVES every tab from the athlete's chosen sport +
// position/event (profile.sportId / profile.positionCode): combine measurables
// resolve from the real COMBINE_BENCHMARKS table (TRACK_BENCHMARKS for track),
// and drills / film / mass targets come from SPORT_CONTENT so the Size & Mass and
// Positional Ability tabs render content that matches the chosen sport — not a
// fixed lineman set. The CALCULATORS (progressToward / computePowerIndex) stay
// exported pure fns so the editable tabs recompute % against target in real time.

import { COMBINE_BENCHMARKS } from '../sports/sportsData.js';

// 40-yard / shuttle style metrics are faster-is-better; everything else is higher.
export const LOWER_IS_BETTER = new Set(['forty']);

// Film-card status order — one tap advances assigned → in-review → reviewed → …
export const STATUS_CYCLE = ['assigned', 'in-review', 'complete'];
export function nextStatus(current) {
  const i = STATUS_CYCLE.indexOf(current);
  return STATUS_CYCLE[(i + 1) % STATUS_CYCLE.length];
}

// % progress of a current mark toward its target, clamped 0–100. Coerces string
// inputs (from <input>) and fails safe to 0; handles faster-is-better metrics.
export function progressToward(current, target, lowerIsBetter) {
  const c = typeof current === 'number' ? current : parseFloat(current);
  const t = typeof target === 'number' ? target : parseFloat(target);
  if (!Number.isFinite(c) || !Number.isFinite(t) || t === 0) return 0;
  const pct = lowerIsBetter ? (t / c) * 100 : (c / t) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

// Composite 0–100 power index — mean attainment of peak & CMJ power vs target.
export function computePowerIndex(peakPowerW, cmjPowerW, { peakTargetW, cmjTargetW }) {
  const a = progressToward(peakPowerW, peakTargetW, false);
  const b = progressToward(cmjPowerW, cmjTargetW, false);
  return Math.round((a + b) / 2);
}

// ── Combine measurable metadata — label / unit / direction, keyed by the benchmark
//    column names in COMBINE_BENCHMARKS (+ track). Faster-is-better marks are
//    flagged `lower`. ───────────────────────────────────────────────────────────
const METRIC_META = {
  forty: { label: '40-Yard Dash', unit: 's', lower: true },
  sixty: { label: '60-Yard Dash', unit: 's', lower: true },
  vert: { label: 'Vertical Jump', unit: 'in', lower: false },
  broad: { label: 'Broad Jump', unit: 'in', lower: false },
  bench: { label: 'Bench Press', unit: 'reps', lower: false },
  height: { label: 'Standing Height', unit: 'in', lower: false },
  wingspan: { label: 'Wingspan', unit: 'in', lower: false },
  lane: { label: 'Lane Agility', unit: 's', lower: true },
  beep: { label: 'Beep Test', unit: 'lvl', lower: false },
  ttest: { label: 'T-Test', unit: 's', lower: true },
  sprint: { label: '30m Sprint', unit: 's', lower: true },
  velo: { label: 'Throw Velocity', unit: 'mph', lower: false },
  medball: { label: 'Med-Ball Toss', unit: 'ft', lower: false },
  block: { label: 'Block Touch', unit: 'in', lower: false },
  approach: { label: 'Approach Jump', unit: 'in', lower: false },
  pr100: { label: '100m', unit: 's', lower: true },
  pr200: { label: '200m', unit: 's', lower: true },
  fly20: { label: '20m Fly', unit: 's', lower: true },
  longjump: { label: 'Long Jump', unit: 'm', lower: false },
};

// Track events aren't in the legacy COMBINE_BENCHMARKS — supply scholastic
// reference lines per event code (youthSports.TRACK_EVENTS legacy codes).
export const TRACK_BENCHMARKS = {
  sprints: { pr100: 11.0, pr200: 22.6, fly20: 2.05, vert: 30 },
  distance: { pr200: 24.0, beep: 13, sprint: 3.85 },
  jumps: { vert: 34, longjump: 6.8, fly20: 2.10 },
  throws: { medball: 14, bench: 22, vert: 28 },
};

// ── Per-sport dashboard content: mass goal, drills, and film. Combine CURRENT
//    marks auto-derive from the target (a developing 15-year-old, below the line)
//    EXCEPT where `currents` is given (football OL keeps the hand-tuned demo set).
const SPORT_CONTENT = {
  football: {
    combineReference: 'Collegiate OL Benchmark',
    sizeReference: 'Collegiate OL Frame', sizeTarget: 275, weightCurrent: 248,
    currents: { forty: 5.61, vert: 24.5, broad: 88, bench: 14 },
    drillTitle: 'Lineman Drill Progress', drillTag: 'Trench Work · Position-Specific',
    drills: [
      { name: 'Kick-Slide Pass Set', detail: 'Footwork depth & redirect vs edge', progress: 72, reps: '48 / 60 sets' },
      { name: 'Hand Placement & Punch', detail: 'Inside hands, strike on contact', progress: 65, reps: '210 / 320 reps' },
      { name: 'Pad Level & Leverage', detail: 'Hip hinge — win the low man', progress: 80, reps: '36 / 45 sets' },
      { name: 'Drive Block / Sled Surge', detail: 'First-step explosion off the snap', progress: 58, reps: '88 / 150 reps' },
      { name: 'Pull & Trap Mobility', detail: 'Pull flat, square to the target', progress: 44, reps: '40 / 90 reps' },
    ],
    film: [
      { title: 'Hand Fit vs Bull Rush', concept: 'Anchor technique', duration: '12 min' },
      { title: 'Zone Combo Footwork', concept: 'Combo blocks', duration: '9 min' },
      { title: 'Anchor vs Power Rusher', concept: 'Pass protection', duration: '15 min' },
      { title: 'First-Step Get-Off', concept: 'Run blocking', duration: '7 min' },
    ],
  },
  basketball: {
    combineReference: 'Collegiate Wing Benchmark',
    sizeReference: 'Collegiate Wing Frame', sizeTarget: 205, weightCurrent: 189,
    drillTitle: 'Skill Drill Progress', drillTag: 'Skill Work · Position-Specific',
    drills: [
      { name: 'Closeout & Slide', detail: 'Contain the ball, no blow-by', progress: 64, reps: '40 / 60 reps' },
      { name: 'Catch-and-Shoot Form', detail: 'Feet set, high release', progress: 71, reps: '300 / 420 reps' },
      { name: 'Finishing Package', detail: 'Both hands at the rim', progress: 58, reps: '70 / 120 reps' },
      { name: 'Transition Reads', detail: 'Outlet & lane fill', progress: 66, reps: '32 / 50 sets' },
      { name: 'Handle Under Pressure', detail: 'Change of pace, protect', progress: 49, reps: '90 / 180 reps' },
    ],
    film: [
      { title: 'Pick-and-Roll Coverage', concept: 'Drop vs hedge', duration: '11 min' },
      { title: 'Closeout Discipline', concept: 'Contesting threes', duration: '8 min' },
      { title: 'Floor Spacing', concept: 'Off-ball relocation', duration: '10 min' },
      { title: 'Late-Clock Reads', concept: 'Shot creation', duration: '9 min' },
    ],
  },
  soccer: {
    combineReference: 'Collegiate Midfield Benchmark',
    sizeReference: 'Collegiate Midfield Frame', sizeTarget: 165, weightCurrent: 152,
    drillTitle: 'Technical Drill Progress', drillTag: 'Technical Work · Position-Specific',
    drills: [
      { name: 'First Touch & Receiving', detail: 'Open up, scan early', progress: 62, reps: '120 / 200 reps' },
      { name: 'Change of Direction', detail: 'Break the line', progress: 70, reps: '36 / 50 sets' },
      { name: 'Finishing', detail: 'First-time strikes', progress: 55, reps: '80 / 150 reps' },
      { name: 'Pressing Triggers', detail: 'Win it back in 5s', progress: 60, reps: '28 / 45 sets' },
      { name: 'Set-Piece Delivery', detail: 'Repeatable service', progress: 47, reps: '60 / 120 reps' },
    ],
    film: [
      { title: 'Pressing Shape', concept: 'Coordinated press', duration: '10 min' },
      { title: 'Build-Out', concept: 'Playing through lines', duration: '9 min' },
      { title: 'Final-Third Movement', concept: 'Creating space', duration: '11 min' },
      { title: 'Defensive Transition', concept: 'Recovery runs', duration: '7 min' },
    ],
  },
  baseball: {
    combineReference: 'Collegiate Two-Way Benchmark',
    sizeReference: 'Collegiate Two-Way Frame', sizeTarget: 195, weightCurrent: 179,
    drillTitle: 'Skill Drill Progress', drillTag: 'Skill Work · Position-Specific',
    drills: [
      { name: 'Throwing Mechanics', detail: 'Clean arm path', progress: 66, reps: '150 / 220 throws' },
      { name: 'Exit Velocity', detail: 'Barrel the ball', progress: 59, reps: '180 / 300 swings' },
      { name: 'Lateral Range', detail: 'First-step quickness', progress: 72, reps: '40 / 55 sets' },
      { name: 'Base Running', detail: 'Reads & jumps', progress: 63, reps: '30 / 48 sets' },
      { name: 'Swing Path', detail: 'On-plane, repeatable', progress: 51, reps: '200 / 380 swings' },
    ],
    film: [
      { title: 'Pitch Recognition', concept: 'Spin & tunnel', duration: '12 min' },
      { title: 'Defensive Positioning', concept: 'Reads off the bat', duration: '9 min' },
      { title: 'Baserunning Reads', concept: 'Secondary leads', duration: '8 min' },
      { title: 'Approach by Count', concept: 'Two-strike plan', duration: '10 min' },
    ],
  },
  volleyball: {
    combineReference: 'Collegiate Front-Row Benchmark',
    sizeReference: 'Collegiate Front-Row Frame', sizeTarget: 190, weightCurrent: 175,
    drillTitle: 'Skill Drill Progress', drillTag: 'Skill Work · Position-Specific',
    drills: [
      { name: 'Approach Timing', detail: '4-step, high point', progress: 68, reps: '44 / 60 reps' },
      { name: 'Block Footwork', detail: 'Press & seal', progress: 61, reps: '36 / 55 sets' },
      { name: 'Passing Platform', detail: 'Quiet, angled', progress: 73, reps: '160 / 220 reps' },
      { name: 'Serve Consistency', detail: 'Zone & pace', progress: 57, reps: '90 / 150 serves' },
      { name: 'Setting Hands', detail: 'Square to target', progress: 50, reps: '120 / 240 reps' },
    ],
    film: [
      { title: 'Block Reads', concept: 'Hitter tendencies', duration: '10 min' },
      { title: 'Serve-Receive', concept: 'Seam coverage', duration: '8 min' },
      { title: 'Transition Offense', concept: 'Out-of-system', duration: '11 min' },
      { title: 'Defensive Dig Reads', concept: 'Tip coverage', duration: '7 min' },
    ],
  },
  track: {
    combineReference: 'Scholastic Event Benchmark',
    sizeReference: 'Sprint Power-to-Weight', sizeTarget: 165, weightCurrent: 152,
    drillTitle: 'Event Drill Progress', drillTag: 'Event Work · Discipline-Specific',
    drills: [
      { name: 'Block Starts', detail: 'Drive angle off the line', progress: 64, reps: '40 / 60 starts' },
      { name: 'Acceleration Mechanics', detail: 'Shin angles, push the ground', progress: 70, reps: '36 / 50 sets' },
      { name: 'Top-End Posture', detail: 'Tall, relaxed, cyclical', progress: 58, reps: '30 / 48 sets' },
      { name: 'Stride Frequency', detail: 'Turnover drills', progress: 66, reps: '120 / 180 reps' },
      { name: 'Plyometric Bounds', detail: 'Elastic power', progress: 52, reps: '60 / 120 contacts' },
    ],
    film: [
      { title: 'Start Phase', concept: 'Block clearance', duration: '9 min' },
      { title: 'Drive Phase', concept: 'Acceleration posture', duration: '8 min' },
      { title: 'Max Velocity', concept: 'Mechanics breakdown', duration: '10 min' },
      { title: 'Race Model', concept: 'Phase splits', duration: '7 min' },
    ],
  },
  default: {
    combineReference: 'Collegiate Athletic Benchmark',
    sizeReference: 'Collegiate Athletic Frame', sizeTarget: 190, weightCurrent: 175,
    drillTitle: 'Drill Progress', drillTag: 'Athletic Development',
    drills: [
      { name: 'Speed & Agility', detail: 'Multidirectional control', progress: 62, reps: '30 / 50 sets' },
      { name: 'Strength Base', detail: 'Compound lifts', progress: 68, reps: '40 / 60 sets' },
      { name: 'Power Development', detail: 'Triple extension', progress: 55, reps: '28 / 45 sets' },
      { name: 'Conditioning', detail: 'Work capacity', progress: 60, reps: '32 / 50 sets' },
      { name: 'Mobility & Prehab', detail: 'Joint integrity', progress: 70, reps: '24 / 35 sets' },
    ],
    film: [
      { title: 'Sport IQ', concept: 'Reads & decisions', duration: '9 min' },
      { title: 'Technical Model', concept: 'Skill breakdown', duration: '8 min' },
      { title: 'Competition Review', concept: 'Live reps', duration: '10 min' },
      { title: 'Recovery & Readiness', concept: 'Load management', duration: '6 min' },
    ],
  },
};

function roundMark(value, unit) {
  if (!Number.isFinite(value)) return value;
  if (unit === 's') return Math.round(value * 100) / 100;
  if (unit === 'm') return Math.round(value * 10) / 10;
  return Math.round(value);
}

function resolveBenchmark(sportId, positionCode) {
  if (sportId === 'track') return TRACK_BENCHMARKS[positionCode] || TRACK_BENCHMARKS.sprints;
  const sport = COMBINE_BENCHMARKS[sportId];
  if (!sport) return COMBINE_BENCHMARKS.football.OL;
  return sport[positionCode] || sport.OL || Object.values(sport)[0];
}

// Default film status / coach-note pattern (varies cards for a live-looking board).
const FILM_STATUS = ['assigned', 'complete', 'in-review', 'assigned'];
const FILM_NOTES = [2, 3, 1, 0];

export function buildHubModel(profile) {
  const sportId = profile?.sportId || 'football';
  const positionCode = profile?.positionCode || 'OL';
  const content = SPORT_CONTENT[sportId] || SPORT_CONTENT.default;
  const bench = resolveBenchmark(sportId, positionCode);

  const metrics = Object.keys(bench).map((key) => {
    const meta = METRIC_META[key] || { label: key, unit: '', lower: false };
    const target = bench[key];
    const current = content.currents?.[key] ?? roundMark(meta.lower ? target * 1.07 : target * 0.85, meta.unit);
    return { key, label: meta.label, unit: meta.unit, lowerIsBetter: meta.lower, target, current, progress: progressToward(current, target, meta.lower) };
  });

  const power = {
    title: 'Explosive Power Output',
    peakPowerW: 4210, cmjPowerW: 3950, meanVelocity: 0.82, cmjHeightIn: 17.8,
    rfdTrend: '+8%', peakTargetW: 5200, cmjTargetW: 5000,
    series: [
      { label: 'W1', value: 3680 }, { label: 'W2', value: 3840 },
      { label: 'W3', value: 4020 }, { label: 'W4', value: 4210 },
    ],
  };
  power.index = computePowerIndex(power.peakPowerW, power.cmjPowerW, power);

  return {
    combine: { title: 'Combine Metrics', reference: content.combineReference, metrics },
    power,
    size: {
      title: 'Size & Mass', reference: content.sizeReference,
      heightIn: 73, wingspanIn: 78, bodyfatTrend: '−1.4%',
      weightLbs: content.weightCurrent, weightTarget: content.sizeTarget,
    },
    drills: {
      title: content.drillTitle, tag: content.drillTag,
      items: content.drills.map((d) => ({ ...d, done: false })),
    },
    film: {
      title: 'Positional Film Study', tag: 'Film Room · Tap to Update',
      clips: content.film.map((c, i) => ({ ...c, status: FILM_STATUS[i % 4], notes: FILM_NOTES[i % 4] })),
    },
  };
}
