// bbf-agentic-orchestrator v1 — Slow Path · Athlete Snapshot Synthesis
// ─────────────────────────────────────────────────────────────────────
// The async half of the Phase 6 Two-Speed Orchestrator. The Fast Path
// (deterministic conflict resolution + idempotency + Sentinel-gated
// proposal submission) runs in-session on the frontend in
// BBF_ORCHESTRATOR. This edge function is the Slow Path · invoked
// nightly from bbf-midnight-haiku.v3 with the Sovereign roster, it
// synthesizes a 2–4 sentence Athlete Snapshot via Claude Haiku using:
//   · last 7-day episodic decisions from bbf_orchestrator_memory
//   · current CNS state slice from bbf_users
//   · recent training intake (bbf_meal_logs · bbf_sets aggregates)
// and persists the snapshot back to bbf_orchestrator_memory with
// action_type='athlete_snapshot_synthesis' so the founder dashboard
// and Sovereign Intelligence Brief can render it.
//
// Intent router (POST /functions/v1/bbf-agentic-orchestrator):
//   { intent: 'synthesize_athlete_snapshot', uid: '<slug>',  admin_override?: false }
//   { intent: 'compute_greenline_patterns', lookback_days?: 30 }
//
// Auth: X-BBF-Admin-Token must match BBF_COACH_AGENT_TOKEN env.
// Failure posture: every code path returns 200 with a structured body.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// Phase 7 Workstream B · Slow-path nightly synthesis · Haiku already
// per Phase 6. Route through the central router for observability.
import { routeAndLog } from '../_shared/model-router.ts';
import { localeDirective, localeCode } from '../_shared/locale.ts';
import { checkSpendGate, spendLimitResponse } from '../_shared/spend-gate.ts';
// Phase 7 · Wave 1 wiring — Episodic Memory adapter (cross-session recall) and
// the wearable ACWR read boundary feed the context-gathering phase.
import { recallMemory, formatContextBlock } from '../_shared/episodic-memory.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-bbf-admin-token',
};
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

const MODEL          = routeAndLog('bbf-agentic-orchestrator', 'snapshot_synthesis');
const MAX_TOKENS     = 320;       // 2–4 sentences ≈ 120–220 output tokens
const MEMORY_LOOKBACK_DAYS = 7;
const MEAL_LOOKBACK_DAYS   = 7;
const SET_LOOKBACK_LIMIT   = 30;
const GREENLINE_MIN_PATTERN_COUNT = 5;
const GREENLINE_LOOKBACK_DEFAULT_DAYS = 30;

const ABSOLUTE_EXCLUSION_TIER  = ['safety', 'vulnerable'];
const ABSOLUTE_EXCLUSION_TYPES = [
  'cns_intervention', 'cardio_structure_change', 'cardio_intensity_shift',
  'cardio_prescription', 'youth_load_progression', 'redline_override',
];

