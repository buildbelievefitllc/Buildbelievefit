// src/components/vault/exerciseVideos.js
// ─────────────────────────────────────────────────────────────────────────────
// Phase 21.2 — Exercise form-video resolver (React port of the monolith's
// window.BBF_VIDEO_MAP + BBF_RESOLVE_VIDEO_ID, bbf-app.html:19988–20066, 26687).
//
// The authorized program catalog (programData.js) stores exercise NAMES but no
// video ids — the legacy app keyed YouTube form-demos in a separate hardwired
// map and resolved plan names to it via a fuzzy normalizer (plan names like
// "Lateral Raises" / "Incline DB Press" don't exactly match map keys like
// "Dumbbell Lateral Raise"). This module restores that behavior verbatim so the
// Vault's grid shows the same form-demo thumbnails the prototype did.
//
// IMMUTABLE LAW (carried over): a blacklisted lift simply isn't in the map, so it
// can never resolve to a video — the map is the allow-list, not just media.

import { pickLang } from '../../lib/pickLang.js';

// ─── Hardwired exercise → YouTube id map ─────────────────────────────────────
// Each value is EITHER a flat YouTube id string (legacy / EN-for-all — the
// structural fallback) OR a localized { en, es, pt } object. resolveVideoId()
// resolves whichever shape to the active language via pickLang(), so a bare
// string keeps working untouched and an entry is promoted to the object form the
// moment a localized clip is sourced (a missing es/pt safely falls back to en).
export const VIDEO_MAP = {
  // CORE 37
  'Barbell Bench Press': { en: 'vthMCtgVtFw', es: 'fqsTgdTPRQU', pt: 'vIGvt-vgrvY' }, 'Incline Dumbbell Press': { en: 'awEEyL5zGvU', es: 'awEEyL5zGvU', pt: 'awEEyL5zGvU' }, 'Machine Chest Press': { en: 'pLofEAcfsO8', es: 'pLofEAcfsO8', pt: 'pLofEAcfsO8' }, 'Push-Up': { en: 'uXC_3Gs9Yr0', es: 'uXC_3Gs9Yr0', pt: 'uXC_3Gs9Yr0' }, 'Cable Chest Fly': { en: 'ovFc-5YdcXw', es: 'ovFc-5YdcXw', pt: 'ovFc-5YdcXw' },
  'Lat Pulldown': { en: 'CAwf7n6Luuc', es: 'WW6E1zRdYoQ', pt: 'V-Z_RntYhZg' }, 'Seated Cable Row': { en: 'EU7bOadUsNI', es: 'EU7bOadUsNI', pt: 'EU7bOadUsNI' }, 'One-Arm Dumbbell Row': { en: 'pYcpY20QaE8', es: 'pYcpY20QaE8', pt: 'pYcpY20QaE8' }, 'Pull-Up': { en: 'rmdn5X_KLkY', es: 'rmdn5X_KLkY', pt: 'rmdn5X_KLkY' }, 'Barbell Bent-Over Row': { en: 'rqTOAM8WoeM', es: 'rqTOAM8WoeM', pt: 'rqTOAM8WoeM' },
  'Dumbbell Shoulder Press': { en: 'E9ShwbwZ1zw', es: 'E9ShwbwZ1zw', pt: 'E9ShwbwZ1zw' }, 'Dumbbell Lateral Raise': { en: '4hTUCDUQaNA', es: '4hTUCDUQaNA', pt: '4hTUCDUQaNA' }, 'Cable Face Pull': { en: 'ljgqer1ZpXg', es: 'ljgqer1ZpXg', pt: 'ljgqer1ZpXg' }, 'Band Pull-Apart': { en: 'smSSXITNpCI', es: 'smSSXITNpCI', pt: 'smSSXITNpCI' },
  'Dumbbell Biceps Curl': { en: 'ykJmrZ5v0Oo', es: 'ykJmrZ5v0Oo', pt: 'ykJmrZ5v0Oo' }, 'Cable Biceps Curl': { en: '2MUEL4nL6hA', es: '2MUEL4nL6hA', pt: '2MUEL4nL6hA' }, 'Hammer Curl': { en: 'TwD-YGVP4Bk', es: 'TwD-YGVP4Bk', pt: 'TwD-YGVP4Bk' },
  'Cable Triceps Pushdown': { en: '_w-HpW70nSQ', es: '_w-HpW70nSQ', pt: '_w-HpW70nSQ' }, 'Bench Dip': { en: '0326dy_-CzM', es: '0326dy_-CzM', pt: '0326dy_-CzM' },
  'Leg Press': { en: 'K5n2vg3oZa4', es: 'K5n2vg3oZa4', pt: 'K5n2vg3oZa4' }, 'Goblet Squat': { en: 'BR4tlEE_A98', es: 'XANUniwN1Jg', pt: '6cSmqSho_Ks' }, 'Bulgarian Split Squat': { en: 'hiLF_pF3EJM', es: 'hiLF_pF3EJM', pt: 'hiLF_pF3EJM' }, 'Walking Lunge': { en: '_DLIS8SySzs', es: '_DLIS8SySzs', pt: '_DLIS8SySzs' }, 'Leg Extension': { en: 'tTbJBUKnWU8', es: 'tTbJBUKnWU8', pt: 'tTbJBUKnWU8' }, 'Front Squat': { en: 'wyDbagKS7Rg', es: 'wyDbagKS7Rg', pt: 'wyDbagKS7Rg' },
  'Dumbbell Romanian Deadlift': { en: 'aa57T45iFSE', es: 'UgqrPwoTick', pt: 'jSomWOwLiGE' }, 'Seated Leg Curl': { en: 'S367qaHeYWU', es: 'S367qaHeYWU', pt: 'S367qaHeYWU' },
  'Barbell Hip Thrust': { en: 'S_uZP4UH6J0', es: 'S_uZP4UH6J0', pt: 'S_uZP4UH6J0' }, 'Dumbbell Hip Thrust': { en: '29OfN4ztW_g', es: '29OfN4ztW_g', pt: '29OfN4ztW_g' }, 'Glute Bridge': { en: '8bbE64NuDTU', es: '8bbE64NuDTU', pt: '8bbE64NuDTU' }, 'Cable Pull-Through': { en: 'yXopOhzEoeo', es: 'yXopOhzEoeo', pt: 'yXopOhzEoeo' },
  'Standing Calf Raise': { en: 'SVtg-1loH4c', es: 'SVtg-1loH4c', pt: 'SVtg-1loH4c' },
  'Front Plank': { en: 'mwlp75MS6Rg', es: 'mwlp75MS6Rg', pt: 'mwlp75MS6Rg' }, 'Side Plank': { en: 'Ujf5ELfqI7o', es: 'Ujf5ELfqI7o', pt: 'Ujf5ELfqI7o' }, 'Hanging Leg Raise': { en: 'Pr1ieGZ5atk', es: 'Pr1ieGZ5atk', pt: 'Pr1ieGZ5atk' }, 'Cable Woodchop': { en: 'Gwcf4TOj1hc', es: 'Gwcf4TOj1hc', pt: 'Gwcf4TOj1hc' }, 'Dead Bug': { en: 'bxn9FBrt4-A', es: 'bxn9FBrt4-A', pt: 'bxn9FBrt4-A' },
  // EXPANSION · chest/press
  'Cable Crossover': { en: 'JUDTGZh4rhg', es: 'JUDTGZh4rhg', pt: 'JUDTGZh4rhg' }, 'Dumbbell Fly': { en: 'eozdVDA78K0', es: 'eozdVDA78K0', pt: 'eozdVDA78K0' }, 'Machine Chest Fly': { en: 'hZ0CGRaKwbQ', es: 'hZ0CGRaKwbQ', pt: 'hZ0CGRaKwbQ' }, 'Incline Barbell Bench Press': { en: 'jPLdzuHckI8', es: 'jPLdzuHckI8', pt: 'jPLdzuHckI8' }, 'Close-Grip Bench Press': { en: 'cXbSJHtjrQQ', es: 'cXbSJHtjrQQ', pt: 'cXbSJHtjrQQ' }, 'Dumbbell Chest Press': { en: 'jRUC6IVav30', es: 'jRUC6IVav30', pt: 'jRUC6IVav30' }, 'DB Flat Bench Press': { en: 'jRUC6IVav30', es: 'jRUC6IVav30', pt: 'jRUC6IVav30' },
  // shoulders
  'Overhead Press': { en: 'a81SaIpjGlA', es: 'a81SaIpjGlA', pt: 'a81SaIpjGlA' }, 'Dumbbell Overhead Press': { en: '1jYq9QQEWqE', es: '1jYq9QQEWqE', pt: '1jYq9QQEWqE' }, 'Dumbbell Front Raise': { en: '-t7fuZ0KhDA', es: '-t7fuZ0KhDA', pt: '-t7fuZ0KhDA' },
  // biceps
  'Barbell Curl': { en: 'JJB8XgKltA8', es: 'JJB8XgKltA8', pt: 'JJB8XgKltA8' }, 'Preacher Curl': { en: 'fIWP-FRFNU0', es: 'fIWP-FRFNU0', pt: 'fIWP-FRFNU0' }, 'Concentration Curl': { en: 'Jvj2wV0vOYU', es: 'Jvj2wV0vOYU', pt: 'Jvj2wV0vOYU' },
  // triceps
  'Overhead Triceps Extension': { en: 'DZgpCf5alfI', es: 'DZgpCf5alfI', pt: 'DZgpCf5alfI' }, 'Triceps Dip': { en: 'U7HeutDqS_w', es: 'U7HeutDqS_w', pt: 'U7HeutDqS_w' },
  // legs / posterior
  'Hack Squat': { en: 'hglQExHCM9Q', es: 'hglQExHCM9Q', pt: 'hglQExHCM9Q' }, 'Barbell Deadlift': { en: 'GxsLrTzyGUU', es: 'GxsLrTzyGUU', pt: 'GxsLrTzyGUU' }, 'Lying Leg Curl': { en: 'vl5nUdE9mWM', es: 'vl5nUdE9mWM', pt: 'vl5nUdE9mWM' }, 'Hamstring Curls': { en: 'vl5nUdE9mWM', es: 'vl5nUdE9mWM', pt: 'vl5nUdE9mWM' }, 'Seated Calf Raise': { en: 'ORY-ke6vcgk', es: 'ORY-ke6vcgk', pt: 'ORY-ke6vcgk' },
  // glutes / posterior chain
  'Hip Abduction Machine': { en: 'OjI5OpV6IWA', es: 'OjI5OpV6IWA', pt: 'OjI5OpV6IWA' }, 'Hip Abductors': { en: 'OjI5OpV6IWA', es: 'OjI5OpV6IWA', pt: 'OjI5OpV6IWA' }, 'Abductor Machine': { en: 'OjI5OpV6IWA', es: 'OjI5OpV6IWA', pt: 'OjI5OpV6IWA' }, 'Back Extension': { en: 'gLT-WLH84B4', es: 'gLT-WLH84B4', pt: 'gLT-WLH84B4' }, 'Cable Hip Extension': { en: 'yXopOhzEoeo', es: 'yXopOhzEoeo', pt: 'yXopOhzEoeo' }, 'Cable Glute Kickback': { en: 'bVrmtCI00Ys', es: 'bVrmtCI00Ys', pt: 'bVrmtCI00Ys' }, 'Reverse Kickbacks': { en: 'bVrmtCI00Ys', es: 'bVrmtCI00Ys', pt: 'bVrmtCI00Ys' },
  // core / misc
  'Bird Dog': { en: 'ZdAHe9_HeEw', es: 'ZdAHe9_HeEw', pt: 'ZdAHe9_HeEw' }, 'Russian Twist': { en: 'wkD8rjkodUI', es: 'wkD8rjkodUI', pt: 'wkD8rjkodUI' }, 'Heel Tap': { en: 'jfXcyLTuKP4', es: 'jfXcyLTuKP4', pt: 'jfXcyLTuKP4' }, 'MTS Pulldown': { en: 'CAwf7n6Luuc', es: 'CAwf7n6Luuc', pt: 'CAwf7n6Luuc' },
};

