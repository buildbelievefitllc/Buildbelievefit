// src/components/command/AnatomyArena.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Coach Lab · Kinesiology Lab — THE ANATOMY ARENA (Exploded Regional Zoom).
//
// TIER 1 — TRAINING SPLIT GATE: the player first picks a lane (PUSH · PULL ·
//          LEGS). Choosing a lane hides every muscle outside it, clearing the
//          screen so only the relevant region remains.
// TIER 2 — REGIONAL ZOOM: the chosen lane loads its own zoomed vector canvas
//          (AnatomyBody) where every muscle is a distinct, non-overlapping path.
// TIER 3 — SCORING LOOP: "Locate the <muscle>" ×5 in a row, curriculum-grade
//          (heads: Rectus Femoris, Sternal Head, Lateral Head of Triceps …).
//          Each answer bumps the shared 1-5 SRS box; a miss reveals the answer
//          in BBF Gold with an on-body label so it still teaches.
//
// Self-contained: mounts at the gate, runs a lane, and hands back via onExit —
// which lets the Lab re-read the mastery store so the bar reflects fresh reps.

import { useCallback, useEffect, useRef, useState } from 'react';
import { TRAINING_SPLITS, SPLIT_ORDER, ANATOMY_IMAGE_URLS } from './anatomyData.js';
import { bumpSrs } from './kinesiologyData.js';
import { narrate, stopSpeaking, narrationSupported } from '../../lib/speech.js';
import AnatomyBody from './AnatomyBody.jsx';

const ROUND = 5;          // locate 5 muscles in a row
const DURATION = 20;      // seconds per prompt (locating takes longer than recall)
const VOICE_KEY = 'bbf.coachlab.voice';

