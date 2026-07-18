// src/components/language/phaseDrills.jsx
// ─────────────────────────────────────────────────────────────────────────────
// THE 5-PHASE SKILL FUNNEL — the drills mounted inside a Curriculum Atlas
// category. Each drill is self-contained, consumes the category's trilingual
// item bank (languageLabCategories.json), and routes EVERY 🔊 through the Lab's
// unified narrator (useNarrator) — so Coach Akeem's ElevenLabs clone (its voice
// ID lives server-side, never in this bundle) speaks the native target text,
// with the built-in synth→browser fallback floor. SLOW-MO is the same narrate()
// call at rate 0.55.
//
//   📇 Vocabulary — flashcard identification (glyph + term, flip to the gloss)
//   🔊 Listening  — play the native audio, pick the matching card
//   👁️ Reading    — read the target term, pick its meaning (gloss)
//   🧠 Memory     — spatial card-flip pair match (term ↔ glyph, id-keyed)
//   📝 Writing    — active spelling: type the target term from the prompt
//
// TRILINGUAL chrome throughout (UI locale en/es/pt); the TARGET term (es/pt) is
// data, never localized away. No render-time randomness — every shuffle is a
// deterministic seeded permutation (house rule, mirrors ThePath's scramble).

import { useMemo, useRef, useState } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import { useNarrator } from './useNarrator.js';
import { termClipKey } from './VocabFlashcard.jsx';
import { logLanguageAttempt } from '../../lib/languageLabApi.js';
import { FX_STR } from './funnelStrings.js';
import './language.css';

function useFx() {
  const { lang } = useLang();
  return { lang, str: FX_STR[lang] || FX_STR.en };
}

// The prompt gloss shown to the learner: the UI-locale value, unless the UI
// locale IS the target (which would reveal the answer) — then fall back to en.
const glossOf = (item, uiLang, target) =>
  (uiLang !== target && item[uiLang]) ? item[uiLang] : item.en;

const norm = (s) =>
  String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim().replace(/\s+/g, ' ');

