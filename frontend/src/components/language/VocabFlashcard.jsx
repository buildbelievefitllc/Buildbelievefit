// src/components/language/VocabFlashcard.jsx
// ─────────────────────────────────────────────────────────────────────────────
// MODE 1 · VOCAB FORGE — the SRS media drill (LANGUAGE_MASTERY §2.2 Leitner +
// §Mastery Views). Self-contained: consumes useVocabGym, walks the daily due
// queue, and drives the flip.
//
// The Forge card: FRONT plays the term's pre-baked native clip (Zero-API — the
// button self-hides while the fragment is unbaked) and shows the Leitner box;
// the athlete recalls, may TYPE the term from recall (Gram-Standard guarded —
// a kilo/kg/lb lexeme trips the inline warning), flips, and grades the response
// on the 1–4 ladder (1 Again · 2 Hard · 3 Good · 4 Easy → SRS miss/hit via
// bbf_review_vocab_term). Completing the queue appends the session to
// bbf_language_session_history (module 'vocab_gym') — the Sentinel's ledger.
//
// LEITNER DIFFERENTIATION: the 5-rung purple→gold ladder; a boosted card wears
// the Priority tag and its §4.4 error cluster. TRILINGUAL throughout.
//
// @param {{ language?: 'es'|'pt' }} props

import { useState } from 'react';
import { useVocabGym } from './useVocabGym.js';
import { useLanguageLab } from './LanguageLabContext.jsx';
import { useNarrator } from './useNarrator.js';
import { useLangUiStr } from './languageStrings.js';
import { useLang } from '../../context/LangContext.jsx';
import { violatesGramStandard } from '../../lib/gramGuard.js';
import { logLanguageAttempt } from '../../lib/languageLabApi.js';
import './language.css';

// Purple (Learning) → Gold (Mastered) ramp across the five Leitner boxes.
const BOX_ACCENT = { 1: '#6a0dad', 2: '#8b3dc4', 3: '#b98a2e', 4: '#e6bd1f', 5: '#f5c800' };

// ── Forge chrome (self-contained trilingual, house SovereignBriefingCard style) ──
const FORGE_STR = {
  en: { clip: '🔊 Native clip', typed: 'Type it from recall (optional)…', gram: 'Gram Standard: mass is written in grams — the {load_g} integer form, never kilo/kg/lb.', g1: '1 · Again', g2: '2 · Hard', g3: '3 · Good', g4: '4 · Easy' },
  es: { clip: '🔊 Clip nativo', typed: 'Escríbelo de memoria (opcional)…', gram: 'Estándar de Gramos: la masa se escribe en gramos — la forma entera {load_g}, nunca kilo/kg/lb.', g1: '1 · Otra vez', g2: '2 · Difícil', g3: '3 · Bien', g4: '4 · Fácil' },
  pt: { clip: '🔊 Clipe nativo', typed: 'Digite de memória (opcional)…', gram: 'Padrão de Gramas: a massa é escrita em gramas — a forma inteira {load_g}, nunca quilo/kg/lb.', g1: '1 · De novo', g2: '2 · Difícil', g3: '3 · Bom', g4: '4 · Fácil' },
};

