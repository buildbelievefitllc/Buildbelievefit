// src/components/language/VocabFlashcard.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 3.2 — the SRS drill (LANGUAGE_MASTERY §2.2 Leitner). Self-contained: it
// consumes useVocabGym, walks the daily due queue, and drives the flip.
//
// Self-graded active recall (the schema stores the target-language `term`, not a
// translation): FRONT shows the term + its Leitner box; the athlete recalls the
// meaning, taps Flip, and self-grades Correct / Incorrect → bbf_review_vocab_term
// (box +1 / reset + reschedule). A Flag escalates the term (bbf_flag_vocab_term).
//
// LEITNER DIFFERENTIATION (the visual requirement): a 5-rung ladder makes Box 1
// (Learning · purple, near-empty) unmistakable from Box 5 (Mastered · gold, full).
// A priority-boosted card (an immersion miss or a manual flag) wears a gold
// Priority tag and shows its §4.4 error cluster.
//
// TRILINGUAL: every label resolves through useLangUiStr by preferred_locale.
//
// @param {{ language?: 'es'|'pt' }} props

import { useState } from 'react';
import { useVocabGym } from './useVocabGym.js';
import { useLangUiStr } from './languageStrings.js';
import './language.css';

// Purple (Learning) → Gold (Mastered) ramp across the five Leitner boxes.
const BOX_ACCENT = { 1: '#6a0dad', 2: '#8b3dc4', 3: '#b98a2e', 4: '#e6bd1f', 5: '#f5c800' };

function LeitnerLadder({ box, ariaLabel }) {
  return (
    <div className="lg-ladder" role="img" aria-label={ariaLabel}>
      {[1, 2, 3, 4, 5].map((rung) => {
        const filled = rung <= box;
        const active = rung === box;
        return (
          <span
            key={rung}
            className={`lg-rung${filled ? ' is-filled' : ''}${active ? ' is-active' : ''}`}
            style={filled ? { background: BOX_ACCENT[rung], borderColor: BOX_ACCENT[rung] } : undefined}
          />
        );
      })}
    </div>
  );
}

export default function VocabFlashcard({ language = 'es' }) {
  const { ls, clusters } = useLangUiStr();
  const { loading, error, queue, reviewTerm, flagTerm, reload } = useVocabGym(language);

  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [flaggedTerm, setFlaggedTerm] = useState(null);

  // The hook removes each reviewed term from the queue, so the active card is
  // always queue[0]. `done` drives the progress denominator (stable across a session).
  const card = queue[0] || null;
  const total = done + queue.length;

  async function grade(correct) {
    if (!card || busy) return;
    setBusy(true);
    await reviewTerm(card.term, correct); // removes queue[0] on success
    setBusy(false);
    setFlipped(false);
    setFlaggedTerm(null);
    setDone((d) => d + 1);
  }

  async function flag() {
    if (!card || busy || flaggedTerm === card.term) return;
    setBusy(true);
    const res = await flagTerm(card.term);
    setBusy(false);
    if (res && res.ok) setFlaggedTerm(card.term);
  }

  // ── states ──
  if (loading) {
    return <div className="lg-shell"><div className="lg-status">{ls.loadingQueue}</div></div>;
  }
  if (error && !card) {
    return (
      <div className="lg-shell">
        <div className="lg-status is-err">{ls.queueError}</div>
        <button type="button" className="lg-retry" onClick={reload}>{ls.retry}</button>
      </div>
    );
  }
  if (!card) {
    // Nothing left: distinguish "was empty on arrival" from "cleared this session".
    return (
      <div className="lg-shell">
        <div className="lg-done-mark" aria-hidden="true">✓</div>
        <div className="lg-status">{done > 0 ? ls.sessionDone : ls.emptyQueue}</div>
        {done > 0 ? <div className="lg-status-sub">{ls.sessionDoneSub}</div> : null}
        <button type="button" className="lg-retry" onClick={reload}>{ls.retry}</button>
      </div>
    );
  }

  const box = Math.min(5, Math.max(1, Number(card.box_level) || 1));
  const flagged = flaggedTerm === card.term;
  const boosted = flagged || (Number(card.priority_boost) || 0) > 0;
  const clusterLabel = card.error_cluster ? (clusters[card.error_cluster] || clusters.vocab_gap) : null;

  return (
    <div className="lg-shell" data-testid="vocab-flashcard">
      <div className={`lg-card${flipped ? ' is-flipped' : ''}`}>
        {/* key on term so each new card starts un-flipped */}
        <div className="lg-card-inner" key={card.term}>
          {/* ── FRONT — the term + its Leitner box ── */}
          <div className="lg-face lg-face--front">
            <div className="lg-card-top">
              <div className="lg-box-badge" style={{ borderColor: BOX_ACCENT[box] }}>
                <span className="lg-box-num" style={{ color: BOX_ACCENT[box] }}>{ls.boxLabel} {box}</span>
                <span className="lg-box-name">{ls.boxNames[box]}</span>
              </div>
              {boosted ? <span className="lg-priority-tag">{ls.priorityTag}</span> : null}
            </div>

            <LeitnerLadder box={box} ariaLabel={ls.leitnerAria(box)} />

            <div className="lg-term">{card.term}</div>

            {clusterLabel ? <div className="lg-cluster-tag" title={ls.injectedFrom}>{clusterLabel}</div> : null}

            <button type="button" className="lg-flip-btn" onClick={() => setFlipped(true)}>{ls.flip}</button>
            <span className="lg-flip-hint">{ls.tapToFlip}</span>
          </div>

          {/* ── BACK — self-grade the recall ── */}
          <div className="lg-face lg-face--back">
            <div className="lg-recall-term">{card.term}</div>
            <div className="lg-recall-prompt">{ls.recallPrompt}</div>

            <div className="lg-grade-row">
              <button type="button" className="lg-grade lg-grade--miss" disabled={busy} onClick={() => grade(false)}>{ls.incorrect}</button>
              <button type="button" className="lg-grade lg-grade--hit" disabled={busy} onClick={() => grade(true)}>{ls.correct}</button>
            </div>

            <button type="button" className={`lg-flag-btn${flagged ? ' is-flagged' : ''}`} disabled={busy || flagged} onClick={flag}>
              {flagged ? ls.flagged : `⚑ ${ls.flag}`}
            </button>

            <span className="lg-progress">{ls.progress(done + 1, total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
