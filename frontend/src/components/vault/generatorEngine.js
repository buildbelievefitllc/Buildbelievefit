// src/components/vault/generatorEngine.js
// ─────────────────────────────────────────────────────────────────────────────
// Phase 21.5 — BBF Program Generator engine (React port of window.BBF_PROGRAM_GENERATOR
// from bbf-app.html). Pure, deterministic, no DOM.
//
// IMMUTABLE LAWS (carried verbatim from the monolith):
//   • The exercise library (LIB) is LOCKED and aligned 1:1 with the form-video map.
//   • The BLACKLIST (barbell back squat, abdominal crunches) is forbidden by
//     construction AND enforced by a final guard — under no circumstance programmed.
//   • Every programmed movement must resolve to a hardwired form-demo video
//     (Titanium Rule), or it is excluded.

import { resolveVideoId } from './exerciseVideos.js';

// ─── LOCKED exercise library (1:1 with the video map) ────────────────────────
const LIB = [
  { n: 'Barbell Bench Press', g: 'chest', p: 'push', eq: ['barbell'], lvl: 2 },
  { n: 'Incline Dumbbell Press', g: 'chest', p: 'push', eq: ['dumbbell'], lvl: 2 },
  { n: 'Machine Chest Press', g: 'chest', p: 'push', eq: ['machine'], lvl: 1 },
  { n: 'Push-Up', g: 'chest', p: 'push', eq: ['bodyweight'], lvl: 1 },
  { n: 'Cable Chest Fly', g: 'chest', p: 'push', eq: ['cable'], lvl: 2 },
  { n: 'Lat Pulldown', g: 'back', p: 'pull', eq: ['machine', 'cable'], lvl: 1 },
  { n: 'Seated Cable Row', g: 'back', p: 'pull', eq: ['cable'], lvl: 1 },
  { n: 'One-Arm Dumbbell Row', g: 'back', p: 'pull', eq: ['dumbbell'], lvl: 1 },
  { n: 'Pull-Up', g: 'back', p: 'pull', eq: ['bodyweight'], lvl: 2 },
  { n: 'Barbell Bent-Over Row', g: 'back', p: 'pull', eq: ['barbell'], lvl: 2 },
  { n: 'Dumbbell Shoulder Press', g: 'shoulders', p: 'push', eq: ['dumbbell'], lvl: 1 },
  { n: 'Dumbbell Lateral Raise', g: 'shoulders', p: 'push', eq: ['dumbbell'], lvl: 1 },
  { n: 'Cable Face Pull', g: 'shoulders', p: 'pull', eq: ['cable'], lvl: 1 },
  { n: 'Band Pull-Apart', g: 'shoulders', p: 'pull', eq: ['bands'], lvl: 1 },
  { n: 'Dumbbell Biceps Curl', g: 'biceps', p: 'pull', eq: ['dumbbell'], lvl: 1 },
  { n: 'Cable Biceps Curl', g: 'biceps', p: 'pull', eq: ['cable'], lvl: 1 },
  { n: 'Hammer Curl', g: 'biceps', p: 'pull', eq: ['dumbbell'], lvl: 1 },
  { n: 'Cable Triceps Pushdown', g: 'triceps', p: 'push', eq: ['cable'], lvl: 1 },
  { n: 'Bench Dip', g: 'triceps', p: 'push', eq: ['bodyweight'], lvl: 1 },
  { n: 'Leg Press', g: 'quads', p: 'squat', eq: ['machine'], lvl: 1 },
  { n: 'Goblet Squat', g: 'quads', p: 'squat', eq: ['dumbbell', 'kettlebell'], lvl: 1 },
  { n: 'Bulgarian Split Squat', g: 'quads', p: 'lunge', eq: ['dumbbell', 'bodyweight'], lvl: 2 },
  { n: 'Walking Lunge', g: 'quads', p: 'lunge', eq: ['dumbbell', 'bodyweight'], lvl: 1 },
  { n: 'Leg Extension', g: 'quads', p: 'isolation', eq: ['machine'], lvl: 1 },
  { n: 'Front Squat', g: 'quads', p: 'squat', eq: ['barbell'], lvl: 3 },
  { n: 'Dumbbell Romanian Deadlift', g: 'hamstrings', p: 'hinge', eq: ['dumbbell'], lvl: 2 },
  { n: 'Seated Leg Curl', g: 'hamstrings', p: 'hinge', eq: ['machine'], lvl: 1 },
  { n: 'Barbell Hip Thrust', g: 'glutes', p: 'hinge', eq: ['barbell'], lvl: 2 },
  { n: 'Dumbbell Hip Thrust', g: 'glutes', p: 'hinge', eq: ['dumbbell'], lvl: 1 },
  { n: 'Glute Bridge', g: 'glutes', p: 'hinge', eq: ['bodyweight'], lvl: 1 },
  { n: 'Cable Pull-Through', g: 'glutes', p: 'hinge', eq: ['cable'], lvl: 1 },
  { n: 'Standing Calf Raise', g: 'calves', p: 'isolation', eq: ['machine', 'bodyweight'], lvl: 1 },
  { n: 'Front Plank', g: 'core', p: 'core', eq: ['bodyweight'], lvl: 1 },
  { n: 'Side Plank', g: 'core', p: 'core', eq: ['bodyweight'], lvl: 1 },
  { n: 'Hanging Leg Raise', g: 'core', p: 'core', eq: ['bodyweight'], lvl: 2 },
  { n: 'Cable Woodchop', g: 'core', p: 'core', eq: ['cable'], lvl: 2 },
  { n: 'Dead Bug', g: 'core', p: 'core', eq: ['bodyweight'], lvl: 1 },
];

