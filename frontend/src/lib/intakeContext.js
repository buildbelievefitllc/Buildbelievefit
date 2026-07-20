// src/lib/intakeContext.js
// ─────────────────────────────────────────────────────────────────────────────
// Intake context resolver — bridges the normalized Sovereign Intake ledger
// (public.bbf_intake_profile, written by the reconciliation trigger) into the
// workout generation engine. Reads the SIGNED-IN athlete's own row via RLS
// (policy bbf_intake_profile_self_read: auth.uid() = user_id), so it returns data
// only for a GoTrue-authenticated user and null otherwise — callers seed defaults
// gracefully when null (no intake → engine behaves exactly as before).

import { supabase } from './supabaseClient.js';

// Wizard focus → engine training-priority (generatorEngine GOALS).
const FOCUS_TO_GOAL = {
  lean_muscle: 'hypertrophy',
  recomp: 'hypertrophy',
  strength: 'strength',
  fat_loss: 'endurance',
  mobility: 'general',
  general: 'general',
};

// Wizard weekly_days ('2'..'5' | '6plus') → engine DAY_OPTIONS ('2'..'6').
function mapDays(weekly) {
  if (!weekly) return null;
  if (weekly === '6plus') return '6';
  const n = String(weekly).replace(/[^0-9]/g, '');
  return ['2', '3', '4', '5', '6'].includes(n) ? n : null;
}

// Resolve the current athlete's normalized intake, mapped to engine inputs.
// Returns { goal, days, injuries[], heightCm, weightKg, targetWeightKg } or null.
export async function fetchIntakeContext() {
  let res;
  try {
    res = await supabase
      .from('bbf_intake_profile')
      .select('goal, weekly_days, injuries, height_cm, weight_kg, target_weight_kg')
      .maybeSingle();
  } catch {
    return null;
  }
  const row = res && res.data;
  if (!row) return null;

  const injuries = Array.isArray(row.injuries) ? row.injuries.filter((i) => i && i !== 'none') : [];
  return {
    goal: FOCUS_TO_GOAL[row.goal] || null,
    days: mapDays(row.weekly_days),
    injuries,
    heightCm: row.height_cm != null ? Number(row.height_cm) : null,
    weightKg: row.weight_kg != null ? Number(row.weight_kg) : null,
    targetWeightKg: row.target_weight_kg != null ? Number(row.target_weight_kg) : null,
  };
}
