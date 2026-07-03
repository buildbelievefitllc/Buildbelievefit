// src/components/hub/DashboardHub.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 3.1 — the Day-1 Hub layout orchestrator (Onboarding blueprint §2.2 + §3.3).
//
// Consumes useHubHydration once and lays out the four top surfaces:
//   Nutrition · Cardio  → full Degradation-Contract cards (NutritionCard/CardioCard)
//   Prehab · Audio Brief → compact status cards (below), same degrade-not-blank rule
//
// NO EMPTY DASHBOARDS: even before the first read resolves — and even if the RPC
// is unreachable — every card paints its Layer-2 baseline (chip-flagged), so the
// athlete never sees a spinner-only screen or an error panel. A degraded account
// is visually indistinguishable from a healthy one except for the Calibrating chips.
//
// TRILINGUAL: all chrome resolves through HUB_STR by preferred_locale; the hook
// binds identity via the vault token — nothing is hardcoded in English here.

import { useHubHydration } from './useHubHydration.js';
import { useHubStr, formatDuration, formatNumber } from './hubStrings.js';
import NutritionCard from './NutritionCard.jsx';
import CardioCard from './CardioCard.jsx';
import CalibratingChip from './CalibratingChip.jsx';
import './hub.css';

// ── Prehab — compact queue card. Empty queue is the HEALTHY "all clear" state ──
function PrehabCard({ data }) {
  const { hs } = useHubStr();
  const queued = Array.isArray(data?.queued) ? data.queued : [];
  const count = data?.count ?? queued.length;

  return (
    <section className="hub-card hub-card--prehab" aria-label={hs.prehabTitle}>
      <header className="hub-card-head">
        <span className="hub-card-kicker">{hs.prehabKicker}</span>
        <div className="hub-card-headline">
          <h3 className="hub-card-title">{hs.prehabTitle}</h3>
          {count > 0 ? <span className="hub-card-tier">{hs.prehabCount(count)}</span> : null}
        </div>
      </header>

      {count === 0 ? (
        <div className="hub-clear">{hs.prehabClear}</div>
      ) : (
        <ul className="hub-prehab-list">
          {queued.map((z, i) => (
            <li key={`${z.joint_zone}-${i}`} className="hub-prehab-row">
              <span className="hub-prehab-joint">{hs.joints[z.joint_zone] || z.joint_zone}</span>
              <span className={`hub-prehab-pri is-${z.priority}`}>{hs.priority[z.priority] || z.priority}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Audio Brief — compact runtime card. Missing brief → calibrating, not blank ──
function AudioBriefCard({ data }) {
  const { hs, lang } = useHubStr();
  const calibrating = !data;
  const toneLabel = data?.tone ? (hs.tone[data.tone] || data.tone) : null;

  return (
    <section className={`hub-card hub-card--brief${calibrating ? ' is-calibrating' : ''}`} aria-label={hs.briefTitle}>
      <header className="hub-card-head">
        <span className="hub-card-kicker">{hs.briefKicker}</span>
        <div className="hub-card-headline">
          <h3 className="hub-card-title">{hs.briefTitle}</h3>
          {calibrating ? <CalibratingChip /> : (toneLabel ? <span className="hub-card-tier">{toneLabel}</span> : null)}
        </div>
      </header>

      {calibrating ? (
        <div className="hub-clear">{hs.briefCalibrating}</div>
      ) : (
        <>
          <div className="hub-brief-ready">
            <span className="hub-brief-mark" aria-hidden="true">▶</span>
            <span>{hs.briefReady}</span>
          </div>
          <div className="hub-metric-grid hub-metric-grid--two">
            <div className="hub-metric">
              <span className="hub-metric-label">{hs.briefRuntime}</span>
              <span className="hub-metric-value">{formatDuration(data.total_duration_ms)}</span>
            </div>
            <div className="hub-metric">
              <span className="hub-metric-label">{hs.briefFragments}</span>
              <span className="hub-metric-value">{formatNumber(data.fragment_count, lang)}</span>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

export default function DashboardHub() {
  const { loading, hydration } = useHubHydration();
  const { hs } = useHubStr();

  // Per-slice reads. Absent hydration (loading OR fail-soft) → each card degrades
  // to its Layer-2 baseline; we still paint the full layout. Never blank.
  const nutrition = hydration?.nutrition_today ?? null;
  const cardio = hydration?.cardio_today ?? null;
  const prehab = hydration?.prehab_card ?? null;
  const brief = hydration?.brief_playlist ?? null;
  const defaults = hydration?.defaults ?? null;

  // The banner shows whenever the account is in a degraded state OR a load-time
  // baseline is standing in for a not-yet-resolved slice.
  const degraded = hydration?.pipeline_state === 'cold_start_degraded'
    || (!!hydration && (!nutrition || !cardio));

  return (
    <div className={`hub${loading ? ' is-loading' : ''}`} data-testid="dashboard-hub">
      <header className="hub-head">
        <span className="hub-kicker">{hs.hubKicker}</span>
        <h2 className="hub-title">{hs.hubTitle}</h2>
      </header>

      {degraded ? <div className="hub-degraded-note" role="note">{hs.degradedNote}</div> : null}

      <div className="hub-grid">
        <NutritionCard data={nutrition} defaults={defaults} />
        <CardioCard data={cardio} defaults={defaults} />
        <PrehabCard data={prehab} />
        <AudioBriefCard data={brief} />
      </div>
    </div>
  );
}
