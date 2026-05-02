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
    aliases: ['tricep pushdown', 'triceps pushdown', 'tricep pushdowns', 'triceps pushdowns', 'cable pushdowns'],

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
    aliases: ['heavy leg press', 'leg presses', 'machine leg press', '45-degree leg press', 'seated leg press', 'incline leg press'],

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

  // ─── REGISTRATIONS ───────────────────────────────────────
  // Append new Blueprints to this array as they ship from the War Room.
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
    FACE_PULLS
  ];

  BLUEPRINTS.forEach(function (bp) {
    var ok = BBF_KFH_CATALOG.registerBlueprint(bp);
    if (!ok) console.warn('[KFH_BLUEPRINTS] failed to register:', bp.id);
  });
})();
