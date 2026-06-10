// bbf-agentic-peaking v3 — Game-Day Peaking + Mesocycle Restructure + CNS Auto-Regulator
// ─────────────────────────────────────────────────────────────────────
// DEFAULT INTENT (legacy Phase 2):
//   Intercepts the athlete's scheduled heavy workout when CNS readiness
//   is compromised (sleep < 6 OR soreness > 7) and asks Claude Opus 4.7
//   to generate 2 CNS-friendly replacement lifts. Frontend renders the
//   override on top of the static program.
//
// V3 · HEALTH CONNECT CNS AUTO-REGULATOR:
//   bbf-health-sync lands native Google Health Connect telemetry
//   (hrv_ms / resting_hr / sleep_minutes) on the same bbf_readiness row.
//   This engine now reads that wearable telemetry and autonomously
//   triggers the Agent Override when the CNS is fried:
//     • hrv_ms < 35          → biometric trigger
//     • sleep_minutes < 240  → biometric trigger
//   Wearable trigger → mode 'machine_swap': heavy spinal-loaded compounds
//   (e.g. Barbell Back Squat) are swapped for lower-taxing machine
//   isolations, with a deterministic 1RM downgrade (`load_directive`):
//     one biometric trigger  → cap working sets at 70% 1RM
//     both biometric triggers → cap working sets at 60% 1RM
//   Subjective trigger (legacy sleep_quality/soreness) → mode 'recovery'
//   (mobility / parasympathetic, unchanged behavior).
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
//       "load_directive": { mode, one_rm_cap_pct, triggers },
//       "readiness_snapshot": { sleep, stress, hrv_ms, resting_hr, sleep_minutes },
//       "model": "claude-opus-4-7",
//       "duration_ms": 5230
//     }
//
// Errors return non-2xx with { "error": "<slug>", "detail"?: ... }.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { routeAndLog } from '../_shared/model-router.ts';
import { localeDirective, localeCode } from '../_shared/locale.ts';

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
const MODEL          = routeAndLog('bbf-agentic-peaking', 'mesocycle_rationale');
const MAX_TOKENS     = 4096;
const EFFORT_DEFAULT = 'high';

// Trigger thresholds (CEO scaffold).
const SLEEP_FLOOR     = 6;   // sleep_quality < 6 → CNS compromised
const SORENESS_CEILING = 7;  // soreness_level > 7 → CNS compromised
// V3 · wearable telemetry thresholds (Health Connect via bbf-health-sync).
// MUST stay aligned with _shared/health-connect-core.mjs (single source of
// truth for the Android app's instant feedback).
const HRV_FLOOR_MS        = 35;  // hrv_ms < 35 → CNS compromised
const SLEEP_MINUTES_FLOOR = 240; // sleep_minutes < 240 → CNS compromised
// Deterministic 1RM downgrade for the machine_swap override mode.
const ONE_RM_CAP_SINGLE_TRIGGER = 70; // one biometric breach  → ≤70% 1RM
const ONE_RM_CAP_DOUBLE_TRIGGER = 60; // both biometric breaches → ≤60% 1RM
// Defaults when no readiness data exists yet — bias toward "fine" so
// the engine doesn't intercept a brand-new client's first session on
// missing data.
const SLEEP_DEFAULT     = 8;
const SORENESS_DEFAULT  = 5;

