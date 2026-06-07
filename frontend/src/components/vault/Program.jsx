// src/components/vault/Program.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 18 → 18.1 — Client Vault · Program.
//
// Primary surface is now the dense, clinical 7-day <ProgramGrid> reconstructed
// from the legacy monolith (day pills → exercise tables → per-set weight
// tracking with server autoregulation). Exercises render STRICTLY from the
// authorized program catalog — see components/vault/programData.js.
//
// The AI-generated text protocol delivered at sign-in (session.plans.workout_plan,
// Phase 18 data wiring) is preserved below the grid as a collapsible reference so
// nothing from the auth payload is lost.

import { useMemo } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLang } from '../../context/LangContext.jsx';
import { Badge } from '../command/primitives.jsx';
import { parseWorkoutPlan } from '../../lib/vaultApi.js';
import ProgramGrid from './ProgramGrid.jsx';
import SovereignSentinel from './SovereignSentinel.jsx';
import HypertrophyBalanceAnalyzer from './HypertrophyBalanceAnalyzer.jsx';
import VoiceCoachButton from './VoiceCoachButton.jsx';
import TierGate from '../TierGate.jsx';
import { buildCoachCue } from './coachCue.js';

// Trilingual UI chrome (EN verbatim to the prior hardcoded copy so the default
// language keeps the vault-logging E2E selectors green). Module-local dictionary
// keyed by lang — the same convention MindsetEngine.jsx uses for vault content.
const STR = {
  en: { head: 'Training Protocol', streak: (n) => `${n}-day streak`, written: 'Coach’s written protocol' },
  es: { head: 'Protocolo de Entrenamiento', streak: (n) => `racha de ${n} días`, written: 'Protocolo escrito del coach' },
  pt: { head: 'Protocolo de Treino', streak: (n) => `sequência de ${n} dias`, written: 'Protocolo escrito do coach' },
};

function formatStamp(iso) {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Date(t).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function Program({ plans, profile }) {
  const { user, isAdmin } = useAuth();
  const { lang } = useLang();
  const tr = STR[lang] || STR.en;
  const uid = user?.username || user?.id || '';
  const textPlan = plans?.workoutPlan || '';
  const stamp = formatStamp(plans?.generatedAt);

  // The assigned plan is a structured JSON array (day/focus/exercises) written by
  // the AI engine. When present it IS the user's real program — render the grid
  // from it. Falls back to the authorized static catalog (by persona) otherwise.
  const dynamicPlan = useMemo(() => parseWorkoutPlan(textPlan), [textPlan]);

  // Spoken briefing for the AI Voice Coach — derived from the athlete's OWN lead
  // session and streak, trilingual (follows the active language). Recomputed only
  // when the plan, profile, or language changes.
  const coachCue = useMemo(
    () => buildCoachCue({ plan: dynamicPlan, profile, lang }),
    [dynamicPlan, profile, lang],
  );

  return (
    <div>
      <div style={styles.bar}>
        <h2 style={styles.head}>{tr.head}</h2>
        <div style={styles.actions}>
          {/* AI Voice Coach (RESTORED) — speaks today's session briefing via
              bbf-tts-eleven (virtual_coach → Julius), falling back to the device's
              built-in stock voice when ElevenLabs is unavailable. Live Vision
              camera stays deprecated to protect UI performance. */}
          {/* Phase 2: AI Voice Coach gated to voice_coach (Autonomous / Fuel / God);
              hidden for Baseline + Youth. Assimilated ElevenLabs→stock-voice button. */}
          <TierGate feature="voice_coach" render="hide">
            <VoiceCoachButton text={coachCue} lang={lang} />
          </TierGate>
          {profile ? (
            <Badge
              label={tr.streak(profile.currentStreak)}
              color={profile.currentStreak > 0 ? 'var(--grn)' : 'var(--mut)'}
            />
          ) : null}
        </div>
      </div>

      {/* Master visual dashboard above the grid. From the Command Center (admin/
          coach) this is the Hypertrophy Balance Analyzer (volume-ratio read-out);
          the client Vault keeps the Sovereign Sentinel kinetic blueprint. */}
      {isAdmin ? <HypertrophyBalanceAnalyzer /> : <SovereignSentinel />}

      <ProgramGrid uid={uid} programKey={user?.programKey} dynamicPlan={dynamicPlan} />

      {/* Only surface the raw written protocol for LEGACY plain-text plans — a
          structured JSON plan is already rendered as the grid above, so we never
          dump raw JSON into a <pre>. */}
      {textPlan && !dynamicPlan ? (
        <details style={styles.details}>
          <summary style={styles.summary}>
            {tr.written}{stamp ? ` · ${stamp}` : ''}
          </summary>
          <pre style={styles.protocol}>{textPlan}</pre>
        </details>
      ) : null}
    </div>
  );
}

const styles = {
  bar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' },
  actions: { display: 'flex', alignItems: 'center', gap: '.6rem', flexWrap: 'wrap' },
  head: { fontFamily: 'var(--display)', fontSize: '1.5rem', letterSpacing: '.5px', margin: 0 },
  details: {
    marginTop: '1.4rem',
    background: 'var(--gry)',
    border: '1px solid var(--line)',
    borderRadius: 12,
    padding: '.4rem .9rem',
  },
  summary: {
    fontFamily: 'var(--hb)',
    fontSize: '.78rem',
    letterSpacing: '2px',
    textTransform: 'uppercase',
    color: 'var(--gold-soft)',
    cursor: 'pointer',
    padding: '.6rem 0',
  },
  protocol: {
    fontFamily: 'var(--bd)',
    fontSize: '1rem',
    lineHeight: 1.6,
    color: 'var(--wht)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    margin: '.4rem 0 .6rem',
  },
};
