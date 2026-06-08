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

// Destination Equip Priority → equipment actually available there. The engine only
// ever programs video-backed, BBF-safe lifts that fit the destination's kit.
// "Any / Home" is the broad default (use whatever's on hand); Planet Fitness is the
// one meaningfully constrained floor (machines/smith/dumbbells — no free barbell).
const FULL_GYM = ['machine', 'dumbbell', 'barbell', 'cable', 'bodyweight', 'bands', 'kettlebell', 'smith'];
const LOC_EQ = {
  'any-home': FULL_GYM,
  eos: FULL_GYM,
  planet: ['machine', 'dumbbell', 'cable', 'bodyweight', 'smith'],
  mountainside: FULL_GYM,
  la: FULL_GYM,
  // legacy equipment-profile keys, retained for back-compat (harmless if unused).
  commercial: FULL_GYM,
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
  any: [],
  unisex: [], // legacy alias
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

// The 8 SIGNATURE SELECTORS of the Vault Roster Engine (label/value pairs). Option
// sets are 1:1 with the definitive UI blueprint; values map onto the locked engine.

// 1 · Training Priority → drives the set/rep/rest prescription (see prescribe()).
export const GOALS = [
  { v: 'hypertrophy', l: 'Hypertrophy' }, { v: 'strength', l: 'Strength' },
  { v: 'endurance', l: 'Endurance' }, { v: 'general', l: 'General Fitness' },
];
// 2 · Athletic Gender Focus — emphasis nudge (see GENDER_PRIORITY), never a hard gate.
export const GENDERS = [
  { v: 'male', l: 'Male' }, { v: 'female', l: 'Female' }, { v: 'any', l: 'Any' },
];
// 3 · Experience Level — caps the library by movement difficulty.
export const LEVELS = [{ v: '1', l: 'Beginner' }, { v: '2', l: 'Intermediate' }, { v: '3', l: 'Advanced' }];
// 4 · Destination Equip Priority — where you train / what kit is on hand (see LOC_EQ).
export const LOCATIONS = [
  { v: 'any-home', l: 'Any / Home' }, { v: 'eos', l: 'EOS Fitness' }, { v: 'planet', l: 'Planet Fitness' },
  { v: 'mountainside', l: 'Mountainside Fitness' }, { v: 'la', l: 'LA Fitness' },
];
// 5 · Weekly Frequency — training days per week.
export const DAY_OPTIONS = ['2', '3', '4', '5', '6'];
// 6 · Workout Pace Target — session length, which drives training density (lifts/day).
export const PACES = [
  { v: '35', l: '35 Minutes / Session' }, { v: '45', l: '45 Minutes / Session' },
  { v: '60', l: '60 Minutes / Session' }, { v: '90', l: '90 Minutes / Session' },
  { v: '120', l: '120 Minutes / Session' },
];
export const DURATIONS = PACES; // back-compat alias (legacy callers used DURATIONS)
// 7 · Splits Architecture — the day-by-day template the split is built from.
export const SPLITS = [
  { v: 'full', l: 'Dynamic Focus Allocation' }, { v: 'upper-lower', l: 'Upper / Lower Split' },
  { v: 'ppl', l: 'Push / Pull / Legs' }, { v: 'bro', l: 'Body-Part (Bro) Split' },
  { v: 'arnold', l: 'Arnold Split (Chest/Back, Arms)' },
];
// 8 · Intensifier Technique — a protocol overlay on every working day. (FST-7 is not a
// standard technique here — it is Chamber II, a signature preset; see PRESETS / fst7.)
export const INTENSIFIERS = [
  { v: 'none', l: 'None (Standard Muscle Overload)' }, { v: 'dropset', l: 'Drop-sets (Ultimate Pump focus)' },
  { v: 'myoreps', l: 'Myo-reps (Efficiency Autoregulation)' }, { v: 'superset', l: 'Supersets (Fast Cardiorespiratory Pace)' },
  { v: 'negatives', l: 'Negatives / Eccentric overload' },
];
const INTENSIFIER_META = {
  none: { label: null, cue: null },
  dropset: { label: 'Drop Sets', cue: 'On the final set of each lift, strip ~20% and rep to failure ×2 drops.' },
  myoreps: { label: 'Myo-Reps', cue: 'Activation set to near-failure, then rest 15s and fire 3–5 mini-sets of 3–5 reps.' },
  superset: { label: 'Supersets', cue: 'Pair the opposing movements back-to-back; rest only after the pair to hold the pace.' },
  negatives: { label: 'Negatives', cue: 'Ride a 4–5s eccentric on every rep; on the last set, control an overloaded lower.' },
  // FST-7 powers the Chamber II signature preset — appends a real 7-set fascia finisher.
  fst7: { label: 'FST-7', cue: 'Finish each day with 7 sets of the isolation movement · 30s rest (fascia stretch).' },
};

// Signature Chamber Splits — the 3 hard-wired buttons (Akeem's Overwatch Override).
// Each loads a full parameter envelope plus the warm-up/cool-down flag in one tap.
export const PRESETS = [
  { id: 'arnold', chamber: 'Chamber I', label: 'Arnold Era Classic',
    blurb: 'Chest/Back, Shoulders/Arms, Legs split load.', warmups: true,
    params: { goal: 'hypertrophy', gender: 'male', level: '3', loc: 'eos', days: '6', dur: '90', arch: 'arnold', intensifier: 'superset' } },
  { id: 'fst7', chamber: 'Chamber II', label: 'FST-7 Fascia Expand',
    blurb: 'High volume overload finish with 7 sets rest-triggers.', warmups: true,
    params: { goal: 'hypertrophy', gender: 'any', level: '3', loc: 'eos', days: '5', dur: '90', arch: 'bro', intensifier: 'fst7' } },
  { id: 'nasm', chamber: 'Chamber III', label: 'Elite NASM Clinical',
    blurb: 'Force vectors acceleration, joint prehab, kinetic speeds.', warmups: true,
    params: { goal: 'general', gender: 'any', level: '2', loc: 'any-home', days: '4', dur: '60', arch: 'full', intensifier: 'none' } },
];

// ─── Lever B · level-aware profiling helpers ─────────────────────────────────
// Pure classifiers over the LOCKED library — they only READ LIB entries, never
// mutate them. "Isolation" mirrors the heuristic fst7Finisher already uses, widened
// to the explicit isolation/core patterns; everything else is a compound/primary lift.
const ISO_RE = /fly|curl|extension|raise|pushdown|pull-through|lateral|face pull|pull-apart/i;
function isIsolation(ex) {
  return ex.p === 'isolation' || ex.p === 'core' || ISO_RE.test(ex.n);
}
const FREE_WEIGHT = ['barbell', 'dumbbell', 'kettlebell'];
const isFreeWeight = (ex) => Array.isArray(ex.eq) && ex.eq.some((e) => FREE_WEIGHT.indexOf(e) !== -1);
const STABLE_EQ = ['machine', 'cable', 'bodyweight', 'smith', 'bands'];
const isStable = (ex) => Array.isArray(ex.eq) && ex.eq.some((e) => STABLE_EQ.indexOf(e) !== -1);

// B2 ordering key (lower = nearer the front of the session). Advanced floats
// free-weight compounds first, heaviest lvl first; Beginner floats stable
// machine/bodyweight patterns first; Intermediate (rank 0 for all) is left to the
// seeded shuffle + gender emphasis.
function levelRank(ex, level) {
  if (level === 3) return (!isIsolation(ex) && isFreeWeight(ex) ? 0 : 10) + (3 - (ex.lvl || 1));
  if (level === 1) return isStable(ex) ? 0 : 1;
  return 0;
}

// B1 (Advanced) isolation/accessory scheme. The day rx carries the heavy primary
// scheme; isolation work is re-prescribed per-exercise (in the day-fill loop) to this.
const ADV_ISO_RX = { sets: '3-5', reps: '8-12', rest: '60-90s' };

// Set / rep / rest prescription. INTERMEDIATE (level 2) stays goal-driven — the
// historical baseline. BEGINNER (1) and ADVANCED (3) are LEVEL-driven physiological
// profiles that OVERRIDE the goal scheme (Lever B): a beginner standardizes on a
// skill-acquisition hypertrophy scheme; an advanced lifter gets the heavy primary
// scheme here, with isolation re-prescribed (ADV_ISO_RX) per exercise downstream.
function prescribe(goal, level) {
  if (level === 1) return { sets: '2-3', reps: '12-15', rest: '90s' };
  if (level === 3) return { sets: '3-5', reps: '5-8', rest: '120s' };
  switch (goal) {
    case 'strength': return { sets: '4-5', reps: '3-6', rest: '2-3 min' };
    case 'endurance': return { sets: '2-3', reps: '15-25', rest: '30-45s' };
    case 'power': return { sets: '4-5', reps: '2-5', rest: '2-3 min' };
    case 'fatloss': return { sets: '3', reps: '12-20', rest: '30-45s' };
    case 'general': return { sets: '3', reps: '8-12', rest: '60-90s' };
    default: return { sets: '3-4', reps: '8-12', rest: '60-90s' };
  }
}
function countFor(dur) { const d = parseInt(dur, 10) || 60; return d <= 40 ? 4 : d <= 50 ? 5 : d <= 65 ? 6 : d <= 95 ? 7 : 8; }
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
  const rx = prescribe(goal, level);
  // B3 — Beginner intensifier gate: a Level-1 lifter is NEVER auto-assigned a technique
  // overlay (negatives / drop-sets / myo-reps / supersets / FST-7), regardless of the
  // UI dropdown. (Also hardens the fallback: 'none' is a real META key; 'straight' was
  // not, so the prior `|| INTENSIFIER_META.straight` resolved to undefined.)
  const effIntensifier = level === 1 ? 'none' : intensifier;
  const tech = INTENSIFIER_META[effIntensifier] || INTENSIFIER_META.none;
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
    // B2 — level-aware ordering. Stable-sort (the carried index keeps the gender
    // emphasis + seeded shuffle as the tiebreak) so the level profile claims the front
    // of the session: Advanced leads with free-weight compounds (heaviest first),
    // Beginner with stable machine/bodyweight patterns. Intermediate is unaffected.
    if (level === 1 || level === 3) {
      cand = cand
        .map((x, i) => [x, i])
        .sort((a, b) => levelRank(a[0], level) - levelRank(b[0], level) || a[1] - b[1])
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
    // B1 (Advanced) — the day rx carries the heavy primary scheme; isolation/accessory
    // work gets its own moderate-rep, shorter-rest scheme. NEW objects only: LIB entries
    // are shared references and must never be mutated (immutable-laws guard).
    if (level === 3) {
      safe = safe.map((x) => (isIsolation(x) ? { ...x, rx: ADV_ISO_RX } : x));
    }
    // FST-7: append a real 7-set fascia finisher (its own rep scheme) to each day.
    if (effIntensifier === 'fst7') {
      const fin = fst7Finisher(pool, groups[0], names);
      if (fin && !isBlacklisted(fin.n) && resolveVideoId(fin.n)) {
        safe = safe.concat([{ ...fin, fst7: true, rx: { sets: '7', reps: '8-12', rest: '30s' } }]);
      }
    }
    const day = { label, exercises: safe, rx };
    if (withWarmups) { day.warmup = buildWarmup(groups); day.cooldown = buildCooldown(groups); }
    program.push(day);
  }

  return { days, goal, gender, arch, intensifier: effIntensifier, level, warmups: withWarmups, program };
}

