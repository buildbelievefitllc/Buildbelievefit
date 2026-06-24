// src/components/command/KinesiologyLab.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Coach Lab · Pillar 2 — The Kinesiology Lab (gamified spaced repetition).
//
// Pick a deck (Match Madness · muscle↔action, or Speed Review · rapid true/false),
// run a timed drill, and bank mastery. Each answer bumps that concept's 1-5
// spaced-repetition box (localStorage): correct → box+1, wrong → reset to 1.
// Pure client-side — no backend. Founder-only (the /command route gates it).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import { KINESIO_DECKS, KINESIO_L10N, bumpSrs, readSrs, TOTAL_CONCEPTS } from './kinesiologyData.js';

const ROUND = 8;          // questions per drill
const DURATION = 15;      // seconds per question
const MASTERED_BOX = 4;   // box ≥ this counts as "mastered"

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function KinesiologyLab() {
  const { lang } = useLang();
  const L = KINESIO_L10N[lang] || KINESIO_L10N.en;

  const [phase, setPhase] = useState('select'); // select | playing | results
  const [mode, setMode] = useState('match');     // match | truefalse
  const [questions, setQuestions] = useState([]);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [srs, setSrs] = useState(() => readSrs());
  const timerRef = useRef(null);

  const masteredCount = useMemo(
    () => Object.values(srs).filter((b) => Number(b) >= MASTERED_BOX).length,
    [srs],
  );

  const begin = (m) => {
    const deck = KINESIO_DECKS[m] || KINESIO_DECKS.match;
    const picked = shuffle(deck).slice(0, Math.min(ROUND, deck.length)).map((q) => ({
      ...q,
      shown: m === 'match' ? shuffle(q.options) : ['__true__', '__false__'],
    }));
    setMode(m);
    setQuestions(picked);
    setIdx(0); setSelected(null); setRevealed(false);
    setScore(0); setStreak(0); setTimeLeft(DURATION);
    setPhase('playing');
  };

  const current = questions[idx] || null;

  const reveal = useCallback((choice) => {
    if (revealed || !current) return;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    const isCorrect = mode === 'match'
      ? choice === current.answer
      : (choice === '__true__') === current.answer;
    setSelected(choice);
    setRevealed(true);
    if (isCorrect) { setScore((s) => s + 1); setStreak((s) => s + 1); }
    else { setStreak(0); }
    setSrs(bumpSrs(current.id, isCorrect));
  }, [revealed, current, mode]);

  // Per-question countdown — timeout reveals as a miss. timeLeft is reset on
  // question-advance (begin/next), so the effect only owns the interval (no
  // synchronous setState in the effect body).
  useEffect(() => {
    if (phase !== 'playing' || revealed) return undefined;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 0.1) {
          clearInterval(timerRef.current); timerRef.current = null;
          reveal('__timeout__');
          return 0;
        }
        return Math.round((t - 0.1) * 10) / 10;
      });
    }, 100);
    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  }, [phase, idx, revealed, reveal]);

  const next = () => {
    if (idx + 1 >= questions.length) { setPhase('results'); return; }
    setIdx((i) => i + 1); setSelected(null); setRevealed(false); setTimeLeft(DURATION);
  };

  // ── Mode select ──
  if (phase === 'select') {
    return (
      <div className="kl" data-testid="kinesiology-lab">
        <p className="kl-intro">{L.intro}</p>
        <div className="kl-mastery">
          <span className="kl-mastery-lbl">{L.masteryLabel}</span>
          <div className="kl-mastery-bar"><span style={{ width: `${(masteredCount / TOTAL_CONCEPTS) * 100}%` }} /></div>
          <span className="kl-mastery-num">{masteredCount}/{TOTAL_CONCEPTS}</span>
        </div>
        <div className="kl-modes">
          <button type="button" className="kl-mode" onClick={() => begin('match')} data-testid="kl-mode-match">
            <span className="kl-mode-ic" aria-hidden="true">⮂</span>
            <span className="kl-mode-name">{L.modeMatch}</span>
            <span className="kl-mode-sub">{L.modeMatchSub}</span>
            <span className="kl-mode-go">{L.start} →</span>
          </button>
          <button type="button" className="kl-mode" onClick={() => begin('truefalse')} data-testid="kl-mode-speed">
            <span className="kl-mode-ic" aria-hidden="true">⚡</span>
            <span className="kl-mode-name">{L.modeSpeed}</span>
            <span className="kl-mode-sub">{L.modeSpeedSub}</span>
            <span className="kl-mode-go">{L.start} →</span>
          </button>
        </div>
      </div>
    );
  }

  // ── Results ──
  if (phase === 'results') {
    const pct = questions.length ? Math.round((score / questions.length) * 100) : 0;
    return (
      <div className="kl" data-testid="kl-results">
        <div className="kl-results">
          <div className="kl-results-ring" style={{ '--pct': pct }}>
            <span className="kl-results-pct">{pct}%</span>
          </div>
          <h3 className="kl-results-title">{L.resultsTitle}</h3>
          <div className="kl-results-stats">
            <div><span className="kl-rs-num">{score}/{questions.length}</span><span className="kl-rs-lbl">{L.score}</span></div>
            <div><span className="kl-rs-num">{pct}%</span><span className="kl-rs-lbl">{L.accuracy}</span></div>
            <div><span className="kl-rs-num">{masteredCount}/{TOTAL_CONCEPTS}</span><span className="kl-rs-lbl">{L.mastered}</span></div>
          </div>
          <div className="kl-results-actions">
            <button type="button" className="kl-btn kl-btn--gold" onClick={() => begin(mode)} data-testid="kl-again">{L.playAgain}</button>
            <button type="button" className="kl-btn" onClick={() => setPhase('select')}>{L.switchMode}</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Playing ──
  const correctChoice = mode === 'match' ? current.answer : (current.answer ? '__true__' : '__false__');
  const isRight = (c) => (mode === 'match' ? c === current.answer : (c === '__true__') === current.answer);
  return (
    <div className="kl" data-testid="kl-playing">
      <div className="kl-hud">
        <span className="kl-hud-q">{L.round} {idx + 1} <span className="kl-hud-of">{L.of} {questions.length}</span></span>
        <span className="kl-hud-cat">{current.category}</span>
        <span className="kl-hud-score">{L.score} {score} · {L.streak} {streak}🔥</span>
      </div>
      <div className="kl-timer"><span className="kl-timer-fill" style={{ width: `${(timeLeft / DURATION) * 100}%` }} /></div>

      <h3 className="kl-prompt" data-testid="kl-prompt">{mode === 'match' ? current.q : current.statement}</h3>

      <div className={`kl-options${mode === 'truefalse' ? ' kl-options--tf' : ''}`}>
        {current.shown.map((opt) => {
          const label = opt === '__true__' ? L.truth : opt === '__false__' ? L.falseh : opt;
          let cls = 'kl-opt';
          if (revealed) {
            if (opt === correctChoice) cls += ' is-correct';
            else if (opt === selected) cls += ' is-wrong';
            else cls += ' is-dim';
          }
          return (
            <button
              key={opt}
              type="button"
              className={cls}
              disabled={revealed}
              onClick={() => reveal(opt)}
              data-testid={`kl-opt${isRight(opt) ? '-correct' : ''}`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {revealed ? (
        <div className={`kl-reveal${isRight(selected) ? ' is-correct' : ' is-wrong'}`} data-testid="kl-reveal">
          <div className="kl-reveal-head">
            {selected === '__timeout__' ? L.timeUp : isRight(selected) ? `✓ ${L.correct}` : `✕ ${L.incorrect}`}
          </div>
          {!isRight(selected) ? (
            <div className="kl-reveal-ans">{L.answerWas}: <strong>{mode === 'match' ? current.answer : (current.answer ? L.truth : L.falseh)}</strong></div>
          ) : null}
          <p className="kl-reveal-why">{current.why}</p>
          <button type="button" className="kl-btn kl-btn--gold kl-next" onClick={next} data-testid="kl-next">{L.next}</button>
        </div>
      ) : null}
    </div>
  );
}