const SYSTEM_PROMPT = [
  'You are the BBF Athlete Snapshot Synthesizer. You read 7 days of orchestration memory (every decision Pantheon\'s coordinators made for this athlete, every founder approval/reject, every rollback) plus the current CNS slice and the recent meal + set telemetry. You produce a 2–4 sentence synthesis describing the athlete\'s present operating state.',
  '',
  '# WHAT TO SYNTHESIZE',
  '- Where the athlete is operating right now (training drive, recovery, nutrition adherence)',
  '- One pattern the orchestrator has been resolving on their behalf this week',
  '- One thing the founder may want to inspect (only if signal is genuinely present)',
  '',
  '# WAVE 1 SIGNAL INPUTS',
  '- PRIOR CONTEXT (cross-session episodic recall): durable records the fleet wrote for this athlete — prior session summaries, key decisions, and ⚑ flags. Treat a ⚑ flag as still-live unless the current telemetry clearly resolves it, and let unresolved flags shape what you surface to the founder.',
  '- WEARABLE ACWR (acute:chronic workload ratio): acute = trailing-7-day mean strain, chronic = trailing-28-day mean strain, acwr = acute ÷ chronic. Flags: detraining (<0.8), optimal (≤1.3), caution (≤1.5), high_risk (>1.5), insufficient_data (<14 chronic days with data). When it sharpens the snapshot, cite it in output using the acronym only, as "ACWR <value> (<flag>)" — do not spell out the underlying term, which the output vocabulary contract forbids. When composing in a non-English locale, render the <flag> WORD in that language so it never bleeds English — detraining → ES "desentrenamiento" / PT "destreinamento"; optimal → ES "óptimo" / PT "ótimo"; caution → ES "precaución" / PT "cautela"; high_risk → ES "alto riesgo" / PT "alto risco"; insufficient_data → ES "datos insuficientes" / PT "dados insuficientes" — while keeping the "ACWR" acronym and the numeric value unchanged. Never infer a ratio that is absent.',
  '',
  '# LOAD-GATE RULE (youth athletes)',
  '- For youth-athlete tiers (rising_athlete, youth_athlete, kickstart_*, transformation_*, sovereign_* cycles), the ACWR GATES load. When the flag is "caution" or "high_risk", do NOT endorse load progression — surface a load alert that names the acwr value and prescribes holding or reducing volume; for "high_risk" frame it explicitly as an injury-risk load alert. When the flag is "insufficient_data", say what to log rather than inferring a ratio.',
  '',
  '# TONE',
  'Clinical and brief. No greeting. No emoji. Second person. Reference real numbers when they sharpen the message; never invent numbers absent from the data.',
  '',
  '# OUTPUT CONTRACT',
  '- Exactly 2 to 4 sentences. Plain text. No markdown, no headings, no JSON.',
  '- If the data is sparse, say so in one clause and prescribe what to log for tomorrow\'s synthesis.',
  '- Honor the BBF Occupational Therapy vocabulary contract: no clinical terms (no "diagnose", "pathology", "dysfunction", "patient", "therapy", "treatment", "chronic", "disorder"). Use "friction", "pattern variance", "load alert", "athlete", "restoration", "protocol", "recurring".',
].join('\n');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(s: string): boolean { return UUID_RE.test(s); }

async function resolveUuid(uid: string, supabaseUrl: string, supabaseKey: string): Promise<string | null> {
  if (isUuid(uid)) return uid;
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/bbf_get_uid_map`, {
      method: 'POST',
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!res.ok) return null;
    const rows = await res.json();
    if (!Array.isArray(rows)) return null;
    for (const r of rows) if (r && r.uid === uid && r.id) return r.id;
    return null;
  } catch (_) { return null; }
}

async function fetchUserSlice(uuid: string, supabaseUrl: string, supabaseKey: string) {
  // Phase 6.0i · soft-delete gate · `&deleted_at=is.null` excludes soft-deleted users.
  // service-role bypasses RLS so this explicit filter is load-bearing.
  const url = `${supabaseUrl}/rest/v1/bbf_users?id=eq.${encodeURIComponent(uuid)}&deleted_at=is.null&select=uid,name,subscription_tier,baseline_status,block_priority,cardiac_clearance,cns_friction_score,biomechanical_redline,somatic_cognitive_load,tdee_target,macro_p,macro_c,macro_f,ghost_intervention_needed,par_q_screened_at&limit=1`;
  try {
    const res = await fetch(url, { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } });
    if (!res.ok) return null;
    const rows = await res.json();
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  } catch (_) { return null; }
}

async function fetchMemorySlice(uidSlug: string, supabaseUrl: string, supabaseKey: string) {
  const sinceIso = new Date(Date.now() - MEMORY_LOOKBACK_DAYS * 86400000).toISOString();
  const qs = `uid=eq.${encodeURIComponent(uidSlug)}` +
             `&created_at=gte.${encodeURIComponent(sinceIso)}` +
             `&select=action_type,priority_tier,arbitration_result,sentinel_verdict,founder_response,founder_actor,negative_learning,created_at` +
             `&order=created_at.desc&limit=80`;
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/bbf_orchestrator_memory?${qs}`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
    });
    if (!res.ok) return [];
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  } catch (_) { return []; }
}

