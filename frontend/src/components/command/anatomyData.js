// src/components/command/anatomyData.js
// ─────────────────────────────────────────────────────────────────────────────
// Coach Lab · Kinesiology Lab — THE ANATOMY ARENA data.
//
// 16 muscle groups laid onto a stylized front/back mannequin (viewBox 220×460,
// centered at x=110). Each region is one or two symmetric ellipses (a natural
// muscle-belly shape) placed on the figure so the player can TAP the named
// muscle — an immersive "find it on the body" drill.
//
// SHARED MASTERY: ids REUSE the Match-Madness concept ids where a muscle maps
// 1:1 (m_biceps, m_lats, …) so tapping it correctly reinforces the SAME 1-5 SRS
// box the text deck uses; five anatomy-only groups add new ids. The union feeds
// TOTAL_CONCEPTS in kinesiologyData.js.
//
// { id, name, view:'front'|'back', action, why, shapes:[{cx,cy,rx,ry,rot?}] }

export const ANATOMY_MUSCLES = [
  // ── FRONT ──────────────────────────────────────────────────────────────────
  { id: 'm_antdelt', name: 'Deltoids', view: 'front', action: 'Shoulder flexion & abduction',
    why: 'The deltoid caps the shoulder — its anterior fibers flex, lateral fibers abduct the arm.',
    shapes: [{ cx: 74, cy: 100, rx: 14, ry: 13 }, { cx: 146, cy: 100, rx: 14, ry: 13 }] },
  { id: 'm_pecmaj', name: 'Pectoralis Major', view: 'front', action: 'Shoulder horizontal adduction',
    why: 'Pec major horizontally adducts, flexes, and internally rotates the shoulder — the press mover.',
    shapes: [{ cx: 92, cy: 117, rx: 17, ry: 12, rot: -8 }, { cx: 128, cy: 117, rx: 17, ry: 12, rot: 8 }] },
  { id: 'm_biceps', name: 'Biceps Brachii', view: 'front', action: 'Elbow flexion & forearm supination',
    why: 'The biceps flexes the elbow and supinates the forearm — the curl mover.',
    shapes: [{ cx: 66, cy: 150, rx: 9, ry: 24, rot: -7 }, { cx: 154, cy: 150, rx: 9, ry: 24, rot: 7 }] },
  { id: 'm_forearm', name: 'Forearm Flexors', view: 'front', action: 'Wrist & finger flexion',
    why: 'The forearm flexors curl the wrist and grip — trained by every pull and loaded carry.',
    shapes: [{ cx: 59, cy: 212, rx: 8, ry: 26, rot: -9 }, { cx: 161, cy: 212, rx: 8, ry: 26, rot: 9 }] },
  { id: 'm_rectus', name: 'Rectus Abdominis', view: 'front', action: 'Spinal flexion',
    why: 'The rectus abdominis flexes the trunk and resists extension — the anti-extension core.',
    shapes: [{ cx: 110, cy: 172, rx: 15, ry: 36 }] },
  { id: 'm_obliques', name: 'Obliques', view: 'front', action: 'Trunk rotation & lateral flexion',
    why: 'The obliques rotate and side-bend the trunk — and resist rotation (anti-rotation core).',
    shapes: [{ cx: 89, cy: 182, rx: 7, ry: 24, rot: 8 }, { cx: 131, cy: 182, rx: 7, ry: 24, rot: -8 }] },
  { id: 'm_quads', name: 'Quadriceps', view: 'front', action: 'Knee extension',
    why: 'The quads extend the knee; the rectus femoris also flexes the hip.',
    shapes: [{ cx: 93, cy: 300, rx: 15, ry: 42, rot: -2 }, { cx: 127, cy: 300, rx: 15, ry: 42, rot: 2 }] },
  { id: 'm_tibant', name: 'Tibialis Anterior', view: 'front', action: 'Dorsiflexion',
    why: 'The tibialis anterior dorsiflexes and inverts the foot — the shin mover.',
    shapes: [{ cx: 90, cy: 392, rx: 7, ry: 30, rot: -2 }, { cx: 130, cy: 392, rx: 7, ry: 30, rot: 2 }] },
  // ── BACK ───────────────────────────────────────────────────────────────────
  { id: 'm_traps', name: 'Trapezius', view: 'back', action: 'Scapular elevation, retraction & depression',
    why: 'The trapezius moves and stabilizes the scapula across its upper, middle, and lower fibers.',
    shapes: [{ cx: 110, cy: 105, rx: 27, ry: 20 }] },
  { id: 'm_triceps', name: 'Triceps Brachii', view: 'back', action: 'Elbow extension',
    why: 'The triceps brachii extends the elbow — the prime mover of every press.',
    shapes: [{ cx: 66, cy: 150, rx: 9, ry: 24, rot: -7 }, { cx: 154, cy: 150, rx: 9, ry: 24, rot: 7 }] },
  { id: 'm_lats', name: 'Latissimus Dorsi', view: 'back', action: 'Shoulder adduction & extension',
    why: 'The lats adduct, extend, and internally rotate the humerus — the pull-down mover.',
    shapes: [{ cx: 90, cy: 152, rx: 16, ry: 30, rot: 15 }, { cx: 130, cy: 152, rx: 16, ry: 30, rot: -15 }] },
  { id: 'm_erector', name: 'Erector Spinae', view: 'back', action: 'Spinal extension',
    why: 'The erector spinae extends the spine and resists flexion — the braced-back column.',
    shapes: [{ cx: 110, cy: 196, rx: 10, ry: 34 }] },
  { id: 'm_glutemed', name: 'Gluteus Medius', view: 'back', action: 'Hip abduction',
    why: 'Glute med abducts the hip and stabilizes the pelvis in single-leg stance.',
    shapes: [{ cx: 86, cy: 238, rx: 11, ry: 12 }, { cx: 134, cy: 238, rx: 11, ry: 12 }] },
  { id: 'm_glutemax', name: 'Gluteus Maximus', view: 'back', action: 'Hip extension',
    why: 'The glute max is the prime hip extensor and external rotator.',
    shapes: [{ cx: 95, cy: 259, rx: 16, ry: 18 }, { cx: 125, cy: 259, rx: 16, ry: 18 }] },
  { id: 'm_hamstrings', name: 'Hamstrings', view: 'back', action: 'Knee flexion & hip extension',
    why: 'The hamstrings flex the knee and assist hip extension — the hinge mover.',
    shapes: [{ cx: 93, cy: 305, rx: 14, ry: 40, rot: -2 }, { cx: 127, cy: 305, rx: 14, ry: 40, rot: 2 }] },
  { id: 'm_gastroc', name: 'Gastrocnemius', view: 'back', action: 'Plantarflexion',
    why: 'The gastrocnemius plantarflexes the ankle and assists knee flexion — the calf mover.',
    shapes: [{ cx: 92, cy: 388, rx: 9, ry: 30, rot: -2 }, { cx: 128, cy: 388, rx: 9, ry: 30, rot: 2 }] },
];

export const ANATOMY_IDS = ANATOMY_MUSCLES.map((m) => m.id);
