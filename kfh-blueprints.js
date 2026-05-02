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

  // ─── REGISTRATIONS ───────────────────────────────────────
  // Append new Blueprints to this array as they ship from the War Room.
  var BLUEPRINTS = [
    BARBELL_BACK_SQUAT,
    BICEPS_CURLS
  ];

  BLUEPRINTS.forEach(function (bp) {
    var ok = BBF_KFH_CATALOG.registerBlueprint(bp);
    if (!ok) console.warn('[KFH_BLUEPRINTS] failed to register:', bp.id);
  });
})();
