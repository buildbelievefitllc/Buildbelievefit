// src/components/vault/MindsetEngine.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 21.5 — Mindset Engine: a functional daily awareness module (React port of
// window.BBF_MINDSET_ENGINE). Three deterministic daily-rotating prompts —
// Manifestation, Focus, Visualization — grounded in awareness/manifestation
// practice (The Power of Awareness · Manifest Now), each cyclable with "Next".
//
// Adds a daily STATE-CHECK (a quick alignment self-assessment, persisted locally
// per day) and the SOLIS-TRANSIT arc — a daily solar-phase marker that frames the
// session within the day's rhythm. Trilingual via LangContext.

import { useMemo, useState } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import './vault.css';

// Trilingual seed, ported verbatim from the monolith's BBF_MINDSET_ENGINE.
const SEED = {
  en: {
    manifestation: [
      'I am the architect of my own strength.',
      'Discipline is the bridge between my goals and my results.',
      'I do not negotiate with the part of me that wants to quit.',
      'Every rep is a vote for the person I am becoming.',
      'I train for the body I am earning, not the one I was given.',
      'Pressure is the price of a standard I refuse to lower.',
    ],
    focus: [
      'Box-breathe before your top set — inhale 4, hold 4, exhale 4, hold 4. Three rounds locks the nervous system in.',
      'Pick one cue per lift and ignore the rest. Today: drive through mid-foot.',
      'Phone in the bag between sets. Rest is training, not scroll time.',
      'Name your intention for this session in one sentence before you touch a weight.',
      'Train the set in front of you. The next one does not exist yet.',
    ],
    visualization: [
      'Before your heaviest set, run the full rep in your mind three times in real time — setup, brace, drive, lockout.',
      'See the bar moving fast even when it is heavy. The brain rehearses what the body executes.',
      'Picture the last, hardest rep first. If you can see it clean, you can own it.',
      'Walk through the entire session start to finish with your eyes closed before you begin.',
    ],
  },
  es: {
    manifestation: [
      'Soy el arquitecto de mi propia fuerza.',
      'La disciplina es el puente entre mis metas y mis resultados.',
      'No negocio con la parte de mí que quiere rendirse.',
      'Cada repetición es un voto por la persona en la que me estoy convirtiendo.',
      'Entreno por el cuerpo que estoy ganando, no por el que me dieron.',
      'La presión es el precio de un estándar que me niego a bajar.',
    ],
    focus: [
      'Respira en caja antes de tu serie principal — inhala 4, mantén 4, exhala 4, mantén 4. Tres rondas fijan el sistema nervioso.',
      'Elige una sola señal por ejercicio e ignora el resto. Hoy: empuja desde el medio del pie.',
      'Teléfono en la bolsa entre series. El descanso es entrenamiento, no tiempo de pantalla.',
      'Nombra tu intención para esta sesión en una frase antes de tocar un peso.',
      'Entrena la serie que tienes delante. La siguiente todavía no existe.',
    ],
    visualization: [
      'Antes de tu serie más pesada, repite la repetición completa en tu mente tres veces en tiempo real — preparación, tensión, empuje, bloqueo.',
      'Visualiza la barra moviéndose rápido aunque sea pesada. El cerebro ensaya lo que el cuerpo ejecuta.',
      'Imagina primero la última repetición, la más dura. Si la ves limpia, puedes dominarla.',
      'Recorre toda la sesión de principio a fin con los ojos cerrados antes de empezar.',
    ],
  },
  pt: {
    manifestation: [
      'Eu sou o arquiteto da minha própria força.',
      'A disciplina é a ponte entre minhas metas e meus resultados.',
      'Eu não negocio com a parte de mim que quer desistir.',
      'Cada repetição é um voto pela pessoa que estou me tornando.',
      'Eu treino pelo corpo que estou conquistando, não pelo que me deram.',
      'A pressão é o preço de um padrão que me recuso a baixar.',
    ],
    focus: [
      'Respire em caixa antes da sua série principal — inspire 4, segure 4, expire 4, segure 4. Três rodadas fixam o sistema nervoso.',
      'Escolha um único foco por exercício e ignore o resto. Hoje: empurre pelo meio do pé.',
      'Celular na bolsa entre as séries. O descanso é treino, não tempo de tela.',
      'Defina sua intenção para esta sessão em uma frase antes de tocar em qualquer peso.',
      'Treine a série à sua frente. A próxima ainda não existe.',
    ],
    visualization: [
      'Antes da sua série mais pesada, execute a repetição completa na mente três vezes em tempo real — preparação, contração, impulso, travamento.',
      'Visualize a barra movendo-se rápido mesmo quando está pesada. O cérebro ensaia o que o corpo executa.',
      'Imagine primeiro a última repetição, a mais difícil. Se você a vê limpa, você a domina.',
      'Percorra toda a sessão do início ao fim de olhos fechados antes de começar.',
    ],
  },
};

