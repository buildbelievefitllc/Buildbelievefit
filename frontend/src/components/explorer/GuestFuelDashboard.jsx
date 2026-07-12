// src/components/explorer/GuestFuelDashboard.jsx
// ─────────────────────────────────────────────────────────────────────────────
// GUEST FUEL DASHBOARD — the Explorer Mode "Fuel Targets" pane, re-engineered as
// a high-fidelity PRESENTATIONAL clone of the premium Nutrition Locker's core
// layout (Nutrition.jsx): the plan banner, the conic macro wheel, the 4-box
// macro legend, the volume-ratio bar, and the fasting-pace + eating-window
// timeline.
//
// ARCHITECTURAL RULE (per CEO directive): this file imports NOTHING from the
// authenticated vault — no Supabase, no useNutritionSync, no TierGate, no meal
// ledger. Every number binds to the guest's own calculated TDEE/macros (props)
// or to fixed demo values; the fasting pace is throwaway local state. The
// styling is the `xp-nl-*` clone sheet (explorerPreviews.css), because the live
// nutrition.css/vault.css bundles never load on /explore.
//
// Demo semantics: the wheel plays a mid-day "62% logged" frame so the guest
// sees the product's living consumed-vs-target ring; the LEGEND shows their
// real daily targets (these are the numbers the calculator promised them, and
// the e2e spec asserts them). Nothing persists; nothing syncs.

import { useMemo, useState } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import './explorerPreviews.css';

// Same accent constants the premium locker uses (MACRO_COLORS, Nutrition.jsx).
const MACRO_COLORS = { p: '#ff5d5d', c: '#4dc3ff', f: '#ffb547' };

// Verbatim pace table from the premium FastingPaceCard (Nutrition.jsx).
const FASTING_PACES = [
  { id: 'off', fast: 0, eat: 24 },
  { id: '12:12', fast: 12, eat: 12 },
  { id: '14:10', fast: 14, eat: 10 },
  { id: '16:8', fast: 16, eat: 8 },
  { id: '18:6', fast: 18, eat: 6 },
  { id: '20:4', fast: 20, eat: 4 },
];

