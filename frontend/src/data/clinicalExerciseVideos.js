// src/data/clinicalExerciseVideos.js
// ─────────────────────────────────────────────────────────────────────────────
// Demo-video manifest for the Dynamic Prescription engine's clinical_exercises
// (the movements RecoveryPrescriptionCard renders). Keyed by the SAME id the
// prescription returns (fb_* / lb_* / sh_* / kn_* / nk_* / ub_* / bm_*), so a tap
// on a prescribed movement resolves to an in-app mini-player CLIENT-SIDE — no edge
// payload, no extra round-trip.
//
// ░░ HOW TO FILL (sourcing agent) ░░
// Set each id to a trilingual set of YouTube video ids, best-first:
//     fb_009: { en: ['abc123XYZ'], es: ['def456'], pt: ['ghi789'] },
// • es/pt fall back to en when absent — a single EN clip is a valid minimum.
// • Leave as null until sourced; the card shows a clean "demo coming soon" chip,
//   NEVER a broken embed, and auto-fills the moment an id is added (no redeploy
//   of logic needed — just this data file).
// • READY SOURCE: the stretch / mobility movements below overlap the existing
//   508-video catalog in src/data/recoveryVideos.js (keyed stat_*). Copy those
//   YouTube ids straight across where the movement matches (e.g. a clinical
//   "Standing quad stretch" → the stat_quad_001 ids).
//
// NB: bm_* are breathing / mental-wellness cues (the Champion's Mindset finisher),
// voiced by the coach — they generally need no demo video.

import { RECOVERY_VIDEOS } from './recoveryVideos.js';

