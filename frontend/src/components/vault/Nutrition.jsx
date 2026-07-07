// src/components/vault/Nutrition.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Nutrition Locker — rebuilt (feature/ui-nutrition-rebuild).
//
// The clunky stacked layout is replaced by the prototype's clean, day-by-day
// experience:
//   • CUISINE selector (American / Mexican / Brazilian) swaps the active plan.
//   • Monday → Sunday interactive day-tabs (defaults to today).
//   • A conic-gradient macro wheel + P/C/F/KCAL legend + macro volume-ratio bar.
//   • Tappable meal cards (mark a meal done → the wheel + progress fill).
//   • A client-selectable FASTING PACE (CEO override: intermittent fasting is now
//     fully OPTIONAL). 16/8 is no longer hardcoded — the athlete picks a pace
//     (Off · 12:12 · 14:10 · 16:8 · 18:6 · 20:4) and the eating-window visualiser
//     renders dynamically from that choice. Defaults to Off unless a coach tier is
//     assigned; the selection persists locally per user.
//
// NOTE: the cuisine plans are STATIC MOCK DATA (see cuisineMeals.js) driving the
// UI; per-athlete personalisation of a cuisine plan is a backend follow-up.
// The Mindset Engine has been removed entirely — it does not belong in Nutrition.

import { useEffect, useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLang } from '../../context/LangContext.jsx';
import { parseFastingWindow, parseMealPlan } from '../../lib/vaultApi.js';
import { personalFor } from '../../lib/personalTouches.js';
import {
  rosterCall, updateTargets, compilePlan, toErrorMessage,
  TARGET_MAX, CUISINE_STYLES,
} from '../../lib/rosterApi.js';
import { hasAdminToken } from '../../lib/adminAuth.js';
import AdminTokenGate from '../command/AdminTokenGate.jsx';
import TierGate from '../TierGate.jsx';
import { CUISINES, CUISINE_PLANS, dayTotals, todayIndex } from './cuisineMeals.js';
import { useDailyReadiness } from '../../lib/useDailyReadiness.js';
import { resolveMealArt, MEAL_ART } from './mealArt.js';
import CoachVoiceNote from './CoachVoiceNote.jsx';
import ContextualVoiceover from './ContextualVoiceover.jsx';
import { AUDIO_CTX_NUTRITION } from '../../lib/contextualVoiceover.js';
import { useNutritionSync } from '../../lib/useNutritionSync.js';
import { syncMealLog } from '../../lib/mealLogApi.js';
import NutritionSyncCard from './NutritionSyncCard.jsx';
import { mealBenefit } from './mealBenefit.js';
import './vault.css';
import './nutrition.css';

const DONE_KEY = 'bbf.vault.nut.done.v1';
const PACE_KEY = 'bbf.vault.nut.fastpace.v1';
const HYDRATION_KEY = 'bbf.vault.hydration.v1';
const EMPTY = [];

// ── Hydration tracker helpers ─────────────────────────────────────────────────
const ACTIVITY_LEVELS = [
  { id: 'sedentary', oz: 64 },
  { id: 'light',     oz: 80 },
  { id: 'moderate',  oz: 96 },
  { id: 'active',    oz: 112 },
  { id: 'athlete',   oz: 128 },
];

// EN quick-adds in oz; ES/PT in metric mL (stored oz internally via conversion).
const QUICK_ADD_EN = [
  { label: '8 oz',   oz: 8 },
  { label: '16 oz',  oz: 16 },
  { label: '24 oz',  oz: 24 },
];
const QUICK_ADD_METRIC = [
  { label: '250 mL', oz: 8.45 },
  { label: '500 mL', oz: 16.91 },
  { label: '750 mL', oz: 25.36 },
];

function hydTodayStr() { return new Date().toISOString().slice(0, 10); }
function ozToL(oz) { return (oz * 0.029574).toFixed(2); }

function loadHydration(uid) {
  try {
    const all = JSON.parse(localStorage.getItem(HYDRATION_KEY) || '{}');
    const d = all[uid];
    if (!d || d.date !== hydTodayStr()) return { consumedOz: 0, activityId: 'moderate' };
    return { consumedOz: d.consumedOz ?? 0, activityId: d.activityId ?? 'moderate' };
  } catch { return { consumedOz: 0, activityId: 'moderate' }; }
}

function saveHydration(uid, consumedOz, activityId) {
  try {
    const all = JSON.parse(localStorage.getItem(HYDRATION_KEY) || '{}');
    all[uid] = { date: hydTodayStr(), consumedOz, activityId };
    localStorage.setItem(HYDRATION_KEY, JSON.stringify(all));
    window.dispatchEvent(new CustomEvent('bbf-hydration-update'));
  } catch { /* quota */ }
}

