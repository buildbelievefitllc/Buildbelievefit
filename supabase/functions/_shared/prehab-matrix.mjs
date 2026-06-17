// supabase/functions/_shared/prehab-matrix.mjs
// ─────────────────────────────────────────────────────────────────────────────
// BBF Deterministic Prehab Matrix — Phase: calculator-off-LLM, wave 1.
// PURE RULES, ZERO AI. Replaces the Sonnet free-text generation in
// bbf-agentic-prehab with a real lookup matrix (screen-flag → drill set) that
// mirrors the DYNAMIC PREHAB MATRIX (frontend/src/data/prehabDiagnosticMatrix.json):
// the athlete's reported_friction is parsed to a joint zone, and a fixed,
// PT-grounded 3-drill protocol is returned. Selection is fully deterministic.
//
// Drills are biased to the SAFE mobilize → activate → reset progression the
// function's own safety rules demand (no loaded end-range when a zone is cranky).
// Lumbar + knee protocols reuse the exact localized drills from the matrix JSON;
// the remaining zones are faithful trilingual entries in the same structure.
//
// Output is the SAME flat contract the LLM used to emit:
//   { matrix: [ { name, duration, focus, reason } × 3 ] }
//
// Pure ESM (Deno + node), mirroring the wearable-core.mjs cross-runtime pattern.

function L(locale) { return (locale === 'es' || locale === 'pt') ? locale : 'en'; }

