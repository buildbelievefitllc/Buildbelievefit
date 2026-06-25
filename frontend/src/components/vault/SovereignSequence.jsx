// src/components/vault/SovereignSequence.jsx
// ─────────────────────────────────────────────────────────────────────────────
// THE SOVEREIGN SEQUENCE — a guided, button-driven hand-off across the ADULT
// Client Hub tabs: Hub → Check-In → Prep (Prehab) → Program → Cardio.
//
// Scope guard: every piece renders ONLY when a host passes the `onStep(tabId)`
// callback. ClientVault is the sole caller, so the sequence appears exclusively on
// the adult Vault — the Youth Sports Hub and the admin Command Center never pass
// it, so nothing leaks there (CEO constraint: adult-only). Brand-locked (§2).
//
// Audio: the CEO's exact anthem, spoken VERBATIM by Coach Akeem via the
// bbf-biokinetic-briefing `sequence` context (cached by cueRef). The clinical text
// card below is the API SHIELD — it lets the athlete re-read the protocol without
// re-triggering a synth.

import CoachAudioButton from './CoachAudioButton.jsx';
import { fetchCachedSectionCoachAudio } from '../../lib/forecastApi.js';
import './sovereignSequence.css';

// The CEO's exact ElevenLabs script — do not paraphrase. Spoken full-length and
// verbatim by the `sequence` voice context (Coach Akeem · floor-coach delivery).
export const SEQUENCE_SCRIPT = `Transformation isn't an accident. It is an engineered outcome. You are here to break the loop of whatever has been holding you back, and this sequence is the process of beginning that change. Think of this as the daily homework you do for yourself. We never touch the iron until we know exactly where your nervous system stands today. Whether your watch automatically synced or you manually log your sleep, the data drives the engine. It starts right here: We scan the baseline, we prime the tissues, we execute the load, and we flush the system with cardio. This isn't just about today's workout. It's about breaking your old patterns and building an unbreakable machine for the next decade. Hit the Check-In button below, and let's get to work.`;

// The API-shield card — exact CEO copy, formatted as a dark clinical breakdown.
const STEPS = [
  ['1', 'Data Capture (Check-In)', 'Nervous system scanning dictates training volume.'],
  ['2', 'Tissue Priming (Recovery)', 'Equipment-free mobilization to prevent injury.'],
  ['3', 'Execution (Program)', 'Adaptive load protocols mapped to daily readiness.'],
  ['4', 'System Flush (Cardio)', 'Targeted work to accelerate recovery.'],
];

// Reusable large step CTA (Phases 1–4) — the locked gold transport with an arrow.
export function SequenceCTA({ label, onClick, testid, variant = 'primary' }) {
  return (
    <button type="button" className={`svs-cta${variant === 'secondary' ? ' svs-cta--secondary' : ''}`} onClick={onClick} data-testid={testid}>
      <span className="svs-cta-label">{label}</span>
    </button>
  );
}

// Bottom-of-tab next step (Phases 2–4) — a divider + the CTA so it reads as a
// deliberate hand-off at the foot of the surface.
export function SequenceNext({ label, onClick, testid }) {
  return (
    <div className="svs-next">
      <SequenceCTA label={label} onClick={onClick} testid={testid} />
    </div>
  );
}

// Phase 1 — the Hub anchor: anthem audio + clinical text shield + Step 1 CTA.
export function SovereignSequenceAnchor({ onStep }) {
  return (
    <section className="svs" aria-label="The Sovereign Sequence" data-testid="sovereign-sequence">
      <div className="svs-kicker">The Sovereign Sequence</div>
      <h2 className="svs-head">Breaking the Loop</h2>

      <CoachAudioButton
        idleLabel="Listen: Breaking the Loop"
        audioRequest={() => fetchCachedSectionCoachAudio({ context: 'sequence', cueRef: 'sovereign-sequence-intro', cueText: SEQUENCE_SCRIPT, locale: 'en' })}
        fallbackText={SEQUENCE_SCRIPT}
      />

      {/* API shield — read the protocol without re-triggering the audio synth. */}
      <div className="svs-card" data-testid="sovereign-sequence-shield">
        <div className="svs-card-title">THE SOVEREIGN SEQUENCE: YOUR DAILY HOMEWORK</div>
        <ol className="svs-steps">
          {STEPS.map(([n, h, d]) => (
            <li key={n} className="svs-step">
              <span className="svs-step-n" aria-hidden="true">{n}</span>
              <span className="svs-step-body">
                <span className="svs-step-h">{h}:</span> <span className="svs-step-d">{d}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>

      <SequenceCTA label="Step 1: Execute Check-In ➔" onClick={() => onStep('checkin')} testid="sovereign-step-1" />
    </section>
  );
}