// ── Trilingual UI chrome for the Nutrition Locker ────────────────────────────
// The tri-cuisine meal catalog (CUISINES / CUISINE_PLANS) and the coach roster's
// cuisine styles (CUISINE_STYLES) are shared data and stay as authored; this
// dictionary covers the surface's own headers, labels, and status copy. EN values
// are verbatim to the prior hardcoded strings.
const NUT_STR = {
  en: {
    prepFallback: 'Standard macro preparation.',
    eatingWindow: 'Eating Window', unrestricted: '🍽 Unrestricted',
    offMsg: <>Time-restricted feeding is <b>off</b> — pick a Fasting Pace above to map your eating window.</>,
    fastingWindow: (r) => `${r} Fasting Window`, eating: '🍽 Eating', fastingTag: '🌙 Fasting',
    windowAria: (s, e, inside) => `Eating window ${s} to ${e}. Currently ${inside ? 'inside' : 'outside'} the window.`,
    clockEat: 'left to fuel', clockFast: 'until your window opens',
    paceKicker: 'Fasting Pace', paceNote: 'Time-restricted feeding · optional', paceAria: 'Fasting pace', off: 'Off',
    wheelAria: (c, t) => `${c} of ${t} kcal logged`,
    todaysFuel: 'Today’s Fuel', protein: 'PROTEIN', carbs: 'CARBS', fat: 'FAT', kcal: 'KCAL',
    ratioAria: 'Macro volume ratio', rProtein: (n) => `Protein ${n}%`, rCarbs: (n) => `Carbs ${n}%`, rFat: (n) => `Fat ${n}%`,
    meals: (d, m, p) => `${d} / ${m} meals · ${p}%`,
    prepInstructions: '🍳 Prep Instructions',
    mealAria: (slot, ing, macros, done) => `${slot}: ${ing}.${macros ? ` ${macros}.` : ''} ${done ? 'Completed' : 'Mark complete'}`,
    coachConsole: 'Coach Console', aiStudio: 'AI Performance Studio', studioSurface: 'the AI Performance Studio',
    clientRoster: 'Client Roster', loadingRoster: 'Loading roster…', selectAthlete: 'Select an athlete…',
    selectAria: 'Select an athlete', cuisineStyle: 'Cuisine Style', cuisineAria: 'Cuisine style',
    targetKcal: 'Target KCAL', proteinG: 'Protein (g)', carbsG: 'Carbs (g)', fatsG: 'Fats (g)',
    saveMacros: 'Save Macros', saving: 'Saving…', compilePlan: 'Compile AI Performance Plan', compiling: 'Compiling…',
    macrosSaved: 'Macro targets saved.',
    compiled: (days, cuisine, persisted) => `Compiled — ${days}-day ${cuisine} plan generated${persisted ? ' and saved to the athlete' : ''}.`,
    consoleHint: 'Select an athlete to set their cuisine, macro targets, and recompile their plan.',
    loadingAthlete: (n) => `Loading ${n}…`, athlete: 'athlete',
    nutritionPlan: 'Nutrition Plan', metaLive: 'Your coach-generated fueling protocol', metaStatic: 'Your personalized 7-day meal plan',
    planSource: 'Plan Source', liveCoachPlan: '◆ Live Coach Plan',
    calPerDay: 'kcal / day', planDayAria: 'Plan day', dayOfWeekAria: 'Day of week',
    mealHint: 'Tap a meal to log it — your fuel wheel fills as you go.',
    liveLabel: 'Your Coach’s Plan', liveGoalFallback: 'Personalized fueling protocol',
    // Readiness Fuel Profile — the engine's daily macro pivot (biometric ledger).
    fpKicker: 'Readiness Fuel Profile',
    fpPerf: 'Performance Macros', fpRec: 'Recovery Macros', fpAdapt: 'Adaptive Macros',
    fpPerfSub: 'Cleared for output — high-carbohydrate fueling drives today’s training volume.',
    fpRecSub: 'CNS breach — fuel pivots high-fat, high-protein and anti-inflammatory to rebuild the system. Carbohydrates are pulled back until readiness recovers.',
    fpAdaptSub: 'System under strain — carbohydrates taper toward recovery fueling while protein holds the floor.',
    fpScore: (s) => `Readiness ${s == null ? '—' : s}/100`,
    fpSplit: 'Target split', fpStale: 'Synced',
    // Meal-logged benefit note (Layer 1 all tiers · Layer 2 readiness-gated)
    benefitKicker: 'Why this fuels you',
    // Daily Fueling Status (Fuel Performance+)
    fsKicker: 'Daily Fueling Status', fsToday: 'Today', fsWeek: '7-day adherence',
    fsMacro: { p: 'Protein', c: 'Carbs', f: 'Fat', kcal: 'Energy' },
    fsPct: (n) => `${n}%`,
    fsSummary: (p) => (p >= 90
      ? 'Dialed in — protein’s covered and your fuel is on target. Keep it here.'
      : p >= 60
        ? 'Protein’s on its way — close the gap to lock in today’s repair.'
        : 'Fuel’s light so far — log your meals to hit today’s repair and energy.'),
    fsLock: 'Daily Fueling Status',
    // Periodized fuel timing (Fuel Sovereign)
    perKicker: 'Periodized Fuel Timing', perLock: 'Periodized Fuel Timing',
    perCalibrating: 'Your Sovereign timing windows are calibrating — keep logging and the engine will schedule your fuel across the day.',
    perWindow: 'Window',
    hydKicker: 'Daily Hydration', hydActivity: 'Activity Level',
    hydLevels: { sedentary: 'Sedentary', light: 'Light', moderate: 'Moderate', active: 'Active', athlete: 'Athlete' },
    hydReset: 'Reset', hydGoalHit: 'Goal hit!',
    hydLogged: 'Logged', hydOf: 'of',
  },
  es: {
    prepFallback: 'Preparación estándar de macros.',
    eatingWindow: 'Ventana de Alimentación', unrestricted: '🍽 Sin Restricción',
    offMsg: <>La alimentación con restricción horaria está <b>desactivada</b> — elige un Ritmo de Ayuno arriba para mapear tu ventana de alimentación.</>,
    fastingWindow: (r) => `Ventana de Ayuno ${r}`, eating: '🍽 Comiendo', fastingTag: '🌙 Ayunando',
    windowAria: (s, e, inside) => `Ventana de alimentación de ${s} a ${e}. Actualmente ${inside ? 'dentro' : 'fuera'} de la ventana.`,
    clockEat: 'para alimentarte', clockFast: 'hasta que se abra tu ventana',
    paceKicker: 'Ritmo de Ayuno', paceNote: 'Alimentación con restricción horaria · opcional', paceAria: 'Ritmo de ayuno', off: 'Off',
    wheelAria: (c, t) => `${c} de ${t} kcal registradas`,
    todaysFuel: 'Combustible de Hoy', protein: 'PROTEÍNA', carbs: 'CARBOS', fat: 'GRASA', kcal: 'KCAL',
    ratioAria: 'Proporción de volumen de macros', rProtein: (n) => `Proteína ${n}%`, rCarbs: (n) => `Carbos ${n}%`, rFat: (n) => `Grasa ${n}%`,
    meals: (d, m, p) => `${d} / ${m} comidas · ${p}%`,
    prepInstructions: '🍳 Instrucciones de Preparación',
    mealAria: (slot, ing, macros, done) => `${slot}: ${ing}.${macros ? ` ${macros}.` : ''} ${done ? 'Completado' : 'Marcar completado'}`,
    coachConsole: 'Consola del Coach', aiStudio: 'Estudio de Rendimiento IA', studioSurface: 'el Estudio de Rendimiento IA',
    clientRoster: 'Lista de Clientes', loadingRoster: 'Cargando lista…', selectAthlete: 'Selecciona un atleta…',
    selectAria: 'Selecciona un atleta', cuisineStyle: 'Estilo de Cocina', cuisineAria: 'Estilo de cocina',
    targetKcal: 'KCAL Objetivo', proteinG: 'Proteína (g)', carbsG: 'Carbos (g)', fatsG: 'Grasas (g)',
    saveMacros: 'Guardar Macros', saving: 'Guardando…', compilePlan: 'Compilar Plan de Rendimiento IA', compiling: 'Compilando…',
    macrosSaved: 'Objetivos de macros guardados.',
    compiled: (days, cuisine, persisted) => `Compilado — plan ${cuisine} de ${days} días generado${persisted ? ' y guardado en el atleta' : ''}.`,
    consoleHint: 'Selecciona un atleta para definir su cocina, objetivos de macros y recompilar su plan.',
    loadingAthlete: (n) => `Cargando ${n}…`, athlete: 'atleta',
    nutritionPlan: 'Plan de Nutrición', metaLive: 'Tu protocolo de combustible generado por el coach', metaStatic: 'Tu plan de comidas personalizado de 7 días',
    planSource: 'Fuente del Plan', liveCoachPlan: '◆ Plan del Coach en Vivo',
    calPerDay: 'kcal / día', planDayAria: 'Día del plan', dayOfWeekAria: 'Día de la semana',
    mealHint: 'Toca una comida para registrarla — tu rueda de combustible se llena a medida que avanzas.',
    liveLabel: 'El Plan de Tu Coach', liveGoalFallback: 'Protocolo de combustible personalizado',
    fpKicker: 'Perfil de Combustible por Preparación',
    fpPerf: 'Macros de Rendimiento', fpRec: 'Macros de Recuperación', fpAdapt: 'Macros Adaptativos',
    fpPerfSub: 'Autorizado para rendir — la carga alta de carbohidratos impulsa el volumen de entrenamiento de hoy.',
    fpRecSub: 'Brecha del SNC — la nutrición pivota a alta grasa, alta proteína y antiinflamatoria para reconstruir el sistema. Los carbohidratos se reducen hasta que la preparación se recupere.',
    fpAdaptSub: 'Sistema en tensión — los carbohidratos bajan hacia una nutrición de recuperación mientras la proteína sostiene la base.',
    fpScore: (s) => `Preparación ${s == null ? '—' : s}/100`,
    fpSplit: 'Distribución objetivo', fpStale: 'Sincronizado',
    benefitKicker: 'Por qué te alimenta',
    fsKicker: 'Estado de Combustible Diario', fsToday: 'Hoy', fsWeek: 'Adherencia de 7 días',
    fsMacro: { p: 'Proteína', c: 'Carbos', f: 'Grasa', kcal: 'Energía' },
    fsPct: (n) => `${n}%`,
    fsSummary: (p) => (p >= 90
      ? 'En punto — la proteína está cubierta y tu combustible va en objetivo. Mantenlo así.'
      : p >= 60
        ? 'La proteína va en camino — cierra la brecha para asegurar la reparación de hoy.'
        : 'Vas ligero de combustible — registra tus comidas para lograr la reparación y energía de hoy.'),
    fsLock: 'Estado de Combustible Diario',
    perKicker: 'Temporización de Combustible Periodizada', perLock: 'Temporización de Combustible Periodizada',
    perCalibrating: 'Tus ventanas de temporización Soberanas se están calibrando — sigue registrando y el motor programará tu combustible a lo largo del día.',
    perWindow: 'Ventana',
    hydKicker: 'Hidratación Diaria', hydActivity: 'Nivel de Actividad',
    hydLevels: { sedentary: 'Sedentario', light: 'Leve', moderate: 'Moderado', active: 'Activo', athlete: 'Atleta' },
    hydReset: 'Reiniciar', hydGoalHit: '¡Meta alcanzada!',
    hydLogged: 'Registrado', hydOf: 'de',
  },
  pt: {
    prepFallback: 'Preparação padrão de macros.',
    eatingWindow: 'Janela de Alimentação', unrestricted: '🍽 Sem Restrição',
    offMsg: <>A alimentação com restrição de horário está <b>desativada</b> — escolha um Ritmo de Jejum acima para mapear sua janela de alimentação.</>,
    fastingWindow: (r) => `Janela de Jejum ${r}`, eating: '🍽 Comendo', fastingTag: '🌙 Jejuando',
    windowAria: (s, e, inside) => `Janela de alimentação de ${s} a ${e}. Atualmente ${inside ? 'dentro' : 'fora'} da janela.`,
    clockEat: 'para se alimentar', clockFast: 'até sua janela abrir',
    paceKicker: 'Ritmo de Jejum', paceNote: 'Alimentação com restrição de horário · opcional', paceAria: 'Ritmo de jejum', off: 'Off',
    wheelAria: (c, t) => `${c} de ${t} kcal registradas`,
    todaysFuel: 'Combustível de Hoje', protein: 'PROTEÍNA', carbs: 'CARBOS', fat: 'GORDURA', kcal: 'KCAL',
    ratioAria: 'Proporção de volume de macros', rProtein: (n) => `Proteína ${n}%`, rCarbs: (n) => `Carbos ${n}%`, rFat: (n) => `Gordura ${n}%`,
    meals: (d, m, p) => `${d} / ${m} refeições · ${p}%`,
    prepInstructions: '🍳 Instruções de Preparo',
    mealAria: (slot, ing, macros, done) => `${slot}: ${ing}.${macros ? ` ${macros}.` : ''} ${done ? 'Concluído' : 'Marcar concluído'}`,
    coachConsole: 'Console do Coach', aiStudio: 'Estúdio de Performance IA', studioSurface: 'o Estúdio de Performance IA',
    clientRoster: 'Lista de Clientes', loadingRoster: 'Carregando lista…', selectAthlete: 'Selecione um atleta…',
    selectAria: 'Selecione um atleta', cuisineStyle: 'Estilo de Culinária', cuisineAria: 'Estilo de culinária',
    targetKcal: 'KCAL Alvo', proteinG: 'Proteína (g)', carbsG: 'Carbos (g)', fatsG: 'Gorduras (g)',
    saveMacros: 'Salvar Macros', saving: 'Salvando…', compilePlan: 'Compilar Plano de Performance IA', compiling: 'Compilando…',
    macrosSaved: 'Metas de macros salvas.',
    compiled: (days, cuisine, persisted) => `Compilado — plano ${cuisine} de ${days} dias gerado${persisted ? ' e salvo no atleta' : ''}.`,
    consoleHint: 'Selecione um atleta para definir sua culinária, metas de macros e recompilar seu plano.',
    loadingAthlete: (n) => `Carregando ${n}…`, athlete: 'atleta',
    nutritionPlan: 'Plano de Nutrição', metaLive: 'Seu protocolo de combustível gerado pelo coach', metaStatic: 'Seu plano de refeições personalizado de 7 dias',
    planSource: 'Fonte do Plano', liveCoachPlan: '◆ Plano do Coach ao Vivo',
    calPerDay: 'kcal / dia', planDayAria: 'Dia do plano', dayOfWeekAria: 'Dia da semana',
    mealHint: 'Toque em uma refeição para registrá-la — sua roda de combustível enche conforme você avança.',
    liveLabel: 'O Plano do Seu Coach', liveGoalFallback: 'Protocolo de combustível personalizado',
    fpKicker: 'Perfil de Combustível por Prontidão',
    fpPerf: 'Macros de Performance', fpRec: 'Macros de Recuperação', fpAdapt: 'Macros Adaptativos',
    fpPerfSub: 'Liberado para render — a carga alta de carboidratos impulsiona o volume de treino de hoje.',
    fpRecSub: 'Violação do SNC — a nutrição pivota para alta gordura, alta proteína e anti-inflamatória para reconstruir o sistema. Os carboidratos recuam até a prontidão se recuperar.',
    fpAdaptSub: 'Sistema em tensão — os carboidratos descem rumo à nutrição de recuperação enquanto a proteína segura a base.',
    fpScore: (s) => `Prontidão ${s == null ? '—' : s}/100`,
    fpSplit: 'Divisão alvo', fpStale: 'Sincronizado',
    benefitKicker: 'Por que isto te alimenta',
    fsKicker: 'Status de Combustível Diário', fsToday: 'Hoje', fsWeek: 'Aderência de 7 dias',
    fsMacro: { p: 'Proteína', c: 'Carbos', f: 'Gordura', kcal: 'Energia' },
    fsPct: (n) => `${n}%`,
    fsSummary: (p) => (p >= 90
      ? 'No ponto — a proteína está coberta e seu combustível está na meta. Mantenha assim.'
      : p >= 60
        ? 'A proteína está a caminho — feche a lacuna para garantir o reparo de hoje.'
        : 'Você está leve de combustível — registre suas refeições para atingir o reparo e a energia de hoje.'),
    fsLock: 'Status de Combustível Diário',
    perKicker: 'Temporização de Combustível Periodizada', perLock: 'Temporização de Combustível Periodizada',
    perCalibrating: 'Suas janelas de temporização Soberanas estão calibrando — continue registrando e o motor programará seu combustível ao longo do dia.',
    perWindow: 'Janela',
    hydKicker: 'Hidratação Diária', hydActivity: 'Nível de Atividade',
    hydLevels: { sedentary: 'Sedentário', light: 'Leve', moderate: 'Moderado', active: 'Ativo', athlete: 'Atleta' },
    hydReset: 'Reiniciar', hydGoalHit: 'Meta atingida!',
    hydLogged: 'Registrado', hydOf: 'de',
  },
};