// ─── Fuzzy normalizer (port of _normalizeExerciseName) ───────────────────────
const EX_ABBR = {
  db: 'dumbbell', dbs: 'dumbbell', bb: 'barbell', kb: 'kettlebell', ohp: 'overhead press',
  rdl: 'romanian deadlift', rdls: 'romanian deadlift', bw: 'bodyweight',
  ext: 'extension', exts: 'extension', alt: 'alternating', sl: 'single leg',
  tri: 'triceps', tricep: 'triceps', bi: 'biceps', bicep: 'biceps', quad: 'quadriceps', mts: 'machine',
};
const EX_SYN = { rope: 'cable', single: 'one', singlearm: 'one', onearm: 'one', onearmed: 'one', chinup: 'pullup' };
const EX_STOP = { the: 1, a: 1, with: 1, and: 1, or: 1, your: 1, to: 1, of: 1, for: 1 };

function singular(w) {
  if (w === 'press' || w === 'triceps' || w === 'biceps' || w === 'abs') return w;
  if (/(ches|shes|sses|xes)$/.test(w)) return w.replace(/es$/, '');
  if (/ies$/.test(w)) return w.replace(/ies$/, 'y');
  if (/(flyes|flye)$/.test(w)) return 'fly';
  if (/s$/.test(w) && !/(us|ss|is)$/.test(w)) return w.replace(/s$/, '');
  return w;
}

