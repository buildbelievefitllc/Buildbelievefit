// bbf-agentic-cardio — Smart Cardio Engine (Phase 10 · Phase 19 contract)
// ─────────────────────────────────────────────────────────────────────
// Proactive cardio protocol generator. The athlete inputs available
// minutes. DETERMINISTIC LOGIC picks the modality tier (HIIT / Tempo /
// Zone 2); a CNS-fatigue read from bbf_sets can DOWN-REGULATE that tier
// (a fried CNS should not be sent into max-EPOC HIIT). Claude then writes
// the minute-by-minute protocol + the "Sovereign Toast" physiological ROI.
//
// Deterministic tier router (CEO spec):
//   available_minutes < 20  → HIIT   (Max EPOC)
//   available_minutes <= 35 → Tempo  (Caloric Burn)
//   available_minutes > 35  → Zone 2 (Fat Oxidation & CNS Sparing)
//
// CNS down-regulation (deterministic, from bbf_sets over the last 3 days +
// bbf_users CNS state): elevated/redlined fatigue steps the tier DOWN one
// level (HIIT→Tempo→Zone 2). The signal is always emitted for the UI.
//
// Request:  POST { "uid": "akeem", "available_minutes": 18, "admin_override"?: bool }
// Response: see FROZEN CONTRACT block at the bottom of this file.
// ─────────────────────────────────────────────────────────────────────

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { logLlmCall } from '../_shared/llm-telemetry.ts';
import { routeAndLog } from '../_shared/model-router.ts';
import { localeDirective, localeCode } from '../_shared/locale.ts';
import { requireEntitlement } from '../_shared/entitlement-gate.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  // NOTE: this endpoint is called via supabase.functions.invoke() (agenticCardioApi.js),
  // which attaches an `x-client-info` header to the POST. That header MUST be in this
  // allow-list or the browser's CORS preflight blocks the POST — surfacing as
  // supabase-js "Failed to send a request to the Edge Function". (Raw-fetch siblings
  // like bbf-agentic-prehab don't send it; the invoke-based bbf-wearable-ingest does
  // and already allows it.) `x-bbf-vault-token` is also allowed for the header-based
  // vault-token path this function reads below.
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-bbf-admin-token, x-bbf-vault-token, x-client-info',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// Source IP for the per-IP rate limiter (Supabase edge passes x-forwarded-for).
function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

// Cardiac-adjacent → Opus tier (one of the three peak-reasoning categories).
const MODEL             = routeAndLog('bbf-agentic-cardio', 'cardiac_intercept');
// Phase 10 hardening · the deterministic tier is decided BEFORE Claude (routeTier
// + CNS), so Claude only writes the machine/steps/ROI prose for that mandated
// tier — it does not need an unbounded thinking budget. Opus 4.8 + the old
// `thinking:{type:'adaptive'}` could burn enough thinking tokens to blow the
// hard timeout and silently drop every call to the deterministic fallback.
// Opus 4.8 uses ADAPTIVE thinking — thinking:{type:'enabled',budget_tokens} is a hard
// 400 on this model ("Use thinking.type.adaptive and output_config.effort"). effort:'low'
// keeps the structured-output generation well under the wall.
const MAX_TOKENS        = 2048;   // structured-output room (adaptive thinking self-budgets)
const EFFORT_DEFAULT    = 'low';
const CLAUDE_TIMEOUT_MS = 20000;  // adaptive + effort:low keeps Opus 4.8 comfortably under this
const MIN_MINUTES       = 5;
const MAX_MINUTES       = 120;
const CNS_WINDOW_DAYS   = 3;
const DAY_MS            = 24 * 60 * 60 * 1000;

type Tier = 'HIIT' | 'Tempo' | 'Zone 2';
const TIER_STRATEGY: Record<Tier, string> = {
  'HIIT':   'High-Intensity Interval Training (Max EPOC)',
  'Tempo':  'Moderate/Tempo Work (Caloric Burn)',
  'Zone 2': 'Low-Intensity Steady State / Zone 2 (Fat Oxidation & CNS Sparing)',
};

