// src/components/command/ResearchLibrary.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Coach Lab · Research Vault — THE CURATED ACADEMIC LIBRARY.
//
// Static ground-truth payload (exerciseScienceResearchVault.json) rendered as:
//   1. THE ACADEMIC CRITERIA CHECKLIST — the CGCC → NAU → M.S. progression
//      (4 phases · 14 milestones) as a check-off tracker. Check state persists
//      to localStorage so progression survives refreshes; the JSON's own
//      status field renders as a chip alongside.
//   2. THE RESEARCH STUDY GRID — 100 exercise-science study cards (title +
//      academic summary + gym application), each with a ▶ Play Audio narration
//      of its audio_script through the native Web Speech API (speechNarrator:
//      premium-OS-voice filtered, strictly one track at a time).
//
// Purely client-side — no backend, no tokens. Sits above the live Claude
// ingest composer inside the Research Vault pillar; Laboratory-Gold (cl-/rl-)
// dark styling throughout.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import { speakScript, stopSpeech, ttsSupported } from '../../lib/speechNarrator.js';
import researchVaultData from '../../data/exerciseScienceResearchVault.json';

const DONE_KEY = 'bbf_acad_criteria_done';
const PAGE = 12; // studies revealed per "load more" step (100 cards would drown the deck)

const RL_STR = {
  en: {
    criteriaKicker: 'Academic Criteria · Exercise Science Track',
    criteriaTitle: 'The Progression Checklist',
    progress: (d, t) => `${d} of ${t} milestones checked`,
    library: 'Research Library', libSub: (n) => `${n} evidence briefs — academic summary, gym application, and coach-voice audio.`,
    summaryLabel: 'Academic Summary', applicationLabel: 'Gym Application',
    play: '▶ Play Audio', stop: '■ Stop', playing: 'Playing…', noTts: 'Audio narration is unavailable in this browser.',
    more: (n) => `Load ${n} more`, competencies: 'Competencies',
  },
  es: {
    criteriaKicker: 'Criterios Académicos · Ruta de Ciencias del Ejercicio',
    criteriaTitle: 'La Lista de Progresión',
    progress: (d, t) => `${d} de ${t} hitos marcados`,
    library: 'Biblioteca de Investigación', libSub: (n) => `${n} resúmenes de evidencia — resumen académico, aplicación en el gimnasio y audio con voz de coach.`,
    summaryLabel: 'Resumen Académico', applicationLabel: 'Aplicación en el Gimnasio',
    play: '▶ Reproducir Audio', stop: '■ Detener', playing: 'Reproduciendo…', noTts: 'La narración de audio no está disponible en este navegador.',
    more: (n) => `Cargar ${n} más`, competencies: 'Competencias',
  },
  pt: {
    criteriaKicker: 'Critérios Acadêmicos · Trilha de Ciências do Exercício',
    criteriaTitle: 'A Lista de Progressão',
    progress: (d, t) => `${d} de ${t} marcos concluídos`,
    library: 'Biblioteca de Pesquisa', libSub: (n) => `${n} resumos de evidência — resumo acadêmico, aplicação na academia e áudio com voz de coach.`,
    summaryLabel: 'Resumo Acadêmico', applicationLabel: 'Aplicação na Academia',
    play: '▶ Reproduzir Áudio', stop: '■ Parar', playing: 'Reproduzindo…', noTts: 'A narração de áudio não está disponível neste navegador.',
    more: (n) => `Carregar mais ${n}`, competencies: 'Competências',
  },
};

function readDone() {
  try {
    const raw = JSON.parse(localStorage.getItem(DONE_KEY) || '[]');
    return new Set(Array.isArray(raw) ? raw : []);
  } catch { return new Set(); }
}