// ── Zone catalog ─────────────────────────────────────────────────────────────
// Each zone: keyword triggers (multilingual) + a 3-drill protocol. Each drill
// carries trilingual name / focus / why; duration is a compact, locale-neutral
// numeric prescription.
const ZONES = {
  thoracic: {
    keys: ['upper back', 'mid back', 'thoracic', 't-spine', 'tspine', 'espalda alta', 'torácica', 'toracica', 'dorsal', 'costas altas'],
    drills: [
      { name: { en: 'Foam Roller Thoracic Extension', es: 'Extensión torácica sobre rodillo', pt: 'Extensão torácica sobre o rolo' }, duration: '2 × 8 (T5–T10)', focus: { en: 'Thoracic spine', es: 'Columna torácica', pt: 'Coluna torácica' }, why: { en: 'restores the extension your low back keeps borrowing.', es: 'recupera la extensión que tu zona lumbar suele pedir prestada.', pt: 'recupera a extensão que sua lombar costuma emprestar.' } },
      { name: { en: 'Quadruped Thoracic Rotation', es: 'Rotación torácica en cuadrupedia', pt: 'Rotação torácica em quatro apoios' }, duration: '2 × 8 / side', focus: { en: 'T-spine rotation', es: 'Rotación de la columna torácica', pt: 'Rotação da coluna torácica' }, why: { en: 'returns rotation to the mid-back so the lumbar stops twisting.', es: 'devuelve la rotación a la espalda media para que la lumbar no rote.', pt: 'devolve a rotação ao dorso para a lombar parar de girar.' } },
      { name: { en: 'Band Pull-Apart', es: 'Apertura con banda', pt: 'Abertura com elástico' }, duration: '3 × 15', focus: { en: 'Mid-traps / rhomboids', es: 'Trapecio medio / romboides', pt: 'Trapézio médio / romboides' }, why: { en: 'builds the postural endurance that holds the new range.', es: 'construye la resistencia postural que sostiene el nuevo rango.', pt: 'constrói a resistência postural que sustenta a nova amplitude.' } },
    ],
  },
  neck: {
    keys: ['neck', 'cervical', 'trap', 'cuello', 'pescoço', 'pescoco', 'trapecio', 'trapézio', 'nuca'],
    drills: [
      { name: { en: 'Suboccipital Release', es: 'Liberación suboccipital', pt: 'Liberação suboccipital' }, duration: '2 × 60s', focus: { en: 'Base of skull', es: 'Base del cráneo', pt: 'Base do crânio' }, why: { en: 'releases the suboccipitals that clamp under desk and screen load.', es: 'libera los suboccipitales que se tensan con el escritorio y la pantalla.', pt: 'libera os suboccipitais que travam com mesa e tela.' } },
      { name: { en: 'Chin Tuck / Deep Neck Flexor', es: 'Retracción de mentón / flexores profundos', pt: 'Retração do queixo / flexores profundos' }, duration: '3 × 8 (5s)', focus: { en: 'Deep neck flexors', es: 'Flexores profundos del cuello', pt: 'Flexores profundos do pescoço' }, why: { en: 'restores the deep stabilizers that hold the head stacked.', es: 'recupera los estabilizadores profundos que mantienen la cabeza alineada.', pt: 'recupera os estabilizadores profundos que mantêm a cabeça alinhada.' } },
      { name: { en: 'Wall Angel', es: 'Ángel en la pared', pt: 'Anjo na parede' }, duration: '2 × 10', focus: { en: 'Thoracic + scapula', es: 'Torácica + escápula', pt: 'Torácica + escápula' }, why: { en: 'links neck relief to upper-back motion so it lasts.', es: 'conecta el alivio del cuello con la movilidad dorsal para que dure.', pt: 'conecta o alívio do pescoço à mobilidade dorsal para durar.' } },
    ],
  },
  shoulder: {
    keys: ['shoulder', 'rotator', 'cuff', 'delt', 'hombro', 'manguito', 'ombro', 'deltoide'],
    drills: [
      { name: { en: 'Pec Minor Doorway Release', es: 'Liberación del pectoral menor en marco', pt: 'Liberação do peitoral menor na porta' }, duration: '2 × 45s / side', focus: { en: 'Anterior shoulder', es: 'Hombro anterior', pt: 'Ombro anterior' }, why: { en: 'opens the front so the shoulder can sit back in the socket.', es: 'abre la parte frontal para que el hombro se reubique en la cavidad.', pt: 'abre a frente para o ombro reassentar na cavidade.' } },
      { name: { en: 'Prone Y-T-W Raises', es: 'Elevaciones Y-T-W en prono', pt: 'Elevações Y-T-W em prono' }, duration: '3 × 8 each', focus: { en: 'Lower traps / cuff', es: 'Trapecio inferior / manguito', pt: 'Trapézio inferior / manguito' }, why: { en: 'wakes the scapular stabilizers that center the humeral head.', es: 'activa los estabilizadores escapulares que centran la cabeza del húmero.', pt: 'ativa os estabilizadores escapulares que centram a cabeça do úmero.' } },
      { name: { en: 'Wall Slide with Rib Lock', es: 'Deslizamiento en pared con costillas fijas', pt: 'Deslizamento na parede com costelas travadas' }, duration: '3 × 10', focus: { en: 'Scapular upward rotation', es: 'Rotación ascendente escapular', pt: 'Rotação ascendente escapular' }, why: { en: 're-grooves overhead motion without arching to fake the range.', es: 'reeduca el movimiento sobre la cabeza sin arquear para fingir el rango.', pt: 'reeduca o movimento acima da cabeça sem arquear para simular amplitude.' } },
    ],
  },
  knee: {
    keys: ['knee', 'patell', 'kneecap', 'rodilla', 'rótula', 'rotula', 'joelho', 'patela'],
    drills: [
      { name: { en: 'Quadriceps & Lateral Thigh Foam Roll', es: 'Rodillo en cuádriceps y cara lateral del muslo', pt: 'Rolo no quadríceps e na face lateral da coxa' }, duration: '2 × 60s / leg', focus: { en: 'Quads / IT band', es: 'Cuádriceps / cintilla iliotibial', pt: 'Quadríceps / trato iliotibial' }, why: { en: 'offloads the lateral pull that biases the kneecap.', es: 'descarga la tracción lateral que desvía la rótula.', pt: 'alivia a tração lateral que desvia a patela.' } },
      { name: { en: 'Banded Terminal Knee Extension', es: 'Extensión terminal de rodilla con banda', pt: 'Extensão terminal de joelho com elástico' }, duration: '3 × 12 / leg', focus: { en: 'VMO / quadriceps', es: 'VMO / cuádriceps', pt: 'VMO / quadríceps' }, why: { en: 'restores the terminal-extension control that tracks the patella.', es: 'recupera el control de extensión terminal que alinea la rótula.', pt: 'recupera o controle de extensão terminal que alinha a patela.' } },
      { name: { en: 'Spanish Squat Isometric', es: 'Isométrico de sentadilla española', pt: 'Isometria de agachamento espanhol' }, duration: '4 × 35s', focus: { en: 'Quads (decompressed)', es: 'Cuádriceps (descomprimido)', pt: 'Quadríceps (descomprimido)' }, why: { en: 'loads the quad hard while keeping the kneecap decompressed.', es: 'carga fuerte el cuádriceps manteniendo la rótula descomprimida.', pt: 'carrega forte o quadríceps mantendo a patela descomprimida.' } },
    ],
  },
  ankle: {
    keys: ['ankle', 'calf', 'achilles', 'dorsiflex', 'tobillo', 'pantorrilla', 'gemelo', 'tornozelo', 'panturrilha', 'aquiles'],
    drills: [
      { name: { en: 'Knee-to-Wall Ankle Mobilization', es: 'Movilización de tobillo rodilla-a-pared', pt: 'Mobilização de tornozelo joelho-na-parede' }, duration: '2 × 10 / side (3s)', focus: { en: 'Ankle dorsiflexion', es: 'Dorsiflexión del tobillo', pt: 'Dorsiflexão do tornozelo' }, why: { en: 'reopens the dorsiflexion that protects the knee on squats and landings.', es: 'recupera la dorsiflexión que protege la rodilla en sentadillas y aterrizajes.', pt: 'recupera a dorsiflexão que protege o joelho em agachamentos e aterrissagens.' } },
      { name: { en: 'Banded Ankle Joint Distraction', es: 'Distracción articular de tobillo con banda', pt: 'Distração articular do tornozelo com elástico' }, duration: '2 × 15 / side', focus: { en: 'Anterior ankle', es: 'Tobillo anterior', pt: 'Tornozelo anterior' }, why: { en: 'clears the pinch by gliding the joint instead of forcing it.', es: 'libera el pinzamiento deslizando la articulación en vez de forzarla.', pt: 'libera o pinçamento deslizando a articulação em vez de forçá-la.' } },
      { name: { en: 'Heel-Elevated Tempo Goblet Squat', es: 'Sentadilla goblet con talones elevados y tempo', pt: 'Agachamento goblet com calcanhares elevados e tempo' }, duration: '3 × 8 (3-1-3)', focus: { en: 'Calf / ankle integration', es: 'Pantorrilla / integración del tobillo', pt: 'Panturrilha / integração do tornozelo' }, why: { en: 'loads the new range under control so it carries to the bar.', es: 'carga el nuevo rango con control para que se transfiera a la barra.', pt: 'carrega a nova amplitude com controle para transferir à barra.' } },
    ],
  },
  hip: {
    keys: ['hip', 'glute', 'groin', 'piriformis', 'si joint', 'sacroiliac', 'cadera', 'glúteo', 'gluteo', 'ingle', 'quadril', 'glúteos', 'virilha'],
    drills: [
      { name: { en: '90/90 Hip Switch', es: 'Cambio de cadera 90/90', pt: 'Troca de quadril 90/90' }, duration: '30s × 3 / side', focus: { en: 'Hip capsule / rotators', es: 'Cápsula de cadera / rotadores', pt: 'Cápsula do quadril / rotadores' }, why: { en: 'pairs internal and external rotation to restore socket range.', es: 'combina rotación interna y externa para recuperar el rango de la cadera.', pt: 'combina rotação interna e externa para recuperar a amplitude do quadril.' } },
      { name: { en: 'Banded Clamshell (neutral pelvis)', es: 'Almeja con banda (pelvis neutra)', pt: 'Concha com elástico (pelve neutra)' }, duration: '3 × 15 / side (2s)', focus: { en: 'Gluteus medius', es: 'Glúteo medio', pt: 'Glúteo médio' }, why: { en: 'rebuilds the abductor control that steadies the pelvis.', es: 'reconstruye el control abductor que estabiliza la pelvis.', pt: 'reconstrói o controle abdutor que estabiliza a pelve.' } },
      { name: { en: 'Wall-Press Hip-Lock March', es: 'Marcha con bloqueo de cadera en pared', pt: 'Marcha com trava de quadril na parede' }, duration: '3 × 10s / side', focus: { en: 'Stance-hip stability', es: 'Estabilidad de la cadera de apoyo', pt: 'Estabilidade do quadril de apoio' }, why: { en: 'trains single-leg pelvic control under a tall posture.', es: 'entrena el control pélvico unilateral en una postura erguida.', pt: 'treina o controle pélvico unilateral em postura ereta.' } },
    ],
  },
  lumbar: {
    keys: ['low back', 'lower back', 'lumbar', 'back', 'spine', 'hamstring', 'posterior chain', 'espalda baja', 'zona lumbar', 'espalda', 'lombar', 'costas', 'coluna', 'isquio', 'isquiotibial'],
    drills: [
      { name: { en: 'Quadruped Rockback Hip Mobilization', es: 'Movilización de cadera en cuadrupedia (Rockback)', pt: 'Mobilização de quadril em quatro apoios (Rockback)' }, duration: '2 × 10 (3s hold)', focus: { en: 'Hips / lumbar dissociation', es: 'Cadera / disociación lumbar', pt: 'Quadril / dissociação lombar' }, why: { en: 'grooves pure hip flexion so the low back stops donating range.', es: 'entrena flexión pura de cadera para que la lumbar deje de ceder rango.', pt: 'treina flexão pura de quadril para a lombar parar de ceder amplitude.' } },
      { name: { en: 'Bird Dog (McGill)', es: 'Bird Dog (Perro de Caza)', pt: 'Bird Dog (Cão de Caça)' }, duration: '3 × 6 / side (10s)', focus: { en: 'Core / spinal stability', es: 'Core / estabilidad espinal', pt: 'Core / estabilidade da coluna' }, why: { en: 'trains anti-rotation so the lumbar segments stay supported.', es: 'entrena la anti-rotación para que los segmentos lumbares queden soportados.', pt: 'treina a anti-rotação para os segmentos lombares ficarem suportados.' } },
      { name: { en: 'Supine 90/90 Diaphragmatic Breathing', es: 'Respiración diafragmática 90/90 en supino', pt: 'Respiração diafragmática 90/90 em supino' }, duration: '5 min', focus: { en: 'Lumbo-pelvic reset', es: 'Reinicio lumbopélvico', pt: 'Reset lombopélvico' }, why: { en: 'down-regulates guarding and restores a neutral pelvis without loading.', es: 'reduce la protección muscular y recupera la pelvis neutra sin carga.', pt: 'reduz a proteção muscular e recupera a pelve neutra sem carga.' } },
    ],
  },
};