// Deterministic Fisher-Yates over a fixed seed — stable per render, varied per
// item index. No Math.random (would reshuffle every render + is banned in this
// build's data path).
function seededOrder(n, seed) {
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = (seed * (i + 1) * 31 + 7) % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// N option indices (the correct one + deterministic distractors), then shuffled.
function buildOptions(count, total, correctIdx, seed) {
  const others = Array.from({ length: total }, (_, i) => i).filter((i) => i !== correctIdx);
  const picks = seededOrder(others.length, seed).slice(0, Math.max(0, count - 1)).map((k) => others[k]);
  const pool = [correctIdx, ...picks];
  return seededOrder(pool.length, seed + 1).map((k) => pool[k]);
}

// ── the two narration buttons every audio surface reuses ─────────────────────
function ListenButtons({ term, lang, str, testid }) {
  const { narrate } = useNarrator();
  const clipKey = termClipKey(term);
  return (
    <div className="fx-listen">
      <button type="button" className="fx-listen-btn" onClick={() => narrate({ text: term, lang, clipKey })} data-testid={testid ? `${testid}-listen` : undefined}>
        {str.listen}
      </button>
      <button type="button" className="fx-listen-btn fx-listen-btn--slow" onClick={() => narrate({ text: term, lang, clipKey, rate: 0.55 })} data-testid={testid ? `${testid}-slow` : undefined}>
        {str.slow}
      </button>
    </div>
  );
}

// ── SPEECH CAPTURE FOUNDATION — a lightweight native Web Speech API probe.
// Not a scorer yet: it captures one utterance and surfaces a baseline readout
// (transcript · engine confidence · a rough chars/sec cadence) to the UI and the
// console, establishing the vocal-capture foundation the pronunciation scorer
// will build on. Degrades to a quiet "unavailable" note where the API is absent
// (most desktop Firefox, some in-app webviews) so the surface is never dead.
function SpeechProbe({ language, str }) {
  const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
  const [state, setState] = useState('idle'); // idle | listening | done | error
  const [readout, setReadout] = useState(null);
  const recRef = useRef(null);
  const bcp47 = language === 'pt' ? 'pt-BR' : 'es-ES';

  const start = () => {
    if (!SR || state === 'listening') return;
    let rec;
    try { rec = new SR(); } catch { setState('error'); return; }
    rec.lang = bcp47;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;
    const t0 = Date.now();
    rec.onresult = (e) => {
      const alt = e.results[0][0];
      const transcript = (alt.transcript || '').trim();
      const confidence = Math.round((alt.confidence || 0) * 100);
      const secs = Math.max(0.4, (Date.now() - t0) / 1000);
      // Baseline cadence: spoken characters per second (a stand-in for the
      // syllable-rate metric the full scorer will compute).
      const cadence = Math.round((transcript.replace(/\s+/g, '').length / secs) * 10) / 10;
      const data = { transcript, confidence, cadence };
      setReadout(data);
      setState('done');
      console.log('[Atlas Speech Probe]', JSON.stringify(data));
    };
    rec.onerror = () => setState('error');
    rec.onend = () => setState((s) => (s === 'listening' ? 'idle' : s));
    recRef.current = rec;
    setReadout(null);
    setState('listening');
    try { rec.start(); } catch { setState('error'); }
  };

  if (!SR) {
    return <div className="fx-speech"><span className="fx-speech-note">{str.speechUnsupported}</span></div>;
  }
  return (
    <div className="fx-speech">
      <button type="button" className="fx-speech-btn" onClick={start} disabled={state === 'listening'} data-testid="fx-speech">
        {state === 'listening' ? str.speechListening : str.speak}
      </button>
      {readout ? (
        <span className="fx-speech-readout" data-testid="fx-speech-readout">
          🎙 “{readout.transcript || '—'}” · {readout.confidence}% {str.confidence} · {readout.cadence} {str.cadence}
        </span>
      ) : null}
      {state === 'error' ? <span className="fx-speech-note">{str.speechError}</span> : null}
    </div>
  );
}

function PhaseHeader({ category, phaseKey, str, onExit }) {
  const { lang } = useLang();
  return (
    <div className="fx-head">
      <button type="button" className="fx-back" onClick={onExit}>{str.exit}</button>
      <span className="fx-head-cat" style={{ color: category.accent }}>{category.icon} {category.titles[lang] || category.titles.en}</span>
      <span className="fx-head-phase">{str.phase[phaseKey]}</span>
    </div>
  );
}

function PhaseDone({ str, correct, total, onReplay, onExit, children }) {
  return (
    <div className="fx-done" data-testid="fx-done">
      <div className="fx-done-mark" aria-hidden="true">✓</div>
      <h4 className="fx-done-title">{str.done}</h4>
      {typeof correct === 'number' ? <p className="fx-done-score">{str.score(correct, total)}</p> : null}
      {children}
      <div className="fx-done-actions">
        <button type="button" className="fx-btn fx-btn--ghost" onClick={onReplay}>{str.replay}</button>
        <button type="button" className="fx-btn" onClick={onExit}>{str.exit}</button>
      </div>
    </div>
  );
}

// Append a completed phase run to the closed-loop ledger (non-throwing; no
// session → resolved no-op, exactly like every other module).
function logPhase(category, language, module, total, correct) {
  logLanguageAttempt({ language, module: `atlas_${module}`, itemsTotal: total, itemsCorrect: correct });
}

// ── PHASE 1 · 📇 VOCABULARY — flashcard identification ───────────────────────
// BLIND AUDITORY MODE (🙈): when on, the glyph + target term are withheld on
// arrival — the card leads with the 🔊 audio, and the athlete must recall from
// sound alone, then TAP the card to reveal the text/glyph as validation. The
// mode can be seeded from the funnel (blindMode prop) and toggled in-card.
export function VocabularyDrill({ category, items, language, onExit, blindMode = false }) {
  const { lang, str } = useFx();
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [finished, setFinished] = useState(false);
  const [blind, setBlind] = useState(!!blindMode);
  const [revealed, setRevealed] = useState(!blindMode); // in blind mode the card starts concealed
  const item = items[i];

  const next = () => {
    if (i + 1 >= items.length) {
      setFinished(true);
      logPhase(category, language, 'vocab', items.length, items.length);
      return;
    }
    setI(i + 1); setFlipped(false); setRevealed(!blind);
  };
  const replay = () => { setI(0); setFlipped(false); setFinished(false); setRevealed(!blind); };

  // Toggling blind mode re-conceals (on) or fully reveals (off) the active card.
  const toggleBlind = () => setBlind((b) => { const nb = !b; setRevealed(!nb); return nb; });
  const concealed = blind && !revealed;

  return (
    <section className="fx-shell" data-testid="fx-vocab">
      <PhaseHeader category={category} phaseKey="vocabulary" str={str} onExit={onExit} />
      {finished ? (
        <PhaseDone str={str} onReplay={replay} onExit={onExit} />
      ) : (
        <>
          <button
            type="button"
            className={`fx-blind-chip${blind ? ' is-on' : ''}`}
            aria-pressed={blind}
            onClick={toggleBlind}
            data-testid="fx-vocab-blind"
          >
            🙈 {str.blind}
          </button>

          <div
            className={`fx-card${flipped ? ' is-flipped' : ''}${concealed ? ' is-concealed' : ''}`}
            style={{ '--fx-accent': category.accent }}
            onClick={concealed ? () => setRevealed(true) : undefined}
            role={concealed ? 'button' : undefined}
            tabIndex={concealed ? 0 : undefined}
            onKeyDown={concealed ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setRevealed(true); } } : undefined}
            data-testid="fx-vocab-card"
          >
            {concealed ? (
              <>
                <div className="fx-card-glyph fx-card-glyph--blind" aria-hidden="true">🙈</div>
                <div className="fx-card-blindhint">{str.blindHint}</div>
              </>
            ) : (
              <>
                <div className="fx-card-glyph" aria-hidden="true">{item.glyph}</div>
                <div className="fx-card-term" lang={language}>{item[language]}</div>
                {flipped ? <div className="fx-card-gloss">{glossOf(item, lang, language)}</div> : null}
              </>
            )}
            <ListenButtons term={item[language]} lang={language} str={str} testid="fx-vocab" />
          </div>

          {/* Speech-capture foundation — reproduce the term aloud, read the baseline. */}
          {!concealed ? <SpeechProbe language={language} str={str} /> : null}

          <div className="fx-actions">
            {!flipped
              ? <button type="button" className="fx-btn fx-btn--ghost" onClick={() => { setRevealed(true); setFlipped(true); }}>{str.flip}</button>
              : <button type="button" className="fx-btn" onClick={next} data-testid="fx-vocab-next">{str.next}</button>}
          </div>
          <span className="fx-progress">{str.progress(i + 1, items.length)}</span>
        </>
      )}
    </section>
  );
}