export default function ResearchLibrary() {
  const { lang } = useLang();
  const tr = RL_STR[lang] || RL_STR.en;

  const phases = researchVaultData.academic_criteria;
  const studies = researchVaultData.research_studies;
  const totalMilestones = useMemo(() => phases.reduce((n, p) => n + p.milestones.length, 0), [phases]);

  // ── 1 · progression checklist (persisted check-off) ──
  const [done, setDone] = useState(readDone);
  const toggleMilestone = (id) => setDone((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    try { localStorage.setItem(DONE_KEY, JSON.stringify([...n])); } catch { /* quota */ }
    return n;
  });

  // ── 2 · study grid + single-track Web Speech narration ──
  const [playingId, setPlayingId] = useState(null);
  const [visible, setVisible] = useState(PAGE);
  const utterRef = useRef(null);

  // Kill any narration when the pillar unmounts (tab swap / route change).
  useEffect(() => () => stopSpeech(), []);

  const playStudy = (study) => {
    if (playingId === study.id) { // second click on the active card = stop
      stopSpeech();
      utterRef.current = null;
      setPlayingId(null);
      return;
    }
    // speakScript cancels any active track first (single-track contract); the
    // identity guard keeps the OLD utterance's end event from clearing the new one.
    const u = speakScript(study.audio_script, {
      onEnd: () => setPlayingId((cur) => (utterRef.current === u ? null : cur)),
    });
    utterRef.current = u;
    setPlayingId(u ? study.id : null);
  };

  const shown = studies.slice(0, visible);
  const pct = totalMilestones ? Math.round((done.size / totalMilestones) * 100) : 0;

  return (
    <div className="rl" data-testid="research-library">
      {/* ── ACADEMIC CRITERIA — the progression checklist ── */}
      <section className="rl-criteria" aria-label={tr.criteriaTitle}>
        <div className="rl-crit-head">
          <div>
            <span className="rl-kicker">{tr.criteriaKicker}</span>
            <h3 className="rl-title">{tr.criteriaTitle}</h3>
          </div>
          <span className="rl-progress" data-testid="rl-progress">{tr.progress(done.size, totalMilestones)}</span>
        </div>
        <div className="rl-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="rl-bar-fill" style={{ width: `${pct}%` }} />
        </div>

        {phases.map((phase) => (
          <div className="rl-phase" key={phase.phase}>
            <div className="rl-phase-name">{phase.phase}</div>
            <ul className="rl-checklist">
              {phase.milestones.map((m) => {
                const checked = done.has(m.id);
                return (
                  <li key={m.id} className={`rl-item${checked ? ' is-done' : ''}`}>
                    <label className="rl-item-main">
                      <input
                        type="checkbox"
                        className="rl-check"
                        checked={checked}
                        onChange={() => toggleMilestone(m.id)}
                        data-testid={`rl-check-${m.id}`}
                      />
                      <span className="rl-item-text">
                        <span className="rl-item-title">{m.title}</span>
                        <span className="rl-item-desc">{m.description}</span>
                        <span className="rl-item-comp" title={tr.competencies}>{m.competencies.join(' · ')}</span>
                      </span>
                    </label>
                    <span className="rl-status">{m.status}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>

      {/* ── RESEARCH LIBRARY — the study card grid + narration ── */}
      <section className="rl-lib" aria-label={tr.library}>
        <span className="rl-kicker">{tr.library}</span>
        <p className="rl-lib-sub">{tr.libSub(studies.length)}</p>
        {!ttsSupported ? <p className="rl-notts" role="note">{tr.noTts}</p> : null}

        <div className="rl-grid" data-testid="rl-grid">
          {shown.map((s) => {
            const isPlaying = playingId === s.id;
            return (
              <article key={s.id} className={`rl-card${isPlaying ? ' is-playing' : ''}`} data-testid={`rl-card-${s.id}`}>
                <div className="rl-card-top">
                  <span className="rl-card-id">{s.id}</span>
                  {isPlaying ? <span className="rl-playing" data-testid="rl-playing">◉ {tr.playing}</span> : null}
                </div>
                <h4 className="rl-card-title">{s.title}</h4>
                <div className="rl-sec">
                  <span className="rl-sec-lbl">{tr.summaryLabel}</span>
                  <p className="rl-sec-body">{s.academic_summary}</p>
                </div>
                <div className="rl-sec rl-sec--app">
                  <span className="rl-sec-lbl rl-sec-lbl--gold">{tr.applicationLabel}</span>
                  <p className="rl-sec-body">{s.gym_application}</p>
                </div>
                {ttsSupported ? (
                  <button
                    type="button"
                    className={`rl-play${isPlaying ? ' is-live' : ''}`}
                    onClick={() => playStudy(s)}
                    data-testid={`rl-play-${s.id}`}
                  >
                    {isPlaying ? tr.stop : tr.play}
                  </button>
                ) : null}
              </article>
            );
          })}
        </div>

        {visible < studies.length ? (
          <button type="button" className="rl-more" onClick={() => setVisible((v) => v + PAGE)} data-testid="rl-more">
            {tr.more(Math.min(PAGE, studies.length - visible))}
          </button>
        ) : null}
      </section>
    </div>
  );
}
