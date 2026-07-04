// src/components/language/LanguageMasteryPanel.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The 90-Day Language Mastery Lab — target-language toggle (es/pt) over the FOUR
// closed-loop surfaces (LANGUAGE MASTERY §Mastery Views):
//   Mode 1 · Vocab Forge — the SRS media drill (clip + typed recall + 1–4 grade)
//   Mode 2 · The Path    — drag-and-drop syntax quiz over gym-floor sentences
//   Mode 3 · Audio Dojo  — the screen-locked Pimsleur stitch loop (Web Audio)
//   Immersion            — the roleplay chat (admin-token, self-locking)
// Every mode writes the same append-only ledger (bbf_language_session_history),
// so the nightly Polyglot Sentinel trends one unified history. Mounted under the
// /command AdminGuard (CEO-only).

import { useState } from 'react';
import VocabFlashcard from './VocabFlashcard.jsx';
import ThePath from './ThePath.jsx';
import AudioDojo from './AudioDojo.jsx';
import ImmersionWrapper from './ImmersionWrapper.jsx';
import { useLangUiStr } from './languageStrings.js';
import './language.css';

const TARGETS = ['es', 'pt'];

const MODES = [
  { id: 'forge', label: '⚒ Vocab Forge' },
  { id: 'path', label: '⛰ The Path' },
  { id: 'dojo', label: '🥋 Audio Dojo' },
  { id: 'immersion', label: '💬 Immersion' },
];

export default function LanguageMasteryPanel() {
  const { targetName } = useLangUiStr();
  const [target, setTarget] = useState('es');
  const [mode, setMode] = useState('forge');

  return (
    <div className="lm-panel">
      <div className="lm-target-toggle" role="radiogroup" aria-label="target language">
        {TARGETS.map((tg) => (
          <button
            key={tg}
            type="button"
            role="radio"
            aria-checked={target === tg}
            className={`lm-target-chip${target === tg ? ' is-active' : ''}`}
            onClick={() => setTarget(tg)}
          >
            {targetName[tg]}
          </button>
        ))}
      </div>

      {/* the three Mastery Views + Immersion — one surface at a time */}
      <div className="lm-mode-tabs" role="tablist" aria-label="mastery modes">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={mode === m.id}
            className={`lm-mode-tab${mode === m.id ? ' is-active' : ''}`}
            onClick={() => setMode(m.id)}
            data-testid={`lm-mode-${m.id}`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* key={target} → a language swap fully remounts the active view */}
      <div className="lm-stage" key={`${mode}-${target}`}>
        {mode === 'forge' ? <VocabFlashcard language={target} /> : null}
        {mode === 'path' ? <ThePath language={target} /> : null}
        {mode === 'dojo' ? <AudioDojo language={target} /> : null}
        {mode === 'immersion' ? <ImmersionWrapper targetLanguage={target} /> : null}
      </div>
    </div>
  );
}
