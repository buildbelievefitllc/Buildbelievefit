// bbf-agentic-peaking v2 — Game-Day Peaking + Mesocycle Restructure (Phase 2 + Phase 4)
// ─────────────────────────────────────────────────────────────────────
// DEFAULT INTENT (legacy Phase 2):
//   Intercepts the athlete's scheduled heavy workout when CNS readiness
//   is compromised (sleep < 6 OR soreness > 7) and asks Claude Opus 4.7
//   to generate 2 CNS-friendly replacement lifts. Frontend renders the
//   override on top of the static program.
//
// PHASE 4 INTENT · `intent: 'restructure'`:
//   Fired by bbf-agentic-forecasting when systemic-overtraining is
//   detected. Computes a mesocycle restructure (block priority shift
//   from current → recovery/maintenance, deload-week framing) and
//   STAGES the proposal to bbf_pending_review via /api/proposal-submit.
//   NEVER live · founder approval gates the actual write.
//   Returns: { staged: true, proposal_id, restructure_spec }.
//
// Request shape:
//   POST /functions/v1/bbf-agentic-peaking
//   Content-Type: application/json
//   X-BBF-Admin-Token: <optional shared secret>
//   Body:
//   {
//     "uid": "jacque_bbf",                 // required (slug or UUID)
//     "admin_override": false,             // optional · true → bypass engine
//     "scheduled_focus": "Push Day",       // optional · contextualizes prompt
//     "scheduled_lifts": ["Bench Press", "Incline DB Press", ...]  // optional
//   }
//
// Response shape (200 OK):
//   Bypass / no intercept:
//     { "override_active": false, [readiness_snapshot, message] }
//   Active intercept:
//     {
//       "override_active": true,
//       "warning_banner": "Sharp coach voice · 1 sentence",
//       "replacement_lifts": [{ name, reps, notes }, ...],
//       "readiness_snapshot": { sleep, stress },
//       "model": "claude-opus-4-7",
//       "duration_ms": 5230
//     }
//
// Errors return non-2xx with { "error": "<slug>", "detail"?: ... }.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// Phase 6.0h-followup · raw fetch → canonical callClaude · use-case
// `mesocycle_rationale` routes to HAIKU · fallback escalates to SONNET.
import { callClaude } from '../_shared/anthropic-call.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-bbf-admin-token',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// ─── Model + request tuning ───────────────────────────────────────────
// Phase 7 Workstream B · Mesocycle rationale and CNS-readiness override
// narration is deterministic-shaped output (banner + two replacement
// lifts). Haiku 4.5 is the right tier per the CEO routing rules ·
// Opus 4.7 was overspend for a fixed-schema response. Routing is
// centralized in _shared/model-router.ts so future tuning is one-file.
const MAX_TOKENS     = 4096;

// Trigger thresholds (CEO scaffold).
const SLEEP_FLOOR     = 6;   // sleep_quality < 6 → CNS compromised
const SORENESS_CEILING = 7;  // soreness_level > 7 → CNS compromised
// Defaults when no readiness data exists yet — bias toward "fine" so
// the engine doesn't intercept a brand-new client's first session on
// missing data.
const SLEEP_DEFAULT     = 8;
const SORENESS_DEFAULT  = 5;

