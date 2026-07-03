// src/components/hub/hubStrings.js
// ─────────────────────────────────────────────────────────────────────────────
// Phase 3.1 — Day-1 Hub · trilingual chrome + the Gram-Boundary presentation layer.
//
// Two hard rules from the Onboarding State Machine blueprint live here so the
// cards stay dumb:
//   • TRILINGUAL (§structural): NO hardcoded English in a card. Every visible
//     string routes through HUB_STR[lang] (EN/ES/PT), resolved by the athlete's
//     preferred_locale via useLang(). Mirrors the NUT_STR pattern in Nutrition.jsx.
//   • THE GRAM BOUNDARY (§0.1): the API hands us BIGINT integer grams. Formatting
//     — locale thousands grouping ("143,335 g" EN vs "143.335 g" ES/PT) — happens
//     ONLY here, in the presentation layer. No physiology, no unit math, ever.
//
// LAYER-2 DEFAULTS: a client-side mirror of the config-backed hub_degraded_
// defaults_v1 seed. The RPC returns `defaults` on every call; this constant is the
// belt-and-suspenders for a TOTAL RPC failure, so a card can ALWAYS render a real
// baseline (chip-flagged) and the "No Empty Dashboards" guarantee never breaks.

import { useLang } from '../../context/LangContext.jsx';

// lang → Intl locale whose thousands separator matches the brand standard.
// en-US → "143,335"  ·  es-ES / pt-BR → "143.335"
const NUM_LOCALE = { en: 'en-US', es: 'es-ES', pt: 'pt-BR' };

// Format an integer count of GRAMS for display: locale-grouped, ' g' suffix.
// grams arrives as a BIGINT integer (may be a JS number or numeric string).
export function formatGrams(grams, lang) {
  if (grams === null || grams === undefined || grams === '') return '—';
  const n = Number(grams);
  if (!Number.isFinite(n)) return '—';
  return `${n.toLocaleString(NUM_LOCALE[lang] || NUM_LOCALE.en)} g`;
}

// Energy is NOT mass — kcal is grouped the same way but carries no gram suffix.
export function formatKcal(kcal, lang) {
  if (kcal === null || kcal === undefined || kcal === '') return '—';
  const n = Number(kcal);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(NUM_LOCALE[lang] || NUM_LOCALE.en);
}

// A bare locale-grouped integer (heart-rate bpm, minutes, counts).
export function formatNumber(v, lang) {
  if (v === null || v === undefined || v === '') return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(NUM_LOCALE[lang] || NUM_LOCALE.en);
}

