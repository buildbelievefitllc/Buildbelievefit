// src/components/command/anatomyData.js
// ─────────────────────────────────────────────────────────────────────────────
// Coach Lab · Kinesiology Lab — ANATOMY ARENA data (Exploded Regional Zoom).
//
// The old full-body ellipse map put ~16 overlapping touch boxes on one tiny
// figure — impossible to tap a specific muscle. This replaces it with a
// TRAINING SPLIT GATE + REGIONAL ZOOM:
//
//   Tier 1  — the player picks a lane (PUSH · PULL · LEGS). Everything outside
//             that lane is hidden, clearing ~70% of the on-screen clutter.
//   Tier 2  — each lane loads its OWN zoomed regional canvas (a tuned viewBox so
//             the muscles fill the frame) where every target is a distinct,
//             NON-OVERLAPPING vector <path>. No shape shares fill with a neighbor,
//             so a tap registers on exactly the muscle clicked (no boundary bleed).
//
// Muscle ids reuse the text-deck concept ids where a group maps 1:1 (m_lats,
// m_erector, m_glutemax, m_glutemed, m_gastroc, m_tibant, m_antdelt) so a correct
// locate reinforces the SAME 1-5 SRS box; head-level targets add new ids. The
// union of every id feeds TOTAL_CONCEPTS in kinesiologyData.js.
//
// Shape of a lane:
//   { id, viewBox, head?:{cx,cy,r}, silhouette:[dString], muscles:[Muscle] }
// Shape of a muscle:
//   { id, name, action, why, l:[labelX,labelY], paths:[dString, …] }   // paths
//   are one (central) or two (bilateral) non-overlapping polygons.

// Realistic-asset layer (optional). Drop a high-fidelity muscle map (WebP/AVIF)
// into the public `anatomy-assets` bucket, then set a lane's `imageUrl` to
// ANATOMY_ASSET_BASE + '<file>' — AnatomyBody paints it as the base layer under
// the interactive SVG hit-map, cross-fading in over the vector placeholder. Leave
// `imageUrl` null (the default) and the game renders the pure vector map, exactly
// as before. Upload objects with cache-control:31536000 for a 1-yr browser cache.
export const ANATOMY_ASSET_BASE = 'https://ihclbceghxpuawymlvgi.supabase.co/storage/v1/object/public/anatomy-assets/';

