// src/context/AthleteProfileContext.jsx
// ─────────────────────────────────────────────────────────────────────────────
// ATHLETE PROFILE — the athlete's progression identity (current_tier + sport),
// the channel the Sports Hub reads to filter tier-appropriate drills.
//
// current_tier is the spine of the Progression Engine (athlete_profiles.current_tier,
// promoted youth → middle_school → high_school → collegiate by bbf-progression-
// calculator). The persisted row is service-role-only under RLS, so the client can't
// read it directly yet; until a vault-token GET path exists, we DERIVE the tier from
// the athlete's age (the blueprint's §2 age bands) off the authenticated profile.
// `setCurrentTier` lets a future profile fetch — or a live promotion — override it.

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useAuth } from './AuthContext.jsx';

const TIER_ORDER = ['youth', 'middle_school', 'high_school', 'collegiate'];

// Age → tier (Blueprint §2: Youth 6–11 · Middle School 12–14 · High School 15–18 ·
// Collegiate 18+). Unknown age falls back to high_school (the modal youth-athlete).
function tierForAge(age) {
  const a = Number(age);
  if (!Number.isFinite(a)) return 'high_school';
  if (a < 12) return 'youth';
  if (a < 15) return 'middle_school';
  if (a < 18) return 'high_school';
  return 'collegiate';
}

const AthleteProfileContext = createContext({
  currentTier: 'high_school',
  derivedTier: 'high_school',
  sport: null,
  position: null,
  age: null,
  setCurrentTier: () => {},
});

export function AthleteProfileProvider({ children }) {
  const { user } = useAuth();
  const sp = user?.sportsProfile || {};
  // Explicit override (future: hydrate from the persisted athlete_profiles row, or
  // bump live after a promotion). null → use the age-derived tier.
  const [override, setOverride] = useState(null);

  const setCurrentTier = useCallback((tier) => {
    setOverride(TIER_ORDER.includes(tier) ? tier : null);
  }, []);

  const value = useMemo(() => {
    const derived = tierForAge(sp.age);
    return {
      currentTier: override && TIER_ORDER.includes(override) ? override : derived,
      derivedTier: derived,
      sport: sp.sportId || null,
      position: sp.positionCode || null,
      age: sp.age ?? null,
      setCurrentTier,
    };
  }, [sp.age, sp.sportId, sp.positionCode, override, setCurrentTier]);

  return <AthleteProfileContext.Provider value={value}>{children}</AthleteProfileContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAthleteProfile() {
  return useContext(AthleteProfileContext);
}

export default AthleteProfileContext;
