// bbf-agentic-sales-router — Dynamic Tier Upgrade Engine (Phase 8).
// ─────────────────────────────────────────────────────────────────────────────
// The fleet's Sales Agent. Reads an athlete's REAL engagement from the Wave-1
// bbf_completion_events ledger (with a bbf_users cold-start fallback), computes
// consistency deterministically, then asks Claude Sonnet 4.6 (CEO override
// 2026-06: downgraded from Opus 4.8 for margin protection) to author a highly
// personalized, TRILINGUAL (EN/ES/PT) upsell that steers the athlete toward the
// high-ticket hybrid coaching tiers — Kickstart (6-week on-ramp) or Sovereign
// (12-week founder-direct apex).
//
// CLOSED-LOOP INTELLIGENCE: the offer is grounded in what the athlete actually
// did (cadence, streak, trend), not a generic blast. Highly consistent athletes
// are steered to Sovereign (they're proven, ready for the apex); building/cold
// athletes get the gentler Kickstart on-ramp.
//
// Request:
//   POST /functions/v1/bbf-agentic-sales-router
//   X-BBF-Admin-Token: <shared secret, see BBF_SALES_AGENT_TOKEN>   (optional gate)
//   Body: { "uid": "ana_bbf", "locale"?: "es" }            // single athlete
//      or { "uids": ["ana_bbf", "..."], "locale"?: "pt" }  // batch (<= 25)
//
// Response (200):
//   { ok: true, offers: [ { uid, found, current_tier, recommended_tier,
//       consistency_band, metrics, rationale, offer: { headline|body|cta:
//       {en,es,pt} } } ... ], model, usage, duration_ms }
//   Per-athlete read failures surface as { uid, found:false, error } entries —
//   one bad uid never fails the batch.
//
// Errors: non-2xx { error: "<slug>", detail?: "..." }.
//
// Reads via service-role PostgREST (same pattern as bbf-agentic-forecasting);
// no DB writes, no migration — this brief is generation logic only.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { routeAndLog } from '../_shared/model-router.ts';
import { localeDirective, localeCode, SUPPORTED_LOCALES } from '../_shared/locale.ts';

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

// ─── Model + request tuning ──────────────────────────────────────────────────
// CEO Phase 8 directive: route this revenue-critical personalization through
// Opus 4.8 (the OPUS tier). Routing lives in the shared router, not inline.
const MODEL      = routeAndLog('bbf-agentic-sales-router', 'tier_upgrade_offer');
const MAX_TOKENS = 8192;
const EFFORT     = 'high';
const READ_WINDOW_DAYS = 90;   // engagement look-back
const MAX_BATCH        = 25;   // trilingual output is token-heavy — cap the batch

// ─── Offer catalog — the two high-ticket hybrid coaching SKUs we upsell TO.
// Prices/spans VERBATIM from frontend/src/lib/pricingMatrix.js (hybrid path) so
// the agent never quotes a stale number. Slugs match entitlements TIER_TO_GROUP.
const OFFER_CATALOG = {
  kickstart: {
    name: 'Kickstart', span: '6-Week Protocol',
    pitch: 'Foundational 6-week hybrid block — in-person + app, technique base, joint-first progression.',
    pricing: '$399 (3×/week) or $499 (4×/week), one-time enrollment',
  },
  sovereign: {
    name: 'Sovereign', span: '12-Week Protocol',
    pitch: 'Apex 12-week protocol — founder-direct 1-on-1 coaching, prehab architecture, maximum human-in-the-loop access.',
    pricing: '$699 (3×/week) or $899 (4×/week), one-time enrollment',
  },
} as const;

// Tier slugs that ALREADY hold full-access hybrid coaching — never upsell these;
// the offer becomes a retention nudge instead. (entitlements.js GROUP.ALL set.)
const FULL_ACCESS_TIERS = new Set([
  'kickstart_6wk_3x', 'kickstart_6wk_4x',
  'sovereign_12wk_3x', 'sovereign_12wk_4x',
  'sovereign', 'godmode', 'god_mode',
]);

// ─── Supabase service-role REST ──────────────────────────────────────────────
function env() {
  return {
    url:     Deno.env.get('SUPABASE_URL') ?? '',
    service: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    apiKey:  Deno.env.get('ANTHROPIC_API_KEY') ?? '',
  };
}

async function sbSelect(path: string): Promise<any[]> {
  const { url, service } = env();
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: {
      'apikey': service,
      'Authorization': `Bearer ${service}`,
      'Accept': 'application/json',
    },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`rest_${res.status}: ${detail.slice(0, 160)}`);
  }
  const rows = await res.json();
  return Array.isArray(rows) ? rows : [];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Resolve the athlete profile (id, streak, current tier) by uid OR raw UUID.