// Strings mirror the premium NUT_STR / PACE_SHORT tables verbatim where the
// cloned blocks reuse them; guest-only chrome (plan label) is new copy.
const L10N = {
  en: {
    planLabel: 'Explorer Protocol', calPerDay: 'kcal / day', maintenance: 'Maintenance',
    todaysFuel: "Today's Fuel", protein: 'PROTEIN', carbs: 'CARBS', fat: 'FAT', kcal: 'KCAL',
    dailyTarget: 'Target',
    rProtein: (n) => `Protein ${n}%`, rCarbs: (n) => `Carbs ${n}%`, rFat: (n) => `Fat ${n}%`,
    ratioAria: 'Macro volume ratio',
    wheelAria: (c, t) => `${c} of ${t} kcal logged`,
    paceKicker: 'Fasting Pace', paceNote: 'Time-restricted feeding · optional', off: 'Off',
    paceShort: { off: 'Disabled', '12:12': 'Circadian', '14:10': 'Primer', '16:8': 'Standard', '18:6': 'Advanced', '20:4': 'Warrior' },
    eatingWindow: 'Eating Window', unrestricted: '🍽 Unrestricted',
    fastingWindow: (r) => `${r} Fasting Window`, eating: '🍽 Eating', fastingTag: '🌙 Fasting',
    clockEat: 'left to fuel', clockFast: 'until your window opens',
    offMsg: 'Time-restricted feeding is off — pick a Fasting Pace above to map your eating window.',
  },
  es: {
    planLabel: 'Protocolo Explorador', calPerDay: 'kcal / día', maintenance: 'Mantenimiento',
    todaysFuel: 'Combustible de Hoy', protein: 'PROTEÍNA', carbs: 'CARBOS', fat: 'GRASA', kcal: 'KCAL',
    dailyTarget: 'Objetivo',
    rProtein: (n) => `Proteína ${n}%`, rCarbs: (n) => `Carbos ${n}%`, rFat: (n) => `Grasa ${n}%`,
    ratioAria: 'Proporción de volumen de macros',
    wheelAria: (c, t) => `${c} de ${t} kcal registradas`,
    paceKicker: 'Ritmo de Ayuno', paceNote: 'Alimentación con restricción horaria · opcional', off: 'Off',
    paceShort: { off: 'Desactivado', '12:12': 'Circadiano', '14:10': 'Iniciación', '16:8': 'Estándar', '18:6': 'Avanzado', '20:4': 'Guerrero' },
    eatingWindow: 'Ventana de Alimentación', unrestricted: '🍽 Sin Restricción',
    fastingWindow: (r) => `Ventana de Ayuno ${r}`, eating: '🍽 Comiendo', fastingTag: '🌙 Ayunando',
    clockEat: 'para alimentarte', clockFast: 'hasta que se abra tu ventana',
    offMsg: 'La alimentación con restricción horaria está desactivada — elige un Ritmo de Ayuno arriba para mapear tu ventana de alimentación.',
  },
  pt: {
    planLabel: 'Protocolo Explorador', calPerDay: 'kcal / dia', maintenance: 'Manutenção',
    todaysFuel: 'Combustível de Hoje', protein: 'PROTEÍNA', carbs: 'CARBOS', fat: 'GORDURA', kcal: 'KCAL',
    dailyTarget: 'Meta',
    rProtein: (n) => `Proteína ${n}%`, rCarbs: (n) => `Carbos ${n}%`, rFat: (n) => `Gordura ${n}%`,
    ratioAria: 'Proporção de volume de macros',
    wheelAria: (c, t) => `${c} de ${t} kcal registradas`,
    paceKicker: 'Ritmo de Jejum', paceNote: 'Alimentação com restrição de horário · opcional', off: 'Off',
    paceShort: { off: 'Desativado', '12:12': 'Circadiano', '14:10': 'Iniciação', '16:8': 'Padrão', '18:6': 'Avançado', '20:4': 'Guerreiro' },
    eatingWindow: 'Janela de Alimentação', unrestricted: '🍽 Sem Restrição',
    fastingWindow: (r) => `Janela de Jejum ${r}`, eating: '🍽 Comendo', fastingTag: '🌙 Jejuando',
    clockEat: 'para se alimentar', clockFast: 'até sua janela abrir',
    offMsg: 'A alimentação com restrição de horário está desativada — escolha um Ritmo de Jejum acima para mapear sua janela de alimentação.',
  },
};

const DATE_LOCALES = { en: 'en-US', es: 'es', pt: 'pt-BR' };

// Premium FastingWindow helpers, copied (fmtHM / fmtClock).
function fmtHM(mins) {
  const m = Math.max(0, Math.round(mins));
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}
function fmtClock(h) {
  const hh = ((h % 24) + 24) % 24;
  const ap = hh >= 12 ? 'PM' : 'AM';
  return `${hh % 12 || 12}:00 ${ap}`;
}

// ── Macro wheel — the premium conic ring (purple→gold sweep over dark track) ──
function GuestMacroWheel({ consumed, target, tr }) {
  const deg = Math.min(1, consumed / Math.max(1, target)) * 360;
  const pct = Math.round((consumed / Math.max(1, target)) * 100);
  const ring = `conic-gradient(from 0deg, var(--purp), var(--yel) ${deg}deg, #241a32 ${deg}deg 360deg)`;
  return (
    <div className="xp-nl-wheel" role="img" aria-label={tr.wheelAria(consumed, target)} data-testid="explorer-macro-wheel">
      <div className="xp-nl-wheel-ring" style={{ background: ring }} />
      <div className="xp-nl-wheel-hole">
        <span className="xp-nl-wheel-kcal">{consumed.toLocaleString()}</span>
        <span className="xp-nl-wheel-sub">/ {target.toLocaleString()} kcal</span>
        <span className="xp-nl-wheel-pct">{pct}%</span>
      </div>
    </div>
  );
}