async function fetchMealAggregate(uuid: string, supabaseUrl: string, supabaseKey: string) {
  const sinceDate = new Date(Date.now() - MEAL_LOOKBACK_DAYS * 86400000).toISOString().slice(0, 10);
  const qs = `user_id=eq.${encodeURIComponent(uuid)}` +
             `&log_date=gte.${encodeURIComponent(sinceDate)}` +
             `&select=log_date,calories,protein_g,carbs_g,fats_g`;
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/bbf_meal_logs?${qs}`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
    });
    if (!res.ok) return null;
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return { days_logged: 0, avg_kcal: null };
    const buckets: Record<string, { kcal: number; p: number; c: number; f: number; n: number }> = {};
    for (const row of rows) {
      const d = row.log_date;
      if (!buckets[d]) buckets[d] = { kcal: 0, p: 0, c: 0, f: 0, n: 0 };
      buckets[d].kcal += Number(row.calories) || 0;
      buckets[d].p    += Number(row.protein_g) || 0;
      buckets[d].c    += Number(row.carbs_g) || 0;
      buckets[d].f    += Number(row.fats_g) || 0;
      buckets[d].n++;
    }
    const days = Object.values(buckets).filter((b) => b.kcal > 0);
    if (days.length === 0) return { days_logged: 0, avg_kcal: null };
    const total = days.reduce((s, b) => ({ kcal: s.kcal + b.kcal, p: s.p + b.p, c: s.c + b.c, f: s.f + b.f }),
                              { kcal: 0, p: 0, c: 0, f: 0 });
    return {
      days_logged: days.length,
      avg_kcal:    Math.round(total.kcal / days.length),
      avg_p:       Math.round(total.p / days.length),
      avg_c:       Math.round(total.c / days.length),
      avg_f:       Math.round(total.f / days.length),
    };
  } catch (_) { return null; }
}

async function fetchSetSlice(uuid: string, supabaseUrl: string, supabaseKey: string) {
  const qs = `user_id=eq.${encodeURIComponent(uuid)}` +
             `&select=weight_lbs,reps,day_key,exercise_key,rpe` +
             `&order=day_key.desc&limit=${SET_LOOKBACK_LIMIT}`;
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/bbf_sets?${qs}`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
    });
    if (!res.ok) return [];
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  } catch (_) { return []; }
}