export const CLINICAL_EXERCISE_VIDEOS = {
  // ── breathing_and_meditation (voiced finisher — video optional) ─────────────
  bm_001: null, // Lift up a low mood
  bm_002: null, // Messages for a safer, calmer day
  bm_003: null, // Box breathing
  bm_004: null, // Find hope in the struggle
  bm_005: null, // SOS meditation: breathing for calm
  bm_006: null, // Body scan for physical tension
  bm_007: null, // Diaphragmatic breathing foundation
  bm_008: null, // Guided visualization for recovery

  // ── shoulder ────────────────────────────────────────────────────────────────
  sh_001: { en: 'IzTFCZv0--E' }, // Resistance band shoulder strength
  sh_002: { en: 'AMqT-3l0I6k' }, // Strength exercises for shoulder pain
  sh_003: { en: 'Eaj_NG5_hIo' }, // Wall slides for scapular mobility
  sh_004: { en: 'ozhHe-u6uMM' }, // Isometric shoulder external rotation
  sh_005: { en: '0d8OPH6aeo8' }, // Isometric shoulder internal rotation
  sh_006: null, // Doorway pectoral stretch
  sh_007: { en: 'FODQxJh5PeI' }, // Sleeper stretch
  sh_008: null, // Cross-body shoulder stretch
  sh_009: { en: 'egcK49J5Q-Y' }, // Prone I-Y-T raises
  sh_010: { en: 'zY5nq68IxwA' }, // Pendulum arm swings
  sh_011: { en: 'iCZbtG0WosA' }, // Scapular retractions (seated)
  sh_012: { en: '3OYSIWaJJk4' }, // Resistance band pull-aparts

  // ── lower_body ───────────────────────────────────────────────────────────────
  lb_001: { en: 'RsNsIiNa6rY' }, // Quick lower body reset
  lb_002: { en: 'x0-FNTVWbzA' }, // Seated lower body stretch
  lb_003: { en: 'Bft9Brda3TY' }, // Low back and hip pain relief
  lb_004: null, // Supine piriformis stretch
  lb_005: null, // Kneeling hip flexor stretch
  lb_006: { en: '9uY-vvV4Lgc' }, // Cat-cow spinal mobility
  lb_007: null, // Child's pose lumbar stretch
  lb_008: { en: 'TWuR_U9ddcc' }, // Supine pelvic tilts
  lb_009: { en: 'ww-6lRXvI9Y' }, // Bird-dog core stability
  lb_010: { en: 'r_5ApR5BHV0' }, // Dead bug progression
  lb_011: { en: 'Sws_GwrlYO0' }, // Prone press-up (Cobra)
  lb_012: { en: 'g9FtnmsIYgI' }, // Side-lying hip abduction
  lb_013: { en: 'lhwT35sshrI' }, // Side-lying hip adduction
  lb_014: { en: 'grvBNoxUrp0' }, // Quadruped fire hydrants
  lb_015: { en: 'dNKI3bBLV3Q' }, // Seated lumbar rotation
  lb_016: null, // Standing hamstring stretch

  // ── knee ──────────────────────────────────────────────────────────────────────
  kn_001: { en: 'Ka19yzAlIGY' }, // Supine straight leg raise
  kn_002: { en: 'Wqky4QQQ23c' }, // Short arc quadriceps extension
  kn_003: { en: 'JaZNYM3zAP0' }, // Isometric wall sit holds
  kn_004: { en: '5FL_RBkDw2I' }, // Standing hamstring curl
  kn_005: { en: 'EG5_gXcfozw' }, // Side-lying clamshells
  kn_006: { en: 'T7PT5nVHE6s' }, // Low impact step-ups
  kn_007: { en: 'k8ipHzKeAkQ' }, // Standing calf raises
  kn_008: { en: 'A7fcobCVppc' }, // Supine heel slides
  kn_009: null, // Standing quad stretch
  kn_010: null, // Seated hamstring stretch
  kn_011: null, // Standing IT band stretch
  kn_012: { en: 'vOvRFsGMMqo' }, // Supine glute bridge
  kn_013: { en: 'IOCaL1JTxLo' }, // Lateral band walks
  kn_014: { en: 'fw4C3nGq4LI' }, // Terminal knee extension (banded)
  kn_015: { en: 'xAM2zBblDXk' }, // Seated patellar mobilization

  // ── neck ──────────────────────────────────────────────────────────────────────
  nk_001: { en: 'QQMfNNHcf8w' }, // Seated cervical retraction (chin tucks)
  nk_002: null, // Upper trapezius stretch
  nk_003: null, // Levator scapulae stretch
  nk_004: { en: 'To_0Yn8_Yks' }, // Slow neck rotations
  nk_005: null, // Neck lateral flexion
  nk_006: { en: 'GXbKeZtTfFY' }, // Isometric neck flexion (hand resistance)
  nk_007: { en: 'ydbMq0wPirw' }, // Isometric neck extension
  nk_008: { en: 'qFEBNu4vwSg' }, // Supine chin tucks
  nk_009: { en: '0mShVs1BoU0' }, // Seated scalene stretch
  nk_010: { en: 'e9SF1e7B8h4' }, // Gentle half neck rolls

  // ── upper_body ─────────────────────────────────────────────────────────────────
  ub_001: { en: 'gCNmsijJdFY' }, // Thoracic extension on foam roller
  ub_002: null, // Thread the needle stretch
  ub_003: { en: 'whSXi-EXbqI' }, // Seated resistance band rows
  ub_004: { en: '5NPvv40gd3Q' }, // Standing wall push-ups
  ub_005: { en: '3g-1J2KkX_8' }, // Resistance band biceps curl
  ub_006: { en: 'a5rUdCeTtSE' }, // Resistance band triceps extension
  ub_007: { en: 'i-JV2PsFzWA' }, // Wrist flexor stretch
  ub_008: { en: '80Y3HHMgo6w' }, // Wrist extensor stretch
  ub_009: { en: 'PuDhgEDhGCs' }, // Forearm pronation and supination
  ub_010: { en: 'OW6YHlxY6JI' }, // Side-lying open book stretch

  // ── full_body ──────────────────────────────────────────────────────────────────
  fb_001: null, // Standing toe touch progression
  fb_002: { en: '7pev2AW-MZ0' }, // Walkouts (inchworms)
  fb_003: { en: '88By_8Rd7mM' }, // Low impact jumping jacks
  fb_004: { en: 'G5iP1-kE4-4' }, // Bodyweight squat to stand
  fb_005: { en: 'opWGPRq8rs0' }, // Forward lunge with torso twist
  fb_006: { en: 'zDMUQ63YdbE' }, // High knees marching in place
  fb_007: { en: 'nsgbjeugPr0' }, // Standing torso twists
  fb_008: { en: 'wY9nQ-yfRwo' }, // Standing side bend reach
  fb_009: { en: 'CILKLy84EDk' }, // Modified bear crawl hold
};