// Stable system prompt — cacheable via cache_control: ephemeral.
const SYSTEM_PROMPT = [
  'You are the BBF Game-Day Peaking Engine. The athlete\'s CNS readiness has fallen below the safe threshold for heavy compound lifting today. Your job: replace their scheduled heavy session per the override_mode you receive, protecting tomorrow\'s training capacity.',
  '',
  '# WHAT YOU RECEIVE',
  '- override_mode — "recovery" or "machine_swap" (semantics below)',
  '- sleep_quality (1-10) — last night\'s recovery (subjective check-in)',
  '- soreness_level (1-10) — accumulated stress / soreness (subjective check-in)',
  '- wearable telemetry (Google Health Connect, may be partial): hrv_ms, resting_hr (bpm), sleep_minutes',
  '- one_rm_cap_pct — hard intensity ceiling for machine_swap mode (deterministic, already computed)',
  '- scheduled_focus — what was originally planned (e.g. "Push Day", "Legs", "Pull")',
  '- scheduled_lifts — array of the day\'s heavy lift names',
  '',
  '# OVERRIDE MODES',
  '## recovery (subjective CNS trip)',
  '- Replacement movements must be LOW intensity, mobility / parasympathetic-focused.',
  '- Avoid heavy weight, plyometric, max-effort, eccentric overload, sprinting.',
  '- Target the same body region as the scheduled focus (e.g. Push Day → upper-back + thoracic mobility; Legs → hip mobility + light glute activation; Pull → lat / rear-delt mobility).',
  '## machine_swap (wearable telemetry trip — HRV and/or sleep duration below floor)',
  '- The athlete still trains, but axial/spinal loading is OFF the table today.',
  '- Swap each heavy spinal-loaded compound (Barbell Back Squat, Deadlift variants, Barbell Row, Standing Overhead Press) for a lower-taxing MACHINE or supported isolation hitting the same musculature (e.g. Back Squat → Leg Press or Leg Extension; RDL → Seated Hamstring Curl; Barbell Row → Chest-Supported Machine Row; OHP → Machine Shoulder Press).',
  '- Every reps prescription MUST respect the one_rm_cap_pct ceiling and state it (e.g. "3 x 10 @ ≤70% 1RM").',
  '- No free-bar axial loading, no max-effort sets, no plyometrics.',
  '',
  '# WHAT YOU RETURN',
  '- warning_banner — one short, direct sentence telling the athlete WHY their session is intercepted. Sharp coach voice. No platitudes. Example: "HRV is in the gutter. Spinal loaders are benched — machines today, bar tomorrow."',
  '- replacement_lifts — exactly 2 exercises, each with:',
  '    name:  specific movement (e.g. "Leg Press" / "Cat-Cow Spinal Mobilization")',
  '    reps:  prescription string (e.g. "3 x 10 @ ≤70% 1RM" / "3 x 10 slow tempo")',
  '    notes: 1-sentence cue or focus',
  '',
  '# CONSTRAINTS',
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

// ─── Readiness fetch (Phase C schema + V3 wearable telemetry) ─────────
interface ReadinessRow {
  sleep_quality: number | null;
  soreness_level: number | null;
  hrv_ms: number | null;
  resting_hr: number | null;
  sleep_minutes: number | null;
  source: string | null;
}

async function fetchLatestReadiness(
  uuid: string,
  supabaseUrl: string,
  supabaseKey: string,
): Promise<ReadinessRow | null> {
  const qs = `user_id=eq.${encodeURIComponent(uuid)}&select=sleep_quality,soreness_level,hrv_ms,resting_hr,sleep_minutes,source,timestamp&order=timestamp.desc&limit=1`;
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
      const r = data[0];
      return {
        sleep_quality:  typeof r.sleep_quality  === 'number' ? r.sleep_quality  : null,
        soreness_level: typeof r.soreness_level === 'number' ? r.soreness_level : null,
        hrv_ms:         typeof r.hrv_ms         === 'number' ? r.hrv_ms         : null,
        resting_hr:     typeof r.resting_hr     === 'number' ? r.resting_hr     : null,
        sleep_minutes:  typeof r.sleep_minutes  === 'number' ? r.sleep_minutes  : null,
        source:         typeof r.source         === 'string' ? r.source         : null,
      };
    }
    return null;
  } catch (e) {
    console.error(`[bbf-agentic-peaking] readiness fetch error: ${(e as Error).message}`);
    return null;
  }
}

// ─── V3 · CNS Auto-Regulator gate (deterministic) ─────────────────────
// Wearable trip → 'machine_swap' (train, but no spinal loaders + 1RM cap).
// Subjective trip with no wearable trip → 'recovery' (legacy behavior).
function computeCnsGate(readiness: ReadinessRow | null, sleep: number, stress: number): {
  compromised: boolean;
  mode: 'recovery' | 'machine_swap' | null;
  one_rm_cap_pct: number | null;
  triggers: string[];
} {
  const triggers: string[] = [];
  const hrv = readiness?.hrv_ms ?? null;
  const sleepMin = readiness?.sleep_minutes ?? null;
  if (hrv !== null && hrv < HRV_FLOOR_MS) triggers.push(`hrv_ms ${hrv} < ${HRV_FLOOR_MS}`);
  if (sleepMin !== null && sleepMin < SLEEP_MINUTES_FLOOR) triggers.push(`sleep_minutes ${sleepMin} < ${SLEEP_MINUTES_FLOOR}`);
  const wearableTrips = triggers.length;

  const subjectiveTrip = (sleep < SLEEP_FLOOR) || (stress > SORENESS_CEILING);
  if (sleep < SLEEP_FLOOR)        triggers.push(`sleep_quality ${sleep} < ${SLEEP_FLOOR}`);
  if (stress > SORENESS_CEILING)  triggers.push(`soreness_level ${stress} > ${SORENESS_CEILING}`);

  if (wearableTrips > 0) {
    return {
      compromised: true,
      mode: 'machine_swap',
      one_rm_cap_pct: wearableTrips >= 2 ? ONE_RM_CAP_DOUBLE_TRIGGER : ONE_RM_CAP_SINGLE_TRIGGER,
      triggers,
    };
  }
  if (subjectiveTrip) {
    return { compromised: true, mode: 'recovery', one_rm_cap_pct: null, triggers };
  }
  return { compromised: false, mode: null, one_rm_cap_pct: null, triggers: [] };
}

