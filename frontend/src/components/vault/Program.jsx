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

import { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLang } from '../../context/LangContext.jsx';
import { Badge } from '../command/primitives.jsx';
import { parseWorkoutPlan } from '../../lib/vaultApi.js';
import ProgramGrid from './ProgramGrid.jsx';
import SovereignSentinel from './SovereignSentinel.jsx';
import HypertrophyBalanceAnalyzer from './HypertrophyBalanceAnalyzer.jsx';
import VoiceCoachButton from './VoiceCoachButton.jsx';
import RPEEducationCard from './RPEEducationCard.jsx';
import ContextualVoiceover from './ContextualVoiceover.jsx';
import { AUDIO_CTX_PROGRAM_RPE } from '../../lib/contextualVoiceover.js';
import TierGate from '../TierGate.jsx';
import { buildCoachCue } from './coachCue.js';
import { SequenceCTA } from './SovereignSequence.jsx';
import PremiumSessionPlayer from './PremiumSessionPlayer.jsx';
import { createHrSource } from '../../lib/liveHeartRate.js';
import { GuideLauncher } from '../BbfMediaPortal.jsx';

// Trilingual UI chrome (EN verbatim to the prior hardcoded copy so the default
// language keeps the vault-logging E2E selectors green). Module-local dictionary
// keyed by lang — the same convention MindsetEngine.jsx uses for vault content.
const STR = {
  en: { head: 'Training Protocol', streak: (n) => `${n}-day streak`, written: 'Coach’s written protocol', anShow: 'View Weekly Analytics', anHide: 'Hide Weekly Analytics', anSub: 'Dossier · volume & balance' },
  es: { head: 'Protocolo de Entrenamiento', streak: (n) => `racha de ${n} días`, written: 'Protocolo escrito del coach', anShow: 'Ver Análisis Semanal', anHide: 'Ocultar Análisis Semanal', anSub: 'Expediente · volumen y balance' },
  pt: { head: 'Protocolo de Treino', streak: (n) => `sequência de ${n} dias`, written: 'Protocolo escrito do coach', anShow: 'Ver Análise Semanal', anHide: 'Ocultar Análise Semanal', anSub: 'Dossiê · volume e equilíbrio' },
};

// Weekly-analytics dossier — COLLAPSED by default. One sleek toggle reveals the
// master visual dashboard (Analyzer for admin / Sentinel blueprint for client), so
// the Program tab opens action-first instead of leading with charts.
function AnalyticsDossier({ isAdmin, tr }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="pg-analytics">
      <button
        type="button"
        className={`pg-analytics-toggle${open ? ' is-open' : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="pg-analytics-ic" aria-hidden="true">📊</span>
        <span className="pg-analytics-label">{open ? tr.anHide : tr.anShow}</span>
        <span className="pg-analytics-sub">{tr.anSub}</span>
        <span className="pg-analytics-chev" aria-hidden="true">▾</span>
      </button>
      {open ? (
        <div className="pg-analytics-body">
          {isAdmin ? <HypertrophyBalanceAnalyzer /> : <SovereignSentinel />}
        </div>
      ) : null}
    </div>
  );
}

function formatStamp(iso) {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Date(t).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function Program({ plans, profile, onSequence }) {
  const { user, isAdmin } = useAuth();
  const { lang, t } = useLang();
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

      {/* 4K module guide — sits right under the phase/protocol selection header. */}
      <GuideLauncher module="program_tracker" testId="program-guide" />

      {/* V-04 (Repositioning): the two collapsible utility strips — What-is-RPE
          education + the Weekly Analytics dossier — share one half-width row
          instead of stacking full-width. Both stay collapsed-by-default. */}
      <div className="pg-utility-row">
        {/* RPE Education Card — collapsible, text-first education on RPE. */}
        <RPEEducationCard preferred_locale={lang} />
        {/* Master visual dashboard — COLLAPSED BY DEFAULT so the Program tab opens
            straight onto the day's protocol (action over analysis). The toggle
            reveals the Hypertrophy Balance Analyzer (admin) or the Sovereign
            Sentinel blueprint (client). */}
        <AnalyticsDossier isAdmin={isAdmin} tr={tr} />
      </div>

      {/* ── CONTEXTUAL VOICEOVER — Coach Akeem walks "Enter the Floor": how to read
          the rep ranges + RPE for today. Compact strip (S-02); expands on play. ── */}
      <ContextualVoiceover
        audioKey={AUDIO_CTX_PROGRAM_RPE}
        testId="ctx-vo-program-rpe"
        title={{ en: 'Enter the Floor', es: 'Entra al Piso', pt: 'Entre no Treino' }}
        sub={{
          en: 'How to read the rep ranges and RPE so you match the prescribed intensity — not just go through the motions.',
          es: 'Cómo leer los rangos de repeticiones y el RPE para igualar la intensidad prescrita — no solo cumplir el movimiento.',
          pt: 'Como ler as faixas de repetições e o RPE para bater a intensidade prescrita — não só cumprir o movimento.',
        }}
      />

      {/* ── PREMIUM SESSION AUDIO — Product 1 (Apex band). Akeem narrates today's
          protocol over a composed music bed; live HR splices pacing cues at seams.
          Locked tiers see the upsell overlay (visibility-as-sales). ── */}
      <TierGate feature="premium_audio" featureLabel="Premium Session Audio" testId="premium-audio-gate">
        <PremiumSessionPlayer plan={dynamicPlan} hrSource={createHrSource()} />
      </TierGate>

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

      {/* Sovereign Sequence · Step 4 + the FORK — adult-only (gated on onSequence).
          PRIMARY continues to Cardio; SECONDARY (outlined) detours to the Prehab
          diagnostic for anyone reporting joint friction / pain. */}
      {onSequence ? (
        <div className="svs-next">
          <SequenceCTA label={t('svs-cta-4')} onClick={() => onSequence('cardio')} testid="sovereign-step-4" />
          <SequenceCTA label={t('svs-cta-prehab-fork')} onClick={() => onSequence('prehab')} testid="sovereign-fork-prehab" variant="secondary" />
        </div>
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
