// ═══════════════════════════════════════════════════════════════════════════
// bbf-onboarding-sweeper — the auto-heal cron (blueprint §3.3)
// ───────────────────────────────────────────────────────────────────────────
// Cron every 10 min (dual-auth like bbf-resend-welcome). Sweeps pipelines stuck in
// cold_start_degraded / paid / provisioned for > 5 min, re-runs the (idempotent)
// cold-start cascade via bbf-cold-start-orchestrator, and re-checks the gate:
//   • orchestrator advances the state on success (Layer-2 → Layer-1 silently)
//   • heal_attempts += 1 each pass; ≥ 3 attempts with the SAME failing code →
//     state 'needs_attention' + admin alert (heal never loops forever)
//
// The admin learns about a broken onboarding from an alert BEFORE the athlete can
// learn about it from a login — the dispatch gate + this heal loop make that
// ordering structural.
//
// AUTH: X-Cron-Secret=CRON_SECRET (cron) OR X-BBF-Admin-Token=BBF_COACH_AGENT_TOKEN
// (manual). Deploy --no-verify-jwt. POST body (optional): { limit?=50, age_min?=5, dry_run?=false }
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { CORS, jsonResponse, insertAdminAlert, type SupabaseClient } from '../_shared/onboarding-core.ts';

const HEAL_STATES = ['cold_start_degraded', 'paid', 'provisioned'];
const HEAL_ATTEMPTS_MAX = 3;