// ─── Push bridge: generated program → assignable workout_plan ─────────────────
// Transforms a generateProgram() result into the canonical workout_plan shape the
// Client Vault renders (vaultApi.parseWorkoutPlan → ProgramGrid):
//   [{ day:'Day N', focus, focus_cue?, exercises:[{ name, equipment, sets:<int>,
//      reps, notes }] }]  (rest days → { isRest:true, restNote }).
// Two faithful conversions: ProgramGrid counts set rows via Number(ex.sets), so the
// engine's set RANGES ("3-4") resolve to the upper-bound integer here; and the
// warm-up / cool-down protocol blocks are dropped — the grid logs working sets, not
// mobility steps. This is what the Command Center "Push to Athlete" persists.
const capWord = (s) => { const t = String(s || ''); return t ? t[0].toUpperCase() + t.slice(1) : t; };
const upperSetCount = (s) => { const m = String(s ?? '').match(/\d+/g); return m ? Number(m[m.length - 1]) : 3; };

export function toAssignedPlan(result) {
  const program = Array.isArray(result?.program) ? result.program : [];
  return program.map((d, i) => {
    const dayRx = d.rx || {};
    const exercises = (Array.isArray(d.exercises) ? d.exercises : []).map((ex) => {
      const rx = ex.rx || dayRx;
      const notes = [
        ex.g ? capWord(ex.g) : null,
        ex.fst7 ? 'FST-7 fascia finisher' : null,
        rx.rest ? `rest ${rx.rest}` : null,
      ].filter(Boolean).join(' · ');
      return {
        name: ex.n,
        equipment: capWord(Array.isArray(ex.eq) ? ex.eq[0] : ex.eq) || '—',
        sets: upperSetCount(rx.sets),
        reps: String(rx.reps ?? ''),
        notes,
      };
    });
    if (!exercises.length) {
      return { day: `Day ${i + 1}`, focus: d.label || 'Rest', isRest: true, restNote: 'Active recovery — stretch, hydrate, sleep.' };
    }
    const out = { day: `Day ${i + 1}`, focus: d.label || `Day ${i + 1}`, exercises };
    if (dayRx.techniqueCue) out.focus_cue = dayRx.techniqueCue;
    return out;
  });
}
