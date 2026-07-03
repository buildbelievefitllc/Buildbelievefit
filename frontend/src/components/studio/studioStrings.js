// src/components/studio/studioStrings.js
// ─────────────────────────────────────────────────────────────────────────────
// Phase 3.3 — Content Studio V4 Command Center · trilingual chrome + the Gram
// Boundary input layer.
//
// TRILINGUAL: all chrome resolves through useStudioStr by preferred_locale — no
// hardcoded English. (The compiled overlay VALUES are pre-formatted server-side by
// the job's TARGET locale; we never reformat those.)
//
// THE GRAM BOUNDARY (§0.1): the gram_override input is INTEGER GRAMS only.
// validateGrams() is the client gate that must pass before the Edge Function is
// called; the compiler re-validates (integer ≥ 0) as defense-in-depth. formatGrams()
// is presentation-only (locale grouping + fixed ' g').

import { useLang } from '../../context/LangContext.jsx';

const NUM_LOCALE = { en: 'en-US', es: 'es-ES', pt: 'pt-BR' };
const GRAM_MAX = 100_000_000; // 100 t — a sane ceiling for a benchmark override

// Strict integer-grams gate. Accepts digits (with locale grouping stripped); no
// sign, no decimals — grams are a BIGINT integer. → { valid, value|null }.
export function validateGrams(raw) {
  const digits = String(raw ?? '').replace(/[^\d]/g, '');
  if (!digits.length) return { valid: false, value: null };
  const n = Number(digits);
  if (!Number.isSafeInteger(n) || n < 0 || n > GRAM_MAX) return { valid: false, value: null };
  return { valid: true, value: n };
}

