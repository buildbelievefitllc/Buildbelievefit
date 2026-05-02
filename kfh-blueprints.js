// ═══════════════════════════════════════════════════════════════
// KFH-BLUEPRINTS.JS — BBF Production Hologram Registry
// Sovereign Gold Standard — Phase 12 Full Articulation
//
// Holds the full Phase 12 Blueprints (joints / bones / equipment /
// kineticPath / forms / animation) and registers them with
// BBF_KFH_CATALOG via the transpiler at script load. Each Blueprint
// arrives fully populated trilingually (en/es/pt) — translation pass
// is performed during the transpile step per War Room policy.
//
// Add new Blueprints by appending to the array at the bottom of this
// file. Each entry can reuse STD_JOINT_SPEC / STD_BONES (the locked
// MediaPipe Pose topology) unless the exercise legitimately needs
// custom landmarks (face, hands, feet — disabled by default).
// ═══════════════════════════════════════════════════════════════

(function () {
  'use strict';
  if (typeof BBF_KFH_CATALOG === 'undefined' || !BBF_KFH_CATALOG.registerBlueprint) {
    console.warn('[KFH_BLUEPRINTS] catalog unavailable — skipping registrations');
    return;
  }

  // ─── STANDARD MEDIAPIPE POSE TOPOLOGY ────────────────────
  // 13-landmark sagittal skeleton. Mediapipe indices reference the
  // canonical Mediapipe Pose 33-landmark output; the normalizer
  // (next sprint) will use these to map raw mocap exports.
  var STD_JOINT_SPEC = {
    head:       { r: 11,  joint: null,       mediapipe: 0  },
    shoulder_l: { r: 4.2, joint: 'shoulder', mediapipe: 11 },
    shoulder_r: { r: 4.2, joint: 'shoulder', mediapipe: 12 },
    elbow_l:    { r: 3.6, joint: 'elbow',    mediapipe: 13 },
    elbow_r:    { r: 3.6, joint: 'elbow',    mediapipe: 14 },
    wrist_l:    { r: 3.4, joint: 'wrist',    mediapipe: 15 },
    wrist_r:    { r: 3.4, joint: 'wrist',    mediapipe: 16 },
    hip_l:      { r: 3.4, joint: 'hip',      mediapipe: 23 },
    hip_r:      { r: 3.4, joint: 'hip',      mediapipe: 24 },
    knee_l:     { r: 3.4, joint: 'knee',     mediapipe: 25 },
    knee_r:     { r: 3.4, joint: 'knee',     mediapipe: 26 },
    ankle_l:    { r: 3,   joint: null,       mediapipe: 27 },
    ankle_r:    { r: 3,   joint: null,       mediapipe: 28 }
  };
  var STD_BONES = [
    ['head','shoulder_l'],   ['head','shoulder_r'],
    ['shoulder_l','shoulder_r'],
    ['shoulder_l','elbow_l'], ['elbow_l','wrist_l'],
    ['shoulder_r','elbow_r'], ['elbow_r','wrist_r'],
    ['shoulder_l','hip_l'],   ['shoulder_r','hip_r'],
    ['hip_l','hip_r'],
    ['hip_l','knee_l'], ['knee_l','ankle_l'],
    ['hip_r','knee_r'], ['knee_r','ankle_r']
  ];

  // ─── BARBELL BACK SQUAT (FLAGSHIP V2) ────────────────────
  var BARBELL_BACK_SQUAT = {
    id: 'barbell_back_squat',
    displayName: 'Barbell Back Squat',
    aliases: ['back squat', 'squat', 'barbell squat'],

    title: {
      en: 'Clinical Protocol: Barbell Back Squat',
      es: 'Protocolo Clínico: Sentadilla con Barra',
      pt: 'Protocolo Clínico: Agachamento com Barra'
    },
    subtitle: {
      en: 'Sagittal Plane · Barbell · Sovereign Rig',
      es: 'Plano Sagital · Barra · Equipo Soberano',
      pt: 'Plano Sagital · Barra · Equipamento Soberano'
    },
    muscleTarget: {
      en: 'Primary: Quadriceps, Gluteus Maximus. Secondary: Hamstrings, Adductor Magnus, Erector Spinae, Core Stabilizers.',
      es: 'Primarios: Cuádriceps, Glúteo Mayor. Secundarios: Isquiotibiales, Aductor Mayor, Erectores Espinales, Estabilizadores del Core.',
      pt: 'Primários: Quadríceps, Glúteo Máximo. Secundários: Isquiotibiais, Adutor Magno, Eretores da Espinha, Estabilizadores do Core.'
    },
    clinicalNotes: {
      en: 'Execution demands active intra-abdominal pressure to stabilize the lumbar spine and maintain a rigid torso throughout the movement. The kinetic chain relies on synchronous hip, knee, and ankle flexion, keeping the barbell\'s center of mass directly over the mid-foot. Optimal joint articulation is achieved by allowing the knees to track naturally in line with the toes while strictly preventing valgus collapse.',
      es: 'La ejecución exige presión intraabdominal activa para estabilizar la columna lumbar y mantener un torso rígido durante todo el movimiento. La cadena cinética depende de una flexión sincronizada de cadera, rodilla y tobillo, manteniendo el centro de masa de la barra directamente sobre la planta media del pie. La articulación óptima se logra dejando que las rodillas sigan naturalmente la línea de los dedos del pie y evitando estrictamente el colapso en valgo.',
      pt: 'A execução exige pressão intra-abdominal ativa para estabilizar a coluna lombar e manter um torso rígido durante todo o movimento. A cadeia cinética depende da flexão sincronizada de quadril, joelho e tornozelo, mantendo o centro de massa da barra diretamente sobre o meio do pé. A articulação ótima é alcançada permitindo que os joelhos sigam naturalmente a linha dos dedos do pé e prevenindo estritamente o colapso em valgo.'
    },
    svgTitle: {
      en: 'Barbell Back Squat Sagittal Wireframe',
      es: 'Wireframe Sagital de Sentadilla con Barra',
      pt: 'Wireframe Sagital do Agachamento com Barra'
    },

    plane: 'sagittal',
    facing: 'right',
    ground: { y: 0.92 },

    jointSpec: STD_JOINT_SPEC,
    bones:     STD_BONES,

    animation: {
      duration_ms: 3500,
      loop: true,
      direction: 'normal',
      easing: 'ease-in-out',
      phases: [
        { id: 'eccentric', start_pct: 0, end_pct: 40, easing: 'ease-out',
          label: { en: 'Eccentric · Loaded Descent',
                   es: 'Excéntrica · Descenso con Carga',
                   pt: 'Excêntrica · Descida Carregada' },
          cue:   { en: 'Hinge at the hips and lower your center of mass with strict, deliberate control until your hips drop below the knee crease.',
                   es: 'Bisagra en las caderas y baja el centro de masa con control estricto y deliberado hasta que las caderas estén por debajo del pliegue de la rodilla.',
                   pt: 'Faça a dobradiça nos quadris e abaixe o centro de massa com controle estrito e deliberado até que os quadris fiquem abaixo da dobra do joelho.' } },
        { id: 'isometric', start_pct: 40, end_pct: 50, easing: 'linear',
          label: { en: 'Isometric · Bottom Hold',
                   es: 'Isométrica · Pausa Inferior',
                   pt: 'Isométrica · Pausa no Fundo' },
          cue:   { en: 'Hold the bottom position motionless to arrest all downward momentum and maximize mechanical tension.',
                   es: 'Mantén la posición inferior sin movimiento para detener todo el impulso descendente y maximizar la tensión mecánica.',
                   pt: 'Mantenha a posição inferior sem movimento para frear todo o impulso descendente e maximizar a tensão mecânica.' } },
        { id: 'concentric', start_pct: 50, end_pct: 95, easing: 'ease-in',
          label: { en: 'Concentric · Press Drive',
                   es: 'Concéntrica · Empuje de Subida',
                   pt: 'Concêntrica · Impulso de Subida' },
          cue:   { en: 'Drive forcefully upward through the mid-foot, extending the hips and knees simultaneously to return to a full, locked-out standing position.',
                   es: 'Empuja con fuerza hacia arriba desde la planta media del pie, extendiendo caderas y rodillas simultáneamente para volver a la posición de pie completamente bloqueada.',
                   pt: 'Empurre com força para cima através do meio do pé, estendendo quadris e joelhos simultaneamente para retornar à posição em pé totalmente travada.' } },
        { id: 'reset', start_pct: 95, end_pct: 100, easing: 'ease-in-out',
          label: { en: 'Reset · Lockout Dwell',
                   es: 'Reinicio · Pausa en Bloqueo',
                   pt: 'Reinício · Pausa no Travamento' } }
      ],
      keyframes: [
        { t: 0.00, phase: 'eccentric',
          joints: {
            head:       { x: 0.50, y: 0.20 },
            shoulder_l: { x: 0.50, y: 0.35 }, shoulder_r: { x: 0.50, y: 0.35 },
            elbow_l:    { x: 0.55, y: 0.45 }, elbow_r:    { x: 0.55, y: 0.45 },
            wrist_l:    { x: 0.53, y: 0.35 }, wrist_r:    { x: 0.53, y: 0.35 },
            hip_l:      { x: 0.50, y: 0.60 }, hip_r:      { x: 0.50, y: 0.60 },
            knee_l:     { x: 0.50, y: 0.78 }, knee_r:     { x: 0.50, y: 0.78 },
            ankle_l:    { x: 0.50, y: 0.92 }, ankle_r:    { x: 0.50, y: 0.92 }
          }
        },
        { t: 0.40, phase: 'eccentric',
          joints: {
            head:       { x: 0.65, y: 0.45 },
            shoulder_l: { x: 0.50, y: 0.60 }, shoulder_r: { x: 0.50, y: 0.60 },
            elbow_l:    { x: 0.55, y: 0.70 }, elbow_r:    { x: 0.55, y: 0.70 },
            wrist_l:    { x: 0.53, y: 0.60 }, wrist_r:    { x: 0.53, y: 0.60 },
            hip_l:      { x: 0.38, y: 0.82 }, hip_r:      { x: 0.38, y: 0.82 },
            knee_l:     { x: 0.58, y: 0.82 }, knee_r:     { x: 0.58, y: 0.82 }
          }
        },
        { t: 0.50, phase: 'isometric', joints: {} },
        { t: 0.95, phase: 'concentric',
          joints: {
            head:       { x: 0.50, y: 0.20 },
            shoulder_l: { x: 0.50, y: 0.35 }, shoulder_r: { x: 0.50, y: 0.35 },
            elbow_l:    { x: 0.55, y: 0.45 }, elbow_r:    { x: 0.55, y: 0.45 },
            wrist_l:    { x: 0.53, y: 0.35 }, wrist_r:    { x: 0.53, y: 0.35 },
            hip_l:      { x: 0.50, y: 0.60 }, hip_r:      { x: 0.50, y: 0.60 },
            knee_l:     { x: 0.50, y: 0.78 }, knee_r:     { x: 0.50, y: 0.78 }
          }
        },
        { t: 1.00, phase: 'reset', joints: {} }
      ]
    },

    equipment: [
      { type: 'bar', attach: ['shoulder_l', 'shoulder_r'], plates: true }
    ],

    kineticPath: {
      default: {
        label: { en: 'Bar Path', es: 'Trayectoria de Barra', pt: 'Trajetória da Barra' },
        d: 'M 0.50 0.82 L 0.50 0.35'
      },
      endpoints: [{ x: 0.50, y: 0.82 }, { x: 0.50, y: 0.35 }],
      labels: [
        { x: 0.55, y: 0.82, text: { en: 'Max Depth', es: 'Profundidad Máxima', pt: 'Profundidade Máxima' } },
        { x: 0.55, y: 0.35, text: { en: 'Lockout',   es: 'Bloqueo',           pt: 'Travamento' } }
      ]
    },

    forms: {
      ok: {
        chipLabel: { en: 'Standard Form', es: 'Forma Estándar', pt: 'Forma Padrão' },
        callouts: [
          { from: 'knee_l', to: { x: 0.70, y: 0.82 },
            lines: [{ en: 'Knees track naturally',
                      es: 'Rodillas siguen naturalmente',
                      pt: 'Joelhos acompanham naturalmente' }] }
        ],
        metrics: {
          dev:  '± 1.0 cm',
          tuck: { en: 'Neutral', es: 'Neutro',  pt: 'Neutro' },
          load: { en: 'Nominal', es: 'Nominal', pt: 'Nominal' },
          fn:   { en: 'Clinical reference overlay',
                  es: 'Capa de referencia clínica',
                  pt: 'Camada de referência clínica' }
        },
        haloAt: null
      },
      warn: {
        chipLabel: { en: 'Common Fault: Hips Rise Early',
                     es: 'Falla Común: Caderas Suben Pronto',
                     pt: 'Falha Comum: Quadris Sobem Cedo' },
        callouts: [
          { from: 'hip_l', to: { x: 0.20, y: 0.70 }, warn: true,
            lines: [{ en: 'Good Morning Squat · Lumbar Shear',
                      es: 'Sentadilla Buenos Días · Cizalla Lumbar',
                      pt: 'Agachamento Bom Dia · Cisalhamento Lombar' }] }
        ],
        metrics: {
          dev:  '± 4.5 cm',
          tuck: { en: 'Anterior Tilt', es: 'Inclinación Anterior', pt: 'Inclinação Anterior' },
          load: { en: 'Elevated',      es: 'Elevado',              pt: 'Elevado' },
          fn:   { en: 'Fault pattern · Premature hip extension',
                  es: 'Patrón de falla · Extensión prematura de cadera',
                  pt: 'Padrão de falha · Extensão prematura do quadril' }
        },
        haloAt: 'hip_l',
        keyframesOverride: [
          { t: 0.75,
            joints: {
              hip_l:      { x: 0.35, y: 0.65 },
              hip_r:      { x: 0.35, y: 0.65 },
              shoulder_l: { x: 0.55, y: 0.55 },
              shoulder_r: { x: 0.55, y: 0.55 }
            }
          }
        ]
      }
    },

    metricLabels: {
      dev:  { en: 'Bar Path Dev.', es: 'Desv. Trayectoria',   pt: 'Desv. Trajetória' },
      tuck: { en: 'Pelvic Tilt',   es: 'Inclinación Pélvica', pt: 'Inclinação Pélvica' },
      load: { en: 'Lumbar Load',   es: 'Carga Lumbar',        pt: 'Carga Lombar' }
    }
  };

  // ─── BICEPS CURLS (V2) ───────────────────────────────────
  // Aliases include 'bicep curl' which previously resolved to a static
  // legacy entry. registerBlueprint clears that conflict so the live
  // production button now lands on this animated hologram.
  var BICEPS_CURLS = {
    id: 'biceps_curls',
    displayName: 'Biceps Curls',
    aliases: ['bicep curl', 'dumbbell curl', 'cable curl'],

    title: {
      en: 'Clinical Protocol: Biceps Curls',
      es: 'Protocolo Clínico: Curl de Bíceps',
      pt: 'Protocolo Clínico: Rosca Bíceps'
    },
    subtitle: {
      en: 'Sagittal Plane · Dumbbells · Sovereign Rig',
      es: 'Plano Sagital · Mancuernas · Equipo Soberano',
      pt: 'Plano Sagital · Halteres · Equipamento Soberano'
    },
    muscleTarget: {
      en: 'Primary: Biceps Brachii, Brachialis. Secondary: Brachioradialis, Forearm Flexors, Core Stabilizers.',
      es: 'Primarios: Bíceps Braquial, Braquial. Secundarios: Braquiorradial, Flexores del Antebrazo, Estabilizadores del Core.',
      pt: 'Primários: Bíceps Braquial, Braquial. Secundários: Braquiorradial, Flexores do Antebraço, Estabilizadores do Core.'
    },
    clinicalNotes: {
      en: 'Perfect Sovereign execution demands that the elbow remains rigidly locked and pinned to the side of the torso to ensure strict isolation of the elbow flexors. The kinetic chain requires a highly braced core and depressed scapulae to entirely prevent any anterior shoulder swing or momentum throughout the movement.',
      es: 'La ejecución soberana perfecta exige que el codo permanezca rígidamente fijo y pegado al costado del torso para garantizar el aislamiento estricto de los flexores del codo. La cadena cinética requiere un core altamente activado y escápulas deprimidas para prevenir por completo cualquier balanceo anterior del hombro o impulso durante todo el movimiento.',
      pt: 'A execução soberana perfeita exige que o cotovelo permaneça rigidamente travado e pressionado contra a lateral do torso para garantir o isolamento estrito dos flexores do cotovelo. A cadeia cinética requer um core altamente ativado e escápulas deprimidas para prevenir completamente qualquer balanço anterior do ombro ou impulso durante todo o movimento.'
    },
    svgTitle: {
      en: 'Biceps Curls Sagittal Wireframe',
      es: 'Wireframe Sagital de Curl de Bíceps',
      pt: 'Wireframe Sagital de Rosca Bíceps'
    },

    plane: 'sagittal',
    facing: 'right',
    ground: { y: 0.92 },

    jointSpec: STD_JOINT_SPEC,
    bones:     STD_BONES,

    animation: {
      duration_ms: 3000,
      loop: true,
      direction: 'normal',
      easing: 'ease-in-out',
      phases: [
        { id: 'eccentric', start_pct: 0, end_pct: 40, easing: 'ease-out',
          label: { en: 'Eccentric · Loaded Descent',
                   es: 'Excéntrica · Descenso con Carga',
                   pt: 'Excêntrica · Descida Carregada' },
          cue:   { en: 'Lower the load with strict, deliberate control until the arm achieves full extension.',
                   es: 'Baja la carga con control estricto y deliberado hasta que el brazo alcance la extensión completa.',
                   pt: 'Abaixe a carga com controle estrito e deliberado até que o braço atinja a extensão completa.' } },
        { id: 'isometric', start_pct: 40, end_pct: 50, easing: 'linear',
          label: { en: 'Isometric · Bottom Stretch',
                   es: 'Isométrica · Estiramiento Inferior',
                   pt: 'Isométrica · Alongamento no Fundo' },
          cue:   { en: 'Brief pause at full extension to kill momentum.',
                   es: 'Pausa breve en la extensión completa para anular el impulso.',
                   pt: 'Pausa breve na extensão completa para anular o impulso.' } },
        { id: 'concentric', start_pct: 50, end_pct: 90, easing: 'ease-in',
          label: { en: 'Concentric · Flexion Drive',
                   es: 'Concéntrica · Empuje de Flexión',
                   pt: 'Concêntrica · Impulso de Flexão' },
          cue:   { en: 'Drive the weight upward through a forceful contraction of the biceps while keeping the elbow completely static.',
                   es: 'Impulsa el peso hacia arriba mediante una contracción enérgica del bíceps manteniendo el codo completamente estático.',
                   pt: 'Impulsione o peso para cima através de uma contração enérgica do bíceps mantendo o cotovelo completamente estático.' } },
        { id: 'reset', start_pct: 90, end_pct: 100, easing: 'ease-in-out',
          label: { en: 'Reset · Peak Contraction',
                   es: 'Reinicio · Contracción Máxima',
                   pt: 'Reinício · Contração Máxima' },
          cue:   { en: 'Hold the fully contracted peak motionless to maximize mechanical tension and squeeze the muscle.',
                   es: 'Mantén el pico de contracción completa sin movimiento para maximizar la tensión mecánica y exprimir el músculo.',
                   pt: 'Mantenha o pico de contração total sem movimento para maximizar a tensão mecânica e contrair o músculo.' } }
      ],
      keyframes: [
        { t: 0.00, phase: 'eccentric',
          joints: {
            head:       { x: 0.50, y: 0.20 },
            shoulder_l: { x: 0.50, y: 0.35 }, shoulder_r: { x: 0.50, y: 0.35 },
            elbow_l:    { x: 0.50, y: 0.52 }, elbow_r:    { x: 0.50, y: 0.52 },
            wrist_l:    { x: 0.60, y: 0.38 }, wrist_r:    { x: 0.60, y: 0.38 },
            hip_l:      { x: 0.50, y: 0.60 }, hip_r:      { x: 0.50, y: 0.60 },
            knee_l:     { x: 0.50, y: 0.78 }, knee_r:     { x: 0.50, y: 0.78 },
            ankle_l:    { x: 0.50, y: 0.92 }, ankle_r:    { x: 0.50, y: 0.92 }
          }
        },
        { t: 0.40, phase: 'eccentric',
          joints: {
            wrist_l: { x: 0.55, y: 0.68 },
            wrist_r: { x: 0.55, y: 0.68 }
          }
        },
        { t: 0.50, phase: 'isometric', joints: {} },
        { t: 0.70, phase: 'concentric',
          joints: {
            wrist_l: { x: 0.65, y: 0.55 },
            wrist_r: { x: 0.65, y: 0.55 }
          }
        },
        { t: 0.90, phase: 'concentric',
          joints: {
            wrist_l: { x: 0.60, y: 0.38 },
            wrist_r: { x: 0.60, y: 0.38 }
          }
        },
        { t: 1.00, phase: 'reset', joints: {} }
      ]
    },

    equipment: [
      { type: 'dumbbell', attach: ['wrist_l', 'wrist_r'] }
    ],

    kineticPath: {
      default: {
        label: { en: 'Flexion Arc', es: 'Arco de Flexión', pt: 'Arco de Flexão' },
        d: 'M 0.60 0.38 Q 0.70 0.55 0.55 0.68'
      },
      endpoints: [{ x: 0.60, y: 0.38 }, { x: 0.55, y: 0.68 }],
      labels: [
        { x: 0.62, y: 0.35, text: { en: 'Peak Contraction', es: 'Contracción Máxima', pt: 'Contração Máxima' } },
        { x: 0.57, y: 0.71, text: { en: 'Full Extension',   es: 'Extensión Completa', pt: 'Extensão Completa' } }
      ]
    },

    forms: {
      ok: {
        chipLabel: { en: 'Standard Form', es: 'Forma Estándar', pt: 'Forma Padrão' },
        callouts: [
          { from: 'elbow_l', to: { x: 0.30, y: 0.52 },
            lines: [{ en: 'Elbow pinned to torso',
                      es: 'Codo fijado al torso',
                      pt: 'Cotovelo fixado ao torso' }] }
        ],
        metrics: {
          dev:  '± 0.5 cm',
          tuck: { en: 'Scapulae Depressed', es: 'Escápulas Deprimidas', pt: 'Escápulas Deprimidas' },
          load: { en: 'Strict Isolation',   es: 'Aislamiento Estricto', pt: 'Isolamento Estrito' },
          fn:   { en: 'Clinical reference overlay',
                  es: 'Capa de referencia clínica',
                  pt: 'Camada de referência clínica' }
        },
        haloAt: null
      },
      warn: {
        chipLabel: { en: 'Common Fault: Anterior Shoulder Swing',
                     es: 'Falla Común: Balanceo Anterior del Hombro',
                     pt: 'Falha Comum: Balanço Anterior do Ombro' },
        callouts: [
          { from: 'elbow_l', to: { x: 0.20, y: 0.45 }, warn: true,
            lines: [{ en: 'Momentum shift · Tension loss',
                      es: 'Cambio de impulso · Pérdida de tensión',
                      pt: 'Mudança de impulso · Perda de tensão' }] }
        ],
        metrics: {
          dev:  '± 3.0 cm',
          tuck: { en: 'Shoulder Protracted',   es: 'Hombro Protraído',          pt: 'Ombro Protraído' },
          load: { en: 'Anterior Deltoid Bias', es: 'Sesgo del Deltoides Anterior', pt: 'Viés do Deltoide Anterior' },
          fn:   { en: 'Fault pattern · Elbow drifts forward',
                  es: 'Patrón de falla · El codo se desplaza hacia adelante',
                  pt: 'Padrão de falha · Cotovelo desloca-se para frente' }
        },
        haloAt: 'shoulder_l',
        keyframesOverride: [
          { t: 0.70,
            joints: {
              elbow_l: { x: 0.58, y: 0.50 }, elbow_r: { x: 0.58, y: 0.50 },
              wrist_l: { x: 0.68, y: 0.45 }, wrist_r: { x: 0.68, y: 0.45 }
            }
          }
        ]
      }
    },

    metricLabels: {
      dev:  { en: 'Path Dev.',       es: 'Desv. Trayectoria', pt: 'Desv. Trajetória' },
      tuck: { en: 'Shoulder Anchor', es: 'Anclaje del Hombro', pt: 'Ancoragem do Ombro' },
      load: { en: 'Muscle Bias',     es: 'Sesgo Muscular',    pt: 'Viés Muscular' }
    }
  };

  // ─── ROMANIAN DEADLIFT (V2) ──────────────────────────────
  // Replaces the legacy 'romanian deadlift' static entry via alias
  // collision (registerBlueprint clears the legacy primary on register).
  var ROMANIAN_DEADLIFT = {
    id: 'romanian_deadlift',
    displayName: 'Romanian Deadlift',
    aliases: ['rdl', 'rdls', 'romanian deadlift', 'romanian deadlifts', 'stiff leg deadlift', 'stiff leg deadlifts'],

    title: {
      en: 'Clinical Protocol: Romanian Deadlift',
      es: 'Protocolo Clínico: Peso Muerto Rumano',
      pt: 'Protocolo Clínico: Levantamento Terra Romeno'
    },
    subtitle: {
      en: 'Sagittal Plane · Barbell · Sovereign Rig',
      es: 'Plano Sagital · Barra · Equipo Soberano',
      pt: 'Plano Sagital · Barra · Equipamento Soberano'
    },
    muscleTarget: {
      en: 'Primary: Hamstrings, Gluteus Maximus. Secondary: Erector Spinae, Latissimus Dorsi, Core Stabilizers.',
      es: 'Primarios: Isquiotibiales, Glúteo Mayor. Secundarios: Erectores Espinales, Dorsal Ancho, Estabilizadores del Core.',
      pt: 'Primários: Isquiotibiais, Glúteo Máximo. Secundários: Eretores da Espinha, Latíssimo do Dorso, Estabilizadores do Core.'
    },
    clinicalNotes: {
      en: 'Execution demands a highly braced core and locked latissimus dorsi to maintain a neutral, rigid spine throughout the hinge. The kinetic chain relies on maximal hip flexion with minimal knee flexion, keeping the barbell\'s center of mass strictly pinned against the legs over the mid-foot. Optimal joint health is preserved by strictly avoiding lumbar flexion and driving the hips backward only until hamstring flexibility reaches its natural limit.',
      es: 'La ejecución exige un core altamente activado y dorsales bloqueados para mantener una columna neutra y rígida durante toda la bisagra. La cadena cinética depende de la flexión máxima de cadera con mínima flexión de rodilla, manteniendo el centro de masa de la barra estrictamente pegado a las piernas sobre la planta media del pie. La salud articular óptima se preserva evitando estrictamente la flexión lumbar y empujando las caderas hacia atrás solo hasta que la flexibilidad de los isquiotibiales alcance su límite natural.',
      pt: 'A execução exige um core altamente ativado e dorsais travados para manter uma coluna neutra e rígida durante toda a dobradiça. A cadeia cinética depende da flexão máxima do quadril com mínima flexão do joelho, mantendo o centro de massa da barra estritamente pressionado contra as pernas sobre o meio do pé. A saúde articular ótima é preservada evitando estritamente a flexão lombar e empurrando os quadris para trás apenas até que a flexibilidade dos isquiotibiais atinja seu limite natural.'
    },
    svgTitle: {
      en: 'Romanian Deadlift Sagittal Wireframe',
      es: 'Wireframe Sagital de Peso Muerto Rumano',
      pt: 'Wireframe Sagital de Levantamento Terra Romeno'
    },

    plane: 'sagittal', facing: 'right', ground: { y: 0.92 },
    jointSpec: STD_JOINT_SPEC, bones: STD_BONES,

    animation: {
      duration_ms: 3500, loop: true, direction: 'normal', easing: 'ease-in-out',
      phases: [
        { id: 'eccentric', start_pct: 0, end_pct: 40, easing: 'ease-out',
          label: { en: 'Eccentric · Hip Hinge', es: 'Excéntrica · Bisagra de Cadera', pt: 'Excêntrica · Dobradiça de Quadril' },
          cue:   { en: 'Hinge at the hips and push your glutes backward to lower the barbell with strict, deliberate control until you feel a deep stretch in the hamstrings.',
                   es: 'Bisagra en las caderas y empuja los glúteos hacia atrás para bajar la barra con control estricto y deliberado hasta sentir un estiramiento profundo en los isquiotibiales.',
                   pt: 'Faça a dobradiça nos quadris e empurre os glúteos para trás para abaixar a barra com controle estrito e deliberado até sentir um alongamento profundo nos isquiotibiais.' } },
        { id: 'isometric', start_pct: 40, end_pct: 50, easing: 'linear',
          label: { en: 'Isometric · Bottom Stretch', es: 'Isométrica · Estiramiento Inferior', pt: 'Isométrica · Alongamento no Fundo' },
          cue:   { en: 'Hold the bottom stretch motionless to dissipate momentum and maximize mechanical tension on the posterior chain.',
                   es: 'Mantén el estiramiento inferior sin movimiento para disipar el impulso y maximizar la tensión mecánica en la cadena posterior.',
                   pt: 'Mantenha o alongamento no fundo sem movimento para dissipar o impulso e maximizar a tensão mecânica na cadeia posterior.' } },
        { id: 'concentric', start_pct: 50, end_pct: 90, easing: 'ease-in',
          label: { en: 'Concentric · Glute Drive', es: 'Concéntrica · Empuje de Glúteos', pt: 'Concêntrica · Impulso de Glúteos' },
          cue:   { en: 'Drive forcefully through the mid-foot and contract the glutes to extend the hips forward to a full, locked-out standing position.',
                   es: 'Empuja con fuerza desde la planta media del pie y contrae los glúteos para extender las caderas hacia adelante hasta una posición de pie completamente bloqueada.',
                   pt: 'Empurre com força através do meio do pé e contraia os glúteos para estender os quadris para frente até a posição em pé totalmente travada.' } },
        { id: 'reset', start_pct: 90, end_pct: 100, easing: 'ease-in-out',
          label: { en: 'Reset · Lockout', es: 'Reinicio · Bloqueo', pt: 'Reinício · Travamento' },
          cue:   { en: 'Maintain neutral spine at lockout.', es: 'Mantén la columna neutra en el bloqueo.', pt: 'Mantenha a coluna neutra no travamento.' } }
      ],
      keyframes: [
        { t: 0.00, phase: 'eccentric',
          joints: {
            head: { x: 0.50, y: 0.20 },
            shoulder_l: { x: 0.50, y: 0.35 }, shoulder_r: { x: 0.50, y: 0.35 },
            elbow_l:    { x: 0.50, y: 0.48 }, elbow_r:    { x: 0.50, y: 0.48 },
            wrist_l:    { x: 0.50, y: 0.60 }, wrist_r:    { x: 0.50, y: 0.60 },
            hip_l:      { x: 0.50, y: 0.60 }, hip_r:      { x: 0.50, y: 0.60 },
            knee_l:     { x: 0.50, y: 0.78 }, knee_r:     { x: 0.50, y: 0.78 },
            ankle_l:    { x: 0.50, y: 0.92 }, ankle_r:    { x: 0.50, y: 0.92 }
          } },
        { t: 0.40, phase: 'eccentric',
          joints: {
            head: { x: 0.75, y: 0.45 },
            shoulder_l: { x: 0.65, y: 0.60 }, shoulder_r: { x: 0.65, y: 0.60 },
            elbow_l:    { x: 0.60, y: 0.70 }, elbow_r:    { x: 0.60, y: 0.70 },
            wrist_l:    { x: 0.55, y: 0.80 }, wrist_r:    { x: 0.55, y: 0.80 },
            hip_l:      { x: 0.35, y: 0.60 }, hip_r:      { x: 0.35, y: 0.60 },
            knee_l:     { x: 0.45, y: 0.78 }, knee_r:     { x: 0.45, y: 0.78 }
          } },
        { t: 0.50, phase: 'isometric', joints: {} },
        { t: 0.90, phase: 'concentric',
          joints: {
            head: { x: 0.50, y: 0.20 },
            shoulder_l: { x: 0.50, y: 0.35 }, shoulder_r: { x: 0.50, y: 0.35 },
            elbow_l:    { x: 0.50, y: 0.48 }, elbow_r:    { x: 0.50, y: 0.48 },
            wrist_l:    { x: 0.50, y: 0.60 }, wrist_r:    { x: 0.50, y: 0.60 },
            hip_l:      { x: 0.50, y: 0.60 }, hip_r:      { x: 0.50, y: 0.60 },
            knee_l:     { x: 0.50, y: 0.78 }, knee_r:     { x: 0.50, y: 0.78 }
          } },
        { t: 1.00, phase: 'reset', joints: {} }
      ]
    },

    equipment: [{ type: 'bar', attach: ['wrist_l', 'wrist_r'], plates: true }],

    kineticPath: {
      default: { label: { en: 'Bar Path', es: 'Trayectoria de Barra', pt: 'Trajetória da Barra' },
                 d: 'M 0.50 0.60 L 0.55 0.80' },
      endpoints: [{ x: 0.50, y: 0.60 }, { x: 0.55, y: 0.80 }],
      labels: [
        { x: 0.55, y: 0.60, text: { en: 'Lockout',     es: 'Bloqueo',             pt: 'Travamento' } },
        { x: 0.60, y: 0.80, text: { en: 'Max Stretch', es: 'Estiramiento Máximo', pt: 'Alongamento Máximo' } }
      ]
    },

    forms: {
      ok: {
        chipLabel: { en: 'Standard Form', es: 'Forma Estándar', pt: 'Forma Padrão' },
        callouts: [
          { from: 'hip_l', to: { x: 0.20, y: 0.60 },
            lines: [{ en: 'Maximal hip displacement', es: 'Desplazamiento máximo de cadera', pt: 'Deslocamento máximo de quadril' }] }
        ],
        metrics: {
          dev: '± 1.0 cm',
          tuck: { en: 'Neutral Spine',   es: 'Columna Neutra',          pt: 'Coluna Neutra' },
          load: { en: 'Hamstring Bias',  es: 'Sesgo de Isquiotibiales', pt: 'Viés dos Isquiotibiais' },
          fn:   { en: 'Clinical reference overlay', es: 'Capa de referencia clínica', pt: 'Camada de referência clínica' }
        },
        haloAt: null
      },
      warn: {
        chipLabel: { en: 'Common Fault: Lumbar Flexion', es: 'Falla Común: Flexión Lumbar', pt: 'Falha Comum: Flexão Lombar' },
        callouts: [
          { from: 'shoulder_l', to: { x: 0.80, y: 0.50 }, warn: true,
            lines: [{ en: 'Spine rounding · Disc Shear',
                      es: 'Redondeo de columna · Cizalla discal',
                      pt: 'Arredondamento da coluna · Cisalhamento discal' }] }
        ],
        metrics: {
          dev: '± 4.0 cm',
          tuck: { en: 'Lumbar Flexion',    es: 'Flexión Lumbar',          pt: 'Flexão Lombar' },
          load: { en: 'Erector Overload',  es: 'Sobrecarga de Erectores', pt: 'Sobrecarga de Eretores' },
          fn:   { en: 'Fault pattern · Hips stop, back rounds',
                  es: 'Patrón de falla · Las caderas se detienen, la espalda se redondea',
                  pt: 'Padrão de falha · Quadris param, costas arredondam' }
        },
        haloAt: 'shoulder_l',
        keyframesOverride: [
          { t: 0.40, joints: { hip_l: { x: 0.45, y: 0.60 }, hip_r: { x: 0.45, y: 0.60 },
                               shoulder_l: { x: 0.70, y: 0.65 }, shoulder_r: { x: 0.70, y: 0.65 } } }
        ]
      }
    },

    metricLabels: {
      dev:  { en: 'Path Dev.',      es: 'Desv. Trayectoria', pt: 'Desv. Trajetória' },
      tuck: { en: 'Spinal Posture', es: 'Postura Espinal',   pt: 'Postura Espinhal' },
      load: { en: 'Tissue Load',    es: 'Carga Tisular',     pt: 'Carga Tecidual' }
    }
  };

  // ─── LAT PULLDOWNS (V2) ──────────────────────────────────
  var LAT_PULLDOWNS = {
    id: 'lat_pulldowns',
    displayName: 'Lat Pulldowns',
    aliases: ['lat pulldown', 'lat pulldowns', 'cable pulldown', 'cable pulldowns', 'pulldowns'],

    title: {
      en: 'Clinical Protocol: Lat Pulldowns',
      es: 'Protocolo Clínico: Jalones al Pecho',
      pt: 'Protocolo Clínico: Puxadas para a Frente'
    },
    subtitle: {
      en: 'Frontal Plane · Cable · Sovereign Rig',
      es: 'Plano Frontal · Polea · Equipo Soberano',
      pt: 'Plano Frontal · Cabo · Equipamento Soberano'
    },
    muscleTarget: {
      en: 'Primary: Latissimus Dorsi, Teres Major. Secondary: Biceps Brachii, Brachialis, Rhomboids, Lower Trapezius.',
      es: 'Primarios: Dorsal Ancho, Redondo Mayor. Secundarios: Bíceps Braquial, Braquial, Romboides, Trapecio Inferior.',
      pt: 'Primários: Latíssimo do Dorso, Redondo Maior. Secundários: Bíceps Braquial, Braquial, Romboides, Trapézio Inferior.'
    },
    clinicalNotes: {
      en: 'Perfect Sovereign execution requires depressed and retracted scapulae to ensure strict isolation of the latissimus dorsi. The kinetic chain depends on a braced core and a slight torso lean, entirely preventing momentum or lumbar hyperextension from assisting the load. Optimal joint articulation is achieved by driving the elbows down and back, pulling through the lats rather than pulling with the hands.',
      es: 'La ejecución soberana perfecta requiere escápulas deprimidas y retraídas para garantizar el aislamiento estricto del dorsal ancho. La cadena cinética depende de un core activado y una leve inclinación del torso, previniendo por completo que el impulso o la hiperextensión lumbar asistan la carga. La articulación óptima se logra empujando los codos hacia abajo y atrás, tirando con los dorsales en lugar de tirar con las manos.',
      pt: 'A execução soberana perfeita requer escápulas deprimidas e retraídas para garantir o isolamento estrito do latíssimo do dorso. A cadeia cinética depende de um core ativado e uma leve inclinação do torso, prevenindo completamente que o impulso ou a hiperextensão lombar auxiliem a carga. A articulação ótima é alcançada empurrando os cotovelos para baixo e para trás, puxando pelos dorsais em vez de puxar com as mãos.'
    },
    svgTitle: {
      en: 'Lat Pulldown Frontal Wireframe',
      es: 'Wireframe Frontal de Jalón al Pecho',
      pt: 'Wireframe Frontal de Puxada para a Frente'
    },

    plane: 'frontal', facing: 'front', ground: { y: 0.92 },
    jointSpec: STD_JOINT_SPEC, bones: STD_BONES,

    animation: {
      duration_ms: 3000, loop: true, direction: 'normal', easing: 'ease-in-out',
      phases: [
        { id: 'eccentric', start_pct: 0, end_pct: 40, easing: 'ease-out',
          label: { en: 'Eccentric · Upward Reach', es: 'Excéntrica · Alcance Ascendente', pt: 'Excêntrica · Alcance Ascendente' },
          cue:   { en: 'Control the ascent of the bar with deliberate pacing until the lats achieve full extension and the scapulae elevate naturally.',
                   es: 'Controla el ascenso de la barra con un ritmo deliberado hasta que los dorsales alcancen la extensión completa y las escápulas se eleven naturalmente.',
                   pt: 'Controle a subida da barra com ritmo deliberado até que os dorsais alcancem a extensão completa e as escápulas se elevem naturalmente.' } },
        { id: 'isometric', start_pct: 40, end_pct: 50, easing: 'linear',
          label: { en: 'Isometric · Top Stretch', es: 'Isométrica · Estiramiento Superior', pt: 'Isométrica · Alongamento no Topo' },
          cue:   { en: 'Hold the fully stretched peak motionless to maximize mechanical tension and eliminate elastic recoil.',
                   es: 'Mantén el pico completamente estirado sin movimiento para maximizar la tensión mecánica y eliminar el rebote elástico.',
                   pt: 'Mantenha o pico totalmente alongado sem movimento para maximizar a tensão mecânica e eliminar o recuo elástico.' } },
        { id: 'concentric', start_pct: 50, end_pct: 90, easing: 'ease-in',
          label: { en: 'Concentric · Lat Drive', es: 'Concéntrica · Empuje Dorsal', pt: 'Concêntrica · Impulso Dorsal' },
          cue:   { en: 'Drive the elbows forcefully down toward the floor and squeeze the lats to bring the bar to the upper chest.',
                   es: 'Empuja los codos con fuerza hacia abajo hacia el suelo y aprieta los dorsales para llevar la barra al pecho superior.',
                   pt: 'Empurre os cotovelos com força para baixo em direção ao chão e contraia os dorsais para trazer a barra ao peito superior.' } },
        { id: 'reset', start_pct: 90, end_pct: 100, easing: 'ease-in-out',
          label: { en: 'Reset · Bottom Squeeze', es: 'Reinicio · Apretón Inferior', pt: 'Reinício · Contração Inferior' },
          cue:   { en: 'Depress scapulae fully.', es: 'Deprime las escápulas por completo.', pt: 'Deprima as escápulas completamente.' } }
      ],
      keyframes: [
        { t: 0.00, phase: 'eccentric',
          joints: {
            head: { x: 0.50, y: 0.25 },
            shoulder_l: { x: 0.40, y: 0.35 }, shoulder_r: { x: 0.60, y: 0.35 },
            elbow_l:    { x: 0.30, y: 0.50 }, elbow_r:    { x: 0.70, y: 0.50 },
            wrist_l:    { x: 0.35, y: 0.35 }, wrist_r:    { x: 0.65, y: 0.35 },
            hip_l:      { x: 0.45, y: 0.65 }, hip_r:      { x: 0.55, y: 0.65 },
            knee_l:     { x: 0.40, y: 0.80 }, knee_r:     { x: 0.60, y: 0.80 },
            ankle_l:    { x: 0.40, y: 0.92 }, ankle_r:    { x: 0.60, y: 0.92 }
          } },
        { t: 0.40, phase: 'eccentric',
          joints: {
            shoulder_l: { x: 0.42, y: 0.30 }, shoulder_r: { x: 0.58, y: 0.30 },
            elbow_l:    { x: 0.30, y: 0.15 }, elbow_r:    { x: 0.70, y: 0.15 },
            wrist_l:    { x: 0.25, y: 0.05 }, wrist_r:    { x: 0.75, y: 0.05 }
          } },
        { t: 0.50, phase: 'isometric', joints: {} },
        { t: 0.90, phase: 'concentric',
          joints: {
            shoulder_l: { x: 0.40, y: 0.35 }, shoulder_r: { x: 0.60, y: 0.35 },
            elbow_l:    { x: 0.30, y: 0.50 }, elbow_r:    { x: 0.70, y: 0.50 },
            wrist_l:    { x: 0.35, y: 0.35 }, wrist_r:    { x: 0.65, y: 0.35 }
          } },
        { t: 1.00, phase: 'reset', joints: {} }
      ]
    },

    equipment: [{ type: 'bar', attach: ['wrist_l', 'wrist_r'] }],

    kineticPath: {
      default: { label: { en: 'Pull Vector', es: 'Vector de Tracción', pt: 'Vetor de Tração' },
                 d: 'M 0.25 0.05 L 0.35 0.35' },
      endpoints: [{ x: 0.25, y: 0.05 }, { x: 0.35, y: 0.35 }],
      labels: [
        { x: 0.20, y: 0.05, text: { en: 'Max Stretch',  es: 'Estiramiento Máximo', pt: 'Alongamento Máximo' } },
        { x: 0.30, y: 0.35, text: { en: 'Contraction',  es: 'Contracción',         pt: 'Contração' } }
      ]
    },

    forms: {
      ok: {
        chipLabel: { en: 'Standard Form', es: 'Forma Estándar', pt: 'Forma Padrão' },
        callouts: [
          { from: 'shoulder_l', to: { x: 0.20, y: 0.35 },
            lines: [{ en: 'Scapulae depressed', es: 'Escápulas deprimidas', pt: 'Escápulas deprimidas' }] }
        ],
        metrics: {
          dev: '± 1.0 cm',
          tuck: { en: 'Lat Biased', es: 'Sesgo Dorsal', pt: 'Viés Dorsal' },
          load: { en: 'Nominal',    es: 'Nominal',      pt: 'Nominal' },
          fn:   { en: 'Clinical reference overlay', es: 'Capa de referencia clínica', pt: 'Camada de referência clínica' }
        },
        haloAt: null
      },
      warn: {
        chipLabel: { en: 'Common Fault: Upper Trap Dominance',
                     es: 'Falla Común: Dominancia del Trapecio Superior',
                     pt: 'Falha Comum: Dominância do Trapézio Superior' },
        callouts: [
          { from: 'shoulder_l', to: { x: 0.20, y: 0.20 }, warn: true,
            lines: [{ en: 'Shoulders elevated · Trap override',
                      es: 'Hombros elevados · Trapecio toma el control',
                      pt: 'Ombros elevados · Trapézio assume o controle' }] }
        ],
        metrics: {
          dev: '± 3.0 cm',
          tuck: { en: 'Shoulder Shrug',    es: 'Encogimiento de Hombros', pt: 'Encolhimento de Ombros' },
          load: { en: 'Impingement Risk',  es: 'Riesgo de Pinzamiento',   pt: 'Risco de Impacto' },
          fn:   { en: 'Fault pattern · Failure to depress scapulae',
                  es: 'Patrón de falla · No se logra deprimir las escápulas',
                  pt: 'Padrão de falha · Falha em deprimir as escápulas' }
        },
        haloAt: 'shoulder_l',
        keyframesOverride: [
          { t: 0.90, joints: { shoulder_l: { x: 0.40, y: 0.25 }, shoulder_r: { x: 0.60, y: 0.25 },
                               elbow_l:    { x: 0.25, y: 0.45 }, elbow_r:    { x: 0.75, y: 0.45 } } }
        ]
      }
    },

    metricLabels: {
      dev:  { en: 'Path Dev.',          es: 'Desv. Trayectoria', pt: 'Desv. Trajetória' },
      tuck: { en: 'Scapular Control',   es: 'Control Escapular', pt: 'Controle Escapular' },
      load: { en: 'Joint Load',         es: 'Carga Articular',   pt: 'Carga Articular' }
    }
  };

  // ─── WALKING LUNGES (V2) ─────────────────────────────────
  var WALKING_LUNGES = {
    id: 'walking_lunges',
    displayName: 'Walking Lunges',
    aliases: ['walking lunge', 'walking lunges', 'lunges', 'dumbbell lunges', 'dumbbell walking lunges'],

    title: {
      en: 'Clinical Protocol: Walking Lunges',
      es: 'Protocolo Clínico: Zancadas en Movimiento',
      pt: 'Protocolo Clínico: Avanços Caminhando'
    },
    subtitle: {
      en: 'Sagittal Plane · Dumbbells · Sovereign Rig',
      es: 'Plano Sagital · Mancuernas · Equipo Soberano',
      pt: 'Plano Sagital · Halteres · Equipamento Soberano'
    },
    muscleTarget: {
      en: 'Primary: Quadriceps, Gluteus Maximus. Secondary: Hamstrings, Adductor Magnus, Calves, Core Stabilizers.',
      es: 'Primarios: Cuádriceps, Glúteo Mayor. Secundarios: Isquiotibiales, Aductor Mayor, Pantorrillas, Estabilizadores del Core.',
      pt: 'Primários: Quadríceps, Glúteo Máximo. Secundários: Isquiotibiais, Adutor Magno, Panturrilhas, Estabilizadores do Core.'
    },
    clinicalNotes: {
      en: 'Execution demands active intra-abdominal pressure to maintain an upright, rigid torso while navigating dynamic unilateral loading. The kinetic chain relies on simultaneous hip and knee flexion of the lead leg, ensuring the front foot remains entirely planted. Optimal joint health is maintained by allowing the trailing knee to gently approach the floor without striking it, while strictly preventing valgus collapse in the lead knee.',
      es: 'La ejecución exige presión intraabdominal activa para mantener un torso vertical y rígido mientras se navega una carga unilateral dinámica. La cadena cinética depende de la flexión simultánea de cadera y rodilla de la pierna líder, garantizando que el pie delantero permanezca completamente plantado. La salud articular óptima se mantiene permitiendo que la rodilla trasera se acerque suavemente al suelo sin tocarlo, mientras se previene estrictamente el colapso en valgo de la rodilla líder.',
      pt: 'A execução exige pressão intra-abdominal ativa para manter um torso ereto e rígido enquanto navega uma carga unilateral dinâmica. A cadeia cinética depende da flexão simultânea de quadril e joelho da perna líder, garantindo que o pé da frente permaneça completamente plantado. A saúde articular ótima é mantida permitindo que o joelho de trás se aproxime suavemente do chão sem tocá-lo, enquanto previne estritamente o colapso em valgo do joelho líder.'
    },
    svgTitle: {
      en: 'Walking Lunges Sagittal Wireframe',
      es: 'Wireframe Sagital de Zancadas en Movimiento',
      pt: 'Wireframe Sagital de Avanços Caminhando'
    },

    plane: 'sagittal', facing: 'right', ground: { y: 0.92 },
    jointSpec: STD_JOINT_SPEC, bones: STD_BONES,

    animation: {
      duration_ms: 3500, loop: true, direction: 'normal', easing: 'ease-in-out',
      phases: [
        { id: 'eccentric', start_pct: 0, end_pct: 40, easing: 'ease-out',
          label: { en: 'Eccentric · Step & Drop', es: 'Excéntrica · Paso y Descenso', pt: 'Excêntrica · Passo e Descida' },
          cue:   { en: 'Step forward and lower your center of mass with strict control until the trailing knee hovers just above the ground.',
                   es: 'Da un paso hacia adelante y baja tu centro de masa con control estricto hasta que la rodilla trasera se sitúe justo por encima del suelo.',
                   pt: 'Dê um passo à frente e abaixe seu centro de massa com controle estrito até que o joelho de trás fique logo acima do solo.' } },
        { id: 'isometric', start_pct: 40, end_pct: 50, easing: 'linear',
          label: { en: 'Isometric · Bottom Hold', es: 'Isométrica · Pausa Inferior', pt: 'Isométrica · Pausa no Fundo' },
          cue:   { en: 'Hold the deepest point of the lunge motionless to arrest momentum and stabilize the joints.',
                   es: 'Mantén el punto más profundo de la zancada sin movimiento para detener el impulso y estabilizar las articulaciones.',
                   pt: 'Mantenha o ponto mais profundo do avanço sem movimento para frear o impulso e estabilizar as articulações.' } },
        { id: 'concentric', start_pct: 50, end_pct: 90, easing: 'ease-in',
          label: { en: 'Concentric · Forward Drive', es: 'Concéntrica · Empuje Adelante', pt: 'Concêntrica · Impulso Adiante' },
          cue:   { en: 'Drive forcefully upward and forward through the lead mid-foot to bring the trailing leg through to the next step.',
                   es: 'Empuja con fuerza hacia arriba y hacia adelante desde la planta media del pie líder para llevar la pierna trasera al siguiente paso.',
                   pt: 'Empurre com força para cima e para frente através do meio do pé líder para trazer a perna de trás ao próximo passo.' } },
        { id: 'reset', start_pct: 90, end_pct: 100, easing: 'ease-in-out',
          label: { en: 'Reset · Balance', es: 'Reinicio · Equilibrio', pt: 'Reinício · Equilíbrio' },
          cue:   { en: 'Stabilize before next rep.', es: 'Estabiliza antes de la siguiente repetición.', pt: 'Estabilize antes da próxima repetição.' } }
      ],
      keyframes: [
        { t: 0.00, phase: 'eccentric',
          joints: {
            head: { x: 0.35, y: 0.20 },
            shoulder_l: { x: 0.35, y: 0.35 }, shoulder_r: { x: 0.35, y: 0.35 },
            elbow_l:    { x: 0.35, y: 0.48 }, elbow_r:    { x: 0.35, y: 0.48 },
            wrist_l:    { x: 0.35, y: 0.60 }, wrist_r:    { x: 0.35, y: 0.60 },
            hip_l:      { x: 0.35, y: 0.60 }, hip_r:      { x: 0.35, y: 0.60 },
            knee_l:     { x: 0.35, y: 0.78 }, knee_r:     { x: 0.35, y: 0.78 },
            ankle_l:    { x: 0.35, y: 0.92 }, ankle_r:    { x: 0.35, y: 0.92 }
          } },
        { t: 0.40, phase: 'eccentric',
          joints: {
            head: { x: 0.50, y: 0.35 },
            shoulder_l: { x: 0.50, y: 0.50 }, shoulder_r: { x: 0.50, y: 0.50 },
            elbow_l:    { x: 0.50, y: 0.63 }, elbow_r:    { x: 0.50, y: 0.63 },
            wrist_l:    { x: 0.50, y: 0.75 }, wrist_r:    { x: 0.50, y: 0.75 },
            hip_l:      { x: 0.50, y: 0.75 }, hip_r:      { x: 0.50, y: 0.75 },
            knee_l:     { x: 0.35, y: 0.88 }, knee_r:     { x: 0.65, y: 0.75 },
            ankle_l:    { x: 0.25, y: 0.92 }, ankle_r:    { x: 0.65, y: 0.92 }
          } },
        { t: 0.50, phase: 'isometric', joints: {} },
        { t: 0.90, phase: 'concentric',
          joints: {
            head: { x: 0.65, y: 0.20 },
            shoulder_l: { x: 0.65, y: 0.35 }, shoulder_r: { x: 0.65, y: 0.35 },
            elbow_l:    { x: 0.65, y: 0.48 }, elbow_r:    { x: 0.65, y: 0.48 },
            wrist_l:    { x: 0.65, y: 0.60 }, wrist_r:    { x: 0.65, y: 0.60 },
            hip_l:      { x: 0.65, y: 0.60 }, hip_r:      { x: 0.65, y: 0.60 },
            knee_l:     { x: 0.65, y: 0.78 }, knee_r:     { x: 0.65, y: 0.78 },
            ankle_l:    { x: 0.65, y: 0.92 }, ankle_r:    { x: 0.65, y: 0.92 }
          } },
        { t: 1.00, phase: 'reset',
          joints: {
            head: { x: 0.35, y: 0.20 },
            shoulder_l: { x: 0.35, y: 0.35 }, shoulder_r: { x: 0.35, y: 0.35 },
            elbow_l:    { x: 0.35, y: 0.48 }, elbow_r:    { x: 0.35, y: 0.48 },
            wrist_l:    { x: 0.35, y: 0.60 }, wrist_r:    { x: 0.35, y: 0.60 },
            hip_l:      { x: 0.35, y: 0.60 }, hip_r:      { x: 0.35, y: 0.60 },
            knee_l:     { x: 0.35, y: 0.78 }, knee_r:     { x: 0.35, y: 0.78 },
            ankle_l:    { x: 0.35, y: 0.92 }, ankle_r:    { x: 0.35, y: 0.92 }
          } }
      ]
    },

    equipment: [{ type: 'dumbbell', attach: ['wrist_l', 'wrist_r'] }],

    kineticPath: {
      default: { label: { en: 'Descent Vector', es: 'Vector de Descenso', pt: 'Vetor de Descida' },
                 d: 'M 0.35 0.60 L 0.50 0.75 L 0.65 0.60' },
      endpoints: [{ x: 0.35, y: 0.60 }, { x: 0.50, y: 0.75 }],
      labels: [
        { x: 0.30, y: 0.60, text: { en: 'Start',     es: 'Inicio',              pt: 'Início' } },
        { x: 0.55, y: 0.75, text: { en: 'Max Depth', es: 'Profundidad Máxima',  pt: 'Profundidade Máxima' } }
      ]
    },

    forms: {
      ok: {
        chipLabel: { en: 'Standard Form', es: 'Forma Estándar', pt: 'Forma Padrão' },
        callouts: [
          { from: 'knee_r', to: { x: 0.85, y: 0.75 },
            lines: [{ en: 'Vertical shin maintained', es: 'Espinilla vertical mantenida', pt: 'Tíbia vertical mantida' }] }
        ],
        metrics: {
          dev: '± 1.0 cm',
          tuck: { en: 'Vertical Torso',       es: 'Torso Vertical',                pt: 'Torso Vertical' },
          load: { en: 'Quad/Glute Balanced',  es: 'Cuádriceps/Glúteos Equilibrado', pt: 'Quadríceps/Glúteo Equilibrado' },
          fn:   { en: 'Clinical reference overlay', es: 'Capa de referencia clínica', pt: 'Camada de referência clínica' }
        },
        haloAt: null
      },
      warn: {
        chipLabel: { en: 'Common Fault: Knee Shear', es: 'Falla Común: Cizalla de Rodilla', pt: 'Falha Comum: Cisalhamento do Joelho' },
        callouts: [
          { from: 'knee_r', to: { x: 0.85, y: 0.75 }, warn: true,
            lines: [{ en: 'Short step · Patellar shear',
                      es: 'Paso corto · Cizalla rotuliana',
                      pt: 'Passo curto · Cisalhamento patelar' }] }
        ],
        metrics: {
          dev: '± 5.0 cm',
          tuck: { en: 'Forward Lean',         es: 'Inclinación Adelante',         pt: 'Inclinação para Frente' },
          load: { en: 'Knee Joint Overload',  es: 'Sobrecarga Articular de Rodilla', pt: 'Sobrecarga Articular do Joelho' },
          fn:   { en: 'Fault pattern · Knee travels excessively past toe',
                  es: 'Patrón de falla · La rodilla rebasa excesivamente la punta del pie',
                  pt: 'Padrão de falha · O joelho ultrapassa excessivamente a ponta do pé' }
        },
        haloAt: 'knee_r',
        keyframesOverride: [
          { t: 0.40, joints: { knee_r: { x: 0.75, y: 0.80 }, ankle_r: { x: 0.60, y: 0.92 },
                               hip_l:  { x: 0.45, y: 0.75 }, hip_r:   { x: 0.45, y: 0.75 } } }
        ]
      }
    },

    metricLabels: {
      dev:  { en: 'Path Dev.',   es: 'Desv. Trayectoria',  pt: 'Desv. Trajetória' },
      tuck: { en: 'Step Stride', es: 'Longitud de Paso',   pt: 'Comprimento do Passo' },
      load: { en: 'Joint Load',  es: 'Carga Articular',    pt: 'Carga Articular' }
    }
  };

  // ─── TRICEPS PUSHDOWNS (V2) ──────────────────────────────
  var TRICEPS_PUSHDOWNS = {
    id: 'triceps_pushdowns',
    displayName: 'Triceps Pushdowns',
    aliases: ['tricep pushdown', 'triceps pushdown', 'tricep pushdowns', 'triceps pushdowns', 'cable pushdowns', 'rope tricep push down', 'rope triceps pushdown', 'rope pushdowns'],

    title: {
      en: 'Clinical Protocol: Triceps Pushdowns',
      es: 'Protocolo Clínico: Extensiones de Tríceps en Polea',
      pt: 'Protocolo Clínico: Tríceps na Polia'
    },
    subtitle: {
      en: 'Sagittal Plane · Cable · Sovereign Rig',
      es: 'Plano Sagital · Polea · Equipo Soberano',
      pt: 'Plano Sagital · Cabo · Equipamento Soberano'
    },
    muscleTarget: {
      en: 'Primary: Triceps Brachii. Secondary: Core Stabilizers, Forearm Flexors.',
      es: 'Primario: Tríceps Braquial. Secundarios: Estabilizadores del Core, Flexores del Antebrazo.',
      pt: 'Primário: Tríceps Braquial. Secundários: Estabilizadores do Core, Flexores do Antebraço.'
    },
    clinicalNotes: {
      en: 'Perfect Sovereign execution demands that the humerus remains rigidly locked and pinned to the sides of the torso to ensure strict isolation of the elbow extensors. The kinetic chain requires a highly braced core and depressed scapulae to prevent the shoulders from rolling forward or assisting the downward press. Joint articulation is optimized by focusing purely on elbow extension without relying on bodyweight leverage or momentum.',
      es: 'La ejecución soberana perfecta exige que el húmero permanezca rígidamente bloqueado y pegado a los costados del torso para garantizar el aislamiento estricto de los extensores del codo. La cadena cinética requiere un core altamente activado y escápulas deprimidas para evitar que los hombros se desplomen hacia adelante o asistan la presión descendente. La articulación se optimiza enfocándose puramente en la extensión del codo sin depender del peso corporal ni del impulso.',
      pt: 'A execução soberana perfeita exige que o úmero permaneça rigidamente travado e pressionado aos lados do torso para garantir o isolamento estrito dos extensores do cotovelo. A cadeia cinética requer um core altamente ativado e escápulas deprimidas para impedir que os ombros rolem para frente ou auxiliem a pressão descendente. A articulação é otimizada concentrando-se puramente na extensão do cotovelo sem depender de alavancagem corporal ou impulso.'
    },
    svgTitle: {
      en: 'Triceps Pushdown Sagittal Wireframe',
      es: 'Wireframe Sagital de Extensión de Tríceps en Polea',
      pt: 'Wireframe Sagital de Tríceps na Polia'
    },

    plane: 'sagittal', facing: 'right', ground: { y: 0.92 },
    jointSpec: STD_JOINT_SPEC, bones: STD_BONES,

    animation: {
      duration_ms: 3000, loop: true, direction: 'normal', easing: 'ease-in-out',
      phases: [
        { id: 'eccentric', start_pct: 0, end_pct: 40, easing: 'ease-out',
          label: { en: 'Eccentric · Controlled Rise', es: 'Excéntrica · Subida Controlada', pt: 'Excêntrica · Subida Controlada' },
          cue:   { en: 'Allow the cable to raise the attachment with strict, deliberate control until the elbows pass 90 degrees of flexion.',
                   es: 'Permite que el cable eleve el accesorio con control estricto y deliberado hasta que los codos pasen los 90 grados de flexión.',
                   pt: 'Permita que o cabo eleve o acessório com controle estrito e deliberado até que os cotovelos passem dos 90 graus de flexão.' } },
        { id: 'isometric', start_pct: 40, end_pct: 50, easing: 'linear',
          label: { en: 'Isometric · Top Stretch', es: 'Isométrica · Estiramiento Superior', pt: 'Isométrica · Alongamento no Topo' },
          cue:   { en: 'Hold the top position motionless to fully stretch the triceps and eliminate downward momentum.',
                   es: 'Mantén la posición superior sin movimiento para estirar completamente los tríceps y eliminar el impulso descendente.',
                   pt: 'Mantenha a posição superior sem movimento para alongar completamente os tríceps e eliminar o impulso descendente.' } },
        { id: 'concentric', start_pct: 50, end_pct: 90, easing: 'ease-in',
          label: { en: 'Concentric · Extension Drive', es: 'Concéntrica · Empuje de Extensión', pt: 'Concêntrica · Impulso de Extensão' },
          cue:   { en: 'Drive the attachment forcefully downward through a strict contraction of the triceps until the elbows are completely locked out.',
                   es: 'Empuja el accesorio con fuerza hacia abajo mediante una contracción estricta de los tríceps hasta que los codos estén completamente bloqueados.',
                   pt: 'Empurre o acessório com força para baixo através de uma contração estrita dos tríceps até que os cotovelos estejam completamente travados.' } },
        { id: 'reset', start_pct: 90, end_pct: 100, easing: 'ease-in-out',
          label: { en: 'Reset · Lockout Peak', es: 'Reinicio · Pico de Bloqueo', pt: 'Reinício · Pico de Travamento' },
          cue:   { en: 'Squeeze triceps at lockout.', es: 'Aprieta los tríceps en el bloqueo.', pt: 'Contraia os tríceps no travamento.' } }
      ],
      keyframes: [
        { t: 0.00, phase: 'eccentric',
          joints: {
            head: { x: 0.40, y: 0.20 },
            shoulder_l: { x: 0.40, y: 0.35 }, shoulder_r: { x: 0.40, y: 0.35 },
            elbow_l:    { x: 0.40, y: 0.52 }, elbow_r:    { x: 0.40, y: 0.52 },
            wrist_l:    { x: 0.40, y: 0.70 }, wrist_r:    { x: 0.40, y: 0.70 },
            hip_l:      { x: 0.40, y: 0.60 }, hip_r:      { x: 0.40, y: 0.60 },
            knee_l:     { x: 0.40, y: 0.78 }, knee_r:     { x: 0.40, y: 0.78 },
            ankle_l:    { x: 0.40, y: 0.92 }, ankle_r:    { x: 0.40, y: 0.92 }
          } },
        { t: 0.40, phase: 'eccentric',
          joints: { wrist_l: { x: 0.48, y: 0.38 }, wrist_r: { x: 0.48, y: 0.38 } } },
        { t: 0.50, phase: 'isometric', joints: {} },
        { t: 0.90, phase: 'concentric',
          joints: { wrist_l: { x: 0.40, y: 0.70 }, wrist_r: { x: 0.40, y: 0.70 } } },
        { t: 1.00, phase: 'reset', joints: {} }
      ]
    },

    equipment: [{ type: 'cable_column', attach: ['wrist_l', 'wrist_r'] }],

    kineticPath: {
      default: { label: { en: 'Extension Arc', es: 'Arco de Extensión', pt: 'Arco de Extensão' },
                 d: 'M 0.40 0.70 Q 0.50 0.55 0.48 0.38' },
      endpoints: [{ x: 0.40, y: 0.70 }, { x: 0.48, y: 0.38 }],
      labels: [
        { x: 0.35, y: 0.70, text: { en: 'Lockout',     es: 'Bloqueo',             pt: 'Travamento' } },
        { x: 0.53, y: 0.38, text: { en: 'Max Stretch', es: 'Estiramiento Máximo', pt: 'Alongamento Máximo' } }
      ]
    },

    forms: {
      ok: {
        chipLabel: { en: 'Standard Form', es: 'Forma Estándar', pt: 'Forma Padrão' },
        callouts: [
          { from: 'elbow_l', to: { x: 0.20, y: 0.52 },
            lines: [{ en: 'Elbow pinned to torso', es: 'Codo fijado al torso', pt: 'Cotovelo fixado ao torso' }] }
        ],
        metrics: {
          dev: '± 0.5 cm',
          tuck: { en: 'Scapulae Depressed', es: 'Escápulas Deprimidas', pt: 'Escápulas Deprimidas' },
          load: { en: 'Strict Isolation',   es: 'Aislamiento Estricto', pt: 'Isolamento Estrito' },
          fn:   { en: 'Clinical reference overlay', es: 'Capa de referencia clínica', pt: 'Camada de referência clínica' }
        },
        haloAt: null
      },
      warn: {
        chipLabel: { en: 'Common Fault: Shoulder Roll', es: 'Falla Común: Rotación de Hombros', pt: 'Falha Comum: Rotação dos Ombros' },
        callouts: [
          { from: 'shoulder_l', to: { x: 0.20, y: 0.35 }, warn: true,
            lines: [{ en: 'Shoulders roll forward · Leverage cheat',
                      es: 'Hombros ruedan adelante · Truco de palanca',
                      pt: 'Ombros rolam para frente · Truque de alavanca' }] }
        ],
        metrics: {
          dev: '± 3.0 cm',
          tuck: { en: 'Shoulder Protracted', es: 'Hombro Protraído',          pt: 'Ombro Protraído' },
          load: { en: 'Chest/Delt Assist',   es: 'Asistencia Pecho/Deltoides', pt: 'Assistência Peito/Deltoide' },
          fn:   { en: 'Fault pattern · Bodyweight leverage applied',
                  es: 'Patrón de falla · Se aplica palanca con peso corporal',
                  pt: 'Padrão de falha · Alavancagem com peso corporal aplicada' }
        },
        haloAt: 'shoulder_l',
        keyframesOverride: [
          { t: 0.90, joints: { shoulder_l: { x: 0.45, y: 0.38 }, shoulder_r: { x: 0.45, y: 0.38 },
                               head:       { x: 0.48, y: 0.22 } } }
        ]
      }
    },

    metricLabels: {
      dev:  { en: 'Path Dev.',       es: 'Desv. Trayectoria',  pt: 'Desv. Trajetória' },
      tuck: { en: 'Shoulder Anchor', es: 'Anclaje del Hombro', pt: 'Ancoragem do Ombro' },
      load: { en: 'Muscle Bias',     es: 'Sesgo Muscular',     pt: 'Viés Muscular' }
    }
  };

  // ─── LATERAL RAISES (V2) ─────────────────────────────────
  var LATERAL_RAISES = {
    id: 'lateral_raises',
    displayName: 'Lateral Raises',
    aliases: ['lateral raise', 'lateral raises', 'side raises', 'dumbbell lateral raise', 'dumbbell lateral raises'],

    title: {
      en: 'Clinical Protocol: Lateral Raises',
      es: 'Protocolo Clínico: Elevaciones Laterales',
      pt: 'Protocolo Clínico: Elevações Laterais'
    },
    subtitle: {
      en: 'Frontal Plane · Dumbbells · Sovereign Rig',
      es: 'Plano Frontal · Mancuernas · Equipo Soberano',
      pt: 'Plano Frontal · Halteres · Equipamento Soberano'
    },
    muscleTarget: {
      en: 'Primary: Lateral Deltoid. Secondary: Anterior Deltoid, Supraspinatus, Trapezius, Core Stabilizers.',
      es: 'Primario: Deltoides Lateral. Secundarios: Deltoides Anterior, Supraespinoso, Trapecio, Estabilizadores del Core.',
      pt: 'Primário: Deltoide Lateral. Secundários: Deltoide Anterior, Supraespinhal, Trapézio, Estabilizadores do Core.'
    },
    clinicalNotes: {
      en: 'Execution requires a slight forward lean and rigidly depressed scapulae to strictly isolate the lateral deltoids and minimize upper trapezius dominance. The kinetic chain relies on a highly braced core to entirely prevent any torso swing or momentum generation throughout the movement. Joint health is protected by raising the load with a slight bend in the elbows, stopping at shoulder height to strictly avoid subacromial impingement.',
      es: 'La ejecución requiere una leve inclinación adelante y escápulas rígidamente deprimidas para aislar estrictamente los deltoides laterales y minimizar la dominancia del trapecio superior. La cadena cinética depende de un core altamente activado para prevenir por completo cualquier balanceo del torso o generación de impulso durante el movimiento. La salud articular se protege levantando la carga con una leve flexión de los codos, deteniéndose a la altura del hombro para evitar estrictamente el pinzamiento subacromial.',
      pt: 'A execução requer uma leve inclinação para frente e escápulas rigidamente deprimidas para isolar estritamente os deltoides laterais e minimizar a dominância do trapézio superior. A cadeia cinética depende de um core altamente ativado para prevenir completamente qualquer balanço do torso ou geração de impulso durante o movimento. A saúde articular é protegida elevando a carga com uma leve flexão dos cotovelos, parando na altura do ombro para evitar estritamente o impacto subacromial.'
    },
    svgTitle: {
      en: 'Lateral Raise Frontal Wireframe',
      es: 'Wireframe Frontal de Elevación Lateral',
      pt: 'Wireframe Frontal de Elevação Lateral'
    },

    plane: 'frontal', facing: 'front', ground: { y: 0.92 },
    jointSpec: STD_JOINT_SPEC, bones: STD_BONES,

    animation: {
      duration_ms: 3000, loop: true, direction: 'normal', easing: 'ease-in-out',
      phases: [
        { id: 'eccentric', start_pct: 0, end_pct: 40, easing: 'ease-out',
          label: { en: 'Eccentric · Controlled Drop', es: 'Excéntrica · Descenso Controlado', pt: 'Excêntrica · Descida Controlada' },
          cue:   { en: 'Lower the dumbbells toward your sides with strict, deliberate control to maximize time under tension.',
                   es: 'Baja las mancuernas hacia los costados con control estricto y deliberado para maximizar el tiempo bajo tensión.',
                   pt: 'Abaixe os halteres em direção às laterais com controle estrito e deliberado para maximizar o tempo sob tensão.' } },
        { id: 'isometric', start_pct: 40, end_pct: 50, easing: 'linear',
          label: { en: 'Isometric · Bottom Pause', es: 'Isométrica · Pausa Inferior', pt: 'Isométrica · Pausa no Fundo' },
          cue:   { en: 'Pause motionless at the bottom without letting the dumbbells rest against your torso to maintain continuous tension.',
                   es: 'Haz una pausa sin movimiento abajo sin dejar que las mancuernas descansen contra el torso para mantener la tensión continua.',
                   pt: 'Faça uma pausa sem movimento no fundo sem deixar os halteres descansarem contra o torso para manter a tensão contínua.' } },
        { id: 'concentric', start_pct: 50, end_pct: 90, easing: 'ease-in',
          label: { en: 'Concentric · Lateral Sweep', es: 'Concéntrica · Barrido Lateral', pt: 'Concêntrica · Varredura Lateral' },
          cue:   { en: 'Drive the weight outward and upward through the elbows until the arms are parallel to the floor.',
                   es: 'Impulsa el peso hacia afuera y arriba a través de los codos hasta que los brazos estén paralelos al suelo.',
                   pt: 'Impulsione o peso para fora e para cima através dos cotovelos até que os braços fiquem paralelos ao chão.' } },
        { id: 'reset', start_pct: 90, end_pct: 100, easing: 'ease-in-out',
          label: { en: 'Reset · Peak Hold', es: 'Reinicio · Sostén Máximo', pt: 'Reinício · Sustentação no Pico' },
          cue:   { en: 'Hold parallel alignment.', es: 'Mantén la alineación paralela.', pt: 'Mantenha o alinhamento paralelo.' } }
      ],
      keyframes: [
        { t: 0.00, phase: 'eccentric',
          joints: {
            head: { x: 0.50, y: 0.20 },
            shoulder_l: { x: 0.40, y: 0.35 }, shoulder_r: { x: 0.60, y: 0.35 },
            elbow_l:    { x: 0.20, y: 0.38 }, elbow_r:    { x: 0.80, y: 0.38 },
            wrist_l:    { x: 0.10, y: 0.40 }, wrist_r:    { x: 0.90, y: 0.40 },
            hip_l:      { x: 0.45, y: 0.65 }, hip_r:      { x: 0.55, y: 0.65 },
            knee_l:     { x: 0.40, y: 0.80 }, knee_r:     { x: 0.60, y: 0.80 },
            ankle_l:    { x: 0.40, y: 0.92 }, ankle_r:    { x: 0.60, y: 0.92 }
          } },
        { t: 0.40, phase: 'eccentric',
          joints: {
            elbow_l: { x: 0.35, y: 0.55 }, elbow_r: { x: 0.65, y: 0.55 },
            wrist_l: { x: 0.35, y: 0.65 }, wrist_r: { x: 0.65, y: 0.65 }
          } },
        { t: 0.50, phase: 'isometric', joints: {} },
        { t: 0.90, phase: 'concentric',
          joints: {
            elbow_l: { x: 0.20, y: 0.38 }, elbow_r: { x: 0.80, y: 0.38 },
            wrist_l: { x: 0.10, y: 0.40 }, wrist_r: { x: 0.90, y: 0.40 }
          } },
        { t: 1.00, phase: 'reset', joints: {} }
      ]
    },

    equipment: [{ type: 'dumbbell', attach: ['wrist_l', 'wrist_r'] }],

    kineticPath: {
      default: { label: { en: 'Lateral Arc', es: 'Arco Lateral', pt: 'Arco Lateral' },
                 d: 'M 0.10 0.40 Q 0.20 0.65 0.35 0.65' },
      endpoints: [{ x: 0.10, y: 0.40 }, { x: 0.35, y: 0.65 }],
      labels: [
        { x: 0.15, y: 0.35, text: { en: 'Peak Contraction', es: 'Contracción Máxima', pt: 'Contração Máxima' } },
        { x: 0.35, y: 0.70, text: { en: 'Start',            es: 'Inicio',             pt: 'Início' } }
      ]
    },

    forms: {
      ok: {
        chipLabel: { en: 'Standard Form', es: 'Forma Estándar', pt: 'Forma Padrão' },
        callouts: [
          { from: 'shoulder_l', to: { x: 0.20, y: 0.25 },
            lines: [{ en: 'Shoulders depressed', es: 'Hombros deprimidos', pt: 'Ombros deprimidos' }] }
        ],
        metrics: {
          dev: '± 1.0 cm',
          tuck: { en: 'Scapulae Depressed',   es: 'Escápulas Deprimidas',         pt: 'Escápulas Deprimidas' },
          load: { en: 'Lateral Delt Bias',    es: 'Sesgo del Deltoides Lateral',  pt: 'Viés do Deltoide Lateral' },
          fn:   { en: 'Clinical reference overlay', es: 'Capa de referencia clínica', pt: 'Camada de referência clínica' }
        },
        haloAt: null
      },
      warn: {
        chipLabel: { en: 'Common Fault: Trapezius Shrug', es: 'Falla Común: Encogimiento del Trapecio', pt: 'Falha Comum: Encolhimento do Trapézio' },
        callouts: [
          { from: 'shoulder_l', to: { x: 0.20, y: 0.20 }, warn: true,
            lines: [{ en: 'Trap override · Impingement risk',
                      es: 'Trapecio toma el control · Riesgo de pinzamiento',
                      pt: 'Trapézio assume o controle · Risco de impacto' }] }
        ],
        metrics: {
          dev: '± 4.0 cm',
          tuck: { en: 'Shoulder Elevated',  es: 'Hombro Elevado',                pt: 'Ombro Elevado' },
          load: { en: 'Upper Trap Bias',    es: 'Sesgo del Trapecio Superior',   pt: 'Viés do Trapézio Superior' },
          fn:   { en: 'Fault pattern · Shoulders shrug during raise',
                  es: 'Patrón de falla · Los hombros se encogen durante la elevación',
                  pt: 'Padrão de falha · Ombros encolhem durante a elevação' }
        },
        haloAt: 'shoulder_l',
        keyframesOverride: [
          { t: 0.90, joints: { shoulder_l: { x: 0.40, y: 0.25 }, shoulder_r: { x: 0.60, y: 0.25 },
                               head:       { x: 0.50, y: 0.25 } } }
        ]
      }
    },

    metricLabels: {
      dev:  { en: 'Path Dev.',        es: 'Desv. Trayectoria', pt: 'Desv. Trajetória' },
      tuck: { en: 'Scapular Anchor',  es: 'Anclaje Escapular', pt: 'Ancoragem Escapular' },
      load: { en: 'Muscle Bias',      es: 'Sesgo Muscular',    pt: 'Viés Muscular' }
    }
  };

  // ─── DB FLAT BENCH PRESS (V2 · Batch 2) ──────────────────
  var DB_FLAT_BENCH_PRESS = {
    id: 'db_flat_bench_press',
    displayName: 'DB Flat Bench Press',
    aliases: ['db flat bench press', 'dumbbell flat bench press', 'flat db press', 'dumbbell bench presses', 'flat dumbbell presses', 'db bench'],

    title: {
      en: 'Clinical Protocol: DB Flat Bench Press',
      es: 'Protocolo Clínico: Press Plano con Mancuernas',
      pt: 'Protocolo Clínico: Supino Reto com Halteres'
    },
    subtitle: {
      en: 'Transverse Plane · Dumbbells · Sovereign Rig',
      es: 'Plano Transversal · Mancuernas · Equipo Soberano',
      pt: 'Plano Transversal · Halteres · Equipamento Soberano'
    },
    muscleTarget: {
      en: 'Primary: Pectoralis Major. Secondary: Anterior Deltoid, Triceps Brachii, Core Stabilizers.',
      es: 'Primario: Pectoral Mayor. Secundarios: Deltoides Anterior, Tríceps Braquial, Estabilizadores del Core.',
      pt: 'Primário: Peitoral Maior. Secundários: Deltoide Anterior, Tríceps Braquial, Estabilizadores do Core.'
    },
    clinicalNotes: {
      en: 'Perfect Sovereign execution demands retracted and depressed scapulae pinned rigidly into the bench to ensure strict isolation of the pectoralis major and to protect the glenohumeral joint. The kinetic chain relies on a stable five-point contact system—feet, glutes, upper back, and head—paired with active intra-abdominal pressure to entirely prevent energy leakage. Optimal joint health is preserved by keeping the elbows tucked at a 45-to-60-degree angle to the torso, strictly avoiding subacromial impingement during the press.',
      es: 'La ejecución soberana perfecta exige escápulas retraídas y deprimidas rígidamente fijadas al banco para garantizar el aislamiento estricto del pectoral mayor y proteger la articulación glenohumeral. La cadena cinética depende de un sistema de cinco puntos de contacto estable—pies, glúteos, espalda alta y cabeza—junto con presión intraabdominal activa para prevenir por completo cualquier fuga de energía. La salud articular óptima se preserva manteniendo los codos retraídos en un ángulo de 45 a 60 grados respecto al torso, evitando estrictamente el pinzamiento subacromial durante el empuje.',
      pt: 'A execução soberana perfeita exige escápulas retraídas e deprimidas rigidamente pressionadas contra o banco para garantir o isolamento estrito do peitoral maior e proteger a articulação glenoumeral. A cadeia cinética depende de um sistema estável de cinco pontos de contato—pés, glúteos, costas superiores e cabeça—em conjunto com pressão intra-abdominal ativa para prevenir completamente qualquer perda de energia. A saúde articular ótima é preservada mantendo os cotovelos retraídos em um ângulo de 45 a 60 graus em relação ao torso, evitando estritamente o impacto subacromial durante a pressão.'
    },
    svgTitle: {
      en: 'DB Bench Press Sagittal Wireframe',
      es: 'Wireframe Sagital de Press con Mancuernas',
      pt: 'Wireframe Sagital de Supino com Halteres'
    },

    plane: 'sagittal', facing: 'right', ground: { y: 0.92 },
    jointSpec: STD_JOINT_SPEC, bones: STD_BONES,

    animation: {
      duration_ms: 3500, loop: true, direction: 'normal', easing: 'ease-in-out',
      phases: [
        { id: 'eccentric', start_pct: 0, end_pct: 40, easing: 'ease-out',
          label: { en: 'Eccentric · Loaded Descent', es: 'Excéntrica · Descenso con Carga', pt: 'Excêntrica · Descida Carregada' },
          cue:   { en: 'Lower the dumbbells with deliberate pacing, maintaining tucked elbows, until a maximal, safe stretch is achieved across the chest.',
                   es: 'Baja las mancuernas con un ritmo deliberado, manteniendo los codos retraídos, hasta lograr un estiramiento máximo y seguro del pecho.',
                   pt: 'Abaixe os halteres com ritmo deliberado, mantendo os cotovelos retraídos, até alcançar um alongamento máximo e seguro do peito.' } },
        { id: 'isometric', start_pct: 40, end_pct: 50, easing: 'linear',
          label: { en: 'Isometric · Deep Stretch', es: 'Isométrica · Estiramiento Profundo', pt: 'Isométrica · Alongamento Profundo' },
          cue:   { en: 'Pause motionless at the deepest point of the stretch to dissipate downward momentum and maximize mechanical tension on the pectorals.',
                   es: 'Haz una pausa sin movimiento en el punto más profundo del estiramiento para disipar el impulso descendente y maximizar la tensión mecánica sobre los pectorales.',
                   pt: 'Faça uma pausa sem movimento no ponto mais profundo do alongamento para dissipar o impulso descendente e maximizar a tensão mecânica sobre os peitorais.' } },
        { id: 'concentric', start_pct: 50, end_pct: 90, easing: 'ease-in',
          label: { en: 'Concentric · Press Drive', es: 'Concéntrica · Empuje de Presión', pt: 'Concêntrica · Impulso de Pressão' },
          cue:   { en: 'Drive the dumbbells forcefully upward and inward through a strict contraction of the chest until the elbows reach full extension.',
                   es: 'Empuja las mancuernas con fuerza hacia arriba y hacia adentro mediante una contracción estricta del pecho hasta que los codos alcancen la extensión completa.',
                   pt: 'Empurre os halteres com força para cima e para dentro através de uma contração estrita do peito até que os cotovelos alcancem a extensão completa.' } },
        { id: 'reset', start_pct: 90, end_pct: 100, easing: 'ease-in-out',
          label: { en: 'Reset · Lockout Dwell', es: 'Reinicio · Pausa en Bloqueo', pt: 'Reinício · Pausa no Travamento' },
          cue:   { en: 'Maintain scapular retraction.', es: 'Mantén la retracción escapular.', pt: 'Mantenha a retração escapular.' } }
      ],
      keyframes: [
        { t: 0.00, phase: 'eccentric',
          joints: {
            head: { x: 0.75, y: 0.65 },
            shoulder_l: { x: 0.60, y: 0.65 }, shoulder_r: { x: 0.60, y: 0.65 },
            hip_l:      { x: 0.30, y: 0.65 }, hip_r:      { x: 0.30, y: 0.65 },
            knee_l:     { x: 0.30, y: 0.80 }, knee_r:     { x: 0.30, y: 0.80 },
            ankle_l:    { x: 0.40, y: 0.92 }, ankle_r:    { x: 0.40, y: 0.92 },
            elbow_l:    { x: 0.60, y: 0.35 }, elbow_r:    { x: 0.60, y: 0.35 },
            wrist_l:    { x: 0.60, y: 0.15 }, wrist_r:    { x: 0.60, y: 0.15 }
          } },
        { t: 0.40, phase: 'eccentric',
          joints: {
            elbow_l: { x: 0.60, y: 0.80 }, elbow_r: { x: 0.60, y: 0.80 },
            wrist_l: { x: 0.60, y: 0.60 }, wrist_r: { x: 0.60, y: 0.60 }
          } },
        { t: 0.50, phase: 'isometric', joints: {} },
        { t: 0.90, phase: 'concentric',
          joints: {
            elbow_l: { x: 0.60, y: 0.35 }, elbow_r: { x: 0.60, y: 0.35 },
            wrist_l: { x: 0.60, y: 0.15 }, wrist_r: { x: 0.60, y: 0.15 }
          } },
        { t: 1.00, phase: 'reset', joints: {} }
      ]
    },

    equipment: [{ type: 'dumbbell', attach: ['wrist_l', 'wrist_r'] }],

    kineticPath: {
      default: { label: { en: 'Press Vector', es: 'Vector de Presión', pt: 'Vetor de Pressão' },
                 d: 'M 0.60 0.15 L 0.60 0.60' },
      endpoints: [{ x: 0.60, y: 0.15 }, { x: 0.60, y: 0.60 }],
      labels: [
        { x: 0.55, y: 0.15, text: { en: 'Lockout',     es: 'Bloqueo',             pt: 'Travamento' } },
        { x: 0.55, y: 0.65, text: { en: 'Max Stretch', es: 'Estiramiento Máximo', pt: 'Alongamento Máximo' } }
      ]
    },

    forms: {
      ok: {
        chipLabel: { en: 'Standard Form', es: 'Forma Estándar', pt: 'Forma Padrão' },
        callouts: [
          { from: 'shoulder_l', to: { x: 0.70, y: 0.50 },
            lines: [{ en: 'Scapulae pinned to bench', es: 'Escápulas fijadas al banco', pt: 'Escápulas fixadas ao banco' }] }
        ],
        metrics: {
          dev: '± 1.0 cm',
          tuck: { en: 'Retracted',     es: 'Retraídas',     pt: 'Retraídas' },
          load: { en: 'Pectoral Bias', es: 'Sesgo Pectoral', pt: 'Viés Peitoral' },
          fn:   { en: 'Clinical reference overlay', es: 'Capa de referencia clínica', pt: 'Camada de referência clínica' }
        },
        haloAt: null
      },
      warn: {
        chipLabel: { en: 'Common Fault: Shoulder Protraction', es: 'Falla Común: Protracción de Hombros', pt: 'Falha Comum: Protração dos Ombros' },
        callouts: [
          { from: 'shoulder_l', to: { x: 0.70, y: 0.50 }, warn: true,
            lines: [{ en: 'Shoulders lift · Impingement risk',
                      es: 'Hombros se elevan · Riesgo de pinzamiento',
                      pt: 'Ombros sobem · Risco de impacto' }] }
        ],
        metrics: {
          dev: '± 4.0 cm',
          tuck: { en: 'Protracted',                es: 'Protraídas',                       pt: 'Protraídas' },
          load: { en: 'Anterior Delt Overload',    es: 'Sobrecarga del Deltoides Anterior', pt: 'Sobrecarga do Deltoide Anterior' },
          fn:   { en: 'Fault pattern · Shoulders roll off bench',
                  es: 'Patrón de falla · Los hombros se despegan del banco',
                  pt: 'Padrão de falha · Ombros desencostam do banco' }
        },
        haloAt: 'shoulder_l',
        keyframesOverride: [
          { t: 0.90, joints: { shoulder_l: { x: 0.60, y: 0.55 }, shoulder_r: { x: 0.60, y: 0.55 } } }
        ]
      }
    },

    metricLabels: {
      dev:  { en: 'Path Dev.',       es: 'Desv. Trayectoria',  pt: 'Desv. Trajetória' },
      tuck: { en: 'Scapular Anchor', es: 'Anclaje Escapular',  pt: 'Ancoragem Escapular' },
      load: { en: 'Joint Load',      es: 'Carga Articular',    pt: 'Carga Articular' }
    }
  };

  // ─── HEAVY LEG PRESS (V2 · Batch 2) ──────────────────────
  // Note: equipment.type 'plate' is preserved as-supplied; current
  // transpiler equipment vocab handles bar/trap_bar/bench/rack/sled/
  // pulley_arm/dumbbell/kettlebell/machine_pad/plate_stack/
  // cable_column/stability_ball — 'plate' is silently skipped at
  // render time (figure animates without an equipment marker).
  // Adding a 'plate' handler is a follow-on transpiler PR.
  var HEAVY_LEG_PRESS = {
    id: 'heavy_leg_press',
    displayName: 'Heavy Leg Press',
    aliases: ['heavy leg press', 'leg presses', 'machine leg press', '45-degree leg press', 'seated leg press', 'incline leg press', 'leg press'],

    title: {
      en: 'Clinical Protocol: Heavy Leg Press',
      es: 'Protocolo Clínico: Prensa de Piernas Pesada',
      pt: 'Protocolo Clínico: Leg Press Pesado'
    },
    subtitle: {
      en: 'Sagittal Plane · Machine · Sovereign Rig',
      es: 'Plano Sagital · Máquina · Equipo Soberano',
      pt: 'Plano Sagital · Máquina · Equipamento Soberano'
    },
    muscleTarget: {
      en: 'Primary: Quadriceps, Gluteus Maximus. Secondary: Hamstrings, Adductor Magnus, Calves.',
      es: 'Primarios: Cuádriceps, Glúteo Mayor. Secundarios: Isquiotibiales, Aductor Mayor, Pantorrillas.',
      pt: 'Primários: Quadríceps, Glúteo Máximo. Secundários: Isquiotibiais, Adutor Magno, Panturrilhas.'
    },
    clinicalNotes: {
      en: 'Execution demands that the lumbar spine and pelvis remain rigidly pinned against the back pad throughout the entire range of motion to strictly prevent posterior pelvic tilt and spinal flexion. The kinetic chain requires active foot tracking, ensuring the knees align perfectly with the toes while distributing the load evenly across the mid-foot and heel. Joint health is optimized by descending only to the absolute limit of active hip mobility, strictly avoiding passive tissue compression or lower back rounding at the bottom of the sled track.',
      es: 'La ejecución exige que la columna lumbar y la pelvis permanezcan rígidamente fijadas contra el respaldo durante todo el rango de movimiento para prevenir estrictamente la inclinación pélvica posterior y la flexión espinal. La cadena cinética requiere un seguimiento activo del pie, asegurando que las rodillas se alineen perfectamente con los dedos del pie mientras distribuyen la carga uniformemente entre la planta media y el talón. La salud articular se optimiza descendiendo solo hasta el límite absoluto de la movilidad activa de cadera, evitando estrictamente la compresión pasiva de tejidos o el redondeo lumbar en el fondo del recorrido del trineo.',
      pt: 'A execução exige que a coluna lombar e a pelve permaneçam rigidamente pressionadas contra o encosto durante toda a amplitude de movimento para prevenir estritamente a inclinação pélvica posterior e a flexão espinhal. A cadeia cinética requer rastreamento ativo do pé, garantindo que os joelhos se alinhem perfeitamente com os dedos do pé enquanto distribuem a carga uniformemente entre o meio do pé e o calcanhar. A saúde articular é otimizada descendo apenas até o limite absoluto da mobilidade ativa do quadril, evitando estritamente a compressão passiva de tecidos ou o arredondamento lombar no fundo da trajetória do trenó.'
    },
    svgTitle: {
      en: 'Leg Press Sagittal Wireframe',
      es: 'Wireframe Sagital de Prensa de Piernas',
      pt: 'Wireframe Sagital de Leg Press'
    },

    plane: 'sagittal', facing: 'right', ground: { y: 0.92 },
    jointSpec: STD_JOINT_SPEC, bones: STD_BONES,

    animation: {
      duration_ms: 3500, loop: true, direction: 'normal', easing: 'ease-in-out',
      phases: [
        { id: 'eccentric', start_pct: 0, end_pct: 40, easing: 'ease-out',
          label: { en: 'Eccentric · Sled Descent', es: 'Excéntrica · Descenso del Trineo', pt: 'Excêntrica · Descida do Trenó' },
          cue:   { en: 'Lower the sled with strict, deliberate control, allowing deep knee and hip flexion without letting the lower back peel off the pad.',
                   es: 'Baja el trineo con control estricto y deliberado, permitiendo una flexión profunda de rodilla y cadera sin dejar que la espalda baja se despegue del respaldo.',
                   pt: 'Abaixe o trenó com controle estrito e deliberado, permitindo flexão profunda de joelho e quadril sem deixar a região lombar desencostar do encosto.' } },
        { id: 'isometric', start_pct: 40, end_pct: 50, easing: 'linear',
          label: { en: 'Isometric · Active Bottom Hold', es: 'Isométrica · Pausa Activa Inferior', pt: 'Isométrica · Pausa Ativa no Fundo' },
          cue:   { en: 'Hold the deepest safe position motionless to arrest downward momentum and maximize mechanical tension in the quadriceps and gluteals.',
                   es: 'Mantén la posición más profunda segura sin movimiento para detener el impulso descendente y maximizar la tensión mecánica en los cuádriceps y glúteos.',
                   pt: 'Mantenha a posição mais profunda segura sem movimento para frear o impulso descendente e maximizar a tensão mecânica nos quadríceps e glúteos.' } },
        { id: 'concentric', start_pct: 50, end_pct: 90, easing: 'ease-in',
          label: { en: 'Concentric · Press Drive', es: 'Concéntrica · Empuje de Presión', pt: 'Concêntrica · Impulso de Pressão' },
          cue:   { en: 'Drive forcefully upward through the mid-foot and heels to extend the knees and hips, stopping just short of a bone-on-bone joint lockout.',
                   es: 'Empuja con fuerza hacia arriba desde la planta media del pie y los talones para extender rodillas y caderas, deteniéndote justo antes del bloqueo articular hueso contra hueso.',
                   pt: 'Empurre com força para cima através do meio do pé e calcanhares para estender joelhos e quadris, parando logo antes do travamento articular osso contra osso.' } },
        { id: 'reset', start_pct: 90, end_pct: 100, easing: 'ease-in-out',
          label: { en: 'Reset · Soft Lockout', es: 'Reinicio · Bloqueo Suave', pt: 'Reinício · Travamento Suave' },
          cue:   { en: 'Maintain tension, do not hyperextend knees.', es: 'Mantén la tensión, no hiperextiendas las rodillas.', pt: 'Mantenha a tensão, não hiperestenda os joelhos.' } }
      ],
      keyframes: [
        { t: 0.00, phase: 'eccentric',
          joints: {
            head: { x: 0.20, y: 0.40 },
            shoulder_l: { x: 0.25, y: 0.50 }, shoulder_r: { x: 0.25, y: 0.50 },
            elbow_l:    { x: 0.30, y: 0.60 }, elbow_r:    { x: 0.30, y: 0.60 },
            wrist_l:    { x: 0.35, y: 0.70 }, wrist_r:    { x: 0.35, y: 0.70 },
            hip_l:      { x: 0.35, y: 0.70 }, hip_r:      { x: 0.35, y: 0.70 },
            knee_l:     { x: 0.60, y: 0.45 }, knee_r:     { x: 0.60, y: 0.45 },
            ankle_l:    { x: 0.75, y: 0.30 }, ankle_r:    { x: 0.75, y: 0.30 }
          } },
        { t: 0.40, phase: 'eccentric',
          joints: {
            knee_l: { x: 0.40, y: 0.55 }, knee_r: { x: 0.40, y: 0.55 },
            ankle_l: { x: 0.50, y: 0.45 }, ankle_r: { x: 0.50, y: 0.45 }
          } },
        { t: 0.50, phase: 'isometric', joints: {} },
        { t: 0.90, phase: 'concentric',
          joints: {
            knee_l: { x: 0.60, y: 0.45 }, knee_r: { x: 0.60, y: 0.45 },
            ankle_l: { x: 0.75, y: 0.30 }, ankle_r: { x: 0.75, y: 0.30 }
          } },
        { t: 1.00, phase: 'reset', joints: {} }
      ]
    },

    equipment: [{ type: 'plate', attach: ['ankle_l', 'ankle_r'] }],

    kineticPath: {
      default: { label: { en: 'Sled Path', es: 'Trayectoria del Trineo', pt: 'Trajetória do Trenó' },
                 d: 'M 0.75 0.30 L 0.50 0.45' },
      endpoints: [{ x: 0.75, y: 0.30 }, { x: 0.50, y: 0.45 }],
      labels: [
        { x: 0.80, y: 0.30, text: { en: 'Soft Lockout', es: 'Bloqueo Suave',         pt: 'Travamento Suave' } },
        { x: 0.55, y: 0.45, text: { en: 'Max Depth',    es: 'Profundidad Máxima',    pt: 'Profundidade Máxima' } }
      ]
    },

    forms: {
      ok: {
        chipLabel: { en: 'Standard Form', es: 'Forma Estándar', pt: 'Forma Padrão' },
        callouts: [
          { from: 'hip_l', to: { x: 0.25, y: 0.70 },
            lines: [{ en: 'Pelvis pinned to pad', es: 'Pelvis fijada al respaldo', pt: 'Pelve fixada ao encosto' }] }
        ],
        metrics: {
          dev: '± 1.0 cm',
          tuck: { en: 'Neutral Pelvis',       es: 'Pelvis Neutra',                  pt: 'Pelve Neutra' },
          load: { en: 'Quad/Glute Balanced',  es: 'Cuádriceps/Glúteos Equilibrado', pt: 'Quadríceps/Glúteo Equilibrado' },
          fn:   { en: 'Clinical reference overlay', es: 'Capa de referencia clínica', pt: 'Camada de referência clínica' }
        },
        haloAt: null
      },
      warn: {
        chipLabel: { en: 'Common Fault: Lumbar Flexion', es: 'Falla Común: Flexión Lumbar', pt: 'Falha Comum: Flexão Lombar' },
        callouts: [
          { from: 'hip_l', to: { x: 0.25, y: 0.60 }, warn: true,
            lines: [{ en: 'Butt wink · Disc Shear',
                      es: 'Inclinación pélvica · Cizalla discal',
                      pt: 'Inclinação pélvica · Cisalhamento discal' }] }
        ],
        metrics: {
          dev: '± 4.0 cm',
          tuck: { en: 'Posterior Tilt',  es: 'Inclinación Posterior', pt: 'Inclinação Posterior' },
          load: { en: 'Lumbar Overload', es: 'Sobrecarga Lumbar',     pt: 'Sobrecarga Lombar' },
          fn:   { en: 'Fault pattern · Hips peel off back pad at bottom',
                  es: 'Patrón de falla · Las caderas se despegan del respaldo en el fondo',
                  pt: 'Padrão de falha · Quadris desencostam do encosto no fundo' }
        },
        haloAt: 'hip_l',
        keyframesOverride: [
          { t: 0.40, joints: { hip_l: { x: 0.40, y: 0.65 }, hip_r: { x: 0.40, y: 0.65 } } }
        ]
      }
    },

    metricLabels: {
      dev:  { en: 'Path Dev.',     es: 'Desv. Trayectoria', pt: 'Desv. Trajetória' },
      tuck: { en: 'Pelvic Anchor', es: 'Anclaje Pélvico',   pt: 'Ancoragem Pélvica' },
      load: { en: 'Tissue Load',   es: 'Carga Tisular',     pt: 'Carga Tecidual' }
    }
  };

  // ─── BULGARIAN SPLIT SQUATS (V2 · Batch 2) ───────────────
  var BULGARIAN_SPLIT_SQUATS = {
    id: 'bulgarian_split_squats',
    displayName: 'Bulgarian Split Squats',
    aliases: ['bulgarian split squats', 'rear foot elevated split squats', 'rfess', 'bulgarian squat', 'bulgarians', 'bss', 'single leg split squat'],

    title: {
      en: 'Clinical Protocol: Bulgarian Split Squats',
      es: 'Protocolo Clínico: Sentadilla Búlgara',
      pt: 'Protocolo Clínico: Agachamento Búlgaro'
    },
    subtitle: {
      en: 'Sagittal Plane · Dumbbells · Sovereign Rig',
      es: 'Plano Sagital · Mancuernas · Equipo Soberano',
      pt: 'Plano Sagital · Halteres · Equipamento Soberano'
    },
    muscleTarget: {
      en: 'Primary: Quadriceps, Gluteus Maximus. Secondary: Hamstrings, Adductor Magnus, Core Stabilizers, Calves.',
      es: 'Primarios: Cuádriceps, Glúteo Mayor. Secundarios: Isquiotibiales, Aductor Mayor, Estabilizadores del Core, Pantorrillas.',
      pt: 'Primários: Quadríceps, Glúteo Máximo. Secundários: Isquiotibiais, Adutor Magno, Estabilizadores do Core, Panturrilhas.'
    },
    clinicalNotes: {
      en: 'Execution requires a highly braced core and a rigid, slightly hinged torso to navigate dynamic unilateral loading while maintaining absolute pelvic neutrality. The kinetic chain depends on maximal drive through the lead mid-foot, utilizing the elevated rear foot purely for balance to minimize unwanted hip flexor tension in the trailing leg. Joint articulation and health are preserved by allowing the lead knee to track naturally over the toes while strictly preventing any valgus collapse during the ascent.',
      es: 'La ejecución requiere un core altamente activado y un torso rígido y ligeramente flexionado para navegar la carga unilateral dinámica manteniendo la neutralidad pélvica absoluta. La cadena cinética depende del empuje máximo a través de la planta media del pie líder, utilizando el pie trasero elevado puramente para el equilibrio y minimizar la tensión no deseada del flexor de cadera en la pierna trasera. La articulación y la salud articular se preservan permitiendo que la rodilla líder siga naturalmente la línea de los dedos del pie mientras se previene estrictamente cualquier colapso en valgo durante el ascenso.',
      pt: 'A execução requer um core altamente ativado e um torso rígido e ligeiramente flexionado para navegar a carga unilateral dinâmica mantendo a neutralidade pélvica absoluta. A cadeia cinética depende do impulso máximo através do meio do pé líder, utilizando o pé traseiro elevado puramente para equilíbrio e minimizar a tensão indesejada do flexor do quadril na perna traseira. A articulação e a saúde articular são preservadas permitindo que o joelho líder siga naturalmente a linha dos dedos do pé enquanto previne estritamente qualquer colapso em valgo durante a subida.'
    },
    svgTitle: {
      en: 'Bulgarian Split Squat Sagittal Wireframe',
      es: 'Wireframe Sagital de Sentadilla Búlgara',
      pt: 'Wireframe Sagital de Agachamento Búlgaro'
    },

    plane: 'sagittal', facing: 'right', ground: { y: 0.92 },
    jointSpec: STD_JOINT_SPEC, bones: STD_BONES,

    animation: {
      duration_ms: 3500, loop: true, direction: 'normal', easing: 'ease-in-out',
      phases: [
        { id: 'eccentric', start_pct: 0, end_pct: 40, easing: 'ease-out',
          label: { en: 'Eccentric · Single Leg Descent', es: 'Excéntrica · Descenso a Una Pierna', pt: 'Excêntrica · Descida em Uma Perna' },
          cue:   { en: 'Lower your center of mass with strict control until the lead thigh is parallel to the floor and the rear knee hovers just above the ground.',
                   es: 'Baja tu centro de masa con control estricto hasta que el muslo líder esté paralelo al suelo y la rodilla trasera quede justo por encima del suelo.',
                   pt: 'Abaixe seu centro de massa com controle estrito até que a coxa líder fique paralela ao chão e o joelho de trás fique logo acima do solo.' } },
        { id: 'isometric', start_pct: 40, end_pct: 50, easing: 'linear',
          label: { en: 'Isometric · Stabilization Hold', es: 'Isométrica · Pausa de Estabilización', pt: 'Isométrica · Pausa de Estabilização' },
          cue:   { en: 'Hold the deepest point of the squat motionless to entirely eliminate momentum and deeply challenge joint stability.',
                   es: 'Mantén el punto más profundo de la sentadilla sin movimiento para eliminar por completo el impulso y desafiar profundamente la estabilidad articular.',
                   pt: 'Mantenha o ponto mais profundo do agachamento sem movimento para eliminar completamente o impulso e desafiar profundamente a estabilidade articular.' } },
        { id: 'concentric', start_pct: 50, end_pct: 90, easing: 'ease-in',
          label: { en: 'Concentric · Lead Drive', es: 'Concéntrica · Empuje Líder', pt: 'Concêntrica · Impulso Líder' },
          cue:   { en: 'Drive forcefully upward through the front mid-foot to extend the lead knee and hip simultaneously back to the starting position.',
                   es: 'Empuja con fuerza hacia arriba desde la planta media del pie frontal para extender la rodilla y la cadera líderes simultáneamente hasta la posición inicial.',
                   pt: 'Empurre com força para cima através do meio do pé da frente para estender o joelho e o quadril líderes simultaneamente até a posição inicial.' } },
        { id: 'reset', start_pct: 90, end_pct: 100, easing: 'ease-in-out',
          label: { en: 'Reset · Balance', es: 'Reinicio · Equilibrio', pt: 'Reinício · Equilíbrio' },
          cue:   { en: 'Re-establish core brace.', es: 'Restablece la activación del core.', pt: 'Restabeleça a ativação do core.' } }
      ],
      keyframes: [
        { t: 0.00, phase: 'eccentric',
          joints: {
            head: { x: 0.50, y: 0.20 },
            shoulder_l: { x: 0.50, y: 0.35 }, shoulder_r: { x: 0.50, y: 0.35 },
            elbow_l:    { x: 0.50, y: 0.48 }, elbow_r:    { x: 0.50, y: 0.48 },
            wrist_l:    { x: 0.50, y: 0.60 }, wrist_r:    { x: 0.50, y: 0.60 },
            hip_l:      { x: 0.50, y: 0.60 }, hip_r:      { x: 0.50, y: 0.60 },
            knee_l:     { x: 0.60, y: 0.78 }, knee_r:     { x: 0.40, y: 0.78 },
            ankle_l:    { x: 0.60, y: 0.92 }, ankle_r:    { x: 0.20, y: 0.78 }
          } },
        { t: 0.40, phase: 'eccentric',
          joints: {
            head: { x: 0.50, y: 0.35 },
            shoulder_l: { x: 0.50, y: 0.50 }, shoulder_r: { x: 0.50, y: 0.50 },
            elbow_l:    { x: 0.50, y: 0.63 }, elbow_r:    { x: 0.50, y: 0.63 },
            wrist_l:    { x: 0.50, y: 0.75 }, wrist_r:    { x: 0.50, y: 0.75 },
            hip_l:      { x: 0.50, y: 0.75 }, hip_r:      { x: 0.50, y: 0.75 },
            knee_l:     { x: 0.65, y: 0.75 }, knee_r:     { x: 0.40, y: 0.90 }
          } },
        { t: 0.50, phase: 'isometric', joints: {} },
        { t: 0.90, phase: 'concentric',
          joints: {
            head: { x: 0.50, y: 0.20 },
            shoulder_l: { x: 0.50, y: 0.35 }, shoulder_r: { x: 0.50, y: 0.35 },
            elbow_l:    { x: 0.50, y: 0.48 }, elbow_r:    { x: 0.50, y: 0.48 },
            wrist_l:    { x: 0.50, y: 0.60 }, wrist_r:    { x: 0.50, y: 0.60 },
            hip_l:      { x: 0.50, y: 0.60 }, hip_r:      { x: 0.50, y: 0.60 },
            knee_l:     { x: 0.60, y: 0.78 }, knee_r:     { x: 0.40, y: 0.78 }
          } },
        { t: 1.00, phase: 'reset', joints: {} }
      ]
    },

    equipment: [{ type: 'dumbbell', attach: ['wrist_l', 'wrist_r'] }],

    kineticPath: {
      default: { label: { en: 'Vertical Descent', es: 'Descenso Vertical', pt: 'Descida Vertical' },
                 d: 'M 0.50 0.60 L 0.50 0.75' },
      endpoints: [{ x: 0.50, y: 0.60 }, { x: 0.50, y: 0.75 }],
      labels: [
        { x: 0.55, y: 0.60, text: { en: 'Start',     es: 'Inicio',              pt: 'Início' } },
        { x: 0.55, y: 0.75, text: { en: 'Max Depth', es: 'Profundidad Máxima',  pt: 'Profundidade Máxima' } }
      ]
    },

    forms: {
      ok: {
        chipLabel: { en: 'Standard Form', es: 'Forma Estándar', pt: 'Forma Padrão' },
        callouts: [
          { from: 'knee_l', to: { x: 0.80, y: 0.75 },
            lines: [{ en: 'Knee tracks toe naturally',
                      es: 'Rodilla sigue naturalmente la punta del pie',
                      pt: 'Joelho acompanha naturalmente a ponta do pé' }] }
        ],
        metrics: {
          dev: '± 1.0 cm',
          tuck: { en: 'Rigid Torso',       es: 'Torso Rígido',                  pt: 'Torso Rígido' },
          load: { en: 'Lead Quad Bias',    es: 'Sesgo del Cuádriceps Líder',    pt: 'Viés do Quadríceps Líder' },
          fn:   { en: 'Clinical reference overlay', es: 'Capa de referencia clínica', pt: 'Camada de referência clínica' }
        },
        haloAt: null
      },
      warn: {
        chipLabel: { en: 'Common Fault: Excessive Knee Shear', es: 'Falla Común: Cizalla Excesiva de Rodilla', pt: 'Falha Comum: Cisalhamento Excessivo do Joelho' },
        callouts: [
          { from: 'knee_l', to: { x: 0.80, y: 0.75 }, warn: true,
            lines: [{ en: 'Heel lift · Patellar stress',
                      es: 'Talón levantado · Estrés rotuliano',
                      pt: 'Calcanhar levantado · Estresse patelar' }] }
        ],
        metrics: {
          dev: '± 4.0 cm',
          tuck: { en: 'Forward Lean',         es: 'Inclinación Adelante',         pt: 'Inclinação para Frente' },
          load: { en: 'Knee Joint Overload',  es: 'Sobrecarga Articular de Rodilla', pt: 'Sobrecarga Articular do Joelho' },
          fn:   { en: 'Fault pattern · Knee travels excessively forward, heel lifts',
                  es: 'Patrón de falla · La rodilla avanza excesivamente, el talón se levanta',
                  pt: 'Padrão de falha · O joelho avança excessivamente, o calcanhar levanta' }
        },
        haloAt: 'knee_l',
        keyframesOverride: [
          { t: 0.40, joints: { knee_l: { x: 0.75, y: 0.80 }, hip_l: { x: 0.45, y: 0.75 }, hip_r: { x: 0.45, y: 0.75 } } }
        ]
      }
    },

    metricLabels: {
      dev:  { en: 'Path Dev.',     es: 'Desv. Trayectoria',  pt: 'Desv. Trajetória' },
      tuck: { en: 'Torso Posture', es: 'Postura del Torso',  pt: 'Postura do Torso' },
      load: { en: 'Joint Load',    es: 'Carga Articular',    pt: 'Carga Articular' }
    }
  };

  // ─── SEATED CABLE ROWS (V2 · Batch 2) ────────────────────
  var SEATED_CABLE_ROWS = {
    id: 'seated_cable_rows',
    displayName: 'Seated Cable Rows',
    aliases: ['seated cable rows', 'cable rows', 'low rows', 'seated low row', 'machine cable row', 'pulley rows', 'neutral grip cable rows'],

    title: {
      en: 'Clinical Protocol: Seated Cable Rows',
      es: 'Protocolo Clínico: Remos en Polea Sentado',
      pt: 'Protocolo Clínico: Remada Sentada na Polia'
    },
    subtitle: {
      en: 'Sagittal Plane · Cable · Sovereign Rig',
      es: 'Plano Sagital · Polea · Equipo Soberano',
      pt: 'Plano Sagital · Cabo · Equipamento Soberano'
    },
    muscleTarget: {
      en: 'Primary: Latissimus Dorsi, Rhomboids, Middle Trapezius. Secondary: Posterior Deltoid, Biceps Brachii, Brachialis, Erector Spinae.',
      es: 'Primarios: Dorsal Ancho, Romboides, Trapecio Medio. Secundarios: Deltoides Posterior, Bíceps Braquial, Braquial, Erectores Espinales.',
      pt: 'Primários: Latíssimo do Dorso, Romboides, Trapézio Médio. Secundários: Deltoide Posterior, Bíceps Braquial, Braquial, Eretores da Espinha.'
    },
    clinicalNotes: {
      en: 'Perfect Sovereign execution necessitates an upright, rigidly braced torso with strictly depressed scapulae to isolate the back musculature and prevent upper trapezius dominance. The kinetic chain relies on initiating the pull through scapular retraction rather than elbow flexion, entirely eliminating lumbar hyperextension or backward momentum generation. Joint health is protected by pulling the attachment to the lower abdomen while keeping the elbows pinned close to the torso, avoiding anterior humeral glide at the peak of the movement.',
      es: 'La ejecución soberana perfecta requiere un torso erguido, rígidamente activado con escápulas estrictamente deprimidas para aislar la musculatura de la espalda y prevenir la dominancia del trapecio superior. La cadena cinética depende de iniciar la tracción mediante retracción escapular en lugar de flexión del codo, eliminando por completo la hiperextensión lumbar o la generación de impulso hacia atrás. La salud articular se protege tirando del accesorio hacia el abdomen inferior manteniendo los codos pegados al torso, evitando el deslizamiento humeral anterior en el pico del movimiento.',
      pt: 'A execução soberana perfeita necessita de um torso ereto, rigidamente ativado com escápulas estritamente deprimidas para isolar a musculatura das costas e prevenir a dominância do trapézio superior. A cadeia cinética depende de iniciar a tração através da retração escapular em vez da flexão do cotovelo, eliminando completamente a hiperextensão lombar ou a geração de impulso para trás. A saúde articular é protegida puxando o acessório em direção ao abdômen inferior mantendo os cotovelos pressionados contra o torso, evitando o deslizamento umeral anterior no pico do movimento.'
    },
    svgTitle: {
      en: 'Seated Cable Row Sagittal Wireframe',
      es: 'Wireframe Sagital de Remo en Polea Sentado',
      pt: 'Wireframe Sagital de Remada Sentada na Polia'
    },

    plane: 'sagittal', facing: 'right', ground: { y: 0.92 },
    jointSpec: STD_JOINT_SPEC, bones: STD_BONES,

    animation: {
      duration_ms: 3500, loop: true, direction: 'normal', easing: 'ease-in-out',
      phases: [
        { id: 'eccentric', start_pct: 0, end_pct: 40, easing: 'ease-out',
          label: { en: 'Eccentric · Forward Stretch', es: 'Excéntrica · Estiramiento Adelante', pt: 'Excêntrica · Alongamento Adiante' },
          cue:   { en: 'Allow the cable to slowly pull your arms forward with deliberate pacing until the lats achieve full extension and the scapulae protract naturally.',
                   es: 'Permite que el cable jale tus brazos hacia adelante con un ritmo deliberado hasta que los dorsales alcancen la extensión completa y las escápulas se protraigan naturalmente.',
                   pt: 'Permita que o cabo puxe seus braços para frente com ritmo deliberado até que os dorsais alcancem a extensão completa e as escápulas protraiam naturalmente.' } },
        { id: 'isometric', start_pct: 40, end_pct: 50, easing: 'linear',
          label: { en: 'Isometric · Max Stretch', es: 'Isométrica · Estiramiento Máximo', pt: 'Isométrica · Alongamento Máximo' },
          cue:   { en: 'Hold the fully stretched position motionless to eliminate elastic recoil and maximize tension on the back musculature.',
                   es: 'Mantén la posición completamente estirada sin movimiento para eliminar el rebote elástico y maximizar la tensión en la musculatura de la espalda.',
                   pt: 'Mantenha a posição totalmente alongada sem movimento para eliminar o recuo elástico e maximizar a tensão na musculatura das costas.' } },
        { id: 'concentric', start_pct: 50, end_pct: 90, easing: 'ease-in',
          label: { en: 'Concentric · Scapular Pull', es: 'Concéntrica · Tracción Escapular', pt: 'Concêntrica · Tração Escapular' },
          cue:   { en: 'Drive the elbows forcefully backward and squeeze the shoulder blades together to bring the attachment directly to your lower abdomen.',
                   es: 'Empuja los codos con fuerza hacia atrás y aprieta las escápulas juntas para llevar el accesorio directamente al abdomen inferior.',
                   pt: 'Empurre os cotovelos com força para trás e contraia as escápulas juntas para trazer o acessório diretamente ao abdômen inferior.' } },
        { id: 'reset', start_pct: 90, end_pct: 100, easing: 'ease-in-out',
          label: { en: 'Reset · Peak Squeeze', es: 'Reinicio · Apretón Máximo', pt: 'Reinício · Contração Máxima' },
          cue:   { en: 'Hold peak contraction.', es: 'Mantén la contracción máxima.', pt: 'Mantenha a contração máxima.' } }
      ],
      keyframes: [
        { t: 0.00, phase: 'eccentric',
          joints: {
            head: { x: 0.30, y: 0.20 },
            shoulder_l: { x: 0.25, y: 0.35 }, shoulder_r: { x: 0.25, y: 0.35 },
            elbow_l:    { x: 0.20, y: 0.55 }, elbow_r:    { x: 0.20, y: 0.55 },
            wrist_l:    { x: 0.40, y: 0.55 }, wrist_r:    { x: 0.40, y: 0.55 },
            hip_l:      { x: 0.30, y: 0.70 }, hip_r:      { x: 0.30, y: 0.70 },
            knee_l:     { x: 0.60, y: 0.70 }, knee_r:     { x: 0.60, y: 0.70 },
            ankle_l:    { x: 0.80, y: 0.75 }, ankle_r:    { x: 0.80, y: 0.75 }
          } },
        { t: 0.40, phase: 'eccentric',
          joints: {
            shoulder_l: { x: 0.35, y: 0.35 }, shoulder_r: { x: 0.35, y: 0.35 },
            elbow_l:    { x: 0.50, y: 0.45 }, elbow_r:    { x: 0.50, y: 0.45 },
            wrist_l:    { x: 0.70, y: 0.45 }, wrist_r:    { x: 0.70, y: 0.45 }
          } },
        { t: 0.50, phase: 'isometric', joints: {} },
        { t: 0.90, phase: 'concentric',
          joints: {
            shoulder_l: { x: 0.25, y: 0.35 }, shoulder_r: { x: 0.25, y: 0.35 },
            elbow_l:    { x: 0.20, y: 0.55 }, elbow_r:    { x: 0.20, y: 0.55 },
            wrist_l:    { x: 0.40, y: 0.55 }, wrist_r:    { x: 0.40, y: 0.55 }
          } },
        { t: 1.00, phase: 'reset', joints: {} }
      ]
    },

    equipment: [{ type: 'cable_column', attach: ['wrist_l', 'wrist_r'] }],

    kineticPath: {
      default: { label: { en: 'Pull Vector', es: 'Vector de Tracción', pt: 'Vetor de Tração' },
                 d: 'M 0.70 0.45 L 0.40 0.55' },
      endpoints: [{ x: 0.70, y: 0.45 }, { x: 0.40, y: 0.55 }],
      labels: [
        { x: 0.70, y: 0.40, text: { en: 'Max Stretch',  es: 'Estiramiento Máximo', pt: 'Alongamento Máximo' } },
        { x: 0.40, y: 0.50, text: { en: 'Peak Squeeze', es: 'Apretón Máximo',      pt: 'Contração Máxima' } }
      ]
    },

    forms: {
      ok: {
        chipLabel: { en: 'Standard Form', es: 'Forma Estándar', pt: 'Forma Padrão' },
        callouts: [
          { from: 'shoulder_l', to: { x: 0.15, y: 0.25 },
            lines: [{ en: 'Torso locked upright', es: 'Torso bloqueado erguido', pt: 'Torso travado ereto' }] }
        ],
        metrics: {
          dev: '± 1.0 cm',
          tuck: { en: 'Scapulae Retracted',  es: 'Escápulas Retraídas',     pt: 'Escápulas Retraídas' },
          load: { en: 'Lat/Rhomboid Bias',   es: 'Sesgo Dorsal/Romboides',  pt: 'Viés Dorsal/Romboides' },
          fn:   { en: 'Clinical reference overlay', es: 'Capa de referencia clínica', pt: 'Camada de referência clínica' }
        },
        haloAt: null
      },
      warn: {
        chipLabel: { en: 'Common Fault: Torso Swing', es: 'Falla Común: Balanceo del Torso', pt: 'Falha Comum: Balanço do Torso' },
        callouts: [
          { from: 'shoulder_l', to: { x: 0.15, y: 0.25 }, warn: true,
            lines: [{ en: 'Momentum generation · Tension loss',
                      es: 'Generación de impulso · Pérdida de tensión',
                      pt: 'Geração de impulso · Perda de tensão' }] }
        ],
        metrics: {
          dev: '± 5.0 cm',
          tuck: { en: 'Lumbar Hyperextension', es: 'Hiperextensión Lumbar',  pt: 'Hiperextensão Lombar' },
          load: { en: 'Erector Overload',      es: 'Sobrecarga de Erectores', pt: 'Sobrecarga de Eretores' },
          fn:   { en: 'Fault pattern · Leaning back to pull weight',
                  es: 'Patrón de falla · Inclinación hacia atrás para tirar del peso',
                  pt: 'Padrão de falha · Inclinar para trás para puxar o peso' }
        },
        haloAt: 'hip_l',
        keyframesOverride: [
          { t: 0.90, joints: { head: { x: 0.15, y: 0.20 }, shoulder_l: { x: 0.10, y: 0.35 }, shoulder_r: { x: 0.10, y: 0.35 } } }
        ]
      }
    },

    metricLabels: {
      dev:  { en: 'Path Dev.',      es: 'Desv. Trayectoria', pt: 'Desv. Trajetória' },
      tuck: { en: 'Spinal Posture', es: 'Postura Espinal',   pt: 'Postura Espinhal' },
      load: { en: 'Muscle Bias',    es: 'Sesgo Muscular',    pt: 'Viés Muscular' }
    }
  };

  // ─── FACE PULLS (V2 · Batch 2) ───────────────────────────
  var FACE_PULLS = {
    id: 'face_pulls',
    displayName: 'Face Pulls',
    aliases: ['face pulls', 'cable face pulls', 'rope face pulls', 'high cable face pulls', 'rear delt face pulls', 'high pulley face pulls'],

    title: {
      en: 'Clinical Protocol: Face Pulls',
      es: 'Protocolo Clínico: Jalones a la Cara',
      pt: 'Protocolo Clínico: Puxadas para o Rosto'
    },
    subtitle: {
      en: 'Transverse Plane · Cable · Sovereign Rig',
      es: 'Plano Transversal · Polea · Equipo Soberano',
      pt: 'Plano Transversal · Cabo · Equipamento Soberano'
    },
    muscleTarget: {
      en: 'Primary: Posterior Deltoid, Infraspinatus, Teres Minor. Secondary: Rhomboids, Middle Trapezius, Brachialis, Core Stabilizers.',
      es: 'Primarios: Deltoides Posterior, Infraespinoso, Redondo Menor. Secundarios: Romboides, Trapecio Medio, Braquial, Estabilizadores del Core.',
      pt: 'Primários: Deltoide Posterior, Infraespinhal, Redondo Menor. Secundários: Romboides, Trapézio Médio, Braquial, Estabilizadores do Core.'
    },
    clinicalNotes: {
      en: 'Execution demands active intra-abdominal pressure and a staggered, firmly planted stance to establish a rigid foundation against the cable\'s forward pull. The kinetic chain relies on simultaneous horizontal shoulder abduction and external rotation, pulling the hands apart and directly toward the face without initiating the movement via lumbar extension. Optimal joint health and strict rotator cuff engagement are achieved by keeping the elbows elevated above the wrists throughout the entire pulling motion.',
      es: 'La ejecución exige presión intraabdominal activa y una postura escalonada y firmemente plantada para establecer una base rígida contra la tracción frontal del cable. La cadena cinética depende de la abducción horizontal del hombro y la rotación externa simultáneas, separando las manos y tirándolas directamente hacia la cara sin iniciar el movimiento mediante extensión lumbar. La salud articular óptima y la activación estricta del manguito rotador se logran manteniendo los codos elevados por encima de las muñecas durante todo el movimiento de tracción.',
      pt: 'A execução exige pressão intra-abdominal ativa e uma postura escalonada e firmemente plantada para estabelecer uma base rígida contra a tração frontal do cabo. A cadeia cinética depende da abdução horizontal do ombro e da rotação externa simultâneas, separando as mãos e puxando-as diretamente em direção ao rosto sem iniciar o movimento via extensão lombar. A saúde articular ótima e o engajamento estrito do manguito rotador são alcançados mantendo os cotovelos elevados acima dos punhos durante todo o movimento de tração.'
    },
    svgTitle: {
      en: 'Face Pull Sagittal Wireframe',
      es: 'Wireframe Sagital de Jalón a la Cara',
      pt: 'Wireframe Sagital de Puxada para o Rosto'
    },

    plane: 'sagittal', facing: 'right', ground: { y: 0.92 },
    jointSpec: STD_JOINT_SPEC, bones: STD_BONES,

    animation: {
      duration_ms: 3000, loop: true, direction: 'normal', easing: 'ease-in-out',
      phases: [
        { id: 'eccentric', start_pct: 0, end_pct: 40, easing: 'ease-out',
          label: { en: 'Eccentric · Controlled Reach', es: 'Excéntrica · Alcance Controlado', pt: 'Excêntrica · Alcance Controlado' },
          cue:   { en: 'Control the return of the rope toward the pulley with deliberate pacing until the shoulders naturally protract and the rear deltoids are fully stretched.',
                   es: 'Controla el retorno de la cuerda hacia la polea con un ritmo deliberado hasta que los hombros se protraigan naturalmente y los deltoides posteriores se estiren completamente.',
                   pt: 'Controle o retorno da corda em direção à polia com ritmo deliberado até que os ombros protraiam naturalmente e os deltoides posteriores fiquem totalmente alongados.' } },
        { id: 'isometric', start_pct: 40, end_pct: 50, easing: 'linear',
          label: { en: 'Isometric · Forward Stretch', es: 'Isométrica · Estiramiento Adelante', pt: 'Isométrica · Alongamento Adiante' },
          cue:   { en: 'Hold the stretched position to reset scapulae.', es: 'Mantén la posición estirada para reiniciar las escápulas.', pt: 'Mantenha a posição alongada para reiniciar as escápulas.' } },
        { id: 'concentric', start_pct: 50, end_pct: 90, easing: 'ease-in',
          label: { en: 'Concentric · External Rotation Drive', es: 'Concéntrica · Empuje de Rotación Externa', pt: 'Concêntrica · Impulso de Rotação Externa' },
          cue:   { en: 'Drive the elbows backward and externally rotate the shoulders forcefully to pull the center of the rope directly toward the bridge of your nose.',
                   es: 'Empuja los codos hacia atrás y rota externamente los hombros con fuerza para tirar del centro de la cuerda directamente hacia el puente de la nariz.',
                   pt: 'Empurre os cotovelos para trás e rode externamente os ombros com força para puxar o centro da corda diretamente em direção à ponte do nariz.' } },
        { id: 'reset', start_pct: 90, end_pct: 100, easing: 'ease-in-out',
          label: { en: 'Reset · Face Peak Hold', es: 'Reinicio · Pausa Máxima al Rostro', pt: 'Reinício · Pausa Máxima no Rosto' },
          cue:   { en: 'Hold the fully contracted peak motionless with the rope at your face to maximize mechanical tension and squeeze the upper back.',
                   es: 'Mantén el pico de contracción completa sin movimiento con la cuerda en el rostro para maximizar la tensión mecánica y apretar la espalda alta.',
                   pt: 'Mantenha o pico de contração total sem movimento com a corda no rosto para maximizar a tensão mecânica e contrair a parte superior das costas.' } }
      ],
      keyframes: [
        { t: 0.00, phase: 'eccentric',
          joints: {
            head: { x: 0.40, y: 0.20 },
            shoulder_l: { x: 0.40, y: 0.35 }, shoulder_r: { x: 0.40, y: 0.35 },
            elbow_l:    { x: 0.30, y: 0.30 }, elbow_r:    { x: 0.30, y: 0.30 },
            wrist_l:    { x: 0.45, y: 0.20 }, wrist_r:    { x: 0.45, y: 0.20 },
            hip_l:      { x: 0.40, y: 0.60 }, hip_r:      { x: 0.40, y: 0.60 },
            knee_l:     { x: 0.45, y: 0.78 }, knee_r:     { x: 0.35, y: 0.78 },
            ankle_l:    { x: 0.45, y: 0.92 }, ankle_r:    { x: 0.35, y: 0.92 }
          } },
        { t: 0.40, phase: 'eccentric',
          joints: {
            elbow_l: { x: 0.60, y: 0.30 }, elbow_r: { x: 0.60, y: 0.30 },
            wrist_l: { x: 0.80, y: 0.25 }, wrist_r: { x: 0.80, y: 0.25 }
          } },
        { t: 0.50, phase: 'isometric', joints: {} },
        { t: 0.90, phase: 'concentric',
          joints: {
            elbow_l: { x: 0.30, y: 0.30 }, elbow_r: { x: 0.30, y: 0.30 },
            wrist_l: { x: 0.45, y: 0.20 }, wrist_r: { x: 0.45, y: 0.20 }
          } },
        { t: 1.00, phase: 'reset', joints: {} }
      ]
    },

    equipment: [{ type: 'cable_column', attach: ['wrist_l', 'wrist_r'] }],

    kineticPath: {
      default: { label: { en: 'Face Vector', es: 'Vector al Rostro', pt: 'Vetor ao Rosto' },
                 d: 'M 0.80 0.25 L 0.45 0.20' },
      endpoints: [{ x: 0.80, y: 0.25 }, { x: 0.45, y: 0.20 }],
      labels: [
        { x: 0.80, y: 0.20, text: { en: 'Max Stretch',  es: 'Estiramiento Máximo', pt: 'Alongamento Máximo' } },
        { x: 0.45, y: 0.15, text: { en: 'Peak Squeeze', es: 'Apretón Máximo',      pt: 'Contração Máxima' } }
      ]
    },

    forms: {
      ok: {
        chipLabel: { en: 'Standard Form', es: 'Forma Estándar', pt: 'Forma Padrão' },
        callouts: [
          { from: 'elbow_l', to: { x: 0.20, y: 0.20 },
            lines: [{ en: 'Elbows above wrists', es: 'Codos por encima de las muñecas', pt: 'Cotovelos acima dos punhos' }] }
        ],
        metrics: {
          dev: '± 1.0 cm',
          tuck: { en: 'External Rotation',  es: 'Rotación Externa',                pt: 'Rotação Externa' },
          load: { en: 'Rear Delt Bias',     es: 'Sesgo del Deltoides Posterior',   pt: 'Viés do Deltoide Posterior' },
          fn:   { en: 'Clinical reference overlay', es: 'Capa de referencia clínica', pt: 'Camada de referência clínica' }
        },
        haloAt: null
      },
      warn: {
        chipLabel: { en: 'Common Fault: Lumbar Hyperextension', es: 'Falla Común: Hiperextensión Lumbar', pt: 'Falha Comum: Hiperextensão Lombar' },
        callouts: [
          { from: 'hip_l', to: { x: 0.20, y: 0.60 }, warn: true,
            lines: [{ en: 'Leaning back · Loss of brace',
                      es: 'Inclinación hacia atrás · Pérdida de activación',
                      pt: 'Inclinação para trás · Perda de ativação' }] }
        ],
        metrics: {
          dev: '± 4.0 cm',
          tuck: { en: 'Lumbar Extension', es: 'Extensión Lumbar', pt: 'Extensão Lombar' },
          load: { en: 'Spinal Shear',     es: 'Cizalla Espinal',  pt: 'Cisalhamento Espinhal' },
          fn:   { en: 'Fault pattern · Body leans back to assist pull',
                  es: 'Patrón de falla · El cuerpo se inclina hacia atrás para asistir la tracción',
                  pt: 'Padrão de falha · Corpo inclina para trás para auxiliar a tração' }
        },
        haloAt: 'hip_l',
        keyframesOverride: [
          { t: 0.90, joints: { head: { x: 0.25, y: 0.20 }, shoulder_l: { x: 0.30, y: 0.35 }, shoulder_r: { x: 0.30, y: 0.35 } } }
        ]
      }
    },

    metricLabels: {
      dev:  { en: 'Path Dev.',       es: 'Desv. Trayectoria',  pt: 'Desv. Trajetória' },
      tuck: { en: 'Shoulder Anchor', es: 'Anclaje del Hombro', pt: 'Ancoragem do Ombro' },
      load: { en: 'Muscle Bias',     es: 'Sesgo Muscular',     pt: 'Viés Muscular' }
    }
  };

  // ─── SEATED DB SHOULDER PRESS (V2 · Batch 3) ─────────────
  var SEATED_DB_SHOULDER_PRESS = {
    id: 'seated_db_shoulder_press',
    displayName: 'Seated DB Shoulder Press',
    aliases: ['seated db shoulder press', 'seated dumbbell shoulder press', 'db overhead press', 'dumbbell overhead press', 'seated ohp', 'db shoulder press', 'dumbbell military press', 'seated dumbbell presses', 'shoulder press', 'shoulder presses'],

    title: {
      en: 'Clinical Protocol: Seated DB Shoulder Press',
      es: 'Protocolo Clínico: Press de Hombros con Mancuernas Sentado',
      pt: 'Protocolo Clínico: Desenvolvimento com Halteres Sentado'
    },
    subtitle: {
      en: 'Frontal Plane · Dumbbells · Sovereign Rig',
      es: 'Plano Frontal · Mancuernas · Equipo Soberano',
      pt: 'Plano Frontal · Halteres · Equipamento Soberano'
    },
    muscleTarget: {
      en: 'Primary: Anterior Deltoid, Lateral Deltoid. Secondary: Triceps Brachii, Upper Trapezius, Core Stabilizers.',
      es: 'Primarios: Deltoides Anterior, Deltoides Lateral. Secundarios: Tríceps Braquial, Trapecio Superior, Estabilizadores del Core.',
      pt: 'Primários: Deltoide Anterior, Deltoide Lateral. Secundários: Tríceps Braquial, Trapézio Superior, Estabilizadores do Core.'
    },
    clinicalNotes: {
      en: 'Perfect Sovereign execution demands an upright, rigidly braced torso pressed firmly against the bench pad to entirely prevent lumbar hyperextension and energy leakage during the press. The kinetic chain relies on a stable lower body with feet actively driving into the floor, paired with depressed scapulae to strictly isolate the deltoids. Optimal joint health is preserved by pressing in the scapular plane with the elbows slightly tucked, strictly avoiding extreme external rotation and subacromial impingement at the bottom of the movement.',
      es: 'La ejecución soberana perfecta exige un torso erguido y rígidamente activado, presionado firmemente contra el respaldo del banco para prevenir por completo la hiperextensión lumbar y la fuga de energía durante el empuje. La cadena cinética depende de un tren inferior estable con los pies impulsándose activamente contra el suelo, junto con escápulas deprimidas para aislar estrictamente los deltoides. La salud articular óptima se preserva presionando en el plano escapular con los codos ligeramente retraídos, evitando estrictamente la rotación externa extrema y el pinzamiento subacromial en el fondo del movimiento.',
      pt: 'A execução soberana perfeita exige um torso ereto e rigidamente ativado, pressionado firmemente contra o encosto do banco para prevenir completamente a hiperextensão lombar e a perda de energia durante a pressão. A cadeia cinética depende de um tronco inferior estável com os pés se impulsionando ativamente contra o chão, em conjunto com escápulas deprimidas para isolar estritamente os deltoides. A saúde articular ótima é preservada pressionando no plano escapular com os cotovelos ligeiramente retraídos, evitando estritamente a rotação externa extrema e o impacto subacromial no fundo do movimento.'
    },
    svgTitle: {
      en: 'DB Shoulder Press Frontal Wireframe',
      es: 'Wireframe Frontal de Press de Hombros con Mancuernas',
      pt: 'Wireframe Frontal de Desenvolvimento com Halteres'
    },

    plane: 'frontal', facing: 'front', ground: { y: 0.92 },
    jointSpec: STD_JOINT_SPEC, bones: STD_BONES,

    animation: {
      duration_ms: 3500, loop: true, direction: 'normal', easing: 'ease-in-out',
      phases: [
        { id: 'eccentric', start_pct: 0, end_pct: 40, easing: 'ease-out',
          label: { en: 'Eccentric · Controlled Descent', es: 'Excéntrica · Descenso Controlado', pt: 'Excêntrica · Descida Controlada' },
          cue:   { en: 'Lower the dumbbells with strict, deliberate control until they hover just above the shoulders, maintaining active tension in the deltoids.',
                   es: 'Baja las mancuernas con control estricto y deliberado hasta que queden justo por encima de los hombros, manteniendo tensión activa en los deltoides.',
                   pt: 'Abaixe os halteres com controle estrito e deliberado até que fiquem logo acima dos ombros, mantendo tensão ativa nos deltoides.' } },
        { id: 'isometric', start_pct: 40, end_pct: 50, easing: 'linear',
          label: { en: 'Isometric · Bottom Stabilization', es: 'Isométrica · Estabilización Inferior', pt: 'Isométrica · Estabilização no Fundo' },
          cue:   { en: 'Pause motionless at the deepest point of the descent to dissipate downward momentum and protect the glenohumeral joint.',
                   es: 'Haz una pausa sin movimiento en el punto más profundo del descenso para disipar el impulso descendente y proteger la articulación glenohumeral.',
                   pt: 'Faça uma pausa sem movimento no ponto mais profundo da descida para dissipar o impulso descendente e proteger a articulação glenoumeral.' } },
        { id: 'concentric', start_pct: 50, end_pct: 90, easing: 'ease-in',
          label: { en: 'Concentric · Press Drive', es: 'Concéntrica · Empuje de Presión', pt: 'Concêntrica · Impulso de Pressão' },
          cue:   { en: 'Drive the weight forcefully upward and slightly inward until the elbows reach full extension without shrugging the shoulders.',
                   es: 'Empuja el peso con fuerza hacia arriba y ligeramente hacia adentro hasta que los codos alcancen la extensión completa sin encoger los hombros.',
                   pt: 'Empurre o peso com força para cima e ligeiramente para dentro até que os cotovelos alcancem a extensão completa sem encolher os ombros.' } },
        { id: 'reset', start_pct: 90, end_pct: 100, easing: 'ease-in-out',
          label: { en: 'Reset · Lockout Dwell', es: 'Reinicio · Pausa en Bloqueo', pt: 'Reinício · Pausa no Travamento' },
          cue:   { en: 'Maintain scapular depression.', es: 'Mantén la depresión escapular.', pt: 'Mantenha a depressão escapular.' } }
      ],
      keyframes: [
        { t: 0.00, phase: 'eccentric',
          joints: {
            head: { x: 0.50, y: 0.20 },
            shoulder_l: { x: 0.40, y: 0.35 }, shoulder_r: { x: 0.60, y: 0.35 },
            elbow_l:    { x: 0.40, y: 0.15 }, elbow_r:    { x: 0.60, y: 0.15 },
            wrist_l:    { x: 0.45, y: 0.05 }, wrist_r:    { x: 0.55, y: 0.05 },
            hip_l:      { x: 0.45, y: 0.65 }, hip_r:      { x: 0.55, y: 0.65 },
            knee_l:     { x: 0.35, y: 0.75 }, knee_r:     { x: 0.65, y: 0.75 },
            ankle_l:    { x: 0.35, y: 0.92 }, ankle_r:    { x: 0.65, y: 0.92 }
          } },
        { t: 0.40, phase: 'eccentric',
          joints: {
            elbow_l: { x: 0.30, y: 0.45 }, elbow_r: { x: 0.70, y: 0.45 },
            wrist_l: { x: 0.35, y: 0.30 }, wrist_r: { x: 0.65, y: 0.30 }
          } },
        { t: 0.50, phase: 'isometric', joints: {} },
        { t: 0.90, phase: 'concentric',
          joints: {
            elbow_l: { x: 0.40, y: 0.15 }, elbow_r: { x: 0.60, y: 0.15 },
            wrist_l: { x: 0.45, y: 0.05 }, wrist_r: { x: 0.55, y: 0.05 }
          } },
        { t: 1.00, phase: 'reset', joints: {} }
      ]
    },

    equipment: [{ type: 'dumbbell', attach: ['wrist_l', 'wrist_r'] }],

    kineticPath: {
      default: { label: { en: 'Press Vector', es: 'Vector de Presión', pt: 'Vetor de Pressão' },
                 d: 'M 0.35 0.30 L 0.45 0.05' },
      endpoints: [{ x: 0.35, y: 0.30 }, { x: 0.45, y: 0.05 }],
      labels: [
        { x: 0.30, y: 0.35, text: { en: 'Bottom',  es: 'Fondo',    pt: 'Fundo' } },
        { x: 0.45, y: 0.02, text: { en: 'Lockout', es: 'Bloqueo',  pt: 'Travamento' } }
      ]
    },

    forms: {
      ok: {
        chipLabel: { en: 'Standard Form', es: 'Forma Estándar', pt: 'Forma Padrão' },
        callouts: [
          { from: 'shoulder_l', to: { x: 0.20, y: 0.35 },
            lines: [{ en: 'Scapulae depressed', es: 'Escápulas deprimidas', pt: 'Escápulas deprimidas' }] }
        ],
        metrics: {
          dev: '± 1.0 cm',
          tuck: { en: 'Scapular Plane', es: 'Plano Escapular', pt: 'Plano Escapular' },
          load: { en: 'Delt Bias',      es: 'Sesgo Deltoides', pt: 'Viés Deltoide' },
          fn:   { en: 'Clinical reference overlay', es: 'Capa de referencia clínica', pt: 'Camada de referência clínica' }
        },
        haloAt: null
      },
      warn: {
        chipLabel: { en: 'Common Fault: Impingement Trap Shrug',
                     es: 'Falla Común: Pinzamiento por Encogimiento del Trapecio',
                     pt: 'Falha Comum: Impacto por Encolhimento do Trapézio' },
        callouts: [
          { from: 'shoulder_l', to: { x: 0.20, y: 0.25 }, warn: true,
            lines: [{ en: 'Shoulders elevate · Subacromial shear',
                      es: 'Hombros se elevan · Cizalla subacromial',
                      pt: 'Ombros sobem · Cisalhamento subacromial' }] }
        ],
        metrics: {
          dev: '± 4.0 cm',
          tuck: { en: 'Flared Elbows', es: 'Codos Abiertos',       pt: 'Cotovelos Abertos' },
          load: { en: 'Trap Overload', es: 'Sobrecarga del Trapecio', pt: 'Sobrecarga do Trapézio' },
          fn:   { en: 'Fault pattern · Shoulders shrug to assist press',
                  es: 'Patrón de falla · Los hombros se encogen para asistir el empuje',
                  pt: 'Padrão de falha · Ombros encolhem para auxiliar a pressão' }
        },
        haloAt: 'shoulder_l',
        keyframesOverride: [
          { t: 0.90, joints: { shoulder_l: { x: 0.35, y: 0.25 }, shoulder_r: { x: 0.65, y: 0.25 },
                               elbow_l:    { x: 0.25, y: 0.15 }, elbow_r:    { x: 0.75, y: 0.15 } } }
        ]
      }
    },

    metricLabels: {
      dev:  { en: 'Path Dev.',       es: 'Desv. Trayectoria',  pt: 'Desv. Trajetória' },
      tuck: { en: 'Shoulder Anchor', es: 'Anclaje del Hombro', pt: 'Ancoragem do Ombro' },
      load: { en: 'Joint Load',      es: 'Carga Articular',    pt: 'Carga Articular' }
    }
  };

  // ─── MACHINE CHEST FLYS (V2 · Batch 3) ───────────────────
  var MACHINE_CHEST_FLYS = {
    id: 'machine_chest_flys',
    displayName: 'Machine Chest Flys',
    aliases: ['machine chest flys', 'machine flys', 'pec deck flys', 'seated machine flys', 'pec fly machine', 'machine chest fly', 'butterfly machine', 'machine pec flys'],

    title: {
      en: 'Clinical Protocol: Machine Chest Flys',
      es: 'Protocolo Clínico: Aperturas de Pecho en Máquina',
      pt: 'Protocolo Clínico: Crucifixo na Máquina'
    },
    subtitle: {
      en: 'Transverse Plane · Machine · Sovereign Rig',
      es: 'Plano Transversal · Máquina · Equipo Soberano',
      pt: 'Plano Transversal · Máquina · Equipamento Soberano'
    },
    muscleTarget: {
      en: 'Primary: Pectoralis Major. Secondary: Anterior Deltoid, Coracobrachialis.',
      es: 'Primario: Pectoral Mayor. Secundarios: Deltoides Anterior, Coracobraquial.',
      pt: 'Primário: Peitoral Maior. Secundários: Deltoide Anterior, Coracobraquial.'
    },
    clinicalNotes: {
      en: 'Execution requires retracted and depressed scapulae pinned rigidly against the back pad to ensure strict isolation of the pectoralis major and prevent anterior humeral glide. The kinetic chain depends on maintaining a slight, fixed bend in the elbows throughout the entire arc, entirely eliminating triceps involvement or momentum generation. Joint health is protected by allowing the arms to open only until a maximal, safe stretch is felt across the chest, strictly avoiding overextending the shoulder capsule.',
      es: 'La ejecución requiere escápulas retraídas y deprimidas rígidamente fijadas contra el respaldo para garantizar el aislamiento estricto del pectoral mayor y prevenir el deslizamiento humeral anterior. La cadena cinética depende de mantener una flexión leve y fija en los codos durante todo el arco, eliminando por completo la participación del tríceps o la generación de impulso. La salud articular se protege permitiendo que los brazos se abran solo hasta sentir un estiramiento máximo y seguro en el pecho, evitando estrictamente la sobreextensión de la cápsula del hombro.',
      pt: 'A execução requer escápulas retraídas e deprimidas rigidamente pressionadas contra o encosto para garantir o isolamento estrito do peitoral maior e prevenir o deslizamento umeral anterior. A cadeia cinética depende de manter uma flexão leve e fixa nos cotovelos durante todo o arco, eliminando completamente a participação do tríceps ou a geração de impulso. A saúde articular é protegida permitindo que os braços abram apenas até sentir um alongamento máximo e seguro no peito, evitando estritamente a sobre-extensão da cápsula do ombro.'
    },
    svgTitle: {
      en: 'Machine Fly Transverse Wireframe',
      es: 'Wireframe Transversal de Apertura en Máquina',
      pt: 'Wireframe Transversal de Crucifixo na Máquina'
    },

    plane: 'frontal', facing: 'front', ground: { y: 0.92 },
    jointSpec: STD_JOINT_SPEC, bones: STD_BONES,

    animation: {
      duration_ms: 3000, loop: true, direction: 'normal', easing: 'ease-in-out',
      phases: [
        { id: 'eccentric', start_pct: 0, end_pct: 40, easing: 'ease-out',
          label: { en: 'Eccentric · Loaded Opening', es: 'Excéntrica · Apertura con Carga', pt: 'Excêntrica · Abertura Carregada' },
          cue:   { en: 'Allow the handles to pull your arms outward with deliberate pacing until a deep, safe stretch is achieved across the pectorals.',
                   es: 'Permite que las manijas tiren de tus brazos hacia afuera con un ritmo deliberado hasta lograr un estiramiento profundo y seguro en los pectorales.',
                   pt: 'Permita que as alças puxem seus braços para fora com ritmo deliberado até alcançar um alongamento profundo e seguro nos peitorais.' } },
        { id: 'isometric', start_pct: 40, end_pct: 50, easing: 'linear',
          label: { en: 'Isometric · Deep Stretch', es: 'Isométrica · Estiramiento Profundo', pt: 'Isométrica · Alongamento Profundo' },
          cue:   { en: 'Hold the fully stretched position motionless to eliminate elastic recoil and maximize mechanical tension on the chest musculature.',
                   es: 'Mantén la posición completamente estirada sin movimiento para eliminar el rebote elástico y maximizar la tensión mecánica en la musculatura del pecho.',
                   pt: 'Mantenha a posição totalmente alongada sem movimento para eliminar o recuo elástico e maximizar a tensão mecânica na musculatura do peito.' } },
        { id: 'concentric', start_pct: 50, end_pct: 90, easing: 'ease-in',
          label: { en: 'Concentric · Pec Squeeze', es: 'Concéntrica · Apretón Pectoral', pt: 'Concêntrica · Contração Peitoral' },
          cue:   { en: 'Drive the handles forcefully inward through a strict contraction of the chest, squeezing the pectorals together at the midline.',
                   es: 'Empuja las manijas con fuerza hacia adentro mediante una contracción estricta del pecho, apretando los pectorales juntos en la línea media.',
                   pt: 'Empurre as alças com força para dentro através de uma contração estrita do peito, contraindo os peitorais juntos na linha média.' } },
        { id: 'reset', start_pct: 90, end_pct: 100, easing: 'ease-in-out',
          label: { en: 'Reset · Peak Contraction', es: 'Reinicio · Contracción Máxima', pt: 'Reinício · Contração Máxima' },
          cue:   { en: 'Maintain tension.', es: 'Mantén la tensión.', pt: 'Mantenha a tensão.' } }
      ],
      keyframes: [
        { t: 0.00, phase: 'eccentric',
          joints: {
            head: { x: 0.50, y: 0.20 },
            shoulder_l: { x: 0.40, y: 0.35 }, shoulder_r: { x: 0.60, y: 0.35 },
            elbow_l:    { x: 0.40, y: 0.45 }, elbow_r:    { x: 0.60, y: 0.45 },
            wrist_l:    { x: 0.48, y: 0.45 }, wrist_r:    { x: 0.52, y: 0.45 },
            hip_l:      { x: 0.45, y: 0.65 }, hip_r:      { x: 0.55, y: 0.65 },
            knee_l:     { x: 0.40, y: 0.80 }, knee_r:     { x: 0.60, y: 0.80 },
            ankle_l:    { x: 0.40, y: 0.92 }, ankle_r:    { x: 0.60, y: 0.92 }
          } },
        { t: 0.40, phase: 'eccentric',
          joints: {
            elbow_l: { x: 0.20, y: 0.40 }, elbow_r: { x: 0.80, y: 0.40 },
            wrist_l: { x: 0.10, y: 0.40 }, wrist_r: { x: 0.90, y: 0.40 }
          } },
        { t: 0.50, phase: 'isometric', joints: {} },
        { t: 0.90, phase: 'concentric',
          joints: {
            elbow_l: { x: 0.40, y: 0.45 }, elbow_r: { x: 0.60, y: 0.45 },
            wrist_l: { x: 0.48, y: 0.45 }, wrist_r: { x: 0.52, y: 0.45 }
          } },
        { t: 1.00, phase: 'reset', joints: {} }
      ]
    },

    equipment: [{ type: 'machine_pad', attach: ['wrist_l', 'wrist_r'] }],

    kineticPath: {
      default: { label: { en: 'Transverse Arc', es: 'Arco Transversal', pt: 'Arco Transversal' },
                 d: 'M 0.10 0.40 Q 0.30 0.50 0.48 0.45' },
      endpoints: [{ x: 0.10, y: 0.40 }, { x: 0.48, y: 0.45 }],
      labels: [
        { x: 0.10, y: 0.35, text: { en: 'Max Stretch',  es: 'Estiramiento Máximo', pt: 'Alongamento Máximo' } },
        { x: 0.50, y: 0.50, text: { en: 'Peak Squeeze', es: 'Apretón Máximo',      pt: 'Contração Máxima' } }
      ]
    },

    forms: {
      ok: {
        chipLabel: { en: 'Standard Form', es: 'Forma Estándar', pt: 'Forma Padrão' },
        callouts: [
          { from: 'shoulder_l', to: { x: 0.20, y: 0.25 },
            lines: [{ en: 'Scapulae pinned', es: 'Escápulas fijadas', pt: 'Escápulas fixadas' }] }
        ],
        metrics: {
          dev: '± 1.0 cm',
          tuck: { en: 'Retracted',     es: 'Retraídas',     pt: 'Retraídas' },
          load: { en: 'Pectoral Bias', es: 'Sesgo Pectoral', pt: 'Viés Peitoral' },
          fn:   { en: 'Clinical reference overlay', es: 'Capa de referencia clínica', pt: 'Camada de referência clínica' }
        },
        haloAt: null
      },
      warn: {
        chipLabel: { en: 'Common Fault: Anterior Humeral Glide',
                     es: 'Falla Común: Deslizamiento Humeral Anterior',
                     pt: 'Falha Comum: Deslizamento Umeral Anterior' },
        callouts: [
          { from: 'shoulder_l', to: { x: 0.20, y: 0.25 }, warn: true,
            lines: [{ en: 'Shoulders roll forward · Tension loss',
                      es: 'Hombros ruedan adelante · Pérdida de tensión',
                      pt: 'Ombros rolam para frente · Perda de tensão' }] }
        ],
        metrics: {
          dev: '± 4.0 cm',
          tuck: { en: 'Protracted',              es: 'Protraídas',                    pt: 'Protraídas' },
          load: { en: 'Shoulder Capsule Strain', es: 'Tensión de la Cápsula del Hombro', pt: 'Tensão da Cápsula do Ombro' },
          fn:   { en: 'Fault pattern · Shoulders leave back pad',
                  es: 'Patrón de falla · Los hombros se despegan del respaldo',
                  pt: 'Padrão de falha · Ombros desencostam do encosto' }
        },
        haloAt: 'shoulder_l',
        keyframesOverride: [
          { t: 0.90, joints: { shoulder_l: { x: 0.45, y: 0.40 }, shoulder_r: { x: 0.55, y: 0.40 } } }
        ]
      }
    },

    metricLabels: {
      dev:  { en: 'Path Dev.',       es: 'Desv. Trayectoria',  pt: 'Desv. Trajetória' },
      tuck: { en: 'Scapular Anchor', es: 'Anclaje Escapular',  pt: 'Ancoragem Escapular' },
      load: { en: 'Tissue Load',     es: 'Carga Tisular',      pt: 'Carga Tecidual' }
    }
  };

  // ─── LEG EXTENSIONS (V2 · Batch 3) ───────────────────────
  var LEG_EXTENSIONS = {
    id: 'leg_extensions',
    displayName: 'Leg Extensions',
    aliases: ['leg extensions', 'seated leg extensions', 'machine leg extensions', 'quad extensions', 'knee extensions', 'machine knee extensions'],

    title: {
      en: 'Clinical Protocol: Leg Extensions',
      es: 'Protocolo Clínico: Extensiones de Piernas',
      pt: 'Protocolo Clínico: Cadeira Extensora'
    },
    subtitle: {
      en: 'Sagittal Plane · Machine · Sovereign Rig',
      es: 'Plano Sagital · Máquina · Equipo Soberano',
      pt: 'Plano Sagital · Máquina · Equipamento Soberano'
    },
    muscleTarget: {
      en: 'Primary: Quadriceps. Secondary: Core Stabilizers.',
      es: 'Primario: Cuádriceps. Secundarios: Estabilizadores del Core.',
      pt: 'Primário: Quadríceps. Secundários: Estabilizadores do Core.'
    },
    clinicalNotes: {
      en: 'Perfect Sovereign execution necessitates the pelvis being rigidly anchored to the seat via active tension on the handles to prevent any upward shifting or hip flexion assistance. The kinetic chain is simplified to pure knee extension, requiring the knee joint to be perfectly aligned with the machine\'s axis of rotation for fluid mechanical leverage. Joint articulation is optimized by avoiding explosive, bone-on-bone hyperextension at the peak and controlling the descent to prevent shearing forces on the patellar tendon.',
      es: 'La ejecución soberana perfecta requiere que la pelvis esté rígidamente anclada al asiento mediante tensión activa en las manijas para prevenir cualquier desplazamiento hacia arriba o asistencia por flexión de cadera. La cadena cinética se simplifica a extensión pura de rodilla, exigiendo que la articulación de la rodilla esté perfectamente alineada con el eje de rotación de la máquina para una palanca mecánica fluida. La articulación se optimiza evitando una hiperextensión explosiva hueso contra hueso en el pico y controlando el descenso para prevenir fuerzas de cizalla sobre el tendón rotuliano.',
      pt: 'A execução soberana perfeita necessita que a pelve esteja rigidamente ancorada ao assento via tensão ativa nas alças para impedir qualquer deslocamento para cima ou auxílio por flexão do quadril. A cadeia cinética é simplificada para pura extensão do joelho, exigindo que a articulação do joelho esteja perfeitamente alinhada com o eixo de rotação da máquina para uma alavancagem mecânica fluida. A articulação é otimizada evitando hiperextensão explosiva osso contra osso no pico e controlando a descida para prevenir forças de cisalhamento sobre o tendão patelar.'
    },
    svgTitle: {
      en: 'Leg Extension Sagittal Wireframe',
      es: 'Wireframe Sagital de Extensión de Piernas',
      pt: 'Wireframe Sagital de Cadeira Extensora'
    },

    plane: 'sagittal', facing: 'right', ground: { y: 0.92 },
    jointSpec: STD_JOINT_SPEC, bones: STD_BONES,

    animation: {
      duration_ms: 3500, loop: true, direction: 'normal', easing: 'ease-in-out',
      phases: [
        { id: 'eccentric', start_pct: 0, end_pct: 40, easing: 'ease-out',
          label: { en: 'Eccentric · Controlled Drop', es: 'Excéntrica · Descenso Controlado', pt: 'Excêntrica · Descida Controlada' },
          cue:   { en: 'Lower the weight stack with strict, deliberate control until the knees reach full, safe flexion.',
                   es: 'Baja la pila de pesas con control estricto y deliberado hasta que las rodillas alcancen la flexión completa y segura.',
                   pt: 'Abaixe a pilha de pesos com controle estrito e deliberado até que os joelhos alcancem a flexão completa e segura.' } },
        { id: 'isometric', start_pct: 40, end_pct: 50, easing: 'linear',
          label: { en: 'Isometric · Bottom Stretch', es: 'Isométrica · Estiramiento Inferior', pt: 'Isométrica · Alongamento no Fundo' },
          cue:   { en: 'Pause to eliminate momentum.', es: 'Pausa para eliminar el impulso.', pt: 'Pausa para eliminar o impulso.' } },
        { id: 'concentric', start_pct: 50, end_pct: 90, easing: 'ease-in',
          label: { en: 'Concentric · Quad Extension', es: 'Concéntrica · Extensión de Cuádriceps', pt: 'Concêntrica · Extensão do Quadríceps' },
          cue:   { en: 'Drive the pad forcefully upward through a strict contraction of the quadriceps until the knees are completely extended.',
                   es: 'Empuja el cojín con fuerza hacia arriba mediante una contracción estricta de los cuádriceps hasta que las rodillas estén completamente extendidas.',
                   pt: 'Empurre o apoio com força para cima através de uma contração estrita do quadríceps até que os joelhos estejam completamente estendidos.' } },
        { id: 'reset', start_pct: 90, end_pct: 100, easing: 'ease-in-out',
          label: { en: 'Reset · Peak Squeeze', es: 'Reinicio · Apretón Máximo', pt: 'Reinício · Contração Máxima' },
          cue:   { en: 'Hold the fully contracted peak motionless to maximize mechanical tension and intensely squeeze the quadriceps.',
                   es: 'Mantén el pico de contracción completa sin movimiento para maximizar la tensión mecánica y apretar intensamente los cuádriceps.',
                   pt: 'Mantenha o pico de contração total sem movimento para maximizar a tensão mecânica e contrair intensamente o quadríceps.' } }
      ],
      keyframes: [
        { t: 0.00, phase: 'eccentric',
          joints: {
            head: { x: 0.30, y: 0.20 },
            shoulder_l: { x: 0.30, y: 0.35 }, shoulder_r: { x: 0.30, y: 0.35 },
            elbow_l:    { x: 0.30, y: 0.50 }, elbow_r:    { x: 0.30, y: 0.50 },
            wrist_l:    { x: 0.32, y: 0.62 }, wrist_r:    { x: 0.32, y: 0.62 },
            hip_l:      { x: 0.35, y: 0.65 }, hip_r:      { x: 0.35, y: 0.65 },
            knee_l:     { x: 0.60, y: 0.65 }, knee_r:     { x: 0.60, y: 0.65 },
            ankle_l:    { x: 0.75, y: 0.65 }, ankle_r:    { x: 0.75, y: 0.65 }
          } },
        { t: 0.40, phase: 'eccentric',
          joints: { ankle_l: { x: 0.55, y: 0.85 }, ankle_r: { x: 0.55, y: 0.85 } } },
        { t: 0.50, phase: 'isometric', joints: {} },
        { t: 0.90, phase: 'concentric',
          joints: { ankle_l: { x: 0.75, y: 0.65 }, ankle_r: { x: 0.75, y: 0.65 } } },
        { t: 1.00, phase: 'reset', joints: {} }
      ]
    },

    equipment: [{ type: 'machine_pad', attach: ['ankle_l', 'ankle_r'] }],

    kineticPath: {
      default: { label: { en: 'Extension Arc', es: 'Arco de Extensión', pt: 'Arco de Extensão' },
                 d: 'M 0.55 0.85 Q 0.70 0.80 0.75 0.65' },
      endpoints: [{ x: 0.55, y: 0.85 }, { x: 0.75, y: 0.65 }],
      labels: [
        { x: 0.50, y: 0.85, text: { en: 'Start',        es: 'Inicio',          pt: 'Início' } },
        { x: 0.80, y: 0.65, text: { en: 'Peak Squeeze', es: 'Apretón Máximo',  pt: 'Contração Máxima' } }
      ]
    },

    forms: {
      ok: {
        chipLabel: { en: 'Standard Form', es: 'Forma Estándar', pt: 'Forma Padrão' },
        callouts: [
          { from: 'hip_l', to: { x: 0.15, y: 0.65 },
            lines: [{ en: 'Pelvis anchored', es: 'Pelvis anclada', pt: 'Pelve ancorada' }] }
        ],
        metrics: {
          dev: '± 1.0 cm',
          tuck: { en: 'Hips Pinned',     es: 'Caderas Fijadas',           pt: 'Quadris Fixados' },
          load: { en: 'Quad Isolation',  es: 'Aislamiento de Cuádriceps', pt: 'Isolamento do Quadríceps' },
          fn:   { en: 'Clinical reference overlay', es: 'Capa de referencia clínica', pt: 'Camada de referência clínica' }
        },
        haloAt: null
      },
      warn: {
        chipLabel: { en: 'Common Fault: Pelvic Lift', es: 'Falla Común: Elevación Pélvica', pt: 'Falha Comum: Elevação Pélvica' },
        callouts: [
          { from: 'hip_l', to: { x: 0.15, y: 0.55 }, warn: true,
            lines: [{ en: 'Hips lift · Momentum assist',
                      es: 'Caderas se elevan · Asistencia por impulso',
                      pt: 'Quadris sobem · Auxílio por impulso' }] }
        ],
        metrics: {
          dev: '± 4.0 cm',
          tuck: { en: 'Pelvis Elevated',    es: 'Pelvis Elevada',                pt: 'Pelve Elevada' },
          load: { en: 'Hip Flexor Assist',  es: 'Asistencia del Flexor de Cadera', pt: 'Auxílio do Flexor do Quadril' },
          fn:   { en: 'Fault pattern · Failure to anchor hips',
                  es: 'Patrón de falla · No se anclan las caderas',
                  pt: 'Padrão de falha · Falha em ancorar os quadris' }
        },
        haloAt: 'hip_l',
        keyframesOverride: [
          { t: 0.90, joints: { hip_l: { x: 0.40, y: 0.55 }, hip_r: { x: 0.40, y: 0.55 },
                               knee_l: { x: 0.65, y: 0.55 }, knee_r: { x: 0.65, y: 0.55 } } }
        ]
      }
    },

    metricLabels: {
      dev:  { en: 'Path Dev.',     es: 'Desv. Trayectoria', pt: 'Desv. Trajetória' },
      tuck: { en: 'Pelvic Anchor', es: 'Anclaje Pélvico',   pt: 'Ancoragem Pélvica' },
      load: { en: 'Muscle Bias',   es: 'Sesgo Muscular',    pt: 'Viés Muscular' }
    }
  };

  // ─── HAMSTRING CURLS (V2 · Batch 3) ──────────────────────
  var HAMSTRING_CURLS = {
    id: 'hamstring_curls',
    displayName: 'Hamstring Curls',
    aliases: ['hamstring curls', 'lying hamstring curls', 'seated hamstring curls', 'leg curls', 'machine leg curls', 'prone leg curls', 'machine hamstring curls'],

    title: {
      en: 'Clinical Protocol: Hamstring Curls',
      es: 'Protocolo Clínico: Curl de Isquiotibiales',
      pt: 'Protocolo Clínico: Mesa Flexora'
    },
    subtitle: {
      en: 'Sagittal Plane · Machine · Sovereign Rig',
      es: 'Plano Sagital · Máquina · Equipo Soberano',
      pt: 'Plano Sagital · Máquina · Equipamento Soberano'
    },
    muscleTarget: {
      en: 'Primary: Hamstrings. Secondary: Gastrocnemius.',
      es: 'Primario: Isquiotibiales. Secundario: Gastrocnemio.',
      pt: 'Primário: Isquiotibiais. Secundário: Gastrocnêmio.'
    },
    clinicalNotes: {
      en: 'Execution demands that the hips and pelvis remain rigidly pinned against the pad to ensure strict isolation of the knee flexors and entirely prevent compensatory lumbar hyperextension. The kinetic chain requires the knee joint to align perfectly with the machine\'s pivot point, guaranteeing continuous tension throughout the movement arc. Optimal joint health is maintained by controlling the load through the full range of motion, strictly avoiding explosive jerking or momentum generation at the initiation of the curl.',
      es: 'La ejecución exige que las caderas y la pelvis permanezcan rígidamente fijadas contra el cojín para garantizar el aislamiento estricto de los flexores de rodilla y prevenir por completo la hiperextensión lumbar compensatoria. La cadena cinética requiere que la articulación de la rodilla se alinee perfectamente con el punto de pivote de la máquina, garantizando tensión continua durante todo el arco del movimiento. La salud articular óptima se mantiene controlando la carga durante todo el rango de movimiento, evitando estrictamente movimientos explosivos o la generación de impulso al iniciar el curl.',
      pt: 'A execução exige que os quadris e a pelve permaneçam rigidamente pressionados contra o apoio para garantir o isolamento estrito dos flexores do joelho e prevenir completamente a hiperextensão lombar compensatória. A cadeia cinética requer que a articulação do joelho se alinhe perfeitamente com o ponto de pivô da máquina, garantindo tensão contínua durante todo o arco do movimento. A saúde articular ótima é mantida controlando a carga em toda a amplitude de movimento, evitando estritamente movimentos explosivos ou a geração de impulso no início do curl.'
    },
    svgTitle: {
      en: 'Hamstring Curl Sagittal Wireframe',
      es: 'Wireframe Sagital de Curl de Isquiotibiales',
      pt: 'Wireframe Sagital de Mesa Flexora'
    },

    plane: 'sagittal', facing: 'right', ground: { y: 0.92 },
    jointSpec: STD_JOINT_SPEC, bones: STD_BONES,

    animation: {
      duration_ms: 3500, loop: true, direction: 'normal', easing: 'ease-in-out',
      phases: [
        { id: 'eccentric', start_pct: 0, end_pct: 40, easing: 'ease-out',
          label: { en: 'Eccentric · Controlled Release', es: 'Excéntrica · Liberación Controlada', pt: 'Excêntrica · Liberação Controlada' },
          cue:   { en: 'Allow the pad to slowly raise the lower leg with deliberate pacing until the hamstrings achieve a full, safe stretch.',
                   es: 'Permite que el cojín eleve lentamente la pierna inferior con un ritmo deliberado hasta que los isquiotibiales alcancen un estiramiento completo y seguro.',
                   pt: 'Permita que o apoio eleve lentamente a perna inferior com ritmo deliberado até que os isquiotibiais alcancem um alongamento completo e seguro.' } },
        { id: 'isometric', start_pct: 40, end_pct: 50, easing: 'linear',
          label: { en: 'Isometric · Bottom Stretch', es: 'Isométrica · Estiramiento Inferior', pt: 'Isométrica · Alongamento no Fundo' },
          cue:   { en: 'Pause to eliminate momentum.', es: 'Pausa para eliminar el impulso.', pt: 'Pausa para eliminar o impulso.' } },
        { id: 'concentric', start_pct: 50, end_pct: 90, easing: 'ease-in',
          label: { en: 'Concentric · Hamstring Squeeze', es: 'Concéntrica · Apretón de Isquiotibiales', pt: 'Concêntrica · Contração dos Isquiotibiais' },
          cue:   { en: 'Drive the pad forcefully backward and downward through a strict contraction of the hamstrings until maximal knee flexion is reached.',
                   es: 'Empuja el cojín con fuerza hacia atrás y abajo mediante una contracción estricta de los isquiotibiales hasta alcanzar la flexión máxima de rodilla.',
                   pt: 'Empurre o apoio com força para trás e para baixo através de uma contração estrita dos isquiotibiais até alcançar a flexão máxima do joelho.' } },
        { id: 'reset', start_pct: 90, end_pct: 100, easing: 'ease-in-out',
          label: { en: 'Reset · Peak Contraction', es: 'Reinicio · Contracción Máxima', pt: 'Reinício · Contração Máxima' },
          cue:   { en: 'Hold the fully contracted peak motionless to maximize mechanical tension and deeply engage the posterior chain.',
                   es: 'Mantén el pico de contracción completa sin movimiento para maximizar la tensión mecánica y activar profundamente la cadena posterior.',
                   pt: 'Mantenha o pico de contração total sem movimento para maximizar a tensão mecânica e ativar profundamente a cadeia posterior.' } }
      ],
      keyframes: [
        { t: 0.00, phase: 'eccentric',
          joints: {
            head: { x: 0.75, y: 0.60 },
            shoulder_l: { x: 0.65, y: 0.65 }, shoulder_r: { x: 0.65, y: 0.65 },
            elbow_l:    { x: 0.75, y: 0.70 }, elbow_r:    { x: 0.75, y: 0.70 },
            wrist_l:    { x: 0.85, y: 0.68 }, wrist_r:    { x: 0.85, y: 0.68 },
            hip_l:      { x: 0.40, y: 0.65 }, hip_r:      { x: 0.40, y: 0.65 },
            knee_l:     { x: 0.20, y: 0.65 }, knee_r:     { x: 0.20, y: 0.65 },
            ankle_l:    { x: 0.20, y: 0.40 }, ankle_r:    { x: 0.20, y: 0.40 }
          } },
        { t: 0.40, phase: 'eccentric',
          joints: { ankle_l: { x: 0.05, y: 0.60 }, ankle_r: { x: 0.05, y: 0.60 } } },
        { t: 0.50, phase: 'isometric', joints: {} },
        { t: 0.90, phase: 'concentric',
          joints: { ankle_l: { x: 0.20, y: 0.40 }, ankle_r: { x: 0.20, y: 0.40 } } },
        { t: 1.00, phase: 'reset', joints: {} }
      ]
    },

    equipment: [{ type: 'machine_pad', attach: ['ankle_l', 'ankle_r'] }],

    kineticPath: {
      default: { label: { en: 'Flexion Arc', es: 'Arco de Flexión', pt: 'Arco de Flexão' },
                 d: 'M 0.05 0.60 Q 0.10 0.45 0.20 0.40' },
      endpoints: [{ x: 0.05, y: 0.60 }, { x: 0.20, y: 0.40 }],
      labels: [
        { x: 0.02, y: 0.65, text: { en: 'Start',        es: 'Inicio',          pt: 'Início' } },
        { x: 0.25, y: 0.35, text: { en: 'Peak Squeeze', es: 'Apretón Máximo',  pt: 'Contração Máxima' } }
      ]
    },

    forms: {
      ok: {
        chipLabel: { en: 'Standard Form', es: 'Forma Estándar', pt: 'Forma Padrão' },
        callouts: [
          { from: 'hip_l', to: { x: 0.40, y: 0.45 },
            lines: [{ en: 'Pelvis pinned to pad', es: 'Pelvis fijada al cojín', pt: 'Pelve fixada ao apoio' }] }
        ],
        metrics: {
          dev: '± 1.0 cm',
          tuck: { en: 'Neutral Lumbar',         es: 'Lumbar Neutra',                  pt: 'Lombar Neutra' },
          load: { en: 'Hamstring Isolation',    es: 'Aislamiento de Isquiotibiales',  pt: 'Isolamento dos Isquiotibiais' },
          fn:   { en: 'Clinical reference overlay', es: 'Capa de referencia clínica', pt: 'Camada de referência clínica' }
        },
        haloAt: null
      },
      warn: {
        chipLabel: { en: 'Common Fault: Lumbar Hyperextension', es: 'Falla Común: Hiperextensión Lumbar', pt: 'Falha Comum: Hiperextensão Lombar' },
        callouts: [
          { from: 'hip_l', to: { x: 0.40, y: 0.45 }, warn: true,
            lines: [{ en: 'Hips lift · Lumbar shear',
                      es: 'Caderas se elevan · Cizalla lumbar',
                      pt: 'Quadris sobem · Cisalhamento lombar' }] }
        ],
        metrics: {
          dev: '± 4.0 cm',
          tuck: { en: 'Lumbar Arch',         es: 'Arco Lumbar',  pt: 'Arco Lombar' },
          load: { en: 'Lower Back Strain',   es: 'Tensión Lumbar', pt: 'Tensão Lombar' },
          fn:   { en: 'Fault pattern · Compensating with lower back',
                  es: 'Patrón de falla · Compensación con la espalda baja',
                  pt: 'Padrão de falha · Compensação com a região lombar' }
        },
        haloAt: 'hip_l',
        keyframesOverride: [
          { t: 0.90, joints: { hip_l: { x: 0.40, y: 0.55 }, hip_r: { x: 0.40, y: 0.55 } } }
        ]
      }
    },

    metricLabels: {
      dev:  { en: 'Path Dev.',     es: 'Desv. Trayectoria', pt: 'Desv. Trajetória' },
      tuck: { en: 'Pelvic Anchor', es: 'Anclaje Pélvico',   pt: 'Ancoragem Pélvica' },
      load: { en: 'Muscle Bias',   es: 'Sesgo Muscular',    pt: 'Viés Muscular' }
    }
  };

  // ─── HAMMER CURLS (V2 · Batch 3) ─────────────────────────
  var HAMMER_CURLS = {
    id: 'hammer_curls',
    displayName: 'Hammer Curls',
    aliases: ['hammer curls', 'db hammer curls', 'dumbbell hammer curls', 'neutral grip bicep curls', 'neutral grip curls', 'standing hammer curls', 'seated hammer curls'],

    title: {
      en: 'Clinical Protocol: Hammer Curls',
      es: 'Protocolo Clínico: Curl Martillo',
      pt: 'Protocolo Clínico: Rosca Martelo'
    },
    subtitle: {
      en: 'Sagittal Plane · Dumbbells · Sovereign Rig',
      es: 'Plano Sagital · Mancuernas · Equipo Soberano',
      pt: 'Plano Sagital · Halteres · Equipamento Soberano'
    },
    muscleTarget: {
      en: 'Primary: Brachioradialis, Brachialis. Secondary: Biceps Brachii, Forearm Flexors, Core Stabilizers.',
      es: 'Primarios: Braquiorradial, Braquial. Secundarios: Bíceps Braquial, Flexores del Antebrazo, Estabilizadores del Core.',
      pt: 'Primários: Braquiorradial, Braquial. Secundários: Bíceps Braquial, Flexores do Antebraço, Estabilizadores do Core.'
    },
    clinicalNotes: {
      en: 'Perfect Sovereign execution demands that the elbows remain rigidly locked and pinned to the sides of the torso to ensure strict isolation of the brachialis and outer forearm musculature. The kinetic chain requires a highly braced core and depressed scapulae to entirely prevent any anterior shoulder swing, torso sway, or momentum generation. Joint articulation is optimized by maintaining a strict neutral grip throughout the entire movement, entirely avoiding wrist flexion or extension under load.',
      es: 'La ejecución soberana perfecta exige que los codos permanezcan rígidamente bloqueados y pegados a los costados del torso para garantizar el aislamiento estricto del braquial y la musculatura externa del antebrazo. La cadena cinética requiere un core altamente activado y escápulas deprimidas para prevenir por completo cualquier balanceo anterior del hombro, oscilación del torso o generación de impulso. La articulación se optimiza manteniendo un agarre neutro estricto durante todo el movimiento, evitando por completo la flexión o extensión de muñeca bajo carga.',
      pt: 'A execução soberana perfeita exige que os cotovelos permaneçam rigidamente travados e pressionados aos lados do torso para garantir o isolamento estrito do braquial e da musculatura externa do antebraço. A cadeia cinética requer um core altamente ativado e escápulas deprimidas para prevenir completamente qualquer balanço anterior do ombro, oscilação do torso ou geração de impulso. A articulação é otimizada mantendo uma pegada neutra estrita durante todo o movimento, evitando completamente a flexão ou extensão do punho sob carga.'
    },
    svgTitle: {
      en: 'Hammer Curl Sagittal Wireframe',
      es: 'Wireframe Sagital de Curl Martillo',
      pt: 'Wireframe Sagital de Rosca Martelo'
    },

    plane: 'sagittal', facing: 'right', ground: { y: 0.92 },
    jointSpec: STD_JOINT_SPEC, bones: STD_BONES,

    animation: {
      duration_ms: 3000, loop: true, direction: 'normal', easing: 'ease-in-out',
      phases: [
        { id: 'eccentric', start_pct: 0, end_pct: 40, easing: 'ease-out',
          label: { en: 'Eccentric · Loaded Descent', es: 'Excéntrica · Descenso con Carga', pt: 'Excêntrica · Descida Carregada' },
          cue:   { en: 'Lower the dumbbells with strict, deliberate control until the arms achieve full extension.',
                   es: 'Baja las mancuernas con control estricto y deliberado hasta que los brazos alcancen la extensión completa.',
                   pt: 'Abaixe os halteres com controle estrito e deliberado até que os braços alcancem a extensão completa.' } },
        { id: 'isometric', start_pct: 40, end_pct: 50, easing: 'linear',
          label: { en: 'Isometric · Bottom Stretch', es: 'Isométrica · Estiramiento Inferior', pt: 'Isométrica · Alongamento no Fundo' },
          cue:   { en: 'Kill momentum at the bottom.', es: 'Anula el impulso en el fondo.', pt: 'Anule o impulso no fundo.' } },
        { id: 'concentric', start_pct: 50, end_pct: 90, easing: 'ease-in',
          label: { en: 'Concentric · Neutral Flexion', es: 'Concéntrica · Flexión Neutral', pt: 'Concêntrica · Flexão Neutra' },
          cue:   { en: 'Drive the weights upward through a forceful contraction while maintaining a neutral grip and keeping the elbows completely static.',
                   es: 'Empuja los pesos hacia arriba mediante una contracción enérgica manteniendo un agarre neutro y los codos completamente estáticos.',
                   pt: 'Impulsione os pesos para cima através de uma contração enérgica mantendo uma pegada neutra e os cotovelos completamente estáticos.' } },
        { id: 'reset', start_pct: 90, end_pct: 100, easing: 'ease-in-out',
          label: { en: 'Reset · Peak Squeeze', es: 'Reinicio · Apretón Máximo', pt: 'Reinício · Contração Máxima' },
          cue:   { en: 'Hold the fully contracted peak motionless to maximize mechanical tension and squeeze the forearms and brachialis.',
                   es: 'Mantén el pico de contracción completa sin movimiento para maximizar la tensión mecánica y apretar los antebrazos y el braquial.',
                   pt: 'Mantenha o pico de contração total sem movimento para maximizar a tensão mecânica e contrair os antebraços e o braquial.' } }
      ],
      keyframes: [
        { t: 0.00, phase: 'eccentric',
          joints: {
            head: { x: 0.50, y: 0.20 },
            shoulder_l: { x: 0.50, y: 0.35 }, shoulder_r: { x: 0.50, y: 0.35 },
            elbow_l:    { x: 0.50, y: 0.52 }, elbow_r:    { x: 0.50, y: 0.52 },
            wrist_l:    { x: 0.60, y: 0.38 }, wrist_r:    { x: 0.60, y: 0.38 },
            hip_l:      { x: 0.50, y: 0.60 }, hip_r:      { x: 0.50, y: 0.60 },
            knee_l:     { x: 0.50, y: 0.78 }, knee_r:     { x: 0.50, y: 0.78 },
            ankle_l:    { x: 0.50, y: 0.92 }, ankle_r:    { x: 0.50, y: 0.92 }
          } },
        { t: 0.40, phase: 'eccentric',
          joints: { wrist_l: { x: 0.52, y: 0.70 }, wrist_r: { x: 0.52, y: 0.70 } } },
        { t: 0.50, phase: 'isometric', joints: {} },
        { t: 0.90, phase: 'concentric',
          joints: { wrist_l: { x: 0.60, y: 0.38 }, wrist_r: { x: 0.60, y: 0.38 } } },
        { t: 1.00, phase: 'reset', joints: {} }
      ]
    },

    equipment: [{ type: 'dumbbell', attach: ['wrist_l', 'wrist_r'] }],

    kineticPath: {
      default: { label: { en: 'Neutral Arc', es: 'Arco Neutro', pt: 'Arco Neutro' },
                 d: 'M 0.60 0.38 Q 0.65 0.55 0.52 0.70' },
      endpoints: [{ x: 0.60, y: 0.38 }, { x: 0.52, y: 0.70 }],
      labels: [
        { x: 0.62, y: 0.35, text: { en: 'Peak Squeeze',   es: 'Apretón Máximo',     pt: 'Contração Máxima' } },
        { x: 0.55, y: 0.75, text: { en: 'Full Extension', es: 'Extensión Completa', pt: 'Extensão Completa' } }
      ]
    },

    forms: {
      ok: {
        chipLabel: { en: 'Standard Form', es: 'Forma Estándar', pt: 'Forma Padrão' },
        callouts: [
          { from: 'elbow_l', to: { x: 0.30, y: 0.52 },
            lines: [{ en: 'Elbow pinned to torso', es: 'Codo fijado al torso', pt: 'Cotovelo fixado ao torso' }] }
        ],
        metrics: {
          dev: '± 0.5 cm',
          tuck: { en: 'Scapulae Depressed', es: 'Escápulas Deprimidas', pt: 'Escápulas Deprimidas' },
          load: { en: 'Brachialis Bias',    es: 'Sesgo del Braquial',   pt: 'Viés do Braquial' },
          fn:   { en: 'Clinical reference overlay', es: 'Capa de referencia clínica', pt: 'Camada de referência clínica' }
        },
        haloAt: null
      },
      warn: {
        chipLabel: { en: 'Common Fault: Anterior Shoulder Swing',
                     es: 'Falla Común: Balanceo Anterior del Hombro',
                     pt: 'Falha Comum: Balanço Anterior do Ombro' },
        callouts: [
          { from: 'elbow_l', to: { x: 0.20, y: 0.45 }, warn: true,
            lines: [{ en: 'Momentum shift · Tension loss',
                      es: 'Cambio de impulso · Pérdida de tensión',
                      pt: 'Mudança de impulso · Perda de tensão' }] }
        ],
        metrics: {
          dev: '± 3.0 cm',
          tuck: { en: 'Shoulder Protracted',  es: 'Hombro Protraído',           pt: 'Ombro Protraído' },
          load: { en: 'Anterior Delt Bias',   es: 'Sesgo del Deltoides Anterior', pt: 'Viés do Deltoide Anterior' },
          fn:   { en: 'Fault pattern · Elbow drifts forward',
                  es: 'Patrón de falla · El codo se desplaza hacia adelante',
                  pt: 'Padrão de falha · Cotovelo desloca-se para frente' }
        },
        haloAt: 'shoulder_l',
        keyframesOverride: [
          { t: 0.90, joints: { elbow_l: { x: 0.58, y: 0.50 }, elbow_r: { x: 0.58, y: 0.50 },
                               wrist_l: { x: 0.68, y: 0.45 }, wrist_r: { x: 0.68, y: 0.45 } } }
        ]
      }
    },

    metricLabels: {
      dev:  { en: 'Path Dev.',       es: 'Desv. Trayectoria',  pt: 'Desv. Trajetória' },
      tuck: { en: 'Shoulder Anchor', es: 'Anclaje del Hombro', pt: 'Ancoragem do Ombro' },
      load: { en: 'Muscle Bias',     es: 'Sesgo Muscular',     pt: 'Viés Muscular' }
    }
  };

  // ─── INCLINE DB PRESS (V2 · Batch 4) ─────────────────────
  var INCLINE_DB_PRESS = {
    id: 'incline_db_press',
    displayName: 'Incline DB Press',
    aliases: ['incline db press', 'incline dumbbell bench press', 'db incline press', 'dumbbell incline bench', 'incline dumbbell presses', 'incline presses'],

    title: {
      en: 'Clinical Protocol: Incline DB Press',
      es: 'Protocolo Clínico: Press Inclinado con Mancuernas',
      pt: 'Protocolo Clínico: Supino Inclinado com Halteres'
    },
    subtitle: {
      en: 'Sagittal Plane · Dumbbells · Sovereign Rig',
      es: 'Plano Sagital · Mancuernas · Equipo Soberano',
      pt: 'Plano Sagital · Halteres · Equipamento Soberano'
    },
    muscleTarget: {
      en: 'Primary: Pectoralis Major (Clavicular Head). Secondary: Anterior Deltoid, Triceps Brachii, Core Stabilizers.',
      es: 'Primario: Pectoral Mayor (Porción Clavicular). Secundarios: Deltoides Anterior, Tríceps Braquial, Estabilizadores del Core.',
      pt: 'Primário: Peitoral Maior (Porção Clavicular). Secundários: Deltoide Anterior, Tríceps Braquial, Estabilizadores do Core.'
    },
    clinicalNotes: {
      en: 'Perfect Sovereign execution demands retracted and depressed scapulae pinned rigidly into the bench set at a 30-to-45-degree angle to isolate the upper pectorals and protect the glenohumeral joint. The kinetic chain relies on a stable five-point contact system—feet, glutes, upper back, and head—paired with active intra-abdominal pressure to entirely prevent energy leakage and excessive lumbar arching. Optimal joint health is preserved by keeping the elbows tucked at a 45-degree angle to the torso, strictly avoiding subacromial impingement during the press.',
      es: 'La ejecución soberana perfecta exige escápulas retraídas y deprimidas rígidamente fijadas al banco ajustado a un ángulo de 30 a 45 grados para aislar los pectorales superiores y proteger la articulación glenohumeral. La cadena cinética depende de un sistema de cinco puntos de contacto estable—pies, glúteos, espalda alta y cabeza—junto con presión intraabdominal activa para prevenir por completo la fuga de energía y el arqueo lumbar excesivo. La salud articular óptima se preserva manteniendo los codos retraídos en un ángulo de 45 grados respecto al torso, evitando estrictamente el pinzamiento subacromial durante el empuje.',
      pt: 'A execução soberana perfeita exige escápulas retraídas e deprimidas rigidamente pressionadas contra o banco ajustado em um ângulo de 30 a 45 graus para isolar os peitorais superiores e proteger a articulação glenoumeral. A cadeia cinética depende de um sistema estável de cinco pontos de contato—pés, glúteos, costas superiores e cabeça—em conjunto com pressão intra-abdominal ativa para prevenir completamente a perda de energia e o arqueamento lombar excessivo. A saúde articular ótima é preservada mantendo os cotovelos retraídos em um ângulo de 45 graus em relação ao torso, evitando estritamente o impacto subacromial durante a pressão.'
    },
    svgTitle: {
      en: 'Incline DB Press Sagittal Wireframe',
      es: 'Wireframe Sagital de Press Inclinado con Mancuernas',
      pt: 'Wireframe Sagital de Supino Inclinado com Halteres'
    },

    plane: 'sagittal', facing: 'right', ground: { y: 0.92 },
    jointSpec: STD_JOINT_SPEC, bones: STD_BONES,

    animation: {
      duration_ms: 3500, loop: true, direction: 'normal', easing: 'ease-in-out',
      phases: [
        { id: 'eccentric', start_pct: 0, end_pct: 40, easing: 'ease-out',
          label: { en: 'Eccentric · Loaded Descent', es: 'Excéntrica · Descenso con Carga', pt: 'Excêntrica · Descida Carregada' },
          cue:   { en: 'Lower the dumbbells with deliberate pacing, maintaining tucked elbows, until a maximal, safe stretch is achieved across the upper chest.',
                   es: 'Baja las mancuernas con un ritmo deliberado, manteniendo los codos retraídos, hasta lograr un estiramiento máximo y seguro en el pecho superior.',
                   pt: 'Abaixe os halteres com ritmo deliberado, mantendo os cotovelos retraídos, até alcançar um alongamento máximo e seguro no peito superior.' } },
        { id: 'isometric', start_pct: 40, end_pct: 50, easing: 'linear',
          label: { en: 'Isometric · Deep Stretch', es: 'Isométrica · Estiramiento Profundo', pt: 'Isométrica · Alongamento Profundo' },
          cue:   { en: 'Pause motionless at the deepest point of the stretch to dissipate downward momentum and maximize mechanical tension on the clavicular fibers.',
                   es: 'Haz una pausa sin movimiento en el punto más profundo del estiramiento para disipar el impulso descendente y maximizar la tensión mecánica sobre las fibras claviculares.',
                   pt: 'Faça uma pausa sem movimento no ponto mais profundo do alongamento para dissipar o impulso descendente e maximizar a tensão mecânica sobre as fibras claviculares.' } },
        { id: 'concentric', start_pct: 50, end_pct: 90, easing: 'ease-in',
          label: { en: 'Concentric · Press Drive', es: 'Concéntrica · Empuje de Presión', pt: 'Concêntrica · Impulso de Pressão' },
          cue:   { en: 'Drive the dumbbells forcefully upward and inward through a strict contraction of the upper chest until the elbows reach full extension.',
                   es: 'Empuja las mancuernas con fuerza hacia arriba y hacia adentro mediante una contracción estricta del pecho superior hasta que los codos alcancen la extensión completa.',
                   pt: 'Empurre os halteres com força para cima e para dentro através de uma contração estrita do peito superior até que os cotovelos alcancem a extensão completa.' } },
        { id: 'reset', start_pct: 90, end_pct: 100, easing: 'ease-in-out',
          label: { en: 'Reset · Lockout Dwell', es: 'Reinicio · Pausa en Bloqueo', pt: 'Reinício · Pausa no Travamento' },
          cue:   { en: 'Maintain scapular retraction.', es: 'Mantén la retracción escapular.', pt: 'Mantenha a retração escapular.' } }
      ],
      keyframes: [
        { t: 0.00, phase: 'eccentric',
          joints: {
            head: { x: 0.35, y: 0.35 },
            shoulder_l: { x: 0.45, y: 0.45 }, shoulder_r: { x: 0.45, y: 0.45 },
            hip_l:      { x: 0.55, y: 0.65 }, hip_r:      { x: 0.55, y: 0.65 },
            knee_l:     { x: 0.75, y: 0.65 }, knee_r:     { x: 0.75, y: 0.65 },
            ankle_l:    { x: 0.75, y: 0.92 }, ankle_r:    { x: 0.75, y: 0.92 },
            elbow_l:    { x: 0.40, y: 0.35 }, elbow_r:    { x: 0.40, y: 0.35 },
            wrist_l:    { x: 0.40, y: 0.15 }, wrist_r:    { x: 0.40, y: 0.15 }
          } },
        { t: 0.40, phase: 'eccentric',
          joints: {
            elbow_l: { x: 0.40, y: 0.65 }, elbow_r: { x: 0.40, y: 0.65 },
            wrist_l: { x: 0.35, y: 0.45 }, wrist_r: { x: 0.35, y: 0.45 }
          } },
        { t: 0.50, phase: 'isometric', joints: {} },
        { t: 0.90, phase: 'concentric',
          joints: {
            elbow_l: { x: 0.40, y: 0.35 }, elbow_r: { x: 0.40, y: 0.35 },
            wrist_l: { x: 0.40, y: 0.15 }, wrist_r: { x: 0.40, y: 0.15 }
          } },
        { t: 1.00, phase: 'reset', joints: {} }
      ]
    },

    equipment: [
      { type: 'dumbbell', attach: ['wrist_l', 'wrist_r'] },
      { type: 'bench',    attach: ['shoulder_l', 'hip_l'] }
    ],

    kineticPath: {
      default: { label: { en: 'Incline Vector', es: 'Vector Inclinado', pt: 'Vetor Inclinado' },
                 d: 'M 0.40 0.15 L 0.35 0.45' },
      endpoints: [{ x: 0.40, y: 0.15 }, { x: 0.35, y: 0.45 }],
      labels: [
        { x: 0.45, y: 0.15, text: { en: 'Lockout',     es: 'Bloqueo',             pt: 'Travamento' } },
        { x: 0.30, y: 0.50, text: { en: 'Max Stretch', es: 'Estiramiento Máximo', pt: 'Alongamento Máximo' } }
      ]
    },

    forms: {
      ok: {
        chipLabel: { en: 'Standard Form', es: 'Forma Estándar', pt: 'Forma Padrão' },
        callouts: [
          { from: 'shoulder_l', to: { x: 0.20, y: 0.45 },
            lines: [{ en: 'Scapulae pinned to bench', es: 'Escápulas fijadas al banco', pt: 'Escápulas fixadas ao banco' }] }
        ],
        metrics: {
          dev: '± 1.0 cm',
          tuck: { en: 'Retracted',       es: 'Retraídas',          pt: 'Retraídas' },
          load: { en: 'Upper Pec Bias',  es: 'Sesgo Pectoral Superior', pt: 'Viés Peitoral Superior' },
          fn:   { en: 'Clinical reference overlay', es: 'Capa de referencia clínica', pt: 'Camada de referência clínica' }
        },
        haloAt: null
      },
      warn: {
        chipLabel: { en: 'Common Fault: Scapular Flare', es: 'Falla Común: Apertura Escapular', pt: 'Falha Comum: Abertura Escapular' },
        callouts: [
          { from: 'shoulder_l', to: { x: 0.20, y: 0.35 }, warn: true,
            lines: [{ en: 'Shoulders lift · Impingement risk',
                      es: 'Hombros se elevan · Riesgo de pinzamiento',
                      pt: 'Ombros sobem · Risco de impacto' }] }
        ],
        metrics: {
          dev: '± 4.0 cm',
          tuck: { en: 'Protracted',                 es: 'Protraídas',                       pt: 'Protraídas' },
          load: { en: 'Anterior Delt Overload',     es: 'Sobrecarga del Deltoides Anterior', pt: 'Sobrecarga do Deltoide Anterior' },
          fn:   { en: 'Fault pattern · Shoulders roll off bench',
                  es: 'Patrón de falla · Los hombros se despegan del banco',
                  pt: 'Padrão de falha · Ombros desencostam do banco' }
        },
        haloAt: 'shoulder_l',
        keyframesOverride: [
          { t: 0.90, joints: { shoulder_l: { x: 0.40, y: 0.40 }, shoulder_r: { x: 0.40, y: 0.40 } } }
        ]
      }
    },

    metricLabels: {
      dev:  { en: 'Path Dev.',       es: 'Desv. Trayectoria',  pt: 'Desv. Trajetória' },
      tuck: { en: 'Scapular Anchor', es: 'Anclaje Escapular',  pt: 'Ancoragem Escapular' },
      load: { en: 'Joint Load',      es: 'Carga Articular',    pt: 'Carga Articular' }
    }
  };

  // ─── SMITH MACHINE HIP THRUSTS (V2 · Batch 4) ────────────
  var SMITH_MACHINE_HIP_THRUSTS = {
    id: 'smith_machine_hip_thrusts',
    displayName: 'Smith Machine Hip Thrusts',
    aliases: ['smith machine hip thrusts', 'smith hip thrusts', 'barbell hip thrusts (smith)', 'smith machine glute bridges', 'glute thrusts', 'hip thrust', 'hip thrusts', 'barbell hip thrust', 'barbell hip thrusts'],

    title: {
      en: 'Clinical Protocol: Smith Machine Hip Thrusts',
      es: 'Protocolo Clínico: Empujes de Cadera en Máquina Smith',
      pt: 'Protocolo Clínico: Hip Thrust na Máquina Smith'
    },
    subtitle: {
      en: 'Sagittal Plane · Machine · Sovereign Rig',
      es: 'Plano Sagital · Máquina · Equipo Soberano',
      pt: 'Plano Sagital · Máquina · Equipamento Soberano'
    },
    muscleTarget: {
      en: 'Primary: Gluteus Maximus. Secondary: Hamstrings, Core Stabilizers.',
      es: 'Primario: Glúteo Mayor. Secundarios: Isquiotibiales, Estabilizadores del Core.',
      pt: 'Primário: Glúteo Máximo. Secundários: Isquiotibiais, Estabilizadores do Core.'
    },
    clinicalNotes: {
      en: 'Execution demands the inferior angle of the scapulae be rigidly hinged against the bench to establish a stable pivot point, entirely preventing compensatory lumbar hyperextension. The kinetic chain requires the feet to be actively planted so the shins remain perfectly vertical at the top of the movement, ensuring pure gluteal drive rather than quadriceps dominance. Joint health is optimized by keeping the chin tucked and the ribcage pulled down, moving the torso and pelvis as a single solid unit throughout the entire thrust.',
      es: 'La ejecución exige que el ángulo inferior de las escápulas esté rígidamente articulado contra el banco para establecer un punto de pivote estable, evitando por completo la hiperextensión lumbar compensatoria. La cadena cinética requiere que los pies estén activamente plantados para que las espinillas permanezcan perfectamente verticales en la parte superior del movimiento, garantizando un empuje puramente glúteo en lugar de la dominancia del cuádriceps. La salud articular se optimiza manteniendo el mentón retraído y la caja torácica hacia abajo, moviendo el torso y la pelvis como una sola unidad sólida durante todo el empuje.',
      pt: 'A execução exige que o ângulo inferior das escápulas esteja rigidamente articulado contra o banco para estabelecer um ponto de pivô estável, prevenindo completamente a hiperextensão lombar compensatória. A cadeia cinética requer que os pés estejam ativamente plantados para que as canelas permaneçam perfeitamente verticais no topo do movimento, garantindo um impulso puramente glúteo em vez de dominância do quadríceps. A saúde articular é otimizada mantendo o queixo retraído e a caixa torácica para baixo, movendo o torso e a pelve como uma unidade sólida durante todo o impulso.'
    },
    svgTitle: {
      en: 'Hip Thrust Sagittal Wireframe',
      es: 'Wireframe Sagital de Empuje de Cadera',
      pt: 'Wireframe Sagital de Hip Thrust'
    },

    plane: 'sagittal', facing: 'right', ground: { y: 0.92 },
    jointSpec: STD_JOINT_SPEC, bones: STD_BONES,

    animation: {
      duration_ms: 3500, loop: true, direction: 'normal', easing: 'ease-in-out',
      phases: [
        { id: 'eccentric', start_pct: 0, end_pct: 40, easing: 'ease-out',
          label: { en: 'Eccentric · Hip Hinge', es: 'Excéntrica · Bisagra de Cadera', pt: 'Excêntrica · Dobradiça de Quadril' },
          cue:   { en: 'Lower the pelvis with strict, deliberate control, hinging at the hips until the glutes hover just above the floor.',
                   es: 'Baja la pelvis con control estricto y deliberado, haciendo bisagra en las caderas hasta que los glúteos queden justo por encima del suelo.',
                   pt: 'Abaixe a pelve com controle estrito e deliberado, fazendo dobradiça nos quadris até que os glúteos fiquem logo acima do solo.' } },
        { id: 'isometric', start_pct: 40, end_pct: 50, easing: 'linear',
          label: { en: 'Isometric · Peak Hold', es: 'Isométrica · Pausa Máxima', pt: 'Isométrica · Pausa Máxima' },
          cue:   { en: 'Hold the fully contracted peak motionless to maximize mechanical tension and intensely squeeze the gluteals.',
                   es: 'Mantén el pico de contracción completa sin movimiento para maximizar la tensión mecánica y apretar intensamente los glúteos.',
                   pt: 'Mantenha o pico de contração total sem movimento para maximizar a tensão mecânica e contrair intensamente os glúteos.' } },
        { id: 'concentric', start_pct: 50, end_pct: 90, easing: 'ease-in',
          label: { en: 'Concentric · Glute Drive', es: 'Concéntrica · Empuje de Glúteos', pt: 'Concêntrica · Impulso de Glúteos' },
          cue:   { en: 'Drive forcefully upward through the mid-foot and heels to extend the hips fully, locking out the pelvis without hyper-extending the lower back.',
                   es: 'Empuja con fuerza hacia arriba desde la planta media del pie y los talones para extender las caderas completamente, bloqueando la pelvis sin hiperextender la espalda baja.',
                   pt: 'Empurre com força para cima através do meio do pé e calcanhares para estender os quadris completamente, travando a pelve sem hiperestender a região lombar.' } },
        { id: 'reset', start_pct: 90, end_pct: 100, easing: 'ease-in-out',
          label: { en: 'Reset · Top Lockout', es: 'Reinicio · Bloqueo Superior', pt: 'Reinício · Travamento no Topo' },
          cue:   { en: 'Maintain tucked chin and braced core.', es: 'Mantén el mentón retraído y el core activado.', pt: 'Mantenha o queixo retraído e o core ativado.' } }
      ],
      keyframes: [
        { t: 0.00, phase: 'eccentric',
          joints: {
            head: { x: 0.20, y: 0.40 },
            shoulder_l: { x: 0.25, y: 0.50 }, shoulder_r: { x: 0.25, y: 0.50 },
            hip_l:      { x: 0.45, y: 0.50 }, hip_r:      { x: 0.45, y: 0.50 },
            knee_l:     { x: 0.60, y: 0.50 }, knee_r:     { x: 0.60, y: 0.50 },
            ankle_l:    { x: 0.60, y: 0.92 }, ankle_r:    { x: 0.60, y: 0.92 },
            wrist_l:    { x: 0.45, y: 0.45 }, wrist_r:    { x: 0.45, y: 0.45 },
            elbow_l:    { x: 0.35, y: 0.45 }, elbow_r:    { x: 0.35, y: 0.45 }
          } },
        { t: 0.40, phase: 'eccentric',
          joints: {
            head: { x: 0.25, y: 0.35 },
            hip_l: { x: 0.40, y: 0.80 }, hip_r: { x: 0.40, y: 0.80 },
            knee_l: { x: 0.55, y: 0.65 }, knee_r: { x: 0.55, y: 0.65 },
            wrist_l: { x: 0.40, y: 0.75 }, wrist_r: { x: 0.40, y: 0.75 },
            elbow_l: { x: 0.35, y: 0.60 }, elbow_r: { x: 0.35, y: 0.60 }
          } },
        { t: 0.50, phase: 'isometric', joints: {} },
        { t: 0.90, phase: 'concentric',
          joints: {
            head: { x: 0.20, y: 0.40 },
            hip_l: { x: 0.45, y: 0.50 }, hip_r: { x: 0.45, y: 0.50 },
            knee_l: { x: 0.60, y: 0.50 }, knee_r: { x: 0.60, y: 0.50 },
            wrist_l: { x: 0.45, y: 0.45 }, wrist_r: { x: 0.45, y: 0.45 },
            elbow_l: { x: 0.35, y: 0.45 }, elbow_r: { x: 0.35, y: 0.45 }
          } },
        { t: 1.00, phase: 'reset', joints: {} }
      ]
    },

    equipment: [
      { type: 'bar',   attach: ['hip_l', 'hip_r'] },
      { type: 'bench', attach: ['shoulder_l'] }
    ],

    kineticPath: {
      default: { label: { en: 'Thrust Vector', es: 'Vector de Empuje', pt: 'Vetor de Impulso' },
                 d: 'M 0.40 0.80 L 0.45 0.50' },
      endpoints: [{ x: 0.40, y: 0.80 }, { x: 0.45, y: 0.50 }],
      labels: [
        { x: 0.50, y: 0.50, text: { en: 'Lockout', es: 'Bloqueo', pt: 'Travamento' } },
        { x: 0.45, y: 0.85, text: { en: 'Bottom',  es: 'Fondo',   pt: 'Fundo' } }
      ]
    },

    forms: {
      ok: {
        chipLabel: { en: 'Standard Form', es: 'Forma Estándar', pt: 'Forma Padrão' },
        callouts: [
          { from: 'knee_l', to: { x: 0.80, y: 0.50 },
            lines: [{ en: 'Vertical shin alignment', es: 'Alineación vertical de espinilla', pt: 'Alinhamento vertical da tíbia' }] }
        ],
        metrics: {
          dev: '± 1.0 cm',
          tuck: { en: 'Chin Tucked',     es: 'Mentón Retraído',         pt: 'Queixo Retraído' },
          load: { en: 'Glute Max Bias',  es: 'Sesgo del Glúteo Mayor',  pt: 'Viés do Glúteo Máximo' },
          fn:   { en: 'Clinical reference overlay', es: 'Capa de referencia clínica', pt: 'Camada de referência clínica' }
        },
        haloAt: null
      },
      warn: {
        chipLabel: { en: 'Common Fault: Lumbar Hyperextension', es: 'Falla Común: Hiperextensión Lumbar', pt: 'Falha Comum: Hiperextensão Lombar' },
        callouts: [
          { from: 'shoulder_l', to: { x: 0.20, y: 0.20 }, warn: true,
            lines: [{ en: 'Ribcage flared · Spinal shear',
                      es: 'Caja torácica abierta · Cizalla espinal',
                      pt: 'Caixa torácica aberta · Cisalhamento espinhal' }] }
        ],
        metrics: {
          dev: '± 4.0 cm',
          tuck: { en: 'Head Thrown Back', es: 'Cabeza Hacia Atrás', pt: 'Cabeça para Trás' },
          load: { en: 'Lumbar Overload',  es: 'Sobrecarga Lumbar',  pt: 'Sobrecarga Lombar' },
          fn:   { en: 'Fault pattern · Extending with lower back instead of hips',
                  es: 'Patrón de falla · Extendiendo con la espalda baja en lugar de las caderas',
                  pt: 'Padrão de falha · Estendendo com a região lombar em vez dos quadris' }
        },
        haloAt: 'shoulder_l',
        keyframesOverride: [
          { t: 0.90, joints: { head: { x: 0.15, y: 0.45 }, shoulder_l: { x: 0.25, y: 0.45 },
                               hip_l: { x: 0.45, y: 0.45 }, hip_r: { x: 0.45, y: 0.45 } } }
        ]
      }
    },

    metricLabels: {
      dev:  { en: 'Path Dev.',      es: 'Desv. Trayectoria', pt: 'Desv. Trajetória' },
      tuck: { en: 'Spinal Posture', es: 'Postura Espinal',   pt: 'Postura Espinhal' },
      load: { en: 'Tissue Load',    es: 'Carga Tisular',     pt: 'Carga Tecidual' }
    }
  };

  // ─── SINGLE ARM DB ROWS (V2 · Batch 4) ───────────────────
  // Validator-patched: original Blueprint declared only the working
  // (right) arm at t=0. Added supporting (left) arm joints at the
  // bench level so the figure renders complete: wrist_l rests on the
  // bench at the supporting-knee x; elbow_l between shoulder_l and
  // wrist_l.
  var SINGLE_ARM_DB_ROWS = {
    id: 'single_arm_db_rows',
    displayName: 'Single Arm DB Rows',
    aliases: ['single arm db rows', 'one arm dumbbell row', '1-arm row', 'unilateral dumbbell row', 'supported db row', 'db lawn mower rows'],

    title: {
      en: 'Clinical Protocol: Single Arm DB Rows',
      es: 'Protocolo Clínico: Remos a un Brazo con Mancuerna',
      pt: 'Protocolo Clínico: Remada Unilateral com Halter'
    },
    subtitle: {
      en: 'Sagittal Plane · Dumbbells · Sovereign Rig',
      es: 'Plano Sagital · Mancuernas · Equipo Soberano',
      pt: 'Plano Sagital · Halteres · Equipamento Soberano'
    },
    muscleTarget: {
      en: 'Primary: Latissimus Dorsi, Rhomboids, Middle Trapezius. Secondary: Posterior Deltoid, Biceps Brachii, Brachialis, Core Stabilizers.',
      es: 'Primarios: Dorsal Ancho, Romboides, Trapecio Medio. Secundarios: Deltoides Posterior, Bíceps Braquial, Braquial, Estabilizadores del Core.',
      pt: 'Primários: Latíssimo do Dorso, Romboides, Trapézio Médio. Secundários: Deltoide Posterior, Bíceps Braquial, Braquial, Estabilizadores do Core.'
    },
    clinicalNotes: {
      en: 'Perfect Sovereign execution necessitates a rigidly braced, neutral spine supported by the non-working arm and knee on the bench, entirely preventing torso rotation or momentum generation. The kinetic chain relies on initiating the movement through scapular retraction and driving the elbow toward the hip to strictly isolate the latissimus dorsi. Joint health is protected by pulling the dumbbell directly to the lower abdomen or hip crease, avoiding anterior humeral glide at the peak of the contraction.',
      es: 'La ejecución soberana perfecta requiere una columna neutra rígidamente activada, sostenida por el brazo y la rodilla no trabajadores sobre el banco, evitando por completo la rotación del torso o la generación de impulso. La cadena cinética depende de iniciar el movimiento mediante retracción escapular y conducir el codo hacia la cadera para aislar estrictamente el dorsal ancho. La salud articular se protege tirando de la mancuerna directamente al abdomen inferior o al pliegue de la cadera, evitando el deslizamiento humeral anterior en el pico de la contracción.',
      pt: 'A execução soberana perfeita necessita de uma coluna neutra rigidamente ativada, sustentada pelo braço e joelho não trabalhadores sobre o banco, prevenindo completamente a rotação do torso ou a geração de impulso. A cadeia cinética depende de iniciar o movimento através da retração escapular e conduzir o cotovelo em direção ao quadril para isolar estritamente o latíssimo do dorso. A saúde articular é protegida puxando o haltere diretamente para o abdômen inferior ou para a dobra do quadril, evitando o deslizamento umeral anterior no pico da contração.'
    },
    svgTitle: {
      en: 'DB Row Sagittal Wireframe',
      es: 'Wireframe Sagital de Remo con Mancuerna',
      pt: 'Wireframe Sagital de Remada com Halter'
    },

    plane: 'sagittal', facing: 'right', ground: { y: 0.92 },
    jointSpec: STD_JOINT_SPEC, bones: STD_BONES,

    animation: {
      duration_ms: 3500, loop: true, direction: 'normal', easing: 'ease-in-out',
      phases: [
        { id: 'eccentric', start_pct: 0, end_pct: 40, easing: 'ease-out',
          label: { en: 'Eccentric · Forward Reach', es: 'Excéntrica · Extensión Adelante', pt: 'Excêntrica · Extensão Adiante' },
          cue:   { en: 'Lower the dumbbell with deliberate pacing until the lat achieves a full, safe stretch and the scapula protracts naturally.',
                   es: 'Baja la mancuerna con un ritmo deliberado hasta que el dorsal alcance un estiramiento completo y seguro y la escápula se protraiga naturalmente.',
                   pt: 'Abaixe o haltere com ritmo deliberado até que o dorsal alcance um alongamento completo e seguro e a escápula protraia naturalmente.' } },
        { id: 'isometric', start_pct: 40, end_pct: 50, easing: 'linear',
          label: { en: 'Isometric · Bottom Stretch', es: 'Isométrica · Estiramiento Inferior', pt: 'Isométrica · Alongamento no Fundo' },
          cue:   { en: 'Hold the fully stretched position motionless to eliminate elastic recoil and maximize tension on the back musculature.',
                   es: 'Mantén la posición completamente estirada sin movimiento para eliminar el rebote elástico y maximizar la tensión en la musculatura de la espalda.',
                   pt: 'Mantenha a posição totalmente alongada sem movimento para eliminar o recuo elástico e maximizar a tensão na musculatura das costas.' } },
        { id: 'concentric', start_pct: 50, end_pct: 90, easing: 'ease-in',
          label: { en: 'Concentric · Hip Pull', es: 'Concéntrica · Tracción a la Cadera', pt: 'Concêntrica · Tração ao Quadril' },
          cue:   { en: 'Drive the elbow forcefully backward and upward toward the hip, squeezing the shoulder blade toward the spine.',
                   es: 'Empuja el codo con fuerza hacia atrás y arriba hacia la cadera, apretando la escápula hacia la columna.',
                   pt: 'Empurre o cotovelo com força para trás e para cima em direção ao quadril, contraindo a escápula em direção à coluna.' } },
        { id: 'reset', start_pct: 90, end_pct: 100, easing: 'ease-in-out',
          label: { en: 'Reset · Peak Contraction', es: 'Reinicio · Contracción Máxima', pt: 'Reinício · Contração Máxima' },
          cue:   { en: 'Hold peak tension without rotating torso.', es: 'Mantén la tensión máxima sin rotar el torso.', pt: 'Mantenha a tensão máxima sem rotacionar o torso.' } }
      ],
      keyframes: [
        { t: 0.00, phase: 'eccentric',
          joints: {
            head: { x: 0.70, y: 0.30 },
            shoulder_l: { x: 0.60, y: 0.40 }, shoulder_r: { x: 0.50, y: 0.45 },
            hip_l:      { x: 0.30, y: 0.55 }, hip_r:      { x: 0.30, y: 0.55 },
            knee_l:     { x: 0.35, y: 0.75 }, knee_r:     { x: 0.45, y: 0.75 },
            ankle_l:    { x: 0.35, y: 0.92 }, ankle_r:    { x: 0.55, y: 0.92 },
            elbow_l:    { x: 0.50, y: 0.55 }, wrist_l:    { x: 0.35, y: 0.65 },
            elbow_r:    { x: 0.55, y: 0.35 }, wrist_r:    { x: 0.55, y: 0.55 }
          } },
        { t: 0.40, phase: 'eccentric',
          joints: {
            shoulder_r: { x: 0.55, y: 0.50 },
            elbow_r:    { x: 0.55, y: 0.65 },
            wrist_r:    { x: 0.55, y: 0.80 }
          } },
        { t: 0.50, phase: 'isometric', joints: {} },
        { t: 0.90, phase: 'concentric',
          joints: {
            shoulder_r: { x: 0.50, y: 0.45 },
            elbow_r:    { x: 0.55, y: 0.35 },
            wrist_r:    { x: 0.55, y: 0.55 }
          } },
        { t: 1.00, phase: 'reset', joints: {} }
      ]
    },

    equipment: [
      { type: 'dumbbell', attach: ['wrist_r'] },
      { type: 'bench',    attach: ['wrist_l', 'knee_l'] }
    ],

    kineticPath: {
      default: { label: { en: 'Row Vector', es: 'Vector de Remo', pt: 'Vetor de Remada' },
                 d: 'M 0.55 0.80 L 0.55 0.55' },
      endpoints: [{ x: 0.55, y: 0.80 }, { x: 0.55, y: 0.55 }],
      labels: [
        { x: 0.60, y: 0.80, text: { en: 'Max Stretch',  es: 'Estiramiento Máximo', pt: 'Alongamento Máximo' } },
        { x: 0.60, y: 0.55, text: { en: 'Peak Squeeze', es: 'Apretón Máximo',      pt: 'Contração Máxima' } }
      ]
    },

    forms: {
      ok: {
        chipLabel: { en: 'Standard Form', es: 'Forma Estándar', pt: 'Forma Padrão' },
        callouts: [
          { from: 'shoulder_l', to: { x: 0.30, y: 0.35 },
            lines: [{ en: 'Torso locked square', es: 'Torso bloqueado cuadrado', pt: 'Torso travado em esquadro' }] }
        ],
        metrics: {
          dev: '± 1.0 cm',
          tuck: { en: 'Anti-Rotation', es: 'Anti-Rotación', pt: 'Anti-Rotação' },
          load: { en: 'Lat Bias',      es: 'Sesgo Dorsal',  pt: 'Viés Dorsal' },
          fn:   { en: 'Clinical reference overlay', es: 'Capa de referencia clínica', pt: 'Camada de referência clínica' }
        },
        haloAt: null
      },
      warn: {
        chipLabel: { en: 'Common Fault: Torso Rotation', es: 'Falla Común: Rotación del Torso', pt: 'Falha Comum: Rotação do Torso' },
        callouts: [
          { from: 'shoulder_r', to: { x: 0.20, y: 0.30 }, warn: true,
            lines: [{ en: 'Spinal twist · Tension loss',
                      es: 'Torsión espinal · Pérdida de tensión',
                      pt: 'Torção espinhal · Perda de tensão' }] }
        ],
        metrics: {
          dev: '± 5.0 cm',
          tuck: { en: 'Torso Twist',   es: 'Torsión del Torso', pt: 'Torção do Torso' },
          load: { en: 'Spinal Torque', es: 'Torque Espinal',    pt: 'Torque Espinhal' },
          fn:   { en: 'Fault pattern · Body rotates to assist the pull',
                  es: 'Patrón de falla · El cuerpo rota para asistir la tracción',
                  pt: 'Padrão de falha · Corpo rotaciona para auxiliar a tração' }
        },
        haloAt: 'shoulder_r',
        keyframesOverride: [
          { t: 0.90, joints: { shoulder_r: { x: 0.40, y: 0.40 }, head: { x: 0.60, y: 0.25 } } }
        ]
      }
    },

    metricLabels: {
      dev:  { en: 'Path Dev.',      es: 'Desv. Trayectoria', pt: 'Desv. Trajetória' },
      tuck: { en: 'Spinal Posture', es: 'Postura Espinal',   pt: 'Postura Espinhal' },
      load: { en: 'Muscle Bias',    es: 'Sesgo Muscular',    pt: 'Viés Muscular' }
    }
  };

  // ─── SEATED CALF RAISES (V2 · Batch 4) ───────────────────
  // Validator-patched: original Blueprint declared only left arm
  // joints at t=0. Added symmetric right-arm joints (elbow_r, wrist_r)
  // matching the supplied left-arm positions.
  var SEATED_CALF_RAISES = {
    id: 'seated_calf_raises',
    displayName: 'Seated Calf Raises',
    aliases: ['seated calf raises', 'machine seated calf raises', 'soleus raises', 'seated calf machine', 'bent-knee calf raises', 'calf raises', 'calf raise'],

    title: {
      en: 'Clinical Protocol: Seated Calf Raises',
      es: 'Protocolo Clínico: Elevaciones de Pantorrilla Sentado',
      pt: 'Protocolo Clínico: Elevação de Panturrilha Sentado'
    },
    subtitle: {
      en: 'Sagittal Plane · Machine · Sovereign Rig',
      es: 'Plano Sagital · Máquina · Equipo Soberano',
      pt: 'Plano Sagital · Máquina · Equipamento Soberano'
    },
    muscleTarget: {
      en: 'Primary: Soleus. Secondary: Gastrocnemius.',
      es: 'Primario: Sóleo. Secundario: Gastrocnemio.',
      pt: 'Primário: Sóleo. Secundário: Gastrocnêmio.'
    },
    clinicalNotes: {
      en: 'Execution demands the distal thighs remain rigidly pinned under the knee pads to isolate the ankle joint and strictly prevent any upward shifting or hip flexion assistance. The kinetic chain is simplified to pure ankle plantarflexion, requiring the balls of the feet to be perfectly aligned on the platform edge for fluid mechanical leverage. Joint articulation is optimized by utilizing the full, safe range of motion at the ankle, controlling the deep stretch to prevent shearing forces on the Achilles tendon.',
      es: 'La ejecución exige que los muslos distales permanezcan rígidamente fijados bajo los cojines de la rodilla para aislar la articulación del tobillo y prevenir estrictamente cualquier desplazamiento hacia arriba o asistencia por flexión de cadera. La cadena cinética se simplifica a flexión plantar pura del tobillo, requiriendo que las bolas de los pies estén perfectamente alineadas en el borde de la plataforma para una palanca mecánica fluida. La articulación se optimiza utilizando el rango completo y seguro de movimiento en el tobillo, controlando el estiramiento profundo para prevenir fuerzas de cizalla sobre el tendón de Aquiles.',
      pt: 'A execução exige que as coxas distais permaneçam rigidamente pressionadas sob os apoios do joelho para isolar a articulação do tornozelo e prevenir estritamente qualquer deslocamento para cima ou auxílio por flexão do quadril. A cadeia cinética é simplificada para pura flexão plantar do tornozelo, requerendo que as bolas dos pés estejam perfeitamente alinhadas na borda da plataforma para uma alavancagem mecânica fluida. A articulação é otimizada utilizando a amplitude completa e segura de movimento no tornozelo, controlando o alongamento profundo para prevenir forças de cisalhamento sobre o tendão de Aquiles.'
    },
    svgTitle: {
      en: 'Seated Calf Raise Sagittal Wireframe',
      es: 'Wireframe Sagital de Elevación de Pantorrilla Sentado',
      pt: 'Wireframe Sagital de Elevação de Panturrilha Sentado'
    },

    plane: 'sagittal', facing: 'right', ground: { y: 0.92 },
    jointSpec: STD_JOINT_SPEC, bones: STD_BONES,

    animation: {
      duration_ms: 3000, loop: true, direction: 'normal', easing: 'ease-in-out',
      phases: [
        { id: 'eccentric', start_pct: 0, end_pct: 40, easing: 'ease-out',
          label: { en: 'Eccentric · Heel Drop', es: 'Excéntrica · Caída del Talón', pt: 'Excêntrica · Queda do Calcanhar' },
          cue:   { en: 'Lower the heels with strict, deliberate control until the calves and Achilles tendons achieve a maximal, safe stretch.',
                   es: 'Baja los talones con control estricto y deliberado hasta que las pantorrillas y los tendones de Aquiles alcancen un estiramiento máximo y seguro.',
                   pt: 'Abaixe os calcanhares com controle estrito e deliberado até que as panturrilhas e os tendões de Aquiles alcancem um alongamento máximo e seguro.' } },
        { id: 'isometric', start_pct: 40, end_pct: 50, easing: 'linear',
          label: { en: 'Isometric · Bottom Stretch', es: 'Isométrica · Estiramiento Inferior', pt: 'Isométrica · Alongamento no Fundo' },
          cue:   { en: 'Hold the deepest point of the stretch motionless to dissipate elastic energy and maximize mechanical tension on the soleus.',
                   es: 'Mantén el punto más profundo del estiramiento sin movimiento para disipar la energía elástica y maximizar la tensión mecánica sobre el sóleo.',
                   pt: 'Mantenha o ponto mais profundo do alongamento sem movimento para dissipar a energia elástica e maximizar a tensão mecânica sobre o sóleo.' } },
        { id: 'concentric', start_pct: 50, end_pct: 90, easing: 'ease-in',
          label: { en: 'Concentric · Plantarflexion', es: 'Concéntrica · Flexión Plantar', pt: 'Concêntrica · Flexão Plantar' },
          cue:   { en: 'Drive the balls of the feet forcefully into the platform to plantarflex the ankles until peak contraction is reached.',
                   es: 'Empuja las bolas de los pies con fuerza contra la plataforma para flexionar plantarmente los tobillos hasta alcanzar la contracción máxima.',
                   pt: 'Empurre as bolas dos pés com força contra a plataforma para flexionar plantarmente os tornozelos até alcançar a contração máxima.' } },
        { id: 'reset', start_pct: 90, end_pct: 100, easing: 'ease-in-out',
          label: { en: 'Reset · Peak Hold', es: 'Reinicio · Pausa Máxima', pt: 'Reinício · Pausa no Pico' },
          cue:   { en: 'Squeeze soleus heavily.', es: 'Aprieta el sóleo con fuerza.', pt: 'Contraia o sóleo com força.' } }
      ],
      keyframes: [
        { t: 0.00, phase: 'eccentric',
          joints: {
            head: { x: 0.40, y: 0.20 },
            shoulder_l: { x: 0.40, y: 0.35 }, shoulder_r: { x: 0.40, y: 0.35 },
            hip_l:      { x: 0.40, y: 0.60 }, hip_r:      { x: 0.40, y: 0.60 },
            knee_l:     { x: 0.65, y: 0.60 }, knee_r:     { x: 0.65, y: 0.60 },
            ankle_l:    { x: 0.65, y: 0.80 }, ankle_r:    { x: 0.65, y: 0.80 },
            elbow_l:    { x: 0.45, y: 0.45 }, elbow_r:    { x: 0.45, y: 0.45 },
            wrist_l:    { x: 0.55, y: 0.55 }, wrist_r:    { x: 0.55, y: 0.55 }
          } },
        { t: 0.40, phase: 'eccentric',
          joints: {
            knee_l: { x: 0.65, y: 0.57 }, knee_r: { x: 0.65, y: 0.57 },
            ankle_l: { x: 0.65, y: 0.85 }, ankle_r: { x: 0.65, y: 0.85 }
          } },
        { t: 0.50, phase: 'isometric', joints: {} },
        { t: 0.90, phase: 'concentric',
          joints: {
            knee_l: { x: 0.65, y: 0.60 }, knee_r: { x: 0.65, y: 0.60 },
            ankle_l: { x: 0.65, y: 0.80 }, ankle_r: { x: 0.65, y: 0.80 }
          } },
        { t: 1.00, phase: 'reset', joints: {} }
      ]
    },

    equipment: [{ type: 'machine_pad', attach: ['knee_l', 'knee_r'] }],

    kineticPath: {
      default: { label: { en: 'Calf Drive', es: 'Empuje de Pantorrilla', pt: 'Impulso de Panturrilha' },
                 d: 'M 0.65 0.85 L 0.65 0.80' },
      endpoints: [{ x: 0.65, y: 0.85 }, { x: 0.65, y: 0.80 }],
      labels: [
        { x: 0.70, y: 0.85, text: { en: 'Max Stretch',      es: 'Estiramiento Máximo', pt: 'Alongamento Máximo' } },
        { x: 0.70, y: 0.80, text: { en: 'Peak Contraction', es: 'Contracción Máxima',  pt: 'Contração Máxima' } }
      ]
    },

    forms: {
      ok: {
        chipLabel: { en: 'Standard Form', es: 'Forma Estándar', pt: 'Forma Padrão' },
        callouts: [
          { from: 'knee_l', to: { x: 0.80, y: 0.50 },
            lines: [{ en: 'Thighs pinned securely', es: 'Muslos fijados con seguridad', pt: 'Coxas fixadas com segurança' }] }
        ],
        metrics: {
          dev: '± 0.5 cm',
          tuck: { en: 'Hips Anchored',     es: 'Caderas Ancladas',    pt: 'Quadris Ancorados' },
          load: { en: 'Soleus Isolation',  es: 'Aislamiento del Sóleo', pt: 'Isolamento do Sóleo' },
          fn:   { en: 'Clinical reference overlay', es: 'Capa de referencia clínica', pt: 'Camada de referência clínica' }
        },
        haloAt: null
      },
      warn: {
        chipLabel: { en: 'Common Fault: Bouncing', es: 'Falla Común: Rebote', pt: 'Falha Comum: Rebote' },
        callouts: [
          { from: 'ankle_l', to: { x: 0.80, y: 0.90 }, warn: true,
            lines: [{ en: 'Elastic recoil · Tension loss',
                      es: 'Rebote elástico · Pérdida de tensión',
                      pt: 'Recuo elástico · Perda de tensão' }] }
        ],
        metrics: {
          dev: '± 2.0 cm',
          tuck: { en: 'Momentum Shift',  es: 'Cambio de Impulso',  pt: 'Mudança de Impulso' },
          load: { en: 'Achilles Strain', es: 'Tensión del Aquiles', pt: 'Tensão do Aquiles' },
          fn:   { en: 'Fault pattern · Failure to pause at bottom',
                  es: 'Patrón de falla · No se logra pausar en el fondo',
                  pt: 'Padrão de falha · Falha em pausar no fundo' }
        },
        haloAt: 'ankle_l',
        keyframesOverride: [
          { t: 0.50, joints: { ankle_l: { x: 0.65, y: 0.82 }, ankle_r: { x: 0.65, y: 0.82 } } }
        ]
      }
    },

    metricLabels: {
      dev:  { en: 'Path Dev.',   es: 'Desv. Trayectoria',  pt: 'Desv. Trajetória' },
      tuck: { en: 'Knee Anchor', es: 'Anclaje de Rodilla', pt: 'Ancoragem do Joelho' },
      load: { en: 'Muscle Bias', es: 'Sesgo Muscular',     pt: 'Viés Muscular' }
    }
  };

  // ─── CABLE KICKBACKS (V2 · Batch 4) ──────────────────────
  // Validator-patched: original Blueprint declared only left arm
  // joints at t=0. Added symmetric right-arm joints since both arms
  // typically grip the machine framework for support.
  var CABLE_KICKBACKS = {
    id: 'cable_kickbacks',
    displayName: 'Cable Kickbacks',
    aliases: ['cable kickbacks', 'cable glute kickbacks', 'glute kickbacks', 'cable hip extensions', 'standing cable kickbacks', 'single leg cable kickbacks', 'pulley kickbacks', 'reverse kickback', 'reverse kickbacks', 'reverse cable kickbacks'],

    title: {
      en: 'Clinical Protocol: Cable Kickbacks',
      es: 'Protocolo Clínico: Patadas de Glúteo en Polea',
      pt: 'Protocolo Clínico: Coice de Glúteo na Polia'
    },
    subtitle: {
      en: 'Sagittal Plane · Cable · Sovereign Rig',
      es: 'Plano Sagital · Polea · Equipo Soberano',
      pt: 'Plano Sagital · Cabo · Equipamento Soberano'
    },
    muscleTarget: {
      en: 'Primary: Gluteus Maximus. Secondary: Hamstrings, Core Stabilizers.',
      es: 'Primario: Glúteo Mayor. Secundarios: Isquiotibiales, Estabilizadores del Core.',
      pt: 'Primário: Glúteo Máximo. Secundários: Isquiotibiais, Estabilizadores do Core.'
    },
    clinicalNotes: {
      en: 'Perfect Sovereign execution requires a slightly hinged, rigidly braced torso supported by holding the machine framework to entirely prevent lumbar hyperextension during the kickback. The kinetic chain relies on pure unilateral hip extension, utilizing active intra-abdominal pressure to keep the pelvis completely square and static. Joint health is preserved by driving the working leg backward only until the natural limit of active hip extension is reached, strictly avoiding any lower back compensation or pelvic tilt.',
      es: 'La ejecución soberana perfecta requiere un torso ligeramente flexionado y rígidamente activado, sostenido sujetando la estructura de la máquina para prevenir por completo la hiperextensión lumbar durante la patada. La cadena cinética depende de la pura extensión unilateral de cadera, utilizando presión intraabdominal activa para mantener la pelvis completamente cuadrada y estática. La salud articular se preserva impulsando la pierna de trabajo hacia atrás solo hasta el límite natural de la extensión activa de cadera, evitando estrictamente cualquier compensación de la espalda baja o inclinación pélvica.',
      pt: 'A execução soberana perfeita requer um torso ligeiramente flexionado e rigidamente ativado, sustentado segurando a estrutura da máquina para prevenir completamente a hiperextensão lombar durante o coice. A cadeia cinética depende da pura extensão unilateral do quadril, utilizando pressão intra-abdominal ativa para manter a pelve completamente esquadrada e estática. A saúde articular é preservada impulsionando a perna de trabalho para trás apenas até o limite natural da extensão ativa do quadril, evitando estritamente qualquer compensação da região lombar ou inclinação pélvica.'
    },
    svgTitle: {
      en: 'Cable Kickback Sagittal Wireframe',
      es: 'Wireframe Sagital de Patada de Glúteo en Polea',
      pt: 'Wireframe Sagital de Coice de Glúteo na Polia'
    },

    plane: 'sagittal', facing: 'right', ground: { y: 0.92 },
    jointSpec: STD_JOINT_SPEC, bones: STD_BONES,

    animation: {
      duration_ms: 3000, loop: true, direction: 'normal', easing: 'ease-in-out',
      phases: [
        { id: 'eccentric', start_pct: 0, end_pct: 40, easing: 'ease-out',
          label: { en: 'Eccentric · Controlled Return', es: 'Excéntrica · Retorno Controlado', pt: 'Excêntrica · Retorno Controlado' },
          cue:   { en: 'Allow the cable to slowly pull the working leg forward with deliberate pacing until the hip reaches a safe degree of flexion.',
                   es: 'Permite que el cable jale lentamente la pierna de trabajo hacia adelante con un ritmo deliberado hasta que la cadera alcance un grado seguro de flexión.',
                   pt: 'Permita que o cabo puxe lentamente a perna de trabalho para frente com ritmo deliberado até que o quadril alcance um grau seguro de flexão.' } },
        { id: 'isometric', start_pct: 40, end_pct: 50, easing: 'linear',
          label: { en: 'Isometric · Bottom Stretch', es: 'Isométrica · Estiramiento Inferior', pt: 'Isométrica · Alongamento no Fundo' },
          cue:   { en: 'Kill momentum before the kick.', es: 'Anula el impulso antes de la patada.', pt: 'Anule o impulso antes do coice.' } },
        { id: 'concentric', start_pct: 50, end_pct: 90, easing: 'ease-in',
          label: { en: 'Concentric · Glute Drive', es: 'Concéntrica · Empuje de Glúteos', pt: 'Concêntrica · Impulso de Glúteos' },
          cue:   { en: 'Drive the heel forcefully backward through a strict contraction of the glute.',
                   es: 'Empuja el talón con fuerza hacia atrás mediante una contracción estricta del glúteo.',
                   pt: 'Empurre o calcanhar com força para trás através de uma contração estrita do glúteo.' } },
        { id: 'reset', start_pct: 90, end_pct: 100, easing: 'ease-in-out',
          label: { en: 'Reset · Peak Contraction', es: 'Reinicio · Contracción Máxima', pt: 'Reinício · Contração Máxima' },
          cue:   { en: 'Hold the fully contracted peak motionless to maximize mechanical tension and intensely squeeze the gluteus maximus.',
                   es: 'Mantén el pico de contracción completa sin movimiento para maximizar la tensión mecánica y apretar intensamente el glúteo mayor.',
                   pt: 'Mantenha o pico de contração total sem movimento para maximizar a tensão mecânica e contrair intensamente o glúteo máximo.' } }
      ],
      keyframes: [
        { t: 0.00, phase: 'eccentric',
          joints: {
            head: { x: 0.35, y: 0.35 },
            shoulder_l: { x: 0.40, y: 0.45 }, shoulder_r: { x: 0.40, y: 0.45 },
            hip_l:      { x: 0.45, y: 0.60 }, hip_r:      { x: 0.45, y: 0.60 },
            knee_l:     { x: 0.45, y: 0.75 }, knee_r:     { x: 0.30, y: 0.75 },
            ankle_l:    { x: 0.45, y: 0.92 }, ankle_r:    { x: 0.15, y: 0.85 },
            elbow_l:    { x: 0.50, y: 0.45 }, elbow_r:    { x: 0.50, y: 0.45 },
            wrist_l:    { x: 0.60, y: 0.45 }, wrist_r:    { x: 0.60, y: 0.45 }
          } },
        { t: 0.40, phase: 'eccentric',
          joints: { knee_r: { x: 0.55, y: 0.70 }, ankle_r: { x: 0.60, y: 0.85 } } },
        { t: 0.50, phase: 'isometric', joints: {} },
        { t: 0.90, phase: 'concentric',
          joints: { knee_r: { x: 0.30, y: 0.75 }, ankle_r: { x: 0.15, y: 0.85 } } },
        { t: 1.00, phase: 'reset', joints: {} }
      ]
    },

    equipment: [{ type: 'cable_column', attach: ['ankle_r'] }],

    kineticPath: {
      default: { label: { en: 'Kick Vector', es: 'Vector de Patada', pt: 'Vetor de Coice' },
                 d: 'M 0.60 0.85 Q 0.40 0.90 0.15 0.85' },
      endpoints: [{ x: 0.60, y: 0.85 }, { x: 0.15, y: 0.85 }],
      labels: [
        { x: 0.65, y: 0.85, text: { en: 'Start',        es: 'Inicio',          pt: 'Início' } },
        { x: 0.10, y: 0.85, text: { en: 'Peak Squeeze', es: 'Apretón Máximo',  pt: 'Contração Máxima' } }
      ]
    },

    forms: {
      ok: {
        chipLabel: { en: 'Standard Form', es: 'Forma Estándar', pt: 'Forma Padrão' },
        callouts: [
          { from: 'hip_l', to: { x: 0.25, y: 0.50 },
            lines: [{ en: 'Pelvis squared, spine neutral', es: 'Pelvis cuadrada, columna neutra', pt: 'Pelve esquadrada, coluna neutra' }] }
        ],
        metrics: {
          dev: '± 1.0 cm',
          tuck: { en: 'Anti-Extension', es: 'Anti-Extensión',         pt: 'Anti-Extensão' },
          load: { en: 'Glute Max Bias', es: 'Sesgo del Glúteo Mayor', pt: 'Viés do Glúteo Máximo' },
          fn:   { en: 'Clinical reference overlay', es: 'Capa de referencia clínica', pt: 'Camada de referência clínica' }
        },
        haloAt: null
      },
      warn: {
        chipLabel: { en: 'Common Fault: Lumbar Hyperextension', es: 'Falla Común: Hiperextensión Lumbar', pt: 'Falha Comum: Hiperextensão Lombar' },
        callouts: [
          { from: 'hip_l', to: { x: 0.25, y: 0.50 }, warn: true,
            lines: [{ en: 'Lower back arches · Spine shear',
                      es: 'La espalda baja se arquea · Cizalla espinal',
                      pt: 'Região lombar arqueia · Cisalhamento espinhal' }] }
        ],
        metrics: {
          dev: '± 4.0 cm',
          tuck: { en: 'Lumbar Arch',     es: 'Arco Lumbar',        pt: 'Arco Lombar' },
          load: { en: 'Erector Strain',  es: 'Tensión de Erectores', pt: 'Tensão de Eretores' },
          fn:   { en: 'Fault pattern · Back extends to assist hip drive',
                  es: 'Patrón de falla · La espalda se extiende para asistir el empuje de cadera',
                  pt: 'Padrão de falha · Costas estendem para auxiliar o impulso do quadril' }
        },
        haloAt: 'hip_l',
        keyframesOverride: [
          { t: 0.90, joints: { hip_r: { x: 0.40, y: 0.60 }, shoulder_r: { x: 0.35, y: 0.45 }, head: { x: 0.30, y: 0.30 } } }
        ]
      }
    },

    metricLabels: {
      dev:  { en: 'Path Dev.',     es: 'Desv. Trayectoria', pt: 'Desv. Trajetória' },
      tuck: { en: 'Pelvic Anchor', es: 'Anclaje Pélvico',   pt: 'Ancoragem Pélvica' },
      load: { en: 'Muscle Bias',   es: 'Sesgo Muscular',    pt: 'Viés Muscular' }
    }
  };

  // ─── MACHINE CHEST PRESS (V2 · Batch 5) ──────────────────
  var MACHINE_CHEST_PRESS = {
    id: 'machine_chest_press',
    displayName: 'Machine Chest Press',
    aliases: ['machine chest press', 'seated chest press', 'machine press', 'chest press machine', 'seated machine chest press', 'hammer strength chest press', 'neutral grip machine press', 'chest press', 'chest presses'],

    title: {
      en: 'Clinical Protocol: Machine Chest Press',
      es: 'Protocolo Clínico: Press de Pecho en Máquina',
      pt: 'Protocolo Clínico: Supino na Máquina'
    },
    subtitle: {
      en: 'Transverse Plane · Machine · Sovereign Rig',
      es: 'Plano Transversal · Máquina · Equipo Soberano',
      pt: 'Plano Transversal · Máquina · Equipamento Soberano'
    },
    muscleTarget: {
      en: 'Primary: Pectoralis Major. Secondary: Anterior Deltoid, Triceps Brachii.',
      es: 'Primario: Pectoral Mayor. Secundarios: Deltoides Anterior, Tríceps Braquial.',
      pt: 'Primário: Peitoral Maior. Secundários: Deltoide Anterior, Tríceps Braquial.'
    },
    clinicalNotes: {
      en: 'Perfect Sovereign execution demands retracted and depressed scapulae pinned rigidly against the back pad to ensure strict isolation of the pectoralis major and prevent anterior humeral glide. The kinetic chain relies on active foot drive into the floor to maintain a highly braced torso, entirely eliminating lumbar hyperextension or energy leakage. Optimal joint health is preserved by keeping the elbows slightly tucked below the shoulder line, strictly avoiding subacromial impingement during the press.',
      es: 'La ejecución soberana perfecta exige escápulas retraídas y deprimidas rígidamente fijadas contra el respaldo para garantizar el aislamiento estricto del pectoral mayor y prevenir el deslizamiento humeral anterior. La cadena cinética depende del empuje activo de los pies contra el suelo para mantener un torso altamente activado, eliminando por completo la hiperextensión lumbar o la fuga de energía. La salud articular óptima se preserva manteniendo los codos ligeramente retraídos por debajo de la línea de los hombros, evitando estrictamente el pinzamiento subacromial durante el empuje.',
      pt: 'A execução soberana perfeita exige escápulas retraídas e deprimidas rigidamente pressionadas contra o encosto para garantir o isolamento estrito do peitoral maior e prevenir o deslizamento umeral anterior. A cadeia cinética depende do impulso ativo dos pés contra o chão para manter um torso altamente ativado, eliminando completamente a hiperextensão lombar ou a perda de energia. A saúde articular ótima é preservada mantendo os cotovelos ligeiramente retraídos abaixo da linha dos ombros, evitando estritamente o impacto subacromial durante a pressão.'
    },
    svgTitle: {
      en: 'Machine Press Sagittal Wireframe',
      es: 'Wireframe Sagital de Press en Máquina',
      pt: 'Wireframe Sagital de Supino na Máquina'
    },

    plane: 'sagittal', facing: 'right', ground: { y: 0.92 },
    jointSpec: STD_JOINT_SPEC, bones: STD_BONES,

    animation: {
      duration_ms: 3500, loop: true, direction: 'normal', easing: 'ease-in-out',
      phases: [
        { id: 'eccentric', start_pct: 0, end_pct: 40, easing: 'ease-out',
          label: { en: 'Eccentric · Loaded Descent', es: 'Excéntrica · Descenso con Carga', pt: 'Excêntrica · Descida Carregada' },
          cue:   { en: 'Allow the handles to return with strict, deliberate control until a maximal, safe stretch is achieved across the chest.',
                   es: 'Permite que las manijas regresen con control estricto y deliberado hasta lograr un estiramiento máximo y seguro en el pecho.',
                   pt: 'Permita que as alças retornem com controle estrito e deliberado até alcançar um alongamento máximo e seguro no peito.' } },
        { id: 'isometric', start_pct: 40, end_pct: 50, easing: 'linear',
          label: { en: 'Isometric · Deep Stretch', es: 'Isométrica · Estiramiento Profundo', pt: 'Isométrica · Alongamento Profundo' },
          cue:   { en: 'Pause motionless at the deepest point of the stretch to dissipate elastic recoil and maximize mechanical tension on the pectorals.',
                   es: 'Haz una pausa sin movimiento en el punto más profundo del estiramiento para disipar el rebote elástico y maximizar la tensión mecánica sobre los pectorales.',
                   pt: 'Faça uma pausa sem movimento no ponto mais profundo do alongamento para dissipar o recuo elástico e maximizar a tensão mecânica sobre os peitorais.' } },
        { id: 'concentric', start_pct: 50, end_pct: 90, easing: 'ease-in',
          label: { en: 'Concentric · Press Drive', es: 'Concéntrica · Empuje de Presión', pt: 'Concêntrica · Impulso de Pressão' },
          cue:   { en: 'Drive the handles forcefully forward through a strict contraction of the chest until the elbows reach full extension without losing scapular retraction.',
                   es: 'Empuja las manijas con fuerza hacia adelante mediante una contracción estricta del pecho hasta que los codos alcancen la extensión completa sin perder la retracción escapular.',
                   pt: 'Empurre as alças com força para frente através de uma contração estrita do peito até que os cotovelos alcancem a extensão completa sem perder a retração escapular.' } },
        { id: 'reset', start_pct: 90, end_pct: 100, easing: 'ease-in-out',
          label: { en: 'Reset · Lockout Dwell', es: 'Reinicio · Pausa en Bloqueo', pt: 'Reinício · Pausa no Travamento' },
          cue:   { en: 'Maintain scapular retraction and tension.', es: 'Mantén la retracción escapular y la tensión.', pt: 'Mantenha a retração escapular e a tensão.' } }
      ],
      keyframes: [
        { t: 0.00, phase: 'eccentric',
          joints: {
            head: { x: 0.20, y: 0.30 },
            shoulder_l: { x: 0.25, y: 0.40 }, shoulder_r: { x: 0.25, y: 0.40 },
            hip_l:      { x: 0.30, y: 0.65 }, hip_r:      { x: 0.30, y: 0.65 },
            knee_l:     { x: 0.60, y: 0.65 }, knee_r:     { x: 0.60, y: 0.65 },
            ankle_l:    { x: 0.60, y: 0.92 }, ankle_r:    { x: 0.60, y: 0.92 },
            elbow_l:    { x: 0.20, y: 0.50 }, elbow_r:    { x: 0.20, y: 0.50 },
            wrist_l:    { x: 0.55, y: 0.45 }, wrist_r:    { x: 0.55, y: 0.45 }
          } },
        { t: 0.40, phase: 'eccentric',
          joints: {
            elbow_l: { x: 0.10, y: 0.50 }, elbow_r: { x: 0.10, y: 0.50 },
            wrist_l: { x: 0.25, y: 0.45 }, wrist_r: { x: 0.25, y: 0.45 }
          } },
        { t: 0.50, phase: 'isometric', joints: {} },
        { t: 0.90, phase: 'concentric',
          joints: {
            elbow_l: { x: 0.20, y: 0.50 }, elbow_r: { x: 0.20, y: 0.50 },
            wrist_l: { x: 0.55, y: 0.45 }, wrist_r: { x: 0.55, y: 0.45 }
          } },
        { t: 1.00, phase: 'reset', joints: {} }
      ]
    },

    equipment: [
      { type: 'machine_pad', attach: ['wrist_l', 'wrist_r'] },
      { type: 'bench',       attach: ['shoulder_l', 'hip_l'] }
    ],

    kineticPath: {
      default: { label: { en: 'Press Vector', es: 'Vector de Presión', pt: 'Vetor de Pressão' },
                 d: 'M 0.25 0.45 L 0.55 0.45' },
      endpoints: [{ x: 0.25, y: 0.45 }, { x: 0.55, y: 0.45 }],
      labels: [
        { x: 0.55, y: 0.40, text: { en: 'Lockout',     es: 'Bloqueo',             pt: 'Travamento' } },
        { x: 0.25, y: 0.40, text: { en: 'Max Stretch', es: 'Estiramiento Máximo', pt: 'Alongamento Máximo' } }
      ]
    },

    forms: {
      ok: {
        chipLabel: { en: 'Standard Form', es: 'Forma Estándar', pt: 'Forma Padrão' },
        callouts: [
          { from: 'shoulder_l', to: { x: 0.10, y: 0.35 },
            lines: [{ en: 'Scapulae pinned to pad', es: 'Escápulas fijadas al respaldo', pt: 'Escápulas fixadas ao encosto' }] }
        ],
        metrics: {
          dev: '± 1.0 cm',
          tuck: { en: 'Retracted',     es: 'Retraídas',     pt: 'Retraídas' },
          load: { en: 'Pectoral Bias', es: 'Sesgo Pectoral', pt: 'Viés Peitoral' },
          fn:   { en: 'Clinical reference overlay', es: 'Capa de referencia clínica', pt: 'Camada de referência clínica' }
        },
        haloAt: null
      },
      warn: {
        chipLabel: { en: 'Common Fault: Anterior Humeral Glide',
                     es: 'Falla Común: Deslizamiento Humeral Anterior',
                     pt: 'Falha Comum: Deslizamento Umeral Anterior' },
        callouts: [
          { from: 'shoulder_l', to: { x: 0.10, y: 0.30 }, warn: true,
            lines: [{ en: 'Shoulders roll forward · Impingement risk',
                      es: 'Hombros ruedan adelante · Riesgo de pinzamiento',
                      pt: 'Ombros rolam para frente · Risco de impacto' }] }
        ],
        metrics: {
          dev: '± 4.0 cm',
          tuck: { en: 'Protracted',                es: 'Protraídas',                       pt: 'Protraídas' },
          load: { en: 'Anterior Delt Overload',    es: 'Sobrecarga del Deltoides Anterior', pt: 'Sobrecarga do Deltoide Anterior' },
          fn:   { en: 'Fault pattern · Shoulders leave the back pad to push',
                  es: 'Patrón de falla · Los hombros se despegan del respaldo para empujar',
                  pt: 'Padrão de falha · Ombros desencostam do encosto para empurrar' }
        },
        haloAt: 'shoulder_l',
        keyframesOverride: [
          { t: 0.90, joints: { shoulder_l: { x: 0.35, y: 0.40 }, shoulder_r: { x: 0.35, y: 0.40 } } }
        ]
      }
    },

    metricLabels: {
      dev:  { en: 'Path Dev.',       es: 'Desv. Trayectoria',  pt: 'Desv. Trajetória' },
      tuck: { en: 'Scapular Anchor', es: 'Anclaje Escapular',  pt: 'Ancoragem Escapular' },
      load: { en: 'Joint Load',      es: 'Carga Articular',    pt: 'Carga Articular' }
    }
  };

  // ─── SEATED MACHINE ABDUCTION (V2 · Batch 5) ─────────────
  // Validator-patched: original Blueprint omitted arm joints at t=0.
  // Added arms gripping seat handles at the sides (elbow at upper hip,
  // wrist at lower hip level).
  var SEATED_MACHINE_ABDUCTION = {
    id: 'seated_machine_abduction',
    displayName: 'Seated Machine Abduction',
    aliases: ['seated machine abduction', 'hip abductor machine', 'machine hip abductions', 'seated abductions', 'outer thigh machine', 'machine outer thighs', 'glute abduction machine', 'hip abduction', 'hip abductions'],

    title: {
      en: 'Clinical Protocol: Seated Machine Abduction',
      es: 'Protocolo Clínico: Abducción en Máquina Sentado',
      pt: 'Protocolo Clínico: Abdução na Máquina Sentado'
    },
    subtitle: {
      en: 'Frontal Plane · Machine · Sovereign Rig',
      es: 'Plano Frontal · Máquina · Equipo Soberano',
      pt: 'Plano Frontal · Máquina · Equipamento Soberano'
    },
    muscleTarget: {
      en: 'Primary: Gluteus Medius, Gluteus Minimus. Secondary: Tensor Fasciae Latae.',
      es: 'Primarios: Glúteo Medio, Glúteo Menor. Secundario: Tensor de la Fascia Lata.',
      pt: 'Primários: Glúteo Médio, Glúteo Mínimo. Secundário: Tensor da Fáscia Lata.'
    },
    clinicalNotes: {
      en: 'Execution demands a rigidly braced torso with the pelvis firmly anchored to the seat to entirely prevent lumbar compensation or upward pelvic shifting during the movement. The kinetic chain requires driving through the lateral aspect of the knees against the pads, strictly isolating the hip abductors rather than pushing outward with the feet. Joint articulation is optimized by utilizing the full, safe range of motion at the hip, controlling the return to prevent the weight stack from resting and losing tension.',
      es: 'La ejecución exige un torso rígidamente activado con la pelvis firmemente anclada al asiento para prevenir por completo la compensación lumbar o el desplazamiento pélvico ascendente durante el movimiento. La cadena cinética requiere empujar a través del aspecto lateral de las rodillas contra los cojines, aislando estrictamente los abductores de cadera en lugar de empujar hacia afuera con los pies. La articulación se optimiza utilizando el rango completo y seguro de movimiento en la cadera, controlando el retorno para prevenir que la pila de pesas descanse y pierda tensión.',
      pt: 'A execução exige um torso rigidamente ativado com a pelve firmemente ancorada ao assento para prevenir completamente a compensação lombar ou o deslocamento pélvico ascendente durante o movimento. A cadeia cinética requer empurrar através do aspecto lateral dos joelhos contra os apoios, isolando estritamente os abdutores do quadril em vez de empurrar para fora com os pés. A articulação é otimizada utilizando a amplitude completa e segura de movimento no quadril, controlando o retorno para prevenir que a pilha de pesos descanse e perca tensão.'
    },
    svgTitle: {
      en: 'Machine Abduction Frontal Wireframe',
      es: 'Wireframe Frontal de Abducción en Máquina',
      pt: 'Wireframe Frontal de Abdução na Máquina'
    },

    plane: 'frontal', facing: 'front', ground: { y: 0.92 },
    jointSpec: STD_JOINT_SPEC, bones: STD_BONES,

    animation: {
      duration_ms: 3500, loop: true, direction: 'normal', easing: 'ease-in-out',
      phases: [
        { id: 'eccentric', start_pct: 0, end_pct: 40, easing: 'ease-out',
          label: { en: 'Eccentric · Controlled Return', es: 'Excéntrica · Retorno Controlado', pt: 'Excêntrica · Retorno Controlado' },
          cue:   { en: 'Allow the pads to slowly return inward with deliberate pacing until the hips reach the starting position without letting the plates touch.',
                   es: 'Permite que los cojines regresen lentamente hacia adentro con un ritmo deliberado hasta que las caderas alcancen la posición inicial sin dejar que las placas se toquen.',
                   pt: 'Permita que os apoios retornem lentamente para dentro com ritmo deliberado até que os quadris alcancem a posição inicial sem deixar as placas se tocarem.' } },
        { id: 'isometric', start_pct: 40, end_pct: 50, easing: 'linear',
          label: { en: 'Isometric · Bottom Transition', es: 'Isométrica · Transición Inferior', pt: 'Isométrica · Transição no Fundo' },
          cue:   { en: 'Kill momentum before the plates rest.', es: 'Anula el impulso antes de que las placas descansen.', pt: 'Anule o impulso antes que as placas descansem.' } },
        { id: 'concentric', start_pct: 50, end_pct: 90, easing: 'ease-in',
          label: { en: 'Concentric · Abduction Drive', es: 'Concéntrica · Empuje de Abducción', pt: 'Concêntrica · Impulso de Abdução' },
          cue:   { en: 'Drive the knees forcefully outward against the pads through a strict contraction of the abductors until maximal hip separation is achieved.',
                   es: 'Empuja las rodillas con fuerza hacia afuera contra los cojines mediante una contracción estricta de los abductores hasta lograr la máxima separación de cadera.',
                   pt: 'Empurre os joelhos com força para fora contra os apoios através de uma contração estrita dos abdutores até alcançar a máxima separação do quadril.' } },
        { id: 'reset', start_pct: 90, end_pct: 100, easing: 'ease-in-out',
          label: { en: 'Reset · Peak Contraction', es: 'Reinicio · Contracción Máxima', pt: 'Reinício · Contração Máxima' },
          cue:   { en: 'Hold the fully abducted peak motionless to maximize mechanical tension and intensely squeeze the upper gluteals.',
                   es: 'Mantén el pico de abducción completa sin movimiento para maximizar la tensión mecánica y apretar intensamente los glúteos superiores.',
                   pt: 'Mantenha o pico de abdução total sem movimento para maximizar a tensão mecânica e contrair intensamente os glúteos superiores.' } }
      ],
      keyframes: [
        { t: 0.00, phase: 'eccentric',
          joints: {
            head: { x: 0.50, y: 0.20 },
            shoulder_l: { x: 0.40, y: 0.35 }, shoulder_r: { x: 0.60, y: 0.35 },
            elbow_l:    { x: 0.42, y: 0.48 }, elbow_r:    { x: 0.58, y: 0.48 },
            wrist_l:    { x: 0.45, y: 0.60 }, wrist_r:    { x: 0.55, y: 0.60 },
            hip_l:      { x: 0.45, y: 0.65 }, hip_r:      { x: 0.55, y: 0.65 },
            knee_l:     { x: 0.25, y: 0.65 }, knee_r:     { x: 0.75, y: 0.65 },
            ankle_l:    { x: 0.25, y: 0.92 }, ankle_r:    { x: 0.75, y: 0.92 }
          } },
        { t: 0.40, phase: 'eccentric',
          joints: {
            knee_l: { x: 0.42, y: 0.65 }, knee_r: { x: 0.58, y: 0.65 },
            ankle_l: { x: 0.42, y: 0.92 }, ankle_r: { x: 0.58, y: 0.92 }
          } },
        { t: 0.50, phase: 'isometric', joints: {} },
        { t: 0.90, phase: 'concentric',
          joints: {
            knee_l: { x: 0.25, y: 0.65 }, knee_r: { x: 0.75, y: 0.65 },
            ankle_l: { x: 0.25, y: 0.92 }, ankle_r: { x: 0.75, y: 0.92 }
          } },
        { t: 1.00, phase: 'reset', joints: {} }
      ]
    },

    equipment: [
      { type: 'machine_pad', attach: ['knee_l', 'knee_r'] },
      { type: 'bench',       attach: ['hip_l', 'hip_r'] }
    ],

    kineticPath: {
      default: { label: { en: 'Abduction Vector', es: 'Vector de Abducción', pt: 'Vetor de Abdução' },
                 d: 'M 0.42 0.65 L 0.25 0.65' },
      endpoints: [{ x: 0.42, y: 0.65 }, { x: 0.25, y: 0.65 }],
      labels: [
        { x: 0.42, y: 0.60, text: { en: 'Start',        es: 'Inicio',          pt: 'Início' } },
        { x: 0.25, y: 0.60, text: { en: 'Peak Squeeze', es: 'Apretón Máximo',  pt: 'Contração Máxima' } }
      ]
    },

    forms: {
      ok: {
        chipLabel: { en: 'Standard Form', es: 'Forma Estándar', pt: 'Forma Padrão' },
        callouts: [
          { from: 'hip_l', to: { x: 0.20, y: 0.50 },
            lines: [{ en: 'Pelvis firmly anchored', es: 'Pelvis firmemente anclada', pt: 'Pelve firmemente ancorada' }] }
        ],
        metrics: {
          dev: '± 1.0 cm',
          tuck: { en: 'Hips Anchored',  es: 'Caderas Ancladas',         pt: 'Quadris Ancorados' },
          load: { en: 'Glute Med Bias', es: 'Sesgo del Glúteo Medio',   pt: 'Viés do Glúteo Médio' },
          fn:   { en: 'Clinical reference overlay', es: 'Capa de referencia clínica', pt: 'Camada de referência clínica' }
        },
        haloAt: null
      },
      warn: {
        chipLabel: { en: 'Common Fault: Pelvic Shift', es: 'Falla Común: Desplazamiento Pélvico', pt: 'Falha Comum: Deslocamento Pélvico' },
        callouts: [
          { from: 'hip_l', to: { x: 0.20, y: 0.50 }, warn: true,
            lines: [{ en: 'Hips lift · Lumbar compensation',
                      es: 'Caderas se elevan · Compensación lumbar',
                      pt: 'Quadris sobem · Compensação lombar' }] }
        ],
        metrics: {
          dev: '± 4.0 cm',
          tuck: { en: 'Posterior Tilt',  es: 'Inclinación Posterior', pt: 'Inclinação Posterior' },
          load: { en: 'Spinal Overload', es: 'Sobrecarga Espinal',    pt: 'Sobrecarga Espinhal' },
          fn:   { en: 'Fault pattern · Pelvis lifts off seat to assist push',
                  es: 'Patrón de falla · La pelvis se despega del asiento para asistir el empuje',
                  pt: 'Padrão de falha · Pelve desencosta do assento para auxiliar o empurrão' }
        },
        haloAt: 'hip_l',
        keyframesOverride: [
          { t: 0.90, joints: { hip_l: { x: 0.45, y: 0.60 }, hip_r: { x: 0.55, y: 0.60 }, head: { x: 0.50, y: 0.25 } } }
        ]
      }
    },

    metricLabels: {
      dev:  { en: 'Path Dev.',     es: 'Desv. Trayectoria', pt: 'Desv. Trajetória' },
      tuck: { en: 'Pelvic Anchor', es: 'Anclaje Pélvico',   pt: 'Ancoragem Pélvica' },
      load: { en: 'Muscle Bias',   es: 'Sesgo Muscular',    pt: 'Viés Muscular' }
    }
  };

  // ─── CABLE OVERHEAD TRICEPS EXTENSION (V2 · Batch 5) ─────
  var CABLE_OVERHEAD_TRICEPS_EXTENSION = {
    id: 'cable_overhead_triceps_extension',
    displayName: 'Cable Overhead Triceps Extension',
    aliases: ['cable overhead triceps extension', 'overhead cable extensions', 'rope overhead extensions', 'overhead triceps press', 'cable french press', 'high pulley overhead extensions', 'overhead triceps extension', 'overhead tricep extension'],

    title: {
      en: 'Clinical Protocol: Overhead Triceps Extension',
      es: 'Protocolo Clínico: Extensión de Tríceps por Encima de la Cabeza',
      pt: 'Protocolo Clínico: Extensão de Tríceps Acima da Cabeça'
    },
    subtitle: {
      en: 'Sagittal Plane · Cable · Sovereign Rig',
      es: 'Plano Sagital · Polea · Equipo Soberano',
      pt: 'Plano Sagital · Cabo · Equipamento Soberano'
    },
    muscleTarget: {
      en: 'Primary: Triceps Brachii (Long Head Bias). Secondary: Core Stabilizers.',
      es: 'Primario: Tríceps Braquial (Sesgo de Cabeza Larga). Secundarios: Estabilizadores del Core.',
      pt: 'Primário: Tríceps Braquial (Viés da Cabeça Longa). Secundários: Estabilizadores do Core.'
    },
    clinicalNotes: {
      en: 'Perfect Sovereign execution requires a highly braced core and a staggered, firmly planted stance to establish a rigid foundation against the cable\'s backward pull. The kinetic chain relies on keeping the humerus locked in a fixed overhead position, entirely preventing shoulder flexion or extension from assisting the movement. Optimal joint health is maintained by allowing the elbows to achieve deep flexion for a maximal stretch on the long head of the triceps without forcing unnatural glenohumeral ranges.',
      es: 'La ejecución soberana perfecta requiere un core altamente activado y una postura escalonada y firmemente plantada para establecer una base rígida contra la tracción posterior del cable. La cadena cinética depende de mantener el húmero bloqueado en una posición fija por encima de la cabeza, evitando por completo que la flexión o extensión del hombro asista el movimiento. La salud articular óptima se mantiene permitiendo que los codos alcancen una flexión profunda para un estiramiento máximo en la cabeza larga del tríceps sin forzar rangos glenohumerales no naturales.',
      pt: 'A execução soberana perfeita requer um core altamente ativado e uma postura escalonada e firmemente plantada para estabelecer uma base rígida contra a tração posterior do cabo. A cadeia cinética depende de manter o úmero travado em uma posição fixa acima da cabeça, prevenindo completamente que a flexão ou extensão do ombro auxilie o movimento. A saúde articular ótima é mantida permitindo que os cotovelos alcancem uma flexão profunda para um alongamento máximo na cabeça longa do tríceps sem forçar amplitudes glenoumerais não naturais.'
    },
    svgTitle: {
      en: 'Overhead Extension Sagittal Wireframe',
      es: 'Wireframe Sagital de Extensión por Encima de la Cabeza',
      pt: 'Wireframe Sagital de Extensão Acima da Cabeça'
    },

    plane: 'sagittal', facing: 'right', ground: { y: 0.92 },
    jointSpec: STD_JOINT_SPEC, bones: STD_BONES,

    animation: {
      duration_ms: 3500, loop: true, direction: 'normal', easing: 'ease-in-out',
      phases: [
        { id: 'eccentric', start_pct: 0, end_pct: 40, easing: 'ease-out',
          label: { en: 'Eccentric · Deep Stretch', es: 'Excéntrica · Estiramiento Profundo', pt: 'Excêntrica · Alongamento Profundo' },
          cue:   { en: 'Lower the rope behind the head with strict, deliberate control until the triceps achieve a full, deep stretch.',
                   es: 'Baja la cuerda detrás de la cabeza con control estricto y deliberado hasta que los tríceps alcancen un estiramiento completo y profundo.',
                   pt: 'Abaixe a corda atrás da cabeça com controle estrito e deliberado até que os tríceps alcancem um alongamento completo e profundo.' } },
        { id: 'isometric', start_pct: 40, end_pct: 50, easing: 'linear',
          label: { en: 'Isometric · Bottom Hold', es: 'Isométrica · Pausa Inferior', pt: 'Isométrica · Pausa no Fundo' },
          cue:   { en: 'Pause motionless at the deepest point of flexion to eliminate momentum and maximize mechanical tension on the long head.',
                   es: 'Haz una pausa sin movimiento en el punto más profundo de flexión para eliminar el impulso y maximizar la tensión mecánica sobre la cabeza larga.',
                   pt: 'Faça uma pausa sem movimento no ponto mais profundo da flexão para eliminar o impulso e maximizar a tensão mecânica sobre a cabeça longa.' } },
        { id: 'concentric', start_pct: 50, end_pct: 90, easing: 'ease-in',
          label: { en: 'Concentric · Tricep Extension', es: 'Concéntrica · Extensión de Tríceps', pt: 'Concêntrica · Extensão de Tríceps' },
          cue:   { en: 'Drive the hands forcefully upward and outward through a strict contraction of the triceps until the elbows are completely locked out.',
                   es: 'Empuja las manos con fuerza hacia arriba y hacia afuera mediante una contracción estricta de los tríceps hasta que los codos estén completamente bloqueados.',
                   pt: 'Empurre as mãos com força para cima e para fora através de uma contração estrita dos tríceps até que os cotovelos estejam completamente travados.' } },
        { id: 'reset', start_pct: 90, end_pct: 100, easing: 'ease-in-out',
          label: { en: 'Reset · Peak Squeeze', es: 'Reinicio · Apretón Máximo', pt: 'Reinício · Contração Máxima' },
          cue:   { en: 'Hold the lockout.', es: 'Mantén el bloqueo.', pt: 'Mantenha o travamento.' } }
      ],
      keyframes: [
        { t: 0.00, phase: 'eccentric',
          joints: {
            head: { x: 0.40, y: 0.20 },
            shoulder_l: { x: 0.40, y: 0.35 }, shoulder_r: { x: 0.40, y: 0.35 },
            hip_l:      { x: 0.40, y: 0.60 }, hip_r:      { x: 0.40, y: 0.60 },
            knee_l:     { x: 0.50, y: 0.75 }, knee_r:     { x: 0.30, y: 0.75 },
            ankle_l:    { x: 0.50, y: 0.92 }, ankle_r:    { x: 0.30, y: 0.92 },
            elbow_l:    { x: 0.50, y: 0.15 }, elbow_r:    { x: 0.50, y: 0.15 },
            wrist_l:    { x: 0.65, y: 0.05 }, wrist_r:    { x: 0.65, y: 0.05 }
          } },
        { t: 0.40, phase: 'eccentric',
          joints: { wrist_l: { x: 0.30, y: 0.20 }, wrist_r: { x: 0.30, y: 0.20 } } },
        { t: 0.50, phase: 'isometric', joints: {} },
        { t: 0.90, phase: 'concentric',
          joints: { wrist_l: { x: 0.65, y: 0.05 }, wrist_r: { x: 0.65, y: 0.05 } } },
        { t: 1.00, phase: 'reset', joints: {} }
      ]
    },

    equipment: [{ type: 'cable_column', attach: ['wrist_l', 'wrist_r'] }],

    kineticPath: {
      default: { label: { en: 'Extension Arc', es: 'Arco de Extensión', pt: 'Arco de Extensão' },
                 d: 'M 0.30 0.20 Q 0.50 0.05 0.65 0.05' },
      endpoints: [{ x: 0.30, y: 0.20 }, { x: 0.65, y: 0.05 }],
      labels: [
        { x: 0.25, y: 0.25, text: { en: 'Max Stretch', es: 'Estiramiento Máximo', pt: 'Alongamento Máximo' } },
        { x: 0.70, y: 0.05, text: { en: 'Lockout',     es: 'Bloqueo',             pt: 'Travamento' } }
      ]
    },

    forms: {
      ok: {
        chipLabel: { en: 'Standard Form', es: 'Forma Estándar', pt: 'Forma Padrão' },
        callouts: [
          { from: 'elbow_l', to: { x: 0.60, y: 0.25 },
            lines: [{ en: 'Elbow securely anchored', es: 'Codo firmemente anclado', pt: 'Cotovelo firmemente ancorado' }] }
        ],
        metrics: {
          dev: '± 1.0 cm',
          tuck: { en: 'Humerus Fixed',   es: 'Húmero Fijo',         pt: 'Úmero Fixo' },
          load: { en: 'Long Head Bias',  es: 'Sesgo de Cabeza Larga', pt: 'Viés da Cabeça Longa' },
          fn:   { en: 'Clinical reference overlay', es: 'Capa de referencia clínica', pt: 'Camada de referência clínica' }
        },
        haloAt: null
      },
      warn: {
        chipLabel: { en: 'Common Fault: Elbow Drift', es: 'Falla Común: Desplazamiento del Codo', pt: 'Falha Comum: Deslocamento do Cotovelo' },
        callouts: [
          { from: 'elbow_l', to: { x: 0.60, y: 0.25 }, warn: true,
            lines: [{ en: 'Shoulder extends · Lat involvement',
                      es: 'El hombro se extiende · Participación del dorsal',
                      pt: 'O ombro estende · Participação do dorsal' }] }
        ],
        metrics: {
          dev: '± 4.0 cm',
          tuck: { en: 'Shoulder Sway', es: 'Balanceo de Hombro', pt: 'Balanço do Ombro' },
          load: { en: 'Tension Loss',  es: 'Pérdida de Tensión', pt: 'Perda de Tensão' },
          fn:   { en: 'Fault pattern · Elbow pulls forward during extension',
                  es: 'Patrón de falla · El codo se desplaza hacia adelante durante la extensión',
                  pt: 'Padrão de falha · Cotovelo move-se para frente durante a extensão' }
        },
        haloAt: 'elbow_l',
        keyframesOverride: [
          { t: 0.90, joints: { elbow_l: { x: 0.60, y: 0.25 }, elbow_r: { x: 0.60, y: 0.25 },
                               wrist_l: { x: 0.75, y: 0.15 }, wrist_r: { x: 0.75, y: 0.15 } } }
        ]
      }
    },

    metricLabels: {
      dev:  { en: 'Path Dev.',    es: 'Desv. Trayectoria',   pt: 'Desv. Trajetória' },
      tuck: { en: 'Elbow Anchor', es: 'Anclaje del Codo',    pt: 'Ancoragem do Cotovelo' },
      load: { en: 'Muscle Bias',  es: 'Sesgo Muscular',      pt: 'Viés Muscular' }
    }
  };

  // ─── EZ BAR PREACHER CURLS (V2 · Batch 5) ────────────────
  var EZ_BAR_PREACHER_CURLS = {
    id: 'ez_bar_preacher_curls',
    displayName: 'EZ Bar Preacher Curls',
    aliases: ['ez bar preacher curls', 'preacher curls', 'barbell preacher curls', 'scott curls', 'seated preacher curls', 'ez curl bar preachers'],

    title: {
      en: 'Clinical Protocol: Preacher Curls',
      es: 'Protocolo Clínico: Curl Predicador',
      pt: 'Protocolo Clínico: Rosca Scott'
    },
    subtitle: {
      en: 'Sagittal Plane · Barbell · Sovereign Rig',
      es: 'Plano Sagital · Barra · Equipo Soberano',
      pt: 'Plano Sagital · Barra · Equipamento Soberano'
    },
    muscleTarget: {
      en: 'Primary: Biceps Brachii, Brachialis. Secondary: Brachioradialis, Forearm Flexors.',
      es: 'Primarios: Bíceps Braquial, Braquial. Secundarios: Braquiorradial, Flexores del Antebrazo.',
      pt: 'Primários: Bíceps Braquial, Braquial. Secundários: Braquiorradial, Flexores do Antebraço.'
    },
    clinicalNotes: {
      en: 'Execution demands that the axilla (armpits) are pinned securely over the pad with the triceps resting completely flat, ensuring strict isolation of the elbow flexors and entirely eliminating anterior shoulder swing. The kinetic chain relies on a stable, seated foundation and a rigid torso to prevent leaning back or utilizing bodyweight leverage to initiate the curl. Joint health is protected by stopping just short of a bone-on-bone elbow lockout at the bottom to maintain continuous tension and prevent distal bicep tendon strain.',
      es: 'La ejecución exige que las axilas estén firmemente fijadas sobre el cojín con los tríceps descansando completamente planos, garantizando el aislamiento estricto de los flexores del codo y eliminando por completo el balanceo anterior del hombro. La cadena cinética depende de una base estable sentada y un torso rígido para evitar inclinarse hacia atrás o utilizar palanca con peso corporal para iniciar el curl. La salud articular se protege deteniéndose justo antes del bloqueo articular hueso contra hueso en el fondo para mantener tensión continua y prevenir la tensión del tendón distal del bíceps.',
      pt: 'A execução exige que as axilas estejam firmemente fixadas sobre o apoio com os tríceps descansando completamente planos, garantindo o isolamento estrito dos flexores do cotovelo e eliminando completamente o balanço anterior do ombro. A cadeia cinética depende de uma base estável sentada e um torso rígido para evitar inclinar para trás ou utilizar alavancagem com peso corporal para iniciar o curl. A saúde articular é protegida parando logo antes do travamento articular osso contra osso no fundo para manter tensão contínua e prevenir a tensão do tendão distal do bíceps.'
    },
    svgTitle: {
      en: 'Preacher Curl Sagittal Wireframe',
      es: 'Wireframe Sagital de Curl Predicador',
      pt: 'Wireframe Sagital de Rosca Scott'
    },

    plane: 'sagittal', facing: 'right', ground: { y: 0.92 },
    jointSpec: STD_JOINT_SPEC, bones: STD_BONES,

    animation: {
      duration_ms: 3500, loop: true, direction: 'normal', easing: 'ease-in-out',
      phases: [
        { id: 'eccentric', start_pct: 0, end_pct: 40, easing: 'ease-out',
          label: { en: 'Eccentric · Controlled Descent', es: 'Excéntrica · Descenso Controlado', pt: 'Excêntrica · Descida Controlada' },
          cue:   { en: 'Lower the bar with strict, deliberate pacing until the arms are nearly fully extended, maintaining active tension in the biceps.',
                   es: 'Baja la barra con un ritmo estricto y deliberado hasta que los brazos estén casi completamente extendidos, manteniendo tensión activa en los bíceps.',
                   pt: 'Abaixe a barra com ritmo estrito e deliberado até que os braços estejam quase completamente estendidos, mantendo tensão ativa nos bíceps.' } },
        { id: 'isometric', start_pct: 40, end_pct: 50, easing: 'linear',
          label: { en: 'Isometric · Bottom Tension', es: 'Isométrica · Tensión Inferior', pt: 'Isométrica · Tensão no Fundo' },
          cue:   { en: 'Hold the bottom position motionless to arrest downward momentum and safely transition force.',
                   es: 'Mantén la posición inferior sin movimiento para detener el impulso descendente y transferir la fuerza de forma segura.',
                   pt: 'Mantenha a posição inferior sem movimento para frear o impulso descendente e transferir a força com segurança.' } },
        { id: 'concentric', start_pct: 50, end_pct: 90, easing: 'ease-in',
          label: { en: 'Concentric · Bicep Flexion', es: 'Concéntrica · Flexión del Bíceps', pt: 'Concêntrica · Flexão do Bíceps' },
          cue:   { en: 'Drive the weight forcefully upward through a strict contraction of the biceps until peak flexion is reached.',
                   es: 'Empuja el peso con fuerza hacia arriba mediante una contracción estricta de los bíceps hasta alcanzar la flexión máxima.',
                   pt: 'Impulsione o peso com força para cima através de uma contração estrita dos bíceps até alcançar a flexão máxima.' } },
        { id: 'reset', start_pct: 90, end_pct: 100, easing: 'ease-in-out',
          label: { en: 'Reset · Peak Squeeze', es: 'Reinicio · Apretón Máximo', pt: 'Reinício · Contração Máxima' },
          cue:   { en: 'Squeeze biceps actively.', es: 'Aprieta los bíceps activamente.', pt: 'Contraia os bíceps ativamente.' } }
      ],
      keyframes: [
        { t: 0.00, phase: 'eccentric',
          joints: {
            head: { x: 0.35, y: 0.25 },
            shoulder_l: { x: 0.35, y: 0.40 }, shoulder_r: { x: 0.35, y: 0.40 },
            hip_l:      { x: 0.25, y: 0.65 }, hip_r:      { x: 0.25, y: 0.65 },
            knee_l:     { x: 0.40, y: 0.65 }, knee_r:     { x: 0.40, y: 0.65 },
            ankle_l:    { x: 0.40, y: 0.92 }, ankle_r:    { x: 0.40, y: 0.92 },
            elbow_l:    { x: 0.50, y: 0.55 }, elbow_r:    { x: 0.50, y: 0.55 },
            wrist_l:    { x: 0.40, y: 0.40 }, wrist_r:    { x: 0.40, y: 0.40 }
          } },
        { t: 0.40, phase: 'eccentric',
          joints: { wrist_l: { x: 0.65, y: 0.65 }, wrist_r: { x: 0.65, y: 0.65 } } },
        { t: 0.50, phase: 'isometric', joints: {} },
        { t: 0.90, phase: 'concentric',
          joints: { wrist_l: { x: 0.40, y: 0.40 }, wrist_r: { x: 0.40, y: 0.40 } } },
        { t: 1.00, phase: 'reset', joints: {} }
      ]
    },

    equipment: [
      { type: 'bar',         attach: ['wrist_l', 'wrist_r'] },
      { type: 'machine_pad', attach: ['elbow_l', 'elbow_r'] }
    ],

    kineticPath: {
      default: { label: { en: 'Curl Arc', es: 'Arco de Curl', pt: 'Arco da Rosca' },
                 d: 'M 0.65 0.65 Q 0.60 0.45 0.40 0.40' },
      endpoints: [{ x: 0.65, y: 0.65 }, { x: 0.40, y: 0.40 }],
      labels: [
        { x: 0.70, y: 0.65, text: { en: 'Soft Lockout', es: 'Bloqueo Suave',  pt: 'Travamento Suave' } },
        { x: 0.35, y: 0.35, text: { en: 'Peak Squeeze', es: 'Apretón Máximo', pt: 'Contração Máxima' } }
      ]
    },

    forms: {
      ok: {
        chipLabel: { en: 'Standard Form', es: 'Forma Estándar', pt: 'Forma Padrão' },
        callouts: [
          { from: 'shoulder_l', to: { x: 0.15, y: 0.30 },
            lines: [{ en: 'Armpits pinned to pad', es: 'Axilas fijadas al cojín', pt: 'Axilas fixadas ao apoio' }] }
        ],
        metrics: {
          dev: '± 1.0 cm',
          tuck: { en: 'Torso Rigid',  es: 'Torso Rígido',     pt: 'Torso Rígido' },
          load: { en: 'Biceps Bias',  es: 'Sesgo del Bíceps', pt: 'Viés do Bíceps' },
          fn:   { en: 'Clinical reference overlay', es: 'Capa de referencia clínica', pt: 'Camada de referência clínica' }
        },
        haloAt: null
      },
      warn: {
        chipLabel: { en: 'Common Fault: Torso Lean', es: 'Falla Común: Inclinación del Torso', pt: 'Falha Comum: Inclinação do Torso' },
        callouts: [
          { from: 'shoulder_l', to: { x: 0.15, y: 0.30 }, warn: true,
            lines: [{ en: 'Leaning back · Leverage assist',
                      es: 'Inclinándose hacia atrás · Asistencia por palanca',
                      pt: 'Inclinando para trás · Auxílio por alavanca' }] }
        ],
        metrics: {
          dev: '± 4.0 cm',
          tuck: { en: 'Bodyweight Swing', es: 'Balanceo del Peso Corporal', pt: 'Balanço do Peso Corporal' },
          load: { en: 'Tension Loss',     es: 'Pérdida de Tensión',         pt: 'Perda de Tensão' },
          fn:   { en: 'Fault pattern · Pulling torso backward to initiate curl',
                  es: 'Patrón de falla · Tirando del torso hacia atrás para iniciar el curl',
                  pt: 'Padrão de falha · Puxando o torso para trás para iniciar a rosca' }
        },
        haloAt: 'shoulder_l',
        keyframesOverride: [
          { t: 0.90, joints: { head: { x: 0.25, y: 0.25 }, shoulder_l: { x: 0.25, y: 0.40 }, shoulder_r: { x: 0.25, y: 0.40 } } }
        ]
      }
    },

    metricLabels: {
      dev:  { en: 'Path Dev.',       es: 'Desv. Trayectoria',  pt: 'Desv. Trajetória' },
      tuck: { en: 'Shoulder Anchor', es: 'Anclaje del Hombro', pt: 'Ancoragem do Ombro' },
      load: { en: 'Muscle Bias',     es: 'Sesgo Muscular',     pt: 'Viés Muscular' }
    }
  };

  // ─── MACHINE CRUNCHES (V2 · Batch 5) ─────────────────────
  // Validator-patched: original Blueprint declared only left arm
  // joints at t=0. Added symmetric right-arm (sagittal view collapses
  // both halves to the same coordinates).
  var MACHINE_CRUNCHES = {
    id: 'machine_crunches',
    displayName: 'Machine Crunches',
    aliases: ['machine crunches', 'seated machine crunches', 'ab machine', 'abdominal crunch machine', 'weighted crunches', 'seated ab crunches', 'abdominal crunches', 'ab crunches', 'crunches'],

    title: {
      en: 'Clinical Protocol: Machine Crunches',
      es: 'Protocolo Clínico: Crunches en Máquina',
      pt: 'Protocolo Clínico: Abdominal na Máquina'
    },
    subtitle: {
      en: 'Sagittal Plane · Machine · Sovereign Rig',
      es: 'Plano Sagital · Máquina · Equipo Soberano',
      pt: 'Plano Sagital · Máquina · Equipamento Soberano'
    },
    muscleTarget: {
      en: 'Primary: Rectus Abdominis. Secondary: Obliques, Core Stabilizers.',
      es: 'Primario: Recto Abdominal. Secundarios: Oblicuos, Estabilizadores del Core.',
      pt: 'Primário: Reto Abdominal. Secundários: Oblíquos, Estabilizadores do Core.'
    },
    clinicalNotes: {
      en: 'Perfect Sovereign execution necessitates the pelvis being rigidly anchored to the seat to strictly isolate spinal flexion and entirely prevent hip flexor dominance. The kinetic chain requires actively driving the ribcage downward toward the pelvis, effectively shortening the rectus abdominis without pulling with the arms or neck. Joint articulation is optimized by moving through a controlled, fluid range of spinal flexion and extension, strictly avoiding abrupt jerking motions that could stress the lumbar vertebrae.',
      es: 'La ejecución soberana perfecta requiere que la pelvis esté rígidamente anclada al asiento para aislar estrictamente la flexión espinal y prevenir por completo la dominancia de los flexores de cadera. La cadena cinética requiere impulsar activamente la caja torácica hacia abajo hacia la pelvis, acortando efectivamente el recto abdominal sin tirar con los brazos ni el cuello. La articulación se optimiza moviéndose a través de un rango controlado y fluido de flexión y extensión espinal, evitando estrictamente movimientos bruscos que puedan estresar las vértebras lumbares.',
      pt: 'A execução soberana perfeita necessita que a pelve esteja rigidamente ancorada ao assento para isolar estritamente a flexão espinhal e prevenir completamente a dominância dos flexores do quadril. A cadeia cinética requer impulsionar ativamente a caixa torácica para baixo em direção à pelve, encurtando efetivamente o reto abdominal sem puxar com os braços ou pescoço. A articulação é otimizada movendo-se através de uma amplitude controlada e fluida de flexão e extensão espinhal, evitando estritamente movimentos bruscos que possam estressar as vértebras lombares.'
    },
    svgTitle: {
      en: 'Crunch Sagittal Wireframe',
      es: 'Wireframe Sagital de Crunch',
      pt: 'Wireframe Sagital de Abdominal'
    },

    plane: 'sagittal', facing: 'right', ground: { y: 0.92 },
    jointSpec: STD_JOINT_SPEC, bones: STD_BONES,

    animation: {
      duration_ms: 3000, loop: true, direction: 'normal', easing: 'ease-in-out',
      phases: [
        { id: 'eccentric', start_pct: 0, end_pct: 40, easing: 'ease-out',
          label: { en: 'Eccentric · Controlled Extension', es: 'Excéntrica · Extensión Controlada', pt: 'Excêntrica · Extensão Controlada' },
          cue:   { en: 'Allow the torso to slowly return to the upright position with deliberate pacing until the abdominals achieve a full, safe stretch.',
                   es: 'Permite que el torso regrese lentamente a la posición erguida con un ritmo deliberado hasta que los abdominales alcancen un estiramiento completo y seguro.',
                   pt: 'Permita que o torso retorne lentamente à posição ereta com ritmo deliberado até que os abdominais alcancem um alongamento completo e seguro.' } },
        { id: 'isometric', start_pct: 40, end_pct: 50, easing: 'linear',
          label: { en: 'Isometric · Top Stretch', es: 'Isométrica · Estiramiento Superior', pt: 'Isométrica · Alongamento no Topo' },
          cue:   { en: 'Pause to eliminate momentum.', es: 'Pausa para eliminar el impulso.', pt: 'Pausa para eliminar o impulso.' } },
        { id: 'concentric', start_pct: 50, end_pct: 90, easing: 'ease-in',
          label: { en: 'Concentric · Spinal Flexion', es: 'Concéntrica · Flexión Espinal', pt: 'Concêntrica · Flexão Espinhal' },
          cue:   { en: 'Drive the torso forcefully downward by strictly curling the spine and squeezing the ribcage directly toward the pelvis.',
                   es: 'Empuja el torso con fuerza hacia abajo curvando estrictamente la columna y apretando la caja torácica directamente hacia la pelvis.',
                   pt: 'Impulsione o torso com força para baixo curvando estritamente a coluna e contraindo a caixa torácica diretamente em direção à pelve.' } },
        { id: 'reset', start_pct: 90, end_pct: 100, easing: 'ease-in-out',
          label: { en: 'Reset · Peak Contraction', es: 'Reinicio · Contracción Máxima', pt: 'Reinício · Contração Máxima' },
          cue:   { en: 'Hold the fully contracted peak motionless to maximize mechanical tension and deeply engage the abdominal wall.',
                   es: 'Mantén el pico de contracción completa sin movimiento para maximizar la tensión mecánica y activar profundamente la pared abdominal.',
                   pt: 'Mantenha o pico de contração total sem movimento para maximizar a tensão mecânica e ativar profundamente a parede abdominal.' } }
      ],
      keyframes: [
        { t: 0.00, phase: 'eccentric',
          joints: {
            head: { x: 0.45, y: 0.45 },
            shoulder_l: { x: 0.40, y: 0.55 }, shoulder_r: { x: 0.40, y: 0.55 },
            hip_l:      { x: 0.30, y: 0.65 }, hip_r:      { x: 0.30, y: 0.65 },
            knee_l:     { x: 0.55, y: 0.65 }, knee_r:     { x: 0.55, y: 0.65 },
            ankle_l:    { x: 0.55, y: 0.92 }, ankle_r:    { x: 0.55, y: 0.92 },
            elbow_l:    { x: 0.40, y: 0.60 }, elbow_r:    { x: 0.40, y: 0.60 },
            wrist_l:    { x: 0.50, y: 0.55 }, wrist_r:    { x: 0.50, y: 0.55 }
          } },
        { t: 0.40, phase: 'eccentric',
          joints: {
            head: { x: 0.30, y: 0.30 },
            shoulder_l: { x: 0.30, y: 0.40 }, shoulder_r: { x: 0.30, y: 0.40 },
            elbow_l:    { x: 0.30, y: 0.50 }, elbow_r:    { x: 0.30, y: 0.50 },
            wrist_l:    { x: 0.40, y: 0.40 }, wrist_r:    { x: 0.40, y: 0.40 }
          } },
        { t: 0.50, phase: 'isometric', joints: {} },
        { t: 0.90, phase: 'concentric',
          joints: {
            head: { x: 0.45, y: 0.45 },
            shoulder_l: { x: 0.40, y: 0.55 }, shoulder_r: { x: 0.40, y: 0.55 },
            elbow_l:    { x: 0.40, y: 0.60 }, elbow_r:    { x: 0.40, y: 0.60 },
            wrist_l:    { x: 0.50, y: 0.55 }, wrist_r:    { x: 0.50, y: 0.55 }
          } },
        { t: 1.00, phase: 'reset', joints: {} }
      ]
    },

    equipment: [{ type: 'machine_pad', attach: ['shoulder_l', 'knee_l'] }],

    kineticPath: {
      default: { label: { en: 'Flexion Arc', es: 'Arco de Flexión', pt: 'Arco de Flexão' },
                 d: 'M 0.30 0.40 Q 0.45 0.45 0.40 0.55' },
      endpoints: [{ x: 0.30, y: 0.40 }, { x: 0.40, y: 0.55 }],
      labels: [
        { x: 0.25, y: 0.40, text: { en: 'Max Stretch',  es: 'Estiramiento Máximo', pt: 'Alongamento Máximo' } },
        { x: 0.45, y: 0.60, text: { en: 'Peak Squeeze', es: 'Apretón Máximo',      pt: 'Contração Máxima' } }
      ]
    },

    forms: {
      ok: {
        chipLabel: { en: 'Standard Form', es: 'Forma Estándar', pt: 'Forma Padrão' },
        callouts: [
          { from: 'shoulder_l', to: { x: 0.15, y: 0.55 },
            lines: [{ en: 'True spinal flexion', es: 'Verdadera flexión espinal', pt: 'Verdadeira flexão espinhal' }] }
        ],
        metrics: {
          dev: '± 1.0 cm',
          tuck: { en: 'Pelvis Pinned',          es: 'Pelvis Fijada',          pt: 'Pelve Fixada' },
          load: { en: 'Rectus Abdominis Bias',  es: 'Sesgo del Recto Abdominal', pt: 'Viés do Reto Abdominal' },
          fn:   { en: 'Clinical reference overlay', es: 'Capa de referencia clínica', pt: 'Camada de referência clínica' }
        },
        haloAt: null
      },
      warn: {
        chipLabel: { en: 'Common Fault: Hip Flexor Hinging', es: 'Falla Común: Bisagra de Flexores de Cadera', pt: 'Falha Comum: Dobradiça de Flexores do Quadril' },
        callouts: [
          { from: 'hip_l', to: { x: 0.15, y: 0.65 }, warn: true,
            lines: [{ en: 'Straight back · Hip flexor takeover',
                      es: 'Espalda recta · Toma del flexor de cadera',
                      pt: 'Costas retas · Tomada do flexor do quadril' }] }
        ],
        metrics: {
          dev: '± 4.0 cm',
          tuck: { en: 'Spine Rigid',    es: 'Columna Rígida',     pt: 'Coluna Rígida' },
          load: { en: 'Psoas Overload', es: 'Sobrecarga del Psoas', pt: 'Sobrecarga do Psoas' },
          fn:   { en: 'Fault pattern · Hinging at hips instead of curling spine',
                  es: 'Patrón de falla · Bisagra en las caderas en lugar de curvar la columna',
                  pt: 'Padrão de falha · Dobradiça nos quadris em vez de curvar a coluna' }
        },
        haloAt: 'hip_l',
        keyframesOverride: [
          { t: 0.90, joints: { head: { x: 0.55, y: 0.35 }, shoulder_l: { x: 0.45, y: 0.45 }, shoulder_r: { x: 0.45, y: 0.45 } } }
        ]
      }
    },

    metricLabels: {
      dev:  { en: 'Path Dev.',   es: 'Desv. Trayectoria', pt: 'Desv. Trajetória' },
      tuck: { en: 'Spinal Curl', es: 'Curva Espinal',     pt: 'Curva Espinhal' },
      load: { en: 'Muscle Bias', es: 'Sesgo Muscular',    pt: 'Viés Muscular' }
    }
  };

  // ─── GLUTE-BIAS BACK EXTENSIONS (V2 · Batch 6) ───────────
  // Validator-patched: t=0 added symmetric right-arm joints.
  var GLUTE_BIAS_BACK_EXTENSIONS = {
    id: 'glute_bias_back_extensions',
    displayName: 'Glute-Bias Back Extensions',
    aliases: ['glute bias back extensions', 'glute-bias back extensions', '45-degree hyperextensions', 'glute extensions', '45-degree back extensions', 'roman chair glute extensions', 'rounded back extensions', 'glute-focused back extensions', 'back extension', 'back extensions', 'machine back extension'],

    title: {
      en: 'Clinical Protocol: Glute Back Extensions',
      es: 'Protocolo Clínico: Extensiones de Espalda con Sesgo Glúteo',
      pt: 'Protocolo Clínico: Extensão Lombar com Foco no Glúteo'
    },
    subtitle: {
      en: 'Sagittal Plane · Machine · Sovereign Rig',
      es: 'Plano Sagital · Máquina · Equipo Soberano',
      pt: 'Plano Sagital · Máquina · Equipamento Soberano'
    },
    muscleTarget: {
      en: 'Primary: Gluteus Maximus. Secondary: Hamstrings, Core Stabilizers.',
      es: 'Primario: Glúteo Mayor. Secundarios: Isquiotibiales, Estabilizadores del Core.',
      pt: 'Primário: Glúteo Máximo. Secundários: Isquiotibiais, Estabilizadores do Core.'
    },
    clinicalNotes: {
      en: 'Perfect Sovereign execution demands a slightly rounded upper spine and a tucked chin to intentionally inhibit the erector spinae and force the glutes to be the primary drivers of hip extension. The kinetic chain relies on the pelvis being positioned just slightly over the top edge of the pad, allowing for pure, unhindered hip flexion and extension without any lumbar contribution. Joint health is protected by stopping the ascent the exact moment the hips reach full extension, strictly avoiding any overarching or hyperextension of the lower back.',
      es: 'La ejecución soberana perfecta exige una columna superior ligeramente redondeada y un mentón retraído para inhibir intencionalmente los erectores espinales y forzar a los glúteos a ser los impulsores principales de la extensión de cadera. La cadena cinética depende de que la pelvis esté posicionada justo ligeramente sobre el borde superior del cojín, permitiendo una flexión y extensión de cadera pura y sin obstáculos sin ninguna contribución lumbar. La salud articular se protege deteniendo el ascenso en el momento exacto en que las caderas alcanzan la extensión completa, evitando estrictamente cualquier hiperarqueo o hiperextensión de la espalda baja.',
      pt: 'A execução soberana perfeita exige uma coluna superior ligeiramente arredondada e um queixo retraído para inibir intencionalmente os eretores da espinha e forçar os glúteos a serem os impulsores primários da extensão do quadril. A cadeia cinética depende de a pelve estar posicionada apenas ligeiramente sobre a borda superior do apoio, permitindo flexão e extensão de quadril pura e desimpedida sem qualquer contribuição lombar. A saúde articular é protegida parando a subida no momento exato em que os quadris alcançam a extensão completa, evitando estritamente qualquer hiperarqueamento ou hiperextensão da região lombar.'
    },
    svgTitle: {
      en: 'Glute Extension Sagittal Wireframe',
      es: 'Wireframe Sagital de Extensión Glútea',
      pt: 'Wireframe Sagital de Extensão Glútea'
    },

    plane: 'sagittal', facing: 'right', ground: { y: 0.92 },
    jointSpec: STD_JOINT_SPEC, bones: STD_BONES,

    animation: {
      duration_ms: 3500, loop: true, direction: 'normal', easing: 'ease-in-out',
      phases: [
        { id: 'eccentric', start_pct: 0, end_pct: 40, easing: 'ease-out',
          label: { en: 'Eccentric · Hip Hinge', es: 'Excéntrica · Bisagra de Cadera', pt: 'Excêntrica · Dobradiça de Quadril' },
          cue:   { en: 'Hinge at the hips and lower the torso with deliberate pacing until a deep, safe stretch is felt across the hamstrings and glutes.',
                   es: 'Bisagra en las caderas y baja el torso con un ritmo deliberado hasta sentir un estiramiento profundo y seguro en los isquiotibiales y glúteos.',
                   pt: 'Faça a dobradiça nos quadris e abaixe o torso com ritmo deliberado até sentir um alongamento profundo e seguro nos isquiotibiais e glúteos.' } },
        { id: 'isometric', start_pct: 40, end_pct: 50, easing: 'linear',
          label: { en: 'Isometric · Bottom Stretch', es: 'Isométrica · Estiramiento Inferior', pt: 'Isométrica · Alongamento no Fundo' },
          cue:   { en: 'Pause motionless at the absolute bottom of the stretch to dissipate elastic energy and maximize mechanical tension on the posterior chain.',
                   es: 'Haz una pausa sin movimiento en el punto absoluto inferior del estiramiento para disipar la energía elástica y maximizar la tensión mecánica en la cadena posterior.',
                   pt: 'Faça uma pausa sem movimento no ponto absoluto inferior do alongamento para dissipar a energia elástica e maximizar a tensão mecânica na cadeia posterior.' } },
        { id: 'concentric', start_pct: 50, end_pct: 90, easing: 'ease-in',
          label: { en: 'Concentric · Glute Drive', es: 'Concéntrica · Empuje de Glúteos', pt: 'Concêntrica · Impulso de Glúteos' },
          cue:   { en: 'Drive the hips forcefully into the pad and squeeze the gluteals intensely to extend the torso until the body forms a straight line.',
                   es: 'Empuja las caderas con fuerza contra el cojín y aprieta los glúteos intensamente para extender el torso hasta que el cuerpo forme una línea recta.',
                   pt: 'Empurre os quadris com força contra o apoio e contraia os glúteos intensamente para estender o torso até que o corpo forme uma linha reta.' } },
        { id: 'reset', start_pct: 90, end_pct: 100, easing: 'ease-in-out',
          label: { en: 'Reset · Neutral Lockout', es: 'Reinicio · Bloqueo Neutro', pt: 'Reinício · Travamento Neutro' },
          cue:   { en: 'Maintain straight alignment without arching.', es: 'Mantén la alineación recta sin arquear.', pt: 'Mantenha o alinhamento reto sem arquear.' } }
      ],
      keyframes: [
        { t: 0.00, phase: 'eccentric',
          joints: {
            head: { x: 0.75, y: 0.20 },
            shoulder_l: { x: 0.65, y: 0.35 }, shoulder_r: { x: 0.65, y: 0.35 },
            hip_l:      { x: 0.45, y: 0.55 }, hip_r:      { x: 0.45, y: 0.55 },
            knee_l:     { x: 0.30, y: 0.75 }, knee_r:     { x: 0.30, y: 0.75 },
            ankle_l:    { x: 0.20, y: 0.92 }, ankle_r:    { x: 0.20, y: 0.92 },
            elbow_l:    { x: 0.60, y: 0.40 }, elbow_r:    { x: 0.60, y: 0.40 },
            wrist_l:    { x: 0.55, y: 0.35 }, wrist_r:    { x: 0.55, y: 0.35 }
          } },
        { t: 0.40, phase: 'eccentric',
          joints: {
            head: { x: 0.75, y: 0.80 },
            shoulder_l: { x: 0.65, y: 0.70 }, shoulder_r: { x: 0.65, y: 0.70 },
            elbow_l: { x: 0.60, y: 0.65 }, elbow_r: { x: 0.60, y: 0.65 },
            wrist_l: { x: 0.55, y: 0.70 }, wrist_r: { x: 0.55, y: 0.70 }
          } },
        { t: 0.50, phase: 'isometric', joints: {} },
        { t: 0.90, phase: 'concentric',
          joints: {
            head: { x: 0.75, y: 0.20 },
            shoulder_l: { x: 0.65, y: 0.35 }, shoulder_r: { x: 0.65, y: 0.35 },
            elbow_l: { x: 0.60, y: 0.40 }, elbow_r: { x: 0.60, y: 0.40 },
            wrist_l: { x: 0.55, y: 0.35 }, wrist_r: { x: 0.55, y: 0.35 }
          } },
        { t: 1.00, phase: 'reset', joints: {} }
      ]
    },

    equipment: [{ type: 'machine_pad', attach: ['hip_l', 'ankle_l'] }],

    kineticPath: {
      default: { label: { en: 'Extension Arc', es: 'Arco de Extensión', pt: 'Arco de Extensão' },
                 d: 'M 0.65 0.70 Q 0.80 0.50 0.65 0.35' },
      endpoints: [{ x: 0.65, y: 0.70 }, { x: 0.65, y: 0.35 }],
      labels: [
        { x: 0.70, y: 0.75, text: { en: 'Max Stretch',      es: 'Estiramiento Máximo', pt: 'Alongamento Máximo' } },
        { x: 0.70, y: 0.30, text: { en: 'Neutral Lockout',  es: 'Bloqueo Neutro',      pt: 'Travamento Neutro' } }
      ]
    },

    forms: {
      ok: {
        chipLabel: { en: 'Standard Form', es: 'Forma Estándar', pt: 'Forma Padrão' },
        callouts: [
          { from: 'hip_l', to: { x: 0.25, y: 0.45 },
            lines: [{ en: 'Pivot strictly at hips', es: 'Pivota estrictamente en las caderas', pt: 'Pivote estritamente nos quadris' }] }
        ],
        metrics: {
          dev: '± 1.0 cm',
          tuck: { en: 'Chin Tucked', es: 'Mentón Retraído', pt: 'Queixo Retraído' },
          load: { en: 'Glute Bias',  es: 'Sesgo Glúteo',    pt: 'Viés Glúteo' },
          fn:   { en: 'Clinical reference overlay', es: 'Capa de referencia clínica', pt: 'Camada de referência clínica' }
        },
        haloAt: null
      },
      warn: {
        chipLabel: { en: 'Common Fault: Lumbar Hyperextension', es: 'Falla Común: Hiperextensión Lumbar', pt: 'Falha Comum: Hiperextensão Lombar' },
        callouts: [
          { from: 'shoulder_l', to: { x: 0.85, y: 0.30 }, warn: true,
            lines: [{ en: 'Overarching · Lumbar shear',
                      es: 'Hiperarqueo · Cizalla lumbar',
                      pt: 'Hiperarqueamento · Cisalhamento lombar' }] }
        ],
        metrics: {
          dev: '± 4.0 cm',
          tuck: { en: 'Spine Arched',    es: 'Columna Arqueada',     pt: 'Coluna Arqueada' },
          load: { en: 'Erector Strain',  es: 'Tensión de Erectores', pt: 'Tensão de Eretores' },
          fn:   { en: 'Fault pattern · Extending past neutral using lower back',
                  es: 'Patrón de falla · Extendiendo más allá de neutral usando la espalda baja',
                  pt: 'Padrão de falha · Estendendo além do neutro usando a região lombar' }
        },
        haloAt: 'shoulder_l',
        keyframesOverride: [
          { t: 0.90, joints: { head: { x: 0.65, y: 0.15 }, shoulder_l: { x: 0.55, y: 0.30 }, shoulder_r: { x: 0.55, y: 0.30 } } }
        ]
      }
    },

    metricLabels: {
      dev:  { en: 'Path Dev.',      es: 'Desv. Trayectoria', pt: 'Desv. Trajetória' },
      tuck: { en: 'Spinal Posture', es: 'Postura Espinal',   pt: 'Postura Espinhal' },
      load: { en: 'Muscle Bias',    es: 'Sesgo Muscular',    pt: 'Viés Muscular' }
    }
  };

  // ─── SUPPORTED KNEE RAISES (V2 · Batch 6) ────────────────
  // Validator-patched: t=0 added symmetric right-arm joints.
  var SUPPORTED_KNEE_RAISES = {
    id: 'supported_knee_raises',
    displayName: 'Supported Knee Raises',
    aliases: ['supported knee raises', "captain's chair knee raises", 'vertical knee raises', 'vkr', 'hanging knee raises', 'machine knee raises', "captain's chair leg raises", 'forearm supported knee raises'],

    title: {
      en: 'Clinical Protocol: Supported Knee Raises',
      es: 'Protocolo Clínico: Elevaciones de Rodillas con Soporte',
      pt: 'Protocolo Clínico: Elevação de Joelhos com Apoio'
    },
    subtitle: {
      en: 'Sagittal Plane · Machine · Sovereign Rig',
      es: 'Plano Sagital · Máquina · Equipo Soberano',
      pt: 'Plano Sagital · Máquina · Equipamento Soberano'
    },
    muscleTarget: {
      en: 'Primary: Rectus Abdominis, Iliopsoas. Secondary: Obliques, Core Stabilizers.',
      es: 'Primarios: Recto Abdominal, Iliopsoas. Secundarios: Oblicuos, Estabilizadores del Core.',
      pt: 'Primários: Reto Abdominal, Iliopsoas. Secundários: Oblíquos, Estabilizadores do Core.'
    },
    clinicalNotes: {
      en: 'Execution necessitates the forearms being rigidly anchored to the pads with the scapulae actively depressed to stabilize the torso and entirely prevent swinging or upper trap dominance. The kinetic chain requires an active posterior pelvic tilt at the top of the movement, curling the pelvis upward to fully shorten the rectus abdominis rather than simply flexing the hips. Joint health is optimized by avoiding excessive lumbar extension at the bottom of the rep, maintaining continuous core tension to protect the lower spine from sheer stress.',
      es: 'La ejecución requiere que los antebrazos estén rígidamente anclados a los cojines con las escápulas activamente deprimidas para estabilizar el torso y prevenir por completo el balanceo o la dominancia del trapecio superior. La cadena cinética requiere una inclinación pélvica posterior activa en la parte superior del movimiento, curvando la pelvis hacia arriba para acortar completamente el recto abdominal en lugar de simplemente flexionar las caderas. La salud articular se optimiza evitando la extensión lumbar excesiva en el fondo de la repetición, manteniendo tensión continua del core para proteger la columna inferior del estrés cortante.',
      pt: 'A execução necessita que os antebraços estejam rigidamente ancorados aos apoios com as escápulas ativamente deprimidas para estabilizar o torso e prevenir completamente o balanço ou a dominância do trapézio superior. A cadeia cinética requer uma inclinação pélvica posterior ativa no topo do movimento, curvando a pelve para cima para encurtar completamente o reto abdominal em vez de simplesmente flexionar os quadris. A saúde articular é otimizada evitando a extensão lombar excessiva no fundo da repetição, mantendo tensão contínua do core para proteger a coluna inferior do estresse cortante.'
    },
    svgTitle: {
      en: 'Knee Raise Sagittal Wireframe',
      es: 'Wireframe Sagital de Elevación de Rodillas',
      pt: 'Wireframe Sagital de Elevação de Joelhos'
    },

    plane: 'sagittal', facing: 'right', ground: { y: 0.92 },
    jointSpec: STD_JOINT_SPEC, bones: STD_BONES,

    animation: {
      duration_ms: 3000, loop: true, direction: 'normal', easing: 'ease-in-out',
      phases: [
        { id: 'eccentric', start_pct: 0, end_pct: 40, easing: 'ease-out',
          label: { en: 'Eccentric · Controlled Drop', es: 'Excéntrica · Descenso Controlado', pt: 'Excêntrica · Descida Controlada' },
          cue:   { en: 'Lower the knees with strict, deliberate control until the legs are extended, maintaining active tension in the lower abdominals throughout the descent.',
                   es: 'Baja las rodillas con control estricto y deliberado hasta que las piernas estén extendidas, manteniendo tensión activa en los abdominales inferiores durante todo el descenso.',
                   pt: 'Abaixe os joelhos com controle estrito e deliberado até que as pernas estejam estendidas, mantendo tensão ativa nos abdominais inferiores durante toda a descida.' } },
        { id: 'isometric', start_pct: 40, end_pct: 50, easing: 'linear',
          label: { en: 'Isometric · Dead Hang', es: 'Isométrica · Suspensión Pasiva', pt: 'Isométrica · Suspensão Passiva' },
          cue:   { en: 'Hold the bottom position motionless to eliminate all pendular momentum and prevent energy leakage.',
                   es: 'Mantén la posición inferior sin movimiento para eliminar todo el impulso pendular y prevenir la fuga de energía.',
                   pt: 'Mantenha a posição inferior sem movimento para eliminar todo o impulso pendular e prevenir a perda de energia.' } },
        { id: 'concentric', start_pct: 50, end_pct: 90, easing: 'ease-in',
          label: { en: 'Concentric · Pelvic Curl', es: 'Concéntrica · Curva Pélvica', pt: 'Concêntrica · Curva Pélvica' },
          cue:   { en: 'Drive the knees forcefully upward toward the chest while deliberately curling the pelvis toward the ribcage to achieve maximal spinal flexion.',
                   es: 'Impulsa las rodillas con fuerza hacia arriba hacia el pecho mientras curvas deliberadamente la pelvis hacia la caja torácica para lograr la flexión espinal máxima.',
                   pt: 'Impulsione os joelhos com força para cima em direção ao peito enquanto curva deliberadamente a pelve em direção à caixa torácica para alcançar a flexão espinhal máxima.' } },
        { id: 'reset', start_pct: 90, end_pct: 100, easing: 'ease-in-out',
          label: { en: 'Reset · Peak Contraction', es: 'Reinicio · Contracción Máxima', pt: 'Reinício · Contração Máxima' },
          cue:   { en: 'Hold the crunch at the top.', es: 'Mantén el crunch arriba.', pt: 'Mantenha o crunch no topo.' } }
      ],
      keyframes: [
        { t: 0.00, phase: 'eccentric',
          joints: {
            head: { x: 0.40, y: 0.20 },
            shoulder_l: { x: 0.40, y: 0.35 }, shoulder_r: { x: 0.40, y: 0.35 },
            hip_l:      { x: 0.45, y: 0.60 }, hip_r:      { x: 0.45, y: 0.60 },
            knee_l:     { x: 0.65, y: 0.50 }, knee_r:     { x: 0.65, y: 0.50 },
            ankle_l:    { x: 0.60, y: 0.75 }, ankle_r:    { x: 0.60, y: 0.75 },
            elbow_l:    { x: 0.45, y: 0.45 }, elbow_r:    { x: 0.45, y: 0.45 },
            wrist_l:    { x: 0.55, y: 0.45 }, wrist_r:    { x: 0.55, y: 0.45 }
          } },
        { t: 0.40, phase: 'eccentric',
          joints: {
            hip_l: { x: 0.40, y: 0.60 }, hip_r: { x: 0.40, y: 0.60 },
            knee_l: { x: 0.40, y: 0.80 }, knee_r: { x: 0.40, y: 0.80 },
            ankle_l: { x: 0.40, y: 0.92 }, ankle_r: { x: 0.40, y: 0.92 }
          } },
        { t: 0.50, phase: 'isometric', joints: {} },
        { t: 0.90, phase: 'concentric',
          joints: {
            hip_l: { x: 0.45, y: 0.60 }, hip_r: { x: 0.45, y: 0.60 },
            knee_l: { x: 0.65, y: 0.50 }, knee_r: { x: 0.65, y: 0.50 },
            ankle_l: { x: 0.60, y: 0.75 }, ankle_r: { x: 0.60, y: 0.75 }
          } },
        { t: 1.00, phase: 'reset', joints: {} }
      ]
    },

    equipment: [{ type: 'machine_pad', attach: ['shoulder_l', 'elbow_l'] }],

    kineticPath: {
      default: { label: { en: 'Flexion Arc', es: 'Arco de Flexión', pt: 'Arco de Flexão' },
                 d: 'M 0.40 0.80 Q 0.55 0.70 0.65 0.50' },
      endpoints: [{ x: 0.40, y: 0.80 }, { x: 0.65, y: 0.50 }],
      labels: [
        { x: 0.35, y: 0.85, text: { en: 'Bottom Start', es: 'Inicio en Fondo', pt: 'Início no Fundo' } },
        { x: 0.70, y: 0.45, text: { en: 'Peak Curl',    es: 'Curva Máxima',    pt: 'Curva Máxima' } }
      ]
    },

    forms: {
      ok: {
        chipLabel: { en: 'Standard Form', es: 'Forma Estándar', pt: 'Forma Padrão' },
        callouts: [
          { from: 'hip_l', to: { x: 0.20, y: 0.60 },
            lines: [{ en: 'Pelvis curls upward', es: 'La pelvis se curva hacia arriba', pt: 'A pelve curva-se para cima' }] }
        ],
        metrics: {
          dev: '± 1.0 cm',
          tuck: { en: 'Scapulae Depressed',     es: 'Escápulas Deprimidas',      pt: 'Escápulas Deprimidas' },
          load: { en: 'Rectus Abdominis Bias',  es: 'Sesgo del Recto Abdominal', pt: 'Viés do Reto Abdominal' },
          fn:   { en: 'Clinical reference overlay', es: 'Capa de referencia clínica', pt: 'Camada de referência clínica' }
        },
        haloAt: null
      },
      warn: {
        chipLabel: { en: 'Common Fault: Momentum Swing', es: 'Falla Común: Balanceo por Impulso', pt: 'Falha Comum: Balanço por Impulso' },
        callouts: [
          { from: 'knee_l', to: { x: 0.20, y: 0.80 }, warn: true,
            lines: [{ en: 'Pendular swing · Core disengaged',
                      es: 'Balanceo pendular · Core desactivado',
                      pt: 'Balanço pendular · Core desativado' }] }
        ],
        metrics: {
          dev: '± 5.0 cm',
          tuck: { en: 'Body English',        es: 'Movimiento del Cuerpo',          pt: 'Movimento do Corpo' },
          load: { en: 'Hip Flexor Overload', es: 'Sobrecarga del Flexor de Cadera', pt: 'Sobrecarga do Flexor do Quadril' },
          fn:   { en: 'Fault pattern · Legs swing backward to generate force',
                  es: 'Patrón de falla · Las piernas se balancean hacia atrás para generar fuerza',
                  pt: 'Padrão de falha · Pernas balançam para trás para gerar força' }
        },
        haloAt: 'knee_l',
        keyframesOverride: [
          { t: 0.40, joints: { knee_l: { x: 0.25, y: 0.75 }, knee_r: { x: 0.25, y: 0.75 },
                               ankle_l: { x: 0.20, y: 0.85 }, ankle_r: { x: 0.20, y: 0.85 } } }
        ]
      }
    },

    metricLabels: {
      dev:  { en: 'Path Dev.',     es: 'Desv. Trayectoria', pt: 'Desv. Trajetória' },
      tuck: { en: 'Torso Anchor',  es: 'Anclaje del Torso', pt: 'Ancoragem do Torso' },
      load: { en: 'Muscle Bias',   es: 'Sesgo Muscular',    pt: 'Viés Muscular' }
    }
  };

  // ─── PLANK (V2 · Batch 6) ────────────────────────────────
  // Note: isometric hold pattern with extended phase boundaries
  // (eccentric 0-20%, isometric 20-80%, concentric 80-95%, reset
  // 95-100%). t=0 patched with symmetric right-arm joints.
  var PLANK = {
    id: 'plank',
    displayName: 'Plank',
    aliases: ['plank', 'floor plank', 'forearm plank', 'front plank', 'hover plank', 'abdominal plank', 'standard plank', 'static plank'],

    title: {
      en: 'Clinical Protocol: Plank',
      es: 'Protocolo Clínico: Plancha',
      pt: 'Protocolo Clínico: Prancha'
    },
    subtitle: {
      en: 'Sagittal Plane · Bodyweight · Sovereign Rig',
      es: 'Plano Sagital · Peso Corporal · Equipo Soberano',
      pt: 'Plano Sagital · Peso Corporal · Equipamento Soberano'
    },
    muscleTarget: {
      en: 'Primary: Rectus Abdominis, Transversus Abdominis. Secondary: Core Stabilizers, Gluteus Maximus, Quadriceps, Anterior Deltoid.',
      es: 'Primarios: Recto Abdominal, Transverso Abdominal. Secundarios: Estabilizadores del Core, Glúteo Mayor, Cuádriceps, Deltoides Anterior.',
      pt: 'Primários: Reto Abdominal, Transverso Abdominal. Secundários: Estabilizadores do Core, Glúteo Máximo, Quadríceps, Deltoide Anterior.'
    },
    clinicalNotes: {
      en: 'Perfect Sovereign execution demands a rigid, straight line from the crown of the head to the heels, established by an active posterior pelvic tilt and a highly braced core. The kinetic chain relies on maximal full-body irradiation—squeezing the glutes, flexing the quadriceps, and driving the forearms into the floor to lock the skeleton in absolute neutrality. Optimal joint health is maintained by actively protracting the scapulae and keeping the cervical spine neutral, strictly avoiding lumbar sagging or cervical hyperextension.',
      es: 'La ejecución soberana perfecta exige una línea recta y rígida desde la coronilla de la cabeza hasta los talones, establecida por una inclinación pélvica posterior activa y un core altamente activado. La cadena cinética depende de la irradiación máxima de todo el cuerpo—apretando los glúteos, flexionando los cuádriceps y empujando los antebrazos contra el suelo para bloquear el esqueleto en neutralidad absoluta. La salud articular óptima se mantiene protraiendo activamente las escápulas y manteniendo la columna cervical neutra, evitando estrictamente el hundimiento lumbar o la hiperextensión cervical.',
      pt: 'A execução soberana perfeita exige uma linha reta e rígida do topo da cabeça aos calcanhares, estabelecida por uma inclinação pélvica posterior ativa e um core altamente ativado. A cadeia cinética depende da irradiação máxima de todo o corpo—contraindo os glúteos, flexionando os quadríceps e empurrando os antebraços contra o chão para travar o esqueleto em neutralidade absoluta. A saúde articular ótima é mantida protraindo ativamente as escápulas e mantendo a coluna cervical neutra, evitando estritamente o afundamento lombar ou a hiperextensão cervical.'
    },
    svgTitle: {
      en: 'Plank Sagittal Wireframe',
      es: 'Wireframe Sagital de Plancha',
      pt: 'Wireframe Sagital de Prancha'
    },

    plane: 'sagittal', facing: 'right', ground: { y: 0.92 },
    jointSpec: STD_JOINT_SPEC, bones: STD_BONES,

    animation: {
      duration_ms: 3000, loop: true, direction: 'normal', easing: 'ease-in-out',
      phases: [
        { id: 'eccentric', start_pct: 0, end_pct: 20, easing: 'ease-out',
          label: { en: 'Setup · Structure Activation', es: 'Configuración · Activación Estructural', pt: 'Preparação · Ativação Estrutural' },
          cue:   { en: 'Deliberately lower into position, anchoring the forearms and toes while drawing the navel toward the spine to establish your structural foundation.',
                   es: 'Baja deliberadamente a la posición, anclando los antebrazos y los dedos de los pies mientras tiras el ombligo hacia la columna para establecer tu base estructural.',
                   pt: 'Abaixe-se deliberadamente à posição, ancorando os antebraços e os dedos dos pés enquanto puxa o umbigo em direção à coluna para estabelecer sua base estrutural.' } },
        { id: 'isometric', start_pct: 20, end_pct: 80, easing: 'linear',
          label: { en: 'Isometric · Neutral Hold', es: 'Isométrica · Sostén Neutro', pt: 'Isométrica · Sustentação Neutra' },
          cue:   { en: 'Hold the perfectly aligned peak position motionless, resisting gravity and refusing to let the hips sag or pike upward.',
                   es: 'Mantén la posición pico perfectamente alineada sin movimiento, resistiendo la gravedad y negándote a dejar que las caderas se hundan o se eleven hacia arriba.',
                   pt: 'Mantenha a posição pico perfeitamente alinhada sem movimento, resistindo à gravidade e recusando-se a deixar os quadris afundarem ou subirem.' } },
        { id: 'concentric', start_pct: 80, end_pct: 95, easing: 'ease-in',
          label: { en: 'Active · Full-Body Tension', es: 'Activa · Tensión de Cuerpo Completo', pt: 'Ativa · Tensão de Corpo Inteiro' },
          cue:   { en: 'Actively drag your elbows and toes toward each other through the floor to generate maximal, unyielding full-body tension.',
                   es: 'Arrastra activamente los codos y los dedos de los pies uno hacia el otro a través del suelo para generar la máxima tensión de cuerpo completo inquebrantable.',
                   pt: 'Arraste ativamente os cotovelos e os dedos dos pés um em direção ao outro através do chão para gerar a máxima tensão de corpo inteiro inquebrável.' } },
        { id: 'reset', start_pct: 95, end_pct: 100, easing: 'ease-in-out',
          label: { en: 'Reset · Re-brace', es: 'Reinicio · Reactivación', pt: 'Reinício · Reativação' },
          cue:   { en: 'Maintain neutral spine.', es: 'Mantén la columna neutra.', pt: 'Mantenha a coluna neutra.' } }
      ],
      keyframes: [
        { t: 0.00, phase: 'eccentric',
          joints: {
            head: { x: 0.20, y: 0.60 },
            shoulder_l: { x: 0.25, y: 0.70 }, shoulder_r: { x: 0.25, y: 0.70 },
            hip_l:      { x: 0.55, y: 0.80 }, hip_r:      { x: 0.55, y: 0.80 },
            knee_l:     { x: 0.75, y: 0.92 }, knee_r:     { x: 0.75, y: 0.92 },
            ankle_l:    { x: 0.85, y: 0.92 }, ankle_r:    { x: 0.85, y: 0.92 },
            elbow_l:    { x: 0.25, y: 0.92 }, elbow_r:    { x: 0.25, y: 0.92 },
            wrist_l:    { x: 0.35, y: 0.92 }, wrist_r:    { x: 0.35, y: 0.92 }
          } },
        { t: 0.20, phase: 'isometric',
          joints: {
            head: { x: 0.20, y: 0.60 },
            hip_l: { x: 0.55, y: 0.70 }, hip_r: { x: 0.55, y: 0.70 },
            knee_l: { x: 0.75, y: 0.80 }, knee_r: { x: 0.75, y: 0.80 }
          } },
        { t: 0.80, phase: 'concentric', joints: {} },
        { t: 0.95, phase: 'reset', joints: {} },
        { t: 1.00, phase: 'reset', joints: {} }
      ]
    },

    equipment: [],

    kineticPath: {
      default: { label: { en: 'Tension Vector', es: 'Vector de Tensión', pt: 'Vetor de Tensão' },
                 d: 'M 0.25 0.92 L 0.85 0.92' },
      endpoints: [{ x: 0.25, y: 0.92 }, { x: 0.85, y: 0.92 }],
      labels: [
        { x: 0.55, y: 0.95, text: { en: 'Active Floor Pull', es: 'Tracción Activa del Suelo', pt: 'Tração Ativa do Chão' } }
      ]
    },

    forms: {
      ok: {
        chipLabel: { en: 'Standard Form', es: 'Forma Estándar', pt: 'Forma Padrão' },
        callouts: [
          { from: 'hip_l', to: { x: 0.55, y: 0.55 },
            lines: [{ en: 'Perfectly straight kinetic chain', es: 'Cadena cinética perfectamente recta', pt: 'Cadeia cinética perfeitamente reta' }] }
        ],
        metrics: {
          dev: '± 0.5 cm',
          tuck: { en: 'Posterior Tilt',       es: 'Inclinación Posterior',     pt: 'Inclinação Posterior' },
          load: { en: 'Full Core Activation', es: 'Activación Completa del Core', pt: 'Ativação Completa do Core' },
          fn:   { en: 'Clinical reference overlay', es: 'Capa de referencia clínica', pt: 'Camada de referência clínica' }
        },
        haloAt: null
      },
      warn: {
        chipLabel: { en: 'Common Fault: Lumbar Sag', es: 'Falla Común: Hundimiento Lumbar', pt: 'Falha Comum: Afundamento Lombar' },
        callouts: [
          { from: 'hip_l', to: { x: 0.55, y: 0.55 }, warn: true,
            lines: [{ en: 'Hips dropping · Lumbar shear',
                      es: 'Caderas cayendo · Cizalla lumbar',
                      pt: 'Quadris caindo · Cisalhamento lombar' }] }
        ],
        metrics: {
          dev: '± 4.0 cm',
          tuck: { en: 'Anterior Tilt',   es: 'Inclinación Anterior', pt: 'Inclinação Anterior' },
          load: { en: 'Spinal Overload', es: 'Sobrecarga Espinal',   pt: 'Sobrecarga Espinhal' },
          fn:   { en: 'Fault pattern · Failure to maintain brace, lower back sags',
                  es: 'Patrón de falla · No se logra mantener la activación, la espalda baja se hunde',
                  pt: 'Padrão de falha · Falha em manter a ativação, a região lombar afunda' }
        },
        haloAt: 'hip_l',
        keyframesOverride: [
          { t: 0.20, joints: { hip_l: { x: 0.55, y: 0.82 }, hip_r: { x: 0.55, y: 0.82 }, head: { x: 0.25, y: 0.50 } } },
          { t: 0.80, joints: { hip_l: { x: 0.55, y: 0.82 }, hip_r: { x: 0.55, y: 0.82 }, head: { x: 0.25, y: 0.50 } } }
        ]
      }
    },

    metricLabels: {
      dev:  { en: 'Path Dev.',         es: 'Desv. Trayectoria',  pt: 'Desv. Trajetória' },
      tuck: { en: 'Pelvic Alignment',  es: 'Alineación Pélvica', pt: 'Alinhamento Pélvico' },
      load: { en: 'Joint Load',        es: 'Carga Articular',    pt: 'Carga Articular' }
    }
  };

  // ─── HACK SQUATS (V2 · Batch 6) ──────────────────────────
  // LEGACY CLEAROUT: alias 'hack squat' clears the legacy static
  // entry via the conflict resolver. Validator-patched: t=0 added
  // symmetric right-arm joints.
  var HACK_SQUATS = {
    id: 'hack_squats',
    displayName: 'Hack Squats',
    aliases: ['machine hack squats', 'hack squats', 'sled hack squats', 'hack machine squats', 'hack press', 'reverse hack squats', 'hack squat'],

    title: {
      en: 'Clinical Protocol: Hack Squats',
      es: 'Protocolo Clínico: Sentadilla Hack',
      pt: 'Protocolo Clínico: Agachamento Hack'
    },
    subtitle: {
      en: 'Sagittal Plane · Machine · Sovereign Rig',
      es: 'Plano Sagital · Máquina · Equipo Soberano',
      pt: 'Plano Sagital · Máquina · Equipamento Soberano'
    },
    muscleTarget: {
      en: 'Primary: Quadriceps. Secondary: Gluteus Maximus, Adductor Magnus.',
      es: 'Primario: Cuádriceps. Secundarios: Glúteo Mayor, Aductor Mayor.',
      pt: 'Primário: Quadríceps. Secundários: Glúteo Máximo, Adutor Magno.'
    },
    clinicalNotes: {
      en: "Execution demands that the entire spine and pelvis remain rigidly pinned against the back pad throughout the movement to entirely prevent lumbar rounding or posterior pelvic tilt ('butt wink') at the bottom. The kinetic chain requires active foot tracking and a stable, flat-footed stance, ensuring the knees align perfectly over the toes to maximize quadriceps isolation. Joint articulation is optimized by descending into maximum safe knee flexion, controlling the load to strictly avoid bouncing out of the bottom position and to protect the patellar tendon.",
      es: "La ejecución exige que toda la columna y la pelvis permanezcan rígidamente fijadas contra el respaldo durante todo el movimiento para prevenir por completo el redondeo lumbar o la inclinación pélvica posterior ('butt wink') en el fondo. La cadena cinética requiere un seguimiento activo del pie y una postura estable con pies planos, asegurando que las rodillas se alineen perfectamente sobre los dedos del pie para maximizar el aislamiento del cuádriceps. La articulación se optimiza descendiendo hasta la flexión máxima segura de rodilla, controlando la carga para evitar estrictamente rebotar en la posición inferior y proteger el tendón rotuliano.",
      pt: "A execução exige que toda a coluna e a pelve permaneçam rigidamente pressionadas contra o encosto durante todo o movimento para prevenir completamente o arredondamento lombar ou a inclinação pélvica posterior ('butt wink') no fundo. A cadeia cinética requer rastreamento ativo do pé e uma postura estável com os pés planos, garantindo que os joelhos se alinhem perfeitamente sobre os dedos do pé para maximizar o isolamento do quadríceps. A articulação é otimizada descendo até a flexão máxima segura do joelho, controlando a carga para evitar estritamente saltar da posição inferior e proteger o tendão patelar."
    },
    svgTitle: {
      en: 'Hack Squat Sagittal Wireframe',
      es: 'Wireframe Sagital de Sentadilla Hack',
      pt: 'Wireframe Sagital de Agachamento Hack'
    },

    plane: 'sagittal', facing: 'right', ground: { y: 0.92 },
    jointSpec: STD_JOINT_SPEC, bones: STD_BONES,

    animation: {
      duration_ms: 3500, loop: true, direction: 'normal', easing: 'ease-in-out',
      phases: [
        { id: 'eccentric', start_pct: 0, end_pct: 40, easing: 'ease-out',
          label: { en: 'Eccentric · Sled Descent', es: 'Excéntrica · Descenso del Trineo', pt: 'Excêntrica · Descida do Trenó' },
          cue:   { en: 'Lower the sled with strict, deliberate control, allowing the knees to travel forward over the toes until maximal safe depth is achieved.',
                   es: 'Baja el trineo con control estricto y deliberado, permitiendo que las rodillas avancen sobre los dedos del pie hasta lograr la profundidad máxima segura.',
                   pt: 'Abaixe o trenó com controle estrito e deliberado, permitindo que os joelhos avancem sobre os dedos do pé até alcançar a profundidade máxima segura.' } },
        { id: 'isometric', start_pct: 40, end_pct: 50, easing: 'linear',
          label: { en: 'Isometric · Bottom Hold', es: 'Isométrica · Pausa Inferior', pt: 'Isométrica · Pausa no Fundo' },
          cue:   { en: 'Pause motionless in the deep squat to dissipate downward momentum and maximize mechanical tension on the quadriceps.',
                   es: 'Haz una pausa sin movimiento en la sentadilla profunda para disipar el impulso descendente y maximizar la tensión mecánica sobre los cuádriceps.',
                   pt: 'Faça uma pausa sem movimento no agachamento profundo para dissipar o impulso descendente e maximizar a tensão mecânica sobre os quadríceps.' } },
        { id: 'concentric', start_pct: 50, end_pct: 90, easing: 'ease-in',
          label: { en: 'Concentric · Sled Drive', es: 'Concéntrica · Empuje del Trineo', pt: 'Concêntrica · Impulso do Trenó' },
          cue:   { en: 'Drive forcefully upward through the mid-foot, extending the knees and hips simultaneously to return to the starting position without locking out the joints.',
                   es: 'Empuja con fuerza hacia arriba desde la planta media del pie, extendiendo las rodillas y caderas simultáneamente para volver a la posición inicial sin bloquear las articulaciones.',
                   pt: 'Empurre com força para cima através do meio do pé, estendendo joelhos e quadris simultaneamente para retornar à posição inicial sem travar as articulações.' } },
        { id: 'reset', start_pct: 90, end_pct: 100, easing: 'ease-in-out',
          label: { en: 'Reset · Soft Lockout', es: 'Reinicio · Bloqueo Suave', pt: 'Reinício · Travamento Suave' },
          cue:   { en: 'Maintain quad tension.', es: 'Mantén la tensión del cuádriceps.', pt: 'Mantenha a tensão do quadríceps.' } }
      ],
      keyframes: [
        { t: 0.00, phase: 'eccentric',
          joints: {
            head: { x: 0.25, y: 0.20 },
            shoulder_l: { x: 0.30, y: 0.35 }, shoulder_r: { x: 0.30, y: 0.35 },
            hip_l:      { x: 0.40, y: 0.55 }, hip_r:      { x: 0.40, y: 0.55 },
            knee_l:     { x: 0.55, y: 0.60 }, knee_r:     { x: 0.55, y: 0.60 },
            ankle_l:    { x: 0.65, y: 0.85 }, ankle_r:    { x: 0.65, y: 0.85 },
            elbow_l:    { x: 0.30, y: 0.45 }, elbow_r:    { x: 0.30, y: 0.45 },
            wrist_l:    { x: 0.30, y: 0.30 }, wrist_r:    { x: 0.30, y: 0.30 }
          } },
        { t: 0.40, phase: 'eccentric',
          joints: {
            head: { x: 0.15, y: 0.40 },
            shoulder_l: { x: 0.20, y: 0.55 }, shoulder_r: { x: 0.20, y: 0.55 },
            hip_l: { x: 0.30, y: 0.75 }, hip_r: { x: 0.30, y: 0.75 },
            knee_l: { x: 0.50, y: 0.75 }, knee_r: { x: 0.50, y: 0.75 },
            elbow_l: { x: 0.20, y: 0.65 }, elbow_r: { x: 0.20, y: 0.65 },
            wrist_l: { x: 0.20, y: 0.50 }, wrist_r: { x: 0.20, y: 0.50 }
          } },
        { t: 0.50, phase: 'isometric', joints: {} },
        { t: 0.90, phase: 'concentric',
          joints: {
            head: { x: 0.25, y: 0.20 },
            shoulder_l: { x: 0.30, y: 0.35 }, shoulder_r: { x: 0.30, y: 0.35 },
            hip_l: { x: 0.40, y: 0.55 }, hip_r: { x: 0.40, y: 0.55 },
            knee_l: { x: 0.55, y: 0.60 }, knee_r: { x: 0.55, y: 0.60 },
            elbow_l: { x: 0.30, y: 0.45 }, elbow_r: { x: 0.30, y: 0.45 },
            wrist_l: { x: 0.30, y: 0.30 }, wrist_r: { x: 0.30, y: 0.30 }
          } },
        { t: 1.00, phase: 'reset', joints: {} }
      ]
    },

    equipment: [
      { type: 'machine_pad', attach: ['shoulder_l', 'hip_l'] },
      { type: 'bench',       attach: ['ankle_l'] }
    ],

    kineticPath: {
      default: { label: { en: 'Sled Path', es: 'Trayectoria del Trineo', pt: 'Trajetória do Trenó' },
                 d: 'M 0.40 0.55 L 0.30 0.75' },
      endpoints: [{ x: 0.40, y: 0.55 }, { x: 0.30, y: 0.75 }],
      labels: [
        { x: 0.45, y: 0.50, text: { en: 'Top',       es: 'Arriba',             pt: 'Topo' } },
        { x: 0.20, y: 0.80, text: { en: 'Max Depth', es: 'Profundidad Máxima', pt: 'Profundidade Máxima' } }
      ]
    },

    forms: {
      ok: {
        chipLabel: { en: 'Standard Form', es: 'Forma Estándar', pt: 'Forma Padrão' },
        callouts: [
          { from: 'hip_l', to: { x: 0.15, y: 0.65 },
            lines: [{ en: 'Pelvis pinned to pad', es: 'Pelvis fijada al respaldo', pt: 'Pelve fixada ao encosto' }] }
        ],
        metrics: {
          dev: '± 1.0 cm',
          tuck: { en: 'Neutral Spine',  es: 'Columna Neutra',          pt: 'Coluna Neutra' },
          load: { en: 'Quad Isolation', es: 'Aislamiento de Cuádriceps', pt: 'Isolamento do Quadríceps' },
          fn:   { en: 'Clinical reference overlay', es: 'Capa de referencia clínica', pt: 'Camada de referência clínica' }
        },
        haloAt: null
      },
      warn: {
        chipLabel: { en: 'Common Fault: Butt Wink', es: 'Falla Común: Butt Wink (Hundimiento Pélvico)', pt: 'Falha Comum: Butt Wink (Inclinação Pélvica)' },
        callouts: [
          { from: 'hip_l', to: { x: 0.15, y: 0.65 }, warn: true,
            lines: [{ en: 'Pelvis tucks · Lumbar shear',
                      es: 'Pelvis se inclina · Cizalla lumbar',
                      pt: 'Pelve inclina · Cisalhamento lombar' }] }
        ],
        metrics: {
          dev: '± 4.0 cm',
          tuck: { en: 'Posterior Tilt',      es: 'Inclinación Posterior', pt: 'Inclinação Posterior' },
          load: { en: 'Lower Back Overload', es: 'Sobrecarga Lumbar',     pt: 'Sobrecarga Lombar' },
          fn:   { en: 'Fault pattern · Hips peel off the back pad at the bottom',
                  es: 'Patrón de falla · Las caderas se despegan del respaldo en el fondo',
                  pt: 'Padrão de falha · Quadris desencostam do encosto no fundo' }
        },
        haloAt: 'hip_l',
        keyframesOverride: [
          { t: 0.40, joints: { hip_l: { x: 0.35, y: 0.75 }, hip_r: { x: 0.35, y: 0.75 } } }
        ]
      }
    },

    metricLabels: {
      dev:  { en: 'Path Dev.',     es: 'Desv. Trayectoria', pt: 'Desv. Trajetória' },
      tuck: { en: 'Pelvic Anchor', es: 'Anclaje Pélvico',   pt: 'Ancoragem Pélvica' },
      load: { en: 'Muscle Bias',   es: 'Sesgo Muscular',    pt: 'Viés Muscular' }
    }
  };

  // ─── BARBELL BENCH PRESS (V2 · Batch 6) ──────────────────
  // LEGACY CLEAROUT: alias 'bench press' clears the legacy static
  // entry via the conflict resolver. Library is now 100% V2 after
  // this entry registers.
  var BARBELL_BENCH_PRESS = {
    id: 'barbell_bench_press',
    displayName: 'Barbell Bench Press',
    aliases: ['barbell bench press', 'flat barbell bench press', 'flat bench', 'bb bench press', 'barbell flat press', 'bench press', 'flat barbell press'],

    title: {
      en: 'Clinical Protocol: Barbell Bench Press',
      es: 'Protocolo Clínico: Press de Banca con Barra',
      pt: 'Protocolo Clínico: Supino com Barra'
    },
    subtitle: {
      en: 'Transverse Plane · Barbell · Sovereign Rig',
      es: 'Plano Transversal · Barra · Equipo Soberano',
      pt: 'Plano Transversal · Barra · Equipamento Soberano'
    },
    muscleTarget: {
      en: 'Primary: Pectoralis Major. Secondary: Anterior Deltoid, Triceps Brachii.',
      es: 'Primario: Pectoral Mayor. Secundarios: Deltoides Anterior, Tríceps Braquial.',
      pt: 'Primário: Peitoral Maior. Secundários: Deltoide Anterior, Tríceps Braquial.'
    },
    clinicalNotes: {
      en: 'Perfect Sovereign execution demands retracted and depressed scapulae pinned rigidly into the bench to establish a stable pressing platform, ensuring strict isolation of the pectorals and protecting the glenohumeral capsule. The kinetic chain relies on a stable five-point contact system and active leg drive transferring force through a highly braced torso, entirely preventing energy leakage. Optimal joint health is preserved by maintaining a slight elbow tuck (45-to-60-degree angle to the torso) during the descent, ensuring the barbell touches the lower chest to strictly avoid subacromial impingement.',
      es: 'La ejecución soberana perfecta exige escápulas retraídas y deprimidas rígidamente fijadas al banco para establecer una plataforma de presión estable, garantizando el aislamiento estricto de los pectorales y protegiendo la cápsula glenohumeral. La cadena cinética depende de un sistema estable de cinco puntos de contacto y un empuje activo de las piernas transfiriendo fuerza a través de un torso altamente activado, evitando por completo la fuga de energía. La salud articular óptima se preserva manteniendo una ligera retracción del codo (ángulo de 45 a 60 grados respecto al torso) durante el descenso, asegurando que la barra toque el pecho inferior para evitar estrictamente el pinzamiento subacromial.',
      pt: 'A execução soberana perfeita exige escápulas retraídas e deprimidas rigidamente pressionadas ao banco para estabelecer uma plataforma de pressão estável, garantindo o isolamento estrito dos peitorais e protegendo a cápsula glenoumeral. A cadeia cinética depende de um sistema estável de cinco pontos de contato e impulso ativo das pernas transferindo força através de um torso altamente ativado, prevenindo completamente a perda de energia. A saúde articular ótima é preservada mantendo uma leve retração do cotovelo (ângulo de 45 a 60 graus em relação ao torso) durante a descida, garantindo que a barra toque o peito inferior para evitar estritamente o impacto subacromial.'
    },
    svgTitle: {
      en: 'Bench Press Sagittal Wireframe',
      es: 'Wireframe Sagital de Press de Banca',
      pt: 'Wireframe Sagital de Supino'
    },

    plane: 'sagittal', facing: 'right', ground: { y: 0.92 },
    jointSpec: STD_JOINT_SPEC, bones: STD_BONES,

    animation: {
      duration_ms: 3500, loop: true, direction: 'normal', easing: 'ease-in-out',
      phases: [
        { id: 'eccentric', start_pct: 0, end_pct: 40, easing: 'ease-out',
          label: { en: 'Eccentric · Loaded Descent', es: 'Excéntrica · Descenso con Carga', pt: 'Excêntrica · Descida Carregada' },
          cue:   { en: 'Lower the barbell with deliberate pacing toward the lower sternum until a maximal, safe stretch is achieved across the chest.',
                   es: 'Baja la barra con un ritmo deliberado hacia el esternón inferior hasta lograr un estiramiento máximo y seguro en el pecho.',
                   pt: 'Abaixe a barra com ritmo deliberado em direção ao esterno inferior até alcançar um alongamento máximo e seguro no peito.' } },
        { id: 'isometric', start_pct: 40, end_pct: 50, easing: 'linear',
          label: { en: 'Isometric · Chest Touch', es: 'Isométrica · Toque al Pecho', pt: 'Isométrica · Toque no Peito' },
          cue:   { en: 'Pause the barbell motionless on the chest to dissipate elastic recoil and maximize mechanical tension on the pectoralis fibers.',
                   es: 'Haz una pausa con la barra sin movimiento en el pecho para disipar el rebote elástico y maximizar la tensión mecánica en las fibras del pectoral.',
                   pt: 'Faça uma pausa com a barra sem movimento no peito para dissipar o recuo elástico e maximizar a tensão mecânica nas fibras do peitoral.' } },
        { id: 'concentric', start_pct: 50, end_pct: 90, easing: 'ease-in',
          label: { en: 'Concentric · Press Drive', es: 'Concéntrica · Empuje de Presión', pt: 'Concêntrica · Impulso de Pressão' },
          cue:   { en: 'Drive the barbell forcefully upward and slightly backward over the shoulders through a strict contraction of the chest and triceps.',
                   es: 'Empuja la barra con fuerza hacia arriba y ligeramente hacia atrás sobre los hombros mediante una contracción estricta del pecho y los tríceps.',
                   pt: 'Empurre a barra com força para cima e ligeiramente para trás sobre os ombros através de uma contração estrita do peito e dos tríceps.' } },
        { id: 'reset', start_pct: 90, end_pct: 100, easing: 'ease-in-out',
          label: { en: 'Reset · Lockout Dwell', es: 'Reinicio · Pausa en Bloqueo', pt: 'Reinício · Pausa no Travamento' },
          cue:   { en: 'Maintain scapular retraction.', es: 'Mantén la retracción escapular.', pt: 'Mantenha a retração escapular.' } }
      ],
      keyframes: [
        { t: 0.00, phase: 'eccentric',
          joints: {
            head: { x: 0.25, y: 0.55 },
            shoulder_l: { x: 0.35, y: 0.55 }, shoulder_r: { x: 0.35, y: 0.55 },
            hip_l:      { x: 0.65, y: 0.55 }, hip_r:      { x: 0.65, y: 0.55 },
            knee_l:     { x: 0.75, y: 0.70 }, knee_r:     { x: 0.75, y: 0.70 },
            ankle_l:    { x: 0.65, y: 0.92 }, ankle_r:    { x: 0.65, y: 0.92 },
            elbow_l:    { x: 0.40, y: 0.30 }, elbow_r:    { x: 0.40, y: 0.30 },
            wrist_l:    { x: 0.35, y: 0.15 }, wrist_r:    { x: 0.35, y: 0.15 }
          } },
        { t: 0.40, phase: 'eccentric',
          joints: {
            elbow_l: { x: 0.45, y: 0.65 }, elbow_r: { x: 0.45, y: 0.65 },
            wrist_l: { x: 0.45, y: 0.45 }, wrist_r: { x: 0.45, y: 0.45 }
          } },
        { t: 0.50, phase: 'isometric', joints: {} },
        { t: 0.90, phase: 'concentric',
          joints: {
            elbow_l: { x: 0.40, y: 0.30 }, elbow_r: { x: 0.40, y: 0.30 },
            wrist_l: { x: 0.35, y: 0.15 }, wrist_r: { x: 0.35, y: 0.15 }
          } },
        { t: 1.00, phase: 'reset', joints: {} }
      ]
    },

    equipment: [
      { type: 'bar',   attach: ['wrist_l', 'wrist_r'] },
      { type: 'bench', attach: ['shoulder_l', 'hip_l'] }
    ],

    kineticPath: {
      default: { label: { en: 'Press J-Curve', es: 'Curva-J de Presión', pt: 'Curva-J de Pressão' },
                 d: 'M 0.35 0.15 L 0.45 0.45' },
      endpoints: [{ x: 0.35, y: 0.15 }, { x: 0.45, y: 0.45 }],
      labels: [
        { x: 0.30, y: 0.10, text: { en: 'Lockout',       es: 'Bloqueo',          pt: 'Travamento' } },
        { x: 0.50, y: 0.45, text: { en: 'Sternum Touch', es: 'Toque al Esternón', pt: 'Toque no Esterno' } }
      ]
    },

    forms: {
      ok: {
        chipLabel: { en: 'Standard Form', es: 'Forma Estándar', pt: 'Forma Padrão' },
        callouts: [
          { from: 'shoulder_l', to: { x: 0.20, y: 0.40 },
            lines: [{ en: 'Scapulae pinned to bench', es: 'Escápulas fijadas al banco', pt: 'Escápulas fixadas ao banco' }] }
        ],
        metrics: {
          dev: '± 1.0 cm',
          tuck: { en: 'Retracted',     es: 'Retraídas',     pt: 'Retraídas' },
          load: { en: 'Pectoral Bias', es: 'Sesgo Pectoral', pt: 'Viés Peitoral' },
          fn:   { en: 'Clinical reference overlay', es: 'Capa de referencia clínica', pt: 'Camada de referência clínica' }
        },
        haloAt: null
      },
      warn: {
        chipLabel: { en: 'Common Fault: Scapular Flare', es: 'Falla Común: Apertura Escapular', pt: 'Falha Comum: Abertura Escapular' },
        callouts: [
          { from: 'shoulder_l', to: { x: 0.20, y: 0.40 }, warn: true,
            lines: [{ en: 'Shoulders lift · Impingement risk',
                      es: 'Hombros se elevan · Riesgo de pinzamiento',
                      pt: 'Ombros sobem · Risco de impacto' }] }
        ],
        metrics: {
          dev: '± 4.0 cm',
          tuck: { en: 'Protracted',                es: 'Protraídas',                       pt: 'Protraídas' },
          load: { en: 'Anterior Delt Overload',    es: 'Sobrecarga del Deltoides Anterior', pt: 'Sobrecarga do Deltoide Anterior' },
          fn:   { en: 'Fault pattern · Shoulders roll off bench to assist press',
                  es: 'Patrón de falla · Los hombros se despegan del banco para asistir el empuje',
                  pt: 'Padrão de falha · Ombros desencostam do banco para auxiliar a pressão' }
        },
        haloAt: 'shoulder_l',
        keyframesOverride: [
          { t: 0.90, joints: { shoulder_l: { x: 0.35, y: 0.45 }, shoulder_r: { x: 0.35, y: 0.45 },
                               elbow_l: { x: 0.40, y: 0.25 }, wrist_l: { x: 0.35, y: 0.10 } } }
        ]
      }
    },

    metricLabels: {
      dev:  { en: 'Path Dev.',       es: 'Desv. Trayectoria',  pt: 'Desv. Trajetória' },
      tuck: { en: 'Scapular Anchor', es: 'Anclaje Escapular',  pt: 'Ancoragem Escapular' },
      load: { en: 'Joint Load',      es: 'Carga Articular',    pt: 'Carga Articular' }
    }
  };

  // ─── REGISTRATIONS ───────────────────────────────────────
  // Append new Blueprints to this array as they ship from the War Room.
  // Final batch milestone: hack_squats and barbell_bench_press clear
  // the legacy static 'hack squat' and 'bench press' entries via the
  // alias-conflict resolver. Library is now 100% V2 fully articulated.
  var BLUEPRINTS = [
    BARBELL_BACK_SQUAT,
    BICEPS_CURLS,
    ROMANIAN_DEADLIFT,
    LAT_PULLDOWNS,
    WALKING_LUNGES,
    TRICEPS_PUSHDOWNS,
    LATERAL_RAISES,
    DB_FLAT_BENCH_PRESS,
    HEAVY_LEG_PRESS,
    BULGARIAN_SPLIT_SQUATS,
    SEATED_CABLE_ROWS,
    FACE_PULLS,
    SEATED_DB_SHOULDER_PRESS,
    MACHINE_CHEST_FLYS,
    LEG_EXTENSIONS,
    HAMSTRING_CURLS,
    HAMMER_CURLS,
    INCLINE_DB_PRESS,
    SMITH_MACHINE_HIP_THRUSTS,
    SINGLE_ARM_DB_ROWS,
    SEATED_CALF_RAISES,
    CABLE_KICKBACKS,
    MACHINE_CHEST_PRESS,
    SEATED_MACHINE_ABDUCTION,
    CABLE_OVERHEAD_TRICEPS_EXTENSION,
    EZ_BAR_PREACHER_CURLS,
    MACHINE_CRUNCHES,
    GLUTE_BIAS_BACK_EXTENSIONS,
    SUPPORTED_KNEE_RAISES,
    PLANK,
    HACK_SQUATS,
    BARBELL_BENCH_PRESS
  ];

  BLUEPRINTS.forEach(function (bp) {
    var ok = BBF_KFH_CATALOG.registerBlueprint(bp);
    if (!ok) console.warn('[KFH_BLUEPRINTS] failed to register:', bp.id);
  });
})();
