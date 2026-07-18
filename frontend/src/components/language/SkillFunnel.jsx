// src/components/language/SkillFunnel.jsx
// ─────────────────────────────────────────────────────────────────────────────
// THE 5-PHASE SKILL FUNNEL — the menu block that opens when a Curriculum Atlas
// category is selected. Five colorful phase gates over the shared item bank:
//
//   📇 Vocabulary → 🔊 Listening → 👁️ Reading → 🧠 Memory → 📝 Writing
//
// plus the primary GOLD ⭐️ START CATEGORY TEST, which runs all five phases
// back-to-back; clearing the fifth marks the category complete (onCleared),
// which is how the gateway unlocks the next level tier.
//
// A single phase can also be entered à la carte from its tile. Every drill is
// mounted from phaseDrills.jsx; the funnel just owns navigation + the test loop.

import { useState } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import { VocabularyDrill, ListeningDrill, ReadingDrill, MemoryDrill, WritingDrill } from './phaseDrills.jsx';
import { PHASES, FX_STR } from './funnelStrings.js';
import './language.css';

// Phase id → drill component, the funnel's router table.
const DRILL_BY_PHASE = {
  vocab: VocabularyDrill,
  listen: ListeningDrill,
  read: ReadingDrill,
  memory: MemoryDrill,
  write: WritingDrill,
};

// Colorful per-phase accents for the funnel tiles (decorative — the GOLD START
// button below stays the single brand CTA).
const PHASE_ACCENT = {
  vocab: '#6a0dad', listen: '#1098ad', read: '#2f9e44', memory: '#9c36b5', write: '#e8590c',
};

const FUNNEL_STR = {
  en: { start: '⭐️ Start Category Test', test: 'Category Test', of: 'Phase', back: '‹ Categories' },
  es: { start: '⭐️ Iniciar Prueba', test: 'Prueba de Categoría', of: 'Fase', back: '‹ Categorías' },
  pt: { start: '⭐️ Iniciar Teste', test: 'Teste da Categoria', of: 'Fase', back: '‹ Categorias' },
};

export default function SkillFunnel({ category, language, onBack, onCleared }) {
  const { lang } = useLang();
  const fx = FX_STR[lang] || FX_STR.en;
  const fs = FUNNEL_STR[lang] || FUNNEL_STR.en;
  const items = Array.isArray(category.items) ? category.items : [];

  // active: null (menu) | a single phase id | 'test' (sequential run)
  const [active, setActive] = useState(null);
  const [testStep, setTestStep] = useState(0);
  // Pimsleur 'audio-first' Blind Mode — seeds the Vocabulary drill so it leads
  // with 🔊 audio and conceals the text until tapped. Set here at the funnel
  // level; the drill also exposes its own in-card toggle.
  const [blindMode, setBlindMode] = useState(false);

  const title = category.titles[lang] || category.titles.en;

  // ── the funnel menu (default view) ──
  if (active == null) {
    return (
      <section className="fn-shell" data-testid="skill-funnel">
        <div className="fn-head">
          <button type="button" className="fn-back" onClick={onBack}>{fs.back}</button>
          <span className="fn-head-cat" style={{ color: category.accent }}>{category.icon} {title}</span>
          <button
            type="button"
            className={`fx-blind-chip${blindMode ? ' is-on' : ''}`}
            aria-pressed={blindMode}
            onClick={() => setBlindMode((b) => !b)}
            data-testid="fn-blind-toggle"
          >
            🙈 {fx.blind}
          </button>
        </div>
        <div className="fn-phases">
          {PHASES.map((p, n) => (
            <button
              key={p.id}
              type="button"
              className="fn-phase"
              style={{ '--fn-accent': PHASE_ACCENT[p.id] }}
              onClick={() => { setActive(p.id); }}
              data-testid={`fn-phase-${p.id}`}
            >
              <span className="fn-phase-idx">{String(n + 1).padStart(2, '0')}</span>
              <span className="fn-phase-emoji" aria-hidden="true">{p.emoji}</span>
              <span className="fn-phase-label">{fx.phase[p.key]}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="fn-start"
          onClick={() => { setTestStep(0); setActive('test'); }}
          data-testid="fn-start-test"
        >
          {fs.start}
        </button>
      </section>
    );
  }

  // ── sequential CATEGORY TEST — walk all five phases, then mark cleared ──
  if (active === 'test') {
    const phase = PHASES[testStep];
    const Drill = DRILL_BY_PHASE[phase.id];
    const advance = () => {
      if (testStep + 1 >= PHASES.length) {
        onCleared?.(category.id);
        setActive(null); setTestStep(0);
      } else {
        setTestStep((s) => s + 1);
      }
    };
    return (
      <div className="fn-test" data-testid="fn-test">
        <div className="fn-test-rail" aria-label={fs.test}>
          {PHASES.map((p, n) => (
            <span key={p.id} className={`fn-test-pip${n === testStep ? ' is-active' : ''}${n < testStep ? ' is-done' : ''}`}>
              {p.emoji}
            </span>
          ))}
          <span className="fn-test-count">{fs.of} {testStep + 1}/{PHASES.length}</span>
        </div>
        <Drill category={category} items={items} language={language} onExit={advance} blindMode={blindMode} />
      </div>
    );
  }

  // ── à-la-carte single phase ──
  const Drill = DRILL_BY_PHASE[active];
  return <Drill category={category} items={items} language={language} onExit={() => setActive(null)} blindMode={blindMode} />;
}
