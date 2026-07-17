// src/components/language/GrammarClinic.jsx
// ─────────────────────────────────────────────────────────────────────────────
// MODE · THE GRAMMAR CLINIC — weak-cluster targeted micro-drills.
//
// THE PRESCRIPTION LOOP: the Immersion engine classifies every live mistake
// into the closed §4.4 taxonomy and rolls the athlete's worst offenders into
// bbf_language_profiles.weak_clusters. The Clinic READS that field (via
// bbf_get_language_dashboard) and serves clinicDrills.js weakest-cluster-first:
// yesterday's conversation failure is literally today's prescription. With no
// profile yet, the authored taxonomy order runs — the Clinic never sits empty.
//
// Sessions are 10 questions. Each answer shows the verdict + a one-line WHY
// (content gloss, English — chrome is trilingual), plus the completed correct
// sentence with a 🔊 through the global narration engine. A finished session
// appends to the closed-loop ledger as module 'clinic' (whitelist widened in
// 20260717150000) — the Polyglot Sentinel trends it like every other module.

import { useEffect, useMemo, useState } from 'react';
import { getLanguageDashboard, logLanguageAttempt } from '../../lib/languageLabApi.js';
import { orderDrillsForAthlete, CLINIC_CLUSTERS } from './clinicDrills.js';
import { useNarrator } from './useNarrator.js';
import { useLangUiStr } from './languageStrings.js';
import { useLang } from '../../context/LangContext.jsx';
import './language.css';

const SESSION_SIZE = 10;

const CL_STR = {
  en: { kicker: 'Grammar Clinic', title: 'Targeted repair', prescribed: 'Prescribed for you', generalPlan: 'General conditioning — play to build your profile', check: 'Lock it in', next: 'Next', hear: '🔊 Hear it', correct: '✓ Correct.', wrong: '✗ Not this time.', progress: (i, n) => `${i} of ${n}`, doneTitle: 'Session complete', done: (c, t) => `${c}/${t} correct — logged to your ledger.`, again: 'New session', loading: 'Reading your profile…' },
  es: { kicker: 'Clínica Gramatical', title: 'Reparación dirigida', prescribed: 'Recetado para ti', generalPlan: 'Acondicionamiento general — juega para construir tu perfil', check: 'Asegurar', next: 'Siguiente', hear: '🔊 Escúchala', correct: '✓ Correcto.', wrong: '✗ Esta vez no.', progress: (i, n) => `${i} de ${n}`, doneTitle: 'Sesión completa', done: (c, t) => `${c}/${t} correctas — registrado en tu historial.`, again: 'Nueva sesión', loading: 'Leyendo tu perfil…' },
  pt: { kicker: 'Clínica de Gramática', title: 'Reparo dirigido', prescribed: 'Prescrito para você', generalPlan: 'Condicionamento geral — jogue para construir seu perfil', check: 'Garantir', next: 'Próxima', hear: '🔊 Ouça', correct: '✓ Correto.', wrong: '✗ Desta vez não.', progress: (i, n) => `${i} de ${n}`, doneTitle: 'Sessão completa', done: (c, t) => `${c}/${t} corretas — registrado no seu histórico.`, again: 'Nova sessão', loading: 'Lendo seu perfil…' },
};