// Localized short labels for the fasting-pace chips (keyed by lang → pace id). The
// fast/eat hour constants stay in FASTING_PACES; only the descriptor is localized.
const PACE_SHORT = {
  en: { off: 'Disabled', '12:12': 'Circadian', '14:10': 'Primer', '16:8': 'Standard', '18:6': 'Advanced', '20:4': 'Warrior' },
  es: { off: 'Desactivado', '12:12': 'Circadiano', '14:10': 'Iniciación', '16:8': 'Estándar', '18:6': 'Avanzado', '20:4': 'Guerrero' },
  pt: { off: 'Desativado', '12:12': 'Circadiano', '14:10': 'Iniciação', '16:8': 'Padrão', '18:6': 'Avançado', '20:4': 'Guerreiro' },
};

function useNutStr() {
  const { lang } = useLang();
  return { tr: NUT_STR[lang] || NUT_STR.en, paceShort: PACE_SHORT[lang] || PACE_SHORT.en };
}

// Macro accent colours (legend boxes + volume-ratio segments).
const MACRO_COLORS = { p: '#ff5d5d', c: '#4dc3ff', f: '#ffb547' };

// Shared brand-locked card chrome for the adherence surfaces (inline to avoid CSS
// churn; mirrors the personal-note card's purple→void gradient + gold hairline).
const CARD_WRAP = { background: 'linear-gradient(180deg, rgba(106,13,173,.22), rgba(9,9,9,.25))', border: '1px solid rgba(245,200,0,.35)', borderRadius: 12, padding: '14px 16px', margin: '0 0 14px' };
const CARD_KICK = { fontFamily: 'var(--hb,"Barlow Condensed")', fontSize: '.66rem', letterSpacing: '2.5px', textTransform: 'uppercase', color: '#f5c800', marginBottom: 6 };
const CARD_TITLE = { fontFamily: 'var(--display,"Bebas Neue")', fontStyle: 'italic', fontSize: '1.3rem', lineHeight: 1.05, color: '#f9f5ff', margin: '0 0 6px' };
const CARD_SUB = { fontFamily: 'var(--bd,"Barlow Condensed")', fontSize: '.92rem', lineHeight: 1.5, color: 'rgba(255,255,255,.86)', margin: '0 0 10px' };

// ── Fasting Pace (CEO override: intermittent fasting is OPTIONAL) ─────────────
// The full menu of time-restricted-feeding intervals. `off` is the default state
// for clients not fasting (no eating-window restriction). fast + eat = 24h so the
// shape matches parseFastingWindow()'s { fast, eat } contract verbatim.
const FASTING_PACES = [
  { id: 'off',   short: 'Disabled',  fast: 0,  eat: 24 },
  { id: '12:12', short: 'Circadian', fast: 12, eat: 12 },
  { id: '14:10', short: 'Primer',    fast: 14, eat: 10 },
  { id: '16:8',  short: 'Standard',  fast: 16, eat: 8 },
  { id: '18:6',  short: 'Advanced',  fast: 18, eat: 6 },
  { id: '20:4',  short: 'Warrior',   fast: 20, eat: 4 },
];

// Map a parsed { fast, eat } window onto a known pace id (for seeding the selector
// from a coach-assigned metabolic tier). Returns null when there is no match.
function paceIdFromWindow(win) {
  if (!win) return null;
  const hit = FASTING_PACES.find((p) => p.id !== 'off' && p.fast === win.fast && p.eat === win.eat);
  return hit ? hit.id : null;
}

function fmtHM(hoursFloat) {
  const h = Math.floor(hoursFloat);
  const m = Math.round((hoursFloat - h) * 60);
  return `${h}h ${String(m).padStart(2, '0')}m`;
}
function fmtClock(hour24) {
  const h = ((hour24 % 24) + 24) % 24;
  const ampm = h < 12 ? 'a' : 'p';
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}${ampm}`;
}
function isSnack(slot) {
  return /snack|lanche|ceia/i.test(slot || '');
}

// ── Done-state persistence (one node per uid → { cuisine: { day: idx[] } }) ───
function readUserDone(uid) {
  try {
    const all = JSON.parse(localStorage.getItem(DONE_KEY) || '{}');
    return all?.[uid] && typeof all[uid] === 'object' ? all[uid] : {};
  } catch { return {}; }
}
function writeUserDone(uid, node) {
  try {
    const all = JSON.parse(localStorage.getItem(DONE_KEY) || '{}');
    all[uid] = node;
    localStorage.setItem(DONE_KEY, JSON.stringify(all));
  } catch { /* private-mode / quota — value holds in component state */ }
}

// ── Fasting-pace persistence (one node per uid → paceId) ─────────────────────
function readUserPace(uid) {
  try {
    const all = JSON.parse(localStorage.getItem(PACE_KEY) || '{}');
    const id = all?.[uid];
    return FASTING_PACES.some((p) => p.id === id) ? id : null;
  } catch { return null; }
}
function writeUserPace(uid, paceId) {
  try {
    const all = JSON.parse(localStorage.getItem(PACE_KEY) || '{}');
    all[uid] = paceId;
    localStorage.setItem(PACE_KEY, JSON.stringify(all));
  } catch { /* private-mode / quota — value holds in component state */ }
}

// ── Fasting-window visualiser (dynamic, current-time aware) ──────────────────
// `fasting` is null when the pace is Off — time-restricted feeding is optional,
// so this renders an "unrestricted" state rather than a "not assigned" error.
function FastingWindow({ now, fasting, tier }) {
  const { tr } = useNutStr();
  if (!fasting) {
    return (
      <div className="nl-fast-window is-off">
        <div className="pg-fast-top">
          <span className="pg-fast-title">{tr.eatingWindow}</span>
          <span className="pg-fast-status is-eating">{tr.unrestricted}</span>
        </div>
        <div className="nl-fast-offmsg">{tr.offMsg}</div>
      </div>
    );
  }

  const eatEnd = 20;                 // 8pm dinner cutoff (presentation anchor)
  const eatStart = eatEnd - fasting.eat;
  const h = now.getHours() + now.getMinutes() / 60;
  const eating = h >= eatStart && h < eatEnd;
  const nowPct = (h / 24) * 100;
  const winLeft = (eatStart / 24) * 100;
  const winWidth = (fasting.eat / 24) * 100;
  const ratioLabel = `${fasting.fast} / ${fasting.eat}`;

  // Phase 4 — isolate the live countdown from the prose so it reads as a clock.
  let clock; let clockLbl;
  if (eating) {
    clock = fmtHM(eatEnd - h);
    clockLbl = tr.clockEat;
  } else {
    const until = h < eatStart ? eatStart - h : (24 - h) + eatStart;
    clock = fmtHM(until);
    clockLbl = tr.clockFast;
  }

  return (
    <div className="nl-fast-window">
      <div className="pg-fast-top">
        <span className="pg-fast-title">{tr.fastingWindow(ratioLabel)}</span>
        <span className={`pg-fast-status ${eating ? 'is-eating' : 'is-fasting'}`}>
          {eating ? tr.eating : tr.fastingTag}
        </span>
      </div>
      <div className="pg-fast-track" role="img" aria-label={tr.windowAria(fmtClock(eatStart), fmtClock(eatEnd), eating)}>
        <div className="pg-fast-window" style={{ left: `${winLeft}%`, width: `${winWidth}%` }} />
        <div className="pg-fast-now" style={{ left: `${nowPct}%` }} />
      </div>
      <div className="pg-fast-axis">
        <span>12a</span><span>6a</span><span>12p</span><span>6p</span><span>12a</span>
      </div>
      <div className="nl-fast-clockrow">
        <div className="nl-fast-clock" data-testid="fasting-clock">
          <span className="nl-fast-clock-time">{clock}</span>
          <span className="nl-fast-clock-lbl">{clockLbl}</span>
        </div>
        {tier ? <span className="pg-fast-tier">{tier}</span> : null}
      </div>
    </div>
  );
}

// ── Fasting Pace card — the client-controlled selector + the live window ─────
// The selector is the single source of truth for the displayed eating window;
// 16/8 is just one option, never a hardcoded default.
function FastingPaceCard({ now, paceId, onSelectPace, tier }) {
  const { tr, paceShort } = useNutStr();
  const selected = FASTING_PACES.find((p) => p.id === paceId) || FASTING_PACES[0];
  const fasting = selected.id === 'off' ? null : { fast: selected.fast, eat: selected.eat };

  return (
    <div className="pg-card nl-fast">
      <div className="nl-fast-head">
        <span className="nl-fast-kicker">{tr.paceKicker}</span>
        <span className="nl-fast-note">{tr.paceNote}</span>
      </div>

      <div className="nl-pace" role="radiogroup" aria-label={tr.paceAria}>
        {FASTING_PACES.map((p) => {
          const active = p.id === paceId;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={active}
              className={`nl-pace-chip${active ? ' is-active' : ''}${p.id === 'off' ? ' is-off' : ''}`}
              onClick={() => onSelectPace(p.id)}
            >
              <span className="nl-pace-ratio">{p.id === 'off' ? tr.off : p.id}</span>
              <span className="nl-pace-desc">{paceShort[p.id] || p.short}</span>
            </button>
          );
        })}
      </div>

      <FastingWindow now={now} fasting={fasting} tier={tier} />
    </div>
  );
}

// ── Conic macro wheel — consumed vs target (fills as meals are completed) ─────
function MacroWheel({ consumed, target }) {
  const { tr } = useNutStr();
  const hasTarget = target > 0;
  const frac = hasTarget ? Math.min(consumed / target, 1) : 0;
  const over = hasTarget && consumed > target;
  const deg = frac * 360;
  const ring = hasTarget
    ? `conic-gradient(from 0deg, var(--purp), var(--yel) ${deg}deg, #241a32 ${deg}deg 360deg)`
    : 'conic-gradient(#241a32 0 100%)';
  const pct = hasTarget ? Math.round((consumed / target) * 100) : 0;

  return (
    <div className="nl-wheel" role="img" aria-label={tr.wheelAria(consumed, target)}>
      <div className="nl-wheel-ring" style={{ background: ring }} />
      <div className="nl-wheel-hole">
        <span className="nl-wheel-kcal">{consumed.toLocaleString()}</span>
        <span className="nl-wheel-sub">/ {target.toLocaleString()} kcal</span>
        {hasTarget ? <span className={`nl-wheel-pct${over ? ' is-over' : ''}`}>{pct}%</span> : null}
      </div>
    </div>
  );
}

