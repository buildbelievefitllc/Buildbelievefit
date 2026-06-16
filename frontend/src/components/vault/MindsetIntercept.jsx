// src/components/vault/MindsetIntercept.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Dynamic Mindset Intercept — when the day's Sovereign Readiness drops below the
// optimal threshold (CNS strain / breach / low score), this auto-mounts the
// Champion Mindset inline player on the Client Hub to intercept the athlete BEFORE
// they train: reset the nervous system, bank a mental rep, then decide to load.
//
// Self-gating + zero-friction: reads the SAME shared readiness store every regulated
// surface consumes (useDailyReadiness), renders NOTHING when readiness is optimal,
// when there's no telemetry, or once the athlete dismisses it for the day. No props.

import { useState } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import { useDailyReadiness } from '../../lib/useDailyReadiness.js';
import ChampionMindset from './ChampionMindset.jsx';
import './mindsetIntercept.css';

const STR = {
  en: {
    kicker: 'Mindset Intercept',
    title: 'Recovery Flag — Reset Before You Train',
    sub: (s) => `Readiness is below optimal (${s}). Take two minutes with a champion before you load the bar.`,
    dismiss: 'Dismiss for today',
  },
  es: {
    kicker: 'Intercepción Mental',
    title: 'Bandera de Recuperación — Reinicia Antes de Entrenar',
    sub: (s) => `La preparación está por debajo de lo óptimo (${s}). Tómate dos minutos con un campeón antes de cargar la barra.`,
    dismiss: 'Descartar por hoy',
  },
  pt: {
    kicker: 'Interceptação Mental',
    title: 'Alerta de Recuperação — Reinicie Antes de Treinar',
    sub: (s) => `A prontidão está abaixo do ideal (${s}). Reserve dois minutos com um campeão antes de carregar a barra.`,
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

export default function MindsetIntercept() {
  const { lang } = useLang();
  const tr = STR[lang] || STR.en;
  const { data: vm } = useDailyReadiness();
  const [dismissed, setDismissed] = useState(() => readDismissed());

  if (!isBelowOptimal(vm) || dismissed) return null;

  const scoreTxt = vm.score == null ? '—' : `${vm.score}/100`;
  const mode = vm.isBreach || vm.mode === 'SYSTEM_BREACH' ? 'breach' : 'strain';

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

      {/* Auto-mounted Champion Mindset inline player — the intercept itself. */}
      <div className="mi-player">
        <ChampionMindset />
      </div>
    </div>
  );
}