// Normalize a failure_reason to its comparable set of gate codes, e.g.
// 'gate_failed:G2,G5' → 'G2,G5' (sorted). Used to detect "same failing code".
function failureCodes(reason: string | null | undefined): string {
  const s = String(reason ?? '').replace(/^gate_failed:/, '').trim();
  if (!s) return '';
  return s.split(',').map((c) => c.trim()).filter(Boolean).sort().join(',');
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);

  const ADMIN_TOKEN = Deno.env.get('BBF_COACH_AGENT_TOKEN') ?? '';
  const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';
  const adminOk = ADMIN_TOKEN.length > 0 && (req.headers.get('x-bbf-admin-token') ?? '') === ADMIN_TOKEN;
  const cronOk = CRON_SECRET.length > 0 && (req.headers.get('x-cron-secret') ?? '') === CRON_SECRET;
  if (!adminOk && !cronOk) return jsonResponse({ ok: false, error: 'unauthorized' }, 401);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SERVICE_ROLE) return jsonResponse({ ok: false, error: 'config_missing' }, 503);
  const supabase: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false, autoRefreshToken: false } });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* defaults */ }
  const limit = Math.min(Math.max(Number(body.limit) || 50, 1), 200);
  const ageMin = Math.max(Number(body.age_min) || 5, 1);
  const dryRun = body.dry_run === true;

  const cutoffIso = new Date(Date.now() - ageMin * 60_000).toISOString();
  const nowIso = new Date().toISOString();

  const { data: stuck, error: qErr } = await supabase
    .from('bbf_onboarding_pipeline')
    .select('id,user_id,checkout_session_id,email,tier,state,failure_reason,heal_attempts,state_entered_at')
    .in('state', HEAL_STATES)
    .lt('state_entered_at', cutoffIso)
    .order('state_entered_at', { ascending: true })
    .limit(limit);
  if (qErr) return jsonResponse({ ok: false, error: 'query_failed', detail: qErr.message }, 500);

  const results: Array<Record<string, unknown>> = [];
  let healed = 0, stillDegraded = 0, needsAttention = 0, skipped = 0;

  // Shared cron secret is used to authorize the orchestrator self-invoke.
  const orchestratorUrl = `${SUPABASE_URL}/functions/v1/bbf-cold-start-orchestrator`;

  for (const p of (stuck ?? [])) {
    const pipelineId = String(p.id);
    const userId = p.user_id ? String(p.user_id) : null;
    const priorCodes = failureCodes(p.failure_reason as string | null);

    if (!userId) {
      skipped++; results.push({ id: pipelineId, status: 'skipped', reason: 'no_user_id' }); continue;
    }
    if (dryRun) { results.push({ id: pipelineId, user_id: userId, status: 'would_heal', prior: priorCodes }); continue; }

    // Re-run the idempotent cascade via the orchestrator.
    let orchestrated: Record<string, unknown> | null = null;
    let orchestratorError: string | null = null;
    try {
      const r = await fetch(orchestratorUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-cron-secret': CRON_SECRET },
        body: JSON.stringify({ user_id: userId, checkout_session_id: p.checkout_session_id ?? null, tier: p.tier ?? null, source: 'sweeper' }),
      });
      orchestrated = await r.json().catch(() => null);
      if (!r.ok) orchestratorError = `orchestrator_${r.status}`;
    } catch (e) {
      orchestratorError = e instanceof Error ? e.message : String(e);
    }

    const healAttempts = (Number(p.heal_attempts) || 0) + 1;
    const newState = String(orchestrated?.state ?? '');
    const gate = (orchestrated?.gate ?? null) as { passed?: boolean; failing?: string[] } | null;
    const newCodes = gate?.failing ? [...gate.failing].sort().join(',') : failureCodes((orchestrated as Record<string, unknown> | null)?.failure_reason as string | null);

    if (orchestratorError && !orchestrated) {
      // The orchestrator itself is unreachable — bump heal_attempts, leave state, alert on cap.
      await supabase.from('bbf_onboarding_pipeline').update({ heal_attempts: healAttempts, updated_at: nowIso }).eq('id', pipelineId);
      if (healAttempts >= HEAL_ATTEMPTS_MAX) {
        await supabase.from('bbf_onboarding_pipeline').update({ state: 'needs_attention', failure_reason: `heal_unreachable:${orchestratorError}`, state_entered_at: nowIso, updated_at: nowIso }).eq('id', pipelineId);
        await insertAdminAlert(supabase, { kind: 'needs_attention', reason: 'orchestrator_unreachable', pipelineId, userId, email: p.email as string, state: 'needs_attention', detail: orchestratorError });
        needsAttention++;
      }
      stillDegraded++; results.push({ id: pipelineId, user_id: userId, status: 'heal_error', detail: orchestratorError, heal_attempts: healAttempts });
      continue;
    }

    if (newState === 'cold_start_ready') {
      await supabase.from('bbf_onboarding_pipeline').update({ heal_attempts: healAttempts, updated_at: nowIso }).eq('id', pipelineId);
      healed++; results.push({ id: pipelineId, user_id: userId, status: 'healed', heal_attempts: healAttempts });
      continue;
    }

    // Still degraded. Escalate if we've hit the cap with the SAME failing code.
    const sameCode = priorCodes && newCodes && priorCodes === newCodes;
    if (healAttempts >= HEAL_ATTEMPTS_MAX && sameCode) {
      await supabase.from('bbf_onboarding_pipeline').update({ state: 'needs_attention', failure_reason: `stuck:${newCodes}`, heal_attempts: healAttempts, state_entered_at: nowIso, updated_at: nowIso }).eq('id', pipelineId);
      await insertAdminAlert(supabase, { kind: 'needs_attention', reason: 'heal_exhausted_same_code', pipelineId, userId, email: p.email as string, state: 'needs_attention', codes: newCodes.split(',').filter(Boolean), detail: `Same failing gate codes (${newCodes}) after ${healAttempts} heal attempts.` });
      needsAttention++; results.push({ id: pipelineId, user_id: userId, status: 'needs_attention', codes: newCodes, heal_attempts: healAttempts });
    } else {
      // Orchestrator already set state=cold_start_degraded + failure_reason; just record the heal count.
      await supabase.from('bbf_onboarding_pipeline').update({ heal_attempts: healAttempts, updated_at: nowIso }).eq('id', pipelineId);
      stillDegraded++; results.push({ id: pipelineId, user_id: userId, status: 'still_degraded', prior: priorCodes, now: newCodes, heal_attempts: healAttempts });
    }
  }

  console.log(`[bbf-onboarding-sweeper] swept=${(stuck ?? []).length} healed=${healed} still_degraded=${stillDegraded} needs_attention=${needsAttention} skipped=${skipped} dry_run=${dryRun}`);
  return jsonResponse({ ok: true, swept: (stuck ?? []).length, healed, still_degraded: stillDegraded, needs_attention: needsAttention, skipped, dry_run: dryRun, results }, 200);
});
