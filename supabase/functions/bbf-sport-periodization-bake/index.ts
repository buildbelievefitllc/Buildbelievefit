// supabase/functions/bbf-sport-periodization-bake/index.ts
// ═══════════════════════════════════════════════════════════════════════════
// SP-1 · SPORT PERIODIZATION ARCHITECT — catalog bake (offline, founder-gated).
//
// Kills the sport-agnostic WEEK_TEMPLATE: for each requested (sport ×
// position-group × phase × tier) cell, Sonnet designs a REAL periodized 7-day
// week seeded from the native sports-engine protocol for that cell. Every
// generated block passes DETERMINISTIC validation (Immutable Laws: no barbell
// back squat, no crunches/sit-ups; youth plyo ceiling: no depth jumps below
// Phase 3 for youth/middle-school) BEFORE it can be stored — AI proposes, our
// code disposes. Blocks land as status='draft' in bbf_sport_block_catalog and
// serve to NO athlete until the founder activates the batch (CATALOG_BAKE
// Action-Inbox card → bbf_apply_catalog_batch, or the approve_batch action
// here). Bake-once discipline: a cell is billed at most once per re-bake order.
//
// Actions (admin-gated: X-BBF-Admin-Token or admin session token):
//   • bake          — { sports:[...], phases?:[1,2,3], tiers?:['youth'],
//                       position_groups?:['general'], force?:false }
//                     Skips cells that already exist unless force=true.
//                     Hard cap MAX_CELLS_PER_CALL per invocation.
//   • approve_batch — { batch_id } → drafts in the batch flip to approved.
//   • status        — catalog counts by sport/status.
//
// Day shape is WEEK_TEMPLATE-compatible so the Hub's check-off + off/in-season
// rails keep working untouched. Model routing: sport_block_design → Sonnet
// (§4). Spend-gated + LLM-telemetry logged per call.
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { routeAndLog } from '../_shared/model-router.ts';
import { checkSpendGate, spendLimitResponse } from '../_shared/spend-gate.ts';
import { logLlmCall } from '../_shared/llm-telemetry.ts';
import { buildSportsProtocol, normalizeSportKey } from './sports-engine.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-bbf-admin-token, x-bbf-session-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

const MAX_CELLS_PER_CALL = 24;
const VALID_TIERS = new Set(['youth', 'middle_school', 'high_school', 'collegiate']);
// tier → athletic base the seed protocol scales from (conservative for minors).
const TIER_EXPERIENCE: Record<string, string> = {
  youth: 'beginner', middle_school: 'beginner', high_school: 'intermediate', collegiate: 'advanced',
};

// ── Deterministic validation — the Immutable Laws firewall ──────────────────
const FORBIDDEN_ALWAYS = [/\bback\s+squats?\b/i, /\bcrunch(es)?\b/i, /\bsit[\s-]?ups?\b/i];
const FORBIDDEN_YOUTH_PRE_PEAK = [/\bdepth\s+jumps?\b/i, /\bshock\s+(training|method)\b/i, /\b1\s*rm\b/i, /\bmax(imal)?\s+(effort|attempt)s?\b/i];

function validateBlock(block: any, tier: string, phase: number): { ok: boolean; reason?: string } {
  const days = block?.days;
  if (!Array.isArray(days) || days.length !== 7) return { ok: false, reason: 'must_have_7_days' };
  let restCount = 0;
  for (let i = 0; i < 7; i++) {
    const d = days[i];
    if (!d || typeof d !== 'object') return { ok: false, reason: `day_${i + 1}_invalid` };
    d.label = `Day ${i + 1}`; // normalize deterministically — labels are the progress-map keys
    if (d.rest === true) {
      restCount++;
      if (!d.restNote || typeof d.restNote !== 'string') d.restNote = 'Recovery day — mobility, soft-tissue work, hydration, 9h sleep.';
      delete d.exercises;
      continue;
    }
    d.rest = false;
    const ex = d.exercises;
    if (!Array.isArray(ex) || ex.length < 3 || ex.length > 7) return { ok: false, reason: `day_${i + 1}_exercise_count` };
    for (const e of ex) {
      const name = String(e?.name ?? '');
      const off = String(e?.off ?? '');
      const inS = String(e?.in ?? '');
      if (!name || name.length > 120 || !off || off.length > 40 || !inS || inS.length > 40) {
        return { ok: false, reason: `day_${i + 1}_exercise_shape` };
      }
      for (const rx of FORBIDDEN_ALWAYS) if (rx.test(name)) return { ok: false, reason: `immutable_law_violation:${name}` };
      if ((tier === 'youth' || tier === 'middle_school') && phase < 3) {
        for (const rx of FORBIDDEN_YOUTH_PRE_PEAK) if (rx.test(name)) return { ok: false, reason: `youth_plyo_ceiling:${name}` };
      }
    }
  }
  if (restCount < 1 || restCount > 3) return { ok: false, reason: 'rest_day_count' };
  return { ok: true };
}