// Phase 7 · Wearable ACWR — server-side read via the service_role uid sibling
// bbf_get_wearable_readiness_admin (the athlete-facing bbf_get_wearable_readiness
// is vault-session-token gated and unusable from this nightly batch). Best-effort:
// any failure resolves to null so a wearable gap never blocks synthesis.
async function fetchWearableReadiness(uuid: string, supabaseUrl: string, supabaseKey: string) {
  const asOf = new Date().toISOString().slice(0, 10);
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/bbf_get_wearable_readiness_admin`, {
      method: 'POST',
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_uid: uuid, p_as_of: asOf }),
    });
    if (!res.ok) return null;
    const out = await res.json();
    return out && out.ok === true ? out : null;
  } catch (_) { return null; }
}

async function callClaude(userMessage: string, apiKey: string, localeInput: string) {
  const requestBody = {
    model:      MODEL,
    max_tokens: MAX_TOKENS,
    system: [
      { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: localeDirective(localeInput, 'the athlete snapshot') },
    ],
    messages: [{ role: 'user', content: userMessage }],
  };
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify(requestBody),
  });
  let body: any;
  try { body = await res.json(); } catch (_) { body = null; }
  if (!res.ok) {
    const errMsg = (body && body.error && (body.error.message || body.error.type)) || `anthropic_${res.status}`;
    console.error(`[bbf-agentic-orchestrator] Anthropic API error: status=${res.status} body=${JSON.stringify(body)}`);
    return { ok: false as const, error: errMsg, raw: body };
  }
  return { ok: true as const, body };
}

function extractTextBlock(content: any): string | null {
  if (!Array.isArray(content)) return null;
  for (const block of content) {
    if (block && block.type === 'text' && typeof block.text === 'string') return block.text;
  }
  return null;
}

async function persistSnapshotToMemory(
  uidSlug: string, snapshotText: string, sources: any, supabaseUrl: string, supabaseKey: string,
) {
  // Compute a stable pattern_hash for snapshots so they're queryable but
  // never enter Greenline eligibility (they're informational, not actionable).
  const patternHash = 'athlete_snapshot_synthesis_v1';
  const row = {
    uid:                 uidSlug,
    action_type:         'athlete_snapshot_synthesis',
    priority_tier:       'performance',
    proposed_action:     {
      snapshot_text:    snapshotText,
      sources:          sources,
      generated_at:     new Date().toISOString(),
      orchestrator_idempotency_key: 'snapshot_' + uidSlug + '_' + new Date().toISOString().slice(0, 10),
    },
    arbitration_result:  'allowed',
    sentinel_verdict:    'not_verified',
    pattern_hash:        patternHash,
    founder_response:    'auto_synthesis',
    founder_response_at: new Date().toISOString(),
    founder_actor:       'bbf-agentic-orchestrator.v1',
    agent:               'bbf-agentic-orchestrator.v1',
  };
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/bbf_orchestrator_memory`, {
      method: 'POST',
      headers: {
        apikey:          supabaseKey,
        Authorization:   `Bearer ${supabaseKey}`,
        'Content-Type':  'application/json',
        Prefer:          'return=minimal',
      },
      body: JSON.stringify(row),
    });
    if (!res.ok) console.warn(`[bbf-agentic-orchestrator] persist snapshot HTTP ${res.status}`);
  } catch (e) {
    console.warn(`[bbf-agentic-orchestrator] persist snapshot threw: ${(e as Error).message}`);
  }
}

