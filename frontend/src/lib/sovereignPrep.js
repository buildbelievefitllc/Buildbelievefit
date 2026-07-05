// src/lib/sovereignPrep.js
// ─────────────────────────────────────────────────────────────────────────────
// Sovereign Prep — client logic for the 3-Phase pre-session protocol.
//
// Two responsibilities:
//   1) Derive the recovery library's 11-group muscle taxonomy from the athlete's
//      authorized program (free-text focus + exercise names → canonical groups).
//   2) Resolve T-Zero (today) and T-minus-1 (yesterday) muscle loads from the
//      asynchronous routine QUEUE, then call the bbf-agentic-recovery edge fn.
//
// QUEUE MODEL (faithful to VaultHeader / the CEO async-queue order): the backend
// rotates the plan at local midnight and the frontend renders index 0 as TODAY.
// A pop-head→push-tail rotation means the item that headed the queue YESTERDAY is
// the current tail. So:  today = plan[0],  yesterday = plan[last].  No new Date(),
// no weekday math — same discipline as the Active Directive card. A rest day on
// either end resolves to an empty group list (nothing to emphasize) — the edge fn
// still returns the full-body baseline.
//
// The muscle taxonomy is the recovery library's 11 groups:
//   calves · quads · hamstrings · hip_adductors · hip_abductors · shoulders ·
//   chest · neck · upper_back · lower_back · groin
// Mapping is deterministic and best-effort: it only drives the emphasis_flag (a UI
// weighting), never safety — so an unmatched movement simply isn't emphasized.

import { supabase } from './supabaseClient.js';
import { getStoredVaultToken } from '../context/AuthContext.jsx';

// Whole-leg shorthand → the lower-body groups a generic "leg day" loads.
const LEG_GROUPS = ['quads', 'hamstrings', 'calves', 'hip_abductors', 'hip_adductors'];

// Ordered keyword → canonical-group rules. Scanned against the lowercased focus
// string AND every exercise name. More specific patterns precede generic ones so
// e.g. "back extension" lands on lower_back, not the upper_back pull bucket.
const MUSCLE_RULES = [
  // ── Lower body ──
  { re: /\bcalf|calves|heel raise|toe raise/, groups: ['calves'] },
  { re: /\b(leg|hamstring|lying|seated)\s+curl|hamstring|\bham\b|\bhams\b/, groups: ['hamstrings'] },
  { re: /deadlift|\brdl\b|romanian|pull[\s-]?through|good[\s-]?morning/, groups: ['hamstrings', 'lower_back', 'hip_abductors'] },
  { re: /back ext|hyperextension|hip extension|reverse kickback|kickback/, groups: ['hip_abductors', 'hamstrings', 'lower_back'] },
  { re: /glute|hip thrust|booty|bridge/, groups: ['hip_abductors', 'hamstrings'] },
  { re: /abduct|glute med|lateral.*walk|it band/, groups: ['hip_abductors'] },
  { re: /adduct|inner thigh|cossack|sumo/, groups: ['hip_adductors', 'groin'] },
  { re: /groin/, groups: ['groin'] },
  { re: /squat|leg press|leg extension|\bhack\b|goblet|lunge|step[\s-]?up|quad/, groups: ['quads', 'hamstrings'] },
  { re: /full leg|leg day|lower body|\blegs\b/, groups: LEG_GROUPS },
  // ── Upper body ──
  { re: /chest|bench|\bpec\b|\bpecs\b|\bfly\b|flye|push[\s-]?up|incline|decline/, groups: ['chest', 'shoulders'] },
  { re: /shoulder|overhead press|military|\bohp\b|lateral raise|\bdelt|arnold|upright row|shrug|face pull/, groups: ['shoulders'] },
  { re: /tricep|\bdip\b/, groups: ['shoulders'] },
  { re: /\b(bicep|biceps|hammer|preacher|concentration)\b.*curl|bicep/, groups: ['upper_back'] },
  { re: /lat pulldown|pulldown|pull[\s-]?up|chin[\s-]?up|\brow\b|rows|\blat\b|lats|rear delt|reverse fly/, groups: ['upper_back', 'shoulders'] },
  { re: /thoracic|\btrap\b|traps|rhomboid|upper back/, groups: ['upper_back'] },
  { re: /lower back|lumbar|erector|\bql\b/, groups: ['lower_back'] },
  { re: /\bneck\b/, groups: ['neck'] },
  // ── Push / Pull split shorthands (focus headlines) ──
  { re: /\bpush\b/, groups: ['chest', 'shoulders'] },
  // ── Core / trunk → lower_back recovery bucket ──
  { re: /\bcore\b|\babs\b|abdominal|\bplank|crunch|oblique|russian twist|knee raise|bird[\s-]?dog|heel tap|hollow|sit[\s-]?up/, groups: ['lower_back'] },
];

