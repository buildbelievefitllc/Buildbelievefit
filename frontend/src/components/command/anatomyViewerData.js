// src/components/command/anatomyViewerData.js
// ─────────────────────────────────────────────────────────────────────────────
// Anatomy Arena · 3D Biomechanical Viewer — trilingual manifest + joint map.
//
// Ported verbatim from the Gemini Spark 3D mockup. The CONTENT (biomechanics +
// OT-informed prehab) is authored EN·ES·PT; the R3F viewer + HUD read from here so
// language, joint data, and the CNS autoregulator share one source of truth.
//
//   ANATOMY_VIEWER_L10N[lang] = { cnsState, cnsInstruction, segments{ id → {…} } }
//   ANATOMY_JOINTS            = clickable joint nodes (id + 3D position + system)
//
// SCOPE (OT-informed, LOCKED on the UI): recovery mapping only — never diagnosis.

export const SEGMENT_IDS = ['lumbar', 'shoulder', 'hip', 'knee', 'ankle'];

// Interactive joint pivots — id, world position, and the system layer each sits
// within. These coordinates are anchored to the REAL Z-Anatomy mesh (meters,
// Y-up, ~1.70 m standing figure), derived from the GLB's own vertex bounding
// boxes rather than eyeballed onto the old procedural rig:
//   • knee     → centroid of Patella
//   • ankle    → centroid of Talus (talocrural mortise)
//   • hip      → top of Femur (femoral head, in the acetabulum)
//   • shoulder → top of Humerus (humeral head, at the glenohumeral joint)
//   • lumbar   → midline, just above the sacrum (L-spine block)
// Heights read true bottom-to-top: ankle 0.07 < knee 0.44 < hip 0.89 <
// lumbar 1.04 < shoulder 1.41. If the mesh is re-exported at a different scale,
// re-run `node scripts/extract-anatomy-joints.mjs` to regenerate these.
export const ANATOMY_JOINTS = [
  { id: 'lumbar', position: [0, 1.043, -0.069], system: 'skeletal' },
  { id: 'shoulder', position: [0.197, 1.405, -0.028], system: 'skeletal' },
  { id: 'hip', position: [-0.091, 0.885, -0.02], system: 'skeletal' },
  { id: 'knee', position: [-0.084, 0.443, 0.007], system: 'skeletal' },
  { id: 'ankle', position: [-0.075, 0.067, -0.037], system: 'skeletal' },
];

// ── System Directory · "Jump to Region" navigation targets ───────────────────
// Each region maps to (a) the joint node(s) it activates and its primary focus
// joint, and (b) a world-space camera focus box (center ± half-extents, meters)
// the viewport frames via drei <Bounds>. The focus boxes are derived from the
// real mesh extents (bbox 0.67 W × 1.70 H × 0.27 D, centred [0, 0.86, 0]) and the
// joint anchor heights, so a region "pans to" the right slab of the figure:
//   axial ≈ pelvis→skull · shoulder ≈ girdle+arms · pelvic ≈ hips · lower ≈ knees+ankles.
export const ANATOMY_REGIONS = [
  { id: 'axial',    label: 'Axial Skeleton — Skull · Spine · Ribcage', joints: ['lumbar'],          primary: 'lumbar',   focus: { center: [0, 1.28, 0], half: [0.30, 0.48, 0.22] } },
  { id: 'shoulder', label: 'Shoulder Girdle / Upper Body',             joints: ['shoulder'],        primary: 'shoulder', focus: { center: [0, 1.44, 0], half: [0.42, 0.26, 0.22] } },
  { id: 'pelvic',   label: 'Pelvic Girdle / Hip Complex',              joints: ['hip'],             primary: 'hip',      focus: { center: [0, 0.90, 0], half: [0.32, 0.22, 0.22] } },
  { id: 'lower',    label: 'Lower Body — Knee & Ankle Complexes',      joints: ['knee', 'ankle'],   primary: 'knee',     focus: { center: [-0.08, 0.27, 0], half: [0.22, 0.30, 0.16] } },
];

// Region record by id (null if unknown) — the viewer's single lookup point.
export function regionById(id) {
  return ANATOMY_REGIONS.find((r) => r.id === id) || null;
}