// ── Fasting eating-window timeline — the premium pg-fast track, live clock ────
function GuestFastingWindow({ fasting, now, tr }) {
  if (!fasting) {
    return (
      <div>
        <div className="xp-fast-top">
          <span className="xp-fast-title">{tr.eatingWindow}</span>
          <span className="xp-fast-status is-eating">{tr.unrestricted}</span>
        </div>
        <div className="xp-fast-offmsg">{tr.offMsg}</div>
      </div>
    );
  }
  // Same geometry as the premium card: eating window anchors to an 8pm close.
  const eatEnd = 20;
  const eatStart = eatEnd - fasting.eat;
  const h = now.getHours() + now.getMinutes() / 60;
  const eating = h >= eatStart && h < eatEnd;
  const nowPct = (h / 24) * 100;
  const winLeft = (eatStart / 24) * 100;
  const winWidth = (fasting.eat / 24) * 100;
  const minsLeft = eating
    ? (eatEnd - h) * 60
    : h < eatStart ? (eatStart - h) * 60 : (24 - h + eatStart) * 60;
  const ratioLabel = `${fasting.fast} / ${fasting.eat}`;
  return (
    <div>
      <div className="xp-fast-top">
        <span className="xp-fast-title">{tr.fastingWindow(ratioLabel)}</span>
        <span className={`xp-fast-status ${eating ? 'is-eating' : 'is-fasting'}`}>
          {eating ? tr.eating : tr.fastingTag}
        </span>
      </div>
      <div
        className="xp-fast-track"
        role="img"
        aria-label={`${tr.eatingWindow}: ${fmtClock(eatStart)} – ${fmtClock(eatEnd)}`}
      >
        <div className="xp-fast-win" style={{ left: `${winLeft}%`, width: `${winWidth}%` }} />
        <div className="xp-fast-now" style={{ left: `${nowPct}%` }} />
      </div>
      <div className="xp-fast-axis">
        <span>12a</span><span>6a</span><span>12p</span><span>6p</span><span>12a</span>
      </div>
      <div className="xp-fast-clockrow">
        <div className="xp-fast-clock" data-testid="explorer-fasting-clock">
          <span className="xp-fast-clock-time">{fmtHM(minsLeft)}</span>
          <span className="xp-fast-clock-lbl">{eating ? tr.clockEat : tr.clockFast}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * GuestFuelDashboard — presentational Nutrition Locker clone for /explore.
 *
 * @param {object} props
 * @param {number} props.base   - guest maintenance TDEE (kcal/day)
 * @param {number} props.target - goal-adjusted daily target (kcal/day)
 * @param {number} props.p - protein target (g)  — the number the e2e asserts
 * @param {number} props.c - carb target (g)
 * @param {number} props.f - fat target (g)
 */
export default function GuestFuelDashboard({ base, target, p, c, f }) {
  const { lang } = useLang();
  const tr = L10N[lang] || L10N.en;
  const [paceId, setPaceId] = useState('16:8'); // Sovereign 16/8 identity default
  const now = new Date();
  const fasting = useMemo(() => {
    const pace = FASTING_PACES.find((x) => x.id === paceId);
    return pace && pace.id !== 'off' ? pace : null;
  }, [paceId]);

  // Mid-day demo frame: the wheel shows the product's living consumed/target
  // ring at a fixed 62% — pure theater, nothing logged, nothing stored.
  const consumed = Math.round((target * 0.62) / 10) * 10;

  // Calorie-share ratio, same math as the premium locker (p*4 / c*4 / f*9).
  const pCal = p * 4, cCal = c * 4, fCal = f * 9;
  const calSum = Math.max(1, pCal + cCal + fCal);
  const ratio = {
    p: Math.round((pCal / calSum) * 100),
    c: Math.round((cCal / calSum) * 100),
    f: Math.round((fCal / calSum) * 100),
  };

  const dayName = now.toLocaleDateString(DATE_LOCALES[lang] || 'en-US', { weekday: 'long' });
  const legend = [
    { k: 'p', lbl: tr.protein, val: `${p}g`, color: MACRO_COLORS.p, testId: 'explorer-macro-protein' },
    { k: 'c', lbl: tr.carbs, val: `${c}g`, color: MACRO_COLORS.c, testId: 'explorer-macro-carbs' },
    { k: 'f', lbl: tr.fat, val: `${f}g`, color: MACRO_COLORS.f, testId: 'explorer-macro-fat' },
    { k: 'kcal', lbl: tr.kcal, val: target.toLocaleString(), color: 'var(--yel)', testId: 'explorer-macro-kcal' },
  ];

  return (
    <div data-testid="explorer-fuel-dashboard">
      {/* Plan banner — the premium .nl-day-head purple gradient totals card */}
      <div className="xp-nl-day-head">
        <div className="xp-nl-day-head-cuisine">{tr.planLabel} · {dayName}</div>
        <div className="xp-nl-day-head-cal">{target.toLocaleString()} {tr.calPerDay}</div>
        <div className="xp-nl-day-head-goal">🎯 {tr.maintenance}: {base.toLocaleString()} {tr.calPerDay}</div>
      </div>

      {/* Today's Fuel — wheel + 4-box target legend + volume-ratio bar */}
      <div className="xp-card" style={{ marginBottom: '1rem' }}>
        <div className="xp-fuel-title">{tr.todaysFuel}</div>
        <GuestMacroWheel consumed={consumed} target={target} tr={tr} />
        <div className="xp-nl-legend">
          {legend.map((m) => (
            <div key={m.k} className="xp-nl-legend-box" style={{ borderTopColor: m.color }}>
              <div className="xp-nl-legend-lbl">{m.lbl}</div>
              <div className="xp-nl-legend-val" data-testid={m.testId}>{m.val}</div>
              <div className="xp-nl-legend-tgt">{tr.dailyTarget}</div>
            </div>
          ))}
        </div>
        <div className="xp-nl-ratio" aria-label={tr.ratioAria}>
          <div className="xp-nl-ratio-track">
            <div className="xp-nl-ratio-seg" style={{ width: `${ratio.p}%`, background: MACRO_COLORS.p }} />
            <div className="xp-nl-ratio-seg" style={{ width: `${ratio.c}%`, background: MACRO_COLORS.c }} />
            <div className="xp-nl-ratio-seg" style={{ width: `${ratio.f}%`, background: MACRO_COLORS.f }} />
          </div>
          <div className="xp-nl-ratio-legend">
            <span className="xp-nl-ratio-key"><span className="xp-nl-ratio-dot" style={{ background: MACRO_COLORS.p }} />{tr.rProtein(ratio.p)}</span>
            <span className="xp-nl-ratio-key"><span className="xp-nl-ratio-dot" style={{ background: MACRO_COLORS.c }} />{tr.rCarbs(ratio.c)}</span>
            <span className="xp-nl-ratio-key"><span className="xp-nl-ratio-dot" style={{ background: MACRO_COLORS.f }} />{tr.rFat(ratio.f)}</span>
          </div>
        </div>
      </div>

      {/* Fasting Pace — chips + live eating-window timeline (16/8 default) */}
      <div className="xp-card" data-testid="explorer-fasting-card">
        <div className="xp-nl-fast-head">
          <span className="xp-nl-fast-kicker">{tr.paceKicker}</span>
          <span className="xp-nl-fast-note">{tr.paceNote}</span>
        </div>
        <div className="xp-nl-pace" role="radiogroup" aria-label={tr.paceKicker}>
          {FASTING_PACES.map((pace) => {
            const active = pace.id === paceId;
            return (
              <button
                key={pace.id}
                type="button"
                role="radio"
                aria-checked={active}
                className={`xp-nl-pace-chip${active ? ' is-active' : ''}${pace.id === 'off' ? ' is-off' : ''}`}
                onClick={() => setPaceId(pace.id)}
                data-testid={`explorer-pace-${pace.id.replace(':', '-')}`}
              >
                <span className="xp-nl-pace-ratio">{pace.id === 'off' ? tr.off : pace.id}</span>
                <span className="xp-nl-pace-desc">{tr.paceShort[pace.id]}</span>
              </button>
            );
          })}
        </div>
        <GuestFastingWindow fasting={fasting} now={now} tr={tr} />
      </div>
    </div>
  );
}