// Stable system prompt — cacheable via cache_control: ephemeral.
const SYSTEM_PROMPT = [
  'You are the BBF Game-Day Peaking Engine. The athlete\'s CNS readiness has fallen below the safe threshold for heavy compound lifting today. Your job: replace their scheduled heavy session with 2 CNS-friendly recovery / mobility exercises that protect tomorrow\'s training capacity.',
  '',
  '# WHAT YOU RECEIVE',
  '- sleep_quality (1-10) — last night\'s recovery',
  '- soreness_level (1-10) — accumulated stress / soreness',
  '- scheduled_focus — what was originally planned (e.g. "Push Day", "Legs", "Pull")',
  '- scheduled_lifts — array of the day\'s heavy lift names',
  '',
  '# WHAT YOU RETURN',
  '- warning_banner — one short, direct sentence telling the athlete WHY their session is intercepted. Sharp coach voice. No platitudes. Example: "CNS readiness compromised. Today is recovery. Tomorrow we lift."',
  '- replacement_lifts — exactly 2 exercises, each with:',
  '    name:  specific movement (e.g. "Cat-Cow Spinal Mobilization")',
  '    reps:  prescription string (e.g. "3 x 10 slow tempo")',
  '    notes: 1-sentence cue or focus',
  '',
  '# CONSTRAINTS',
  '- Replacement movements must be LOW intensity, mobility / parasympathetic-focused.',
  '- Avoid heavy weight, plyometric, max-effort, eccentric overload, sprinting.',
  '- Target the same body region as the scheduled focus (e.g. Push Day → upper-back + thoracic mobility; Legs → hip mobility + light glute activation; Pull → lat / rear-delt mobility).',
  '- Direct voice. No "consider", "perhaps", "may want to". Imperatives only.',
  '- The banner is read aloud by the athlete in their head — keep it tight, no preamble.',
  '',
  'Return ONLY structured JSON matching the response schema. No markdown, no preamble.',
].join('\n');

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    warning_banner: {
      type: 'string',
      description: 'One short, direct sentence. Sharp coach voice. No emoji. Why the session is intercepted.',
    },
    replacement_lifts: {
      type: 'array',
      description: 'Exactly 2 CNS-friendly mobility / recovery exercises.',
      items: {
        type: 'object',
        properties: {
          name:  { type: 'string', description: 'Specific movement name.' },
          reps:  { type: 'string', description: 'Prescription string, e.g. "3 x 10 slow tempo".' },
          notes: { type: 'string', description: '1-sentence cue or focus.' },
        },
        required: ['name', 'reps', 'notes'],
        additionalProperties: false,
      },
    },
  },
  required: ['warning_banner', 'replacement_lifts'],
  additionalProperties: false,
};

// ─── Slug → UUID resolver ─────────────────────────────────────────────
// Frontend may pass either the slug ("jacque_bbf") or the UUID. The DB
// FK target is UUID. Resolve via the SECURITY DEFINER RPC bbf_get_uid_map
// (same mechanism bbf-sync.js uses, but server-side here).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(s: string): boolean { return UUID_RE.test(s); }

async function resolveUuid(uid: string, supabaseUrl: string, supabaseKey: string): Promise<string | null> {
  if (isUuid(uid)) return uid;
  const url = `${supabaseUrl}/rest/v1/rpc/bbf_get_uid_map`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    if (!res.ok) {
      console.error(`[bbf-agentic-peaking] uid_map RPC failed: HTTP ${res.status}`);
      return null;
    }
    const rows = await res.json();
    if (!Array.isArray(rows)) return null;
    for (const r of rows) {
      if (r && r.uid === uid && r.id) return r.id;
    }
    return null;
  } catch (e) {
    console.error(`[bbf-agentic-peaking] uid_map RPC error: ${(e as Error).message}`);
    return null;
  }
}

// ─── Readiness fetch (Phase C schema) ─────────────────────────────────
async function fetchLatestReadiness(
  uuid: string,
  supabaseUrl: string,
  supabaseKey: string,
): Promise<{ sleep_quality: number | null; soreness_level: number | null } | null> {
  const qs = `user_id=eq.${encodeURIComponent(uuid)}&select=sleep_quality,soreness_level,timestamp&order=timestamp.desc&limit=1`;
  const url = `${supabaseUrl}/rest/v1/bbf_readiness?${qs}`;
  try {
    const res = await fetch(url, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    if (!res.ok) {
      console.error(`[bbf-agentic-peaking] readiness fetch failed: HTTP ${res.status} ${await res.text()}`);
      return null;
    }
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return {
        sleep_quality:   typeof data[0].sleep_quality === 'number' ? data[0].sleep_quality : null,
        soreness_level:  typeof data[0].soreness_level === 'number' ? data[0].soreness_level : null,
      };
    }
    return null;
  } catch (e) {
    console.error(`[bbf-agentic-peaking] readiness fetch error: ${(e as Error).message}`);
    return null;
  }
}

// (legacy local `callClaude` + `extractTextBlock` removed · canonical
//  helper from _shared/anthropic-call.ts replaces both.)