// ─── Deterministic tier router (CEO directive — NEVER delegated to Claude) ─
function routeTier(minutes: number): Tier {
  if (minutes < 20) return 'HIIT';
  if (minutes <= 35) return 'Tempo';
  return 'Zone 2';
}
function stepDown(t: Tier): Tier {
  return t === 'HIIT' ? 'Tempo' : t === 'Tempo' ? 'Zone 2' : 'Zone 2';
}

// ─── CNS fatigue evaluation from bbf_sets (deterministic) ──────────────
type Cns = {
  fatigue_level: 'fresh' | 'moderate' | 'elevated' | 'redlined';
  score: number;
  window_days: number;
  recent_sets: number;
  high_rpe_sets: number;
  avg_rpe: number | null;
  biomechanical_redline: boolean;
  down_regulate: boolean;
  source: 'bbf_sets' | 'unavailable';
  guidance: string;
};

function freshCns(source: Cns['source'], guidance: string): Cns {
  return {
    fatigue_level: 'fresh', score: 0, window_days: CNS_WINDOW_DAYS,
    recent_sets: 0, high_rpe_sets: 0, avg_rpe: null,
    biomechanical_redline: false, down_regulate: false, source, guidance,
  };
}

async function evaluateCns(supa: any, uid: string): Promise<Cns> {
  try {
    const { data: user, error: uErr } = await supa
      .from('bbf_users')
      .select('id, cns_friction_score, biomechanical_redline')
      .eq('uid', uid).is('deleted_at', null).maybeSingle();
    if (uErr || !user) return freshCns('unavailable', 'No athlete record — defaulting to fresh.');

    const sinceDate = new Date(Date.now() - (CNS_WINDOW_DAYS - 1) * DAY_MS).toISOString().slice(0, 10);
    const { data: logs } = await supa
      .from('bbf_logs').select('id').eq('user_id', user.id).gte('date', sinceDate);
    const logIds = (logs ?? []).map((l: any) => l.id);

    let recentSets = 0, highRpe = 0, rpeSum = 0, rpeCount = 0;
    if (logIds.length > 0) {
      const { data: sets } = await supa
        .from('bbf_sets').select('rpe, reps, weight_lbs, log_id').in('log_id', logIds);
      for (const s of (sets ?? [])) {
        recentSets += 1;
        const rpe = s.rpe == null ? null : Number(s.rpe);
        if (rpe != null && isFinite(rpe)) { rpeSum += rpe; rpeCount += 1; if (rpe >= 8) highRpe += 1; }
      }
    }

    // Deterministic score (0-100, higher = more fatigued). Primary signal is
    // bbf_sets RPE/volume; biomechanical_redline is a hard override.
    let score = 0;
    score += Math.min(45, highRpe * 5);     // heavy (RPE>=8) sets dominate
    score += Math.min(20, recentSets * 0.5); // raw volume
    const friction = Number(user.cns_friction_score);
    if (isFinite(friction) && friction > 0) score += Math.min(20, friction * 20); // treat ~0-1
    const redline = user.biomechanical_redline === true;
    if (redline) score = Math.max(score, 85);
    score = Math.max(0, Math.min(100, Math.round(score)));

    const level: Cns['fatigue_level'] =
      score >= 75 ? 'redlined' : score >= 50 ? 'elevated' : score >= 25 ? 'moderate' : 'fresh';
    const downReg = level === 'elevated' || level === 'redlined';
    const avgRpe = rpeCount > 0 ? Math.round((rpeSum / rpeCount) * 10) / 10 : null;

    const guidance = redline
      ? 'Biomechanical redline flagged — hard down-regulate to CNS-sparing work.'
      : downReg
        ? `${highRpe} high-RPE sets in ${CNS_WINDOW_DAYS}d — CNS taxed; softening intensity one tier.`
        : `${highRpe} high-RPE sets in ${CNS_WINDOW_DAYS}d — CNS has headroom for the prescribed tier.`;

    return {
      fatigue_level: level, score, window_days: CNS_WINDOW_DAYS,
      recent_sets: recentSets, high_rpe_sets: highRpe, avg_rpe: avgRpe,
      biomechanical_redline: redline, down_regulate: downReg, source: 'bbf_sets', guidance,
    };
  } catch (e) {
    console.error('[bbf-agentic-cardio] CNS eval failed (fail-open):', (e as Error).message);
    return freshCns('unavailable', 'CNS read failed — defaulting to fresh.');
  }
}