const CARD_META = {
  en: { manifestation: 'Manifestation', focus: 'Focus Strategy', visualization: 'Visualization Drill', title: 'Mindset Engine', state: 'State-check — how aligned do you feel today?', next: 'Next ›', solis: 'Solar Transit', states: ['Scattered', 'Steady', 'Locked In'] },
  es: { manifestation: 'Manifestación', focus: 'Estrategia de Enfoque', visualization: 'Ejercicio de Visualización', title: 'Motor de Mentalidad', state: 'Chequeo — ¿qué tan alineado te sientes hoy?', next: 'Siguiente ›', solis: 'Tránsito Solar', states: ['Disperso', 'Estable', 'Enfocado'] },
  pt: { manifestation: 'Manifestação', focus: 'Estratégia de Foco', visualization: 'Exercício de Visualização', title: 'Motor de Mentalidade', state: 'Checagem — quão alinhado você se sente hoje?', next: 'Próximo ›', solis: 'Trânsito Solar', states: ['Disperso', 'Estável', 'Focado'] },
};

const CARDS = [
  { key: 'manifestation', icn: '🔥', cls: 'affirm' },
  { key: 'focus', icn: '🎯', cls: 'focus' },
  { key: 'visualization', icn: '🧠', cls: 'viz' },
];

const STATE_KEY = 'bbf.vault.mindstate.v1';
function todayKey() { return new Date().toISOString().slice(0, 10); }
function dayIndex(len) { return len ? Math.floor(Date.now() / 86400000) % len : 0; }

function readState() {
  try {
    const all = JSON.parse(localStorage.getItem(STATE_KEY) || '{}');
    return all?.[todayKey()] ?? null;
  } catch { return null; }
}
function writeState(v) {
  try {
    const all = JSON.parse(localStorage.getItem(STATE_KEY) || '{}');
    all[todayKey()] = v;
    localStorage.setItem(STATE_KEY, JSON.stringify(all));
  } catch { /* storage blocked — value holds for the tab */ }
}

// Solis-Transit: the sun's fractional progress through the day (0 at midnight,
// 1 at the next midnight) → an arc marker framing the session in the day's rhythm.
function solarProgress(now) {
  return (now.getHours() * 60 + now.getMinutes()) / 1440;
}

export default function MindsetEngine() {
  const { lang } = useLang();
  const L = SEED[lang] ? lang : 'en';
  const t = CARD_META[L] || CARD_META.en;
  const src = SEED[L];

  // Per-card offset from the deterministic daily index; "Next" advances it.
  const [offsets, setOffsets] = useState({ manifestation: 0, focus: 0, visualization: 0 });
  const [state, setState] = useState(() => readState());
  const now = useMemo(() => new Date(), []);
  const sun = solarProgress(now);

  const pick = (key) => {
    const arr = src[key] || [];
    if (!arr.length) return '';
    const idx = (dayIndex(arr.length) + offsets[key]) % arr.length;
    return arr[idx];
  };
  const cycle = (key) => setOffsets((o) => ({ ...o, [key]: o[key] + 1 }));
  const chooseState = (i) => { setState(i); writeState(i); };

  return (
    <div className="mind">
      <div className="mind-head">
        <h3 className="mind-title">{t.title}</h3>
        {/* Solis-Transit arc */}
        <div className="mind-solis" title={t.solis}>
          <span className="mind-solis-lbl">{t.solis}</span>
          <div className="mind-solis-track">
            <div className="mind-solis-sun" style={{ left: `${sun * 100}%` }} />
          </div>
        </div>
      </div>

      <div className="mind-grid">
        {CARDS.map((c) => (
          <div className={`mind-card ${c.cls}`} key={c.key}>
            <div className="mind-icn" aria-hidden="true">{c.icn}</div>
            <div className="mind-lbl">{t[c.key]}</div>
            <div className="mind-body">{pick(c.key)}</div>
            <button type="button" className="mind-cycle" onClick={() => cycle(c.key)}>{t.next}</button>
          </div>
        ))}
      </div>

      <div className="mind-state">
        <div className="mind-state-q">{t.state}</div>
        <div className="mind-state-opts">
          {t.states.map((s, i) => (
            <button
              key={s}
              type="button"
              className={`mind-state-opt${state === i ? ' is-active' : ''}`}
              aria-pressed={state === i}
              onClick={() => chooseState(i)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
