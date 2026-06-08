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
import {
  rosterCall, updateTargets, compilePlan, toErrorMessage,
  TARGET_MAX, CUISINE_STYLES,
} from '../../lib/rosterApi.js';
import { hasAdminToken } from '../../lib/adminAuth.js';
import AdminTokenGate from '../command/AdminTokenGate.jsx';
import TierGate from '../TierGate.jsx';
import { CUISINES, CUISINE_PLANS, dayTotals, todayIndex } from './cuisineMeals.js';
import './vault.css';
import './nutrition.css';

const DONE_KEY = 'bbf.vault.nut.done.v1';
const PACE_KEY = 'bbf.vault.nut.fastpace.v1';
const EMPTY = [];

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
    eatOpen: (t) => <>Eating window open — <b>{t}</b> left to fuel.</>,
    fastingUntil: (t) => <>Fasting — <b>{t}</b> until your window opens.</>,
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
  },
  es: {
    prepFallback: 'Preparación estándar de macros.',
    eatingWindow: 'Ventana de Alimentación', unrestricted: '🍽 Sin Restricción',
    offMsg: <>La alimentación con restricción horaria está <b>desactivada</b> — elige un Ritmo de Ayuno arriba para mapear tu ventana de alimentación.</>,
    fastingWindow: (r) => `Ventana de Ayuno ${r}`, eating: '🍽 Comiendo', fastingTag: '🌙 Ayunando',
    windowAria: (s, e, inside) => `Ventana de alimentación de ${s} a ${e}. Actualmente ${inside ? 'dentro' : 'fuera'} de la ventana.`,
    eatOpen: (t) => <>Ventana de alimentación abierta — <b>{t}</b> para alimentarte.</>,
    fastingUntil: (t) => <>Ayunando — <b>{t}</b> hasta que se abra tu ventana.</>,
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
  },
  pt: {
    prepFallback: 'Preparação padrão de macros.',
    eatingWindow: 'Janela de Alimentação', unrestricted: '🍽 Sem Restrição',
    offMsg: <>A alimentação com restrição de horário está <b>desativada</b> — escolha um Ritmo de Jejum acima para mapear sua janela de alimentação.</>,
    fastingWindow: (r) => `Janela de Jejum ${r}`, eating: '🍽 Comendo', fastingTag: '🌙 Jejuando',
    windowAria: (s, e, inside) => `Janela de alimentação de ${s} a ${e}. Atualmente ${inside ? 'dentro' : 'fora'} da janela.`,
    eatOpen: (t) => <>Janela de alimentação aberta — <b>{t}</b> para se alimentar.</>,
    fastingUntil: (t) => <>Jejuando — <b>{t}</b> até sua janela abrir.</>,
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

  let sub;
  if (eating) {
    sub = tr.eatOpen(fmtHM(eatEnd - h));
  } else {
    const until = h < eatStart ? eatStart - h : (24 - h) + eatStart;
    sub = tr.fastingUntil(fmtHM(until));
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
      <div className="pg-fast-sub">
        {sub}
        {tier ? <span className="pg-fast-tier"> · {tier}</span> : null}
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

// ── Meal thumbnail — real image_url, else a brutalist BBF wireframe skeleton ──
// The plan data MAY carry an `image_url` per meal; until the backend maps one (and
// if a mapped URL 404s) we fall back to an intentional dark-mode placeholder so the
// card never shows a broken-image glyph.
function MealThumb({ src }) {
  const [broken, setBroken] = useState(false);
  const url = (src || '').trim();
  if (url && !broken) {
    return (
      <span className="nl-meal-thumb">
        <img src={url} alt="" loading="lazy" onError={() => setBroken(true)} />
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
  const [prepOpen, setPrepOpen] = useState(true);
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
        <MealThumb src={meal.image_url} />
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

  // Completed-meal indexes — one persisted store for the user, keyed live by the
  // active source (cuisine id, or 'live') + day (no effect; derived each render).
  const dayName = day.day;
  const [doneStore, setDoneStore] = useState(() => readUserDone(uid));
  const done = doneStore?.[activeKey]?.[dayName] || EMPTY;

  const toggleMeal = (idx) => {
    setDoneStore((prev) => {
      const cur = prev?.[activeKey]?.[dayName] || [];
      const nextArr = cur.includes(idx) ? cur.filter((i) => i !== idx) : [...cur, idx];
      const next = { ...prev, [activeKey]: { ...(prev[activeKey] || {}), [dayName]: nextArr } };
      writeUserDone(uid, next);
      return next;
    });
  };

  // Consumed macros = sum of completed meals (|| 0 — a live meal may not resolve
  // every macro from its text annotation).
  const consumed = useMemo(() => {
    return day.meals.reduce(
      (acc, m, i) => (done.includes(i)
        ? { kcal: acc.kcal + (m.kcal || 0), p: acc.p + (m.p || 0), c: acc.c + (m.c || 0), f: acc.f + (m.f || 0) }
        : acc),
      { kcal: 0, p: 0, c: 0, f: 0 },
    );
  }, [day, done]);

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
          totals={totals}
          doneCount={done.length}
          mealCount={day.meals.length}
        />
      </div>

      <div>
        <div className="nl-meal-hint">{tr.mealHint}</div>
        {day.meals.map((m, i) => (
          // key includes the active source + day so switching tabs remounts each card
          // — resetting its local prep-drawer / broken-thumbnail state for the new meal.
          <MealCard key={`${activeKey}-${dayName}-${i}`} meal={m} done={done.includes(i)} onToggle={() => toggleMeal(i)} />
        ))}
      </div>
    </div>
  );
}
