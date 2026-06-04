// src/components/vault/prehabProtocol.js
// ─────────────────────────────────────────────────────────────────────────────
// Static catalog driving the Prehab Diagnostic Engine UI
// (feature/prehab-diagnostic-engine).
//
//   • PLANNER  — the three biomechanical range selectors. Each option carries a
//     clinical `status` (ok | warn) and a keyed `code` the report compiles from.
//   • PROTOCOL — the corrective movement deck for the selected region, with the
//     pill-chip metrics (sets / reps / duration) and cue directives.
//
// TRILINGUAL (Terminal India): the catalog now branches EN · ES · PT so the
// clinical copy — planner labels, diagnostic codes, protocol titles, and the
// execution cues — localizes with the active language. The structural ids
// (PLANNER[].id, option `value`, exercise `key`, `status`, `sets`) are
// LANGUAGE-INVARIANT so compileReport() resolves a selection identically in any
// language and the e2e testid hooks stay stable. EN strings are byte-for-byte
// the prior ground-truth.
//
// This is mock/static ground-truth for the UI; the per-athlete read path
// (bbf_get_client_prehab over bbf_prehab_catalog + bbf_client_prehab) is a
// backend follow-up — see e2e/tests/prehab.spec.ts (held contract).

const PREHAB_I18N = {
  en: {
    PLANNER: [
      {
        id: 'ankle',
        label: '1. Ankle Flexion Test (Toe to Wall)',
        default: 'moderate',
        options: [
          { value: 'optimal', label: 'Optimal (Knee passes 5"+ past toe)', status: 'ok',
            code: { title: 'Healthy Ankle Mobility', body: 'Talus bone glides cleanly. Range of motion supports deep athletic squats.' } },
          { value: 'moderate', label: 'Moderate (Knee touches wall 2–4")', status: 'ok',
            code: { title: 'Healthy Ankle Mobility', body: 'Talus bone glides cleanly. Range of motion supports deep athletic squats.' } },
          { value: 'restricted', label: 'Restricted (Knee cannot reach wall)', status: 'warn',
            code: { title: 'Limited Ankle Dorsiflexion', body: 'Talar glide is blocked — the knee cannot track over the toes. Add banded ankle distractions and calf soft-tissue work before loading squat depth.' } },
        ],
      },
      {
        id: 'squat',
        label: '2. Bottom Squat Pelvis Angle',
        default: 'valgus',
        options: [
          { value: 'neutral', label: 'Neutral (Pelvis stays stacked)', status: 'ok',
            code: { title: 'Stable Pelvic Control', body: 'Pelvis stays stacked under load. Deep hip flexion is well organized.' } },
          { value: 'valgus', label: 'Knees collapse inward (Poor abduction)', status: 'warn',
            code: { title: 'Glute Medius Inactivity (Knee Caves)', body: 'Adductors are pulling your femur inside. Slip an elastic loop above the knee cap and run lateral walks and Spanish squats to amass glute recruitment.' } },
          { value: 'butt_wink', label: 'Butt wink (Posterior pelvic tilt)', status: 'warn',
            code: { title: 'Lumbar Flexion Under Load (Butt Wink)', body: 'Pelvis tucks at depth, rounding the lumbar spine. Cap depth at neutral and drill 90/90 breathing for posterior tilt control.' } },
        ],
      },
      {
        id: 'overhead',
        label: '3. Overhead Bar Alignment Check',
        default: 'subacromial',
        options: [
          { value: 'clean', label: 'Clean (Bar stacks over mid-foot)', status: 'ok',
            code: { title: 'Healthy Overhead Stack', body: 'Humeral head centers cleanly. Scapular rhythm supports loaded pressing.' } },
          { value: 'subacromial', label: 'Subacromial Pinching (Humeral impingement)', status: 'warn',
            code: { title: 'Rotator Cuff Subacromial Impingement (Pinch)', body: 'Anterior humeral glide pinching. Perform the Elite Sleeper shoulder stretch and target high cable face pulls.' } },
          { value: 'rib_flare', label: 'Lumbar Compensation (Rib flare)', status: 'warn',
            code: { title: 'Thoracic Extension Compensation (Rib Flare)', body: 'Lats and lumbar are compensating for limited overhead reach. Drill bench thoracic extensions and tall-kneeling presses.' } },
        ],
      },
    ],
    REGIONS: [
      { id: 'lower_back', label: 'Lower Back' },
      { id: 'knee', label: 'Knee' },
      { id: 'shoulder', label: 'Shoulder' },
      { id: 'elbow', label: 'Elbow' },
      { id: 'wrist_hand', label: 'Wrist & Hand' },
    ],
    PROTOCOLS: {
      lower_back: {
        region: 'Lower Back',
        title: 'Spine Decompression & Pelvic Stabilization',
        quote:
          'In elite bodybuilding and powerlifting, deadlifts and squats place immense axial loads on the spine. This routine hydrates the lower lumbar intervertebral discs, co-activates deep lumbar stabilizers, and releases high-tension hip flexors that trigger anterior pelvic tilt shear stress.',
        exercises: [
          {
            key: 'mckenzie_press_up',
            name: 'McKenzie Lumbar Extension Press-ups',
            sets: 3,
            reps: '10 slow reps (5s pause at peak)',
            duration: '~4 min',
            desc: 'Keep your pelvic crest and hips completely flat on the floor. Exhale completely as you press up to fully decompress the lower back.',
            cues: [
              'Let your spine drape like a hammock',
              'Prevent shrugging your neck; push the shoulders away from chest',
              'Breathe deep into your lower belly at the top of the extension',
            ],
          },
          {
            key: 'bird_dog',
            name: 'Bird-Dog Extensions with Abdominal Bracing',
            sets: 3,
            reps: '10 reps each side (hold 2s)',
            duration: '~5 min',
            desc: 'Place a foam roller on your waist; it must remain perfectly level. Ensure no hyper-extension of the lower back.',
            cues: [
              'Drive out through the heel instead of kicking up high',
              'Brace your abs as if prepping for a heavy punch',
              'Form a straight steel rod line from your fingertips to your opposing heel',
            ],
          },
          {
            key: 'dead_bug',
            name: 'Dead Bug Anti-Extension Hold',
            sets: 3,
            reps: '8 reps each side',
            duration: '~4 min',
            desc: 'Press your lower back flat into the floor and extend the opposite arm and leg without letting the ribs flare off the deck.',
            cues: [
              'Exhale hard as the limbs reach to lock the ribcage down',
              'Move slow — no momentum from the hips',
              'Keep both shoulder blades pinned to the floor',
            ],
          },
        ],
      },
      knee: {
        region: 'Knee',
        title: 'Patellar Tracking & Knee Stabilization',
        quote:
          'Heavy squats and split-squats drive patellofemoral compression. This block restores VMO tone, glute-medius control of the femur, and posterior-chain support so the kneecap tracks clean through depth.',
        exercises: [
          {
            key: 'tempo_goblet_squat',
            name: 'Tempo Goblet Squat (4s Descent)',
            sets: 3,
            reps: '8 reps (4s down)',
            duration: '~5 min',
            desc: 'Sit straight down between the hips with a slow eccentric, keeping the knees tracking over the second toe.',
            cues: [
              'Drive the knees out — never let them cave inward',
              'Stay tall through the sternum, ribs stacked',
            ],
          },
          {
            key: 'terminal_knee_ext',
            name: 'Terminal Knee Extension (VMO Bias)',
            sets: 3,
            reps: '15 reps (2s hold at lockout)',
            duration: '~4 min',
            desc: 'Squeeze the teardrop quad hard at full lockout to re-pattern the VMO that stabilizes the kneecap.',
            cues: [
              'Pause and contract hard at the top',
              'Slow and controlled — no swinging the load',
            ],
          },
          {
            key: 'glute_bridge',
            name: 'Glute Bridge (Posterior Support)',
            sets: 3,
            reps: '12 reps (2s squeeze)',
            duration: '~4 min',
            desc: 'Build the posterior chain that offloads the front of the knee; finish each rep with a hard glute lock-out.',
            cues: [
              'Push through the heels, not the toes',
              'Lock the glutes — do not hyperextend the lower back',
            ],
          },
        ],
      },
      shoulder: {
        region: 'Shoulder',
        title: 'Rotator Cuff & Scapular Decompression',
        quote:
          'Pressing volume crowds the subacromial space and drags the humeral head forward. This block restores posterior-cuff tone, scapular rhythm, and the external-rotation strength that re-centers the joint.',
        exercises: [
          {
            key: 'cable_face_pull',
            name: 'Cable Face Pull (External Rotation)',
            sets: 3,
            reps: '15 reps (1s hold)',
            duration: '~4 min',
            desc: 'Pull to the forehead and rotate the knuckles up to bias the posterior cuff and lower traps.',
            cues: [
              'Lead with the elbows, high and wide',
              'Pinch the shoulder blades — pause at the back',
            ],
          },
          {
            key: 'band_pull_apart',
            name: 'Band Pull-Apart',
            sets: 3,
            reps: '20 reps',
            duration: '~3 min',
            desc: 'Re-balance the upper back against pressing dominance; keep the reps strict and slow.',
            cues: [
              'Squeeze the blades together at full stretch',
              'Keep the ribs down — no shrug',
            ],
          },
          {
            key: 'scap_lateral_raise',
            name: 'Scapular-Plane Lateral Raise (Light)',
            sets: 3,
            reps: '15 reps',
            duration: '~3 min',
            desc: 'Raise in the scapular plane (about 30° forward) with light load to groom clean overhead mechanics.',
            cues: [
              'Lead with the elbow, thumb slightly up',
              'Stop at shoulder height — no higher under pinch',
            ],
          },
        ],
      },
      elbow: {
        region: 'Elbow',
        title: 'Tendon Resilience & Forearm Loading',
        quote:
          'Curls, pulls, and pressing tax the common flexor and extensor tendons. Heavy slow eccentrics remodel the tendon and build the forearm capacity that protects the elbow under load.',
        exercises: [
          {
            key: 'eccentric_hammer_curl',
            name: 'Eccentric Hammer Curl (4s Lower)',
            sets: 3,
            reps: '8 reps (4s down)',
            duration: '~4 min',
            desc: 'Load the brachioradialis with a heavy, slow lower to remodel the lateral elbow tendon.',
            cues: [
              'Lower under control for a full four-count',
              'Keep the elbow pinned to the ribs',
            ],
          },
          {
            key: 'triceps_pushdown_ecc',
            name: 'Triceps Pushdown (Slow Eccentric)',
            sets: 3,
            reps: '12 reps (3s up)',
            duration: '~4 min',
            desc: 'Resist the return to load the triceps tendon without sharp end-range stress.',
            cues: [
              'Fight the cable on the way back up',
              'Keep the wrists neutral, elbows quiet',
            ],
          },
          {
            key: 'bench_dip_controlled',
            name: 'Controlled Bench Dip',
            sets: 3,
            reps: '10 reps',
            duration: '~4 min',
            desc: 'Build triceps and elbow capacity through a controlled, pain-free range; never sink past comfort.',
            cues: [
              'Stop above any pinch in the joint',
              'Keep the shoulders down, away from the ears',
            ],
          },
        ],
      },
      wrist_hand: {
        region: 'Wrist & Hand',
        title: 'Wrist Mobility & Grip Integrity',
        quote:
          'Pressing, the front rack, and pulling all funnel load through the wrist and hand. This block builds extensor balance, weight-bearing tolerance, and grip integrity so the joint stays pain-free under the bar.',
        exercises: [
          {
            key: 'reverse_wrist_curl',
            name: 'Reverse Wrist Curl (Extensors)',
            sets: 3,
            reps: '15 reps (2s lower)',
            duration: '~3 min',
            desc: 'Strengthen the wrist extensors that balance grip-dominant training; keep the motion small and strict.',
            cues: [
              'Anchor the forearm on the thigh',
              'Lower slowly — no momentum',
            ],
          },
          {
            key: 'wrist_extension_load',
            name: 'Weight-Bearing Wrist Rocks',
            sets: 3,
            reps: '10 rocks (2s hold)',
            duration: '~3 min',
            desc: 'On hands and knees, rock gently over loaded palms to build the wrist-extension tolerance pressing demands.',
            cues: [
              'Spread the fingers and grip the floor',
              'Move only as far as stays pain-free',
            ],
          },
          {
            key: 'dead_hang',
            name: 'Dead Hang Decompression',
            sets: 3,
            reps: '3 × 30s hang',
            duration: '~4 min',
            desc: 'Hang from a bar to decompress the wrist and elbow and rebuild fail-safe grip endurance.',
            cues: [
              'Active shoulders — pull the blades down',
              'Breathe and build the hang time gradually',
            ],
          },
        ],
      },
    },
  },

  es: {
    PLANNER: [
      {
        id: 'ankle',
        label: '1. Test de Flexión de Tobillo (Dedo a la Pared)',
        default: 'moderate',
        options: [
          { value: 'optimal', label: 'Óptimo (La rodilla pasa 5"+ del dedo)', status: 'ok',
            code: { title: 'Movilidad de Tobillo Saludable', body: 'El astrágalo se desliza limpiamente. El rango de movimiento permite sentadillas atléticas profundas.' } },
          { value: 'moderate', label: 'Moderado (La rodilla toca la pared 2–4")', status: 'ok',
            code: { title: 'Movilidad de Tobillo Saludable', body: 'El astrágalo se desliza limpiamente. El rango de movimiento permite sentadillas atléticas profundas.' } },
          { value: 'restricted', label: 'Restringido (La rodilla no alcanza la pared)', status: 'warn',
            code: { title: 'Dorsiflexión de Tobillo Limitada', body: 'El deslizamiento talar está bloqueado — la rodilla no puede avanzar sobre los dedos. Añade distracciones de tobillo con banda y trabajo de tejido blando en la pantorrilla antes de cargar profundidad de sentadilla.' } },
        ],
      },
      {
        id: 'squat',
        label: '2. Ángulo de la Pelvis en el Fondo de la Sentadilla',
        default: 'valgus',
        options: [
          { value: 'neutral', label: 'Neutral (La pelvis se mantiene alineada)', status: 'ok',
            code: { title: 'Control Pélvico Estable', body: 'La pelvis se mantiene alineada bajo carga. La flexión profunda de cadera está bien organizada.' } },
          { value: 'valgus', label: 'Las rodillas colapsan hacia adentro (Mala abducción)', status: 'warn',
            code: { title: 'Inactividad del Glúteo Medio (Rodillas Hacia Adentro)', body: 'Los aductores jalan tu fémur hacia adentro. Coloca una banda elástica sobre la rótula y realiza caminatas laterales y sentadillas españolas para acumular reclutamiento del glúteo.' } },
          { value: 'butt_wink', label: 'Retroversión pélvica (Inclinación pélvica posterior)', status: 'warn',
            code: { title: 'Flexión Lumbar Bajo Carga (Retroversión)', body: 'La pelvis se mete en la profundidad, redondeando la columna lumbar. Limita la profundidad en neutral y entrena la respiración 90/90 para controlar la inclinación posterior.' } },
        ],
      },
      {
        id: 'overhead',
        label: '3. Chequeo de Alineación de la Barra sobre la Cabeza',
        default: 'subacromial',
        options: [
          { value: 'clean', label: 'Limpio (La barra se alinea sobre el medio del pie)', status: 'ok',
            code: { title: 'Alineación Saludable sobre la Cabeza', body: 'La cabeza humeral se centra limpiamente. El ritmo escapular permite el press con carga.' } },
          { value: 'subacromial', label: 'Pinzamiento Subacromial (Pinzamiento humeral)', status: 'warn',
            code: { title: 'Pinzamiento Subacromial del Manguito Rotador', body: 'Deslizamiento humeral anterior con pinzamiento. Realiza el estiramiento de hombro "Sleeper" y enfócate en face pulls altos con cable.' } },
          { value: 'rib_flare', label: 'Compensación Lumbar (Apertura costal)', status: 'warn',
            code: { title: 'Compensación de Extensión Torácica (Apertura Costal)', body: 'Los dorsales y la zona lumbar compensan el alcance limitado sobre la cabeza. Entrena extensiones torácicas en banco y press de rodillas erguido.' } },
        ],
      },
    ],
    REGIONS: [
      { id: 'lower_back', label: 'Zona Lumbar' },
      { id: 'knee', label: 'Rodilla' },
      { id: 'shoulder', label: 'Hombro' },
      { id: 'elbow', label: 'Codo' },
      { id: 'wrist_hand', label: 'Muñeca y Mano' },
    ],
    PROTOCOLS: {
      lower_back: {
        region: 'Zona Lumbar',
        title: 'Descompresión de la Columna y Estabilización Pélvica',
        quote:
          'En el culturismo y el powerlifting de élite, los pesos muertos y las sentadillas imponen cargas axiales inmensas sobre la columna. Esta rutina hidrata los discos intervertebrales lumbares bajos, coactiva los estabilizadores lumbares profundos y libera los flexores de cadera de alta tensión que provocan estrés de cizallamiento por anteversión pélvica.',
        exercises: [
          {
            key: 'mckenzie_press_up',
            name: 'Press-ups de Extensión Lumbar McKenzie',
            sets: 3,
            reps: '10 reps lentas (pausa de 5s en el pico)',
            duration: '~4 min',
            desc: 'Mantén la cresta pélvica y las caderas completamente planas en el suelo. Exhala por completo al empujar hacia arriba para descomprimir totalmente la zona lumbar.',
            cues: [
              'Deja que tu columna cuelgue como una hamaca',
              'Evita encoger el cuello; aleja los hombros del pecho',
              'Respira profundo hacia el bajo vientre en la cima de la extensión',
            ],
          },
          {
            key: 'bird_dog',
            name: 'Extensiones Bird-Dog con Tensión Abdominal',
            sets: 3,
            reps: '10 reps por lado (mantén 2s)',
            duration: '~5 min',
            desc: 'Coloca un rodillo de espuma en tu cintura; debe permanecer perfectamente nivelado. Asegúrate de no hiperextender la zona lumbar.',
            cues: [
              'Empuja hacia afuera por el talón en lugar de patear alto',
              'Tensa los abdominales como si te prepararas para un golpe fuerte',
              'Forma una línea recta de acero desde la punta de los dedos hasta el talón opuesto',
            ],
          },
          {
            key: 'dead_bug',
            name: 'Dead Bug con Sostén Anti-Extensión',
            sets: 3,
            reps: '8 reps por lado',
            duration: '~4 min',
            desc: 'Presiona la zona lumbar plana contra el suelo y extiende el brazo y la pierna opuestos sin dejar que las costillas se abran del piso.',
            cues: [
              'Exhala con fuerza al extender las extremidades para fijar la caja torácica',
              'Muévete lento — sin impulso desde las caderas',
              'Mantén ambas escápulas fijas al suelo',
            ],
          },
        ],
      },
      knee: {
        region: 'Rodilla',
        title: 'Seguimiento Rotuliano y Estabilización de Rodilla',
        quote:
          'Las sentadillas y sentadillas búlgaras pesadas generan compresión patelofemoral. Este bloque restaura el tono del vasto medial (VMO), el control del fémur por el glúteo medio y el soporte de la cadena posterior para que la rótula se deslice limpia en profundidad.',
        exercises: [
          {
            key: 'tempo_goblet_squat',
            name: 'Sentadilla Goblet con Tempo (Descenso 4s)',
            sets: 3,
            reps: '8 reps (4s bajando)',
            duration: '~5 min',
            desc: 'Siéntate recto entre las caderas con un excéntrico lento, manteniendo las rodillas alineadas sobre el segundo dedo.',
            cues: [
              'Empuja las rodillas hacia afuera — nunca dejes que colapsen',
              'Mantente erguido por el esternón, costillas alineadas',
            ],
          },
          {
            key: 'terminal_knee_ext',
            name: 'Extensión Terminal de Rodilla (Énfasis VMO)',
            sets: 3,
            reps: '15 reps (2s de sostén en el bloqueo)',
            duration: '~4 min',
            desc: 'Aprieta fuerte el cuádriceps en el bloqueo completo para reactivar el VMO que estabiliza la rótula.',
            cues: [
              'Pausa y contrae fuerte arriba',
              'Lento y controlado — sin balancear la carga',
            ],
          },
          {
            key: 'glute_bridge',
            name: 'Puente de Glúteos (Soporte Posterior)',
            sets: 3,
            reps: '12 reps (2s de apriete)',
            duration: '~4 min',
            desc: 'Construye la cadena posterior que descarga la parte frontal de la rodilla; termina cada rep con un bloqueo firme de glúteos.',
            cues: [
              'Empuja por los talones, no por los dedos',
              'Bloquea los glúteos — no hiperextiendas la zona lumbar',
            ],
          },
        ],
      },
      shoulder: {
        region: 'Hombro',
        title: 'Manguito Rotador y Descompresión Escapular',
        quote:
          'El volumen de press abarrota el espacio subacromial y arrastra la cabeza humeral hacia adelante. Este bloque restaura el tono del manguito posterior, el ritmo escapular y la fuerza de rotación externa que recentra la articulación.',
        exercises: [
          {
            key: 'cable_face_pull',
            name: 'Face Pull en Cable (Rotación Externa)',
            sets: 3,
            reps: '15 reps (1s de sostén)',
            duration: '~4 min',
            desc: 'Tira hacia la frente y rota los nudillos hacia arriba para enfatizar el manguito posterior y el trapecio inferior.',
            cues: [
              'Lidera con los codos, altos y abiertos',
              'Junta las escápulas — pausa atrás',
            ],
          },
          {
            key: 'band_pull_apart',
            name: 'Apertura con Banda (Pull-Apart)',
            sets: 3,
            reps: '20 reps',
            duration: '~3 min',
            desc: 'Reequilibra la espalda alta frente al dominio del press; mantén las reps estrictas y lentas.',
            cues: [
              'Junta las escápulas en el estiramiento completo',
              'Mantén las costillas abajo — sin encoger',
            ],
          },
          {
            key: 'scap_lateral_raise',
            name: 'Elevación Lateral en Plano Escapular (Ligera)',
            sets: 3,
            reps: '15 reps',
            duration: '~3 min',
            desc: 'Eleva en el plano escapular (unos 30° adelante) con carga ligera para pulir la mecánica sobre la cabeza.',
            cues: [
              'Lidera con el codo, pulgar ligeramente arriba',
              'Detente a la altura del hombro — no más bajo pinzamiento',
            ],
          },
        ],
      },
      elbow: {
        region: 'Codo',
        title: 'Resiliencia Tendinosa y Carga del Antebrazo',
        quote:
          'Curls, jalones y press cargan los tendones flexor y extensor comunes. Los excéntricos pesados y lentos remodelan el tendón y construyen la capacidad del antebrazo que protege el codo bajo carga.',
        exercises: [
          {
            key: 'eccentric_hammer_curl',
            name: 'Curl Martillo Excéntrico (Bajada 4s)',
            sets: 3,
            reps: '8 reps (4s bajando)',
            duration: '~4 min',
            desc: 'Carga el braquiorradial con una bajada pesada y lenta para remodelar el tendón lateral del codo.',
            cues: [
              'Baja bajo control durante un conteo completo de cuatro',
              'Mantén el codo pegado a las costillas',
            ],
          },
          {
            key: 'triceps_pushdown_ecc',
            name: 'Pushdown de Tríceps (Excéntrico Lento)',
            sets: 3,
            reps: '12 reps (3s subiendo)',
            duration: '~4 min',
            desc: 'Resiste el retorno para cargar el tendón del tríceps sin estrés agudo en el rango final.',
            cues: [
              'Pelea contra el cable al subir',
              'Mantén las muñecas neutras, codos quietos',
            ],
          },
          {
            key: 'bench_dip_controlled',
            name: 'Fondo en Banco Controlado',
            sets: 3,
            reps: '10 reps',
            duration: '~4 min',
            desc: 'Construye capacidad de tríceps y codo en un rango controlado y sin dolor; nunca bajes más allá de lo cómodo.',
            cues: [
              'Detente antes de cualquier pinzamiento en la articulación',
              'Mantén los hombros abajo, lejos de las orejas',
            ],
          },
        ],
      },
      wrist_hand: {
        region: 'Muñeca y Mano',
        title: 'Movilidad de Muñeca e Integridad del Agarre',
        quote:
          'El press, el front rack y los jalones canalizan la carga a través de la muñeca y la mano. Este bloque construye equilibrio de extensores, tolerancia al peso y un agarre íntegro para que la articulación se mantenga sin dolor bajo la barra.',
        exercises: [
          {
            key: 'reverse_wrist_curl',
            name: 'Curl Inverso de Muñeca (Extensores)',
            sets: 3,
            reps: '15 reps (2s bajando)',
            duration: '~3 min',
            desc: 'Fortalece los extensores de la muñeca que equilibran el entrenamiento dominado por el agarre; mantén el movimiento pequeño y estricto.',
            cues: [
              'Ancla el antebrazo sobre el muslo',
              'Baja lento — sin impulso',
            ],
          },
          {
            key: 'wrist_extension_load',
            name: 'Balanceos de Muñeca con Carga',
            sets: 3,
            reps: '10 balanceos (2s de sostén)',
            duration: '~3 min',
            desc: 'En cuadrupedia, balancéate suavemente sobre las palmas cargadas para construir la tolerancia a la extensión de muñeca que exige el press.',
            cues: [
              'Extiende los dedos y agarra el suelo',
              'Avanza solo hasta donde no haya dolor',
            ],
          },
          {
            key: 'dead_hang',
            name: 'Suspensión de Descompresión (Dead Hang)',
            sets: 3,
            reps: '3 × 30s colgado',
            duration: '~4 min',
            desc: 'Cuélgate de una barra para descomprimir la muñeca y el codo y reconstruir resistencia de agarre a prueba de fallos.',
            cues: [
              'Hombros activos — baja las escápulas',
              'Respira y aumenta el tiempo de colgado gradualmente',
            ],
          },
        ],
      },
    },
  },

  pt: {
    PLANNER: [
      {
        id: 'ankle',
        label: '1. Teste de Flexão do Tornozelo (Dedo à Parede)',
        default: 'moderate',
        options: [
          { value: 'optimal', label: 'Ótimo (O joelho passa 5"+ do dedo)', status: 'ok',
            code: { title: 'Mobilidade de Tornozelo Saudável', body: 'O tálus desliza livremente. A amplitude de movimento permite agachamentos atléticos profundos.' } },
          { value: 'moderate', label: 'Moderado (O joelho toca a parede 2–4")', status: 'ok',
            code: { title: 'Mobilidade de Tornozelo Saudável', body: 'O tálus desliza livremente. A amplitude de movimento permite agachamentos atléticos profundos.' } },
          { value: 'restricted', label: 'Restrito (O joelho não alcança a parede)', status: 'warn',
            code: { title: 'Dorsiflexão de Tornozelo Limitada', body: 'O deslizamento talar está bloqueado — o joelho não avança sobre os dedos. Adicione distrações de tornozelo com elástico e trabalho de tecidos moles da panturrilha antes de carregar a profundidade do agachamento.' } },
        ],
      },
      {
        id: 'squat',
        label: '2. Ângulo da Pelve no Fundo do Agachamento',
        default: 'valgus',
        options: [
          { value: 'neutral', label: 'Neutro (A pelve permanece alinhada)', status: 'ok',
            code: { title: 'Controle Pélvico Estável', body: 'A pelve permanece alinhada sob carga. A flexão profunda do quadril está bem organizada.' } },
          { value: 'valgus', label: 'Os joelhos colapsam para dentro (Má abdução)', status: 'warn',
            code: { title: 'Inatividade do Glúteo Médio (Joelhos Para Dentro)', body: 'Os adutores puxam seu fêmur para dentro. Coloque um elástico acima da rótula e faça caminhadas laterais e agachamentos espanhóis para acumular recrutamento do glúteo.' } },
          { value: 'butt_wink', label: 'Báscula posterior (Inclinação pélvica posterior)', status: 'warn',
            code: { title: 'Flexão Lombar Sob Carga (Báscula Posterior)', body: 'A pelve se retrai na profundidade, arredondando a coluna lombar. Limite a profundidade no neutro e treine a respiração 90/90 para controlar a báscula posterior.' } },
        ],
      },
      {
        id: 'overhead',
        label: '3. Verificação de Alinhamento da Barra acima da Cabeça',
        default: 'subacromial',
        options: [
          { value: 'clean', label: 'Limpo (A barra alinha sobre o meio do pé)', status: 'ok',
            code: { title: 'Alinhamento Saudável acima da Cabeça', body: 'A cabeça do úmero centraliza-se livremente. O ritmo escapular permite o desenvolvimento com carga.' } },
          { value: 'subacromial', label: 'Pinçamento Subacromial (Impacto umeral)', status: 'warn',
            code: { title: 'Impacto Subacromial do Manguito Rotador', body: 'Deslizamento umeral anterior com pinçamento. Faça o alongamento de ombro "Sleeper" e foque em face pulls altos no cabo.' } },
          { value: 'rib_flare', label: 'Compensação Lombar (Abertura costal)', status: 'warn',
            code: { title: 'Compensação de Extensão Torácica (Abertura Costal)', body: 'Os dorsais e a lombar compensam o alcance limitado acima da cabeça. Treine extensões torácicas no banco e desenvolvimento ajoelhado ereto.' } },
        ],
      },
    ],
    REGIONS: [
      { id: 'lower_back', label: 'Região Lombar' },
      { id: 'knee', label: 'Joelho' },
      { id: 'shoulder', label: 'Ombro' },
      { id: 'elbow', label: 'Cotovelo' },
      { id: 'wrist_hand', label: 'Punho e Mão' },
    ],
    PROTOCOLS: {
      lower_back: {
        region: 'Região Lombar',
        title: 'Descompressão da Coluna e Estabilização Pélvica',
        quote:
          'No fisiculturismo e no powerlifting de elite, levantamentos terra e agachamentos impõem cargas axiais imensas sobre a coluna. Esta rotina hidrata os discos intervertebrais lombares baixos, coativa os estabilizadores lombares profundos e libera os flexores de quadril de alta tensão que provocam estresse de cisalhamento por anteversão pélvica.',
        exercises: [
          {
            key: 'mckenzie_press_up',
            name: 'Press-ups de Extensão Lombar McKenzie',
            sets: 3,
            reps: '10 reps lentas (pausa de 5s no pico)',
            duration: '~4 min',
            desc: 'Mantenha a crista pélvica e os quadris completamente apoiados no chão. Expire completamente ao empurrar para cima para descomprimir totalmente a região lombar.',
            cues: [
              'Deixe sua coluna pender como uma rede',
              'Evite encolher o pescoço; afaste os ombros do peito',
              'Respire fundo em direção ao baixo ventre no topo da extensão',
            ],
          },
          {
            key: 'bird_dog',
            name: 'Extensões Bird-Dog com Estabilização Abdominal',
            sets: 3,
            reps: '10 reps de cada lado (segure 2s)',
            duration: '~5 min',
            desc: 'Coloque um rolo de espuma na cintura; ele deve permanecer perfeitamente nivelado. Garanta que não haja hiperextensão da região lombar.',
            cues: [
              'Empurre para fora pelo calcanhar em vez de chutar para o alto',
              'Contraia o abdômen como se preparasse para um soco forte',
              'Forme uma linha reta de aço da ponta dos dedos até o calcanhar oposto',
            ],
          },
          {
            key: 'dead_bug',
            name: 'Dead Bug com Sustentação Anti-Extensão',
            sets: 3,
            reps: '8 reps de cada lado',
            duration: '~4 min',
            desc: 'Pressione a região lombar plana contra o chão e estenda o braço e a perna opostos sem deixar as costelas abrirem do solo.',
            cues: [
              'Expire com força ao estender os membros para travar a caixa torácica',
              'Mova-se devagar — sem impulso vindo dos quadris',
              'Mantenha ambas as escápulas fixas no chão',
            ],
          },
        ],
      },
      knee: {
        region: 'Joelho',
        title: 'Rastreamento Patelar e Estabilização do Joelho',
        quote:
          'Agachamentos e agachamentos búlgaros pesados geram compressão patelofemoral. Este bloco restaura o tônus do vasto medial (VMO), o controle do fêmur pelo glúteo médio e o suporte da cadeia posterior para que a patela deslize limpa em profundidade.',
        exercises: [
          {
            key: 'tempo_goblet_squat',
            name: 'Agachamento Goblet com Tempo (Descida 4s)',
            sets: 3,
            reps: '8 reps (4s descendo)',
            duration: '~5 min',
            desc: 'Sente-se reto entre os quadris com um excêntrico lento, mantendo os joelhos alinhados sobre o segundo dedo.',
            cues: [
              'Empurre os joelhos para fora — nunca deixe colapsarem',
              'Mantenha-se ereto pelo esterno, costelas alinhadas',
            ],
          },
          {
            key: 'terminal_knee_ext',
            name: 'Extensão Terminal do Joelho (Ênfase VMO)',
            sets: 3,
            reps: '15 reps (2s de sustentação no bloqueio)',
            duration: '~4 min',
            desc: 'Contraia forte o quadríceps no bloqueio completo para reativar o VMO que estabiliza a patela.',
            cues: [
              'Pause e contraia forte no topo',
              'Lento e controlado — sem balançar a carga',
            ],
          },
          {
            key: 'glute_bridge',
            name: 'Ponte de Glúteos (Suporte Posterior)',
            sets: 3,
            reps: '12 reps (2s de contração)',
            duration: '~4 min',
            desc: 'Construa a cadeia posterior que alivia a frente do joelho; finalize cada rep com um bloqueio firme dos glúteos.',
            cues: [
              'Empurre pelos calcanhares, não pelos dedos',
              'Bloqueie os glúteos — não hiperestenda a lombar',
            ],
          },
        ],
      },
      shoulder: {
        region: 'Ombro',
        title: 'Manguito Rotador e Descompressão Escapular',
        quote:
          'O volume de desenvolvimento aperta o espaço subacromial e puxa a cabeça do úmero para frente. Este bloco restaura o tônus do manguito posterior, o ritmo escapular e a força de rotação externa que recentra a articulação.',
        exercises: [
          {
            key: 'cable_face_pull',
            name: 'Face Pull no Cabo (Rotação Externa)',
            sets: 3,
            reps: '15 reps (1s de sustentação)',
            duration: '~4 min',
            desc: 'Puxe em direção à testa e gire os nós dos dedos para cima para enfatizar o manguito posterior e o trapézio inferior.',
            cues: [
              'Conduza com os cotovelos, altos e abertos',
              'Junte as escápulas — pause atrás',
            ],
          },
          {
            key: 'band_pull_apart',
            name: 'Abertura com Elástico (Pull-Apart)',
            sets: 3,
            reps: '20 reps',
            duration: '~3 min',
            desc: 'Reequilibre a parte superior das costas contra o domínio do desenvolvimento; mantenha as reps estritas e lentas.',
            cues: [
              'Junte as escápulas no alongamento completo',
              'Mantenha as costelas baixas — sem encolher',
            ],
          },
          {
            key: 'scap_lateral_raise',
            name: 'Elevação Lateral no Plano Escapular (Leve)',
            sets: 3,
            reps: '15 reps',
            duration: '~3 min',
            desc: 'Eleve no plano escapular (cerca de 30° à frente) com carga leve para refinar a mecânica acima da cabeça.',
            cues: [
              'Conduza com o cotovelo, polegar levemente para cima',
              'Pare na altura do ombro — não mais sob pinçamento',
            ],
          },
        ],
      },
      elbow: {
        region: 'Cotovelo',
        title: 'Resiliência Tendínea e Carga do Antebraço',
        quote:
          'Roscas, puxadas e desenvolvimento sobrecarregam os tendões flexor e extensor comuns. Excêntricos pesados e lentos remodelam o tendão e constroem a capacidade do antebraço que protege o cotovelo sob carga.',
        exercises: [
          {
            key: 'eccentric_hammer_curl',
            name: 'Rosca Martelo Excêntrica (Descida 4s)',
            sets: 3,
            reps: '8 reps (4s descendo)',
            duration: '~4 min',
            desc: 'Carregue o braquiorradial com uma descida pesada e lenta para remodelar o tendão lateral do cotovelo.',
            cues: [
              'Desça sob controle por uma contagem completa de quatro',
              'Mantenha o cotovelo colado às costelas',
            ],
          },
          {
            key: 'triceps_pushdown_ecc',
            name: 'Pushdown de Tríceps (Excêntrico Lento)',
            sets: 3,
            reps: '12 reps (3s subindo)',
            duration: '~4 min',
            desc: 'Resista ao retorno para carregar o tendão do tríceps sem estresse agudo na amplitude final.',
            cues: [
              'Lute contra o cabo na subida',
              'Mantenha os punhos neutros, cotovelos quietos',
            ],
          },
          {
            key: 'bench_dip_controlled',
            name: 'Mergulho no Banco Controlado',
            sets: 3,
            reps: '10 reps',
            duration: '~4 min',
            desc: 'Construa capacidade de tríceps e cotovelo numa amplitude controlada e sem dor; nunca desça além do confortável.',
            cues: [
              'Pare antes de qualquer pinçamento na articulação',
              'Mantenha os ombros baixos, longe das orelhas',
            ],
          },
        ],
      },
      wrist_hand: {
        region: 'Punho e Mão',
        title: 'Mobilidade do Punho e Integridade da Pegada',
        quote:
          'O desenvolvimento, o front rack e as puxadas canalizam carga através do punho e da mão. Este bloco constrói equilíbrio dos extensores, tolerância ao peso e uma pegada íntegra para que a articulação permaneça sem dor sob a barra.',
        exercises: [
          {
            key: 'reverse_wrist_curl',
            name: 'Rosca Inversa de Punho (Extensores)',
            sets: 3,
            reps: '15 reps (2s descendo)',
            duration: '~3 min',
            desc: 'Fortaleça os extensores do punho que equilibram o treino dominado pela pegada; mantenha o movimento pequeno e estrito.',
            cues: [
              'Apoie o antebraço sobre a coxa',
              'Desça devagar — sem impulso',
            ],
          },
          {
            key: 'wrist_extension_load',
            name: 'Balanços de Punho com Carga',
            sets: 3,
            reps: '10 balanços (2s de sustentação)',
            duration: '~3 min',
            desc: 'Em quatro apoios, balance suavemente sobre as palmas carregadas para construir a tolerância à extensão do punho que o desenvolvimento exige.',
            cues: [
              'Abra os dedos e agarre o chão',
              'Avance apenas até onde não houver dor',
            ],
          },
          {
            key: 'dead_hang',
            name: 'Suspensão de Descompressão (Dead Hang)',
            sets: 3,
            reps: '3 × 30s suspenso',
            duration: '~4 min',
            desc: 'Pendure-se numa barra para descomprimir o punho e o cotovelo e reconstruir resistência de pegada à prova de falhas.',
            cues: [
              'Ombros ativos — abaixe as escápulas',
              'Respire e aumente o tempo de suspensão gradualmente',
            ],
          },
        ],
      },
    },
  },
};