function normalize(name) {
  let s = String(name == null ? '' : name).toLowerCase();
  s = s.replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const out = [];
  s.split(' ').forEach((tok) => {
    const expanded = EX_ABBR[tok] || tok;
    expanded.split(' ').forEach((raw) => {
      if (!raw || EX_STOP[raw]) return;
      let p = singular(raw);
      p = EX_SYN[p] || p;
      if (p && !EX_STOP[p]) out.push(p);
    });
  });
  return out.filter((t, i) => t !== out[i - 1]); // dedupe adjacent
}

// Precomputed token-sets for the map keys (built once).
const KEY_INDEX = Object.keys(VIDEO_MAP).map((key) => ({ key, toks: normalize(key) }));

// Resolve a plan exercise name to its raw VIDEO_MAP entry (a flat id string OR a
// { en, es, pt } object), or null. Mirrors BBF_RESOLVE_VIDEO_ID:
// exact key → exact normalized → safe token-subset.
export function resolveVideoEntry(exName) {
  if (VIDEO_MAP[exName]) return VIDEO_MAP[exName];
  const nt = normalize(exName);
  if (!nt.length) return null;
  const nk = nt.join(' ');

  for (let i = 0; i < KEY_INDEX.length; i++) {
    if (KEY_INDEX[i].toks.join(' ') === nk) return VIDEO_MAP[KEY_INDEX[i].key];
  }

  let best = null;
  let bestScore = 0;
  for (let i = 0; i < KEY_INDEX.length; i++) {
    const kt = KEY_INDEX[i].toks;
    const inter = nt.filter((t) => kt.indexOf(t) > -1).length;
    const ratio = inter / Math.min(nt.length, kt.length);
    const cov = inter / Math.max(nt.length, kt.length);
    if (ratio === 1 && cov >= 0.5 && ratio + cov > bestScore) {
      bestScore = ratio + cov;
      best = VIDEO_MAP[KEY_INDEX[i].key];
    }
  }
  return best;
}

// Resolve a plan exercise name to a hardwired YouTube id for the active language,
// or null. `lang` is OPTIONAL: omitted (or with no localized variant) it returns
// the EN/flat id — so legacy callers AND the generatorEngine "no video → never
// programmed" gate keep their exact behavior, while lang-aware callers get the
// localized clip with automatic EN fallback.
export function resolveVideoId(exName, lang) {
  return pickLang(resolveVideoEntry(exName), lang);
}

export const watchURL = (id) => `https://www.youtube.com/watch?v=${id}`;
export const thumbURL = (id) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