// Spoken lines — English content (the founder's curriculum language). Correct →
// name it + say its action; a miss/timeout → name the right muscle + why (the
// reason it matters). This is the audio layer of the see→tap→hear loop.
function feedbackLine(m, pickedId, correct) {
  if (!m) return '';
  if (pickedId === null) return `Time's up. This one is the ${m.name}. ${m.why}`;
  return correct
    ? `Correct. The ${m.name}. ${m.action}.`
    : `Not quite. This one is the ${m.name}. ${m.why}`;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildRound(laneId) {
  const pool = TRAINING_SPLITS[laneId]?.muscles || [];
  return shuffle(pool).slice(0, Math.min(ROUND, pool.length));
}

export default function AnatomyArena({ L, onExit }) {
  const [phase, setPhase] = useState('gate');    // gate | playing | results
  const [laneId, setLaneId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [idx, setIdx] = useState(0);
  const [reveal, setReveal] = useState(null);    // { pickedId, correctId } | null
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [voiceOn, setVoiceOn] = useState(() => {
    try { return localStorage.getItem(VOICE_KEY) !== '0'; } catch { return true; }
  });
  const timerRef = useRef(null);
  const canVoice = narrationSupported();

  const lane = laneId ? TRAINING_SPLITS[laneId] : null;
  const current = questions[idx] || null;

  const toggleVoice = () => {
    setVoiceOn((on) => {
      const next = !on;
      try { localStorage.setItem(VOICE_KEY, next ? '1' : '0'); } catch { /* storage blocked */ }
      if (!next) stopSpeaking();
      return next;
    });
  };

  const startLane = (id) => {
    setLaneId(id);
    setQuestions(buildRound(id));
    setIdx(0); setReveal(null); setScore(0); setStreak(0); setTimeLeft(DURATION);
    setPhase('playing');
  };

  const doReveal = useCallback((pickedId) => {
    if (reveal || !current) return;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    const correct = pickedId === current.id;
    if (correct) { setScore((s) => s + 1); setStreak((s) => s + 1); }
    else { setStreak(0); }
    bumpSrs(current.id, correct);
    setReveal({ pickedId, correctId: current.id });
    if (voiceOn) narrate(feedbackLine(current, pickedId, correct));   // hear the verdict + why
  }, [reveal, current, voiceOn]);

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

  // Speak the prompt when a new muscle is asked (hear the target before locating).
  // Keyed on the question, not `reveal`, so it fires once per prompt — not again
  // on the answer beat.
  useEffect(() => {
    if (phase !== 'playing' || reveal || !voiceOn) return;
    const q = questions[idx];
    if (q) narrate(`Locate the ${q.name}.`);
  }, [phase, idx, laneId, voiceOn, questions, reveal]);

  // Silence any in-flight narration when the arena unmounts.
  useEffect(() => () => stopSpeaking(), []);

  // Warm the browser cache for the realistic lane maps while the player is still
  // on the gate, so picking a lane shows the high-fidelity image with no stutter.
  // No-op until assets are dropped into the anatomy-assets bucket (URLs empty).
  useEffect(() => {
    if (phase !== 'gate' || !ANATOMY_IMAGE_URLS.length) return;
    ANATOMY_IMAGE_URLS.forEach((url) => {
      const img = new Image();
      img.src = url;
      if (img.decode) img.decode().catch(() => { /* prefetch only */ });
    });
  }, [phase]);

  const next = () => {
    if (idx + 1 >= questions.length) { setPhase('results'); return; }
    setIdx((i) => i + 1); setReveal(null); setTimeLeft(DURATION);
  };

  const toGate = () => { setPhase('gate'); setLaneId(null); setQuestions([]); };

  // ── Tier 1 · Training-split gate ──
  if (phase === 'gate') {
    return (
      <div className="kl-anat" data-testid="kl-anat-gate">
        <p className="kl-anat-gate-lead">{L.gateLead}</p>
        <div className="kl-anat-lanes">
          {SPLIT_ORDER.map((id) => (
            <button
              key={id}
              type="button"
              className={`kl-anat-lane kl-anat-lane--${id}`}
              onClick={() => startLane(id)}
              data-testid={`kl-lane-${id}`}
            >
              <span className="kl-anat-lane-name">{L[`lane_${id}`]}</span>
              <span className="kl-anat-lane-sub">{L[`lane_${id}_sub`]}</span>
              <span className="kl-anat-lane-go">{L.start} →</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

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
            <div><span className="kl-rs-num">{L[`lane_${laneId}`]}</span><span className="kl-rs-lbl">{L.laneLabel}</span></div>
          </div>
          <div className="kl-results-actions">
            <button type="button" className="kl-btn kl-btn--gold" onClick={() => startLane(laneId)} data-testid="kl-anat-again">{L.playAgain}</button>
            <button type="button" className="kl-btn" onClick={toGate} data-testid="kl-anat-changesplit">{L.changeSplit}</button>
            <button type="button" className="kl-btn" onClick={onExit}>{L.switchMode}</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Tier 2 + 3 · Regional zoom + locate loop ──
  const revealCorrect = reveal && reveal.pickedId === reveal.correctId;
  return (
    <div className="kl-anat" data-testid="kl-anat-playing" data-lane={laneId} data-target={current.id}>
      <div className="kl-hud">
        <span className="kl-hud-q">{L.round} {idx + 1} <span className="kl-hud-of">{L.of} {questions.length}</span></span>
        <span className="kl-hud-cat">{L[`lane_${laneId}`]}</span>
        <span className="kl-hud-score">{L.score} {score} · {L.streak} {streak}🔥</span>
      </div>
      <div className="kl-timer"><span className="kl-timer-fill" style={{ width: `${(timeLeft / DURATION) * 100}%` }} /></div>

      <div className="kl-anat-prompt-row">
        <h3 className="kl-anat-prompt" data-testid="kl-anat-prompt">
          <span className="kl-anat-find">{L.findThe}</span>
          <span className="kl-anat-target">{current.name}</span>
        </h3>
        {canVoice ? (
          <button
            type="button"
            className={`kl-anat-voice${voiceOn ? ' is-on' : ''}`}
            onClick={toggleVoice}
            aria-pressed={voiceOn}
            aria-label={L.narration}
            title={L.narration}
            data-testid="kl-anat-voice"
          >
            {voiceOn ? '🔊' : '🔇'}
          </button>
        ) : null}
      </div>

      <div className="kl-anat-stage">
        <AnatomyBody lane={lane} onPick={doReveal} disabled={!!reveal} reveal={reveal} />
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
          <div className="kl-anat-reveal-actions">
            <button type="button" className="kl-btn kl-btn--gold kl-next" onClick={next} data-testid="kl-anat-next">{L.next}</button>
            {canVoice ? (
              <button
                type="button"
                className="kl-btn kl-anat-replay"
                onClick={() => narrate(feedbackLine(current, reveal.pickedId, revealCorrect))}
                aria-label={L.replay}
                title={L.replay}
                data-testid="kl-anat-replay"
              >🔊 {L.replay}</button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