// Milliseconds → "M:SS" for the audio-brief runtime (locale-agnostic clock).
export function formatDuration(ms) {
  const total = Math.max(0, Math.round(Number(ms) / 1000) || 0);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ── Client-side Layer-2 fallback (mirrors bbf_app_config.hub_degraded_defaults_v1) ──
// Used ONLY when the RPC returns nothing usable at all. Gram-native integers.
export const LAYER2_DEFAULTS = {
  nutrition: { tier: 'foundation', tdee_kcal: 2765, protein_g: 180, carbs_g: 320, fat_g: 85, creatine_g: null, day_type: 'standard' },
  cardio: { effective_tier: 'Zone 2', recovery_state: 'unknown', mech_state: null, hr_cap_bpm: null, rpe_cap: null, duration_min: 30, work_rest_ratio: null, ee_kcal_est: 257, sweat_loss_g_est: 367, rehydration_g: 551 },
};

// ── Trilingual chrome (EN/ES/PT) — every card label the Hub renders ──────────
export const HUB_STR = {
  en: {
    hubKicker: 'Your Day-1 Hub', hubTitle: 'Today’s Protocol',
    calibrating: 'Calibrating…', calibratingAria: 'Calibrating — personalizing this surface',
    degradedNote: 'We’re still personalizing your plan — these are your starting baselines.',
    // Nutrition card
    nutTitle: 'Fuel Targets', nutKicker: 'Nutrition',
    nutTdee: 'Daily Energy', nutProtein: 'Protein', nutCarbs: 'Carbs', nutFat: 'Fat', nutCreatine: 'Creatine',
    kcalUnit: 'kcal', dayType: 'Day type',
    tier: { foundation: 'Foundation', performance: 'Performance', sovereign: 'Sovereign' },
    dayTypes: { standard: 'Standard', training: 'Training', rest: 'Rest', refeed: 'Refeed', high: 'High', low: 'Low' },
    // Cardio card
    cardTitle: 'Cardio Prescription', cardKicker: 'Cardio',
    cardTier: 'Modality', cardDuration: 'Duration', cardHrCap: 'HR cap', cardEe: 'Energy burn',
    cardSweat: 'Sweat loss', cardRehydrate: 'Rehydrate', cardWorkRest: 'Work : Rest',
    minUnit: 'min', bpmUnit: 'bpm',
    recovery: { clear: 'Cleared', caution: 'Caution', danger: 'Recovery', unknown: 'Baseline' },
    // Prehab card
    prehabTitle: 'Prehab Queue', prehabKicker: 'Joints',
    prehabClear: 'All clear — no prehab flagged today.',
    prehabCount: (n) => `${n} zone${n === 1 ? '' : 's'} queued`,
    priority: { mandatory: 'Mandatory', strong: 'Strong', advisory: 'Advisory' },
    joints: { shoulder: 'Shoulder', knee: 'Knee', lower_back: 'Lower back', elbow: 'Elbow', hamstring: 'Hamstring', ankle: 'Ankle', hip: 'Hip', wrist: 'Wrist', neck: 'Neck', groin: 'Groin' },
    // Audio brief card
    briefTitle: 'Audio Brief', briefKicker: 'Sovereign Brief',
    briefReady: 'Your brief is ready', briefRuntime: 'Runtime', briefFragments: 'Segments',
    briefCalibrating: 'Composing your first brief…',
    tone: { steady: 'Steady', hype: 'Hype', calm: 'Calm', clinical: 'Clinical', neutral: 'Neutral' },
  },
  es: {
    hubKicker: 'Tu Centro del Día 1', hubTitle: 'Protocolo de Hoy',
    calibrating: 'Calibrando…', calibratingAria: 'Calibrando — personalizando esta sección',
    degradedNote: 'Aún estamos personalizando tu plan — estos son tus valores base iniciales.',
    nutTitle: 'Objetivos de Combustible', nutKicker: 'Nutrición',
    nutTdee: 'Energía Diaria', nutProtein: 'Proteína', nutCarbs: 'Carbohidratos', nutFat: 'Grasa', nutCreatine: 'Creatina',
    kcalUnit: 'kcal', dayType: 'Tipo de día',
    tier: { foundation: 'Base', performance: 'Rendimiento', sovereign: 'Soberano' },
    dayTypes: { standard: 'Estándar', training: 'Entrenamiento', rest: 'Descanso', refeed: 'Recarga', high: 'Alto', low: 'Bajo' },
    cardTitle: 'Prescripción de Cardio', cardKicker: 'Cardio',
    cardTier: 'Modalidad', cardDuration: 'Duración', cardHrCap: 'Límite FC', cardEe: 'Gasto energético',
    cardSweat: 'Pérdida de sudor', cardRehydrate: 'Rehidratar', cardWorkRest: 'Trabajo : Descanso',
    minUnit: 'min', bpmUnit: 'ppm',
    recovery: { clear: 'Autorizado', caution: 'Precaución', danger: 'Recuperación', unknown: 'Base' },
    prehabTitle: 'Cola de Prehab', prehabKicker: 'Articulaciones',
    prehabClear: 'Todo despejado — sin prehab marcado hoy.',
    prehabCount: (n) => `${n} zona${n === 1 ? '' : 's'} en cola`,
    priority: { mandatory: 'Obligatorio', strong: 'Fuerte', advisory: 'Preventivo' },
    joints: { shoulder: 'Hombro', knee: 'Rodilla', lower_back: 'Espalda baja', elbow: 'Codo', hamstring: 'Isquiotibial', ankle: 'Tobillo', hip: 'Cadera', wrist: 'Muñeca', neck: 'Cuello', groin: 'Ingle' },
    briefTitle: 'Resumen de Audio', briefKicker: 'Resumen Soberano',
    briefReady: 'Tu resumen está listo', briefRuntime: 'Duración', briefFragments: 'Segmentos',
    briefCalibrating: 'Componiendo tu primer resumen…',
    tone: { steady: 'Constante', hype: 'Energía', calm: 'Calma', clinical: 'Clínico', neutral: 'Neutro' },
  },
  pt: {
    hubKicker: 'Seu Centro do Dia 1', hubTitle: 'Protocolo de Hoje',
    calibrating: 'Calibrando…', calibratingAria: 'Calibrando — personalizando esta seção',
    degradedNote: 'Ainda estamos personalizando seu plano — estes são seus valores base iniciais.',
    nutTitle: 'Metas de Combustível', nutKicker: 'Nutrição',
    nutTdee: 'Energia Diária', nutProtein: 'Proteína', nutCarbs: 'Carboidratos', nutFat: 'Gordura', nutCreatine: 'Creatina',
    kcalUnit: 'kcal', dayType: 'Tipo de dia',
    tier: { foundation: 'Base', performance: 'Performance', sovereign: 'Soberano' },
    dayTypes: { standard: 'Padrão', training: 'Treino', rest: 'Descanso', refeed: 'Recarga', high: 'Alto', low: 'Baixo' },
    cardTitle: 'Prescrição de Cardio', cardKicker: 'Cardio',
    cardTier: 'Modalidade', cardDuration: 'Duração', cardHrCap: 'Limite FC', cardEe: 'Gasto energético',
    cardSweat: 'Perda de suor', cardRehydrate: 'Reidratar', cardWorkRest: 'Trabalho : Descanso',
    minUnit: 'min', bpmUnit: 'bpm',
    recovery: { clear: 'Liberado', caution: 'Cautela', danger: 'Recuperação', unknown: 'Base' },
    prehabTitle: 'Fila de Prehab', prehabKicker: 'Articulações',
    prehabClear: 'Tudo liberado — nenhum prehab sinalizado hoje.',
    prehabCount: (n) => `${n} zona${n === 1 ? '' : 's'} na fila`,
    priority: { mandatory: 'Obrigatório', strong: 'Forte', advisory: 'Preventivo' },
    joints: { shoulder: 'Ombro', knee: 'Joelho', lower_back: 'Lombar', elbow: 'Cotovelo', hamstring: 'Posterior', ankle: 'Tornozelo', hip: 'Quadril', wrist: 'Punho', neck: 'Pescoço', groin: 'Virilha' },
    briefTitle: 'Resumo de Áudio', briefKicker: 'Resumo Soberano',
    briefReady: 'Seu resumo está pronto', briefRuntime: 'Duração', briefFragments: 'Segmentos',
    briefCalibrating: 'Compondo seu primeiro resumo…',
    tone: { steady: 'Constante', hype: 'Energia', calm: 'Calma', clinical: 'Clínico', neutral: 'Neutro' },
  },
};

// Hook: resolve the active-locale string table + the matching number locale.
export function useHubStr() {
  const { lang } = useLang();
  const active = HUB_STR[lang] || HUB_STR.en;
  return { hs: active, lang };
}