// ─── Claude output schema: structured protocol + ROI ───────────────────
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    machine: { type: 'string', description: 'Single gym machine, NO tier label. e.g. "Assault Bike", "Treadmill".' },
    protocol_steps: {
      type: 'array',
      description: 'Ordered contiguous phases. First start_min=0; each end_min equals the next start_min; the final end_min MUST equal available_minutes.',
      items: {
        type: 'object',
        properties: {
          start_min: { type: 'number', description: 'Phase start in minutes from 0.' },
          end_min:   { type: 'number', description: 'Phase end in minutes.' },
          phase:     { type: 'string', enum: ['warmup', 'work', 'recovery', 'steady', 'cooldown'] },
          label:     { type: 'string', description: 'Short phase instruction, e.g. "Sprint #1 · max effort".' },
          target:    { type: 'string', description: 'Concrete target, e.g. "8 mph / 8% incline" or "RPE 9".' },
        },
        required: ['start_min', 'end_min', 'phase', 'label', 'target'],
        additionalProperties: false,
      },
    },
    roi_toast:          { type: 'string', description: 'ONE punchy sentence — the Sovereign Toast headline.' },
    roi_detail:         { type: 'string', description: 'One or two sentences expanding the physiological ROI.' },
    roi_primary_metric: { type: 'string', description: 'The single headline metric, e.g. "12-18h elevated EPOC".' },
  },
  required: ['machine', 'protocol_steps', 'roi_toast', 'roi_detail', 'roi_primary_metric'],
  additionalProperties: false,
};

const SYSTEM_PROMPT = [
  'You are the BBF Smart Cardio Engine — an elite endurance coach writing a precise minute-by-minute cardio protocol that fits PERFECTLY into the athlete\'s time window. The strategy tier (HIIT / Tempo / Zone 2) is already deterministically chosen by the platform AND may have been down-regulated for CNS fatigue; you do NOT override it.',
  '',
  '# INPUT',
  '- available_minutes — exact time budget (integer).',
  '- strategy_tier — the mandated approach (full description). Honor it exactly.',
  '- cns_note — the athlete\'s CNS-fatigue context. If the CNS is taxed, keep targets honest and recovery generous.',
  '',
  '# OUTPUT (structured JSON only)',
  '- machine — ONE real gym machine appropriate to the tier (no tier label, no options list).',
  '- protocol_steps — contiguous phases covering the FULL window. start at 0, the final end_min MUST equal available_minutes. Include a warm-up and a cool-down where the tier allows (compress to 1 min for sub-12-min sessions). Use phase enum warmup/work/recovery/steady/cooldown.',
  '- roi_toast — one punchy sentence (the "Sovereign Toast").',
  '- roi_detail — 1-2 sentences expanding the physiological return.',
  '- roi_primary_metric — the single headline metric (e.g. "12-18h elevated EPOC").',
  '',
  '# CONSTRAINTS',
  '- The protocol_steps total duration MUST equal available_minutes. Do the arithmetic.',
  '- Real equipment only. Direct, imperative voice. No hedging. No markdown.',
].join('\n');

// ─── Helpers: flat text (backward compat) + total ──────────────────────
function buildProtocolText(steps: any[]): string {
  return steps.map((s) => {
    const a = `${s.start_min}`.padStart(2, '0');
    const b = `${s.end_min}`.padStart(2, '0');
    return `${a}:00–${b}:00  ${s.label} · ${s.target}`;
  }).join('\n');
}
function totalMinutes(steps: any[], fallback: number): number {
  if (!Array.isArray(steps) || steps.length === 0) return fallback;
  const last = steps[steps.length - 1];
  return Number(last?.end_min) || fallback;
}

