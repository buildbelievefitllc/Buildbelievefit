// src/context/ReadinessContext.jsx
// ─────────────────────────────────────────────────────────────────────────────
// SOVEREIGN READINESS — global daily-readiness state (the morning check-in verdict).
//
// Holds the result of the Sovereign Readiness Dashboard's check-in for the CURRENT
// calendar day: the 1–10 readiness score, the CNS volume multiplier, and the
// trilingual alert. The multiplier is the load-governor the active workout surfaces
// (FloorLogger / SmartCardio) read to scale the day's targets.
//
// Persisted per LOCAL day to localStorage, so it survives navigation + refresh but
// auto-resets when the calendar rolls — yesterday's verdict must never govern today.
// Until the athlete checks in, volMultiplier is 1.0 (a no-op: full prescribed load).
//
// This is a deliberately SEPARATE channel from useDailyReadiness (the HRV/biometric
// ledger): that engine regulates off wearable telemetry, this one off the explicit
// sleep + vibe morning check-in (bbf-readiness-calculator). Consumers can read both.

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const STORAGE_KEY = 'bbf.readiness.v1';

// Local calendar day as 'YYYY-MM-DD' (en-CA renders ISO order in local time) —
// matches the convention in useDailyReadiness so both channels roll on the same day.
function localDay() {
  return new Date().toLocaleDateString('en-CA');
}

// Score → band (drives the hero glow + the volume label). Mirrors the backend's
// volMultiplier thresholds exactly (<5 → 0.5, <8 → 0.8, else 1.0).
// eslint-disable-next-line react-refresh/only-export-components
export function bandForScore(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return 'idle';
  if (n >= 8) return 'full';
  if (n >= 5) return 'reduced';
  return 'recovery';
}

const DEFAULT = { day: localDay(), volMultiplier: 1, readinessScore: null, vibeCheck: null, sleepHours: null, alerts: null, loggedAt: null };

function readStored() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (raw && raw.day === localDay()) return { ...DEFAULT, ...raw };
  } catch { /* private mode / malformed — fall through to default */ }
  return { ...DEFAULT };
}

const ReadinessContext = createContext({
  ...DEFAULT,
  hasCheckedIn: false,
  band: 'idle',
  setReadiness: () => {},
  resetReadiness: () => {},
});

export function ReadinessProvider({ children }) {
  // Lazy init from storage (sync) — the day's verdict is known at first render.
  const [state, setState] = useState(readStored);

  const setReadiness = useCallback((next) => {
    setState(() => {
      const merged = {
        ...DEFAULT,
        day: localDay(),
        volMultiplier: Number(next?.volMultiplier ?? 1) || 1,
        readinessScore: next?.readinessScore ?? null,
        vibeCheck: next?.vibeCheck ?? null,
        sleepHours: next?.sleepHours ?? null,
        alerts: next?.alerts ?? null,
        loggedAt: Date.now(),
      };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(merged)); } catch { /* quota/private mode */ }
      return merged;
    });
  }, []);

  const resetReadiness = useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setState({ ...DEFAULT, day: localDay() });
  }, []);

  const value = useMemo(() => {
    // A verdict from a previous day never governs today (defensive: the lazy init
    // already guards, but a long-open tab that rolled past midnight is covered too).
    const fresh = state.day === localDay() && state.readinessScore != null;
    return {
      ...state,
      volMultiplier: fresh ? state.volMultiplier : 1,
      hasCheckedIn: fresh,
      band: fresh ? bandForScore(state.readinessScore) : 'idle',
      setReadiness,
      resetReadiness,
    };
  }, [state, setReadiness, resetReadiness]);

  return <ReadinessContext.Provider value={value}>{children}</ReadinessContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useReadiness() {
  return useContext(ReadinessContext);
}

export default ReadinessContext;
