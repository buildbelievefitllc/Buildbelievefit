// src/lib/vaultApi.js
// ─────────────────────────────────────────────────────────────────────────────
// Phase 18 — Client Vault data layer (the athlete's OWN interior).
//
// Distinct from telemetryApi (the admin Panopticon, which reads the WHOLE
// roster) and rosterApi (token-gated service-role admin reads). This module
// serves a single, already-authenticated client looking at their own surface.
//
// Two data sources feed the Vault, both ultimately Supabase:
//
//   1. PROFILE METRICS — a LIVE network read via the SECURITY DEFINER RPC
//      `bbf_get_profile_metrics(target_uid text)` (migrations/2026-05-13_…).
//      It is GRANTed to anon, accepts the login slug (== session username),
//      and returns server-authoritative session counters + a 30-day heatmap.
//      This is the genuine useEffect fetch the Vault fires on landing.
//
//   2. TRAINING PROTOCOL + MEAL PLAN — delivered by Supabase at sign-in:
//      `bbf_verify_user_pin` returns plans_available → { workout_plan,
//      meal_plan, plans_generated_at }, which AuthContext persists on
//      session.plans. There is no anon-safe single-row plan SELECT (RLS
//      blocks direct bbf_users reads), so the auth envelope IS the protocol
//      source of record at runtime. `selectPlans()` normalizes it.
//
// State contract mirrors the Command Center surfaces: { data, isLoading,
// error } — no silent failures, no infinite spinners.

import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient.js';

// Live read: profile metrics for one client by their login slug (uid).
// Resolves to a normalized envelope; never throws on "user not found" (the RPC
// returns a zeroed, ok:false envelope for brand-new accounts — that's an empty
// state, not an error). Only a transport/RLS failure rejects.
export async function fetchProfileMetrics(uid) {
  const slug = String(uid || '').trim().toLowerCase();
  if (!slug) throw new Error('Missing user id — cannot load profile.');

  const { data, error } = await supabase.rpc('bbf_get_profile_metrics', {
    target_uid: slug,
  });
  if (error) {
    throw new Error(`Profile load failed — ${error.message || 'metrics RPC error'}.`);
  }

  const ok = data && data.ok === true;
  return {
    found: !!ok,
    totalSessions: Number(data?.total_sessions ?? 0),
    currentStreak: Number(data?.current_streak ?? 0),
    bestStreak: Number(data?.best_streak ?? 0),
    thisWeek: Number(data?.this_week ?? 0),
    thisMonth: Number(data?.this_month ?? 0),
    avgPerWeek: Number(data?.avg_per_week ?? 0),
    heatmap: Array.isArray(data?.heatmap) ? data.heatmap : [],
  };
}

// React hook: fetch-on-land for the authenticated client's profile metrics.
// State is SEEDED from uid presence (the session — and therefore uid — is known
// synchronously at mount, rehydrated from localStorage with loading:false), so
// the effect performs only async work and mutates state exclusively inside the
// promise callbacks. That keeps it clear of react-hooks/set-state-in-effect (no
// synchronous setState in the effect body) and avoids a loading flash.
export function useVaultProfile(uid) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(Boolean(uid));
  const [error, setError] = useState(
    uid ? null : 'No authenticated user — sign in to load your Vault.'
  );

  useEffect(() => {
    if (!uid) return undefined;
    let cancelled = false;

    fetchProfileMetrics(uid)
      .then((res) => { if (!cancelled) { setData(res); setError(null); } })
      .catch((e) => { if (!cancelled) setError(e.message || 'Failed to load profile.'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [uid]);

  return { data, isLoading, error };
}

// Pure: normalize the auth session's plan envelope into the shape the Program /
// Nutrition surfaces render. Tolerates a missing envelope (no plans generated
// yet) by returning empty strings the components treat as an empty state.
export function selectPlans(session) {
  const plans = session?.plans || null;
  return {
    workoutPlan: (plans?.workout_plan || '').trim(),
    mealPlan: (plans?.meal_plan || '').trim(),
    generatedAt: plans?.plans_generated_at || null,
  };
}