const LOC_EQ = {
  commercial: ['machine', 'dumbbell', 'barbell', 'cable', 'bodyweight', 'bands', 'kettlebell', 'smith'],
  planet: ['machine', 'dumbbell', 'cable', 'bodyweight', 'smith'],
  'home-min': ['dumbbell', 'bodyweight', 'bands'],
  'home-bar': ['barbell', 'dumbbell', 'bodyweight', 'bands', 'kettlebell'],
  travel: ['bodyweight', 'bands', 'dumbbell'],
};

// Day-template tables per Splits Architecture: [label, muscle-groups]. buildSplit()
// cycles these to fill the requested weekly frequency (replaces the old focus map).
const ARCH_TEMPLATES = {
  full: [
    ['Full Body', ['chest', 'back', 'quads', 'shoulders', 'core']],
    ['Full Body', ['hamstrings', 'glutes', 'back', 'shoulders', 'core']],
    ['Full Body', ['chest', 'quads', 'biceps', 'triceps', 'core']],
  ],
  'upper-lower': [
    ['Upper', ['chest', 'back', 'shoulders', 'biceps', 'triceps']],
    ['Lower', ['quads', 'hamstrings', 'glutes', 'calves', 'core']],
  ],
  ppl: [
    ['Push', ['chest', 'shoulders', 'triceps']],
    ['Pull', ['back', 'biceps', 'shoulders']],
    ['Legs', ['quads', 'hamstrings', 'glutes', 'calves']],
  ],
  bro: [
    ['Chest', ['chest', 'triceps']],
    ['Back', ['back', 'biceps']],
    ['Shoulders', ['shoulders', 'core']],
    ['Legs', ['quads', 'hamstrings', 'glutes', 'calves']],
    ['Arms', ['biceps', 'triceps', 'shoulders']],
  ],
  arnold: [
    ['Chest & Back', ['chest', 'back']],
    ['Shoulders & Arms', ['shoulders', 'biceps', 'triceps']],
    ['Legs', ['quads', 'hamstrings', 'glutes', 'calves']],
  ],
};

// Athletic Gender Focus → selection-priority. Earlier groups win the spare day slots,
// nudging emphasis; it NEVER forces a contraindicated lift (the guard still applies).
const GENDER_PRIORITY = {
  female: ['glutes', 'hamstrings', 'quads', 'back', 'shoulders', 'core'],
  male: ['chest', 'back', 'shoulders', 'quads', 'triceps', 'biceps'],
  unisex: [],
};