// ─── Deterministic fallback (same frozen shape) ────────────────────────
function fallbackSteps(tier: Tier, minutes: number): { machine: string; steps: any[]; roi: any } {
  if (tier === 'HIIT') {
    const work = Math.max(2, minutes - 3);
    return {
      machine: 'Assault Bike',
      steps: [
        { start_min: 0, end_min: 2, phase: 'warmup', label: 'Warm-up · easy spin', target: 'RPE 4' },
        { start_min: 2, end_min: 2 + work, phase: 'work', label: `${work} rounds · 30s max / 30s easy`, target: 'RPE 9 on work' },
        { start_min: 2 + work, end_min: minutes, phase: 'cooldown', label: 'Cool-down · easy spin', target: 'RPE 3' },
      ],
      roi: { roi_toast: 'Short, sharp, and metabolically expensive.', roi_detail: 'Work above ventilatory threshold drives prolonged post-session oxygen debt, so fat oxidation continues for hours after you stop.', roi_primary_metric: '12-18h elevated EPOC' },
    };
  }
  if (tier === 'Tempo') {
    return {
      machine: 'Treadmill',
      steps: [
        { start_min: 0, end_min: 3, phase: 'warmup', label: 'Warm-up walk', target: '3.5 mph / 2% incline' },
        { start_min: 3, end_min: minutes - 3, phase: 'steady', label: 'Tempo · hold the line', target: '6.0 mph / 4% incline · RPE 7' },
        { start_min: minutes - 3, end_min: minutes, phase: 'cooldown', label: 'Cool-down', target: '3.0 mph flat' },
      ],
      roi: { roi_toast: 'The caloric-burn sweet spot without redlining the CNS.', roi_detail: 'Sustained tempo maximizes calories burned per minute while staying below the threshold that would tax tomorrow\'s lift.', roi_primary_metric: 'High caloric burn, low CNS cost' },
    };
  }
  return {
    machine: 'Incline Walk',
    steps: [
      { start_min: 0, end_min: 3, phase: 'warmup', label: 'Warm-up', target: '3.0 mph flat' },
      { start_min: 3, end_min: minutes - 3, phase: 'steady', label: 'Zone 2 · nasal breathing only', target: '3.5 mph / 8% incline · RPE 5' },
      { start_min: minutes - 3, end_min: minutes, phase: 'cooldown', label: 'Cool-down', target: '3.0 mph flat' },
    ],
    roi: { roi_toast: 'Builds the aerobic engine while sparing the CNS for tomorrow.', roi_detail: 'Zone 2 maximizes mitochondrial density and fat oxidation at an intensity that actively aids recovery.', roi_primary_metric: 'Mitochondrial density + CNS sparing' },
  };
}

async function callClaude(userMessage: string, apiKey: string, localeInput: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CLAUDE_TIMEOUT_MS);
  // Cached invariant prompt first (prefix cache hit), then the per-locale
  // directive as a separate uncached block so EN/ES/PT share the cached prefix.
  const requestBody = {
    model: MODEL, max_tokens: MAX_TOKENS,
    thinking: { type: 'adaptive' },
    output_config: { effort: EFFORT_DEFAULT, format: { type: 'json_schema', schema: RESPONSE_SCHEMA } },
    system: [
      { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: localeDirective(localeInput, 'the protocol labels, targets, and ROI prose') },
    ],
    messages: [{ role: 'user', content: userMessage }],
  };
  const t0 = Date.now();
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify(requestBody), signal: controller.signal,
    });
    const latencyMs = Date.now() - t0;
    let body: any; try { body = await res.json(); } catch (_) { body = null; }
    if (!res.ok) {
      const errMsg = (body && body.error && (body.error.message || body.error.type)) || `anthropic_${res.status}`;
      console.error(`[bbf-agentic-cardio] Anthropic error: status=${res.status}`);
      return { ok: false as const, error: errMsg, latencyMs };
    }
    return { ok: true as const, body, latencyMs };
  } catch (e) {
    const err = e as Error;
    return {
      ok: false as const,
      error: err.name === 'AbortError' ? `timeout_${CLAUDE_TIMEOUT_MS}ms` : err.message,
      latencyMs: Date.now() - t0,
    };
  } finally { clearTimeout(timeout); }
}

function extractTextBlock(content: any[]): string | null {
  if (!Array.isArray(content)) return null;
  for (const b of content) if (b && b.type === 'text' && typeof b.text === 'string') return b.text;
  return null;
}