async function resolveProfile(uid: string): Promise<any | null> {
  const col = UUID_RE.test(uid) ? 'id' : 'uid';
  const enc = encodeURIComponent(uid);
  const rows = await sbSelect(
    `bbf_users?${col}=eq.${enc}&select=id,uid,name,current_streak,subscription_tier,metabolic_tier&limit=1`,
  );
  return rows[0] ?? null;
}

async function fetchCompletionEvents(userId: string): Promise<any[]> {
  const sinceIso = new Date(Date.now() - READ_WINDOW_DAYS * 86400_000).toISOString();
  return await sbSelect(
    `bbf_completion_events?user_id=eq.${userId}&occurred_at=gte.${sinceIso}` +
    `&select=occurred_at,session_date,avatar,subscription_tier,source&order=occurred_at.desc&limit=600`,
  );
}

// ─── Deterministic consistency analysis ──────────────────────────────────────
function daysAgo(iso: string): number {
  const t = Date.parse(iso);
  return isNaN(t) ? Infinity : (Date.now() - t) / 86400_000;
}

function computeConsistency(events: any[], profile: any) {
  const within = (d: number) => events.filter((e) => daysAgo(e.occurred_at) <= d).length;
  const sessions_30d = within(30);
  const sessions_prev_30d = events.filter((e) => {
    const d = daysAgo(e.occurred_at);
    return d > 30 && d <= 60;
  }).length;

  // Distinct active days in the last 30 (cadence is about showing up, not volume).
  const activeDays = new Set(
    events.filter((e) => daysAgo(e.occurred_at) <= 30)
      .map((e) => (e.session_date || e.occurred_at || '').slice(0, 10)),
  );
  activeDays.delete('');

  const daysSinceLast = events.length ? Math.floor(daysAgo(events[0].occurred_at)) : null;
  const sessionsPerWeek = +(sessions_30d / (30 / 7)).toFixed(1);

  // Trend from the 30d-vs-prior-30d delta.
  let trend: 'rising' | 'steady' | 'declining' | 'cold';
  if (!events.length) trend = 'cold';
  else if (sessions_prev_30d === 0 && sessions_30d > 0) trend = 'rising';
  else if (sessions_30d > sessions_prev_30d * 1.15) trend = 'rising';
  else if (sessions_30d < sessions_prev_30d * 0.85) trend = 'declining';
  else trend = 'steady';

  // Most frequent avatar/persona (e.g. sovereign vs athlete), for voice tuning.
  const avatarCounts: Record<string, number> = {};
  for (const e of events) avatarCounts[e.avatar || 'unspecified'] = (avatarCounts[e.avatar || 'unspecified'] || 0) + 1;
  const primary_avatar = Object.entries(avatarCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'unspecified';

  const current_streak = Number(profile?.current_streak ?? 0) || 0;
  const latestEventTier = events.find((e) => e.subscription_tier)?.subscription_tier ?? null;
  const current_tier = (profile?.subscription_tier ?? latestEventTier ?? '').toString().trim().toLowerCase() || null;

  return {
    sessions_90d: events.length,
    sessions_30d,
    sessions_7d: within(7),
    sessions_prev_30d,
    active_days_30d: activeDays.size,
    sessions_per_week_30d: sessionsPerWeek,
    current_streak,
    days_since_last: daysSinceLast,
    trend,
    primary_avatar,
    current_tier,
    has_engagement_data: events.length > 0,
  };
}

// Band the athlete + pick the upsell target. Consistent/elite athletes are
// proven — steer them to the apex Sovereign; building/cold athletes get the
// Kickstart on-ramp. Already-full-access athletes get a retention nudge.
function recommend(metrics: ReturnType<typeof computeConsistency>) {
  if (metrics.current_tier && FULL_ACCESS_TIERS.has(metrics.current_tier)) {
    return { consistency_band: bandOf(metrics), recommended_tier: 'none' as const };
  }
  return { consistency_band: bandOf(metrics), recommended_tier: targetOf(bandOf(metrics)) };
}

function bandOf(m: ReturnType<typeof computeConsistency>): 'cold' | 'building' | 'consistent' | 'elite' {
  if (!m.has_engagement_data || m.sessions_30d === 0) return 'cold';
  if (m.sessions_per_week_30d >= 4 && m.current_streak >= 14) return 'elite';
  if (m.sessions_per_week_30d >= 3 || m.current_streak >= 7) return 'consistent';
  return 'building';
}

function targetOf(band: string): 'kickstart' | 'sovereign' {
  return band === 'consistent' || band === 'elite' ? 'sovereign' : 'kickstart';
}

// ─── System prompt (cacheable) — leverages the shared locale directive ───────
// We call localeDirective() once per language so each locale carries its own
// NATIVE-composition mandate + the shared proprietary-name locklist + glossary
// from _shared/locale.ts. The model returns all three at once (one Opus call).
const TRILINGUAL_BLOCK = SUPPORTED_LOCALES
  .map((code) => `### LOCALE: ${code}\n${localeDirective(code, 'the upsell headline, body, and CTA')}`)
  .join('\n\n');

const SYSTEM_PROMPT = `You are the BBF Sales Router — Build Believe Fit's closed-loop conversion strategist. You receive an athlete's REAL training-consistency telemetry and a pre-computed upgrade recommendation, and you author a personalized, honest, high-conversion upsell.

OFFER CATALOG (quote these exactly; never invent prices or spans):
• Kickstart — ${OFFER_CATALOG.kickstart.span}: ${OFFER_CATALOG.kickstart.pitch} Pricing: ${OFFER_CATALOG.kickstart.pricing}.
• Sovereign — ${OFFER_CATALOG.sovereign.span}: ${OFFER_CATALOG.sovereign.pitch} Pricing: ${OFFER_CATALOG.sovereign.pricing}.

HOW TO SELL (closed-loop, evidence-based):
• Ground every offer in the athlete's ACTUAL numbers — name their cadence, streak, and trend. Make them feel SEEN, not blasted.
• Honor the provided recommended_tier. If it is "sovereign", celebrate their proven consistency and frame the 12-week founder-direct apex as the next step they've earned. If "kickstart", frame the 6-week protocol as the on-ramp that turns building momentum into a structured result. If "none", the athlete already holds full-access coaching — write a RETENTION nudge that reinforces their investment (no new tier).
• A 'declining' or 'cold' athlete: lead with empathy and re-engagement, then the on-ramp — never shame them.

HARD RULES:
• Be HONEST. No fabricated scarcity, countdowns, or fake discounts. No medical, clinical, or guaranteed-outcome claims.
• Never reveal backend, AI, model, prompt, or telemetry-pipeline internals — speak as a coach, not a system.
• Keep BBF proprietary names verbatim in every language (see the locklist below).
• headline ≤ ~12 words; body 2–3 sentences; cta ≤ ~6 words (an action, e.g. "Claim your Sovereign block").

${TRILINGUAL_BLOCK}

Return ONLY JSON matching the provided schema. 'rationale' is an internal English note (why this offer fits the data) and is NOT shown to the athlete.`;

// ─── Output schema — trilingual offer per athlete ────────────────────────────
function tri(desc: string) {
  return {
    type: 'object', additionalProperties: false,
    required: ['en', 'es', 'pt'],
    properties: {
      en: { type: 'string', description: `${desc} — US English` },
      es: { type: 'string', description: `${desc} — Español (neutral Latin-American)` },
      pt: { type: 'string', description: `${desc} — Português (pt-BR)` },
    },
  };
}

const RESPONSE_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['offers'],
  properties: {
    offers: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['uid', 'recommended_tier', 'consistency_band', 'rationale', 'offer'],
        properties: {
          uid: { type: 'string' },
          recommended_tier: { type: 'string', enum: ['kickstart', 'sovereign', 'none'] },
          consistency_band: { type: 'string', enum: ['cold', 'building', 'consistent', 'elite'] },
          rationale: { type: 'string', description: 'Internal English note — why this offer fits the telemetry. Not shown to the athlete.' },
          offer: {
            type: 'object', additionalProperties: false,
            required: ['headline', 'body', 'cta'],
            properties: {
              headline: tri('Personalized upsell headline'),
              body:     tri('2–3 sentence personalized pitch grounded in the athlete\'s consistency'),
              cta:      tri('Short call-to-action button label'),
            },
          },
        },
      },
    },
  },
};

