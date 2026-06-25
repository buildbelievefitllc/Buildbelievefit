// src/components/vault/CalibrationGate.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Wraps a Vault tab body in the 30-Day Biometric Calibration TIME gate. It is mounted
// INSIDE <TierGate>, so the tier paywall always resolves first: an athlete whose tier
// doesn't own the feature sees the UpgradeOverlay (upsell), never a calibration
// message. Only a tier-OWNED-but-still-calibrating surface reaches this gate, which
// then renders the CalibrationLock pane in place of the tool until the unlock day.
//
// FAIL-OPEN: graduated athletes and undatable/no-anchor sessions pass straight
// through (useCalibration → isTabCalibrationLocked returns false).

import { useCalibration } from '../../lib/useCalibration.js';
import CalibrationLock from './CalibrationLock.jsx';

export default function CalibrationGate({ tabId, featureLabelKey, children }) {
  const cal = useCalibration();

  if (!cal.isTabCalibrationLocked(tabId)) return <>{children}</>;

  return (
    <CalibrationLock
      featureLabelKey={featureLabelKey}
      unlockDay={cal.unlockDayForTab(tabId)}
      day={cal.day}
      phase={cal.phase}
    />
  );
}