function buildContract(opts: {
  uid: string; minutes: number; baseTier: Tier; effTier: Tier; cns: Cns;
  machine: string; steps: any[]; roi: any; source: 'claude' | 'fallback'; model: string | null;
  locale?: string;
}) {
  const { uid, minutes, baseTier, effTier, cns, machine, steps, roi, source, model, locale } = opts;
  return {
    ok: true,
    uid,
    locale: localeCode(locale),
    available_minutes: minutes,
    modality: {
      tier: effTier,
      machine,
      label: `${machine} — ${effTier}`,
      strategy: TIER_STRATEGY[effTier],
    },
    protocol_steps: steps,
    protocol_text: buildProtocolText(steps),
    total_minutes: totalMinutes(steps, minutes),
    cns_downregulation: {
      ...cns,
      base_tier: baseTier,
      effective_tier: effTier,
      down_regulated: baseTier !== effTier,
    },
    roi: { toast: roi.roi_toast, detail: roi.roi_detail, primary_metric: roi.roi_primary_metric },
    meta: { source, model, generated_at: new Date().toISOString() },
  };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')    return jsonResponse({ error: 'method_not_allowed' }, 405);

  // Client-facing endpoint: athletes call with the anon key (gateway routing),
  // NOT the admin token — so the old X-BBF-Admin-Token gate is removed (it locked
  // out real clients). Matches the bbf-agentic-prehab client pattern.
  //
  // TODO(auth): enforce per-user auth.uid() once the Supabase Auth client-login
  // cutover ships. auth.users is already backfilled with id=bbf_users.id
  // (migration 20260601120000), but clients cannot obtain a user JWT yet, so a
  // hard auth.uid() check would 401 every athlete today. Until that lands this
  // rides anon-key routing — recommend per-IP rate limiting to cap Opus burn.

  let payload: any;
  try { payload = await req.json(); } catch (_) { return jsonResponse({ error: 'invalid_json' }, 400); }
  const { available_minutes, admin_override } = payload || {};
  // Trilingual cloud generation — athlete's locale (EN/ES/PT), normalized.
  const locale = localeCode(payload?.locale ?? payload?.lang);

  if (admin_override === true) {
    const minutes = 10, tier: Tier = 'HIIT';
    const fb = fallbackSteps(tier, minutes);
    return jsonResponse(buildContract({
      uid: 'admin', minutes, baseTier: tier, effTier: tier,
      cns: { ...freshCns('unavailable', 'Admin bypass — CNS check skipped.') },
      machine: fb.machine, steps: fb.steps, roi: fb.roi, source: 'fallback', model: 'admin_override',
    }), 200);
  }

  let minutes = Number(available_minutes);
  if (!isFinite(minutes) || minutes <= 0) return jsonResponse({ error: 'invalid_minutes' }, 400);
  minutes = Math.max(MIN_MINUTES, Math.min(MAX_MINUTES, Math.round(minutes)));

  // Shared Supabase client (rate limiter + CNS read).
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  // ─── ENTITLEMENT GATE (FAIL-CLOSED) ────────────────────────────────────
  // Cardio routes to Opus 4.8 (cardiac_intercept). It must NEVER be triggerable
  // by an unentitled / anonymous caller bypassing the cosmetic UI lock. Identity
  // is resolved SERVER-SIDE from the vault bearer token (the body `uid` is not
  // trusted for auth). smart_cardio unlocks at Autonomous and up (Autonomous /
  // Fuel / God) per the CEO hierarchy; Baseline / Youth / none / locked → 403.
  const gate = await requireEntitlement({
    supabaseUrl: SUPABASE_URL,
    serviceKey:  SERVICE_KEY,
    vaultToken:  payload?.vault_token ?? req.headers.get('x-bbf-vault-token'),
    feature:     'smart_cardio',
  });
  if (!gate.ok) return jsonResponse({ error: gate.denial.error, detail: gate.denial.detail }, gate.denial.status);
  const uid = gate.ctx.uid || gate.ctx.user_id;   // server-authoritative identity

  const supa = (SUPABASE_URL && SERVICE_KEY)
    ? createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;

  // ─── Per-IP daily rate limit (DB-backed · mirrors bbf_prehab_rate_check) ──
  // Caps Opus spend per source IP per UTC day. Generous for genuine athletes
  // (a few protocols/day), hard ceiling for rapid-fire scripts. Fail-OPEN on a
  // DB hiccup so a real athlete is never blocked by infra.
  if (supa) {
    const ip  = clientIp(req);
    const cap = Math.max(1, Number(Deno.env.get('BBF_CARDIO_DAILY_CAP') || 40));
    const { data: rl, error: rlErr } = await supa.rpc('bbf_cardio_rate_check', { p_ip: ip, p_cap: cap });
    if (rlErr) {
      console.error('[bbf-agentic-cardio] rate-check failed (fail-open):', rlErr.message);
    } else if (Array.isArray(rl) && rl[0] && rl[0].allowed === false) {
      const now   = new Date();
      const reset = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
      const retry = Math.max(1, Math.ceil((reset - now.getTime()) / 1000));
      console.warn(`[bbf-agentic-cardio] rate-limited ip=${ip} count=${rl[0].current_count} cap=${cap}`);
      return new Response(
        JSON.stringify({ error: 'rate_limited', detail: 'Daily cardio limit reached. Resets at 00:00 UTC.', retry_after_seconds: retry }),
        { status: 429, headers: { ...CORS, 'Content-Type': 'application/json', 'Retry-After': String(retry) } },
      );
    }
  }

  // 1. Deterministic tier
  const baseTier = routeTier(minutes);

  // 2. CNS fatigue from bbf_sets → optional down-regulation
  let cns: Cns = freshCns('unavailable', 'Supabase unavailable — CNS defaulted to fresh.');
  if (supa) {
    cns = await evaluateCns(supa, uid);
  }
  const effTier = cns.down_regulate ? stepDown(baseTier) : baseTier;

  // 3. Claude writes machine + protocol_steps + ROI for the EFFECTIVE tier
  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  if (!ANTHROPIC_API_KEY) {
    const fb = fallbackSteps(effTier, minutes);
    return jsonResponse(buildContract({ uid, locale, minutes, baseTier, effTier, cns, machine: fb.machine, steps: fb.steps, roi: fb.roi, source: 'fallback', model: null }), 200);
  }

  const userMessage =
    `available_minutes: ${minutes}\n` +
    `strategy_tier (mandated — DO NOT OVERRIDE): "${TIER_STRATEGY[effTier]}"\n` +
    `tier_short_label: "${effTier}"\n` +
    `cns_note: ${cns.guidance}\n\n` +
    `Write the machine, the full protocol_steps (ending exactly at ${minutes} min), and the ROI fields. Return ONLY the JSON schema response.`;

  const result = await callClaude(userMessage, ANTHROPIC_API_KEY, locale);

  // Telemetry · one bbf_llm_calls row per Claude attempt (best-effort, awaited so
  // the edge runtime doesn't freeze the insert after the response is returned).
  const usage = result.ok ? (result.body?.usage ?? {}) : {};
  if (!result.ok) {
    await logLlmCall(supa, {
      agent: 'bbf-agentic-cardio', model: MODEL, ok: false,
      latencyMs: result.latencyMs, error: result.error, promptName: 'cardiac_intercept',
    });
    const fb = fallbackSteps(effTier, minutes);
    return jsonResponse(buildContract({ uid, locale, minutes, baseTier, effTier, cns, machine: fb.machine, steps: fb.steps, roi: fb.roi, source: 'fallback', model: MODEL }), 200);
  }

  const text = extractTextBlock(result.body?.content);
  let parsed: any = null;
  try { parsed = text ? JSON.parse(text) : null; } catch (_) { parsed = null; }

  const stepsOk = parsed && Array.isArray(parsed.protocol_steps) && parsed.protocol_steps.length > 0 &&
    typeof parsed.machine === 'string' && typeof parsed.roi_toast === 'string';
  if (!stepsOk) {
    // HTTP 200 but the schema came back unusable → still a fallback trigger; log
    // it as a soft failure so the dashboard separates "timeouts" from "bad output".
    await logLlmCall(supa, {
      agent: 'bbf-agentic-cardio', model: result.body?.model ?? MODEL, ok: false,
      latencyMs: result.latencyMs, error: 'schema_validation_failed',
      inputTokens: usage.input_tokens ?? null, outputTokens: usage.output_tokens ?? null,
      finishReason: result.body?.stop_reason ?? null, promptName: 'cardiac_intercept',
    });
    const fb = fallbackSteps(effTier, minutes);
    return jsonResponse(buildContract({ uid, locale, minutes, baseTier, effTier, cns, machine: fb.machine, steps: fb.steps, roi: fb.roi, source: 'fallback', model: MODEL }), 200);
  }

  await logLlmCall(supa, {
    agent: 'bbf-agentic-cardio', model: result.body?.model ?? MODEL, ok: true,
    latencyMs: result.latencyMs,
    inputTokens: usage.input_tokens ?? null, outputTokens: usage.output_tokens ?? null,
    finishReason: result.body?.stop_reason ?? null, promptName: 'cardiac_intercept',
  });

  console.log(`[bbf-agentic-cardio] uid=${uid} min=${minutes} base=${baseTier} eff=${effTier} cns=${cns.fatigue_level}(${cns.score}) model=${result.body?.model} latency_ms=${result.latencyMs}`);

  return jsonResponse(buildContract({
    uid, locale, minutes, baseTier, effTier, cns,
    machine: parsed.machine, steps: parsed.protocol_steps,
    roi: { roi_toast: parsed.roi_toast, roi_detail: parsed.roi_detail, roi_primary_metric: parsed.roi_primary_metric },
    source: 'claude', model: result.body?.model ?? MODEL,
  }), 200);
});

