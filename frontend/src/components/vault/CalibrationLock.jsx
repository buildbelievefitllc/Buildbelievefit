// src/components/vault/CalibrationLock.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The 30-Day Calibration padlock pane — rendered IN PLACE of a tool the athlete's
// Biometric Calibration hasn't unlocked yet. This is distinct from the tier
// UpgradeOverlay: it is a TIME gate, not a paywall, so there is NO checkout CTA —
// just the calibration phase, the day they're on, and the day the surface opens.
//
// Brand-locked (CLAUDE.md §2): BBF Purple structure, Victory-Gold accents. Trilingual
// chrome via useLang. Dynamic {feature}/{day} are token-replaced (t() has no interp).

import { useLang } from '../../context/LangContext.jsx';
import { CAL_PHASE } from '../../lib/calibration.js';
import './calibration.css';

export default function CalibrationLock({
  featureLabelKey,
  unlockDay,
  day,
  phase,
  testId = 'calibration-lock',
}) {
  const { t } = useLang();
  const feature = featureLabelKey ? t(featureLabelKey) : '';
  const lead = phase >= CAL_PHASE.IGNITION ? t('cal-lock-ignition') : t('cal-lock-mapping');
  const unlock = t('cal-lock-unlock')
    .replace('{feature}', feature)
    .replace('{day}', String(unlockDay));

  return (
    <section
      className="cal-lock"
      role="region"
      aria-label={t('cal-kicker')}
      data-testid={testId}
    >
      <div className="cal-lock__card">
        <div className="cal-lock__icon" aria-hidden="true">🔒</div>
        <div className="cal-lock__kicker">
          {t('cal-kicker')} · {t('cal-phase')} {phase}
        </div>
        <h2 className="cal-lock__feature">{feature}</h2>
        <p className="cal-lock__body">{lead} {unlock}</p>
        {Number.isFinite(day) ? (
          <div className="cal-lock__day">{t('cal-day')} {day} / 30</div>
        ) : null}
      </div>
    </section>
  );
}