export const ANATOMY_VIEWER_L10N = {
  en: {
    cnsState: {
      optimal: 'Sovereign Optimum',
      moderate: 'CNS Volume Alert',
      fatigue: 'CNS Redline Override',
    },
    cnsInstruction: {
      optimal: 'CNS pathways fully restored. Axial spinal loading safe. Run prescribed training intensities.',
      moderate: 'Moderate CNS load detected. Reduce heavy sets by 20%. Swap out full axial loading exercises.',
      fatigue: 'High central fatigue. Reduce intensity by 50%. Focus on spinal decompression and unilateral cable work.',
    },
    segments: {
      lumbar: {
        category: 'Axial Column',
        title: 'Lumbar Spine Complex (L1-L5)',
        latin: 'Columna Vertebralis Lumbalis',
        desc: 'The primary structural base of axial spinal loading. Highly vulnerable to mechanical compression under massive loading (squats, deadlifts) when bracing or CNS pathways are compromised.',
        prehab: [
          'Swap out heavy axial compressive loads for Dumbbell Goblet Squats or Belt Squats to protect disk space.',
          'Inject 3 sets of 45-second Spine Hanging Decompressions prior to lower-body training cycles.',
          'Perform 3 sets of 12 Cat-Cow and Birddogs to restore neural lubrication to L1-L5 motor segments.',
        ],
      },
      shoulder: {
        category: 'Upper Joint Complex',
        title: 'Acromioclavicular (AC) Joint',
        latin: 'Articulatio Acromioclavicularis',
        desc: 'A common bottleneck for shoulder impingement and anterior instability in push/press protocols. Frequently irritated by unchecked range of motion during heavy barbell presses.',
        prehab: [
          'Substitute standard barbell benches with Dumbbell Floor Presses to restrict extension range and spare the AC Joint.',
          'Perform 3 sets of 15 Scapular Wall Slides to activate the Serratus Anterior and restore upper rotation mechanics.',
          'Integrate 3 sets of 15 Band Pull-Aparts to reinforce posterior glenohumeral stability.',
        ],
      },
      hip: {
        category: 'Lower Pivot Complex',
        title: 'Coxofemoral (Hip) Pivot',
        latin: 'Articulatio Coxae',
        desc: "The primary transfer engine of rotational force in athletic movement. Restrictions in internal rotation lead to compensatory lumbar flexion ('butt-wink') during squat depths.",
        prehab: [
          'Substitute heavy squats with Rear-Foot Elevated Split Squats to improve hip-hinge mobility safely.',
          'Incorporate 3 sets of 10 90/90 Hip Mobility Pivots to activate deep gluteal rotation pathways.',
          'Execute 3 sets of 12 Glute Bridges with a 2-second squeeze to lock the pelvis into optimal structural alignment.',
        ],
      },
      knee: {
        category: 'Lower Hinge Complex',
        title: 'Femorotibial Hinge (Knee)',
        latin: 'Articulatio Genus',
        desc: 'A pure hinge joint operating under high mechanical shear force. Patellar tracking is heavily dictated by unilateral quad balance (VMO) and ankle mobility.',
        prehab: [
          'Swap out heavy knee extensions for backwards Sled Pulls (100 meters) to increase blood flow and VMO tracking.',
          'Execute 3 sets of 15 Poliquin Step-Ups to specifically strengthen patellar ligament terminal tracking.',
          'Perform 3 sets of 12 Calf/Soleus stretches to relieve Achilles pull on the back joint chain.',
        ],
      },
      ankle: {
        category: 'Lower Mortise Complex',
        title: 'Talocrural (Ankle) Mortise',
        latin: 'Articulatio Talocruralis',
        desc: 'The biomechanical gatekeeper of deep squat depth. Restrictions in talar glide cause immediate forward knee translation and lumbar rounding.',
        prehab: [
          'Elevate heels by 1-2 inches using squat wedges or weight plates to compensate for talar glide blockages.',
          'Execute 3 sets of 15 Kettlebell Ankle Mobilizations to manually slide the talus backward under load.',
          'Integrate 3 sets of 15 Calf Raises with slow eccentric lowers to stretch myofascial Achilles sheaths.',
        ],
      },
    },
  },
  es: {
    cnsState: {
      optimal: 'Soberano Óptimo',
      moderate: 'Alerta de CNS de Volumen',
      fatigue: 'Alerta Roja de CNS',
    },
    cnsInstruction: {
      optimal: 'Canales de CNS completamente restaurados. Carga axial segura. Ejecute las intensidades prescritas.',
      moderate: 'Carga moderada detectada. Reduzca los conjuntos pesados en un 20%. Cambie ejercicios de carga axial.',
      fatigue: 'Alta fatiga central. Reduzca la intensidad en un 50%. Enfoque en descompresión espinal.',
    },
    segments: {
      lumbar: {
        category: 'Columna Axial',
        title: 'Columna Lumbar (L1-L5)',
        latin: 'Columna Vertebralis Lumbalis',
        desc: 'Base estructural primaria de carga axial. Altamente vulnerable a compresión mecánica bajo cargas pesadas (sentadillas, peso muerto) cuando el bracing o el CNS están fatigados.',
        prehab: [
          'Cambie sentadillas traseras por sentadillas Goblet o con cinturón para proteger el espacio discal.',
          'Inyecte 3 series de 45 segundos de descompresiones colgadas espinales antes de entrenar piernas.',
          'Ejecute 3 series de 12 Cat-Cow y Birddog para restaurar la lubricación neural en los segmentos L1-L5.',
        ],
      },
      shoulder: {
        category: 'Complejo Articular Superior',
        title: 'Articulación Acromioclavicular (AC)',
        latin: 'Articulatio Acromioclavicularis',
        desc: 'Punto crítico de pinzamiento de hombro e inestabilidad anterior en prensas de empuje. Se irrita frecuentemente por rangos excesivos de movimiento en barra.',
        prehab: [
          'Sustituya banca convencional por Prensa de Piso con mancuernas para limitar la extensión de hombros.',
          'Haga 3 series de 15 deslizamientos de pared escapulares para activar el serrato anterior.',
          'Integre 3 series de 15 tirones con banda para estabilizar el manguito rotador posterior.',
        ],
      },
      hip: {
        category: 'Complejo de Pivote Inferior',
        title: 'Pivote Coxofemoral (Cadera)',
        latin: 'Articulatio Coxae',
        desc: 'Motor principal de transferencia de fuerzas de rotación. Restricciones en rotación interna causan flexión lumbar compensatoria (butt-wink) en sentadillas.',
        prehab: [
          'Sustituya sentadillas pesadas por sentadillas divididas búlgaras para estabilizar la articulación.',
          'Incorpore 3 series de 10 pivotes de movilidad de cadera 90/90 para activar rotadores profundos.',
          'Haga 3 series de 12 puentes de glúteo con contracción de 2 segundos para fijar la pelvis.',
        ],
      },
      knee: {
        category: 'Complejo de Bisagra Inferior',
        title: 'Bisagra Femorotibial (Rodilla)',
        latin: 'Articulatio Genus',
        desc: 'Articulación de bisagra pura que opera bajo fuerzas de cizallamiento extremas. La trayectoria patelar está guiada por el cuádriceps (VMO).',
        prehab: [
          'Cambie extensiones pesadas por 100 metros de arrastre de trineo hacia atrás para lubricar el tendón.',
          'Haga 3 series de 15 Poliquin Step-Ups para fortalecer el ligamento patelar en trayectoria terminal.',
          'Incorpore 3 series de 12 estiramientos de sóleo y pantorrillas para liberar la tensión posterior.',
        ],
      },
      ankle: {
        category: 'Complejo de Mortaja Inferior',
        title: 'Mortaja Talocrural (Tobillo)',
        latin: 'Articulatio Talocruralis',
        desc: 'Controlador de la profundidad de sentadilla. Las restricciones del tobillo causan colapso de rodillas y redondeo lumbar.',
        prehab: [
          'Eleve los talones 1-2 pulgadas con cuñas de sentadilla para evitar limitaciones del astrágalo.',
          'Haga 3 series de 15 movilizaciones de tobillo con pesa rusa para desplazar el astrágalo hacia atrás.',
          'Haga 3 series de 15 elevaciones de talón con bajadas lentas para estirar la fascia aquilea.',
        ],
      },
    },
  },
  pt: {
    cnsState: {
      optimal: 'Soberano Ótimo',
      moderate: 'Alerta de CNS de Volume',
      fatigue: 'Alerta Vermelha de CNS',
    },
    cnsInstruction: {
      optimal: 'Canais de CNS totalmente restaurados. Carga axial segura. Execute as intensidades prescritas.',
      moderate: 'Carga moderada detectada. Reduza os conjuntos pesados em 20%. Mude exercícios de carga axial.',
      fatigue: 'Alta fadiga central. Reduza a intensidade em 50%. Foco em descompressão espinal.',
    },
    segments: {
      lumbar: {
        category: 'Coluna Axial',
        title: 'Coluna Lombar (L1-L5)',
        latin: 'Columna Vertebralis Lumbalis',
        desc: 'Base estrutural primária de carga axial. Altamente vulnerável a compressão mecânica sob cargas pesadas (agachamentos, levantamento terra) quando o bracing ou o CNS estão fadigados.',
        prehab: [
          'Mude agachamentos traseiros por agachamentos Goblet ou com cinto para proteger o espaço discal.',
          'Injete 3 séries de 45 segundos de descompressões colunares espinais antes de treinar pernas.',
          'Execute 3 séries de 12 Cat-Cow e Birddog para restaurar a lubrificação neural nos segmentos L1-L5.',
        ],
      },
      shoulder: {
        category: 'Complexo Articular Superior',
        title: 'Articulação Acromioclavicular (AC)',
        latin: 'Articulatio Acromioclavicularis',
        desc: 'Ponto crítico de pinçamento do ombro e instabilidade anterior em prensas de empuxo. Irrita-se frequentemente por limites excessivos de amplitude em barra.',
        prehab: [
          'Substitua supino convencional por Supino de Chão com halteres para limitar a extensão do ombro.',
          'Faça 3 séries de 15 deslizamentos de parede escapulares para ativar o serrátil anterior.',
          'Integre 3 séries de 15 puxadas com banda para estabilizar o manguito rotador posterior.',
        ],
      },
      hip: {
        category: 'Complexo de Pivô Inferior',
        title: 'Pivô Coxofemural (Quadril)',
        latin: 'Articulatio Coxae',
        desc: 'Motor principal de transferência de forças de rotação. Restrições na rotação interna causam flexão lombar compensatória (butt-wink) no agachamento.',
        prehab: [
          'Substitua agachamentos pesados por agachamentos búlgaros divididos para estabilizar a articulação.',
          'Incorpore 3 séries de 10 pivôs de mobilidade de quadril 90/90 para ativar rotadores profundos.',
          'Faça 3 séries de 12 pontes de glúteo com contração de 2 segundos para alinhar a pelve.',
        ],
      },
      knee: {
        category: 'Complexo de Dobradiça Inferior',
        title: 'Dobradiça Femorotibial (Joelho)',
        latin: 'Articulatio Genus',
        desc: 'Articulação de dobradiça pura que opera sob forças de cisalhamento extremas. O alinhamento patelar é guiado pelo quadríceps (VMO).',
        prehab: [
          'Mude extensões pesadas por 100 metros de arrasto de trenó de costas para lubrificar o tendão.',
          'Faça 3 séries de 15 Poliquin Step-Ups para fortalecer o ligamento patelar no alinhamento terminal.',
          'Incorpore 3 séries de 12 alongamentos de sóleo e panturrilhas para liberar a tensão posterior.',
        ],
      },
      ankle: {
        category: 'Complexo de Alinhamento Inferior',
        title: 'Tornozelo (Talocrural)',
        latin: 'Articulatio Talocruralis',
        desc: 'Controlador da profundidade do agachamento. As restrições do tornozelo causam colapso de joelhos e flexão lombar.',
        prehab: [
          'Eleve os calcanhares 1-2 polegadas com blocos de agachamento para evitar limitações do tálus.',
          'Faça 3 séries de 15 mobilizações de tornozelo com kettlebell para deslocar o tálus para trás.',
          'Faça 3 séries de 15 elevações de calcanhar com descidas lentas para alongar a fáscia aquilea.',
        ],
      },
    },
  },
};

// Localized segment record for a joint id (falls back to EN).
export function localizedSegment(lang, id) {
  const L = ANATOMY_VIEWER_L10N[lang] || ANATOMY_VIEWER_L10N.en;
  return L.segments[id] || null;
}