// Active-language catalog. Falls back to EN for any unknown code. Each language
// block carries PLANNER, REGIONS (the friction-area selector), and PROTOCOLS
// (the corrective deck per region id).
export function getPrehabCatalog(lang) {
  return PREHAB_I18N[lang] || PREHAB_I18N.en;
}

// Back-compat named exports (EN ground-truth). The live UI uses getPrehabCatalog(lang).
export const PLANNER = PREHAB_I18N.en.PLANNER;
export const PROTOCOLS = PREHAB_I18N.en.PROTOCOLS;

// Friction-area selector glyphs (language-invariant).
export const REGION_ICONS = {
  lower_back: '🦴',
  knee: '🦵',
  shoulder: '💪',
  elbow: '🦾',
  wrist_hand: '✋',
};

// Per-exercise form-demo videos (language-invariant). Real, curated YouTube ids
// reused from the authorized exerciseVideos.VIDEO_MAP so every card plays a working
// demonstration. A few prehab-specific movements map to the closest curated clip
// until dedicated footage is filmed; Prehab.jsx falls back to resolveVideoId(name)
// for any key absent here.
export const EX_VIDEO = {
  // Lower Back
  mckenzie_press_up: 'gLT-WLH84B4', // prone spinal extension (Back Extension)
  bird_dog: 'ZdAHe9_HeEw',
  dead_bug: 'bxn9FBrt4-A',
  // Knee
  tempo_goblet_squat: 'BR4tlEE_A98',
  terminal_knee_ext: 'tTbJBUKnWU8', // Leg Extension (VMO bias)
  glute_bridge: '8bbE64NuDTU',
  // Shoulder
  cable_face_pull: 'ljgqer1ZpXg',
  band_pull_apart: 'smSSXITNpCI',
  scap_lateral_raise: '4hTUCDUQaNA', // Dumbbell Lateral Raise
  // Elbow
  eccentric_hammer_curl: 'TwD-YGVP4Bk', // Hammer Curl
  triceps_pushdown_ecc: '_w-HpW70nSQ', // Cable Triceps Pushdown
  bench_dip_controlled: '0326dy_-CzM', // Bench Dip
  // Wrist & Hand (closest curated demos)
  reverse_wrist_curl: 'TwD-YGVP4Bk', // forearm loading (Hammer Curl)
  wrist_extension_load: 'mwlp75MS6Rg', // weight-bearing through the wrists (Front Plank)
  dead_hang: 'rmdn5X_KLkY', // bar hang / grip (Pull-Up)
};

// Compile the diagnostic report lines from the three selections, in `lang`. The
// `selections` map keys on the language-invariant PLANNER ids + option values,
// so a selection resolves identically across languages — only the rendered
// title/body localize.
export function compileReport(selections, lang) {
  const planner = (PREHAB_I18N[lang] || PREHAB_I18N.en).PLANNER;
  return planner.map((q) => {
    const opt = q.options.find((o) => o.value === selections[q.id]) || q.options[0];
    return { status: opt.status, title: opt.code.title, body: opt.code.body };
  });
}