// ─── Anthropic call ────────────────────────────────────────────────────
async function callClaude(userMessage: string, apiKey: string, localeInput: string) {
  const requestBody = {
    model:      MODEL,
    max_tokens: MAX_TOKENS,
    thinking:   { type: 'adaptive' },
    output_config: {
      effort: EFFORT_DEFAULT,
      format: { type: 'json_schema', schema: RESPONSE_SCHEMA },
    },
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
      { type: 'text', text: localeDirective(localeInput, 'the warning banner and replacement-lift notes') },
    ],
    messages: [
      { role: 'user', content: userMessage },
    ],
  };

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
      'content-type':      'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  let body: any;
  try { body = await res.json(); }
  catch (_) { body = null; }

  if (!res.ok) {
    const errMsg = (body && body.error && (body.error.message || body.error.type)) || `anthropic_${res.status}`;
    console.error(`[bbf-agentic-peaking] Anthropic API error: status=${res.status} body=${JSON.stringify(body)}`);
    return { ok: false as const, status: res.status, error: errMsg, raw: body };
  }
  return { ok: true as const, status: res.status, body };
}

function extractTextBlock(content: any[]): string | null {
  if (!Array.isArray(content)) return null;
  for (const block of content) {
    if (block && block.type === 'text' && typeof block.text === 'string') return block.text;
  }
  return null;
}

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
  const locale = localeCode(payload?.locale ?? payload?.lang);
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
  const readinessSnapshot = {
    sleep,
    stress,
    hrv_ms:        readiness?.hrv_ms ?? null,
    resting_hr:    readiness?.resting_hr ?? null,
    sleep_minutes: readiness?.sleep_minutes ?? null,
    source:        readiness?.source ?? null,
    has_data:      hasReadiness,
  };

  // ─── 3. Trigger Condition (V3 CNS Auto-Regulator) ──────────────
  // Wearable telemetry (Health Connect via bbf-health-sync) takes
  // precedence when present: fried HRV / short sleep → machine_swap.
  // Subjective-only trips keep the legacy recovery intercept.
  const gate = computeCnsGate(readiness, sleep, stress);

  if (!gate.compromised) {
    return jsonResponse({
      override_active:    false,
      readiness_snapshot: readinessSnapshot,
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

  const userMessage =
    'Athlete state today:\n' +
    '- override_mode: ' + gate.mode + '\n' +
    '- cns_triggers: ' + gate.triggers.join(' · ') + '\n' +
    '- sleep_quality: ' + sleep + '/10\n' +
    '- soreness_level: ' + stress + '/10\n' +
    '- hrv_ms: ' + (readiness?.hrv_ms ?? 'n/a') + '\n' +
    '- resting_hr: ' + (readiness?.resting_hr ?? 'n/a') + ' bpm\n' +
    '- sleep_minutes: ' + (readiness?.sleep_minutes ?? 'n/a') + '\n' +
    (gate.one_rm_cap_pct != null ? '- one_rm_cap_pct: ' + gate.one_rm_cap_pct + '\n' : '') +
    '- scheduled_focus: ' + focus + '\n' +
    '- scheduled_lifts: ' + (lifts.length ? lifts.join(', ') : '(none provided)') + '\n\n' +
    'Generate the warning banner + 2 replacement lifts per the override_mode rules and the schema.';

  const t0 = Date.now();
  const result = await callClaude(userMessage, ANTHROPIC_API_KEY, locale);
  const dur = Date.now() - t0;

  if (!result.ok) {
    return jsonResponse({
      error: 'anthropic_call_failed',
      detail: result.error,
      status: result.status,
      raw: result.raw,
    }, 502);
  }

  const respBody: any = result.body;
  const text = extractTextBlock(respBody?.content);
  if (!text) {
    console.error(`[bbf-agentic-peaking] no text block in response. content=${JSON.stringify(respBody?.content)}`);
    return jsonResponse({ error: 'no_text_block_in_response', raw: respBody }, 502);
  }

  let parsed: any;
  try { parsed = JSON.parse(text); }
  catch (e) {
    console.error(`[bbf-agentic-peaking] parse failed: ${(e as Error).message}. text=${text.slice(0, 400)}`);
    return jsonResponse({ error: 'parse_failed', detail: (e as Error).message, raw_text: text }, 502);
  }

  console.log(`[bbf-agentic-peaking] intercept · uid=${uidRaw} · mode=${gate.mode} · triggers=[${gate.triggers.join(' | ')}] · sleep=${sleep} stress=${stress} hrv=${readiness?.hrv_ms ?? 'n/a'} sleep_min=${readiness?.sleep_minutes ?? 'n/a'} · model=${respBody.model} · duration=${dur}ms · usage=${JSON.stringify(respBody.usage)}`);

  return jsonResponse({
    override_active:    true,
    locale,
    warning_banner:     parsed.warning_banner,
    replacement_lifts:  parsed.replacement_lifts,
    load_directive: {
      mode:           gate.mode,
      one_rm_cap_pct: gate.one_rm_cap_pct,
      triggers:       gate.triggers,
    },
    readiness_snapshot: readinessSnapshot,
    model:              respBody.model,
    usage:              respBody.usage,
    duration_ms:        dur,
  }, 200);
});