// ═══════════════════════════════════════════════════════════════════════
// FROZEN CONTRACT (for the Smart Cardio UI · Terminal 2 handoff)
// ───────────────────────────────────────────────────────────────────────
// 200 OK:
// {
//   "ok": true,
//   "uid": "akeem",
//   "available_minutes": 18,
//   "modality": {
//     "tier": "HIIT" | "Tempo" | "Zone 2",     // EFFECTIVE tier (post-CNS)
//     "machine": "Assault Bike",
//     "label": "Assault Bike — HIIT",
//     "strategy": "High-Intensity Interval Training (Max EPOC)"
//   },
//   "protocol_steps": [
//     { "start_min": 0, "end_min": 2, "phase": "warmup",  "label": "Warm-up · easy spin", "target": "RPE 4" },
//     { "start_min": 2, "end_min": 15, "phase": "work",   "label": "13 rounds · 30s/30s", "target": "RPE 9" },
//     { "start_min": 15, "end_min": 18, "phase": "cooldown","label": "Cool-down",          "target": "RPE 3" }
//   ],
//   "protocol_text": "00:00–02:00  Warm-up...\n...",   // backward-compat flat string
//   "total_minutes": 18,
//   "cns_downregulation": {
//     "fatigue_level": "fresh" | "moderate" | "elevated" | "redlined",
//     "score": 0-100,                  // higher = more fatigued
//     "window_days": 3,
//     "recent_sets": 42, "high_rpe_sets": 6, "avg_rpe": 7.4,
//     "biomechanical_redline": false,
//     "down_regulate": false,          // CNS verdict
//     "base_tier": "HIIT",             // what minutes alone prescribed
//     "effective_tier": "HIIT",        // after CNS down-regulation
//     "down_regulated": false,         // base_tier !== effective_tier
//     "source": "bbf_sets" | "unavailable",
//     "guidance": "6 high-RPE sets in 3d — CNS has headroom..."
//   },
//   "roi": { "toast": "...", "detail": "...", "primary_metric": "12-18h elevated EPOC" },
//   "meta": { "source": "claude" | "fallback", "model": "claude-opus-4-8", "generated_at": "...Z" }
// }
//
// phase enum: warmup | work | recovery | steady | cooldown
// Errors: { "error": "<slug>" } — 400 missing_uid/invalid_minutes/invalid_json, 401, 405.
// The function NEVER hard-fails the athlete: Claude/Supabase failures return
// a deterministic fallback in this same shape (meta.source="fallback").
// ═══════════════════════════════════════════════════════════════════════