// Warm-up / cool-down protocol pools — mobility, activation, decompression. These are
// PROTOCOL steps, not catalog lifts, so the Titanium video rule (which governs
// programmed lifts) doesn't apply; all BBF-safe (no spinal-loaded contraindications).
const LOWER_GROUPS = ['quads', 'hamstrings', 'glutes', 'calves'];
const UPPER_GROUPS = ['chest', 'back', 'shoulders', 'biceps', 'triceps'];
const WARMUP_POOL = {
  general: ['5 min incline walk / row — raise core temp', 'World’s Greatest Stretch ×5/side', 'Cat-Cow ×8 (spinal flow)'],
  upper: ['Band Pull-Apart ×15', 'Scapular Push-Up ×12', 'Wall slides ×10'],
  lower: ['Leg swings ×10/side', 'Bodyweight Glute Bridge ×15', 'Ankle rocks ×10/side'],
};
const COOLDOWN_POOL = {
  general: ['Box breathing 4×4 · 6 rounds (CNS downshift)', 'Child’s Pose ×45s'],
  upper: ['Doorway chest stretch ×30s/side', 'Overhead lat / triceps stretch ×30s/side'],
  lower: ['Standing hip-flexor stretch ×30s/side', 'Seated hamstring stretch ×30s/side'],
};

