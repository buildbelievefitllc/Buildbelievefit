// src/components/language/LanguageMasteryPanel.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 3.5 — Command Center panel that wires the Language Mastery UI: a target-
// language toggle (es/pt) over the Vocab Gym SRS drill (VocabFlashcard, vault-token)
// and the Immersion chat (ImmersionWrapper, admin-token). Both are mounted under
// the /command AdminGuard (cmd-tab is CEO-only).
//
// The two surfaces keep their own auth: the gym reads the athlete/CEO vault session;
// Immersion replays the X-BBF-Admin-Token and self-shows a locked state without it.

import { useState } from 'react';
import VocabFlashcard from './VocabFlashcard.jsx';
import ImmersionWrapper from './ImmersionWrapper.jsx';
import { useLangUiStr } from './languageStrings.js';
import './language.css';

const TARGETS = ['es', 'pt'];

export default function LanguageMasteryPanel() {
  const { targetName } = useLangUiStr();
  const [target, setTarget] = useState('es');

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

      <div className="lm-grid">
        <VocabFlashcard language={target} />
        <ImmersionWrapper targetLanguage={target} />
      </div>
    </div>
  );
}