// ── PHASE 2 · 🔊 LISTENING — audio target matching ───────────────────────────
export function ListeningDrill({ category, items, language, onExit }) {
  const { str } = useFx();
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState(null);
  const [correct, setCorrect] = useState(0);
  const [finished, setFinished] = useState(false);

  const optIdx = useMemo(() => buildOptions(4, items.length, i, i * 7 + 3), [items.length, i]);
  const item = items[i];

  const choose = (idx) => {
    if (picked != null) return;
    setPicked(idx);
    if (idx === i) setCorrect((c) => c + 1);
  };
  const next = () => {
    if (i + 1 >= items.length) {
      setFinished(true);
      logPhase(category, language, 'listen', items.length, correct);
      return;
    }
    setI(i + 1); setPicked(null);
  };
  const replay = () => { setI(0); setPicked(null); setCorrect(0); setFinished(false); };

  if (finished) {
    return (
      <section className="fx-shell" data-testid="fx-listen">
        <PhaseHeader category={category} phaseKey="listening" str={str} onExit={onExit} />
        <PhaseDone str={str} correct={correct} total={items.length} onReplay={replay} onExit={onExit} />
      </section>
    );
  }
  return (
    <section className="fx-shell" data-testid="fx-listen">
      <PhaseHeader category={category} phaseKey="listening" str={str} onExit={onExit} />
      <div className="fx-audio-prompt">
        <span className="fx-audio-icon" aria-hidden="true">🎧</span>
        <ListenButtons term={item[language]} lang={language} str={str} testid="fx-listen" />
      </div>
      <span className="fx-quiz-q">{str.pick}</span>
      <div className="fx-options">
        {optIdx.map((idx) => {
          const state = picked == null ? '' : idx === i ? ' is-right' : idx === picked ? ' is-wrong' : ' is-dim';
          return (
            <button key={idx} type="button" className={`fx-opt${state}`} onClick={() => choose(idx)} disabled={picked != null} data-testid="fx-listen-opt">
              <span className="fx-opt-glyph" aria-hidden="true">{items[idx].glyph}</span>
              <span className="fx-opt-term" lang={language}>{items[idx][language]}</span>
            </button>
          );
        })}
      </div>
      {picked != null ? (
        <div className={`fx-feedback is-${picked === i ? 'right' : 'wrong'}`}>
          <span>{picked === i ? str.right : `${str.wrong} · ${str.answerWas(item[language])}`}</span>
          <button type="button" className="fx-btn" onClick={next} data-testid="fx-listen-next">{str.next}</button>
        </div>
      ) : null}
      <span className="fx-progress">{str.progress(i + 1, items.length)}</span>
    </section>
  );
}

