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
  'Barbell Bench Press': { en: 'vthMCtgVtFw', es: 'fqsTgdTPRQU', pt: 'vIGvt-vgrvY' }, 'Incline Dumbbell Press': { en: 'awEEyL5zGvU', es: 'oTD5g77GgSA', pt: 'G-i3jMIbDmo' }, 'Machine Chest Press': { en: 'pLofEAcfsO8', es: 'd-gwsl5BlMQ', pt: 'bKSvckCwvh4' }, 'Push-Up': { en: 'uXC_3Gs9Yr0', es: 'aambSRJ9I8U', pt: 'TbVWMhyax2U' }, 'Cable Chest Fly': { en: 'ovFc-5YdcXw', es: 'XnaMi2Gb_9Q', pt: 'E3aha5zhlc0' },
  'Lat Pulldown': { en: 'CAwf7n6Luuc', es: 'WW6E1zRdYoQ', pt: 'V-Z_RntYhZg' }, 'Seated Cable Row': { en: 'EU7bOadUsNI', es: 'JtTusrYzAos', pt: 'NCt6TAK-rMU' }, 'One-Arm Dumbbell Row': { en: 'pYcpY20QaE8', es: 'Vvnw0EYAlgc', pt: 'WrF-rpwax4k' }, 'Pull-Up': { en: 'rmdn5X_KLkY', es: '8mhDd9Ahl1M', pt: 'oH-NrOccUOg' }, 'Barbell Bent-Over Row': { en: 'rqTOAM8WoeM', es: '3uiWjik2yEQ', pt: 'mxvS-iwm53o' },
  'Dumbbell Shoulder Press': { en: 'E9ShwbwZ1zw', es: 'bTqxQNOxhXE', pt: 'eufDL9MmF8A' }, 'Dumbbell Lateral Raise': { en: '4hTUCDUQaNA', es: 'aVa9ce3SlSA', pt: 'jannLx4RxKo' }, 'Cable Face Pull': { en: 'ljgqer1ZpXg', es: 'Q18p2QtQAes', pt: 'kYMTJAx_dTM' }, 'Band Pull-Apart': { en: 'smSSXITNpCI', es: 'oX4Q39GtAzs', pt: 'smSSXITNpCI' },
  'Dumbbell Biceps Curl': { en: 'ykJmrZ5v0Oo', es: 'xW9i600AeHA', pt: 'wThiFR_bPYU' }, 'Cable Biceps Curl': { en: '2MUEL4nL6hA', es: '7Jc4jHxax60', pt: 'X12n32mNBp8' }, 'Hammer Curl': { en: 'TwD-YGVP4Bk', es: 'mPvlpDWIoDA', pt: '1-xCKLVxqqg' },
  'Cable Triceps Pushdown': { en: '_w-HpW70nSQ', es: 'Y-NCnt3OhNU', pt: 'gPJo1ZDGiS4' }, 'Bench Dip': { en: '0326dy_-CzM', es: 'EZSjDiiTi2o', pt: 'jH9RXQjbXqs' },
  'Leg Press': { en: 'K5n2vg3oZa4', es: 'T-koHmW1HSs', pt: '5PmHrElV9Ts' }, 'Goblet Squat': { en: 'BR4tlEE_A98', es: 'XANUniwN1Jg', pt: '6cSmqSho_Ks' }, 'Bulgarian Split Squat': { en: 'hiLF_pF3EJM', es: 'IdilLr9nyuQ', pt: 'a3-bQbTdA_0' }, 'Walking Lunge': { en: '_DLIS8SySzs', es: '_qgTx3yZ5jE', pt: 'kKdXPxJoILY' }, 'Leg Extension': { en: 'tTbJBUKnWU8', es: 'MyeQ1zCcfas', pt: 'RHgqvYAed_8' }, 'Front Squat': { en: 'wyDbagKS7Rg', es: 'v_nvYjpX-iY', pt: 'YU2buvcafOA' },
  'Dumbbell Romanian Deadlift': { en: 'aa57T45iFSE', es: 'UgqrPwoTick', pt: 'jSomWOwLiGE' }, 'Seated Leg Curl': { en: 'S367qaHeYWU', es: 'kU6YEyUzPcA', pt: 'AFG0wxXmTH4' },
  'Barbell Hip Thrust': { en: 'S_uZP4UH6J0', es: 'efe-QObKAZU', pt: '3mnHo-F-U4Q' }, 'Dumbbell Hip Thrust': { en: '29OfN4ztW_g', es: 'fWdFKm56euc', pt: 'ECbv51lHtq4' }, 'Glute Bridge': { en: '8bbE64NuDTU', es: 'oDXM-a-gBt8', pt: 'le8ZN02BQCE' }, 'Cable Pull-Through': { en: 'yXopOhzEoeo', es: 'OmhY5_tVzt0', pt: 'yXopOhzEoeo' },
  'Standing Calf Raise': { en: 'SVtg-1loH4c', es: 'ap12w0XNShg', pt: 'cklp_Xh5V8M' },
  'Front Plank': { en: 'mwlp75MS6Rg', es: 'TnsqBqlwSxg', pt: 'uUQKLqKMJSU' }, 'Side Plank': { en: 'Ujf5ELfqI7o', es: 'zfiOU4yxLKo', pt: 'zt7PjySXWCw' }, 'Hanging Leg Raise': { en: 'Pr1ieGZ5atk', es: 'L7H9je30Z1Y', pt: '-FQn23icsoY' }, 'Cable Woodchop': { en: 'Gwcf4TOj1hc', es: 'BEgusW-p_vc', pt: 'xRn3J6giamg' }, 'Dead Bug': { en: 'bxn9FBrt4-A', es: 'jdiE9CQDebo', pt: 'P4urLuc_93Y' },
  // EXPANSION · chest/press
  'Cable Crossover': { en: 'JUDTGZh4rhg', es: 'WNtBIde3Qks', pt: 'E3aha5zhlc0' }, 'Dumbbell Fly': { en: 'eozdVDA78K0', es: 'wtiR55hCv40', pt: '_kpKlYexyXs' }, 'Machine Chest Fly': { en: 'hZ0CGRaKwbQ', es: 'WKfTStqIXrw', pt: 'zEcIgGm7fxU' }, 'Incline Barbell Bench Press': { en: 'jPLdzuHckI8', es: 'pLEPhBOifm4', pt: 'TIMRYQKVvDk' }, 'Close-Grip Bench Press': { en: 'cXbSJHtjrQQ', es: 'dlA8DTO-Zro', pt: 'rlFTMzADrkc' }, 'Dumbbell Chest Press': { en: 'jRUC6IVav30', es: 'aUtj6oqSQPo', pt: 'tDxKGeY-hjQ' }, 'DB Flat Bench Press': { en: 'jRUC6IVav30', es: 'W-qU8CF-WeU', pt: 'tDxKGeY-hjQ' },
  // shoulders
  'Overhead Press': { en: 'a81SaIpjGlA', es: '8GTjlUPUPKQ', pt: 'ZD3-TjUdiUo' }, 'Dumbbell Overhead Press': { en: '1jYq9QQEWqE', es: 'bTqxQNOxhXE', pt: 'eufDL9MmF8A' }, 'Dumbbell Front Raise': { en: '-t7fuZ0KhDA', es: 'kLbvYQ-l4BA', pt: 'jhxLYSm_P-k' },
  // biceps
  'Barbell Curl': { en: 'JJB8XgKltA8', es: 'uDLZNOqv3EA', pt: 'Et1wgGMGW8w' }, 'Preacher Curl': { en: 'fIWP-FRFNU0', es: 'ERtAmNchnFQ', pt: 'zpTK6eihdSA' }, 'Concentration Curl': { en: 'Jvj2wV0vOYU', es: 'FrOJpldJWC4', pt: 'NftBaXxrLJ4' },
  // triceps
  'Overhead Triceps Extension': { en: 'DZgpCf5alfI', es: 'PyNaiTP1PIA', pt: 'KXtq1r5eoOQ' }, 'Triceps Dip': { en: 'U7HeutDqS_w', es: 'OgjaUueRiII', pt: 'EjNigPXifrw' },
  // legs / posterior
  'Hack Squat': { en: 'hglQExHCM9Q', es: 'R8ZyWx1EgoY', pt: 'F4YosnmXjO0' }, 'Barbell Deadlift': { en: 'GxsLrTzyGUU', es: 'kN82vxbwpRw', pt: 'N3O3gtNM7GY' }, 'Lying Leg Curl': { en: 'vl5nUdE9mWM', es: 'sRMO3SbTqjk', pt: 'dMYsB4Eb2BY' }, 'Hamstring Curls': { en: 'vl5nUdE9mWM', es: 'sRMO3SbTqjk', pt: 'dMYsB4Eb2BY' }, 'Seated Calf Raise': { en: 'ORY-ke6vcgk', es: 'Hq7ZnmkuZWM', pt: 'qpVKOlniMXo' },
  // glutes / posterior chain
  'Hip Abduction Machine': { en: 'OjI5OpV6IWA', es: '2vCRMi-lgJ4', pt: 'ffNjbi2rvTQ' }, 'Hip Abductors': { en: 'OjI5OpV6IWA', es: 'tAnAP9iILlE', pt: '50qHGus1TZk' }, 'Abductor Machine': { en: 'OjI5OpV6IWA', es: '2vCRMi-lgJ4', pt: '50qHGus1TZk' }, 'Back Extension': { en: 'gLT-WLH84B4', es: 'ye-dpRzXaOg', pt: '6Bg5woPBEA8' }, 'Cable Hip Extension': { en: 'yXopOhzEoeo', es: '1mL-NCet4dY', pt: 'qHeY7yDu1fc' }, 'Cable Glute Kickback': { en: 'bVrmtCI00Ys', es: 'cV9ylFjgJtI', pt: 'DHCv6Vjakv0' }, 'Reverse Kickbacks': { en: 'bVrmtCI00Ys', es: 'ryfa2MqJsbk', pt: '-8KpQXHtCEw' },
  // core / misc
  'Bird Dog': { en: 'ZdAHe9_HeEw', es: 'MEKThiUpdyc', pt: 'p6czwaejDY8' }, 'Russian Twist': { en: 'wkD8rjkodUI', es: 'hdSyLWfRJHc', pt: 'GHPI80YS2Ns' }, 'Heel Tap': { en: 'jfXcyLTuKP4', es: 'PmD8OjgsdrY', pt: 'mAdzrPGeFZo' }, 'MTS Pulldown': { en: 'CAwf7n6Luuc', es: 'eSlKErmf5WU', pt: '7cCiQUdIXWw' },
  // EXPANSION · home-resistance kit (dumbbell / band / kettlebell / medicine-ball)
  // — form demos for the at-home adult program. Keyed to the exact plan names so
  // they resolve on the exact-key pass. (Movements already in the map above —
  // Dumbbell Chest/Shoulder Press, Goblet Squat, DB RDL, DB Biceps Curl, Russian
  // Twist — reuse those entries; only the genuinely new movements are added here.)
  'Incline Push-Up': 'hTm9vkhNCec', 'Step-Up': 'EswvBNNHsRg', 'Resistance Band Row': 'hqFwwv6dFGY', 'Dumbbell Pullover': 'gEbpSjFBpCk', 'Dumbbell Lunge': 'EIycwKi4Mfk', 'Plank with Medicine Ball Rollout': '0rNOsQHSe2U', 'Kettlebell Swing': 'zSww9F2ZEW8', 'Medicine Ball Slam': '6vXHh-Lhb2o', 'Medicine Ball Woodchop': 'obff1WMggjc',
  // EXPANSION · Planet Fitness machines (Dad's knee-friendly 4-day split) — the
  // movements his plan uses that weren't already covered above, so every assigned
  // lift resolves to a real form demo (distinct from the dumbbell/abduction keys).
  'Smith Machine Incline Press': 'QUDq7dcBvp4', 'Machine Lateral Raise': 'DSr5-DXPUgA', 'Hip Adduction Machine': '6tJjQFK_Q9U',
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
// In-app embed (Material Upgrade): the athlete plays the demo INSIDE the
// execution card — never routed out of the app. playsinline keeps the BBF Lab
// WebView from hijacking into the system fullscreen player on tap.
// Stripped chrome: no related videos (rel=0), minimal branding, no title/uploader
// overlay (showinfo=0), fullscreen allowed (fs=1), inline playback on mobile.
export const embedURL = (id) =>
  `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&showinfo=0&fs=1&playsinline=1`;
