// src/components/hub/NutritionCard.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 3.1 — the Nutrition card (Onboarding blueprint §3.3 Degradation Contract).
//
// DEGRADATION CONTRACT: check the live row. If it exists → paint it. If it's
// missing → paint the config-backed tier default (from the RPC's `defaults`, or
// the client LAYER2_DEFAULTS as the last-resort floor) + a CalibratingChip. The
// panel is NEVER empty and NEVER shows a raw error — a degraded card is identical
// to a healthy one but for the chip.
//
// THE GRAM BOUNDARY: protein/carbs/fat arrive as BIGINT integer grams; we only
// FORMAT them here (locale grouping, ' g' suffix). tdee_kcal is energy, not mass.
// No unit math, no physiology — that all lives server-side.
//
// @param {{ data: import('./useHubHydration.js').NutritionToday|null, defaults?: Object }} props

import { useHubStr, formatGrams, formatKcal, LAYER2_DEFAULTS } from './hubStrings.js';
import CalibratingChip from './CalibratingChip.jsx';
import './hub.css';

export default function NutritionCard({ data, defaults }) {
  const { hs, lang } = useHubStr();

  // Resolution order (§3.3): live row → server config default → client Layer-2 floor.
  const calibrating = !data;
  const n = data || defaults?.nutrition || LAYER2_DEFAULTS.nutrition;

  const tierLabel = hs.tier[n.tier] || n.tier;
  const dayTypeLabel = hs.dayTypes[n.day_type] || n.day_type;

  const macros = [
    { key: 'protein', label: hs.nutProtein, value: formatGrams(n.protein_g, lang), accent: '#ff5d5d' },
    { key: 'carbs', label: hs.nutCarbs, value: formatGrams(n.carbs_g, lang), accent: '#4dc3ff' },
    { key: 'fat', label: hs.nutFat, value: formatGrams(n.fat_g, lang), accent: '#ffb547' },
  ];
  if (n.creatine_g != null) {
    macros.push({ key: 'creatine', label: hs.nutCreatine, value: formatGrams(n.creatine_g, lang), accent: 'var(--gold-soft)' });
  }

  return (
    <section className={`hub-card hub-card--nutrition${calibrating ? ' is-calibrating' : ''}`} aria-label={hs.nutTitle}>
      <header className="hub-card-head">
        <span className="hub-card-kicker">{hs.nutKicker}</span>
        <div className="hub-card-headline">
          <h3 className="hub-card-title">{hs.nutTitle}</h3>
          {calibrating ? <CalibratingChip /> : <span className="hub-card-tier">{tierLabel}</span>}
        </div>
      </header>

      <div className="hub-hero-figure">
        <span className="hub-hero-value">{formatKcal(n.tdee_kcal, lang)}</span>
        <span className="hub-hero-unit">{hs.kcalUnit}</span>
        <span className="hub-hero-label">{hs.nutTdee}</span>
      </div>

      <div className="hub-metric-grid">
        {macros.map((m) => (
          <div key={m.key} className="hub-metric" style={{ borderTopColor: m.accent }}>
            <span className="hub-metric-label">{m.label}</span>
            <span className="hub-metric-value">{m.value}</span>
          </div>
        ))}
      </div>

      <footer className="hub-card-foot">
        <span className="hub-foot-key">{hs.dayType}</span>
        <span className="hub-foot-val">{dayTypeLabel}</span>
      </footer>
    </section>
  );
}
