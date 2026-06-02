// src/lib/useEntitlement.js
// ─────────────────────────────────────────────────────────────────────────────
// React binding for the Vault Upsell Funnel. Fetches the athlete's live
// subscription tier ONCE on landing (the same one-fetch-on-land discipline as
// useVaultProfile) via the anon-safe SECURITY DEFINER RPC `bbf_get_trial_state`
// — the very RPC the legacy monolith already calls for its trial gate, so NO new
// backend surface is introduced. It derives the access GROUP (entitlements.js) and
// exposes the pure helpers the Vault shell + /sports route consume.
//
// FAIL-OPEN (same doctrine as sessionGuard.js): while the RPC is in flight, or if
// it errors / isn't deployed / returns no row, we report God Mode so a paying
// athlete is NEVER padlocked out of paid features by a network blip. Only a
// definitive tier row locks anything. PostgREST returns a TABLE RPC as an array,
// so we require a non-empty array before trusting a tier — a `{}` / `[]` response
// (e.g. an E2E neutralizer) stays soft.

import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { upgradeTargetForPath } from './pricingMatrix.js';
import {
  resolveAccessGroup,
  canAccessTab,
  canAccessSports,
  TAB_UPGRADE_PATH,
  SPORTS_UPGRADE_PATH,
} from './entitlements.js';

export function useEntitlement() {
  const { user, isAdmin } = useAuth();
  const uid = user?.username || user?.id || '';

  // resolved:false ⇒ not yet known (soft / fail-open). Seeded soft so the first
  // paint never flashes a padlock; the RPC result overwrites it inside the effect.
  const [state, setState] = useState({ resolved: false, tier: null, trialActive: false });

  useEffect(() => {
    // Admins are God Mode regardless, and an empty uid can't be looked up — in both
    // cases we leave the soft initial state (→ fail-open) and skip the round-trip.
    if (!uid || isAdmin) return undefined;
    let cancelled = false;

    supabase
      .rpc('bbf_get_trial_state', { p_uid: String(uid).trim().toLowerCase() })
      .then(({ data, error }) => {
        if (cancelled || error) return; // transport / not-deployed → stay soft (fail-open)
        if (!Array.isArray(data) || data.length === 0) return; // no row → stay soft
        const row = data[0] || {};
        const exp = row.trial_expires_at ? new Date(row.trial_expires_at).getTime() : 0;
        setState({
          resolved: true,
          tier: row.subscription_tier ?? null,
          trialActive: Number.isFinite(exp) && exp > Date.now(),
        });
      })
      .catch(() => { /* network throw → stay soft (fail-open) */ });

    return () => { cancelled = true; };
  }, [uid, isAdmin]);

  // Soft until we have a definitive answer (admins resolve via the short-circuit).
  const soft = !state.resolved && !isAdmin;
  const group = resolveAccessGroup({
    tier: state.tier,
    isAdmin,
    trialActive: state.trialActive,
    soft,
  });

  return {
    tier: state.tier,
    group,
    trialActive: state.trialActive,
    isResolving: soft,
    canAccessTab: (tabId) => canAccessTab(group, tabId),
    canAccessSports: () => canAccessSports(group),
    // Upgrade CTA target (real Stripe link / pricing-matrix anchor) for a locked
    // tab or the sports route. Falls back to the fitness path for an unmapped tab.
    upgradeTargetForTab: (tabId) => upgradeTargetForPath(TAB_UPGRADE_PATH[tabId] || 'fitness'),
    upgradeTargetForSports: () => upgradeTargetForPath(SPORTS_UPGRADE_PATH),
  };
}
