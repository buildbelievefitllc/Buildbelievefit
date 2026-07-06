// src/lib/mealLogApi.js
// ─────────────────────────────────────────────────────────────────────────────
// Nutrition adherence loop — client for the meal-log WRITE (bbf-meal-log) and the
// today READ (bbf_nutrition_today RPC).
//
// WRITE: syncMealLog posts a tap-to-log wheel action. Identity is resolved
// SERVER-SIDE from the vault_token (nutrition_intake_log is RLS service-role only,
// and the browser never holds the profile UUID) — same pattern as sessionFeedbackApi.
// A stable client_meal_key makes log/unlog idempotent so the optimistic wheel and
// the server never diverge on a re-tap.
//
// READ: fetchNutritionToday returns today's CANONICAL targets (the same
// athlete_nutrition_targets_daily row the Hub NutritionCard shows — one source of
// truth), the set of already-logged client_meal_keys (so checked cards rehydrate
// from the server across reloads / devices), and a 7-day kcal-adherence strip.

import { FUNCTIONS_BASE, SUPABASE_ANON_KEY, supabase } from './supabaseClient.js';
import { getStoredVaultToken } from '../context/AuthContext.jsx';

// ── WRITE — one tap-to-log wheel action (action: 'log' | 'unlog') ────────────
export async function syncMealLog({
  action, clientMealKey, mealSlot, foodLabel, servingG, proteinG, carbsG, fatG, day,
} = {}) {
  const vaultToken = getStoredVaultToken();
  if (!vaultToken) {
    const e = new Error('Your session expired — sign in again.');
    e.code = 'no_session';
    throw e;
  }

  const headers = { 'Content-Type': 'application/json' };
  // Gateway routing — without the anon key the request 401s at the edge.
  if (SUPABASE_ANON_KEY) {
    headers.apikey = SUPABASE_ANON_KEY;
    headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
  }

  const body = {
    vault_token: vaultToken,
    action: action === 'unlog' ? 'unlog' : 'log',
    client_meal_key: clientMealKey,
  };
  if (action !== 'unlog') {
    body.meal_slot = mealSlot;
    body.food_label = foodLabel;
    body.serving_g = servingG;
    body.protein_g = proteinG;
    body.carbs_g = carbsG;
    body.fat_g = fatG;
  }
  if (day) body.day = day;

  let res;
  try {
    res = await fetch(`${FUNCTIONS_BASE}/bbf-meal-log`, {
      method: 'POST', headers, body: JSON.stringify(body),
    });
  } catch (err) {
    const e = new Error('Network unreachable — your meal log could not be saved.');
    e.code = 'network';
    e.cause = err;
    throw e;
  }

  const raw = await res.text();
  let parsed = null;
  try { parsed = raw ? JSON.parse(raw) : null; } catch { /* non-JSON body */ }

  if (!res.ok || !parsed?.ok) {
    const slug = parsed?.error || parsed?.detail || raw || 'unknown_error';
    const e = new Error(`Meal log could not be saved (${slug}).`);
    e.code = res.status;
    e.slug = slug;
    throw e;
  }
  return { ok: true, action: parsed.action, clientMealKey: parsed.client_meal_key, day: parsed.day };
}

// ── READ — today's targets + already-logged keys + 7-day adherence strip ─────
export async function fetchNutritionToday(uid) {
  const token = getStoredVaultToken();
  // No identity yet → resolve to a non-loading empty snapshot (never throw into the
  // tree; the tab falls back to its plan totals).
  if (!uid || !token) return { targets: null, intakeKeys: [], weekAdherence: [] };

  const { data, error } = await supabase.rpc('bbf_nutrition_today', {
    p_uid: String(uid).trim().toLowerCase(),
    p_session_token: token,
  });

  // FAIL-SOFT: transport / not-deployed / rejection → empty snapshot (plan-totals fallback).
  if (error || !data || data.ok === false) return { targets: null, intakeKeys: [], weekAdherence: [] };

  const intakeKeys = Array.isArray(data.intake)
    ? data.intake.map((r) => r?.client_meal_key).filter(Boolean)
    : [];
  return {
    targets: data.targets || null,
    intakeKeys,
    weekAdherence: Array.isArray(data.week_adherence) ? data.week_adherence : [],
  };
}