// LOCKED blacklist — never program these, under any circumstance.
const BLACKLIST = ['back squat', 'barbell back squat', 'crunch', 'abdominal crunch', 'crunches'];
export function isBlacklisted(name) {
  const n = String(name || '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
  return BLACKLIST.some((b) => n.indexOf(b) !== -1);
}

// Selectable parameters (label/value pairs for the UI). The 8 signature selectors of
// the Vault Roster Engine map onto these.
export const GOALS = [
  { v: 'hypertrophy', l: 'Hypertrophy' }, { v: 'strength', l: 'Strength' },
  { v: 'power', l: 'Power' }, { v: 'fatloss', l: 'Fat Loss' }, { v: 'general', l: 'General Fitness' },
];
// Athletic Gender Focus — emphasis nudge (see GENDER_PRIORITY), never a hard gate.
export const GENDERS = [
  { v: 'unisex', l: 'Unisex · Balanced' }, { v: 'female', l: 'Female Athlete' }, { v: 'male', l: 'Male Athlete' },
];
export const LEVELS = [{ v: '1', l: 'Beginner' }, { v: '2', l: 'Intermediate' }, { v: '3', l: 'Advanced' }];
export const LOCATIONS = [
  { v: 'commercial', l: 'Commercial Gym' }, { v: 'planet', l: 'Planet-style' },
  { v: 'home-min', l: 'Home · Minimal' }, { v: 'home-bar', l: 'Home · Barbell' }, { v: 'travel', l: 'Travel' },
];
export const DAY_OPTIONS = ['2', '3', '4', '5', '6'];
// Workout Pace Target — session length, which drives training density (lifts/day).
export const PACES = [
  { v: '30', l: 'Express · ~30 min' }, { v: '45', l: 'Brisk · ~45 min' }, { v: '60', l: 'Standard · ~60 min' },
  { v: '75', l: 'Extended · ~75 min' }, { v: '90', l: 'Marathon · ~90 min' },
];
export const DURATIONS = PACES; // back-compat alias (legacy callers used DURATIONS)
// Splits Architecture — the day-by-day template the split is built from.
export const SPLITS = [
  { v: 'full', l: 'Full Body' }, { v: 'upper-lower', l: 'Upper / Lower' }, { v: 'ppl', l: 'Push / Pull / Legs' },
  { v: 'bro', l: 'Body-Part (Bro) Split' }, { v: 'arnold', l: 'Arnold Antagonist' },
];
// Intensifier Technique — a protocol overlay on every working day. FST-7 also appends
// a real 7-set fascia finisher to each day (structural, not just a label).
export const INTENSIFIERS = [
  { v: 'straight', l: 'Straight Sets' }, { v: 'superset', l: 'Antagonist Supersets' }, { v: 'dropset', l: 'Drop Sets' },
  { v: 'restpause', l: 'Rest-Pause' }, { v: 'cluster', l: 'Cluster Sets' }, { v: 'fst7', l: 'FST-7 Fascia Finisher' },
];
const INTENSIFIER_META = {
  straight: { label: null, cue: null },
  superset: { label: 'Antagonist Supersets', cue: 'Pair the opposing movements back-to-back; rest only after the pair.' },
  dropset: { label: 'Drop Sets', cue: 'On the final set of each lift, strip ~20% and rep to failure ×2 drops.' },
  restpause: { label: 'Rest-Pause', cue: 'Final set: rep to failure, rest 15s, go again ×2 mini-sets.' },
  cluster: { label: 'Cluster Sets', cue: 'Break heavy sets into 2-rep clusters with 15s intra-set rest.' },
  fst7: { label: 'FST-7', cue: 'Finish each day with 7 sets of the isolation movement · 30s rest (fascia stretch).' },
};

// Signature split presets — the 3 hard-wired buttons. Each loads a full parameter
// envelope plus the warm-up/cool-down flag in one tap.
export const PRESETS = [
  { id: 'arnold', label: 'Arnold Era Classic', blurb: 'High-volume antagonist supersets · 6-day golden-era hypertrophy', warmups: true,
    params: { goal: 'hypertrophy', gender: 'male', level: '3', loc: 'commercial', days: '6', dur: '90', arch: 'arnold', intensifier: 'superset' } },
  { id: 'fst7', label: 'FST-7 Fascia Expand', blurb: 'Body-part split with 7-set fascia finishers · pump & expansion', warmups: true,
    params: { goal: 'hypertrophy', gender: 'unisex', level: '3', loc: 'commercial', days: '5', dur: '75', arch: 'bro', intensifier: 'fst7' } },
  { id: 'nasm', label: 'Elite NASM Clinical', blurb: 'OPT-model full body · controlled tempo · prep + recovery built in', warmups: true,
    params: { goal: 'general', gender: 'unisex', level: '2', loc: 'commercial', days: '4', dur: '60', arch: 'full', intensifier: 'straight' } },
];

function prescribe(goal) {
  switch (goal) {
    case 'strength': return { sets: '4-5', reps: '3-6', rest: '2-3 min' };
    case 'power': return { sets: '4-5', reps: '2-5', rest: '2-3 min' };
    case 'fatloss': return { sets: '3', reps: '12-20', rest: '30-45s' };
    case 'general': return { sets: '3', reps: '8-12', rest: '60-90s' };
    default: return { sets: '3-4', reps: '8-12', rest: '60-90s' };
  }
}
function countFor(dur) { const d = parseInt(dur, 10) || 60; return d <= 30 ? 4 : d <= 45 ? 5 : d <= 60 ? 6 : d <= 75 ? 7 : 8; }
function rng(seed) { let s = (seed || 1) % 2147483647; if (s <= 0) s += 2147483646; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
function shuffle(arr, rnd) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// Build the day-by-day split for a Splits Architecture, cycling its template to fill
// the requested weekly frequency. Each day is [label, muscle-groups].
function buildSplit(arch, days) {
  const tpl = ARCH_TEMPLATES[arch] || ARCH_TEMPLATES.full;
  const out = [];
  for (let i = 0; i < days; i++) {
    const base = tpl[i % tpl.length];
    out.push([base[0], base[1].slice()]);
  }
  return out;
}
function regionsFor(groups) {
  return {
    lower: groups.some((g) => LOWER_GROUPS.indexOf(g) !== -1),
    upper: groups.some((g) => UPPER_GROUPS.indexOf(g) !== -1),
  };
}
function buildWarmup(groups) {
  const r = regionsFor(groups);
  const out = [WARMUP_POOL.general[0]];
  if (r.upper) out.push(WARMUP_POOL.upper[0], WARMUP_POOL.upper[1]);
  if (r.lower) out.push(WARMUP_POOL.lower[0], WARMUP_POOL.lower[1]);
  out.push(WARMUP_POOL.general[1]);
  return out.slice(0, 5);
}
function buildCooldown(groups) {
  const r = regionsFor(groups);
  const out = [];
  if (r.upper) out.push(COOLDOWN_POOL.upper[0]);
  if (r.lower) out.push(COOLDOWN_POOL.lower[0]);
  out.push(COOLDOWN_POOL.general[0]);
  return out.slice(0, 4);
}
// FST-7 fascia finisher — the isolation movement for a day's primary group.
function fst7Finisher(pool, primary, used) {
  const isoRe = /fly|curl|extension|raise|pushdown|pull-through|lateral/i;
  return pool.find((x) => x.g === primary && isoRe.test(x.n) && !used[x.n])
    || pool.find((x) => x.g === primary && !used[x.n])
    || null;
}

function eligible(locEq, level) {
  const out = [];
  for (const x of LIB) {
    if (isBlacklisted(x.n)) continue;
    if (!resolveVideoId(x.n)) continue;           // Titanium Rule: no hardwired video → never programmed
    if (x.lvl > level) continue;
    if (x.eq.some((e) => locEq.indexOf(e) !== -1)) out.push(x);
  }
  return out;
}

// Deterministic generation. `regen` reshuffles. Returns
//   { days, goal, gender, arch, intensifier, level, warmups,
//     program:[{ label, exercises:[{n,g,p,fst7?,rx?}], rx:{sets,reps,rest,technique?,techniqueCue?},
//               warmup?:[…], cooldown?:[…] }] }.
export function generateProgram(params = {}) {
  const goal = params.goal || 'hypertrophy';
  const level = parseInt(params.level, 10) || 2;
  const days = parseInt(params.days, 10) || 4;
  const locEq = LOC_EQ[params.loc] || LOC_EQ.commercial;
  const arch = params.arch || 'full';
  const gender = params.gender || 'unisex';
  const intensifier = params.intensifier || 'straight';
  const withWarmups = !!params.warmups;
  const perDay = countFor(params.dur);
  const rx = prescribe(goal);
  const tech = INTENSIFIER_META[intensifier] || INTENSIFIER_META.straight;
  if (tech.label) { rx.technique = tech.label; rx.techniqueCue = tech.cue; }
  const pool = eligible(locEq, level);
  const split = buildSplit(arch, days);
  const genderPriority = GENDER_PRIORITY[gender] || [];
  const seed = (params.regen || 0) * 7919 + days * 131 + level * 17
    + (String(goal).charCodeAt(0) || 65) + (String(arch).charCodeAt(0) || 70)
    + (String(intensifier).charCodeAt(0) || 83) + (String(gender).charCodeAt(0) || 85);
  const rnd = rng(seed);
  const program = [];

  for (let d = 0; d < split.length; d++) {
    const [label, groups] = split[d];
    let cand = shuffle(pool.filter((x) => groups.indexOf(x.g) !== -1), rnd);
    // Gender emphasis: stable-sort so prioritized regions claim the spare slots first.
    if (genderPriority.length) {
      cand = cand
        .map((x, i) => [x, i])
        .sort((a, b) => {
          const pa = genderPriority.indexOf(a[0].g); const pb = genderPriority.indexOf(b[0].g);
          return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb) || a[1] - b[1];
        })
        .map((pair) => pair[0]);
    }
    const picks = [];
    const names = {};
    for (let g = 0; g < groups.length && picks.length < perDay; g++) {
      const hit = cand.find((c) => c.g === groups[g] && !names[c.n]);
      if (hit) { picks.push(hit); names[hit.n] = 1; }
    }
    for (let k = 0; k < cand.length && picks.length < perDay; k++) {
      if (!names[cand[k].n]) { picks.push(cand[k]); names[cand[k].n] = 1; }
    }
    // Final guard — defense in depth even though pool was pre-filtered.
    let safe = picks.filter((x) => !isBlacklisted(x.n) && resolveVideoId(x.n));
    // FST-7: append a real 7-set fascia finisher (its own rep scheme) to each day.
    if (intensifier === 'fst7') {
      const fin = fst7Finisher(pool, groups[0], names);
      if (fin && !isBlacklisted(fin.n) && resolveVideoId(fin.n)) {
        safe = safe.concat([{ ...fin, fst7: true, rx: { sets: '7', reps: '8-12', rest: '30s' } }]);
      }
    }
    const day = { label, exercises: safe, rx };
    if (withWarmups) { day.warmup = buildWarmup(groups); day.cooldown = buildCooldown(groups); }
    program.push(day);
  }

  return { days, goal, gender, arch, intensifier, level, warmups: withWarmups, program };
}