// ── Structured output schema (WEEK_TEMPLATE-compatible days) ────────────────
const BLOCK_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    days: {
      // NOTE: Anthropic json_schema output supports minItems only as 0/1 — the
      // EXACTLY-7 constraint is enforced by the prompt + validateBlock instead.
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          label: { type: 'string' },
          focus: { type: 'string' },
          rest: { type: 'boolean' },
          restNote: { type: 'string' },
          exercises: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                name: { type: 'string' },
                off: { type: 'string', description: 'Off-season scheme, e.g. "4 × 5"' },
                in: { type: 'string', description: 'In-season scheme, e.g. "3 × 3"' },
                detail: { type: 'string', description: 'One coaching cue' },
              },
              required: ['name', 'off', 'in'],
            },
          },
        },
        required: ['label', 'focus', 'rest'],
      },
    },
    coaching_focus: { type: 'string' },
    summary: { type: 'string' },
  },
  required: ['days', 'summary'],
} as const;

const SYSTEM_PROMPT = [
  'You are the head of sports performance at Build Believe Fit, designing periodized weekly training blocks for youth and scholastic athletes.',
  'You design ONE 7-day training week per request, specific to the sport, position group, mesocycle phase, and athlete tier given.',
  'HARD RULES (violations are rejected by an automated validator):',
  '- Exactly 7 days. 1-3 of them are rest/recovery days (rest:true + restNote). Training days carry 3-7 exercises.',
  '- Every exercise needs an off-season scheme ("off") AND an in-season scheme ("in") — in-season is always reduced volume/intensity for freshness.',
  '- NEVER program barbell back squats. NEVER program crunches or sit-ups. (Front squat, goblet squat, trap-bar work are allowed and encouraged.)',
  '- For youth and middle-school tiers below Phase 3: no depth jumps, no shock methods, no 1RM or max-effort testing. Landing mechanics before amplitude.',
  '- Respect the phase: Phase 1 = foundation/movement quality, Phase 2 = development/loading, Phase 3 = peak/reactive power.',
  '- Sport-specificity is the whole point: lift selection, power patterns, conditioning energy systems, and day sequencing must reflect how this sport and position actually loads the body. A lineman week and a setter week should look DIFFERENT.',
  '- Include one weekly day that blends position skill circuits with conditioning (the seed protocol shows the skill inventory).',
  'Voice: focus lines and coaching cues are direct and athlete-readable. No AI mentions, no filler. Keep coaching cues under 12 words.',
].join('\n');

async function callClaude(apiKey: string, model: string, userMessage: string) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      output_config: { format: { type: 'json_schema', schema: BLOCK_SCHEMA } },
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userMessage }],
    }),
  });
  let body: any = null;
  try { body = await res.json(); } catch { /* handled below */ }
  if (!res.ok) {
    const err = (body?.error && (body.error.message || body.error.type)) || `anthropic_${res.status}`;
    return { ok: false as const, error: String(err), body };
  }
  return { ok: true as const, body };
}

function extractJson(content: any[]): any | null {
  if (!Array.isArray(content)) return null;
  for (const block of content) {
    if (block?.type === 'text' && typeof block.text === 'string') {
      try { return JSON.parse(block.text); } catch { return null; }
    }
  }
  return null;
}

