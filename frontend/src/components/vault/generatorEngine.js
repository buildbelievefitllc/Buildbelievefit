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

const FOCUS_GROUPS = {
  full: ['chest', 'back', 'quads', 'hamstrings', 'glutes', 'shoulders', 'core'],
  upper: ['chest', 'back', 'shoulders', 'biceps', 'triceps'],
  lower: ['quads', 'hamstrings', 'glutes', 'calves'],
  push: ['chest', 'shoulders', 'triceps'],
  pull: ['back', 'biceps', 'shoulders'],
  'legs-glutes': ['quads', 'hamstrings', 'glutes', 'calves'],
  arms: ['biceps', 'triceps', 'shoulders'],
  core: ['core'],
};

// LOCKED blacklist — never program these, under any circumstance.
const BLACKLIST = ['back squat', 'barbell back squat', 'crunch', 'abdominal crunch', 'crunches'];
export function isBlacklisted(name) {
  const n = String(name || '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
  return BLACKLIST.some((b) => n.indexOf(b) !== -1);
}

// Selectable parameters (label/value pairs for the UI).
export const GOALS = [
  { v: 'hypertrophy', l: 'Hypertrophy' }, { v: 'strength', l: 'Strength' },
  { v: 'power', l: 'Power' }, { v: 'fatloss', l: 'Fat Loss' }, { v: 'general', l: 'General Fitness' },
];
export const FOCI = [
  { v: 'full', l: 'Full Body' }, { v: 'upper', l: 'Upper' }, { v: 'lower', l: 'Lower' },
  { v: 'push', l: 'Push' }, { v: 'pull', l: 'Pull' }, { v: 'legs-glutes', l: 'Legs & Glutes' },
  { v: 'arms', l: 'Arms & Delts' }, { v: 'core', l: 'Core' },
];
export const LEVELS = [{ v: '1', l: 'Beginner' }, { v: '2', l: 'Intermediate' }, { v: '3', l: 'Advanced' }];
export const LOCATIONS = [
  { v: 'commercial', l: 'Commercial Gym' }, { v: 'planet', l: 'Planet-style' },
  { v: 'home-min', l: 'Home · Minimal' }, { v: 'home-bar', l: 'Home · Barbell' }, { v: 'travel', l: 'Travel' },
];
export const DAY_OPTIONS = ['2', '3', '4', '5', '6'];
export const DURATIONS = [
  { v: '30', l: '30 min' }, { v: '45', l: '45 min' }, { v: '60', l: '60 min' },
  { v: '75', l: '75 min' }, { v: '90', l: '90 min' },
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

function splitFor(days, focusGroups, focusKey) {
  if (focusKey && focusKey !== 'full') {
    const lbl = ({ upper: 'Upper', lower: 'Lower', push: 'Push', pull: 'Pull', 'legs-glutes': 'Legs & Glutes', arms: 'Arms & Delts', core: 'Core' })[focusKey] || 'Session';
    const out = [];
    for (let i = 0; i < days; i++) out.push([`${lbl} ${String.fromCharCode(65 + i)}`, focusGroups.slice()]);
    return out;
  }
  const tpl = {
    2: [['Full Body A', ['chest', 'back', 'quads', 'shoulders', 'core']], ['Full Body B', ['hamstrings', 'glutes', 'back', 'shoulders', 'core']]],
    3: [['Full Body A', ['chest', 'back', 'quads', 'core']], ['Full Body B', ['shoulders', 'hamstrings', 'glutes', 'core']], ['Full Body C', ['back', 'quads', 'biceps', 'triceps']]],
    4: [['Upper', ['chest', 'back', 'shoulders', 'triceps', 'biceps']], ['Lower', ['quads', 'hamstrings', 'glutes', 'calves']], ['Upper', ['back', 'chest', 'shoulders', 'biceps', 'triceps']], ['Lower', ['glutes', 'hamstrings', 'quads', 'core']]],
    5: [['Push', ['chest', 'shoulders', 'triceps']], ['Pull', ['back', 'biceps', 'shoulders']], ['Legs', ['quads', 'hamstrings', 'glutes', 'calves']], ['Upper', ['chest', 'back', 'shoulders']], ['Lower', ['glutes', 'hamstrings', 'quads', 'core']]],
    6: [['Push', ['chest', 'shoulders', 'triceps']], ['Pull', ['back', 'biceps', 'shoulders']], ['Legs', ['quads', 'hamstrings', 'glutes']], ['Push', ['shoulders', 'chest', 'triceps']], ['Pull', ['back', 'biceps', 'shoulders']], ['Legs', ['glutes', 'hamstrings', 'quads', 'calves']]],
  };
  return tpl[days] || tpl[4];
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
// { days, goal, focus, level, program:[{ label, exercises:[{n,g,p}], rx:{sets,reps,rest} }] }.
export function generateProgram(params = {}) {
  const goal = params.goal || 'hypertrophy';
  const level = parseInt(params.level, 10) || 2;
  const days = parseInt(params.days, 10) || 4;
  const locEq = LOC_EQ[params.loc] || LOC_EQ.commercial;
  const focusKey = params.focus || 'full';
  const focusGroups = FOCUS_GROUPS[focusKey] || FOCUS_GROUPS.full;
  const perDay = countFor(params.dur);
  const rx = prescribe(goal);
  const pool = eligible(locEq, level);
  const split = splitFor(days, focusGroups, focusKey);
  const seed = (params.regen || 0) * 7919 + days * 131 + level * 17 + (String(goal).charCodeAt(0) || 65) + (String(focusKey).charCodeAt(0) || 70);
  const rnd = rng(seed);
  const program = [];

  for (let d = 0; d < split.length; d++) {
    const [label, groups] = split[d];
    let cand = pool.filter((x) => groups.indexOf(x.g) !== -1);
    cand = shuffle(cand, rnd);
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
    const safe = picks.filter((x) => !isBlacklisted(x.n) && resolveVideoId(x.n));
    program.push({ label, exercises: safe, rx });
  }

  return { days, goal, focus: focusKey, level, program };
}
