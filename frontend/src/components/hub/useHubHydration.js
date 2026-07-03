// src/components/hub/useHubHydration.js
// ─────────────────────────────────────────────────────────────────────────────
// Phase 3.1 — the Day-1 Hub data hook (Onboarding State Machine blueprint §2.2).
//
// ONE read on first login: bbf_hub_hydration returns an atomic snapshot of the
// four surfaces the Hub paints (nutrition · cardio · prehab · audio brief) plus
// the profile summary, onboarding pipeline state, and the config-backed Layer-2
// defaults. The cold-start orchestrator has already seeded those rows before the
// athlete's credentials were dispatched (§0.3), so a first login never races an
// empty database.
//
// FAST vs DEGRADED — handled SEAMLESSLY, no UI branch here:
//   • Fast path   → every card slice is populated. Cards paint live data.
//   • Degraded    → some slices are null (pipeline_state === 'cold_start_degraded').
//     The call still SUCCEEDS and carries `defaults`; each card renders its
//     config baseline + a Calibrating chip (§3.3). The hook does not distinguish
//     the two — it returns the snapshot and lets the cards degrade per-slice.
//
// FAIL-SOFT (mirrors sessionGuard.js): a transport error never throws into the
// tree and never blanks the Hub. `hydration` stays null and the cards fall back
// to the client-side LAYER2_DEFAULTS — the "No Empty Dashboards" floor holds even
// with the RPC fully unreachable.
//
// AUTH: the athlete's server-revocable vault bearer token (getStoredVaultToken)
// binds the read to their session; the RPC authorizes on it and resolves identity.
//
// @typedef {Object} NutritionToday   // athlete_nutrition_targets_daily (grams integer)
// @property {'foundation'|'performance'|'sovereign'} tier
// @property {number} tdee_kcal @property {number} protein_g @property {number} carbs_g
// @property {number} fat_g @property {number|null} creatine_g @property {string} day_type
//
// @typedef {Object} CardioToday      // bbf_cardio_prescription (grams integer)
// @property {'HIIT'|'Tempo'|'Zone 2'} effective_tier @property {string} recovery_state
// @property {string|null} mech_state @property {number|null} hr_cap_bpm @property {number|null} rpe_cap
// @property {number|null} duration_min @property {string|null} work_rest_ratio
// @property {number|null} ee_kcal_est @property {number|null} sweat_loss_g_est @property {number|null} rehydration_g
// @property {string|null} interval_directive @property {string|null} recovery_note
//
// @typedef {Object} PrehabCard       // prehab_queue rollup
// @property {Array<{joint_zone:string,priority:string,risk_score:number}>} queued @property {number} count
//
// @typedef {Object} BriefPlaylist    // sovereign_brief_playlists summary
// @property {string} tone @property {number} total_duration_ms @property {string} status @property {number} fragment_count
//
// @typedef {Object} Hydration
// @property {boolean} ok @property {string} uid @property {string|null} profile_id @property {string} day
// @property {string|null} pipeline_state
// @property {NutritionToday|null} nutrition_today @property {CardioToday|null} cardio_today
// @property {PrehabCard} prehab_card @property {BriefPlaylist|null} brief_playlist
// @property {Object} profile @property {Object} intents
// @property {{nutrition:Object,cardio:Object}|null} defaults

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient.js';
import { useAuth, getStoredVaultToken } from '../../context/AuthContext.jsx';

/**
 * Pure fetch → resolved view-model. Performs NO setState of its own (so the mount
 * effect can await it and set state only in the deferred continuation), and never
 * throws into the tree — a transport failure resolves to a fail-soft snapshot.
 * @param {string} uid
 * @returns {Promise<{ loading: false, error: string|null, hydration: Hydration|null }>}
 */
async function fetchHydration(uid) {
  const token = getStoredVaultToken();
  // No identity yet → not an error; the shell's route guard owns sign-in. Resolve
  // to a non-loading empty snapshot so the Hub paints Layer-2 baselines, not a spinner.
  if (!uid || !token) return { loading: false, error: null, hydration: null };

  const { data, error } = await supabase.rpc('bbf_hub_hydration', {
    p_uid: String(uid).trim().toLowerCase(),
    p_session_token: token,
  });

  // FAIL-SOFT: transport / not-yet-deployed → never blank the Hub. Cards fall
  // back to the client LAYER2_DEFAULTS; we surface a soft error for telemetry.
  if (error) return { loading: false, error: 'hub_unreachable', hydration: null };
  // Explicit server rejection (revoked token, locked account).
  if (!data || data.ok === false) return { loading: false, error: (data && data.error) || 'hydration_failed', hydration: null };
  // Success — fast OR degraded; the cards read per-slice from here.
  return { loading: false, error: null, hydration: data };
}

/**
 * @returns {{ loading: boolean, error: string|null, hydration: Hydration|null, reload: () => Promise<void> }}
 */
export function useHubHydration() {
  const { user } = useAuth();
  const uid = user?.username || user?.id || '';
  const [state, setState] = useState({ loading: true, error: null, hydration: null });
  const alive = useRef(true);

  // Explicit user-driven refresh (a real event, not an effect): flip to loading,
  // then apply the resolved snapshot.
  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    const next = await fetchHydration(uid);
    if (alive.current) setState(next);
  }, [uid]);

  // Mount / identity-change fetch. The effect body performs NO synchronous
  // setState — it awaits the pure fetch and applies the result in the deferred
  // continuation, so it can never trigger a cascading render.
  useEffect(() => {
    alive.current = true;
    fetchHydration(uid).then((next) => { if (alive.current) setState(next); });
    return () => { alive.current = false; };
  }, [uid]);

  return { ...state, reload };
}