// ── Coach auth (admin token or admin session token — brain parity) ──────────
async function isCoachAuthorized(req: Request, supabase: any): Promise<boolean> {
  const ADMIN_TOKEN = Deno.env.get('BBF_COACH_AGENT_TOKEN') ?? '';
  const token = req.headers.get('x-bbf-admin-token') ?? '';
  if (ADMIN_TOKEN && token.length > 0 && token === ADMIN_TOKEN) return true;
  const session = req.headers.get('x-bbf-session-token') ?? '';
  if (!session) return false;
  const { data: srow } = await supabase
    .from('bbf_vault_sessions').select('user_id')
    .eq('token', session).gt('expires_at', new Date().toISOString()).limit(1).maybeSingle();
  if (!srow?.user_id) return false;
  const { data: u } = await supabase
    .from('bbf_users').select('uid, role').eq('id', srow.user_id).is('deleted_at', null).maybeSingle();
  if (!u) return false;
  const role = String(u.role ?? '').toLowerCase();
  return role === 'admin' || role === 'trainer' || String(u.uid ?? '').toLowerCase() === 'akeem';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!SUPABASE_URL || !SERVICE_KEY) return jsonResponse({ error: 'backend_unconfigured' }, 503);
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

  if (!(await isCoachAuthorized(req, supabase))) return jsonResponse({ error: 'unauthorized' }, 401);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonResponse({ error: 'bad_json' }, 400); }
  const action = String(body?.action ?? 'bake');

  // ── status ──
  if (action === 'status') {
    const { data } = await supabase.from('bbf_sport_block_catalog').select('sport, status');
    const counts: Record<string, Record<string, number>> = {};
    for (const r of data ?? []) {
      counts[r.sport] = counts[r.sport] ?? {};
      counts[r.sport][r.status] = (counts[r.sport][r.status] ?? 0) + 1;
    }
    return jsonResponse({ ok: true, counts });
  }

  // ── approve_batch (admin fallback path for the CATALOG_BAKE card applier) ──
  if (action === 'approve_batch') {
    const batchId = String(body?.batch_id ?? '');
    if (!/^[0-9a-f-]{36}$/i.test(batchId)) return jsonResponse({ error: 'invalid_batch_id' }, 400);
    const { data, error } = await supabase
      .from('bbf_sport_block_catalog')
      .update({ status: 'approved', approved_at: new Date().toISOString() })
      .eq('bake_batch', batchId).eq('status', 'draft')
      .select('id');
    if (error) return jsonResponse({ error: 'approve_failed', detail: error.message }, 500);
    // Close the matching pending CATALOG_BAKE card if one is open (best-effort).
    await supabase.from('coach_action_inbox')
      .update({ status: 'APPROVED', processed_at: new Date().toISOString() })
      .eq('type', 'CATALOG_BAKE').eq('status', 'PENDING')
      .filter('proposed_plan_modification->catalog_bake->>batch_id', 'eq', batchId);
    return jsonResponse({ ok: true, blocks_approved: (data ?? []).length, batch_id: batchId });
  }

  if (action !== 'bake') return jsonResponse({ error: 'unknown_action' }, 400);

  // ── bake ──
  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  if (!ANTHROPIC_API_KEY) return jsonResponse({ error: 'config_missing_anthropic_key' }, 503);

  const gate = await checkSpendGate(SUPABASE_URL, SERVICE_KEY);
  if (gate.stopped) return spendLimitResponse(gate);

  const sports = (Array.isArray(body?.sports) ? body.sports : []).map((s) => normalizeSportKey(s)).filter(Boolean);
  if (!sports.length) return jsonResponse({ error: 'missing_sports' }, 400);
  const phases = (Array.isArray(body?.phases) ? body.phases : [1, 2, 3]).map(Number).filter((p) => p >= 1 && p <= 3);
  const tiers = (Array.isArray(body?.tiers) ? body.tiers : ['youth']).map(String).filter((t) => VALID_TIERS.has(t));
  const positionGroups = (Array.isArray(body?.position_groups) ? body.position_groups : ['general']).map((p) => String(p).toLowerCase().slice(0, 40));
  const force = body?.force === true;

  // Expand the cell grid, skip already-baked cells unless force.
  const cells: Array<{ sport: string; position_group: string; phase: number; tier: string }> = [];
  for (const sport of [...new Set(sports)]) {
    for (const position_group of [...new Set(positionGroups)]) {
      for (const tier of [...new Set(tiers)]) {
        for (const phase of [...new Set(phases)]) cells.push({ sport, position_group, phase, tier });
      }
    }
  }
  if (cells.length > MAX_CELLS_PER_CALL) {
    return jsonResponse({ error: 'too_many_cells', requested: cells.length, max: MAX_CELLS_PER_CALL }, 400);
  }

  const { data: existing } = await supabase
    .from('bbf_sport_block_catalog')
    .select('sport, position_group, phase, tier')
    .in('sport', [...new Set(cells.map((c) => c.sport))]);
  const existingKeys = new Set((existing ?? []).map((r) => `${r.sport}|${r.position_group}|${r.phase}|${r.tier}`));
  const work = force ? cells : cells.filter((c) => !existingKeys.has(`${c.sport}|${c.position_group}|${c.phase}|${c.tier}`));
  if (!work.length) return jsonResponse({ ok: true, baked: 0, skipped: cells.length, reason: 'all_cells_exist' });

  const model = routeAndLog('bbf-sport-periodization-bake', 'sport_block_design');
  const batchId = crypto.randomUUID();

  // The gateway enforces a 150s idle limit per request; a multi-cell Sonnet
  // batch exceeds it. Accept immediately, run the bake as a background task
  // (EdgeRuntime.waitUntil), report through the CATALOG_BAKE inbox card +
  // the `status` action.
  const runBake = async () => {
  const results: Array<Record<string, unknown>> = [];
  let baked = 0, failed = 0;

  for (const cell of work) {
    const seed = buildSportsProtocol({
      sport: cell.sport,
      experience: TIER_EXPERIENCE[cell.tier] ?? 'beginner',
      targetPhase: cell.phase,
    });
    const userMessage = [
      `DESIGN CELL: sport=${cell.sport} · position_group=${cell.position_group} · phase=${cell.phase}/3 · tier=${cell.tier.replace('_', ' ')}`,
      '',
      'SEED — the current native protocol for this cell (skill inventory, phase plyo ladder, level-scaled base). Improve on it: sequence a real week, make lift selection and conditioning sport-true, keep every hard rule:',
      JSON.stringify(seed),
      '',
      'Return the 7-day block JSON now.',
    ].join('\n');

    const t0 = Date.now();
    const call = await callClaude(ANTHROPIC_API_KEY, model, userMessage);
    const latencyMs = Date.now() - t0;
    const usage = call.ok ? call.body?.usage : null;

    let verdict: { ok: boolean; reason?: string } = { ok: false, reason: call.ok ? 'parse_failed' : call.error };
    let block: any = null;
    if (call.ok) {
      block = extractJson(call.body?.content);
      if (block) verdict = validateBlock(block, cell.tier, cell.phase);
    }

    await logLlmCall(supabase, {
      agent: 'bbf-sport-periodization-bake', model, ok: call.ok && verdict.ok,
      latencyMs, inputTokens: usage?.input_tokens ?? null, outputTokens: usage?.output_tokens ?? null,
      finishReason: call.ok ? (call.body?.stop_reason ?? null) : null,
      error: verdict.ok ? null : verdict.reason, promptName: 'sport_block_design',
    });

    if (!verdict.ok) {
      failed++;
      results.push({ ...cell, ok: false, reason: verdict.reason });
      continue;
    }

    const { error: upErr } = await supabase.from('bbf_sport_block_catalog').upsert({
      sport: cell.sport, position_group: cell.position_group, phase: cell.phase, tier: cell.tier,
      block, status: 'draft', bake_batch: batchId, model,
      generated_at: new Date().toISOString(), approved_at: null,
    }, { onConflict: 'sport,position_group,phase,tier' });
    if (upErr) {
      failed++;
      results.push({ ...cell, ok: false, reason: `upsert_failed:${upErr.message.slice(0, 120)}` });
      continue;
    }
    baked++;
    results.push({ ...cell, ok: true });
  }

  // Founder review card — one per batch, pinned to the founder's own user row
  // (coach_action_inbox.athlete_id is NOT NULL; catalog work has no athlete).
  let cardId: string | null = null;
  if (baked > 0) {
    const { data: founder } = await supabase
      .from('bbf_users').select('id').eq('uid', 'akeem').is('deleted_at', null).maybeSingle();
    if (founder?.id) {
      const cellList = results.filter((r) => r.ok).map((r) => `${r.sport}/${r.position_group} P${r.phase} ${r.tier}`).join(', ');
      const { data: card } = await supabase.from('coach_action_inbox').insert({
        athlete_id: founder.id,
        type: 'CATALOG_BAKE',
        insight_summary: `SP-1 Periodization Architect: ${baked} sport-specific training block${baked === 1 ? '' : 's'} drafted and validated against the Immutable Laws (${failed} rejected). Cells: ${cellList}`.slice(0, 1900),
        proposed_action: 'Review and activate this bake batch — drafts serve to no athlete until approved.',
        draft_message: '',
        proposed_plan_modification: { catalog_bake: { batch_id: batchId, baked, failed, cells: results } },
      }).select('id').maybeSingle();
      cardId = card?.id ?? null;
    }
  }

  console.log(`[bbf-sport-periodization-bake] batch=${batchId} baked=${baked} failed=${failed} card=${cardId ?? 'none'}`);
  };

  const rt = (globalThis as any).EdgeRuntime;
  if (rt?.waitUntil) rt.waitUntil(runBake());
  else runBake();
  return jsonResponse({ ok: true, accepted: true, batch_id: batchId, cells: work.length, skipped: cells.length - work.length, model }, 202);
});
