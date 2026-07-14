// src/components/vault/Program.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 18 → 18.1 → 19 — Client Vault · Program.
//
// Primary surface is the dense, clinical 7-day <ProgramGrid> reconstructed from
// the legacy monolith (day pills → exercise tables → per-set weight tracking with
// server autoregulation). Exercises render STRICTLY from the authorized program
// catalog — see components/vault/programData.js.
//
// Phase 19 — HIERARCHY OVERHAUL (CEO order): the old "cockpit" of competing
// widgets stacked between the title and the workout is retired. Every secondary
// action now collapses into a minimalist SOVEREIGN PREP rail — three pills
// (⚡ Prep · 🎙️ Coach · 📊 Data) sitting right under the "Training Protocol"
// title — each opening a clean, animated slide-up drawer. The day's workout grid
// scales straight to the top as the primary visual hero of the tab.
//
//   ⚡ Prep  → Watch Guide / Listen Only (4K module guide) · What-is-RPE guide +
//             audio · the "Enter the Floor" contextual voiceover.
//   🎙️ Coach → the premium "Generate Today's Session" narration player + the AI
//             Voice Coach briefing button (both coach-voice audio).
//   📊 Data  → the Weekly Analytics dossier (Analyzer for admin / Sentinel for
//             client).
//
// The AI-generated text protocol delivered at sign-in (session.plans.workout_plan,
// Phase 18 data wiring) is preserved below the grid as a collapsible reference so
// nothing from the auth payload is lost.

import { useEffect, useMemo, useState } from 'react';
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
  en: {
    head: 'Training Protocol', streak: (n) => `${n}-day streak`,
    written: 'Coach’s written protocol', anSub: 'Dossier · volume & balance',
    prep: 'Prep', coach: 'Coach', data: 'Data',
    prepFull: 'Sovereign Prep', coachFull: 'Coach Audio', dataFull: 'Weekly Analytics',
    railLabel: 'Session prep', close: 'Close',
  },
  es: {
    head: 'Protocolo de Entrenamiento', streak: (n) => `racha de ${n} días`,
    written: 'Protocolo escrito del coach', anSub: 'Expediente · volumen y balance',
    prep: 'Prep', coach: 'Coach', data: 'Datos',
    prepFull: 'Preparación Soberana', coachFull: 'Audio del Coach', dataFull: 'Análisis Semanal',
    railLabel: 'Preparación de sesión', close: 'Cerrar',
  },
  pt: {
    head: 'Protocolo de Treino', streak: (n) => `sequência de ${n} dias`,
    written: 'Protocolo escrito do coach', anSub: 'Dossiê · volume e equilíbrio',
    prep: 'Prep', coach: 'Coach', data: 'Dados',
    prepFull: 'Preparação Soberana', coachFull: 'Áudio do Coach', dataFull: 'Análise Semanal',
    railLabel: 'Preparação de sessão', close: 'Fechar',
  },
};

// Rail definition — order + glyph for the three collapsed action pills. The label
// resolves per-language from STR; the drawer title uses the *Full variant.
const RAIL = [
  { key: 'prep', icon: '⚡' },
  { key: 'coach', icon: '🎙️' },
  { key: 'data', icon: '📊' },
];

