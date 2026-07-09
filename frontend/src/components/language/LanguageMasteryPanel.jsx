// src/components/language/LanguageMasteryPanel.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The 90-Day Language Mastery Lab — now a CURRICULUM ENGINE, not a static toolset.
//
//   • THE BILINGUAL STATE MATRIX — the global es/pt toggle at the top of the hub
//     (LanguageLabProvider). Persisted across unmounts/refreshes; every module's
//     DB target, vocabulary queue, and curriculum track re-keys instantly on swap.
//   • THE GUIDED TRACK — the day-by-day dosed checklist strip (GuidedTrack):
//     10 Vocab Cards · 1 Syntax Rule · 1 Video Vault review per day; completing
//     the dose stamps the server unlock flag for Day N+1. Purely additive —
//     every mode below stays freely usable (free-roam by design).
//   • SIX surfaces, in the compartmentalized progression (STRUCTURAL MERGE —
//     the Language Lab is now the SOLE language portal):
//       Mode 1 · Vocab Forge   — the SRS media drill (clip + typed recall + 1–4 grade)
//       Mode 2 · The Path      — drag-and-drop syntax quiz over gym-floor sentences
//       Mode 3 · Audio Dojo    — the screen-locked Pimsleur stitch loop (Web Audio)
//       Mode 4 · Video Vault   — curated native input (the daily VVF review)
//       Immersion              — the roleplay chat, scaffolded with guided A/B
//                                replies through the early curriculum days
//       Voice Studio (final)   — COACH AKEEM'S VOICE STUDIO & AUDIO LAB: the
//                                complete legacy module (Pimsleur Audio Lab ·
//                                Voice Studio · Vocab Gym soundboards · every
//                                ElevenLabs-baked 🔊 asset), fused in whole via
//                                VoiceStudioLab — nothing removed, nothing lost.
// The closed-loop modes write the same append-only ledger
// (bbf_language_session_history), so the nightly Polyglot Sentinel trends one
// unified history. Mounted under the /command AdminGuard (CEO-only).

import VocabFlashcard from './VocabFlashcard.jsx';
import ThePath from './ThePath.jsx';
import AudioDojo from './AudioDojo.jsx';
import VideoVault from './VideoVault.jsx';
import ImmersionWrapper from './ImmersionWrapper.jsx';
import VoiceStudioLab from './VoiceStudioLab.jsx';
import GuidedTrack from './GuidedTrack.jsx';
import { LanguageLabProvider, useLanguageLab } from './LanguageLabContext.jsx';
import { useLangUiStr } from './languageStrings.js';
import { useState } from 'react';
import './language.css';

const TARGETS = ['es', 'pt'];

// Immersion scaffolding stays on through the foundation stretch of the track —
// guided A/B replies bridge the gap before free-form conversation is expected.
const SCAFFOLD_THROUGH_DAY = 14;

// The compartmentalized progression — Guided Track strip on top, then these
// panels in order; the fused legacy Audio Lab closes the deck.
const MODES = [
  { id: 'forge', label: '⚒ Vocab Forge' },
  { id: 'path', label: '⛰ The Path' },
  { id: 'dojo', label: '🥋 Audio Dojo' },
  { id: 'vault', label: '🎞 Video Vault' },
  { id: 'immersion', label: '💬 Immersion' },
  { id: 'studio', label: '🎙 Voice Studio' },
];

function LabHub() {
  const { targetName } = useLangUiStr();
  const { target, setTarget, curriculum } = useLanguageLab();
  const [mode, setMode] = useState('forge');

  // Early curriculum days (or no track data yet) → the Immersion module scaffolds.
  const scaffold = !curriculum.ready || curriculum.day <= SCAFFOLD_THROUGH_DAY;

  return (
    <div className="lm-panel">
      {/* ── THE BILINGUAL STATE MATRIX — global, persisted es/pt state ── */}
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

      {/* ── THE GUIDED TRACK — the day's dosed checklist (never a gate).
             The video item names the day's Sequence-Mapper lesson and routes
             straight into the Vault, where that lesson renders featured. ── */}
      <GuidedTrack onOpenVault={() => setMode('vault')} />

      {/* the four Mastery Views + Immersion — one surface at a time */}
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
        {mode === 'vault' ? <VideoVault language={target} /> : null}
        {mode === 'immersion' ? <ImmersionWrapper targetLanguage={target} scaffold={scaffold} /> : null}
        {mode === 'studio' ? <VoiceStudioLab /> : null}
      </div>
    </div>
  );
}

export default function LanguageMasteryPanel() {
  return (
    <LanguageLabProvider>
      <LabHub />
    </LanguageLabProvider>
  );
}
