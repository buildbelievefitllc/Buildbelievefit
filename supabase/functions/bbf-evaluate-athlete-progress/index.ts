// supabase/functions/bbf-evaluate-athlete-progress/index.ts
// ═══════════════════════════════════════════════════════════════════════════
// THE AUTONOMOUS REFEREE — agentic phase-promotion loop. ZERO AI inference.
//
// Fired by the bbf_athlete_progression tripwire (pg_net → this webhook) whenever an
// athlete's telemetry is inserted/updated. It:
//   1. Validates the shared-secret header (the trigger is the only caller).
//   2. Resolves the athlete (progression.user_id → bbf_users.email → bbf_active_clients).
//   3. Reads the CURRENT sports_protocol → phase_number + progression_thresholds.
//   4. DETERMINISTICALLY checks the telemetry against those thresholds (completion,
//      minimum weeks, RPE ceiling, joint-friction ceiling, + guardian consent for minors).
//   5. If met and phase < 3 → regenerates the protocol at phase+1 via the NATIVE
//      buildSportsProtocol and UPDATEs bbf_active_clients.sports_protocol.
//
// LOOP-SAFE BY DESIGN: this writes ONLY to bbf_active_clients — never to
// bbf_athlete_progression — so it can never re-trigger the tripwire that called it.
//
// Deploy with verify_jwt:false (server-to-server pg_net call; auth is the shared secret).
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { buildSportsProtocol } from './sports-engine.ts';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// Deterministic gate: does the telemetry clear the CURRENT phase's thresholds?
// A missing/optional reading never blocks (only a present reading that breaches does).
function meetsThresholds(
  thresholds: Record<string, unknown> | null,
  tel: { protocol_completed?: boolean; mesocycle_week?: number | null; rpe_avg_last_3?: number | null; friction_avg_last_3?: number | null; guardian_consent?: boolean },
  isYouth: boolean,
): { ok: boolean; reason: string } {
  if (!thresholds) return { ok: false, reason: 'terminal_phase' }; // Phase 3 → coach-gated
  if (thresholds.require_protocol_completed === true && tel.protocol_completed !== true) return { ok: false, reason: 'protocol_incomplete' };
  const weeks = num(tel.mesocycle_week);
  if (thresholds.min_mesocycle_weeks != null && (weeks ?? 0) < (thresholds.min_mesocycle_weeks as number)) return { ok: false, reason: 'insufficient_weeks' };
  const rpe = num(tel.rpe_avg_last_3);
  if (thresholds.max_rpe_avg != null && rpe != null && rpe > (thresholds.max_rpe_avg as number)) return { ok: false, reason: 'rpe_too_high' };
  const friction = num(tel.friction_avg_last_3);
  if (thresholds.max_friction_avg != null && friction != null && friction > (thresholds.max_friction_avg as number)) return { ok: false, reason: 'joint_friction_flag' };
  // Youth safety: a minor is never auto-promoted without an active guardian consent.
  if (isYouth && tel.guardian_consent !== true) return { ok: false, reason: 'guardian_consent_required' };
  return { ok: true, reason: 'criteria_met' };
}

serve(async (req) => {
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SERVICE_KEY) return jsonResponse({ ok: false, error: 'config_missing' }, 503);

  // SUPABASE_URL / SERVICE_ROLE_KEY are auto-injected into every edge function. The
  // shared secret lives in a locked DB config table (bbf_app_config) — the deploy
  // toolset cannot set function env vars, so BOTH this function and the DB tripwire
  // read the secret from the DB. The trigger sends it as X-BBF-Evaluator-Secret.
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: cfg } = await supabase.from('bbf_app_config').select('value').eq('key', 'evaluator_secret').maybeSingle();
  const SECRET = (cfg?.value as string) || '';
  if (!SECRET) return jsonResponse({ ok: false, error: 'config_missing_secret' }, 503);
  if (req.headers.get('x-bbf-evaluator-secret') !== SECRET) return jsonResponse({ ok: false, error: 'unauthorized' }, 401);

  let payload: Record<string, unknown>;
  try { payload = await req.json(); } catch { return jsonResponse({ ok: false, error: 'invalid_json' }, 400); }

  const userId = String(payload.user_id || '').trim();
  if (!userId) return jsonResponse({ ok: false, error: 'missing_user_id' }, 400);

  const tel = {
    protocol_completed: payload.protocol_completed === true,
    mesocycle_week: num(payload.mesocycle_week),
    rpe_avg_last_3: num(payload.rpe_avg_last_3),
    friction_avg_last_3: num(payload.friction_avg_last_3),
    guardian_consent: payload.guardian_consent === true,
  };

  // Resolve the athlete: progression.user_id → bbf_users.email → bbf_active_clients.vault_email.
  const { data: userRow, error: userErr } = await supabase
    .from('bbf_users').select('email').eq('id', userId).is('deleted_at', null).maybeSingle();
  if (userErr || !userRow?.email) return jsonResponse({ ok: false, error: 'athlete_not_found' }, 404);

  const { data: acRow, error: acErr } = await supabase
    .from('bbf_active_clients').select('id, sports_protocol').eq('vault_email', userRow.email).maybeSingle();
  if (acErr || !acRow?.id) return jsonResponse({ ok: false, error: 'active_client_not_found' }, 404);
  if (!acRow.sports_protocol) return jsonResponse({ ok: true, promoted: false, reason: 'no_protocol_staged' });

  let protocol: Record<string, unknown>;
  try { protocol = typeof acRow.sports_protocol === 'string' ? JSON.parse(acRow.sports_protocol) : acRow.sports_protocol; }
  catch { return jsonResponse({ ok: true, promoted: false, reason: 'protocol_unparseable' }); }

  const currentPhase = clamp(Number(protocol.phase_number) || 1);
  const thresholds = (protocol.progression_thresholds as Record<string, unknown> | null) ?? null;
  const age = num(protocol.source_age);
  const isYouth = age != null && age >= 13 && age < 18;

  const verdict = meetsThresholds(thresholds, tel, isYouth);
  if (!verdict.ok) return jsonResponse({ ok: true, promoted: false, phase: currentPhase, reason: verdict.reason });
  if (currentPhase >= 3) return jsonResponse({ ok: true, promoted: false, phase: currentPhase, reason: 'already_peak' });

  // PROMOTE — regenerate natively at the next phase and persist to bbf_active_clients ONLY.
  const nextPhase = currentPhase + 1;
  const nextProtocol = buildSportsProtocol({
    sport: protocol.sport,
    age: age ?? undefined,
    experience: String(protocol.experience || 'intermediate'),
    goal: (protocol.source_goal as string) ?? null,
    targetPhase: nextPhase,
  });

  const { error: updErr } = await supabase
    .from('bbf_active_clients')
    .update({ sports_protocol: JSON.stringify(nextProtocol) })
    .eq('id', acRow.id);
  if (updErr) return jsonResponse({ ok: false, error: 'update_failed', detail: updErr.message }, 500);

  console.log(`[bbf-evaluate-athlete-progress] PROMOTED user=${userId} ${currentPhase} → ${nextPhase} (${verdict.reason})`);
  return jsonResponse({ ok: true, promoted: true, from_phase: currentPhase, to_phase: nextPhase });
});

function clamp(n: number): number { return n < 1 ? 1 : n > 3 ? 3 : n; }