async function handleSynthesizeAthleteSnapshot(uidRaw: string, supabaseUrl: string, supabaseKey: string, apiKey: string, locale: string) {
  const uuid = await resolveUuid(uidRaw, supabaseUrl, supabaseKey);
  if (!uuid) return jsonResponse({ ok: false, error: 'uid_not_resolvable', uid: uidRaw }, 400);

  // Pull every context slice in parallel for prompt efficiency. Phase 7 adds two
  // Wave 1 inputs: cross-session episodic recall (bbf_episodic_recall, via the
  // shared adapter) and the wearable ACWR read. Both are best-effort.
  const [userSlice, memorySlice, mealAgg, setSlice, episodic, wearable] = await Promise.all([
    fetchUserSlice(uuid, supabaseUrl, supabaseKey),
    fetchMemorySlice(uidRaw, supabaseUrl, supabaseKey),
    fetchMealAggregate(uuid, supabaseUrl, supabaseKey),
    fetchSetSlice(uuid, supabaseUrl, supabaseKey),
    recallMemory({ uid: uidRaw, limit: 5 }),   // fleet-wide recall for this athlete
    fetchWearableReadiness(uuid, supabaseUrl, supabaseKey),
  ]);

  // Episodic recall → compact prompt block + a sources summary.
  const episodicBlock = formatContextBlock(episodic.records);
  const episodicSummary = { recalled: episodic.count, ok: episodic.ok };
  // Wearable ACWR → the acwr sub-object is what gates youth-athlete load.
  const wearableAcwr = wearable && wearable.acwr ? wearable.acwr : null;

  // Memory aggregation · compact summary, not the raw rows
  const memoryCounts: Record<string, number> = {};
  let rollbacks = 0;
  let founderApproves = 0;
  let founderRejects = 0;
  let suppressed = 0;
  let pending = 0;
  for (const m of memorySlice) {
    memoryCounts[m.action_type] = (memoryCounts[m.action_type] || 0) + 1;
    if (m.negative_learning) rollbacks++;
    if (m.founder_response === 'approve') founderApproves++;
    if (m.founder_response === 'reject')  founderRejects++;
    if (m.arbitration_result === 'suppressed_by_higher_priority' ||
        m.arbitration_result === 'duplicate_idempotency') suppressed++;
    if (!m.founder_response) pending++;
  }
  const memorySummary = {
    decisions_last_7d:        memorySlice.length,
    action_type_counts:       memoryCounts,
    rollbacks:                rollbacks,
    founder_approves:         founderApproves,
    founder_rejects:          founderRejects,
    auto_suppressed:          suppressed,
    pending_no_decision:      pending,
  };

  const sources = {
    user_slice:      userSlice,
    memory_summary:  memorySummary,
    meal_aggregate:  mealAgg,
    sets_inspected:  setSlice.length,
    episodic_recall: episodicSummary,
    wearable_acwr:   wearableAcwr,
  };

  // Per-athlete dynamic context lives in the user message (AFTER the cached
  // system prefix) so the prompt-cache hit on SYSTEM_PROMPT is preserved.
  const userMessage =
    '## athlete\n' +
    '```json\n' + JSON.stringify(userSlice || { uid: uidRaw }, null, 2) + '\n```\n\n' +
    '## prior context · cross-session episodic recall\n' +
    (episodicBlock ? episodicBlock + '\n\n' : '_no prior episodic records for this athlete_\n\n') +
    '## wearable readiness · ACWR (acute:chronic workload ratio)\n' +
    '```json\n' + JSON.stringify(wearableAcwr || { available: false }, null, 2) + '\n```\n\n' +
    '## orchestrator memory · last 7 days · aggregated\n' +
    '```json\n' + JSON.stringify(memorySummary, null, 2) + '\n```\n\n' +
    '## nutrition · 7-day rolling averages\n' +
    '```json\n' + JSON.stringify(mealAgg || { days_logged: 0 }, null, 2) + '\n```\n\n' +
    '## recent sets · most-recent ' + setSlice.length + ' rows\n' +
    '```json\n' + JSON.stringify(setSlice.slice(0, 20), null, 2) + '\n```\n\n' +
    'Synthesize the 2–4 sentence Athlete Snapshot per your system instructions.';

  const t0 = Date.now();
  const result = await callClaude(userMessage, apiKey, locale);
  const dur = Date.now() - t0;
  if (!result.ok) {
    return jsonResponse({ ok: false, error: 'anthropic_call_failed', detail: result.error }, 502);
  }
  const text = extractTextBlock((result.body as any).content);
  if (!text) return jsonResponse({ ok: false, error: 'no_text_block_in_response' }, 502);
  const snapshotText = text.trim();

  await persistSnapshotToMemory(uidRaw, snapshotText, sources, supabaseUrl, supabaseKey);

  console.log(`[bbf-agentic-orchestrator] synthesis · uid=${uidRaw} · model=${(result.body as any).model} · dur=${dur}ms · decisions_7d=${memorySlice.length} · episodic_recalled=${episodic.count} · acwr=${wearableAcwr ? `${wearableAcwr.acwr ?? 'n/a'}/${wearableAcwr.flag ?? 'n/a'}` : 'none'}`);
  return jsonResponse({
    ok:           true,
    uid:          uidRaw,
    locale,
    snapshot:     snapshotText,
    sources:      sources,
    model:        (result.body as any).model,
    duration_ms:  dur,
  }, 200);
}

