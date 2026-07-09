// src/components/command/RosterProvider.jsx
// ─────────────────────────────────────────────────────────────────────────────
// SHARED ROSTER PROVIDER (Redundancy fix R1 · COACHING_MODULE_AUDIT.md).
//
// Before: Founder Five (ClientHub) and Nutrition Locker each fired their OWN
// `rosterCall('roster')` on mount — the identical service-role fetch of the whole
// bbf_users roster, with no shared cache. Switching between the two Coaching tabs
// re-pulled the same list every time.
//
// After: ONE provider owns the base roster. It fetches exactly once (memoized via
// a loaded-ref), caches the result, and both siblings consume it. Mounted OUTSIDE
// CommandCenter's `key={activeTab}` remount boundary, so tab switches never
// re-fetch — the roster round-trip happens a single time per Command Center visit.
//
// Panel-specific ENRICHMENTS (ClientHub's 30-day calibration overlay + the
// adherence-radar telemetry) stay local to their panel — they are distinct calls,
// not the duplicate roster fetch R1 targets. The provider owns only the shared
// base list + the optimistic mutations both panels care about.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { rosterCall, toErrorMessage } from '../../lib/rosterApi.js';

const RosterContext = createContext(null);

export function RosterProvider({ children }) {
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Memoization guard: the base roster is fetched at most ONCE for the lifetime of
  // this provider unless a caller explicitly forces a refresh (post-forge reconcile,
  // manual "Refresh"). This is what collapses the duplicate sibling pulls into one.
  const loadedRef = useRef(false);
  const inFlightRef = useRef(null);

  const load = useCallback(async ({ force = false } = {}) => {
    if (loadedRef.current && !force) return;      // already have it → no round-trip
    if (inFlightRef.current) return inFlightRef.current; // dedupe concurrent callers
    setLoading(true);
    setError(null);
    const p = (async () => {
      try {
        const body = await rosterCall('roster');
        setRoster(Array.isArray(body.clients) ? body.clients : []);
        loadedRef.current = true;
      } catch (e) {
        setError(toErrorMessage(e));
        setRoster([]);
      } finally {
        setLoading(false);
        inFlightRef.current = null;
      }
    })();
    inFlightRef.current = p;
    return p;
  }, []);

  // Self-load once on mount (deferred to a microtask so the initial setState lands
  // outside the synchronous effect body — house pattern, satisfies
  // react-hooks/set-state-in-effect). Cancel-guarded.
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) load(); });
    return () => { cancelled = true; };
  }, [load]);

  // Optimistic head-insert (Forge Athlete) — the new client lands instantly; a
  // follow-up refresh() reconciles against the server.
  const injectClient = useCallback((client) => {
    if (client?.id) setRoster((prev) => [client, ...prev.filter((c) => c.id !== client.id)]);
  }, []);

  const value = useMemo(() => ({
    roster,
    loading,
    error,
    refresh: () => load({ force: true }),
    injectClient,
  }), [roster, loading, error, load, injectClient]);

  return <RosterContext.Provider value={value}>{children}</RosterContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useRoster() {
  const ctx = useContext(RosterContext);
  if (!ctx) throw new Error('useRoster must be used within a <RosterProvider>.');
  return ctx;
}