// ── Slide-up drawer — one bottom sheet, content switched by the active pill ────
// Mobile-first (anchored to the bottom edge, clears the home-swipe indicator via
// safe-area-inset-bottom); Esc / backdrop / ✕ close and background scroll locks
// while open — the same modal doctrine as BbfMediaPortal.jsx.
function PrepDrawer({ which, tr, onClose, lang, isAdmin, dynamicPlan, coachCue }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const meta = {
    prep: { icon: '⚡', title: tr.prepFull },
    coach: { icon: '🎙️', title: tr.coachFull },
    data: { icon: '📊', title: tr.dataFull },
  }[which];

  return (
    <div
      className="pg-drawer-scrim"
      role="dialog"
      aria-modal="true"
      aria-label={meta.title}
      onClick={onClose}
      data-testid={`prep-drawer-${which}`}
    >
      <div className="pg-drawer" onClick={(e) => e.stopPropagation()}>
        <span className="pg-drawer-grip" aria-hidden="true" />
        <header className="pg-drawer-head">
          <span className="pg-drawer-title">
            <span aria-hidden="true">{meta.icon}</span> {meta.title}
          </span>
          <button
            type="button"
            className="pg-drawer-x"
            onClick={onClose}
            aria-label={tr.close}
            data-testid="prep-drawer-close"
          >
            ✕
          </button>
        </header>

        <div className="pg-drawer-body">
          {which === 'prep' ? (
            <>
              {/* 4K module guide — Watch Guide / Listen Only pair. */}
              <GuideLauncher module="program_execution" testId="program-guide" />
              {/* What-is-RPE — collapsible education + its audio trigger. */}
              <RPEEducationCard preferred_locale={lang} />
              {/* Coach Akeem walks "Enter the Floor": reading rep ranges + RPE. */}
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
            </>
          ) : null}

          {which === 'coach' ? (
            <>
              {/* PREMIUM SESSION AUDIO — Product 1 (Apex band). "Generate Today's
                  Session" compiles today's programming; locked tiers see the upsell
                  overlay (visibility-as-sales). */}
              <TierGate feature="premium_audio" featureLabel="Premium Session Audio" testId="premium-audio-gate">
                <PremiumSessionPlayer plan={dynamicPlan} hrSource={createHrSource()} />
              </TierGate>
              {/* AI Voice Coach — speaks today's briefing via bbf-tts-eleven, stock
                  voice fallback. Gated to voice_coach (Autonomous / Fuel / God). */}
              <TierGate feature="voice_coach" render="hide">
                <VoiceCoachButton text={coachCue} lang={lang} />
              </TierGate>
            </>
          ) : null}

          {which === 'data' ? (
            // Master visual dashboard — the pill IS the toggle now, so the raw
            // dossier renders directly (Analyzer for admin / Sentinel for client).
            <div className="pg-drawer-data" data-testid="weekly-analytics-body">
              {isAdmin ? <HypertrophyBalanceAnalyzer /> : <SovereignSentinel />}
            </div>
          ) : null}
        </div>
      </div>
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

  // null | 'prep' | 'coach' | 'data' — which collapsed action drawer is open.
  const [drawer, setDrawer] = useState(null);
  const toggle = (key) => setDrawer((d) => (d === key ? null : key));

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
      {/* Title bar — stripped to the hero title + streak. Every secondary action
          moved into the Sovereign Prep rail below (Phase 19 de-clutter). */}
      <div style={styles.bar}>
        <h2 style={styles.head}>{tr.head}</h2>
        {profile ? (
          <Badge
            label={tr.streak(profile.currentStreak)}
            color={profile.currentStreak > 0 ? 'var(--grn)' : 'var(--mut)'}
          />
        ) : null}
      </div>

      {/* SOVEREIGN PREP rail — the minimalist horizontal menu that collapses the
          old cockpit. Real <button role="tab">s; the active pill is highlighted
          and its drawer mounts on demand. Scrolls horizontally on narrow phones. */}
      <div className="pg-prep-rail" role="tablist" aria-label={tr.railLabel}>
        {RAIL.map(({ key, icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={drawer === key}
            aria-expanded={drawer === key}
            className={`pg-prep-pill${drawer === key ? ' is-active' : ''}`}
            onClick={() => toggle(key)}
            data-testid={`prep-pill-${key}`}
          >
            <span className="pg-prep-ic" aria-hidden="true">{icon}</span>
            <span className="pg-prep-label">{tr[key]}</span>
          </button>
        ))}
      </div>

      {/* HERO — the day's workout scales straight to the top of the viewport. */}
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

      {/* The one shared slide-up drawer — content switched by the active pill. */}
      {drawer ? (
        <PrepDrawer
          which={drawer}
          tr={tr}
          onClose={() => setDrawer(null)}
          lang={lang}
          isAdmin={isAdmin}
          dynamicPlan={dynamicPlan}
          coachCue={coachCue}
        />
      ) : null}
    </div>
  );
}

const styles = {
  bar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' },
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
