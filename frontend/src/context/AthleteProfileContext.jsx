// src/context/AthleteProfileContext.jsx
// ─────────────────────────────────────────────────────────────────────────────
// ATHLETE PROFILE — the UNIFIED single source of truth for the Athlete Blueprint.
//
// Collected ONCE and held globally: sport, position, age, sex, level, body metrics
// (for TDEE) and dietary profile, plus the derived progression tier. Seeded from the
// authenticated sportsProfile + the sport/position pre-sets (athleteBlueprint.js),
// overridable by the athlete, and persisted per-uid to localStorage so the intake is
// never re-collected. The three engines all read from this object.
//
// current_tier is the Progression Engine's spine (athlete_profiles.current_tier,
// promoted by bbf-progression-calculator). The persisted row is service-role-only
// under RLS, so until a vault-token GET path exists it derives from age (Blueprint §2
// bands); `setCurrentTier` lets a future fetch / live promotion override it.

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import { presetsForAthlete, levelForTier } from '../lib/athleteBlueprint.js';

const STORAGE_KEY = 'bbf.athlete.profile.v1';
const TIER_ORDER = ['youth', 'middle_school', 'high_school', 'collegiate'];

// Age → tier (Blueprint §2: Youth 6–11 · Middle School 12–14 · High School 15–18 ·
// Collegiate 18+). Unknown age → high_school (the modal youth athlete).
function tierForAge(age) {
  const a = Number(age);
  if (!Number.isFinite(a)) return 'high_school';
  if (a < 12) return 'youth';
  if (a < 15) return 'middle_school';
  if (a < 18) return 'high_school';
  return 'collegiate';
}

function readStored(uid) {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return (uid && all[uid]) ? all[uid] : {};
  } catch { return {}; }
}
function writeStored(uid, overrides) {
  if (!uid) return;
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    all[uid] = overrides;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch { /* private mode / quota — in-memory only */ }
}

const AthleteProfileContext = createContext({
  profile: {}, currentTier: 'high_school', setProfileField: () => {}, setIntakeSport: () => {}, setCurrentTier: () => {}, resetProfile: () => {},
});

export function AthleteProfileProvider({ children }) {
  const { user } = useAuth();
  const sp = user?.sportsProfile || {};
  const uid = user?.username || user?.id || '';

  // Editable overrides (the athlete's calibrations + any tier override), persisted.
  const [overrides, setOverrides] = useState(() => readStored(uid));

  const setProfileField = useCallback((key, value) => {
    setOverrides((o) => {
      const next = { ...o, [key]: value };
      writeStored(uid, next);
      return next;
    });
  }, [uid]);

  // The intake selection is the AUTHORITATIVE sport/position (chosen in YouthIntake,
  // persisted to bbf_users + athlete_profiles). SportsHub syncs it here so the unified
  // profile — and every engine that reads it — reflects the athlete's CURRENT sport,
  // never a stale login sports_protocol blob or the hardcoded roster seed. Guarded:
  // returns the SAME overrides object when unchanged, so the sync effect can't loop.
  const setIntakeSport = useCallback((sportId, positionCode) => {
    if (!sportId) return;
    setOverrides((o) => {
      const nextPos = positionCode ?? o.positionCode ?? null;
      if (o.sportId === sportId && o.positionCode === nextPos) return o; // no-op
      const next = { ...o, sportId, positionCode: nextPos };
      writeStored(uid, next);
      return next;
    });
  }, [uid]);

  const setCurrentTier = useCallback((tier) => {
    if (!TIER_ORDER.includes(tier)) return;
    setProfileField('currentTier', tier);
  }, [setProfileField]);

  const resetProfile = useCallback(() => {
    writeStored(uid, {});
    setOverrides({});
  }, [uid]);

  const currentTier = (overrides.currentTier && TIER_ORDER.includes(overrides.currentTier))
    ? overrides.currentTier
    : tierForAge(sp.age);

  // Authoritative sport/position: a synced intake selection (overrides) wins over the
  // auth seed, so the unified profile follows the athlete's CURRENT discipline rather
  // than the login seed. The weight-room/nutrition pre-sets (goal/arch) follow THIS
  // sport, so switching sport in intake cleanly re-presets the engines.
  const effSportId = overrides.sportId || sp.sportId || 'football';
  const effPositionCode = overrides.positionCode || sp.positionCode || 'OL';

  // Base profile — auth-derived identity + sport/position pre-set defaults.
  const base = useMemo(() => {
    const preset = presetsForAthlete({ sportId: effSportId, positionCode: effPositionCode });
    return {
      sportId: effSportId,
      positionCode: effPositionCode,
      age: sp.age ?? 15,
      sex: 'male',
      heightFt: 5,
      heightIn: 9,
      weightLb: 150,
      level: levelForTier(currentTier),
      goal: preset.goal,
      arch: preset.arch,
      dietary: 'Omnivore',
    };
  }, [effSportId, effPositionCode, sp.age, currentTier]);

  // The merged, single-source-of-truth profile (overrides win over pre-set defaults).
  const profile = useMemo(() => ({ ...base, ...overrides, currentTier }), [base, overrides, currentTier]);

  const value = useMemo(() => ({
    profile,
    currentTier,
    sport: profile.sportId,
    position: profile.positionCode,
    age: profile.age,
    setProfileField,
    setIntakeSport,
    setCurrentTier,
    resetProfile,
  }), [profile, currentTier, setProfileField, setIntakeSport, setCurrentTier, resetProfile]);

  return <AthleteProfileContext.Provider value={value}>{children}</AthleteProfileContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAthleteProfile() {
  return useContext(AthleteProfileContext);
}

export default AthleteProfileContext;