// ─── Phase 4 · Mesocycle restructure handler ──────────────────────────
// Deterministic restructure computation + queue staging. NO Claude on
// this path · the restructure pattern is fixed (current block →
// recovery + 1-week deload framing) so it stays predictable for the
// founder reviewing the queue. Returns the staged proposal id.
function computeRestructureSpec(currentBlock: string | null, otSignal: any) {
  // Map current block → recovery target. Anything above recovery
  // drops to recovery for one mesocycle; rehab stays rehab.
  const block = String(currentBlock || 'maintenance').toLowerCase();
  let targetBlock = 'recovery';
  if (block === 'rehab')        targetBlock = 'rehab';
  if (block === 'recovery')     targetBlock = 'recovery';
  if (block === 'maintenance')  targetBlock = 'recovery';
  if (block === 'hypertrophy')  targetBlock = 'recovery';
  if (block === 'strength')     targetBlock = 'recovery';
  if (block === 'peaking')      targetBlock = 'recovery';
  return {
    current_block:        block,
    target_block:         targetBlock,
    deload_weeks:         1,
    volume_reduction_pct: 40,
    intensity_cap_pct:    65,
    triggered_by:         'bbf-agentic-peaking.v2',
    ot_signal_summary: {
      ac_ratio:             otSignal && otSignal.ac_ratio || null,
      rpe_recent_avg:       otSignal && otSignal.rpe_recent_avg || null,
      session_count_recent: otSignal && otSignal.session_count_recent || 0,
      rationale:            otSignal && otSignal.rationale || null,
    },
  };
}

async function fetchCurrentBlock(
  uuid: string, supabaseUrl: string, supabaseKey: string,
): Promise<{ block_priority: string | null; cns_friction_score: number | null }> {
  const url = `${supabaseUrl}/rest/v1/bbf_users?id=eq.${encodeURIComponent(uuid)}&select=block_priority,cns_friction_score&limit=1`;
  try {
    const res = await fetch(url, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
    });
    if (!res.ok) return { block_priority: null, cns_friction_score: null };
    const rows = await res.json();
    if (Array.isArray(rows) && rows.length > 0) {
      return {
        block_priority:     rows[0].block_priority     != null ? String(rows[0].block_priority) : null,
        cns_friction_score: rows[0].cns_friction_score != null ? Number(rows[0].cns_friction_score) : null,
      };
    }
  } catch (_) {}
  return { block_priority: null, cns_friction_score: null };
}