// Fragment key for a term's pre-baked pronunciation clip (VOC-<slug>).
// Exported: The Path's vocab chips + the Skill Funnel drills narrate through the
// SAME VOC clip keys, so a term baked for the Vocab Gym plays its exact native
// clip everywhere.
// eslint-disable-next-line react-refresh/only-export-components
export function termClipKey(term) {
  const slug = String(term || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim().replace(/\s+/g, '-');
  return `VOC-${slug}`;
}

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
  const { lang } = useLang();
  const fstr = FORGE_STR[lang] || FORGE_STR.en;
  const { loading, error, queue, reviewTerm, flagTerm, reload } = useVocabGym(language);
  const { logModuleProgress } = useLanguageLab(); // Guided Track dose counter (inert off-provider)

  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [hits, setHits] = useState(0);
  const [flaggedTerm, setFlaggedTerm] = useState(null);
  const [typed, setTyped] = useState('');
  const [clipDead, setClipDead] = useState(false); // Akeem chain fully failed → hide the button
  const { narrate } = useNarrator();               // routes 🔊 through the global engine toggle

  // The hook removes each reviewed term from the queue, so the active card is
  // always queue[0]. `done` drives the progress denominator (stable across a session).
  const card = queue[0] || null;
  const total = done + queue.length;
  const gramViolation = violatesGramStandard(typed);

  // 1–4 self-grade (Again/Hard/Good/Easy): 1-2 → SRS miss, 3-4 → SRS hit.
  async function grade4(n) {
    if (!card || busy) return;
    const correct = n >= 3;
    const isLast = queue.length === 1;
    setBusy(true);
    await reviewTerm(card.term, correct); // removes queue[0] on success
    setBusy(false);
    setFlipped(false);
    setFlaggedTerm(null);
    setTyped('');
    setClipDead(false);
    const nextHits = hits + (correct ? 1 : 0);
    setHits(nextHits);
    setDone((d) => d + 1);
    logModuleProgress('vocab', 1); // every graded card advances the daily dose
    if (isLast) {
      // Queue cleared — append the Forge session to the closed-loop ledger.
      logLanguageAttempt({ language, module: 'vocab_gym', itemsTotal: done + 1, itemsCorrect: nextHits });
    }
  }

  async function flag() {
    if (!card || busy || flaggedTerm === card.term) return;
    setBusy(true);
    const res = await flagTerm(card.term);
    setBusy(false);
    if (res && res.ok) setFlaggedTerm(card.term);
  }

  // Routed through the global SYSTEM NARRATION ENGINE toggle (useNarrator):
  //   Coach Akeem → the term's pre-baked native VOC clip (its exact clipKey);
  //   Natural     → the term spoken by the premium Web Speech voice.
  // Both paths carry their own fallback floor, so the 🔊 is never dead — the
  // old "unbaked fragment hides the button" behavior only trips if Akeem's whole
  // chain fails, never in Natural mode.
  function playClip() {
    if (!card) return;
    narrate({
      text: card.term,
      lang: language,
      clipKey: termClipKey(card.term),
      onError: () => setClipDead(true),
    });
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
          {/* ── FRONT — the media card: native clip + term + Leitner box ── */}
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

            {!clipDead ? (
              <button type="button" className="lg-clip-btn" onClick={playClip} data-testid="forge-clip">
                {fstr.clip}
              </button>
            ) : null}

            {clusterLabel ? <div className="lg-cluster-tag" title={ls.injectedFrom}>{clusterLabel}</div> : null}

            <button type="button" className="lg-flip-btn" onClick={() => setFlipped(true)}>{ls.flip}</button>
            <span className="lg-flip-hint">{ls.tapToFlip}</span>
          </div>

          {/* ── BACK — typed recall (Gram-guarded) + the 1–4 grade ladder ── */}
          <div className="lg-face lg-face--back">
            <div className="lg-recall-term">{card.term}</div>
            <div className="lg-recall-prompt">{ls.recallPrompt}</div>

            <input
              type="text"
              className={`lg-typed${gramViolation ? ' is-gram-bad' : ''}`}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={fstr.typed}
              data-testid="forge-input"
            />
            {gramViolation ? (
              <div className="lg-gram-warning" role="alert" data-testid="gram-violation">{fstr.gram}</div>
            ) : null}

            <div className="lg-grade-row lg-grade-row--forge">
              <button type="button" className="lg-grade lg-grade--miss" disabled={busy} onClick={() => grade4(1)} data-testid="forge-grade-1">{fstr.g1}</button>
              <button type="button" className="lg-grade lg-grade--miss" disabled={busy} onClick={() => grade4(2)}>{fstr.g2}</button>
              <button type="button" className="lg-grade lg-grade--hit" disabled={busy} onClick={() => grade4(3)}>{fstr.g3}</button>
              <button type="button" className="lg-grade lg-grade--hit" disabled={busy} onClick={() => grade4(4)} data-testid="forge-grade-4">{fstr.g4}</button>
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