// General baseline — identical content to the function's defaultBaselineMatrix,
// used when no friction zone is detected. Trilingual.
const GENERAL = {
  drills: [
    { name: { en: 'Cat-Cow Spinal Flow', es: 'Flujo espinal Gato-Camello', pt: 'Fluxo espinal Gato-Camelo' }, duration: '2 min', focus: { en: 'Full spine mobility', es: 'Movilidad de toda la columna', pt: 'Mobilidade de toda a coluna' }, why: { en: 'a universal segmental reset top-to-bottom.', es: 'un reinicio segmentario universal de arriba abajo.', pt: 'um reset segmentar universal de cima a baixo.' } },
    { name: { en: '90/90 Hip Switch', es: 'Cambio de cadera 90/90', pt: 'Troca de quadril 90/90' }, duration: '30s × 3 / side', focus: { en: 'Hip capsule + rotators', es: 'Cápsula de cadera + rotadores', pt: 'Cápsula do quadril + rotadores' }, why: { en: 'low-friction internal + external hip rotation, safe for every demographic.', es: 'rotación interna + externa de cadera de baja fricción, segura para todos.', pt: 'rotação interna + externa de quadril de baixa fricção, segura para todos.' } },
    { name: { en: 'Childs Pose with Side Reach', es: 'Postura del niño con alcance lateral', pt: 'Postura da criança com alcance lateral' }, duration: '60s total', focus: { en: 'Lats / lower back', es: 'Dorsales / zona lumbar', pt: 'Dorsais / lombar' }, why: { en: 'decompresses the lumbar segment and opens the lats.', es: 'descomprime el segmento lumbar y abre los dorsales.', pt: 'descomprime o segmento lombar e abre os dorsais.' } },
  ],
};

