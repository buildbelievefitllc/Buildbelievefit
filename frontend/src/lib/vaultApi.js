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
    // Dynamic nutrition targets (Phase 21.3) — nullable; the UI treats null as
    // "not set by the coach yet" and never substitutes a hardcoded default.
    metabolicTier: data?.metabolic_tier ?? null,
    fastingHours: data?.fasting_hours ?? null,
    tdeeTarget: data?.tdee_target ?? null,
    macroP: data?.macro_p ?? null,
    macroC: data?.macro_c ?? null,
    macroF: data?.macro_f ?? null,
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

// ── AI plan payload parsers ──────────────────────────────────────────────────
// The Render /process engine writes the assigned plans as STRUCTURED JSON (not
// markdown): workout_plan is an array of day objects, meal_plan is an object with
// a calorie target + day/meal breakdown. These parsers turn that payload into the
// shapes the UI renders — and fall back gracefully for legacy plain-text plans so
// raw JSON is never dumped on screen.

// "~2,450 cal/day" / "3100 kcal" → 2450 / 3100 (first 3–5 digit run).
function parseCalories(s) {
  const m = String(s ?? '').replace(/,/g, '').match(/(\d{3,5})/);
  return m ? parseInt(m[1], 10) : null;
}

// Sum "(~520 cal / 38g P / 42g C / 18g F)" annotations across one day's meals to
// derive daily macro targets when the structured macro columns aren't set.
function sumDayMacros(day) {
  if (!day || !Array.isArray(day.meals) || !day.meals.length) return null;
  let p = 0; let c = 0; let f = 0; let hit = false;
  day.meals.forEach((meal) => {
    const s = meal.i || '';
    const mp = s.match(/(\d+)\s*g\s*P/i);
    const mc = s.match(/(\d+)\s*g\s*C/i);
    const mf = s.match(/(\d+)\s*g\s*F/i);
    if (mp) { p += parseInt(mp[1], 10); hit = true; }
    if (mc) { c += parseInt(mc[1], 10); hit = true; }
    if (mf) { f += parseInt(mf[1], 10); hit = true; }
  });
  return hit ? { p, c, f } : null;
}

// Normalize a meal-plan object (DB JSON or the MP seed catalog) to the render
// shape, or null when it isn't a structured plan. Per-meal `instructions` (the
// auto-generated prep steps) are carried through when present so the Nutrition
// tab can render them — older plans simply omit the field and fall back cleanly.
function normalizeMeal(obj) {
  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.days)) return null;
  const days = obj.days.map((d) => ({
    day: d.day || '',
    meals: Array.isArray(d.meals) ? d.meals.map((m) => ({
      m: m.m || '',
      i: m.i || '',
      ...(m.instructions != null ? { instructions: m.instructions } : {}),
    })) : [],
  }));
  return {
    structured: true,
    cal: parseCalories(obj.cal),
    goal: obj.goal || null,
    days,
    macros: sumDayMacros(days[0]),
  };
}

// Parse meal_plan → { structured, cal, goal, days:[{day,meals:[{m,i}]}], macros, text }.
// structured:false (with raw text preserved) for legacy/plain-text plans.
export function parseMealPlan(raw) {
  const text = (raw || '').trim();
  const empty = { structured: false, cal: null, goal: null, days: [], macros: null, text };
  if (!text) return empty;
  let obj;
  try { obj = JSON.parse(text); } catch { return empty; }
  const norm = normalizeMeal(obj);
  return norm ? { ...norm, text } : empty;
}

// Normalize an already-parsed meal-plan object (the authorized MP seed catalog)
// to the same shape parseMealPlan returns — used as the per-persona fallback when
// the database has no generated meal_plan for the user.
export function mealPlanFromSeed(obj) {
  const norm = normalizeMeal(obj);
  return norm ? { ...norm, text: '' } : { structured: false, cal: null, goal: null, days: [], macros: null, text: '' };
}

// Resolve the fasting window from the metabolic tier ("12:12 Foundation",
// "16:8", …) or an explicit somatic_fasting_hours. Returns { fast, eat } hours or
// null — never a hardcoded 16/8.
export function parseFastingWindow(metabolicTier, fastingHours) {
  const fh = Number(fastingHours);
  if (Number.isFinite(fh) && fh > 0 && fh < 24) return { fast: fh, eat: 24 - fh };
  const m = String(metabolicTier || '').match(/(\d{1,2})\s*:\s*(\d{1,2})/);
  if (!m) return null;
  const fast = parseInt(m[1], 10);
  const eat = parseInt(m[2], 10);
  if (eat <= 0 || fast <= 0 || fast + eat !== 24) return null;
  return { fast, eat };
}

// Parse workout_plan → the ProgramGrid day array
// [{ day, focus, exercises:[{ name, equipment, sets, reps, notes }] }], or null
// for legacy/text plans (caller then falls back to the static catalog).
export function parseWorkoutPlan(raw) {
  const text = (raw || '').trim();
  if (!text) return null;
  let arr;
  try { arr = JSON.parse(text); } catch { return null; }
  if (!Array.isArray(arr) || !arr.length) return null;
  const valid = arr.every((d) => d && typeof d === 'object' && (d.exercises === undefined || Array.isArray(d.exercises)));
  return valid ? arr : null;
}
