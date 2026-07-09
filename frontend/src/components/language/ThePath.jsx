// src/components/language/ThePath.jsx
// ─────────────────────────────────────────────────────────────────────────────
// MODE 2 · THE PATH — the syntax quiz (LANGUAGE MASTERY §Mastery Views).
// Scrambled gym-floor vocabulary chips are physically DRAGGED into the answer
// rail to rebuild the sentence (HTML5 drag-and-drop, with tap-to-place as the
// accessible fallback). Grading is deterministic (exact word order); every
// completed run appends to bbf_language_session_history via
// bbf_log_language_attempt (module 'drill') — the ledger the Polyglot Sentinel
// trends nightly. THE GRAM STANDARD: mass appears ONLY as integer grams.

import { useMemo, useState } from 'react';
import { logLanguageAttempt } from '../../lib/languageLabApi.js';
import { useLanguageLab } from './LanguageLabContext.jsx';
import { useNarrator } from './useNarrator.js';
import { useLang } from '../../context/LangContext.jsx';
import './language.css';

// Gym-floor sentence bank (gram-native — no kg/lb lexeme ever).
const SENTENCES = {
  es: [
    { id: 'es1', prompt: 'Brace the core.', words: ['activa', 'el', 'core'] },
    { id: 'es2', prompt: 'Open the knees.', words: ['abre', 'las', 'rodillas'] },
    { id: 'es3', prompt: 'Load 90,000 g on the bar.', words: ['carga', '90000', 'g', 'en', 'la', 'barra'] },
  ],
  pt: [
    { id: 'pt1', prompt: 'Brace the core.', words: ['trave', 'o', 'core'] },
    { id: 'pt2', prompt: 'Open the knees.', words: ['abre', 'os', 'joelhos'] },
    { id: 'pt3', prompt: 'Load 90,000 g on the bar.', words: ['carrega', '90000', 'g', 'na', 'barra'] },
  ],
};

const TP_STR = {
  en: { kicker: 'The Path · Syntax', title: 'Build the sentence', drop: 'Drag the chips here — in order', check: 'Check', next: 'Next sentence', reset: 'Reset', hear: '🔊 Hear it', correct: '✓ Correct — locked in.', wrong: '✗ Not quite — reset and rebuild.', doneTitle: 'Path complete', done: (c, t) => `${c}/${t} sentences correct — logged to your ledger.` },
  es: { kicker: 'La Senda · Sintaxis', title: 'Construye la frase', drop: 'Arrastra las fichas aquí — en orden', check: 'Comprobar', next: 'Siguiente frase', reset: 'Reiniciar', hear: '🔊 Escúchala', correct: '✓ Correcto — asegurado.', wrong: '✗ Casi — reinicia y reconstruye.', doneTitle: 'Senda completa', done: (c, t) => `${c}/${t} frases correctas — registrado en tu historial.` },
  pt: { kicker: 'A Trilha · Sintaxe', title: 'Monte a frase', drop: 'Arraste as fichas aqui — em ordem', check: 'Verificar', next: 'Próxima frase', reset: 'Reiniciar', hear: '🔊 Ouça', correct: '✓ Correto — garantido.', wrong: '✗ Quase — reinicie e remonte.', doneTitle: 'Trilha completa', done: (c, t) => `${c}/${t} frases corretas — registrado no seu histórico.` },
};

// Deterministic scramble (rotate + interleave) — stable per sentence, never the
// solved order for 3+ words, and no render-time randomness.
function scramble(words) {
  const out = [...words.slice(1), words[0]];
  if (out.length > 3) { const [a, b] = [out[0], out[2]]; out[0] = b; out[2] = a; }
  return out.map((w, i) => ({ id: `${w}-${i}`, word: w }));
}

