// src/lib/useFloorSession.js
// ─────────────────────────────────────────────────────────────────────────────
// The decoupled render binding (kills the ghosting): the Active Workout UI reads
// the active session STRICTLY from the local Dexie cache via useLiveQuery — never
// from Supabase. A tap that writes to Dexie re-renders here instantly; a
// background cloud flush is invisible to the component.

import { useLiveQuery } from 'dexie-react-hooks';
import { floorDb } from './floorDb.js';
import { dayKeyFor } from '../components/vault/programApi.js';

// Live prescription + logged sets for one athlete-day, keyed by the same
// composite the cache is written under. Returns stable [] arrays while loading.
export function useFloorSession(uid, dayIdx) {
  const slug = String(uid || '').trim().toLowerCase();
  const dayKey = slug && dayIdx != null && dayIdx >= 0 ? dayKeyFor(dayIdx) : null;

  const prescription = useLiveQuery(
    () => (dayKey ? floorDb.prescription.where('[uid+dayKey]').equals([slug, dayKey]).sortBy('exIdx') : []),
    [slug, dayKey],
    [],
  );

  const sets = useLiveQuery(
    () => (dayKey ? floorDb.sets.where('[uid+dayKey]').equals([slug, dayKey]).toArray() : []),
    [slug, dayKey],
    [],
  );

  // Index logged sets by exKey → setNumber for O(1) lookup in the renderer.
  const setMap = {};
  (sets || []).forEach((s) => {
    setMap[s.exKey] = setMap[s.exKey] || {};
    setMap[s.exKey][s.setNumber] = s;
  });

  return {
    prescription: prescription || [],
    setMap,
    loading: prescription === undefined,
    dayKey,
  };
}
