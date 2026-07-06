// src/lib/useNutritionSync.js
// ─────────────────────────────────────────────────────────────────────────────
// The Nutrition tab's server-sync hook. ONE read on mount (bbf_nutrition_today):
//   • targets       — today's canonical athlete_nutrition_targets_daily row (incl
//                     Tier-3 timing_plan), the SAME source the Hub NutritionCard reads.
//   • loggedKeys    — Set of client_meal_keys already logged today, so the wheel
//                     rehydrates its checked cards from the SERVER (survives reload,
//                     crosses devices) — not just localStorage.
//   • weekAdherence — 7-day kcal-adherence strip for the Performance trend.
//
// FAIL-SOFT (mirrors useHubHydration): a transport error never throws into the tree;
// targets stays null and the tab falls back to its meal-plan totals. reload() lets a
// tap-to-log optimistically reconcile against the server after the write commits.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { fetchNutritionToday } from './mealLogApi.js';

export function useNutritionSync() {
  const { user } = useAuth();
  const uid = user?.username || user?.id || '';
  const [state, setState] = useState({ loading: true, targets: null, loggedKeys: new Set(), weekAdherence: [] });
  const alive = useRef(true);

  const apply = useCallback((snap) => {
    if (!alive.current) return;
    setState({
      loading: false,
      targets: snap.targets,
      loggedKeys: new Set(snap.intakeKeys || []),
      weekAdherence: snap.weekAdherence || [],
    });
  }, []);

  const reload = useCallback(async () => {
    const snap = await fetchNutritionToday(uid);
    apply(snap);
  }, [uid, apply]);

  useEffect(() => {
    alive.current = true;
    fetchNutritionToday(uid).then(apply);
    return () => { alive.current = false; };
  }, [uid, apply]);

  return { ...state, reload };
}