async function handleComputeGreenlinePatterns(lookbackDays: number, supabaseUrl: string, supabaseKey: string) {
  const sinceIso = new Date(Date.now() - lookbackDays * 86400000).toISOString();
  const qs = `founder_response=eq.approve&negative_learning=eq.false&created_at=gte.${encodeURIComponent(sinceIso)}&select=pattern_hash,action_type,priority_tier`;
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/bbf_orchestrator_memory?${qs}`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
    });
    if (!res.ok) return jsonResponse({ ok: false, error: 'memory_fetch_failed', status: res.status }, 502);
    const rows = await res.json();
    if (!Array.isArray(rows)) return jsonResponse({ ok: true, patterns: [], rows_scanned: 0 }, 200);
    const counts: Record<string, { count: number; action_type: string; priority_tier: string }> = {};
    for (const r of rows) {
      if (!r || !r.pattern_hash) continue;
      if (ABSOLUTE_EXCLUSION_TYPES.indexOf(r.action_type) >= 0) continue;
      if (ABSOLUTE_EXCLUSION_TIER.indexOf(r.priority_tier)  >= 0) continue;
      if (!counts[r.pattern_hash]) counts[r.pattern_hash] = { count: 0, action_type: r.action_type, priority_tier: r.priority_tier };
      counts[r.pattern_hash].count++;
    }
    const eligible = Object.keys(counts)
      .filter((h) => counts[h].count >= GREENLINE_MIN_PATTERN_COUNT)
      .map((h) => ({ pattern_hash: h, ...counts[h] }))
      .sort((a, b) => b.count - a.count);
    return jsonResponse({ ok: true, patterns: eligible, rows_scanned: rows.length, threshold: GREENLINE_MIN_PATTERN_COUNT }, 200);
  } catch (e) {
    return jsonResponse({ ok: false, error: 'unexpected', detail: (e as Error).message }, 500);
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')    return jsonResponse({ error: 'method_not_allowed' }, 405);

  const expectedToken = Deno.env.get('BBF_COACH_AGENT_TOKEN');
  if (expectedToken) {
    const sent = req.headers.get('x-bbf-admin-token') || '';
    if (sent !== expectedToken) {
      console.warn('[bbf-agentic-orchestrator] rejected: bad/missing X-BBF-Admin-Token');
      return jsonResponse({ error: 'unauthorized' }, 401);
    }
  }

  let payload: any;
  try { payload = await req.json(); }
  catch (_) { return jsonResponse({ error: 'invalid_json' }, 400); }

  const intent = (payload && typeof payload.intent === 'string') ? payload.intent : null;

  const SUPABASE_URL         = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY');
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return jsonResponse({ error: 'config_missing_supabase' }, 503);
  }

  // Daily spend kill-switch — fail-closed cost ceiling. The admin_override
  // synthesis path is exempt so founder QA is never blocked by the gate.
  if (!(intent === 'synthesize_athlete_snapshot' && payload && payload.admin_override === true)) {
    const verdict = await checkSpendGate(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    if (verdict.stopped) {
      console.warn(`[bbf-agentic-orchestrator] 429 SpendLimitExceeded · ${verdict.reason} (source=${verdict.source})`);
      return spendLimitResponse(verdict);
    }
  }

  if (intent === 'compute_greenline_patterns') {
    const lookback = Number(payload && payload.lookback_days) || GREENLINE_LOOKBACK_DEFAULT_DAYS;
    return await handleComputeGreenlinePatterns(lookback, SUPABASE_URL, SUPABASE_SERVICE_KEY);
  }

  // Default · synthesize_athlete_snapshot
  if (intent && intent !== 'synthesize_athlete_snapshot') {
    return jsonResponse({ error: 'unknown_intent', intent: intent }, 400);
  }
  const uid = payload && payload.uid;
  const locale = localeCode(payload?.locale ?? payload?.lang);
  if (typeof uid !== 'string' || !uid) {
    return jsonResponse({ error: 'missing_uid' }, 400);
  }
  if (payload && payload.admin_override === true) {
    return jsonResponse({
      ok: true, uid: uid,
      snapshot: 'ADMIN OVERRIDE: Synthesis bypassed. Athlete operating at baseline.',
      sources: { admin_override: true },
    }, 200);
  }
  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  if (!ANTHROPIC_API_KEY) return jsonResponse({ error: 'config_missing_anthropic_key' }, 503);

  return await handleSynthesizeAthleteSnapshot(uid, SUPABASE_URL, SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY, locale);
});