// Presentation-only: locale-grouped integer grams + fixed ' g' (en "150,000 g" ·
// es/pt "150.000 g"). Never /kg — the unit is fixed.
export function formatGrams(value, lang) {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${Math.round(n).toLocaleString(NUM_LOCALE[lang] || NUM_LOCALE.en)} g`;
}

// The canonical GRAM binding sources an override may target (cardio.ee_kcal is
// energy, not mass, so it is deliberately excluded from a gram override).
export const GRAM_SOURCES = [
  'workload.tonnage_g', 'metrics.body_mass_g',
  'nutrition.protein_g', 'nutrition.carbs_g', 'nutrition.fat_g',
  'cardio.rehydration_g', 'cardio.sweat_loss_g',
];

export const STUDIO_STR = {
  en: {
    // PresetSelector
    kicker: 'Content Studio V4', title: 'Batch Compiler',
    preset: 'Base preset', presetDefault: 'Default preset',
    audience: 'Audience', audienceSocial: 'Social (demo grams)', audienceDirected: 'Directed (real athlete)',
    athleteId: 'Target athlete ID', athleteIdPh: 'athlete_profiles.id (UUID)',
    locale: 'Overlay locale', device: 'Device class',
    deviceHigh: 'High', deviceMid: 'Mid', deviceLow: 'Low',
    overrideToggle: 'Force gram override', overrideSource: 'Override target',
    gramLabel: 'Gram override', gramUnit: 'grams', gramPh: 'e.g. 150000',
    gramHelp: 'Integer grams only — no decimals, no kg.', gramInvalid: 'Enter a whole number of grams.',
    compile: 'Compile Batch', compiling: 'Compiling…',
    locked: 'Content Studio is a Command Center surface — unlock admin access to compile.',
    directedNoAthlete: 'A Directed job needs a target athlete ID.',
    // StudioTimelineVisualizer
    tlTitle: 'Compiled Timeline', clip: 'Clip', ladder: 'Ladder', laneLabel: 'Lane',
    zLabel: 'z', track: 'Track', layers: 'layers', noLayers: 'No visible layers in this overlay.',
    demoTag: 'Demo grams', realTag: 'Real ledger', overrideTag: 'Gram override',
    statusCompiled: 'Compiled', statusRejected: 'Rejected', statusError: 'Error',
    typeText: 'Text', typeStat: 'Stat badge', typeOther: 'Layer',
    emptyResults: 'Compile a batch to see its timeline.',
    msUnit: 'ms', durLabel: 'dur',
  },
  es: {
    kicker: 'Estudio de Contenido V4', title: 'Compilador por Lotes',
    preset: 'Preset base', presetDefault: 'Preset predeterminado',
    audience: 'Audiencia', audienceSocial: 'Social (gramos demo)', audienceDirected: 'Dirigido (atleta real)',
    athleteId: 'ID del atleta objetivo', athleteIdPh: 'athlete_profiles.id (UUID)',
    locale: 'Idioma del overlay', device: 'Clase de dispositivo',
    deviceHigh: 'Alta', deviceMid: 'Media', deviceLow: 'Baja',
    overrideToggle: 'Forzar anulación de gramos', overrideSource: 'Objetivo de anulación',
    gramLabel: 'Anulación de gramos', gramUnit: 'gramos', gramPh: 'ej. 150000',
    gramHelp: 'Solo gramos enteros — sin decimales, sin kg.', gramInvalid: 'Introduce un número entero de gramos.',
    compile: 'Compilar Lote', compiling: 'Compilando…',
    locked: 'El Estudio de Contenido es una superficie del Centro de Comando — desbloquea el acceso de administrador para compilar.',
    directedNoAthlete: 'Un trabajo Dirigido necesita un ID de atleta objetivo.',
    tlTitle: 'Línea de Tiempo Compilada', clip: 'Clip', ladder: 'Escalera', laneLabel: 'Carril',
    zLabel: 'z', track: 'Pista', layers: 'capas', noLayers: 'No hay capas visibles en este overlay.',
    demoTag: 'Gramos demo', realTag: 'Ledger real', overrideTag: 'Anulación de gramos',
    statusCompiled: 'Compilado', statusRejected: 'Rechazado', statusError: 'Error',
    typeText: 'Texto', typeStat: 'Insignia de dato', typeOther: 'Capa',
    emptyResults: 'Compila un lote para ver su línea de tiempo.',
    msUnit: 'ms', durLabel: 'dur',
  },
  pt: {
    kicker: 'Estúdio de Conteúdo V4', title: 'Compilador em Lote',
    preset: 'Preset base', presetDefault: 'Preset padrão',
    audience: 'Público', audienceSocial: 'Social (gramas demo)', audienceDirected: 'Direcionado (atleta real)',
    athleteId: 'ID do atleta-alvo', athleteIdPh: 'athlete_profiles.id (UUID)',
    locale: 'Idioma do overlay', device: 'Classe de dispositivo',
    deviceHigh: 'Alta', deviceMid: 'Média', deviceLow: 'Baixa',
    overrideToggle: 'Forçar substituição de gramas', overrideSource: 'Alvo da substituição',
    gramLabel: 'Substituição de gramas', gramUnit: 'gramas', gramPh: 'ex. 150000',
    gramHelp: 'Apenas gramas inteiras — sem decimais, sem kg.', gramInvalid: 'Digite um número inteiro de gramas.',
    compile: 'Compilar Lote', compiling: 'Compilando…',
    locked: 'O Estúdio de Conteúdo é uma superfície do Centro de Comando — desbloqueie o acesso de administrador para compilar.',
    directedNoAthlete: 'Um trabalho Direcionado precisa de um ID de atleta-alvo.',
    tlTitle: 'Linha do Tempo Compilada', clip: 'Clipe', ladder: 'Escada', laneLabel: 'Pista',
    zLabel: 'z', track: 'Faixa', layers: 'camadas', noLayers: 'Nenhuma camada visível neste overlay.',
    demoTag: 'Gramas demo', realTag: 'Ledger real', overrideTag: 'Substituição de gramas',
    statusCompiled: 'Compilado', statusRejected: 'Rejeitado', statusError: 'Erro',
    typeText: 'Texto', typeStat: 'Selo de dado', typeOther: 'Camada',
    emptyResults: 'Compile um lote para ver sua linha do tempo.',
    msUnit: 'ms', durLabel: 'dur',
  },
};

// Localized labels for the gram binding sources (used by the override selector +
// the timeline stat rows). Keyed by source; falls back to the raw source string.
export const SOURCE_LABELS = {
  en: { 'workload.tonnage_g': 'Tonnage', 'metrics.body_mass_g': 'Body mass', 'nutrition.protein_g': 'Protein', 'nutrition.carbs_g': 'Carbs', 'nutrition.fat_g': 'Fat', 'cardio.rehydration_g': 'Rehydration', 'cardio.sweat_loss_g': 'Sweat loss' },
  es: { 'workload.tonnage_g': 'Tonelaje', 'metrics.body_mass_g': 'Masa corporal', 'nutrition.protein_g': 'Proteína', 'nutrition.carbs_g': 'Carbohidratos', 'nutrition.fat_g': 'Grasa', 'cardio.rehydration_g': 'Rehidratación', 'cardio.sweat_loss_g': 'Pérdida de sudor' },
  pt: { 'workload.tonnage_g': 'Tonelagem', 'metrics.body_mass_g': 'Massa corporal', 'nutrition.protein_g': 'Proteína', 'nutrition.carbs_g': 'Carboidratos', 'nutrition.fat_g': 'Gordura', 'cardio.rehydration_g': 'Reidratação', 'cardio.sweat_loss_g': 'Perda de suor' },
};

export function useStudioStr() {
  const { lang } = useLang();
  return {
    ss: STUDIO_STR[lang] || STUDIO_STR.en,
    sourceLabels: SOURCE_LABELS[lang] || SOURCE_LABELS.en,
    lang,
  };
}
