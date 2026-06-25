// src/lib/useCalibration.js
// ─────────────────────────────────────────────────────────────────────────────
// React binding for the 30-Day Calibration brain (calibration.js). Reads the intake
// anchor off the authenticated session — `calibrationStartedAt`, broadcast at login
// by bbf_verify_user_pin and persisted by AuthContext — and derives the live
// day/phase.
//
// NO network: unlike useEntitlement (which fetches the live tier), the calibration
// anchor already rode in on the login envelope, so this hook is pure + synchronous.
// FAIL-OPEN: a missing anchor resolves to GRADUATED, so a session persisted before
// this shipped (no anchor field) is never falsely padlocked.

import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import {
  CALIBRATION_WINDOW_DAYS,
  computeCalibration,
  isTabCalibrationLocked,
  unlockDayForTab,
} from './calibration.js';

export function useCalibration() {
  const { user } = useAuth();
  const startedAtMs = user?.calibrationStartedAt ?? null;

  // Sample the wall clock ONCE at mount via a lazy initializer — the value is
  // intentionally fixed for the session (the 24h vault token forces a daily re-login, and
  // any reload re-derives the day across a midnight boundary, so no live ticker is needed).
  const [nowMs] = useState(() => Date.now());

  return useMemo(() => {
    const state = computeCalibration(startedAtMs, nowMs);
    return {
      ...state, // { day, phase, isGraduated, hasAnchor }
      windowDays: CALIBRATION_WINDOW_DAYS,
      // True only while the athlete is inside the calibration window (drives the
      // progress bar vs. the permanent Sovereign Athlete badge).
      inProgress: state.hasAnchor && !state.isGraduated,
      canAccessTab: (tabId) => !isTabCalibrationLocked(tabId, state),
      isTabCalibrationLocked: (tabId) => isTabCalibrationLocked(tabId, state),
      unlockDayForTab: (tabId) => unlockDayForTab(tabId),
    };
  }, [startedAtMs, nowMs]);
}