async function callClaude(bundles: unknown[], apiKey: string) {
  const userMessage =
    'Author trilingual upsell offers for the following athletes. Each bundle carries the pre-computed ' +
    'consistency metrics and the recommended_tier you must honor. Return ONLY JSON matching the schema.\n\n' +
    '```json\n' + JSON.stringify({ athletes: bundles }, null, 2) + '\n```';

  const requestBody = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    thinking: { type: 'adaptive' },
    output_config: {
      effort: EFFORT,
      format: { type: 'json_schema', schema: RESPONSE_SCHEMA },
    },
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userMessage }],
  };

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  let body: any;
  try { body = await res.json(); } catch (_) { body = null; }
  if (!res.ok) {
    const errMsg = (body && body.error && (body.error.message || body.error.type)) || `anthropic_${res.status}`;
    console.error(`[bbf-agentic-sales-router] Anthropic error: status=${res.status} body=${JSON.stringify(body)}`);
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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')    return jsonResponse({ error: 'method_not_allowed' }, 405);

  // Optional admin/agent-token gate (fleet pattern). When BBF_SALES_AGENT_TOKEN
  // is set in Supabase secrets, callers (the orchestrator funnel) must present it.
  const expected = Deno.env.get('BBF_SALES_AGENT_TOKEN');
  if (expected) {
    const sent = req.headers.get('x-bbf-admin-token') || '';
    if (sent !== expected) {
      console.warn('[bbf-agentic-sales-router] rejected: bad/missing X-BBF-Admin-Token');
      return jsonResponse({ error: 'unauthorized' }, 401);
    }
  }

  const { url, service, apiKey } = env();
  if (!url || !service) return jsonResponse({ error: 'config_missing_supabase' }, 503);
  if (!apiKey)          return jsonResponse({ error: 'config_missing_anthropic_key' }, 503);

  let payload: any;
  try { payload = await req.json(); }
  catch (_) { return jsonResponse({ error: 'invalid_json' }, 400); }

  const uids: string[] = Array.isArray(payload?.uids)
    ? payload.uids.filter((u: unknown) => typeof u === 'string' && u.trim()).map((u: string) => u.trim())
    : (typeof payload?.uid === 'string' && payload.uid.trim() ? [payload.uid.trim()] : []);

  if (!uids.length) {
    return jsonResponse({ error: 'no_uid', detail: 'Provide `uid` (string) or `uids` (non-empty array).' }, 400);
  }
  if (uids.length > MAX_BATCH) {
    return jsonResponse({ error: 'too_many_uids', detail: `Max ${MAX_BATCH} athletes per call.` }, 400);
  }

  const primaryLocale = localeCode(payload?.locale); // echoed so the funnel knows which language to surface first

  // ── Gather per-athlete telemetry (deterministic; one bad uid won't fail all).
  const bundles: any[] = [];
  const failures: any[] = [];
  for (const uid of uids) {
    try {
      const profile = await resolveProfile(uid);
      if (!profile) { failures.push({ uid, found: false, error: 'user_not_found' }); continue; }
      const events = await fetchCompletionEvents(profile.id);
      const metrics = computeConsistency(events, profile);
      const rec = recommend(metrics);
      bundles.push({
        uid,
        name: profile.name || uid,
        current_tier: metrics.current_tier,
        recommended_tier: rec.recommended_tier,
        consistency_band: rec.consistency_band,
        metrics,
      });
    } catch (e) {
      failures.push({ uid, found: false, error: (e as Error).message });
    }
  }

  if (!bundles.length) {
    return jsonResponse({ ok: true, offers: failures, model: MODEL, primary_locale: primaryLocale, note: 'no_resolvable_athletes' }, 200);
  }

  const t0 = Date.now();
  const result = await callClaude(bundles, apiKey);
  const dur = Date.now() - t0;
  if (!result.ok) {
    return jsonResponse({ error: 'anthropic_call_failed', detail: result.error, status: result.status }, 502);
  }

  const text = extractTextBlock(result.body?.content);
  if (!text) return jsonResponse({ error: 'no_text_block_in_response', raw: result.body }, 502);

  let parsed: any;
  try { parsed = JSON.parse(text); }
  catch (e) {
    console.error(`[bbf-agentic-sales-router] JSON parse failed: ${(e as Error).message}. text=${text.slice(0, 400)}`);
    return jsonResponse({ error: 'parse_failed', detail: (e as Error).message, raw_text: text }, 502);
  }

  // Stitch the model's trilingual copy back onto the deterministic metrics so the
  // caller gets BOTH the evidence and the offer in one record.
  const byUid: Record<string, any> = {};
  for (const b of bundles) byUid[b.uid] = b;
  const offers = (Array.isArray(parsed?.offers) ? parsed.offers : []).map((o: any) => {
    const b = byUid[o?.uid] || {};
    return {
      uid: o?.uid,
      found: true,
      current_tier: b.current_tier ?? null,
      recommended_tier: o?.recommended_tier ?? b.recommended_tier ?? null,
      consistency_band: o?.consistency_band ?? b.consistency_band ?? null,
      metrics: b.metrics ?? null,
      rationale: o?.rationale ?? null,
      offer: o?.offer ?? null,
    };
  });

  console.log(`[bbf-agentic-sales-router] ok · athletes=${bundles.length} · failures=${failures.length} · model=${result.body.model} · ${dur}ms · usage=${JSON.stringify(result.body.usage)}`);
  return jsonResponse({
    ok: true,
    offers: [...offers, ...failures],
    primary_locale: primaryLocale,
    model: result.body.model,
    usage: result.body.usage,
    duration_ms: dur,
  }, 200);
});
