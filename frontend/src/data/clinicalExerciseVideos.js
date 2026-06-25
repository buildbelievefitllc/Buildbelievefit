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
  sh_001: null, // Resistance band shoulder strength
  sh_002: null, // Strength exercises for shoulder pain
  sh_003: null, // Wall slides for scapular mobility
  sh_004: null, // Isometric shoulder external rotation
  sh_005: null, // Isometric shoulder internal rotation
  sh_006: null, // Doorway pectoral stretch
  sh_007: null, // Sleeper stretch
  sh_008: null, // Cross-body shoulder stretch
  sh_009: null, // Prone I-Y-T raises
  sh_010: null, // Pendulum arm swings
  sh_011: null, // Scapular retractions (seated)
  sh_012: null, // Resistance band pull-aparts

  // ── lower_body ───────────────────────────────────────────────────────────────
  lb_001: null, // Quick lower body reset
  lb_002: null, // Seated lower body stretch
  lb_003: null, // Low back and hip pain relief
  lb_004: null, // Supine piriformis stretch
  lb_005: null, // Kneeling hip flexor stretch
  lb_006: null, // Cat-cow spinal mobility
  lb_007: null, // Child's pose lumbar stretch
  lb_008: null, // Supine pelvic tilts
  lb_009: null, // Bird-dog core stability
  lb_010: null, // Dead bug progression
  lb_011: null, // Prone press-up (Cobra)
  lb_012: null, // Side-lying hip abduction
  lb_013: null, // Side-lying hip adduction
  lb_014: null, // Quadruped fire hydrants
  lb_015: null, // Seated lumbar rotation
  lb_016: null, // Standing hamstring stretch

  // ── knee ──────────────────────────────────────────────────────────────────────
  kn_001: null, // Supine straight leg raise
  kn_002: null, // Short arc quadriceps extension
  kn_003: null, // Isometric wall sit holds
  kn_004: null, // Standing hamstring curl
  kn_005: null, // Side-lying clamshells
  kn_006: null, // Low impact step-ups
  kn_007: null, // Standing calf raises
  kn_008: null, // Supine heel slides
  kn_009: null, // Standing quad stretch
  kn_010: null, // Seated hamstring stretch
  kn_011: null, // Standing IT band stretch
  kn_012: null, // Supine glute bridge
  kn_013: null, // Lateral band walks
  kn_014: null, // Terminal knee extension (banded)
  kn_015: null, // Seated patellar mobilization

  // ── neck ──────────────────────────────────────────────────────────────────────
  nk_001: null, // Seated cervical retraction (chin tucks)
  nk_002: null, // Upper trapezius stretch
  nk_003: null, // Levator scapulae stretch
  nk_004: null, // Slow neck rotations
  nk_005: null, // Neck lateral flexion
  nk_006: null, // Isometric neck flexion (hand resistance)
  nk_007: null, // Isometric neck extension
  nk_008: null, // Supine chin tucks
  nk_009: null, // Seated scalene stretch
  nk_010: null, // Gentle half neck rolls

  // ── upper_body ─────────────────────────────────────────────────────────────────
  ub_001: null, // Thoracic extension on foam roller
  ub_002: null, // Thread the needle stretch
  ub_003: null, // Seated resistance band rows
  ub_004: null, // Standing wall push-ups
  ub_005: null, // Resistance band biceps curl
  ub_006: null, // Resistance band triceps extension
  ub_007: null, // Wrist flexor stretch
  ub_008: null, // Wrist extensor stretch
  ub_009: null, // Forearm pronation and supination
  ub_010: null, // Side-lying open book stretch

  // ── full_body ──────────────────────────────────────────────────────────────────
  fb_001: null, // Standing toe touch progression
  fb_002: null, // Walkouts (inchworms)
  fb_003: null, // Low impact jumping jacks
  fb_004: null, // Bodyweight squat to stand
  fb_005: null, // Forward lunge with torso twist
  fb_006: null, // High knees marching in place
  fb_007: null, // Standing torso twists
  fb_008: null, // Standing side bend reach
  fb_009: null, // Modified bear crawl hold
};

// Resolve a clinical exercise id → a single YouTube id for the active language
// (lang → en → null). Accepts the value as a [ids] array (best-first) or a bare
// string. null/unknown → null, which the UI renders as "demo coming soon".
export function resolveClinicalVideo(id, lang = 'en') {
  const entry = id ? CLINICAL_EXERCISE_VIDEOS[id] : null;
  if (!entry) return null;
  const pick = entry[lang] || entry.en || null;
  if (Array.isArray(pick)) return pick.length ? pick[0] : null;
  return typeof pick === 'string' && pick ? pick : null;
}

// Coverage snapshot for ops/reporting: how many of the manifest ids resolve to a
// real video today. { mapped, total }.
export function clinicalVideoCoverage() {
  const ids = Object.keys(CLINICAL_EXERCISE_VIDEOS);
  return { mapped: ids.filter((id) => resolveClinicalVideo(id)).length, total: ids.length };
}