export default function GrammarClinic({ language = 'es' }) {
  const { lang } = useLang();
  const { clusters } = useLangUiStr();          // localized cluster labels (closed taxonomy)
  const { narrate } = useNarrator();
  const tr = CL_STR[lang] || CL_STR.en;

  const [weak, setWeak] = useState(null);       // null = loading · [] = no profile
  const [round, setRound] = useState(0);        // bump to start a fresh session
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState(null);   // chosen option index (locks the item)
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState([]);   // { id, cluster, good } for the ledger
  const [done, setDone] = useState(false);

  // One dashboard read keys the prescription. Non-throwing: any failure → [].
  // No sync setState here (house rule) — a target swap remounts this component
  // via the lm-stage key, so `weak` always starts back at the loading state.
  useEffect(() => {
    let alive = true;
    getLanguageDashboard(language).then((res) => {
      if (!alive) return;
      const w = res && res.ok && res.profile && Array.isArray(res.profile.weak_clusters) ? res.profile.weak_clusters : [];
      setWeak(w);
    });
    return () => { alive = false; };
  }, [language]);

  // Session deck: weakest clusters first; rotate the window per round so a new
  // session continues deeper into the same prescription instead of repeating.
  const deck = useMemo(() => {
    if (weak == null) return [];
    const ordered = orderDrillsForAthlete(language, weak);
    const start = (round * SESSION_SIZE) % Math.max(ordered.length, 1);
    return ordered.slice(start, start + SESSION_SIZE).concat(
      start + SESSION_SIZE > ordered.length ? ordered.slice(0, (start + SESSION_SIZE) - ordered.length) : [],
    );
  }, [language, weak, round]);

  const item = deck[idx];
  const prescribed = (weak || []).filter((c) => CLINIC_CLUSTERS.includes(c));

  const pick = (oi) => {
    if (picked != null || !item) return;
    const good = oi === item.correct;
    setPicked(oi);
    setScore((s) => s + (good ? 1 : 0));
    setAnswers((a) => [...a, { id: item.id, cluster: item.cluster, good }]);
  };

  const advance = () => {
    if (idx + 1 >= deck.length) {
      setDone(true);
      const finalScore = score;
      logLanguageAttempt({
        language, module: 'clinic',
        itemsTotal: deck.length, itemsCorrect: finalScore,
        items: answers,
      });
      return;
    }
    setIdx((i) => i + 1);
    setPicked(null);
  };

  const restart = () => { setRound((r) => r + 1); setIdx(0); setPicked(null); setScore(0); setAnswers([]); setDone(false); };

  // The completed correct sentence (blank filled) — narratable, memorable.
  const solved = item && item.q.includes('___') ? item.q.replace('___', item.options[item.correct]) : null;

  if (weak == null) {
    return (
      <section className="cl-shell" data-testid="grammar-clinic">
        <span className="lm-kicker">{tr.kicker}</span>
        <h3 className="lm-title">{tr.title}</h3>
        <div className="cl-loading">{tr.loading}</div>
      </section>
    );
  }

  if (done) {
    return (
      <section className="cl-shell" data-testid="grammar-clinic">
        <span className="lm-kicker">{tr.kicker}</span>
        <h3 className="lm-title">{tr.doneTitle}</h3>
        <div className="cl-done" data-testid="clinic-done">{tr.done(score, deck.length)}</div>
        <div className="tp-actions">
          <button type="button" className="tp-btn" onClick={restart}>{tr.again}</button>
        </div>
      </section>
    );
  }

  return (
    <section className="cl-shell" data-testid="grammar-clinic">
      <span className="lm-kicker">{tr.kicker}</span>
      <h3 className="lm-title">{tr.title}</h3>

      {/* the prescription header — which clusters this deck is treating */}
      <div className="cl-rx" data-testid="clinic-rx">
        <span className="cl-rx-label">{prescribed.length ? tr.prescribed : tr.generalPlan}</span>
        {prescribed.length ? (
          <span className="cl-rx-chips">
            {prescribed.map((c) => <span key={c} className="cl-rx-chip">{clusters[c] || c}</span>)}
          </span>
        ) : null}
      </div>

      {item ? (
        <>
          <div className="cl-meta">
            <span className="cl-cluster-tag" data-testid="clinic-cluster">{clusters[item.cluster] || item.cluster}</span>
            <span className="cl-progress">{tr.progress(idx + 1, deck.length)}</span>
          </div>
          <div className="cl-q" data-testid="clinic-q" lang={language}>{item.q}</div>

          <div className="cl-options" role="group">
            {item.options.map((opt, oi) => {
              const state = picked == null ? '' : oi === item.correct ? ' is-right' : oi === picked ? ' is-wrong' : ' is-dim';
              return (
                <button
                  key={opt}
                  type="button"
                  className={`cl-option${state}`}
                  onClick={() => pick(oi)}
                  disabled={picked != null}
                  data-testid="clinic-option"
                  lang={language}
                >
                  {opt}
                </button>
              );
            })}
          </div>

          {picked != null ? (
            <div className={`cl-verdict is-${picked === item.correct ? 'correct' : 'wrong'}`} data-testid="clinic-verdict">
              <strong>{picked === item.correct ? tr.correct : tr.wrong}</strong>
              <p className="cl-why">{item.why}</p>
              {solved ? (
                <button
                  type="button"
                  className="tp-btn tp-btn--ghost"
                  onClick={() => narrate({ text: solved, lang: language })}
                  data-testid="clinic-hear"
                >
                  {tr.hear} — <span lang={language}>{solved}</span>
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="tp-actions cl-actions">
            <button type="button" className="tp-btn" onClick={advance} disabled={picked == null} data-testid="clinic-next">
              {tr.next}
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}
