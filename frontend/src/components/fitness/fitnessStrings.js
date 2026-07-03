// src/components/fitness/fitnessStrings.js
// ─────────────────────────────────────────────────────────────────────────────
// Phase 3.4 — Athlete Fitness & Cardio Command · trilingual chrome + the Gram
// Boundary presentation/validation layer.
//
// TRILINGUAL: all chrome + fallback states resolve through useFitnessStr by
// preferred_locale — no hardcoded English.
// THE GRAM BOUNDARY (§0.1): weight is entered in lbs (the legacy write surface the
// backend casts); load_g is the EXACT integer-gram conversion, computed here purely
// as a live validation indicator — round(weight_lbs · 453.59237) — matching the
// bbf_sets generated column. We submit weight_lbs; the DB generates load_g.

import { useLang } from '../../context/LangContext.jsx';

const NUM_LOCALE = { en: 'en-US', es: 'es-ES', pt: 'pt-BR' };

// The EXACT cast the bbf_sets.load_g generated column uses (Phase 2.2 boundary).
export const GRAMS_PER_POUND = 453.59237;
export function computeLoadG(weightLbs) {
  const n = Number(weightLbs);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * GRAMS_PER_POUND); // integer grams, always
}

// Presentation-only: locale-grouped integer grams + fixed ' g' (en "61,235 g" ·
// es/pt "61.235 g"). Never /kg.
export function formatGrams(value, lang) {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${Math.round(n).toLocaleString(NUM_LOCALE[lang] || NUM_LOCALE.en)} g`;
}

// The 6 movement vectors (workload-core VECTORS). Captured in the UI; not a
// bbf_sets column — it rides the exercise_key so the athlete keeps the context.
export const MOVEMENT_VECTORS = ['axial', 'knee_dominant', 'hip_hinge', 'shoulder_load', 'elbow_load', 'impact'];

export const FIT_STR = {
  en: {
    // FitnessCheckInForm
    fitKicker: 'Fitness Check-In', fitTitle: 'Log Your Sets',
    vector: 'Movement', weight: 'Weight', weightUnit: 'lbs', reps: 'Reps', rpe: 'RPE',
    loadPreview: 'Load', addSet: 'Add set', removeSet: 'Remove',
    logSession: (n) => `Log Session · ${n} set${n === 1 ? '' : 's'}`,
    logging: 'Logging…', noSets: 'Add a set to start your session.',
    logged: 'Session logged.', logError: 'Could not log — try again.',
    signInFirst: 'Sign in to log your sets.',
    setLine: (r, w) => `${r} × ${w} lbs`,
    vectors: { axial: 'Axial (spine)', knee_dominant: 'Knee-dominant', hip_hinge: 'Hip hinge', shoulder_load: 'Shoulder', elbow_load: 'Elbow', impact: 'Impact' },
    invalidWeight: 'Enter a weight.', invalidReps: 'Enter reps.',
    // PrehabQueueMatrix
    prehabKicker: 'Prehab Protocol', prehabTitle: 'Today’s Joints',
    allClear: 'All Clear', allClearSub: 'General Mobility',
    allClearBody: 'No joints flagged today — run your general mobility flow.',
    prehabLoading: 'Reading your protocol…', prehabError: 'Could not load your protocol.',
    riskLabel: 'Risk',
    priority: { mandatory: 'Mandatory', strong: 'Strong', advisory: 'Advisory' },
    joints: { shoulder: 'Shoulder', knee: 'Knee', lower_back: 'Lower back', elbow: 'Elbow', hamstring: 'Hamstring', ankle: 'Ankle', hip: 'Hip', wrist: 'Wrist', neck: 'Neck', groin: 'Groin' },
    // AudioBriefPlayer
    briefKicker: 'Morning Brief', briefTitle: 'Sovereign Brief',
    play: 'Play', pause: 'Pause', replay: 'Replay',
    segment: (i, n) => `Segment ${i} of ${n}`,
    briefLoading: 'Loading your brief…', briefNone: 'No brief yet — check back after your morning scan.',
    briefError: 'Could not load your brief.',
    tone: { steady: 'Steady', hype: 'Hype', calm: 'Calm', clinical: 'Clinical', neutral: 'Neutral' },
  },
  es: {
    fitKicker: 'Registro de Fitness', fitTitle: 'Registra Tus Series',
    vector: 'Movimiento', weight: 'Peso', weightUnit: 'lbs', reps: 'Reps', rpe: 'RPE',
    loadPreview: 'Carga', addSet: 'Añadir serie', removeSet: 'Quitar',
    logSession: (n) => `Registrar Sesión · ${n} serie${n === 1 ? '' : 's'}`,
    logging: 'Registrando…', noSets: 'Añade una serie para iniciar tu sesión.',
    logged: 'Sesión registrada.', logError: 'No se pudo registrar — inténtalo de nuevo.',
    signInFirst: 'Inicia sesión para registrar tus series.',
    setLine: (r, w) => `${r} × ${w} lbs`,
    vectors: { axial: 'Axial (columna)', knee_dominant: 'Dominante de rodilla', hip_hinge: 'Bisagra de cadera', shoulder_load: 'Hombro', elbow_load: 'Codo', impact: 'Impacto' },
    invalidWeight: 'Introduce un peso.', invalidReps: 'Introduce las reps.',
    prehabKicker: 'Protocolo de Prehab', prehabTitle: 'Articulaciones de Hoy',
    allClear: 'Todo Despejado', allClearSub: 'Movilidad General',
    allClearBody: 'Ninguna articulación marcada hoy — realiza tu rutina de movilidad general.',
    prehabLoading: 'Leyendo tu protocolo…', prehabError: 'No se pudo cargar tu protocolo.',
    riskLabel: 'Riesgo',
    priority: { mandatory: 'Obligatorio', strong: 'Fuerte', advisory: 'Preventivo' },
    joints: { shoulder: 'Hombro', knee: 'Rodilla', lower_back: 'Espalda baja', elbow: 'Codo', hamstring: 'Isquiotibial', ankle: 'Tobillo', hip: 'Cadera', wrist: 'Muñeca', neck: 'Cuello', groin: 'Ingle' },
    briefKicker: 'Resumen Matutino', briefTitle: 'Resumen Soberano',
    play: 'Reproducir', pause: 'Pausa', replay: 'Repetir',
    segment: (i, n) => `Segmento ${i} de ${n}`,
    briefLoading: 'Cargando tu resumen…', briefNone: 'Aún no hay resumen — vuelve tras tu escaneo matutino.',
    briefError: 'No se pudo cargar tu resumen.',
    tone: { steady: 'Constante', hype: 'Energía', calm: 'Calma', clinical: 'Clínico', neutral: 'Neutro' },
  },
  pt: {
    fitKicker: 'Registro de Fitness', fitTitle: 'Registre Suas Séries',
    vector: 'Movimento', weight: 'Peso', weightUnit: 'lbs', reps: 'Reps', rpe: 'RPE',
    loadPreview: 'Carga', addSet: 'Adicionar série', removeSet: 'Remover',
    logSession: (n) => `Registrar Sessão · ${n} série${n === 1 ? '' : 's'}`,
    logging: 'Registrando…', noSets: 'Adicione uma série para iniciar sua sessão.',
    logged: 'Sessão registrada.', logError: 'Não foi possível registrar — tente novamente.',
    signInFirst: 'Entre para registrar suas séries.',
    setLine: (r, w) => `${r} × ${w} lbs`,
    vectors: { axial: 'Axial (coluna)', knee_dominant: 'Dominante de joelho', hip_hinge: 'Dobradiça de quadril', shoulder_load: 'Ombro', elbow_load: 'Cotovelo', impact: 'Impacto' },
    invalidWeight: 'Digite um peso.', invalidReps: 'Digite as reps.',
    prehabKicker: 'Protocolo de Prehab', prehabTitle: 'Articulações de Hoje',
    allClear: 'Tudo Liberado', allClearSub: 'Mobilidade Geral',
    allClearBody: 'Nenhuma articulação sinalizada hoje — faça sua rotina de mobilidade geral.',
    prehabLoading: 'Lendo seu protocolo…', prehabError: 'Não foi possível carregar seu protocolo.',
    riskLabel: 'Risco',
    priority: { mandatory: 'Obrigatório', strong: 'Forte', advisory: 'Preventivo' },
    joints: { shoulder: 'Ombro', knee: 'Joelho', lower_back: 'Lombar', elbow: 'Cotovelo', hamstring: 'Posterior', ankle: 'Tornozelo', hip: 'Quadril', wrist: 'Punho', neck: 'Pescoço', groin: 'Virilha' },
    briefKicker: 'Resumo Matinal', briefTitle: 'Resumo Soberano',
    play: 'Reproduzir', pause: 'Pausar', replay: 'Repetir',
    segment: (i, n) => `Segmento ${i} de ${n}`,
    briefLoading: 'Carregando seu resumo…', briefNone: 'Ainda não há resumo — volte após seu escaneamento matinal.',
    briefError: 'Não foi possível carregar seu resumo.',
    tone: { steady: 'Constante', hype: 'Energia', calm: 'Calma', clinical: 'Clínico', neutral: 'Neutro' },
  },
};

export function useFitnessStr() {
  const { lang } = useLang();
  return { fs: FIT_STR[lang] || FIT_STR.en, lang };
}