// Scan one text blob, accumulating matched canonical groups into `set`.
function scanInto(set, text) {
  const s = String(text || '').toLowerCase();
  if (!s) return;
  for (const rule of MUSCLE_RULES) {
    if (rule.re.test(s)) for (const g of rule.groups) set.add(g);
  }
}

// Derive the canonical muscle groups a single directive (queue item) loads.
// Rest days (isRest or no exercises) → []. Scans the focus headline + focus_cue +
// every exercise name so a thin focus string is still covered by its movements.
export function deriveMuscleGroups(directive) {
  if (!directive || directive.isRest) return [];
  const set = new Set();
  scanInto(set, directive.focus);
  scanInto(set, directive.focus_cue);
  if (Array.isArray(directive.exercises)) {
    for (const ex of directive.exercises) scanInto(set, ex && ex.name);
  }
  return Array.from(set);
}

// Resolve { today, yesterday } group lists from the rotated plan queue.
// today = head (plan[0]); yesterday = tail (plan[last]) per the pop→push rotation.
export function resolvePrepLoads(plan) {
  if (!Array.isArray(plan) || !plan.length) return { today: [], yesterday: [] };
  const today = deriveMuscleGroups(plan[0]);
  const yesterday = plan.length > 1 ? deriveMuscleGroups(plan[plan.length - 1]) : [];
  return { today, yesterday };
}

// ── SYMPTOM ALIGNMENT (architectural reconciliation) ────────────────────────────
// The reported Post-Workout Check-In target_area → the prep muscle-group buckets
// the recovery engine speaks, so a joint flagged yesterday is PRIORITIZED in
// today's Sovereign Prep alongside the programmed workout.
export const SYMPTOM_PREP_GROUPS = {
  shoulder: ['shoulders'],
  upper_body: ['shoulders', 'upper_back', 'chest'],
  neck: ['neck'],
  knee: ['quads', 'calves'],
  lower_body: ['quads', 'hamstrings', 'hip_abductors'],
  full_body: [], // whole-body session, no joint complaint → plan-derived loads only
};

// Merge the athlete's logged symptom into the plan-derived loads: the flagged
// joint's groups lead yesterday's list (highest prep priority), deduped against
// what the plan already contributed. No symptom → loads pass through untouched.
export function mergePrepLoads(loads, targetArea) {
  const symptom = SYMPTOM_PREP_GROUPS[String(targetArea || '').trim().toLowerCase()] || [];
  if (!symptom.length) return loads;
  return {
    today: loads?.today || [],
    yesterday: Array.from(new Set([...symptom, ...(loads?.yesterday || [])])),
  };
}

// Map an edge-gate slug / HTTP status to a clean, on-brand message.
function gateMessage(slug, status) {
  const map = {
    missing_session: 'Your session expired — sign in again to generate your prep.',
    invalid_session: 'Your session expired — sign in again to generate your prep.',
    account_locked: 'This account is locked. Contact your coach.',
    entitlement_check_unavailable: 'Recovery engine is warming up — try again in a moment.',
  };
  return map[slug] || (status === 401
    ? 'Your session expired — sign in again to generate your prep.'
    : 'Recovery engine unavailable — try again in a moment.');
}

// Call bbf-agentic-recovery. Identity is server-resolved from the vault token; we
// pass uid/groups only. The library lives embedded in the edge fn (no 30KB ship).
// Returns the verified envelope { recovery_stretches, prep_drills, foam_rolling,
// meta } or throws a display-ready Error.
export async function generateSovereignPrep({ uid, today = [], yesterday = [] }) {
  const { data, error } = await supabase.functions.invoke('bbf-agentic-recovery', {
    body: {
      user_id: uid || '',
      today_muscle_groups: today,
      yesterday_muscle_groups: yesterday,
      vault_token: getStoredVaultToken(),
    },
  });

  if (error) {
    const status = error?.context?.status;
    let slug = '';
    try { slug = (await error.context.clone().json())?.error || ''; } catch { /* non-JSON */ }
    throw new Error(gateMessage(slug, status));
  }
  if (!data || !Array.isArray(data.recovery_stretches)) {
    const slug = data?.error || '';
    if (slug) throw new Error(gateMessage(slug, data?.status));
    throw new Error('Could not generate your prep. Try again.');
  }
  return data;
}