// ── Daily fuel card · wheel + P/C/F/KCAL legend + volume-ratio bar ───────────
function DailyFuel({ consumed, totals, doneCount, mealCount }) {
  const { tr } = useNutStr();
  const legend = [
    { k: 'p', lbl: tr.protein, cur: consumed.p, tgt: totals.p, u: 'g', color: MACRO_COLORS.p },
    { k: 'c', lbl: tr.carbs, cur: consumed.c, tgt: totals.c, u: 'g', color: MACRO_COLORS.c },
    { k: 'f', lbl: tr.fat, cur: consumed.f, tgt: totals.f, u: 'g', color: MACRO_COLORS.f },
    { k: 'kcal', lbl: tr.kcal, cur: consumed.kcal, tgt: totals.kcal, u: '', color: 'var(--yel)' },
  ];

  // Macro volume ratio (share of total calories) — the day's composition.
  const pCal = totals.p * 4;
  const cCal = totals.c * 4;
  const fCal = totals.f * 9;
  const calSum = pCal + cCal + fCal || 1;
  const ratio = {
    p: Math.round((pCal / calSum) * 100),
    c: Math.round((cCal / calSum) * 100),
    f: Math.round((fCal / calSum) * 100),
  };

  const progPct = mealCount ? Math.round((doneCount / mealCount) * 100) : 0;

  return (
    <div className="pg-card">
      <div className="nl-fuel-title">{tr.todaysFuel}</div>

      {/* FRONT 4 · "Breaking the Loop" — Fuel Science: TDEE/macro framing, beside the wheel. */}
      <CoachVoiceNote module="fuel" />

      <MacroWheel consumed={consumed.kcal} target={totals.kcal} />

      <div className="nl-legend">
        {legend.map((m) => (
          <div key={m.k} className="nl-legend-box" style={{ borderTopColor: m.color }}>
            <div className="nl-legend-lbl">{m.lbl}</div>
            <div className="nl-legend-val">{m.cur.toLocaleString()}{m.u}</div>
            <div className="nl-legend-tgt">/ {m.tgt.toLocaleString()}{m.u}</div>
          </div>
        ))}
      </div>

      <div className="nl-ratio" aria-label={tr.ratioAria}>
        <div className="nl-ratio-track">
          <div className="nl-ratio-seg" style={{ width: `${ratio.p}%`, background: MACRO_COLORS.p }} />
          <div className="nl-ratio-seg" style={{ width: `${ratio.c}%`, background: MACRO_COLORS.c }} />
          <div className="nl-ratio-seg" style={{ width: `${ratio.f}%`, background: MACRO_COLORS.f }} />
        </div>
        <div className="nl-ratio-legend">
          <span className="nl-ratio-key"><span className="nl-ratio-dot" style={{ background: MACRO_COLORS.p }} />{tr.rProtein(ratio.p)}</span>
          <span className="nl-ratio-key"><span className="nl-ratio-dot" style={{ background: MACRO_COLORS.c }} />{tr.rCarbs(ratio.c)}</span>
          <span className="nl-ratio-key"><span className="nl-ratio-dot" style={{ background: MACRO_COLORS.f }} />{tr.rFat(ratio.f)}</span>
        </div>
      </div>

      <div className="nl-mealprog">
        <span className="nl-mealprog-lbl">{tr.meals(doneCount, mealCount, progPct)}</span>
        <div className="nl-mealprog-track">
          <div className="nl-mealprog-fill" style={{ width: `${progPct}%` }} />
        </div>
      </div>
    </div>
  );
}

// ── Meal-logged benefit note — Layer 1 (all tiers, goal/macro-framed) + Layer 2
//    (readiness-framed, appended only when the athlete HAS readiness telemetry). ──
function MealBenefitNote({ note }) {
  const { tr } = useNutStr();
  if (!note) return null;
  return (
    <div className="pg-card" data-testid="meal-benefit-note" style={CARD_WRAP}>
      <div style={CARD_KICK}>♥ {tr.benefitKicker}</div>
      <div style={CARD_TITLE}>{note.title}</div>
      <p style={{ ...CARD_SUB, margin: 0 }}>{note.body}</p>
    </div>
  );
}