// ── Bridge to the curated 508-video catalog (src/data/recoveryVideos.js) ──────
// Many clinical movements ARE the same stretch the trilingual recovery catalog
// already curates (multiple quality-rated clips per language). Rather than
// re-source them, map the clinical id → its catalog `stat_*` twin. CONSERVATIVE:
// only clear, same-movement matches — when a clinical movement has no faithful
// catalog twin it stays unmapped (→ "demo coming soon") rather than show a
// near-miss clip. (Functional full-body moves like bear-crawl/inchworm/squat-to-
// stand have no stretch twin here and still need purpose-sourced demos.)
export const CLINICAL_TO_STAT = {
  sh_006: 'stat_sho_002',  // Doorway pectoral stretch   → Doorway Pec/Front-Delt Stretch
  sh_008: 'stat_sho_001',  // Cross-body shoulder stretch → Cross-Body Shoulder Stretch
  lb_004: 'stat_abd_001',  // Supine piriformis stretch  → Figure-4 Glute/Abductor Stretch
  lb_005: 'stat_quad_002', // Kneeling hip flexor stretch → Couch Stretch (hip flexor)
  lb_007: 'stat_uback_001',// Child's pose lumbar stretch → Child's Pose Reach
  lb_016: 'stat_ham_003',  // Standing hamstring stretch  → Single-Leg Toe-Touch
  kn_009: 'stat_quad_001', // Standing quad stretch       → Standing Quad Stretch
  kn_010: 'stat_ham_001',  // Seated hamstring stretch    → Seated Forward Fold
  kn_011: 'stat_abd_002',  // Standing IT band stretch    → Standing Cross-Body IT/Abductor Stretch
  nk_002: 'stat_neck_002', // Upper trapezius stretch     → Levator/Upper-Trap Stretch
  nk_003: 'stat_neck_002', // Levator scapulae stretch    → Levator/Upper-Trap Stretch
  nk_005: 'stat_neck_001', // Neck lateral flexion        → Lateral Neck Stretch
  ub_002: 'stat_uback_002',// Thread the needle stretch   → Thread-the-Needle
  fb_001: 'stat_ham_003',  // Standing toe touch          → Single-Leg Toe-Touch (hamstring)
};

// Resolve a clinical exercise id → a single YouTube id for the active language.
// Order: explicit manifest entry (lang→en) → curated catalog twin (lang→en) → null.
// Accepts the manifest's [ids]/string shape AND the catalog's [{id,t,q}] shape.
// null/unknown → null, which the UI renders as "demo coming soon".
export function resolveClinicalVideo(id, lang = 'en') {
  if (!id) return null;
  const entry = CLINICAL_EXERCISE_VIDEOS[id];
  let pick = entry ? (entry[lang] || entry.en) : null;
  if (!pick) {
    const cat = CLINICAL_TO_STAT[id] ? RECOVERY_VIDEOS[CLINICAL_TO_STAT[id]] : null;
    pick = cat ? (cat[lang] || cat.en) : null;
  }
  if (Array.isArray(pick)) {
    const first = pick[0];
    return first ? (typeof first === 'string' ? first : (first.id || null)) : null;
  }
  return typeof pick === 'string' && pick ? pick : null;
}

// Coverage snapshot for ops/reporting: how many of the manifest ids resolve to a
// real video today. { mapped, total }.
export function clinicalVideoCoverage() {
  const ids = Object.keys(CLINICAL_EXERCISE_VIDEOS);
  return { mapped: ids.filter((id) => resolveClinicalVideo(id)).length, total: ids.length };
}