async function stageRestructureProposal(
  uidSlug: string, restructureSpec: any, currentBlock: string | null,
  cnsScore: number | null, otSignal: any,
): Promise<{ staged: boolean; proposal_id: string | null; error?: string }> {
  // Route to the Render proxy /api/proposal-submit just like every
  // other agent does · it owns the whitelist enforcement, RLS, and
  // audit. We do NOT bypass to direct PostgREST insert · the proxy
  // is the load-bearing safeguard from Phase 0.
  const renderOrigin = Deno.env.get('BBF_RENDER_PROXY_ORIGIN') || 'https://buildbelievefit.onrender.com';
  const adminToken   = Deno.env.get('BBF_ADMIN_TOKEN') || '';
  if (!adminToken) {
    return { staged: false, proposal_id: null, error: 'missing_BBF_ADMIN_TOKEN' };
  }
  const body = {
    proposal_type: 'block_priority_shift',
    risk_level:    'high',
    population:    { uids: [uidSlug], cohort: 'single' },
    diff: {
      target_table: 'bbf_users',
      target_uid:   uidSlug,
      before:       { block_priority: currentBlock, cns_friction_score: cnsScore },
      after:        { block_priority: restructureSpec.target_block },
      fields:       ['block_priority'],
    },
    rationale: 'Systemic overtraining detected (' + (otSignal && otSignal.rationale || 'OT signal triggered') +
               '). bbf-agentic-peaking.v2 proposes deload restructure: ' +
               restructureSpec.current_block + ' → ' + restructureSpec.target_block +
               ' · ' + restructureSpec.deload_weeks + '-week deload · volume -' +
               restructureSpec.volume_reduction_pct + '% · intensity cap ' +
               restructureSpec.intensity_cap_pct + '% 1RM. Founder approval required.',
    proposed_by: 'bbf-agentic-peaking.v2',
    metadata: {
      restructure_spec:    restructureSpec,
      ot_signal:           otSignal,
      cns_friction_score:  cnsScore,
      triggered_at:        new Date().toISOString(),
    },
  };
  try {
    // No Origin header on the server-side call · the Render proxy's
    // ALLOWED_ORIGINS check is `if (origin && !ALLOWED_ORIGINS.has(origin))`,
    // so omitting Origin skips the browser-origin gate entirely. The
    // admin-token gate remains the load-bearing auth check.
    const res = await fetch(`${renderOrigin}/api/proposal-submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-BBF-Admin-Token': adminToken,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text();
      console.error(`[bbf-agentic-peaking:restructure] proxy HTTP ${res.status}: ${txt.slice(0,300)}`);
      return { staged: false, proposal_id: null, error: `proxy_http_${res.status}` };
    }
    const j = await res.json().catch(() => null) as any;
    return {
      staged:      !!(j && j.ok && j.proposal && j.proposal.id),
      proposal_id: (j && j.proposal && j.proposal.id) || null,
    };
  } catch (e) {
    console.error(`[bbf-agentic-peaking:restructure] proxy fetch threw: ${(e as Error).message}`);
    return { staged: false, proposal_id: null, error: (e as Error).message };
  }
}

async function handleRestructureIntent(
  uidRaw: string, otSignal: any,
  supabaseUrl: string, supabaseKey: string,
) {
  const uuid = await resolveUuid(uidRaw, supabaseUrl, supabaseKey);
  if (!uuid) return jsonResponse({ error: 'uid_not_resolvable', uid: uidRaw }, 400);
  const userState = await fetchCurrentBlock(uuid, supabaseUrl, supabaseKey);
  const restructureSpec = computeRestructureSpec(userState.block_priority, otSignal);
  const staging = await stageRestructureProposal(
    uidRaw, restructureSpec, userState.block_priority, userState.cns_friction_score, otSignal,
  );
  if (!staging.staged) {
    return jsonResponse({
      staged:           false,
      proposal_id:      null,
      restructure_spec: restructureSpec,
      error:            staging.error || 'unknown_staging_error',
    }, 502);
  }
  console.log(`[bbf-agentic-peaking:restructure] STAGED · uid=${uidRaw} · proposal_id=${staging.proposal_id} · ${restructureSpec.current_block}→${restructureSpec.target_block}`);
  return jsonResponse({
    staged:           true,
    proposal_id:      staging.proposal_id,
    restructure_spec: restructureSpec,
  }, 200);
}

// ─── Handler ───────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')    return jsonResponse({ error: 'method_not_allowed' }, 405);

  // Optional admin-token gate (same pattern as bbf-co-coach).
  const expectedToken = Deno.env.get('BBF_COACH_AGENT_TOKEN');
  if (expectedToken) {
    const sent = req.headers.get('x-bbf-admin-token') || '';
    if (sent !== expectedToken) {
      console.warn('[bbf-agentic-peaking] rejected: bad/missing X-BBF-Admin-Token');
      return jsonResponse({ error: 'unauthorized' }, 401);
    }
  }

  let payload: any;
  try { payload = await req.json(); }
  catch (_) { return jsonResponse({ error: 'invalid_json' }, 400); }

  const uidRaw = payload?.uid;
  if (typeof uidRaw !== 'string' || !uidRaw) {
    return jsonResponse({ error: 'missing_uid' }, 400);
  }
  const intent        = (payload && typeof payload.intent === 'string') ? payload.intent : null;
  const adminOverride = !!payload?.admin_override;

  // ─── 1. Omniscience Protocol · Admin Override ──────────────────
  if (adminOverride) {
    return jsonResponse({
      override_active: false,
      message: 'ADMIN OVERRIDE: Static Protocol Active',
    });
  }

  // ─── 2. Pull Readiness (Phase C schema) ────────────────────────
  const SUPABASE_URL         = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY');
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return jsonResponse({ error: 'config_missing_supabase' }, 503);
  }

  // ─── Phase 4 · restructure intent · stage proposal · never live ──
  // Fired by bbf-agentic-forecasting when systemic OT signal trips.
  // Routes through /api/proposal-submit so the founder approves the
  // block_priority_shift before any bbf_users.block_priority write.
  if (intent === 'restructure') {
    return await handleRestructureIntent(uidRaw, payload?.ot_signal || null, SUPABASE_URL, SUPABASE_SERVICE_KEY);
  }

  // Resolve the slug → UUID (bbf_readiness.user_id is uuid).
  const uuid = await resolveUuid(uidRaw, SUPABASE_URL, SUPABASE_SERVICE_KEY);
  if (!uuid) {
    return jsonResponse({ error: 'uid_not_resolvable', uid: uidRaw }, 400);
  }

  const readiness = await fetchLatestReadiness(uuid, SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const sleep  = (readiness && readiness.sleep_quality  != null) ? readiness.sleep_quality  : SLEEP_DEFAULT;
  const stress = (readiness && readiness.soreness_level != null) ? readiness.soreness_level : SORENESS_DEFAULT;
  const hasReadiness = !!readiness;

  // ─── 3. Trigger Condition ──────────────────────────────────────
  const isCnsCompromised = (sleep < SLEEP_FLOOR) || (stress > SORENESS_CEILING);

  if (!isCnsCompromised) {
    return jsonResponse({
      override_active:    false,
      readiness_snapshot: { sleep, stress, has_data: hasReadiness },
    });
  }

  // ─── 4. Claude API Call ────────────────────────────────────────
  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  if (!ANTHROPIC_API_KEY) {
    console.error('[bbf-agentic-peaking] missing ANTHROPIC_API_KEY');
    return jsonResponse({ error: 'config_missing_anthropic_key' }, 503);
  }

  const focus = (typeof payload?.scheduled_focus === 'string' && payload.scheduled_focus.trim())
    ? payload.scheduled_focus.trim()
    : 'unspecified';
  const lifts = Array.isArray(payload?.scheduled_lifts)
    ? payload.scheduled_lifts.filter((s: unknown) => typeof s === 'string' && s.length > 0)
    : [];

  const t0 = Date.now();
  const result = await callClaude({
    useCase:         'mesocycle_rationale',
    system:          SYSTEM_PROMPT,
    userFields:      {
      sleep_quality:    String(sleep) + '/10',
      soreness_level:   String(stress) + '/10',
      scheduled_focus:  focus,
      scheduled_lifts:  lifts.length ? lifts.join(', ') : '(none provided)',
      task: 'Emit the warning banner + 2 CNS-friendly replacement lifts per the schema.',
    },
    toolSchema:      RESPONSE_SCHEMA,
    toolName:        'submit_peaking_intercept',
    toolDescription: 'Emit the CNS-readiness warning banner + 2 mobility/recovery replacement lifts.',
    maxTokens:       MAX_TOKENS,
    agentTag:        'bbf-agentic-peaking',
    apiKey:          ANTHROPIC_API_KEY,
  });
  const dur = Date.now() - t0;

  if (!result.ok) {
    return jsonResponse({
      error: 'anthropic_call_failed',
      detail: result.error,
      status: result.status,
      raw: result.raw,
      attempts:      result.attempts,
      fallback_used: result.fallback_used,
    }, 502);
  }

  const parsed = result.toolInput as { warning_banner?: unknown; replacement_lifts?: unknown } | null;
  if (!parsed || typeof parsed.warning_banner !== 'string' || !Array.isArray(parsed.replacement_lifts)) {
    console.error(`[bbf-agentic-peaking] tool_use shape mismatch · got=${JSON.stringify(parsed).slice(0, 200)}`);
    return jsonResponse({ error: 'schema_mismatch', raw: parsed }, 502);
  }

  console.log(`[bbf-agentic-peaking] intercept · uid=${uidRaw} · sleep=${sleep} stress=${stress} · model=${result.model} · attempts=${result.attempts} · fallback_used=${result.fallback_used} · duration=${dur}ms · usage=${JSON.stringify(result.usage)}`);

  return jsonResponse({
    override_active:    true,
    warning_banner:     parsed.warning_banner,
    replacement_lifts:  parsed.replacement_lifts,
    readiness_snapshot: { sleep, stress, has_data: hasReadiness },
    model:              result.model,
    usage:              result.usage,
    duration_ms:        dur,
  }, 200);
});
