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
//   • THE SYSTEM NARRATION ENGINE — the global voice-persona toggle at the very
//     top header, meshing both voice systems: NATURAL SYNTHESIZER (premium Web
//     Speech) ⇄ BBF COACH AKEEM (pre-baked ElevenLabs). Every 🔊 across the Lab
//     routes through it (useNarrator).
//   • The compartmentalized progression — one surface at a time, dedicated
//     sub-tabs for every capability (nothing buried):
//       Vocab Forge   — the SRS media drill (clip + typed recall + 1–4 grade)
//       The Path      — drag-and-drop syntax quiz + a narrated "hear it"
//       Audio Dojo    — the screen-locked Pimsleur stitch loop (native baked)
//       Pimsleur Lab  — the legacy graduated-interval lesson player (dedicated)
//       Voice Studio  — the on-device pronunciation scorer (dedicated)
//       Video Vault   — curated native input (the daily VVF review)
//       Immersion     — the roleplay chat, scaffolded with guided A/B replies
//       Audio Lab     — the COMPLETE legacy hub (all 10 protocol surfaces),
//                       kept whole so nothing is ever lost (VoiceStudioLab).
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
import EchoChamber from './EchoChamber.jsx';
import GrammarClinic from './GrammarClinic.jsx';
import PimsleurAudioLab from '../command/PimsleurAudioLab.jsx';
import { TabVoiceStudio } from '../command/AdminLanguageRoadmap.jsx';
import { LanguageLabProvider, useLanguageLab } from './LanguageLabContext.jsx';
import { sceneForDay } from './immersionScenarios.js';
import { useLangUiStr } from './languageStrings.js';
import { useState } from 'react';
import './language.css';

const TARGETS = ['es', 'pt'];

// The SYSTEM NARRATION ENGINE toggle states — explicit brand labels (per spec).
const ENGINES = [
  { id: 'natural', label: 'Natural Synthesizer', hint: 'Premium native Web Speech' },
  { id: 'akeem', label: 'BBF Coach Akeem', hint: 'ElevenLabs voice clone' },
];

// Immersion scaffolding stays on through the foundation stretch of the track —
// guided A/B replies bridge the gap before free-form conversation is expected.
const SCAFFOLD_THROUGH_DAY = 14;

// The compartmentalized progression — Guided Track strip on top, then these
// panels in order; the Pimsleur Lab + Voice Studio are dedicated peers (not
// buried), and the complete legacy Audio Lab hub closes the deck.
const MODES = [
  { id: 'forge', label: '⚒ Vocab Forge' },
  { id: 'path', label: '⛰ The Path' },
  { id: 'echo', label: '🪞 Echo Chamber' },
  { id: 'dojo', label: '🥋 Audio Dojo' },
  { id: 'pimsleur', label: '🎧 Pimsleur Lab' },
  { id: 'voice', label: '🎙 Voice Studio' },
  { id: 'vault', label: '🎞 Video Vault' },
  { id: 'immersion', label: '💬 Immersion' },
  { id: 'clinic', label: '🩺 Grammar Clinic' },
  { id: 'studio', label: '🧪 Audio Lab' },
];

function LabHub() {
  const { targetName } = useLangUiStr();
  const { target, setTarget, narrationEngine, setNarrationEngine, curriculum } = useLanguageLab();
  const [mode, setMode] = useState('forge');
  // "Step into the scene" deep-link: The Path hands over the day, we open the
  // Immersion tab pre-set to that day's persona (shared-universe crossover).
  const [immersionScene, setImmersionScene] = useState(null);

  // Early curriculum days (or no track data yet) → the Immersion module scaffolds.
  const scaffold = !curriculum.ready || curriculum.day <= SCAFFOLD_THROUGH_DAY;

  const liveScene = (day) => {
    setImmersionScene(sceneForDay(day));
    setMode('immersion');
  };

  return (
    <div className="lm-panel">
      {/* ── THE SYSTEM NARRATION ENGINE — the global voice-persona toggle. The
             absolute top header; every 🔊 in the Lab routes through this state. ── */}
      <div className="lm-engine" data-testid="lm-engine-toggle">
        <span className="lm-engine-label">System Narration Engine</span>
        <div className="lm-engine-seg" role="radiogroup" aria-label="system narration engine">
          {ENGINES.map((e) => (
            <button
              key={e.id}
              type="button"
              role="radio"
              aria-checked={narrationEngine === e.id}
              title={e.hint}
              className={`lm-engine-chip${narrationEngine === e.id ? ' is-active' : ''}`}
              onClick={() => setNarrationEngine(e.id)}
              data-testid={`lm-engine-${e.id}`}
            >
              <span className="lm-engine-chip-dot" aria-hidden="true" />
              {e.label}
            </button>
          ))}
        </div>
      </div>

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
        {mode === 'path' ? <ThePath language={target} onLiveScene={liveScene} /> : null}
        {mode === 'echo' ? <EchoChamber language={target} /> : null}
        {mode === 'dojo' ? <AudioDojo language={target} /> : null}
        {mode === 'pimsleur' ? <PimsleurAudioLab /> : null}
        {mode === 'voice' ? <TabVoiceStudio /> : null}
        {mode === 'vault' ? <VideoVault language={target} /> : null}
        {mode === 'immersion' ? <ImmersionWrapper targetLanguage={target} scaffold={scaffold} initialSceneKey={immersionScene} /> : null}
        {mode === 'clinic' ? <GrammarClinic language={target} /> : null}
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