// ── PHASE 3 · 👁️ READING — text translation matching ─────────────────────────
export function ReadingDrill({ category, items, language, onExit }) {
  const { lang, str } = useFx();
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState(null);
  const [correct, setCorrect] = useState(0);
  const [finished, setFinished] = useState(false);

  const optIdx = useMemo(() => buildOptions(4, items.length, i, i * 11 + 5), [items.length, i]);
  const item = items[i];

  const choose = (idx) => {
    if (picked != null) return;
    setPicked(idx);
    if (idx === i) setCorrect((c) => c + 1);
  };
  const next = () => {
    if (i + 1 >= items.length) {
      setFinished(true);
      logPhase(category, language, 'read', items.length, correct);
      return;
    }
    setI(i + 1); setPicked(null);
  };
  const replay = () => { setI(0); setPicked(null); setCorrect(0); setFinished(false); };

  if (finished) {
    return (
      <section className="fx-shell" data-testid="fx-read">
        <PhaseHeader category={category} phaseKey="reading" str={str} onExit={onExit} />
        <PhaseDone str={str} correct={correct} total={items.length} onReplay={replay} onExit={onExit} />
      </section>
    );
  }
  return (
    <section className="fx-shell" data-testid="fx-read">
      <PhaseHeader category={category} phaseKey="reading" str={str} onExit={onExit} />
      {/* READ the native target term, then choose its meaning. The 🔊 LISTEN /
          🐌 SLOW-MO reinforce the reading↔sound bind (they read the term the
          learner is looking at — the meaning options never leak from audio). */}
      <div className="fx-read-word" lang={language} style={{ '--fx-accent': category.accent }}>{item[language]}</div>
      <ListenButtons term={item[language]} lang={language} str={str} testid="fx-read" />
      <span className="fx-quiz-q">{str.pickMeaning}</span>
      <div className="fx-options fx-options--text">
        {optIdx.map((idx) => {
          const state = picked == null ? '' : idx === i ? ' is-right' : idx === picked ? ' is-wrong' : ' is-dim';
          return (
            <button key={idx} type="button" className={`fx-opt fx-opt--text${state}`} onClick={() => choose(idx)} disabled={picked != null} data-testid="fx-read-opt">
              <span className="fx-opt-glyph" aria-hidden="true">{items[idx].glyph}</span>
              <span className="fx-opt-term">{glossOf(items[idx], lang, language)}</span>
            </button>
          );
        })}
      </div>
      {picked != null ? (
        <div className={`fx-feedback is-${picked === i ? 'right' : 'wrong'}`}>
          <span>{picked === i ? str.right : `${str.wrong} · ${str.answerWas(glossOf(item, lang, language))}`}</span>
          <button type="button" className="fx-btn" onClick={next} data-testid="fx-read-next">{str.next}</button>
        </div>
      ) : null}
      <span className="fx-progress">{str.progress(i + 1, items.length)}</span>
    </section>
  );
}

