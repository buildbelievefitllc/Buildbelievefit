// src/lib/bodyweightApi.js
// ─────────────────────────────────────────────────────────────────────────────
// Sovereign Vault · Bodyweight Tracker data layer (adult self-write).
//
// Same non-throwing, vault-token → SECURITY DEFINER RPC pattern as biometricsApi
// / languageLabApi: the browser holds only the anon key; identity is resolved
// server-side from the vault token. No edge function.
//
//   bbf_get_bodyweight     — one-read hydration (current/start/goal + series + due)
//   bbf_log_bodyweight     — upsert a weigh-in (grams) → returns the fresh envelope
//   bbf_set_weight_goal    — set/clear the numeric goal → returns the fresh envelope
//
// THE GRAM STANDARD: mass crosses the wire ONLY as integer grams. lb/kg is a
// display/entry concern — converted here at the boundary with the project's
// canonical multipliers (lb→g round(lb·453.59237); kg→g round(kg·1000)).

import { supabase } from './supabaseClient.js';
import { getStoredVaultToken } from '../context/AuthContext.jsx';

// Gentle weigh-in cadence — WEEKLY, deliberately never daily (day-to-day
// fluctuation is noise that discourages; a weekly reading is the real signal).
export const WEIGH_IN_CADENCE_DAYS = 7;

// Sane adult-bodyweight bounds mirrored from the RPC (grams). The UI validates
// against these before the round-trip so a fat-finger never even leaves the tab.
export const MIN_BODY_MASS_G = 20000;   // ≈20 kg / 44 lb
export const MAX_BODY_MASS_G = 400000;  // ≈400 kg / 882 lb

const LB_PER_G = 1 / 453.59237;
export const lbToG = (lb) => Math.round(Number(lb) * 453.59237);
export const kgToG = (kg) => Math.round(Number(kg) * 1000);
export const gToLb = (g) => Number(g) * LB_PER_G;
export const gToKg = (g) => Number(g) / 1000;

// Grams → the chosen display unit, rounded to 1 decimal (a clean scale reading).
export function gToUnit(g, unit) {
  if (g == null || !Number.isFinite(Number(g))) return null;
  return Math.round((unit === 'kg' ? gToKg(g) : gToLb(g)) * 10) / 10;
}
export function unitToG(value, unit) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return unit === 'kg' ? kgToG(n) : lbToG(n);
}

async function rpc(fn, args = {}) {
  const token = getStoredVaultToken();
  if (!token) return { ok: false, error: 'no_session' };
  try {
    const { data, error } = await supabase.rpc(fn, { p_session_token: token, ...args });
    if (error) return { ok: false, error: error.message || 'network' };
    return data || { ok: false, error: 'unknown' };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}

export function getBodyweight() {
  return rpc('bbf_get_bodyweight');
}

// grams (integer), optional measured_on 'YYYY-MM-DD' (server defaults to today UTC).
export function logBodyweight(grams, measuredOn = null) {
  return rpc('bbf_log_bodyweight', {
    p_body_mass_g: grams,
    ...(measuredOn ? { p_measured_on: measuredOn } : {}),
  });
}

// grams (integer) to set a goal, or null to clear it.
export function setWeightGoal(grams) {
  return rpc('bbf_set_weight_goal', { p_goal_body_mass_g: grams });
}

// Is a weigh-in due? True when there's no reading yet OR the 7-day window has
// elapsed. Pure date-string comparison (ISO dates sort lexically).
export function isWeighInDue(envelope) {
  if (!envelope || envelope.ok === false) return false;
  if (!envelope.next_due_on) return true; // never logged → the first weigh-in is "due"
  const today = new Date().toISOString().slice(0, 10);
  return today >= envelope.next_due_on;
}
