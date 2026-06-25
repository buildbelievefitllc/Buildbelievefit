// src/components/vault/CalibrationProgress.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The HUD "Calibration Progress" rail on the Vault Hub. Inside the 30-day window it
// renders a sleek Day-X/30 progress bar + the phase subtitle ("Building Central
// Nervous System Baseline."); at graduation (Day 30+) it becomes the PERMANENT
// "Sovereign Athlete" badge.
//
// Driven purely by the calibration anchor. Renders NOTHING for an undatable / no-anchor
// session (fail-open) so it never paints a bogus bar for an established athlete with no
// intake row.

import { useLang } from '../../context/LangContext.jsx';
import { useCalibration } from '../../lib/useCalibration.js';
import { CAL_PHASE } from '../../lib/calibration.js';
import './calibration.css';

export default function CalibrationProgress() {
  const { t } = useLang();
  const cal = useCalibration();

  // No anchor → no rail (established/undatable athlete sees nothing).
  if (!cal.hasAnchor) return null;

  // Graduated → the permanent Sovereign Athlete badge (replaces the bar).
  if (cal.isGraduated) {
    return (
      <div className="cal-badge" data-testid="calibration-badge">
        <span className="cal-badge__mark" aria-hidden="true">★</span>
        <div className="cal-badge__text">
          <span className="cal-badge__title">{t('cal-badge')}</span>
          <span className="cal-badge__sub">{t('cal-badge-sub')}</span>
        </div>
      </div>
    );
  }

  const pct = Math.min(100, Math.max(0, Math.round((cal.day / cal.windowDays) * 100)));
  const sub = cal.phase >= CAL_PHASE.IGNITION ? t('cal-prog-sub-2') : t('cal-prog-sub-1');

  return (
    <div
      className="cal-prog"
      data-testid="calibration-progress"
      role="group"
      aria-label={t('cal-prog-label')}
    >
      <div className="cal-prog__head">
        <span className="cal-prog__label">{t('cal-prog-label')}</span>
        <span className="cal-prog__count">{t('cal-day')} {cal.day} / {cal.windowDays}</span>
      </div>
      <div className="cal-prog__track" aria-hidden="true">
        <div className="cal-prog__fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="cal-prog__sub">{sub}</p>
    </div>
  );
}