export const TRAINING_SPLITS = {
  // ── PUSH · anterior upper body (chest · shoulders · triceps) ───────────────
  push: {
    id: 'push',
    viewBox: '0 0 240 272',
    imageUrl: null,   // e.g. ANATOMY_ASSET_BASE + 'push-anterior.webp'
    head: { cx: 120, cy: 32, r: 19 },
    silhouette: [
      'M108,48 L132,48 L132,68 L108,68 Z',                                  // neck
      'M70,72 Q120,62 170,72 L160,150 L150,250 L90,250 L80,150 Z',          // torso
      'M70,80 L46,92 L42,196 L60,200 L66,150 Z',                            // L arm
      'M170,80 L194,92 L198,196 L180,200 L174,150 Z',                       // R arm
    ],
    muscles: [
      { id: 'm_antdelt', name: 'Anterior Deltoid', action: 'Shoulder flexion', l: [66, 96],
        why: 'The anterior deltoid flexes and internally rotates the shoulder — the front-press cap.',
        paths: ['M62,78 Q48,88 52,112 Q70,110 80,90 Q76,76 62,78 Z',
                'M178,78 Q192,88 188,112 Q170,110 160,90 Q164,76 178,78 Z'] },
      { id: 'm_pec_clav', name: 'Pectoralis Major — Clavicular Head', action: 'Shoulder flexion & horizontal adduction', l: [120, 90],
        why: 'The clavicular (upper) head of the pec drives shoulder flexion and incline-press power.',
        paths: ['M118,84 L88,82 Q82,90 86,100 L118,100 Z',
                'M122,84 L152,82 Q158,90 154,100 L122,100 Z'] },
      { id: 'm_pec_stern', name: 'Pectoralis Major — Sternal Head', action: 'Shoulder horizontal adduction', l: [120, 120],
        why: 'The sternocostal (lower) head is the mass of the chest — horizontal adduction, the flat/decline press.',
        paths: ['M118,104 L86,104 Q86,126 106,134 Q116,130 118,116 Z',
                'M122,104 L154,104 Q154,126 134,134 Q124,130 122,116 Z'] },
      { id: 'm_serratus', name: 'Serratus Anterior', action: 'Scapular protraction & upward rotation', l: [120, 154],
        why: 'The serratus anterior protracts and upwardly rotates the scapula — the "boxer\'s muscle".',
        paths: ['M88,138 L100,142 L98,150 L102,158 L94,164 L88,160 L90,148 Z',
                'M152,138 L140,142 L142,150 L138,158 L146,164 L152,160 L150,148 Z'] },
      { id: 'm_tri_lat', name: 'Triceps — Lateral Head', action: 'Elbow extension', l: [51, 148],
        why: 'The lateral head of the triceps is the horseshoe on the outer arm — elbow extension, the lockout.',
        paths: ['M48,116 Q42,146 48,176 Q58,174 60,146 Q58,120 48,116 Z',
                'M192,116 Q198,146 192,176 Q182,174 180,146 Q182,120 192,116 Z'] },
      { id: 'm_rectus', name: 'Rectus Abdominis', action: 'Trunk flexion', l: [120, 182],
        why: 'The rectus abdominis flexes the trunk and resists extension — the braced press platform.',
        paths: ['M108,142 Q104,180 110,216 L130,216 Q136,180 132,142 Q120,138 108,142 Z'] },
    ],
  },

  // ── PULL · posterior upper body (back · rear delts · traps) ────────────────
  pull: {
    id: 'pull',
    viewBox: '0 0 240 272',
    imageUrl: null,   // e.g. ANATOMY_ASSET_BASE + 'pull-posterior.webp'
    head: { cx: 120, cy: 32, r: 19 },
    silhouette: [
      'M108,48 L132,48 L132,68 L108,68 Z',
      'M70,72 Q120,62 170,72 L160,150 L150,250 L90,250 L80,150 Z',
      'M70,80 L46,92 L42,196 L60,200 L66,150 Z',
      'M170,80 L194,92 L198,196 L180,200 L174,150 Z',
    ],
    muscles: [
      { id: 'm_trap_up', name: 'Trapezius — Upper', action: 'Scapular elevation', l: [120, 80],
        why: 'The upper trapezius elevates and upwardly rotates the scapula — the shrug and the yoke.',
        paths: ['M120,64 L86,84 Q82,92 92,92 L120,88 L148,92 Q158,92 154,84 Z'] },
      { id: 'm_trap_low', name: 'Trapezius — Middle & Lower', action: 'Scapular retraction & depression', l: [120, 132],
        why: 'The mid/lower trap retracts and depresses the scapula — postural control and the row finish.',
        paths: ['M120,96 L102,114 L120,158 L138,114 Z'] },
      { id: 'm_postdelt', name: 'Posterior Deltoid', action: 'Shoulder horizontal abduction', l: [66, 98],
        why: 'The rear delt horizontally abducts and externally rotates the shoulder — the reverse-fly cap.',
        paths: ['M62,80 Q48,90 52,112 Q70,110 80,92 Q76,78 62,80 Z',
                'M178,80 Q192,90 188,112 Q170,110 160,92 Q164,78 178,80 Z'] },
      { id: 'm_lats', name: 'Latissimus Dorsi', action: 'Shoulder adduction & extension', l: [98, 158],
        why: 'The lats adduct, extend, and internally rotate the humerus — the pull-down and the taper.',
        paths: ['M96,124 L84,132 Q80,166 98,184 L114,172 L110,128 Z',
                'M144,124 L156,132 Q160,166 142,184 L126,172 L130,128 Z'] },
      { id: 'm_teres', name: 'Teres Major', action: 'Shoulder adduction & internal rotation', l: [86, 116],
        why: 'Teres major — the "lat\'s little helper" — adducts and internally rotates the humerus.',
        paths: ['M84,106 Q76,112 80,122 Q92,120 94,110 Z',
                'M156,106 Q164,112 160,122 Q148,120 146,110 Z'] },
      { id: 'm_erector', name: 'Erector Spinae', action: 'Spinal extension', l: [120, 192],
        why: 'The erector spinae extends the spine and resists flexion — the braced deadlift column.',
        paths: ['M112,162 L120,162 L118,216 L110,216 Z',
                'M122,162 L130,162 L132,216 L124,216 Z'] },
    ],
  },

  // ── LEGS · lower body, anterior (left leg) + posterior (right leg) ─────────
  // A textbook-style dual panel: the left figure is the ANTERIOR view (quads,
  // shin, adductors), the right figure is the POSTERIOR view (glutes, hams,
  // calf). One clean canvas shows every leg muscle without a front/back toggle.
  legs: {
    id: 'legs',
    viewBox: '0 0 260 320',
    imageUrl: null,   // e.g. ANATOMY_ASSET_BASE + 'legs-dual.webp'
    silhouette: [
      'M44,26 L216,26 L206,72 L54,72 Z',                                    // pelvis
      'M54,68 L108,68 L100,182 L92,306 L66,306 L60,182 Z',                  // L leg (anterior)
      'M152,68 L206,68 L200,182 L188,306 L168,306 L162,182 Z',              // R leg (posterior)
    ],
    muscles: [
      // Left leg — ANTERIOR
      { id: 'm_rectus_fem', name: 'Rectus Femoris', action: 'Knee extension & hip flexion', l: [82, 122],
        why: 'The rectus femoris is the central quad — it crosses both joints: knee extension AND hip flexion.',
        paths: ['M80,78 Q72,124 78,168 Q86,166 90,124 Q88,80 80,78 Z'] },
      { id: 'm_vas_lat', name: 'Vastus Lateralis', action: 'Knee extension', l: [98, 126],
        why: 'The vastus lateralis is the outer quad sweep — pure knee extension, the teardrop\'s outer wall.',
        paths: ['M94,88 Q104,124 96,166 Q90,126 92,90 Z'] },
      { id: 'm_vas_med', name: 'Vastus Medialis', action: 'Knee extension (terminal)', l: [66, 154],
        why: 'The vastus medialis (the "teardrop") extends the knee and locks out the final degrees.',
        paths: ['M70,134 Q62,152 70,172 Q80,164 76,144 Z'] },
      { id: 'm_adductors', name: 'Adductor Group', action: 'Hip adduction', l: [62, 104],
        why: 'The adductors pull the thigh toward the midline — inner-thigh stability in the squat and split.',
        paths: ['M68,80 Q58,104 66,128 Q78,120 74,98 Z'] },
      { id: 'm_tibant', name: 'Tibialis Anterior', action: 'Dorsiflexion', l: [80, 250],
        why: 'The tibialis anterior dorsiflexes and inverts the foot — the shin, the anti-shin-splint muscle.',
        paths: ['M78,198 Q72,244 76,292 Q86,290 86,244 Q86,202 78,198 Z'] },
      // Right leg — POSTERIOR
      { id: 'm_glutemax', name: 'Gluteus Maximus', action: 'Hip extension', l: [178, 94],
        why: 'The glute max is the prime hip extensor and external rotator — the hinge and the sprint driver.',
        paths: ['M164,76 Q156,94 166,112 Q188,112 196,94 Q190,76 180,76 Z'] },
      { id: 'm_glutemed', name: 'Gluteus Medius', action: 'Hip abduction', l: [204, 86],
        why: 'Glute med abducts the hip and stabilizes the pelvis in single-leg stance — the anti-Trendelenburg.',
        paths: ['M196,70 Q210,82 204,100 Q194,94 192,76 Z'] },
      { id: 'm_biceps_fem', name: 'Biceps Femoris', action: 'Knee flexion & hip extension', l: [192, 154],
        why: 'The biceps femoris is the OUTER hamstring — knee flexion and hip extension, the sprint hinge.',
        paths: ['M190,120 Q198,152 188,186 Q182,152 184,122 Z'] },
      { id: 'm_semitend', name: 'Semitendinosus', action: 'Knee flexion & hip extension', l: [168, 154],
        why: 'The semitendinosus is the INNER hamstring — it flexes the knee and internally rotates the tibia.',
        paths: ['M170,120 Q162,152 172,188 Q180,152 178,122 Z'] },
      { id: 'm_gastroc', name: 'Gastrocnemius', action: 'Plantarflexion', l: [180, 228],
        why: 'The gastrocnemius (its two heads) plantarflexes the ankle and assists knee flexion — the calf.',
        paths: ['M172,200 Q168,228 174,254 Q182,250 182,224 Z',
                'M186,200 Q192,228 186,254 Q180,250 180,224 Z'] },
    ],
  },
};

export const SPLIT_ORDER = ['push', 'pull', 'legs'];

// Every distinct muscle id across all lanes — feeds the TOTAL_CONCEPTS union.
export const ANATOMY_IDS = SPLIT_ORDER.flatMap((k) => TRAINING_SPLITS[k].muscles.map((m) => m.id));

// Realistic base-image URLs across all lanes (empty until assets are dropped in) —
// used by the gate preloader to warm the browser cache before a lane is chosen.
export const ANATOMY_IMAGE_URLS = SPLIT_ORDER
  .map((k) => TRAINING_SPLITS[k].imageUrl)
  .filter(Boolean);
