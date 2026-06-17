// src/components/vault/MindsetIntercept.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Dynamic Mindset Intercept — when the day's Sovereign Readiness drops below the
// optimal threshold (CNS strain / breach / low score), this auto-mounts a SINGLE
// targeted Champion Mindset card on the Client Hub to intercept the athlete BEFORE
// they train: reset the nervous system, bank a mental rep, then decide to load.
//
// UI DIET (CEO order): the intercept no longer mounts the entire <ChampionMindset/>
// cinema library — that was severe UI bloat on the Hub. It now prescribes exactly
// ONE champion card, and that card STRICTLY respects the active language tier.
//   • PHASE 1 — language routing: the roster is read from the active locale's tier
//     (L10N[lang].champions), which holds ONLY that tier's champions — the ES tier
//     pulls Canelo / Topuria …, never an English cut.
//   • PHASE 2 — deterministic single pick: the day-of-year selects exactly one
//     champion, stable all day, never re-rolling on re-render.
//   • PHASE 3 — single-card mount: the exact `.cm-vcard` accordion (shared
//     <ChampionFilmCard/>) renders directly in the intercept under a localized
//     "prescription" sub-header.
//
// Self-gating + zero-friction: reads the SAME shared readiness store every regulated
// surface consumes (useDailyReadiness), renders NOTHING when readiness is optimal,
// when there's no telemetry, or once the athlete dismisses it for the day. No props.

import { useMemo, useState } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import { useDailyReadiness } from '../../lib/useDailyReadiness.js';
import ChampionFilmCard from './ChampionFilmCard.jsx';
import { L10N, readLocked, writeLocked } from './championMindsetData.js';
import './mindsetIntercept.css';

const STR = {
  en: {
    kicker: 'Mindset Intercept',
    title: 'Recovery Flag — Reset Before You Train',
    sub: (s) => `Readiness is below optimal (${s}). Take two minutes with a champion before you load the bar.`,
    prescription: 'Sovereign Readiness Prescription',
    prescriptionNote: 'One champion, prescribed for today — matched to your language and recovery state.',
    dismiss: 'Dismiss for today',
  },
  es: {
    kicker: 'Intercepción Mental',
    title: 'Bandera de Recuperación — Reinicia Antes de Entrenar',
    sub: (s) => `La preparación está por debajo de lo óptimo (${s}). Tómate dos minutos con un campeón antes de cargar la barra.`,
    prescription: 'Prescripción de Preparación Soberana',
    prescriptionNote: 'Un campeón, prescrito para hoy — acorde a tu idioma y tu estado de recuperación.',
    dismiss: 'Descartar por hoy',
  },
  pt: {
    kicker: 'Interceptação Mental',
    title: 'Alerta de Recuperação — Reinicie Antes de Treinar',
    sub: (s) => `A prontidão está abaixo do ideal (${s}). Reserve dois minutos com um campeão antes de carregar a barra.`,
    prescription: 'Prescrição de Prontidão Soberana',
    prescriptionNote: 'Um campeão, prescrito para hoje — de acordo com seu idioma e seu estado de recuperação.',
    dismiss: 'Dispensar por hoje',
  },
};

// Below-optimal threshold: any CNS strain/breach verdict, or a readiness score
// under 60/100. Optimal (PRIME / STANDARD, score ≥ 60) never intercepts.
const OPTIMAL_FLOOR = 60;
function isBelowOptimal(vm) {
  if (!vm || !vm.hasData) return false;
  if (vm.isBreach) return true;
  if (vm.mode === 'SYSTEM_STRAIN' || vm.mode === 'SYSTEM_BREACH') return true;
  return vm.score != null && vm.score < OPTIMAL_FLOOR;
}

const DISMISS_KEY = 'bbf.vault.mindset-intercept.dismissed.v1';
function todayKey() { return new Date().toISOString().slice(0, 10); }
function readDismissed() {
  try { return JSON.parse(localStorage.getItem(DISMISS_KEY) || '{}')?.[todayKey()] === true; }
  catch { return false; }
}
function writeDismissed() {
  try {
    const all = JSON.parse(localStorage.getItem(DISMISS_KEY) || '{}');
    all[todayKey()] = true;
    localStorage.setItem(DISMISS_KEY, JSON.stringify(all));
  } catch { /* storage blocked — dismissal holds for the tab */ }
}

// Day-of-year (1–366, UTC) — the deterministic seed for the day's single pick.
// UTC keeps it consistent with the dismissal day-key above.
function dayOfYear(d = new Date()) {
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  const today = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.floor((today - start) / 86400000);
}

export default function MindsetIntercept() {
  const { lang } = useLang();
  const tr = STR[lang] || STR.en;
  // PHASE 1 — language tier. L10N[lang] is the active locale's roster + chrome; its
  // `champions` array holds ONLY that tier (es → Canelo, Topuria…), so reading it IS
  // the locale filter — no cross-language leakage is possible.
  const L = L10N[lang] || L10N.en;
  const { data: vm } = useDailyReadiness();
  const [dismissed, setDismissed] = useState(() => readDismissed());
  const [open, setOpen] = useState(false);
  const [lockedToday, setLockedToday] = useState(() => readLocked());

  // PHASE 2 — deterministic single selection. The day-of-year picks exactly ONE
  // champion from the language-filtered roster; memoized on the active tier so it
  // stays consistent all day and never re-rolls on a re-render (pure date math —
  // never random). A new day (or a language toggle) yields a fresh, stable pick.
  const champion = useMemo(() => {
    const roster = L.champions || [];
    if (roster.length === 0) return null;
    return roster[dayOfYear() % roster.length];
  }, [L]);

  // Gate: optimal readiness, no telemetry, dismissed-for-today, or an empty roster
  // → render nothing.
  if (!isBelowOptimal(vm) || dismissed || !champion) return null;

  const scoreTxt = vm.score == null ? '—' : `${vm.score}/100`;
  const mode = vm.isBreach || vm.mode === 'SYSTEM_BREACH' ? 'breach' : 'strain';
  const locked = lockedToday === champion.id;

  return (
    <div className="mi" data-testid="mindset-intercept" data-bbf-mode={mode}>
      <div className="mi-banner">
        <span className="mi-glyph" aria-hidden="true">✦</span>
        <div className="mi-copy">
          <span className="mi-kicker">{tr.kicker}</span>
          <h3 className="mi-title">{tr.title}</h3>
          <p className="mi-sub">{tr.sub(scoreTxt)}</p>
        </div>
        <button
          type="button"
          className="mi-dismiss"
          onClick={() => { writeDismissed(); setDismissed(true); }}
          aria-label={tr.dismiss}
          data-testid="mindset-intercept-dismiss"
        >
          ×
        </button>
      </div>

      {/* PHASE 3 — the intercept IS one targeted, language-locked champion card
          (the exact `.cm-vcard` accordion), under a localized prescription header. */}
      <div className="mi-player">
        <div className="mi-rx-head">
          <span className="mi-rx-glyph" aria-hidden="true">✦</span>
          <div className="mi-rx-copy">
            <span className="mi-rx-label">{tr.prescription}</span>
            <span className="mi-rx-note">{tr.prescriptionNote}</span>
          </div>
        </div>
        <ChampionFilmCard
          champion={champion}
          L={L}
          open={open}
          locked={locked}
          onOpen={() => setOpen(true)}
          onCollapse={() => setOpen(false)}
          onLockIn={() => { writeLocked(champion.id); setLockedToday(champion.id); }}
        />
      </div>
    </div>
  );
}