export default function ThePath({ language = 'es' }) {
  const { lang } = useLang();
  const { logModuleProgress } = useLanguageLab(); // Guided Track dose counter (inert off-provider)
  const { narrate } = useNarrator();              // 🔊 routes through the global engine toggle
  const tr = TP_STR[lang] || TP_STR.en;
  const bank = SENTENCES[language === 'pt' ? 'pt' : 'es'];

  const [si, setSi] = useState(0);          // sentence index
  const [placed, setPlaced] = useState([]); // chips dropped into the rail, in order
  const [verdict, setVerdict] = useState(null); // null | 'correct' | 'wrong'
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const sentence = bank[si];
  const chips = useMemo(() => scramble(sentence.words), [sentence]);
  const remaining = chips.filter((c) => !placed.some((p) => p.id === c.id));

  const placeChip = (chipId) => {
    if (verdict === 'correct') return;
    const chip = chips.find((c) => c.id === chipId);
    if (!chip || placed.some((p) => p.id === chipId)) return;
    setPlaced((prev) => [...prev, chip]);
    setVerdict(null);
  };

  const onDrop = (e) => {
    e.preventDefault();
    placeChip(e.dataTransfer.getData('text/bbf-chip'));
  };

  const check = async () => {
    const built = placed.map((p) => p.word).join(' ');
    const truth = sentence.words.join(' ');
    const good = built === truth;
    setVerdict(good ? 'correct' : 'wrong');
    if (!good) return;
    const nextScore = score + 1;
    setScore(nextScore);
    logModuleProgress('syntax', 1); // each correct build advances the daily dose
    if (si + 1 >= bank.length) {
      setFinished(true);
      // Append the run to the closed-loop ledger (streak + EWMA update server-side).
      logLanguageAttempt({
        language, module: 'drill',
        itemsTotal: bank.length, itemsCorrect: nextScore,
        items: bank.map((s) => ({ sentence: s.words.join(' '), prompt: s.prompt })),
      });
    }
  };

  const advance = () => {
    setSi((i) => Math.min(i + 1, bank.length - 1));
    setPlaced([]); setVerdict(null);
  };
  const reset = () => { setPlaced([]); setVerdict(null); };

  if (finished) {
    return (
      <section className="tp-shell" data-testid="the-path">
        <span className="lm-kicker">{tr.kicker}</span>
        <h3 className="lm-title">{tr.doneTitle}</h3>
        <div className="tp-done" data-testid="path-done">{tr.done(score, bank.length)}</div>
      </section>
    );
  }

  return (
    <section className="tp-shell" data-testid="the-path">
      <span className="lm-kicker">{tr.kicker}</span>
      <h3 className="lm-title">{tr.title}</h3>
      <div className="tp-prompt">“{sentence.prompt}”</div>

      {/* the answer rail — chips are dragged (or tapped) into here, in order */}
      <div
        className={`tp-rail${verdict === 'correct' ? ' is-correct' : verdict === 'wrong' ? ' is-wrong' : ''}`}
        data-testid="path-rail"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        {placed.length === 0 ? <span className="tp-rail-hint">{tr.drop}</span> : null}
        {placed.map((p) => (
          <span key={p.id} className="tp-chip is-placed" data-testid="path-placed-chip">{p.word}</span>
        ))}
      </div>

      {/* the scrambled chip tray */}
      <div className="tp-tray" data-testid="path-tray">
        {remaining.map((c) => (
          <button
            key={c.id}
            type="button"
            className="tp-chip"
            draggable
            data-testid="path-chip"
            onDragStart={(e) => e.dataTransfer.setData('text/bbf-chip', c.id)}
            onClick={() => placeChip(c.id)}
          >
            {c.word}
          </button>
        ))}
      </div>

      <div className="tp-actions">
        <button type="button" className="tp-btn tp-btn--ghost" onClick={reset}>{tr.reset}</button>
        {/* Hear the model sentence in the active narration engine (Coach Akeem's
            baked native voice, or the premium Web Speech synthesizer). */}
        <button
          type="button"
          className="tp-btn tp-btn--ghost"
          onClick={() => narrate({ text: sentence.words.join(' '), lang: language })}
          data-testid="path-hear"
        >
          {tr.hear}
        </button>
        {verdict === 'correct' && si + 1 < bank.length ? (
          <button type="button" className="tp-btn" onClick={advance} data-testid="path-next">{tr.next}</button>
        ) : (
          <button type="button" className="tp-btn" onClick={check} disabled={placed.length !== sentence.words.length} data-testid="path-check">
            {tr.check}
          </button>
        )}
      </div>

      {verdict ? (
        <div className={`tp-verdict is-${verdict}`} data-testid="path-verdict">
          {verdict === 'correct' ? tr.correct : tr.wrong}
        </div>
      ) : null}
    </section>
  );
}
