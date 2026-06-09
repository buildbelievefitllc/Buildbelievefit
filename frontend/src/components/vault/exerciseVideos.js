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

// ─── Hardwired exercise → YouTube id map (verbatim from BBF_VIDEO_MAP) ───────
// Each value is the en/base YouTube id (a string) OR a language-keyed object
// { en, es, pt } once localized cuts exist. resolveVideoId() runs every value
// through localizedVideoId() with an en fallback, so a plain string is simply the
// en baseline and ANY entry can be upgraded in place to { en, es, pt } — no caller
// changes, and a missing es/pt never renders a broken iframe.
export const VIDEO_MAP = {
  // CORE 37
  'Barbell Bench Press': 'vthMCtgVtFw', 'Incline Dumbbell Press': 'awEEyL5zGvU', 'Machine Chest Press': 'pLofEAcfsO8', 'Push-Up': 'uXC_3Gs9Yr0', 'Cable Chest Fly': 'ovFc-5YdcXw',
  'Lat Pulldown': 'CAwf7n6Luuc', 'Seated Cable Row': 'EU7bOadUsNI', 'One-Arm Dumbbell Row': 'pYcpY20QaE8', 'Pull-Up': 'rmdn5X_KLkY', 'Barbell Bent-Over Row': 'rqTOAM8WoeM',
  'Dumbbell Shoulder Press': 'E9ShwbwZ1zw', 'Dumbbell Lateral Raise': '4hTUCDUQaNA', 'Cable Face Pull': 'ljgqer1ZpXg', 'Band Pull-Apart': 'smSSXITNpCI',
  'Dumbbell Biceps Curl': 'ykJmrZ5v0Oo', 'Cable Biceps Curl': '2MUEL4nL6hA', 'Hammer Curl': 'TwD-YGVP4Bk',
  'Cable Triceps Pushdown': '_w-HpW70nSQ', 'Bench Dip': '0326dy_-CzM',
  'Leg Press': 'K5n2vg3oZa4', 'Goblet Squat': 'BR4tlEE_A98', 'Bulgarian Split Squat': 'hiLF_pF3EJM', 'Walking Lunge': '_DLIS8SySzs', 'Leg Extension': 'tTbJBUKnWU8', 'Front Squat': 'wyDbagKS7Rg',
  'Dumbbell Romanian Deadlift': 'aa57T45iFSE', 'Seated Leg Curl': 'S367qaHeYWU',
  'Barbell Hip Thrust': 'S_uZP4UH6J0', 'Dumbbell Hip Thrust': '29OfN4ztW_g', 'Glute Bridge': '8bbE64NuDTU', 'Cable Pull-Through': 'yXopOhzEoeo',
  'Standing Calf Raise': 'SVtg-1loH4c',
  'Front Plank': 'mwlp75MS6Rg', 'Side Plank': 'Ujf5ELfqI7o', 'Hanging Leg Raise': 'Pr1ieGZ5atk', 'Cable Woodchop': 'Gwcf4TOj1hc', 'Dead Bug': 'bxn9FBrt4-A',
  // EXPANSION · chest/press
  'Cable Crossover': 'JUDTGZh4rhg', 'Dumbbell Fly': 'eozdVDA78K0', 'Machine Chest Fly': 'hZ0CGRaKwbQ', 'Incline Barbell Bench Press': 'jPLdzuHckI8', 'Close-Grip Bench Press': 'cXbSJHtjrQQ', 'Dumbbell Chest Press': 'jRUC6IVav30', 'DB Flat Bench Press': 'jRUC6IVav30',
  // shoulders
  'Overhead Press': 'a81SaIpjGlA', 'Dumbbell Overhead Press': '1jYq9QQEWqE', 'Dumbbell Front Raise': '-t7fuZ0KhDA',
  // biceps
  'Barbell Curl': 'JJB8XgKltA8', 'Preacher Curl': 'fIWP-FRFNU0', 'Concentration Curl': 'Jvj2wV0vOYU',
  // triceps
  'Overhead Triceps Extension': 'DZgpCf5alfI', 'Triceps Dip': 'U7HeutDqS_w',
  // legs / posterior
  'Hack Squat': 'hglQExHCM9Q', 'Barbell Deadlift': 'GxsLrTzyGUU', 'Lying Leg Curl': 'vl5nUdE9mWM', 'Hamstring Curls': 'vl5nUdE9mWM', 'Seated Calf Raise': 'ORY-ke6vcgk',
  // glutes / posterior chain
  'Hip Abduction Machine': 'OjI5OpV6IWA', 'Hip Abductors': 'OjI5OpV6IWA', 'Abductor Machine': 'OjI5OpV6IWA', 'Back Extension': 'gLT-WLH84B4', 'Cable Hip Extension': 'yXopOhzEoeo', 'Cable Glute Kickback': 'bVrmtCI00Ys', 'Reverse Kickbacks': 'bVrmtCI00Ys',
  // core / misc
  'Bird Dog': 'ZdAHe9_HeEw', 'Russian Twist': 'wkD8rjkodUI', 'Heel Tap': 'jfXcyLTuKP4', 'MTS Pulldown': 'CAwf7n6Luuc',
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

// ─── Language picker — the multi-lingual video safety layer ──────────────────
// A VIDEO_MAP / METRIC_VIDEOS / prehab entry may be a plain string (the en/legacy
// id) OR a language-keyed object { en, es, pt }. Resolve to the active language,
// falling back to en (then any present id) so the UI NEVER renders a broken iframe
// when an es/pt cut hasn't been filmed yet.
export function localizedVideoId(entry, lang) {
  if (entry == null) return null;
  if (typeof entry === 'string') return entry || null;
  if (typeof entry === 'object') {
    return entry[lang] || entry.en || Object.values(entry).find((v) => typeof v === 'string' && v) || null;
  }
  return null;
}

// Resolve a plan exercise name to its hardwired video ENTRY (a string en-id or a
// { en, es, pt } object), then localize to `lang` with an en fallback. Mirrors
// BBF_RESOLVE_VIDEO_ID: exact key → exact normalized → safe token-subset. `lang` is
// OPTIONAL — omitted (or an unlocalized entry) yields the en/base id, so every
// legacy caller and the Titanium existence-check keep working unchanged.
export function resolveVideoId(exName, lang) {
  let entry = null;
  if (VIDEO_MAP[exName]) {
    entry = VIDEO_MAP[exName];
  } else {
    const nt = normalize(exName);
    if (!nt.length) return null;
    const nk = nt.join(' ');

    for (let i = 0; i < KEY_INDEX.length; i++) {
      if (KEY_INDEX[i].toks.join(' ') === nk) { entry = VIDEO_MAP[KEY_INDEX[i].key]; break; }
    }

    if (!entry) {
      let bestScore = 0;
      for (let i = 0; i < KEY_INDEX.length; i++) {
        const kt = KEY_INDEX[i].toks;
        const inter = nt.filter((t) => kt.indexOf(t) > -1).length;
        const ratio = inter / Math.min(nt.length, kt.length);
        const cov = inter / Math.max(nt.length, kt.length);
        if (ratio === 1 && cov >= 0.5 && ratio + cov > bestScore) {
          bestScore = ratio + cov;
          entry = VIDEO_MAP[KEY_INDEX[i].key];
        }
      }
    }
  }
  return localizedVideoId(entry, lang);
}

export const watchURL = (id) => `https://www.youtube.com/watch?v=${id}`;
export const thumbURL = (id) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
