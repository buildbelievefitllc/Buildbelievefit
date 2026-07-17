// src/components/command/AnatomyArena.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Coach Lab · Kinesiology Lab — THE ANATOMY ARENA (game #3).
//
// "Find the <muscle> on the body." A round of 8 prompts; each names a muscle and
// the player must locate + TAP it on the front/back mannequin. Knowing which SIDE
// a muscle lives on is part of the skill, so the front↔back toggle is the player's
// to work — on reveal we snap to the correct side and light the region so a miss
// still teaches. Every answer bumps the SAME 1-5 SRS box the text decks use
// (shared muscle ids), so locating the biceps reinforces "biceps → elbow flexion".
//
// Self-contained: mounts already "playing" (the select card is the start button),
// runs to a results card, and hands control back via onExit — which lets the Lab
// re-read the mastery store so the bar reflects freshly banked reps.

import { useCallback, useEffect, useRef, useState } from 'react';
import { ANATOMY_MUSCLES } from './anatomyData.js';
import { bumpSrs } from './kinesiologyData.js';
import AnatomyBody from './AnatomyBody.jsx';

const ROUND = 8;          // prompts per arena run
const DURATION = 20;      // seconds per prompt (locating takes longer than recall)

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildRound() {
  return shuffle(ANATOMY_MUSCLES).slice(0, Math.min(ROUND, ANATOMY_MUSCLES.length));
}

export default function AnatomyArena({ L, onExit }) {
  const [questions, setQuestions] = useState(() => buildRound());
  const [idx, setIdx] = useState(0);
  const [view, setView] = useState('front');
  const [reveal, setReveal] = useState(null);   // { pickedId, correctId } | null
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [phase, setPhase] = useState('playing'); // playing | results
  const timerRef = useRef(null);

  const current = questions[idx] || null;
  const shown = ANATOMY_MUSCLES.filter((m) => m.view === view);

  const doReveal = useCallback((pickedId) => {
    if (reveal || !current) return;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    const correct = pickedId === current.id;
    if (correct) { setScore((s) => s + 1); setStreak((s) => s + 1); }
    else { setStreak(0); }
    bumpSrs(current.id, correct);
    setView(current.view);                       // snap to the correct side to teach
    setReveal({ pickedId, correctId: current.id });
  }, [reveal, current]);

  // Per-prompt countdown — timeout scores as a miss. timeLeft resets on advance,
  // so the effect only owns the interval (no synchronous setState in its body).
  useEffect(() => {
    if (phase !== 'playing' || reveal) return undefined;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 0.1) {
          clearInterval(timerRef.current); timerRef.current = null;
          doReveal(null);
          return 0;
        }
        return Math.round((t - 0.1) * 10) / 10;
      });
    }, 100);
    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  }, [phase, idx, reveal, doReveal]);

  const next = () => {
    if (idx + 1 >= questions.length) { setPhase('results'); return; }
    setIdx((i) => i + 1); setReveal(null); setTimeLeft(DURATION);
  };

  const again = () => {
    setQuestions(buildRound());
    setIdx(0); setReveal(null); setView('front');
    setScore(0); setStreak(0); setTimeLeft(DURATION);
    setPhase('playing');
  };

  // ── Results ──
  if (phase === 'results') {
    const pct = questions.length ? Math.round((score / questions.length) * 100) : 0;
    return (
      <div className="kl-anat" data-testid="kl-anat-results">
        <div className="kl-results">
          <div className="kl-results-ring" style={{ '--pct': pct }}>
            <span className="kl-results-pct">{pct}%</span>
          </div>
          <h3 className="kl-results-title">{L.resultsTitle}</h3>
          <div className="kl-results-stats">
            <div><span className="kl-rs-num">{score}/{questions.length}</span><span className="kl-rs-lbl">{L.score}</span></div>
            <div><span className="kl-rs-num">{pct}%</span><span className="kl-rs-lbl">{L.accuracy}</span></div>
          </div>
          <div className="kl-results-actions">
            <button type="button" className="kl-btn kl-btn--gold" onClick={again} data-testid="kl-anat-again">{L.playAgain}</button>
            <button type="button" className="kl-btn" onClick={onExit}>{L.switchMode}</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Playing ──
  const revealCorrect = reveal && reveal.pickedId === reveal.correctId;
  return (
    <div className="kl-anat" data-testid="kl-anat-playing" data-target={current.id} data-target-view={current.view}>
      <div className="kl-hud">
        <span className="kl-hud-q">{L.round} {idx + 1} <span className="kl-hud-of">{L.of} {questions.length}</span></span>
        <span className="kl-hud-cat">{L.modeAnatomy}</span>
        <span className="kl-hud-score">{L.score} {score} · {L.streak} {streak}🔥</span>
      </div>
      <div className="kl-timer"><span className="kl-timer-fill" style={{ width: `${(timeLeft / DURATION) * 100}%` }} /></div>

      <h3 className="kl-anat-prompt" data-testid="kl-anat-prompt">
        <span className="kl-anat-find">{L.findThe}</span>
        <span className="kl-anat-target">{current.name}</span>
      </h3>

      <div className="kl-anat-views" role="tablist" aria-label="Body side">
        {['front', 'back'].map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            className={`kl-anat-view${view === v ? ' is-active' : ''}`}
            onClick={() => { if (!reveal) setView(v); }}
            disabled={!!reveal}
            data-testid={`kl-anat-view-${v}`}
          >
            {v === 'front' ? L.front : L.back}
          </button>
        ))}
      </div>

      <div className="kl-anat-stage">
        <AnatomyBody
          view={view}
          muscles={shown}
          onPick={doReveal}
          disabled={!!reveal}
          reveal={reveal}
        />
        {!reveal ? <p className="kl-anat-hint">{L.tapHint}</p> : null}
      </div>

      {reveal ? (
        <div className={`kl-reveal${revealCorrect ? ' is-correct' : ' is-wrong'}`} data-testid="kl-anat-reveal">
          <div className="kl-reveal-head">
            {reveal.pickedId === null ? L.timeUp : revealCorrect ? `✓ ${L.correct}` : `✕ ${L.incorrect}`}
          </div>
          {!revealCorrect ? (
            <div className="kl-reveal-ans">{L.missedIt}: <strong>{current.name}</strong></div>
          ) : null}
          <p className="kl-reveal-why"><span className="kl-anat-actlbl">{L.anatomyAction}:</span> {current.action}. {current.why}</p>
          <button type="button" className="kl-btn kl-btn--gold kl-next" onClick={next} data-testid="kl-anat-next">{L.next}</button>
        </div>
      ) : null}
    </div>
  );
}