// ── PHASE 4 · 🧠 MEMORY — spatial recognition card flip ──────────────────────
export function MemoryDrill({ category, items, language, onExit }) {
  const { str } = useFx();
  // 4 pairs (or fewer for a small bank) → 8 cards: one shows the glyph, its
  // partner shows the target term. A match is id-equality (so a category that
  // reuses a glyph across items still pairs correctly).
  const pairCount = Math.min(4, items.length);

  const build = () => {
    const chosen = items.slice(0, pairCount);
    const cards = chosen.flatMap((it, k) => ([
      { key: `g${k}`, itemIdx: k, face: 'glyph', text: it.glyph },
      { key: `t${k}`, itemIdx: k, face: 'term', text: it[language] },
    ]));
    // Deterministic board shuffle (seeded by pairCount so it's stable per mount).
    const order = seededOrder(cards.length, pairCount * 13 + 1);
    return order.map((o) => cards[o]);
  };

  const [board, setBoard] = useState(build);
  const [flipped, setFlipped] = useState([]);   // indices currently face-up (0–2)
  const [matched, setMatched] = useState([]);   // matched itemIdx values
  const [moves, setMoves] = useState(0);
  const [lock, setLock] = useState(false);

  const done = matched.length === pairCount;

  const flip = (idx) => {
    if (lock || flipped.includes(idx) || matched.includes(board[idx].itemIdx)) return;
    const nextFlipped = [...flipped, idx];
    setFlipped(nextFlipped);
    if (nextFlipped.length === 2) {
      setMoves((m) => m + 1);
      const [a, b] = nextFlipped;
      if (board[a].itemIdx === board[b].itemIdx) {
        setMatched((prev) => {
          const nm = [...prev, board[a].itemIdx];
          if (nm.length === pairCount) logPhase(category, language, 'memory', pairCount, pairCount);
          return nm;
        });
        setFlipped([]);
      } else {
        setLock(true);
        // resolve the mismatch on the next tap (no timers → deterministic + test-safe)
      }
    }
  };
  const clearMismatch = () => { setFlipped([]); setLock(false); };
  const replay = () => { setBoard(build()); setFlipped([]); setMatched([]); setMoves(0); setLock(false); };

  return (
    <section className="fx-shell" data-testid="fx-memory">
      <PhaseHeader category={category} phaseKey="memory" str={str} onExit={onExit} />
      {done ? (
        <PhaseDone str={str} onReplay={replay} onExit={onExit}>
          <p className="fx-done-score">{moves} {str.moves}</p>
        </PhaseDone>
      ) : (
        <>
          <span className="fx-quiz-q">{str.matchAll}</span>
          <div className={`fx-memory-grid${lock ? ' is-locked' : ''}`} onClick={lock ? clearMismatch : undefined}>
            {board.map((card, idx) => {
              const isUp = flipped.includes(idx) || matched.includes(card.itemIdx);
              const isMatched = matched.includes(card.itemIdx);
              return (
                <button
                  key={card.key}
                  type="button"
                  className={`fx-mem-card${isUp ? ' is-up' : ''}${isMatched ? ' is-matched' : ''}`}
                  style={{ '--fx-accent': category.accent }}
                  onClick={() => (lock ? clearMismatch() : flip(idx))}
                  aria-label={isUp ? card.text : str.tapReveal}
                  data-testid="fx-mem-card"
                >
                  <span className={card.face === 'term' ? 'fx-mem-term' : 'fx-mem-glyph'} lang={card.face === 'term' ? language : undefined}>
                    {isUp ? card.text : '★'}
                  </span>
                </button>
              );
            })}
          </div>
          <span className="fx-progress">{matched.length} / {pairCount}</span>
        </>
      )}
    </section>
  );
}

// ── PHASE 5 · 📝 WRITING — active spelling input ─────────────────────────────
export function WritingDrill({ category, items, language, onExit }) {
  const { lang, str } = useFx();
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState('');
  const [verdict, setVerdict] = useState(null); // null | 'right' | 'wrong'
  const [correct, setCorrect] = useState(0);
  const [finished, setFinished] = useState(false);
  const item = items[i];

  const check = () => {
    if (verdict) return;
    const good = norm(typed) === norm(item[language]);
    setVerdict(good ? 'right' : 'wrong');
    if (good) setCorrect((c) => c + 1);
  };
  const next = () => {
    if (i + 1 >= items.length) {
      setFinished(true);
      logPhase(category, language, 'write', items.length, correct);
      return;
    }
    setI(i + 1); setTyped(''); setVerdict(null);
  };
  const replay = () => { setI(0); setTyped(''); setVerdict(null); setCorrect(0); setFinished(false); };

  if (finished) {
    return (
      <section className="fx-shell" data-testid="fx-write">
        <PhaseHeader category={category} phaseKey="writing" str={str} onExit={onExit} />
        <PhaseDone str={str} correct={correct} total={items.length} onReplay={replay} onExit={onExit} />
      </section>
    );
  }
  return (
    <section className="fx-shell" data-testid="fx-write">
      <PhaseHeader category={category} phaseKey="writing" str={str} onExit={onExit} />
      <div className="fx-write-prompt" style={{ '--fx-accent': category.accent }}>
        <span className="fx-write-glyph" aria-hidden="true">{item.glyph}</span>
        <span className="fx-write-gloss">{glossOf(item, lang, language)}</span>
      </div>
      <ListenButtons term={item[language]} lang={language} str={str} testid="fx-write" />
      <input
        type="text"
        className={`fx-input${verdict === 'wrong' ? ' is-wrong' : verdict === 'right' ? ' is-right' : ''}`}
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') (verdict ? next() : check()); }}
        placeholder={str.typePrompt}
        lang={language}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        disabled={!!verdict}
        data-testid="fx-write-input"
      />
      {verdict ? (
        <div className={`fx-feedback is-${verdict}`}>
          <span>{verdict === 'right' ? str.right : `${str.wrong} · ${str.answerWas(item[language])}`}</span>
          <button type="button" className="fx-btn" onClick={next} data-testid="fx-write-next">{str.next}</button>
        </div>
      ) : (
        <button type="button" className="fx-btn" onClick={check} disabled={!typed.trim()} data-testid="fx-write-check">{str.check}</button>
      )}
      <span className="fx-progress">{str.progress(i + 1, items.length)}</span>
    </section>
  );
}
