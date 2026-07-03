// src/components/hub/CardioCard.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 3.1 — the Cardio card (Onboarding blueprint §3.3 Degradation Contract).
//
// DEGRADATION CONTRACT (identical posture to NutritionCard): live prescription →
// paint it; missing → config-backed Zone-2 baseline (RPC `defaults`, else client
// LAYER2_DEFAULTS) + a CalibratingChip. Never an empty panel, never a raw error.
//
// THE GRAM BOUNDARY: sweat_loss_g_est and rehydration_g arrive as BIGINT integer
// grams and are only FORMATTED here (locale grouping, ' g'). ee_kcal_est is energy;
// hr_cap_bpm / duration_min are plain counts. Nullable fields (a recovery-clamped
// prescription may omit hr cap / work:rest) render an em-dash, never "null".
//
// @param {{ data: import('./useHubHydration.js').CardioToday|null, defaults?: Object }} props

import { useHubStr, formatGrams, formatKcal, formatNumber, LAYER2_DEFAULTS } from './hubStrings.js';
import CalibratingChip from './CalibratingChip.jsx';
import './hub.css';

export default function CardioCard({ data, defaults }) {
  const { hs, lang } = useHubStr();

  // Calibrating ONLY when the payload has no prescription targets at all — neither a
  // live prescription NOR the config-backed Zone-2 default. A hydrated profile with a
  // standing tier default is the normal default state, not a calibration placeholder,
  // so it must not wear the chip just because today's live row (`data`) is absent.
  const targets = data || defaults?.cardio || null;
  const calibrating = !targets;
  // Field-level baseline coalesce (defect: blank "— kcal" / "—" duration): start from
  // the config baseline (or the client floor) and overlay ONLY the live prescription's
  // non-null fields — so a live row that hasn't filled its numerics yet still renders
  // the baseline targets from the payload instead of blanks.
  const base = { ...LAYER2_DEFAULTS.cardio, ...(defaults?.cardio || {}) };
  const c = { ...base };
  if (data) for (const [k, v] of Object.entries(data)) if (v != null) c[k] = v;

  const recoveryKey = c.recovery_state && hs.recovery[c.recovery_state] ? c.recovery_state : 'unknown';
  const recoveryLabel = hs.recovery[recoveryKey];

  // duration + HR cap ride the hero rail; the gram outputs sit in the metric grid.
  const durationTxt = c.duration_min != null ? `${formatNumber(c.duration_min, lang)} ${hs.minUnit}` : '—';
  const hrCapTxt = c.hr_cap_bpm != null ? `${formatNumber(c.hr_cap_bpm, lang)} ${hs.bpmUnit}` : '—';

  const metrics = [
    { key: 'ee', label: hs.cardEe, value: `${formatKcal(c.ee_kcal_est, lang)} ${hs.kcalUnit}`, accent: 'var(--yel)' },
    { key: 'sweat', label: hs.cardSweat, value: formatGrams(c.sweat_loss_g_est, lang), accent: '#4dc3ff' },
    { key: 'rehydrate', label: hs.cardRehydrate, value: formatGrams(c.rehydration_g, lang), accent: '#5dd6ff' },
    { key: 'workrest', label: hs.cardWorkRest, value: c.work_rest_ratio || '—', accent: '#ff5d5d' },
  ];

  return (
    <section className={`hub-card hub-card--cardio${calibrating ? ' is-calibrating' : ''}`} aria-label={hs.cardTitle}>
      <header className="hub-card-head">
        <span className="hub-card-kicker">{hs.cardKicker}</span>
        <div className="hub-card-headline">
          <h3 className="hub-card-title">{hs.cardTitle}</h3>
          {calibrating
            ? <CalibratingChip />
            : <span className={`hub-card-tier hub-recovery is-${recoveryKey}`}>{recoveryLabel}</span>}
        </div>
      </header>

      <div className="hub-hero-figure hub-hero-figure--split">
        <div className="hub-hero-split">
          <span className="hub-hero-value">{c.effective_tier || '—'}</span>
          <span className="hub-hero-label">{hs.cardTier}</span>
        </div>
        <div className="hub-hero-rail">
          <div className="hub-rail-line">
            <span className="hub-rail-k">{hs.cardDuration}</span>
            <span className="hub-rail-v">{durationTxt}</span>
          </div>
          <div className="hub-rail-line">
            <span className="hub-rail-k">{hs.cardHrCap}</span>
            <span className="hub-rail-v">{hrCapTxt}</span>
          </div>
        </div>
      </div>

      <div className="hub-metric-grid">
        {metrics.map((m) => (
          <div key={m.key} className="hub-metric" style={{ borderTopColor: m.accent }}>
            <span className="hub-metric-label">{m.label}</span>
            <span className="hub-metric-value">{m.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
