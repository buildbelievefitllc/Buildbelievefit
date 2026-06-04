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
    PROTOCOL: {
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
    PROTOCOL: {
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
    PROTOCOL: {
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
  },
};

// Active-language catalog. Falls back to EN for any unknown code.
export function getPrehabCatalog(lang) {
  return PREHAB_I18N[lang] || PREHAB_I18N.en;
}

// Back-compat named exports (EN ground-truth) for any importer that doesn't yet
// pass a language. The live UI uses getPrehabCatalog(lang).
export const PLANNER = PREHAB_I18N.en.PLANNER;
export const PROTOCOL = PREHAB_I18N.en.PROTOCOL;

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