// Priority order: specific zones first; lumbar is last because the bare token
// 'back' is the most generic trigger and would otherwise swallow 'upper back'.
const ZONE_ORDER = ['thoracic', 'neck', 'shoulder', 'knee', 'ankle', 'hip', 'lumbar'];

export function detectZone(frictionText) {
  const t = String(frictionText || '').toLowerCase();
  if (!t.trim()) return null;
  for (const id of ZONE_ORDER) {
    for (const k of ZONES[id].keys) {
      if (t.includes(k)) return id;
    }
  }
  return null;
}

// Compose the friction-aware, localized reason line for one drill.
function reasonFor(why, locale, frictionText, workloadCount) {
  const loc = L(locale);
  const w = why[loc];
  const f = String(frictionText || '').trim().slice(0, 80);
  if (f) {
    if (loc === 'es') return `Atiende la fricción que reportaste (${f}): ${w}`;
    if (loc === 'pt') return `Atende a fricção que você relatou (${f}): ${w}`;
    return `Addresses your reported friction (${f}): ${w}`;
  }
  if (workloadCount > 0) {
    const n = workloadCount;
    if (loc === 'es') return `Reinicio tras tus ${n} series de hoy: ${w}`;
    if (loc === 'pt') return `Reset após suas ${n} séries de hoje: ${w}`;
    return `Post-session reset after today's ${n} logged set${n === 1 ? '' : 's'}: ${capFirst(w)}`;
  }
  // No friction, no workload → general reset; capitalize the standalone why.
  return capFirst(w);
}
function capFirst(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

// ── Top-level selection ──────────────────────────────────────────────────────
// Returns { matrix: [{name,duration,focus,reason} × 3], zone }.
export function selectPrehabMatrix(frictionText, locale = 'en', opts = {}) {
  const loc = L(locale);
  const workloadCount = Number(opts.workloadCount) || 0;
  const zoneId = detectZone(frictionText);
  const protocol = zoneId ? ZONES[zoneId] : GENERAL;
  const matrix = protocol.drills.map((d) => ({
    name: d.name[loc],
    duration: d.duration,
    focus: d.focus[loc],
    reason: reasonFor(d.why, loc, frictionText, workloadCount),
  }));
  return { matrix, zone: zoneId || 'general' };
}