// ── Daily Fueling Status — Fuel Performance+ (adherence vs the canonical daily
//    targets + a 7-day kcal-adherence strip). Gated by <TierGate>. ──────────────
function FuelingStatus({ consumed, target, weekAdherence }) {
  const { tr } = useNutStr();
  const pct = (cur, tgt) => (tgt > 0 ? Math.round((cur / tgt) * 100) : 0);
  const rows = [
    { k: 'p', lbl: tr.fsMacro.p, v: pct(consumed.p, target.p), color: MACRO_COLORS.p },
    { k: 'c', lbl: tr.fsMacro.c, v: pct(consumed.c, target.c), color: MACRO_COLORS.c },
    { k: 'f', lbl: tr.fsMacro.f, v: pct(consumed.f, target.f), color: MACRO_COLORS.f },
    { k: 'kcal', lbl: tr.fsMacro.kcal, v: pct(consumed.kcal, target.kcal), color: '#f5c800' },
  ];
  return (
    <div className="pg-card" data-testid="nutrition-fueling-status" style={CARD_WRAP}>
      <div style={CARD_KICK}>◆ {tr.fsKicker}</div>
      <p style={CARD_SUB}>{tr.fsSummary(rows[0].v)}</p>
      <div style={{ display: 'grid', gap: 8 }}>
        {rows.map((r) => (
          <div key={r.k} style={{ display: 'grid', gridTemplateColumns: '68px 1fr 44px', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'var(--bd,"Barlow Condensed")', fontSize: '.8rem', color: 'rgba(255,255,255,.8)' }}>{r.lbl}</span>
            <span style={{ position: 'relative', height: 8, borderRadius: 999, background: 'rgba(255,255,255,.10)', overflow: 'hidden' }}>
              <span style={{ position: 'absolute', inset: 0, width: `${Math.min(r.v, 100)}%`, background: r.color, borderRadius: 999 }} />
            </span>
            <span style={{ fontFamily: 'var(--hb,"Barlow Condensed")', fontSize: '.85rem', textAlign: 'right', color: '#f5c800' }}>{tr.fsPct(r.v)}</span>
          </div>
        ))}
      </div>
      {weekAdherence?.length ? (
        <div data-testid="nutrition-week-adherence" style={{ marginTop: 12 }}>
          <span style={{ ...CARD_KICK, marginBottom: 4, display: 'block' }}>{tr.fsWeek}</span>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 44 }}>
            {weekAdherence.map((d, i) => (
              <div key={i} title={`${d.day}: ${d.pct}%`} style={{ flex: 1, display: 'flex', alignItems: 'flex-end', height: '100%' }}>
                <div style={{ width: '100%', height: `${Math.max(Math.min(d.pct, 100), 3)}%`, background: d.pct >= 90 ? '#f5c800' : d.pct >= 50 ? '#6a0dad' : 'rgba(106,13,173,.45)', borderRadius: 3 }} />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── Periodized Fuel Timing — Fuel Sovereign (the Tier-3 timing_plan windows).
//    Gated by <TierGate>; renders a calibrating state until the engine schedules. ──
function PeriodizedPlan({ timingPlan }) {
  const { tr } = useNutStr();
  const windows = Array.isArray(timingPlan)
    ? timingPlan
    : (Array.isArray(timingPlan?.windows) ? timingPlan.windows : []);
  return (
    <div className="pg-card" data-testid="nutrition-periodization" style={CARD_WRAP}>
      <div style={CARD_KICK}>◆ {tr.perKicker}</div>
      {windows.length ? (
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
          {windows.map((w, i) => {
            const macros = [
              w.protein_g != null ? `${w.protein_g}P` : null,
              w.carbs_g != null ? `${w.carbs_g}C` : null,
              w.fat_g != null ? `${w.fat_g}F` : null,
            ].filter(Boolean).join(' / ');
            return (
              <li key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,.05)' }}>
                <span style={{ fontFamily: 'var(--bd,"Barlow Condensed")', fontSize: '.9rem', color: '#f9f5ff' }}>
                  {w.label || w.name || `${tr.perWindow} ${i + 1}`}{w.time ? ` · ${w.time}` : ''}
                </span>
                {macros ? <span style={{ fontFamily: 'var(--hb,"Barlow Condensed")', fontSize: '.82rem', color: '#f5c800' }}>{macros}</span> : null}
              </li>
            );
          })}
        </ol>
      ) : (
        <p style={{ ...CARD_SUB, margin: 0 }} data-testid="nutrition-periodization-calibrating">{tr.perCalibrating}</p>
      )}
    </div>
  );
}

// ── Readiness Fuel Profile — the engine's daily macro pivot, rendered ─────────
// Reads the SAME stored verdict the workout grid regulates from (bbf_daily_
// protocols via useDailyReadiness): a CNS breach pivots the athlete from high-
// carbohydrate Performance Macros to high-fat / high-protein anti-inflammatory
// Recovery Macros, and this card renders the pivot — state hero art, the ACCURATE
// target distribution bar straight from the protocol's carb/fat/protein columns,
// and the clinical why. Hidden entirely without fresh telemetry (no mock state).
function FuelProfile({ readiness }) {
  const { tr } = useNutStr();
  if (!readiness?.hasData) return null;

  const breach = readiness.isBreach || readiness.mode === 'SYSTEM_BREACH';
  const strained = readiness.mode === 'SYSTEM_STRAIN';
  const state = breach ? 'recovery' : strained ? 'adaptive' : 'performance';
  const title = breach ? tr.fpRec : strained ? tr.fpAdapt : tr.fpPerf;
  const sub = breach ? tr.fpRecSub : strained ? tr.fpAdaptSub : tr.fpPerfSub;
  // State hero — premium art keyed to the fuel emphasis: carbohydrate bowl for
  // performance, lean chicken plate for adaptive, omega-rich fish for recovery.
  const hero = breach ? MEAL_ART.fish : strained ? MEAL_ART.chicken : MEAL_ART.bowl;

  const carb = Number(readiness.carb);
  const fat = Number(readiness.fat);
  const protein = Number(readiness.protein);
  const hasSplit = Number.isFinite(carb) && Number.isFinite(fat) && Number.isFinite(protein);

  return (
    <div className={`nl-fp is-${state}`} data-testid="nutrition-fuel-profile">
      <span className="nl-fp-art" aria-hidden="true"><img src={hero} alt="" loading="lazy" /></span>
      <div className="nl-fp-body">
        <div className="nl-fp-top">
          <span className="nl-fp-kicker">{tr.fpKicker}</span>
          <span className="nl-fp-score">{tr.fpScore(readiness.score)}</span>
          {readiness.date ? <span className="nl-fp-stamp">{tr.fpStale} · {readiness.date}</span> : null}
        </div>
        <div className="nl-fp-title">{title}</div>
        <p className="nl-fp-sub">{sub}</p>
        {hasSplit ? (
          <div className="nl-fp-split">
            <span className="nl-fp-split-lbl">{tr.fpSplit}</span>
            <div className="nl-ratio-track">
              <div className="nl-ratio-seg" style={{ width: `${protein}%`, background: MACRO_COLORS.p }} />
              <div className="nl-ratio-seg" style={{ width: `${carb}%`, background: MACRO_COLORS.c }} />
              <div className="nl-ratio-seg" style={{ width: `${fat}%`, background: MACRO_COLORS.f }} />
            </div>
            <div className="nl-ratio-legend">
              <span className="nl-ratio-key"><span className="nl-ratio-dot" style={{ background: MACRO_COLORS.p }} />{tr.rProtein(protein)}</span>
              <span className="nl-ratio-key"><span className="nl-ratio-dot" style={{ background: MACRO_COLORS.c }} />{tr.rCarbs(carb)}</span>
              <span className="nl-ratio-key"><span className="nl-ratio-dot" style={{ background: MACRO_COLORS.f }} />{tr.rFat(fat)}</span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ── Meal thumbnail — explicit, build-verified asset routing ───────────────────
// Resolution order: (1) a real per-meal image_url from a live coach plan,
// (2) the archetype-matched premium artwork (resolveMealArt — a statically
// imported, Vite-fingerprinted SVG that cannot 404), (3) the BBF wireframe as
// the terminal guard. With layer (2) in place every catalog meal renders real
// art — the unmapped-asset placeholder state is retired from the happy path.
function MealThumb({ src, art }) {
  const [broken, setBroken] = useState(false);
  const url = (src || '').trim();
  if (url && !broken) {
    return (
      <span className="nl-meal-thumb">
        <img src={url} alt="" loading="lazy" onError={() => setBroken(true)} />
      </span>
    );
  }
  if (art) {
    return (
      <span className="nl-meal-thumb nl-meal-thumb--art">
        <img src={art} alt="" loading="lazy" />
      </span>
    );
  }
  return (
    <span className="nl-meal-thumb nl-meal-thumb--ph" aria-hidden="true">
      <span className="nl-meal-thumb-mark">BBF</span>
    </span>
  );
}

// Accept an instructions ARRAY or a newline-delimited STRING → clean step list.
function normalizeInstructions(instructions) {
  if (Array.isArray(instructions)) {
    return instructions.map((s) => String(s || '').trim()).filter(Boolean);
  }
  if (typeof instructions === 'string') {
    return instructions.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

// Short day-pill label: weekday → first 3 chars ("Monday"→"Mon"); a generated
// "Day 1"…"Day 7" → "D1"…"D7" (so a live plan's pills don't all read "Day").
function shortDayLabel(day) {
  const s = String(day || '');
  const dn = s.match(/^\s*Day\s+(\d+)/i);
  return dn ? `D${dn[1]}` : (s.slice(0, 3) || '—');
}

// Best-effort per-meal macros parsed from the food line's "(~520 cal/38g P/42g C/
// 18g F)" annotation. The live plan encodes macros as TEXT (unlike the static
// catalog's numeric fields); calories + protein are reliable across engines, carbs
// and fat vary and degrade to 0 so the wheel/legend/ratio never render NaN.
function macrosFromText(line) {
  const s = String(line || '');
  const grab = (re) => { const m = s.match(re); return m ? parseInt(m[1], 10) : 0; };
  return {
    kcal: grab(/(\d{2,4})\s*(?:k?cal|calories)/i),
    p: grab(/(\d+)\s*g\s*P\b/i),
    c: grab(/(\d+)\s*g\s*C\b/i),
    f: grab(/(\d+)\s*g\s*F\b/i),
  };
}

// ── Live-plan adapter ─────────────────────────────────────────────────────────
// Adapt the athlete's REAL coach-generated plan (persisted meal_plan JSON on the
// auth envelope · plans.mealPlan) into the static catalog's render shape so the
// existing day-tabs / cards / fuel wheel render it unchanged. This is the plan that
// carries the auto-generated prep instructions. Returns null for a missing, legacy,
// or plain-text plan → the UI then falls back to the static tri-cuisine catalog so
// the tab is never empty.
function buildLivePlan(mealPlanRaw, labels) {
  const parsed = parseMealPlan(mealPlanRaw);
  if (!parsed.structured) return null;
  const days = (parsed.days || [])
    .filter((d) => Array.isArray(d.meals) && d.meals.length)
    .map((d) => ({
      day: d.day || '',
      meals: d.meals.map((m) => ({
        m: m.m || '',
        i: m.i || '',
        instructions: m.instructions,
        ...macrosFromText(m.i),
      })),
    }));
  if (!days.length) return null;
  return {
    id: 'live',
    label: labels.liveLabel,
    goal: parsed.goal || labels.liveGoalFallback,
    cal: parsed.cal, // plan-level daily target (number|null) — header fallback
    days,
  };
}

// Failsafe prep steps for a meal that arrived WITHOUT an instructions array
// (legacy / edge plans). Derives concise, MEAL-SPECIFIC steps from the actual
// ingredient line + macro target — never a content-free generic placeholder.
function derivePrepSteps(meal) {
  const ing = String(meal?.i || '').trim();
  if (!ing) return [];
  const parts = ing.split(/,|·|\/|\+|\band\b/i).map((p) => p.trim()).filter(Boolean);
  const list = parts.length ? parts.join(', ') : ing;
  const tgt = [];
  if (meal?.kcal) tgt.push(`${meal.kcal} kcal`);
  if (meal?.p) tgt.push(`${meal.p}g protein`);
  const macroTail = tgt.length ? ` to hit ${tgt.join(' · ')}` : '';
  return [
    `Portion the ingredients: ${list}.`,
    'Cook the protein through; steam or roast the vegetables and portion the carbs.',
    `Combine, season to taste, and plate${macroTail}.`,
  ];
}

// ── Meal card — thumbnail · tap-to-log body · Prep Instructions drawer ────────
// The card is a container (not one big button) so the "mark done" control and the
// "Prep Instructions" toggle are separate, non-nested interactive elements.
function MealCard({ meal, done, onToggle }) {
  const { tr } = useNutStr();
  // Closed by default — we fight scroll-bloat (CEO UX call). The athlete taps to
  // reveal steps; derivePrepSteps guarantees real, meal-specific steps on expand.
  const [prepOpen, setPrepOpen] = useState(false);
  const snack = isSnack(meal.m);
  // Build the macro chip from the parts actually present — the static catalog
  // carries full P/C/F; a live plan may only resolve calories + protein, so we never
  // render "undefined"/"0C / 0F" noise for the gaps.
  const macroBits = [];
  if (meal.kcal) macroBits.push(`${meal.kcal} KCAL`);
  const pcf = [];
  if (meal.p) pcf.push(`${meal.p}P`);
  if (meal.c) pcf.push(`${meal.c}C`);
  if (meal.f) pcf.push(`${meal.f}F`);
  if (pcf.length) macroBits.push(pcf.join(' / '));
  const macros = macroBits.join(' · ');
  const steps = normalizeInstructions(meal.instructions);
  // Real steps when the plan carries them; otherwise meal-specific derived steps
  // (from the ingredient line + macros) — never a content-free placeholder.
  const shownSteps = steps.length ? steps : derivePrepSteps(meal);

  return (
    <div className={`nl-meal${snack ? ' is-snack' : ''}${done ? ' is-done' : ''}`}>
      <button
        type="button"
        className="nl-meal-main"
        onClick={onToggle}
        aria-pressed={done}
        aria-label={tr.mealAria(meal.m, meal.i, macros, done)}
      >
        <span className="nl-meal-check" aria-hidden="true">✓</span>
        <MealThumb src={meal.image_url} art={resolveMealArt(meal)} />
        <span className="nl-meal-body">
          <span className="nl-meal-slot">{meal.m}</span>
          <div className="nl-meal-ing">{meal.i}</div>
          {macros ? <span className="nl-meal-macros">{macros}</span> : null}
        </span>
      </button>

      <div className="nl-meal-prep-wrap">
        <button
          type="button"
          className="nl-meal-prep-btn"
          aria-expanded={prepOpen}
          onClick={() => setPrepOpen((o) => !o)}
        >
          <span>{tr.prepInstructions}</span>
          <span className="nl-meal-prep-caret" aria-hidden="true">{prepOpen ? '▲' : '▼'}</span>
        </button>
        {prepOpen ? (
          shownSteps.length ? (
            <ol className="nl-meal-prep-list">
              {shownSteps.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          ) : (
            // Failsafe (CEO · Zero-Labor Doctrine): prep steps are now AUTO-GENERATED
            // by the meal engine from each meal's ingredients. Legacy/edge meals that
            // load without an instructions array degrade to a clean macro-prep line —
            // never the old "Awaiting coach protocol" dead placeholder.
            <div className="nl-meal-prep-empty">{tr.prepFallback}</div>
          )
        ) : null}
      </div>
    </div>
  );
}

// ── Admin oversight console (coach-only · Command Center surface) ─────────────
// The administrative layer inside the Nutrition Locker. Rendered ONLY on the
// Sovereign Command Center routing (/command) AND for admin/trainer sessions — the
// boundary is enforced HERE (route + isAdmin gate, so it can never leak into the
// personal Client Profile Hub at /vault) AND again server-side by the admin gateway
// every rosterCall passes through. Lets the head coach swap between active athletes,
// dial in their cuisine + macro targets, and recompile their AI performance plan
// against the live orchestration engine.
function cuisineLabel(id) {
  return (CUISINE_STYLES.find((s) => s.id === id) || {}).label || id;
}

function NumField({ label, value, onChange, disabled, accent }) {
  return (
    <label className="nc-field" style={{ borderTopColor: accent }}>
      <span className="nc-lbl">{label}</span>
      <input
        className="nc-input"
        type="number"
        min="0"
        max={TARGET_MAX}
        step="1"
        inputMode="numeric"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

// The AI Performance Studio is an ADMIN console whose calls (rosterApi) replay the
// X-BBF-Admin-Token. The Nutrition Locker isn't behind the Command Center's token
// gate, so mount the console only once the token is hydrated — otherwise its
// roster/compile calls 401. Until then, the unlock gate hydrates it (shared store,
// so unlocking any admin surface satisfies this too; never bundled, §7).
function NutritionStudioGate() {
  const { tr } = useNutStr();
  const [ready, setReady] = useState(hasAdminToken);
  if (ready) return <NutritionCoachConsole />;
  return (
    <section className="nc-console" aria-label="Coach oversight console">
      <header className="nc-head">
        <span className="nc-badge">{tr.coachConsole}</span>
        <h3 className="nc-title">{tr.aiStudio}</h3>
      </header>
      <AdminTokenGate surface={tr.studioSurface} onUnlock={() => setReady(true)} />
    </section>
  );
}

function NutritionCoachConsole() {
  const { tr } = useNutStr();
  const { lang } = useLang();
  const [roster, setRoster] = useState(EMPTY);
  const [rosterErr, setRosterErr] = useState(null);
  const [loadingRoster, setLoadingRoster] = useState(true);

  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [cuisine, setCuisine] = useState(CUISINE_STYLES[0].id);
  const [macros, setMacros] = useState({ tdee_target: '', macro_p: '', macro_c: '', macro_f: '' });

  const [saving, setSaving] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [status, setStatus] = useState(null); // { kind:'ok'|'err', msg }

  // Load the roster once on mount.
  useEffect(() => {
    let cancelled = false;
    rosterCall('roster')
      .then((b) => { if (!cancelled) setRoster(Array.isArray(b.clients) ? b.clients : []); })
      .catch((e) => { if (!cancelled) setRosterErr(toErrorMessage(e)); })
      .finally(() => { if (!cancelled) setLoadingRoster(false); });
    return () => { cancelled = true; };
  }, []);

  // Load the selected athlete's detail → seed the macro inputs from their targets.
  // State is reset synchronously in the select handler (a user event), so this
  // effect mutates state ONLY inside the async callbacks — keeping it clear of
  // react-hooks/set-state-in-effect (mirrors vaultApi.useVaultProfile).
  useEffect(() => {
    if (!selectedId) return undefined;
    let cancelled = false;
    rosterCall('detail', { id: selectedId })
      .then((b) => {
        if (cancelled) return;
        const c = b.client || {};
        setDetail(c);
        setMacros({
          tdee_target: c.tdee_target ?? '',
          macro_p: c.macro_p ?? '',
          macro_c: c.macro_c ?? '',
          macro_f: c.macro_f ?? '',
        });
      })
      .catch((e) => { if (!cancelled) setStatus({ kind: 'err', msg: toErrorMessage(e) }); })
      .finally(() => { if (!cancelled) setLoadingDetail(false); });
    return () => { cancelled = true; };
  }, [selectedId]);

  // Swap the active athlete. Resets the detail/macro/status state here (in the
  // user event) so the effect above stays side-effect-pure on its async path.
  function selectAthlete(id) {
    setSelectedId(id);
    setDetail(null);
    setMacros({ tdee_target: '', macro_p: '', macro_c: '', macro_f: '' });
    setStatus(null);
    setLoadingDetail(Boolean(id));
  }

  const setField = (k, v) => setMacros((m) => ({ ...m, [k]: v }));
  const busy = saving || compiling;

  async function saveMacros() {
    if (busy || !selectedId) return;
    setSaving(true);
    setStatus(null);
    try {
      const b = await updateTargets(selectedId, macros);
      setDetail((d) => ({ ...(d || {}), ...(b.client || {}) }));
      setStatus({ kind: 'ok', msg: tr.macrosSaved });
    } catch (e) {
      setStatus({ kind: 'err', msg: toErrorMessage(e) });
    } finally {
      setSaving(false);
    }
  }

  async function compile() {
    if (busy || !selectedId) return;
    setCompiling(true);
    setStatus(null);
    try {
      const b = await compilePlan(selectedId, { tdee_target: macros.tdee_target, cuisine, lang });
      const days = Array.isArray(b.plan?.days) ? b.plan.days.length : 0;
      setStatus({
        kind: 'ok',
        msg: tr.compiled(days, cuisineLabel(cuisine), b.persisted),
      });
    } catch (e) {
      setStatus({ kind: 'err', msg: toErrorMessage(e) });
    } finally {
      setCompiling(false);
    }
  }

  return (
    <section className="nc-console" aria-label="Coach oversight console">
      <header className="nc-head">
        <span className="nc-badge">{tr.coachConsole}</span>
        <h3 className="nc-title">{tr.aiStudio}</h3>
      </header>

      <label className="nc-field nc-field-wide">
        <span className="nc-lbl">{tr.clientRoster}</span>
        <select
          className="nc-select"
          value={selectedId}
          onChange={(e) => selectAthlete(e.target.value)}
          disabled={loadingRoster || busy}
          aria-label={tr.selectAria}
        >
          <option value="">{loadingRoster ? tr.loadingRoster : tr.selectAthlete}</option>
          {roster.map((c) => (
            <option key={c.id} value={c.id}>{c.name || c.uid}</option>
          ))}
        </select>
      </label>
      {rosterErr ? <div className="nc-status is-err" role="alert">{rosterErr}</div> : null}

      {!selectedId ? (
        <div className="nc-hint">{tr.consoleHint}</div>
      ) : loadingDetail ? (
        <div className="nc-status">{tr.loadingAthlete(detail?.name || tr.athlete)}</div>
      ) : (
        <>
          <div className="nc-grid">
            <label className="nc-field">
              <span className="nc-lbl">{tr.cuisineStyle}</span>
              <select
                className="nc-select"
                value={cuisine}
                onChange={(e) => setCuisine(e.target.value)}
                disabled={busy}
                aria-label={tr.cuisineAria}
              >
                {CUISINE_STYLES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </label>
            <NumField label={tr.targetKcal} value={macros.tdee_target} onChange={(v) => setField('tdee_target', v)} disabled={busy} accent="var(--yel)" />
            <NumField label={tr.proteinG} value={macros.macro_p} onChange={(v) => setField('macro_p', v)} disabled={busy} accent="#ff5d5d" />
            <NumField label={tr.carbsG} value={macros.macro_c} onChange={(v) => setField('macro_c', v)} disabled={busy} accent="#4dc3ff" />
            <NumField label={tr.fatsG} value={macros.macro_f} onChange={(v) => setField('macro_f', v)} disabled={busy} accent="#ffb547" />
          </div>

          <div className="nc-actions">
            <button type="button" className="nc-btn nc-btn-ghost" onClick={saveMacros} disabled={busy}>
              {saving ? tr.saving : tr.saveMacros}
            </button>
            <button type="button" className="nc-btn nc-btn-primary" onClick={compile} disabled={busy}>
              {compiling ? tr.compiling : tr.compilePlan}
            </button>
          </div>
        </>
      )}

      {status ? (
        <div className={`nc-status ${status.kind === 'ok' ? 'is-ok' : 'is-err'}`} role="status">
          {status.msg}
        </div>
      ) : null}
    </section>
  );
}

// ── Hydration Tracker — lives inside the Nutrition tab ───────────────────────
// Activity-level-based daily water target. EN = oz; ES/PT = liters.
// Persists per-user-per-day in localStorage; dispatches 'bbf-hydration-update'
// so VaultHeader can reflow without prop drilling.
function HydrationTracker({ uid }) {
  const { lang } = useLang();
  const tr = NUT_STR[lang] || NUT_STR.en;
  const isMetric = lang !== 'en';

  const [consumedOz, setConsumedOz] = useState(() => loadHydration(uid).consumedOz);
  const [activityId, setActivityId] = useState(() => loadHydration(uid).activityId);

  const targetOz = ACTIVITY_LEVELS.find((a) => a.id === activityId)?.oz ?? 96;
  const pct = Math.min(100, Math.round((consumedOz / targetOz) * 100));
  const goalHit = consumedOz >= targetOz;

  function displayAmt(oz) {
    return isMetric ? `${ozToL(oz)} L` : `${Math.round(oz)} oz`;
  }

  function add(oz) {
    const next = Math.min(targetOz * 2, consumedOz + oz);
    setConsumedOz(next);
    saveHydration(uid, next, activityId);
  }

  function changeActivity(id) {
    setActivityId(id);
    saveHydration(uid, consumedOz, id);
  }

  function reset() {
    setConsumedOz(0);
    saveHydration(uid, 0, activityId);
  }

  const quickAdds = isMetric ? QUICK_ADD_METRIC : QUICK_ADD_EN;

  return (
    <div className="nl-hyd" data-testid="hydration-tracker">
      <div className="nl-hyd-head">
        <span className="nl-hyd-kicker">💧 {tr.hydKicker}</span>
        {goalHit && <span className="nl-hyd-goal-badge">{tr.hydGoalHit}</span>}
      </div>

      <div className="nl-hyd-activity-lbl">{tr.hydActivity}</div>
      <div className="nl-hyd-levels" role="group" aria-label={tr.hydActivity}>
        {ACTIVITY_LEVELS.map((lvl) => (
          <button
            key={lvl.id}
            type="button"
            className={`nl-hyd-lvl${activityId === lvl.id ? ' is-active' : ''}`}
            onClick={() => changeActivity(lvl.id)}
          >
            {tr.hydLevels[lvl.id]}
          </button>
        ))}
      </div>

      <div className="nl-hyd-progress-row">
        <span className="nl-hyd-consumed">{displayAmt(consumedOz)}</span>
        <span className="nl-hyd-sep">{tr.hydOf} {displayAmt(targetOz)}</span>
        <span className={`nl-hyd-pct${goalHit ? ' is-done' : ''}`}>{pct}%</span>
      </div>
      <div
        className="nl-hyd-bar-track"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${tr.hydLogged}: ${displayAmt(consumedOz)} ${tr.hydOf} ${displayAmt(targetOz)}`}
      >
        <div className={`nl-hyd-bar-fill${goalHit ? ' is-done' : ''}`} style={{ width: `${pct}%` }} />
      </div>

      <div className="nl-hyd-quick">
        {quickAdds.map((q) => (
          <button
            key={q.label}
            type="button"
            className="nl-hyd-add-btn"
            onClick={() => add(q.oz)}
          >
            + {q.label}
          </button>
        ))}
        <button type="button" className="nl-hyd-reset-btn" onClick={reset}>{tr.hydReset}</button>
      </div>
    </div>
  );
}

// Phase 2 · advanced_nutrition surface — the Meal Scanner entry (Fuel Series + God
// Tier only). The TierGate wrapper is the deliverable; full vision/macro wiring
// (bbf-meal-macros / camera) is a follow-up. Rendered only when entitled.
function MealScannerCard() {
  const card = {
    border: '1px solid #6a0dad', borderRadius: '12px', padding: '12px 14px',
    margin: '0 0 14px', background: 'rgba(106,13,173,.08)',
  };
  const head = { display: 'flex', alignItems: 'center', gap: '.5rem', fontWeight: 700, color: '#f5c800', letterSpacing: '.5px' };
  const body = { margin: '.4rem 0 0', fontSize: '.9rem', color: 'var(--mut, #9aa)', lineHeight: 1.4 };
  return (
    <div style={card} data-testid="vault-meal-scanner">
      <div style={head}><span aria-hidden="true">📷</span> Meal Scanner</div>
      <p style={body}>Snap or describe a meal and get an instant macro read-out — included with your Fuel plan.</p>
    </div>
  );
}

export default function Nutrition({ plans, profile }) {
  const { user, isAdmin } = useAuth();
  const { lang } = useLang();
  const tr = NUT_STR[lang] || NUT_STR.en;
  const uid = user?.username || user?.id || 'guest';
  // Account-specific nutrition awareness note (gated by uid; null for everyone else).
  const personal = personalFor(uid);

  // SURFACE GATE (forensic fix · Nutrition Locker logic leak) — the coach console
  // (athlete-selection dropdown + admin-token gate) is a COMMAND CENTER surface
  // ONLY. It must never render in the personal Client Profile Hub (/vault), where
  // the locker defaults strictly to the AUTHENTICATED USER'S OWN profile (uid +
  // the passed `profile`). Gate on the ROUTE, not the role: the CEO trains as a
  // Player-Coach and reads as `isAdmin` everywhere, so the old role-only check
  // leaked the dropdown — and its 401-on-admin-token path — into his own vault.
  // /command is the Sovereign Command Center routing (AdminGuard-gated); only there
  // do the admin controls mount.
  const onCommandSurface = useLocation().pathname.startsWith('/command');

  // CNS telemetry — the same stored daily verdict the workout grid regulates
  // from. Drives the Readiness Fuel Profile card (Performance ⇄ Recovery pivot).
  const { data: readiness } = useDailyReadiness();

  // ── Plan source · prioritize the athlete's LIVE coach-generated plan ──────────
  // The persisted meal_plan (auth envelope → plans.mealPlan) is the real, per-athlete
  // protocol and carries the auto-generated prep instructions. When present we render
  // IT; the static tri-cuisine catalog is the FALLBACK so the tab is never empty for a
  // client who hasn't had a plan compiled yet.
  const livePlan = useMemo(
    () => buildLivePlan(plans?.mealPlan, { liveLabel: tr.liveLabel, liveGoalFallback: tr.liveGoalFallback }),
    [plans?.mealPlan, tr],
  );
  const usingLive = Boolean(livePlan);

  const [cuisineId, setCuisineId] = useState(CUISINES[0].id);
  const [dayIdx, setDayIdx] = useState(() => todayIndex());

  // Active source: the live plan keys its done-store under 'live' so it never
  // collides with the three static cuisines' completion state.
  const activeKey = usingLive ? 'live' : cuisineId;
  const plan = usingLive ? livePlan : CUISINE_PLANS[cuisineId];
  const activeDayIdx = Math.min(dayIdx, plan.days.length - 1);
  const day = plan.days[activeDayIdx] || plan.days[0];
  const totals = useMemo(() => dayTotals(day), [day]);

  // ── Server-synced adherence (the loop) ───────────────────────────────────────
  // useNutritionSync gives today's CANONICAL targets (the SAME athlete_nutrition_
  // targets_daily row the Hub Fuel Targets card reads), the set of client_meal_keys
  // already logged today (so checked cards rehydrate from the SERVER across reloads /
  // devices), and a 7-day kcal-adherence strip.
  const { targets, loggedKeys, weekAdherence, reload: reloadSync } = useNutritionSync();

  // Completed-meal state — SERVER-authoritative with an optimistic overlay:
  //   • loggedKeys (server) = source of truth on load.
  //   • overrides (this session) = the optimistic flip, applied instantly on tap and
  //     reverted on a hard write failure.
  //   • doneStore (localStorage) = instant-paint cache before the RPC resolves.
  const dayName = day.day;
  const [doneStore, setDoneStore] = useState(() => readUserDone(uid));
  const [overrides, setOverrides] = useState({});
  const [benefitNote, setBenefitNote] = useState(null);

  const legacyDone = doneStore?.[activeKey]?.[dayName] || EMPTY;
  const mealKeyFor = (idx) => `${activeKey}:${dayName}:${idx}`;
  const isDone = (idx) => {
    const k = mealKeyFor(idx);
    if (Object.prototype.hasOwnProperty.call(overrides, k)) return overrides[k];
    if (loggedKeys.has(k)) return true;
    return legacyDone.includes(idx); // instant-paint fallback before the server read resolves
  };

  // Auto-dismiss the "why this fuels you" note a beat after a log.
  useEffect(() => {
    if (!benefitNote) return undefined;
    const t = setTimeout(() => setBenefitNote(null), 7000);
    return () => clearTimeout(t);
  }, [benefitNote]);

  const toggleMeal = (idx) => {
    const k = mealKeyFor(idx);
    const meal = day.meals[idx] || {};
    const nextDone = !isDone(idx);

    // Optimistic: flip the override + mirror to the localStorage instant-paint cache.
    setOverrides((o) => ({ ...o, [k]: nextDone }));
    setDoneStore((prev) => {
      const cur = prev?.[activeKey]?.[dayName] || [];
      const nextArr = nextDone
        ? (cur.includes(idx) ? cur : [...cur, idx])
        : cur.filter((i) => i !== idx);
      const next = { ...prev, [activeKey]: { ...(prev[activeKey] || {}), [dayName]: nextArr } };
      writeUserDone(uid, next);
      return next;
    });

    // Layer 1 (all tiers) + Layer 2 (readiness-gated) coaching note — on a LOG only.
    if (nextDone) {
      setBenefitNote(mealBenefit({ p: meal.p || 0, c: meal.c || 0, f: meal.f || 0 }, lang, readiness));
    }

    // Server sync → reconcile. On a hard failure, revert the optimistic flip.
    syncMealLog({
      action: nextDone ? 'log' : 'unlog',
      clientMealKey: k,
      mealSlot: meal.m,
      foodLabel: String(meal.i || meal.m || '').slice(0, 200),
      servingG: (meal.p || 0) + (meal.c || 0) + (meal.f || 0),
      proteinG: meal.p || 0, carbsG: meal.c || 0, fatG: meal.f || 0,
    })
      .then(() => {
        // Reconciled — drop the override so the server read is authoritative, then refetch.
        setOverrides((o) => { const n = { ...o }; delete n[k]; return n; });
        reloadSync();
      })
      .catch(() => {
        // Hard failure (bad session / network) → revert the optimistic flip.
        setOverrides((o) => ({ ...o, [k]: !nextDone }));
      });
  };

  // Consumed macros = sum of the meals currently marked done (server + optimistic).
  const consumed = day.meals.reduce(
    (acc, m, i) => (isDone(i)
      ? { kcal: acc.kcal + (m.kcal || 0), p: acc.p + (m.p || 0), c: acc.c + (m.c || 0), f: acc.f + (m.f || 0) }
      : acc),
    { kcal: 0, p: 0, c: 0, f: 0 },
  );
  const doneCount = day.meals.reduce((n, _m, i) => (isDone(i) ? n + 1 : n), 0);

  // The wheel + legend + Fueling Status grade against the CANONICAL daily target
  // (athlete_nutrition_targets_daily via bbf_nutrition_today) — the SAME numbers the
  // Hub Fuel Targets card shows. Falls back to the meal-plan totals when absent.
  const targetMacros = targets
    ? { kcal: targets.tdee_kcal || 0, p: targets.protein_g || 0, c: targets.carbs_g || 0, f: targets.fat_g || 0 }
    : totals;

  // Fasting Pace — client-controlled (CEO override: IF is optional). Seed from a
  // saved choice, else a coach-assigned tier, else Off. Persisted per user; never
  // auto-overridden once the athlete has chosen.
  const [paceId, setPaceId] = useState(() => {
    const saved = readUserPace(uid);
    if (saved) return saved;
    return paceIdFromWindow(parseFastingWindow(profile?.metabolicTier, profile?.fastingHours)) || 'off';
  });
  const selectPace = (id) => {
    setPaceId(id);
    writeUserPace(uid, id);
  };

  // Live clock so the fasting marker + status track the real time of day.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const todayI = todayIndex();
  // Header calorie figure: a live plan may not resolve every meal's macros from its
  // text, so fall back to its stated plan-level daily target when the per-meal sum is
  // empty. The static catalog always sums to a real number, so it's unaffected.
  const calFigure = totals.kcal > 0
    ? totals.kcal.toLocaleString()
    : (usingLive && plan.cal ? `~${plan.cal.toLocaleString()}` : totals.kcal.toLocaleString());

  return (
    <div className="pg-nut">
      {isAdmin && onCommandSurface ? <NutritionStudioGate /> : null}

      {/* ── CONTEXTUAL VOICEOVER — Coach Akeem explains WHY these macros are
          TDEE-engineered, that meals are interchangeable when measured right, and
          the payoff of following the plan to the T. Static clip, paused by default. ── */}
      <ContextualVoiceover
        audioKey={AUDIO_CTX_NUTRITION}
        testId="ctx-vo-nutrition"
        title={{ en: 'Fuel the Mission', es: 'Alimenta la Misión', pt: 'Abasteça a Missão' }}
        sub={{
          en: 'Why these macros are engineered from your TDEE — and why hitting the numbers, not the exact recipe, is what delivers results.',
          es: 'Por qué estos macros se calculan desde tu GEDT — y por qué acertar los números, no la receta exacta, es lo que da resultados.',
          pt: 'Por que esses macros são calculados a partir do seu GEDT — e por que bater os números, não a receita exata, é o que traz resultados.',
        }}
      />

      {/* ── PERSONAL NUTRITION NOTE — account-specific (gated); warm "why" over the plan ── */}
      {personal?.nutrition ? (
        <div className="pg-card" data-testid="nut-personal-note" style={{ background: 'linear-gradient(180deg, rgba(106,13,173,.30), rgba(9,9,9,.25))', border: '1px solid rgba(245,200,0,.45)', borderRadius: 12, padding: '14px 16px', margin: '0 0 14px' }}>
          <div style={{ fontFamily: 'var(--hb,"Barlow Condensed")', fontSize: '.66rem', letterSpacing: '2.5px', textTransform: 'uppercase', color: '#f5c800', marginBottom: 6 }}>♥ {personal.nutrition.kicker}</div>
          <h3 style={{ fontFamily: 'var(--display,"Bebas Neue")', fontStyle: 'italic', fontSize: '1.4rem', lineHeight: 1.05, color: '#f9f5ff', margin: '0 0 8px' }}>{personal.nutrition.title}</h3>
          <p style={{ fontFamily: 'var(--bd,"Barlow Condensed")', fontSize: '.95rem', lineHeight: 1.5, color: 'rgba(255,255,255,.86)', margin: 0 }}>{personal.nutrition.body}</p>
        </div>
      ) : null}

      <div className="nl-head-row">
        <div>
          <h2 className="pg-nut-head">{tr.nutritionPlan}</h2>
          <div className="pg-nut-meta">
            {usingLive ? tr.metaLive : tr.metaStatic}
          </div>
        </div>
        {usingLive ? (
          // A live plan is a single personalized protocol — the tri-cuisine selector
          // doesn't apply, so surface a source badge where the picker would sit.
          <div className="nl-cuisine">
            <span className="nl-cuisine-lbl">{tr.planSource}</span>
            <span className="nl-live-badge-val">{tr.liveCoachPlan}</span>
          </div>
        ) : (
          <label className="nl-cuisine">
            <span className="nl-cuisine-lbl">{tr.cuisineStyle}</span>
            <select
              className="nl-cuisine-select"
              value={cuisineId}
              onChange={(e) => setCuisineId(e.target.value)}
              aria-label={tr.cuisineAria}
            >
              {CUISINES.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {/* Readiness Fuel Profile — the macro pivot from the morning check-in. */}
      <FuelProfile readiness={readiness} />

      {/* Phase 2: advanced_nutrition (Meal Scanner) — Fuel Series + God Tier only. */}
      <TierGate feature="advanced_nutrition" render="hide">
        <MealScannerCard />
      </TierGate>

      <div className="nl-day-head">
        <div className="nl-day-head-cuisine">{plan.label} · {dayName}</div>
        <div className="nl-day-head-cal">{calFigure} {tr.calPerDay}</div>
        <div className="nl-day-head-goal">🎯 {plan.goal}</div>
      </div>

      <div className="nl-daynav" role="tablist" aria-label={usingLive ? tr.planDayAria : tr.dayOfWeekAria}>
        {plan.days.map((d, i) => (
          <button
            key={`${d.day}-${i}`}
            type="button"
            role="tab"
            aria-selected={i === activeDayIdx}
            className={`nl-day-pill${i === activeDayIdx ? ' is-active' : ''}${!usingLive && i === todayI ? ' is-today' : ''}`}
            onClick={() => setDayIdx(i)}
          >
            {shortDayLabel(d.day)}
          </button>
        ))}
      </div>

      {/* Fasting Pace selector + daily macro tracking, side by side. */}
      <div className="nl-fastfuel">
        <FastingPaceCard
          now={now}
          paceId={paceId}
          onSelectPace={selectPace}
          tier={profile?.metabolicTier}
        />
        <DailyFuel
          consumed={consumed}
          totals={targetMacros}
          doneCount={doneCount}
          mealCount={day.meals.length}
        />
      </div>

      {/* Daily Fueling Status — Fuel Performance+ (adherence vs the canonical target
          + 7-day trend). Lower tiers see the upgrade padlock (justifies the ladder). */}
      <TierGate feature="nutrition_fueling_status" featureLabel={tr.fsLock} testId="nutrition-fueling-status-lock">
        <FuelingStatus consumed={consumed} target={targetMacros} weekAdherence={weekAdherence} />
      </TierGate>

      {/* Periodized Fuel Timing — Fuel Sovereign (Tier-3 timing_plan). Lower tiers
          see the upgrade padlock. */}
      <TierGate feature="nutrition_periodization" featureLabel={tr.perLock} testId="nutrition-periodization-lock">
        <PeriodizedPlan timingPlan={targets?.timing_plan} />
      </TierGate>

      {/* Layer 1/2 "why this fuels you" note — appears on a log, auto-dismisses. */}
      <MealBenefitNote note={benefitNote} />

      <div>
        <div className="nl-meal-hint">{tr.mealHint}</div>
        {day.meals.map((m, i) => (
          // key includes the active source + day so switching tabs remounts each card
          // — resetting its local prep-drawer / broken-thumbnail state for the new meal.
          <MealCard key={`${activeKey}-${dayName}-${i}`} meal={m} done={isDone(i)} onToggle={() => toggleMeal(i)} />
        ))}
      </div>

      {/* Complete & Sync Protocol — the daily fueling commit (parity with the
          workout / cardio sync). Commits today's adherence to history + fires the
          shared PROTOCOL_UPDATED broadcast so every readiness surface rehydrates. */}
      <NutritionSyncCard doneCount={doneCount} mealCount={day.meals.length} />

      <HydrationTracker uid={uid} />
    </div>
  );
}
