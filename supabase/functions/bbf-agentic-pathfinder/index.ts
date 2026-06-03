// bbf-agentic-pathfinder — Sovereign Sales Triage Comlink (Warhead 1)
// ─────────────────────────────────────────────────────────────────────
// Public-side high-ticket triage agent. Lives behind the "Access the
// Vault" widget on buildbelievefit.fitness. Acts as a confident sales
// closer for the three BBF tiers:
//
//   · Gateway          $67/mo         Self-guided Habit Architecture
//   · Architect Hybrid $697 flat      12-week hybrid online + Zoom
//   · Sovereign        $1,197 flat    12-week Apex Protocol · white-glove
//
// Conversation flow:
//   1. Greet, signal authority (Sovereign brand voice).
//   2. Triage in ≤4 exchanges: time/week, training goal, current
//      activity, basic body comp (for TDEE math).
//   3. Calculate Mifflin-St Jeor TDEE inline (no external tool call).
//   4. Recommend one of the three tiers with concrete rationale.
//   5. End the recommendation message with [[RECOMMEND:<tier>]] so the
//      widget can render the tier card + CTA button.
//
// Request shape:
//   POST /functions/v1/bbf-agentic-pathfinder
//   Content-Type: application/json
//   Body:
//   {
//     "messages": [
//       { "role": "user",      "content": "Hi, I'm short on time..." },
//       { "role": "assistant", "content": "..." },
//       ...
//     ],
//     "session_id": "optional-uuid"     // for future telemetry
//   }
//
// Response shape (200 OK):
//   {
//     "reply": "Conversational text with the [[RECOMMEND:x]] marker stripped",
//     "recommendation": null | { "tier": "gateway"|"architect"|"sovereign", "headline": "...", "stripe_cta": "selectTier('gateway')" },
//     "model_used": "claude-opus-4-7",
//     "tokens_used": { "input": N, "output": N }
//   }
//
// FAILURE POSTURE: always 200. On any upstream failure, returns a
// graceful fallback reply pointing the lead to akeem@buildbelievefit.fitness.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

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

// Phase 7 Workstream B · TDEE-fueled onboarding dialog. Sonnet 4.6 is
// the right tier per CEO routing rules.
import { routeAndLog } from '../_shared/model-router.ts';
import { localeDirective, localeCode } from '../_shared/locale.ts';

const MODEL              = routeAndLog('bbf-agentic-pathfinder', 'onboarding_interview');
const MAX_TOKENS         = 1024;
const CLAUDE_TIMEOUT_MS  = 18000;
const MAX_MESSAGES       = 24;        // hard ceiling on conversation depth per request
const MAX_MESSAGE_LEN    = 1500;      // hard ceiling on any single message

const TIER_MATRIX = {
  gateway: {
    name: 'Gateway',
    price: '$67/mo',
    headline: 'Self-guided Habit Architecture',
    fit: 'Time-limited (<3 hrs/wk), budget-conscious, ready to commit to the system but doing the work solo.',
    cta: "selectTier('gateway')",
  },
  architect: {
    name: 'Architect Hybrid',
    price: '$697 flat fee · 12-week protocol',
    headline: 'Hybrid online + Zoom check-ins',
    fit: '4-6 hrs/wk available, wants Coach Akeem in their corner with structured 12-week milestones.',
    cta: "selectTier('architect')",
  },
  sovereign: {
    name: 'Sovereign',
    price: '$1,197 flat fee · 12-week Apex Protocol',
    headline: 'White-glove · OT-informed prehab · daily coaching',
    fit: '6+ hrs/wk commitment, high-touch demand, joint-protection priority, executive / high-performer.',
    cta: "selectTier('sovereign')",
  },
};

const SYSTEM_PROMPT = [
  'You are the BBF Sovereign Pathfinder — a high-ticket triage agent representing Build Believe Fit LLC. You are NOT a chatbot. You are a performance architect screening leads for one of three tiers. Confidence, brevity, and authority are your operating posture. Sovereign brand voice: clinical precision, no hype, no exclamation marks.',
  '',
  '# THE THREE TIERS YOU TRIAGE INTO',
  '',
  '· **Gateway · $67/mo · Self-guided Habit Architecture**',
  '  For leads with <3 hrs/week training availability, budget-conscious, ready to commit but executing solo. Full Habit Architecture system + Founder-Verified Biomechanical Protocols accessible via the BBF app. No live coaching.',
  '',
  '· **Architect Hybrid · $697 flat fee · 12-week protocol**',
  '  For leads with 4-6 hrs/week, willing to invest in a structured 12-week journey with Coach Akeem providing Zoom check-ins + program adjustments. Mid-tier commitment.',
  '',
  '· **Sovereign · $1,197 flat fee · 12-week Apex Protocol**',
  '  For executives, high-demand professionals, returning athletes, anyone over 35 with joint protection concerns, or anyone with 6+ hrs/week and budget for premium. OT-informed prehab, daily coaching, white-glove. The Sovereign Gold Standard.',
  '',
  '# CONVERSATION DISCIPLINE',
  '',
  '1. **Opening turn**: greet briefly. Signal authority. Ask ONE qualifying question to start triage (their goal OR their time availability — pick the more useful one based on context).',
  '2. **Turns 2-3**: gather the missing data points. You need: training goal (recomp / strength / longevity / sport / weight loss), available hours/week, current activity level, age + biological sex + weight + height (for TDEE math).',
  '3. **Turn 3 or 4 max**: do the TDEE math inline using Mifflin-St Jeor:',
  '     · Men:   BMR = (10 × kg) + (6.25 × cm) − (5 × age) + 5',
  '     · Women: BMR = (10 × kg) + (6.25 × cm) − (5 × age) − 161',
  '     · TDEE = BMR × activity multiplier (sedentary 1.2 / light 1.375 / moderate 1.55 / heavy 1.725 / very heavy 1.9)',
  '     Mention the TDEE number naturally as part of your read on their case.',
  '4. **Recommendation turn**: confidently recommend the tier that fits. Don\'t apologize for the price. Give a 1-sentence rationale tied to THEIR situation. End the message with the marker `[[RECOMMEND:gateway]]` or `[[RECOMMEND:architect]]` or `[[RECOMMEND:sovereign]]` on a new line.',
  '',
  '# OUTPUT RULES',
  '',
  '· Plain text only. No markdown headers. Brevity is dominance.',
  '· Maximum 4 sentences per turn until the recommendation turn.',
  '· The recommendation turn can be 5-6 sentences max.',
  '· No exclamation marks. No emoji except 🎯 once on the recommendation turn if it lands naturally.',
  '· Address them by what they shared (their goal, their constraint).',
  '· If a lead asks an irrelevant question or tries to derail (random fitness trivia, etc.), pull the conversation back to triage in one sentence.',
  '· If a lead clearly cannot afford ANY tier or seems hostile, politely route them to a free resource: "Bookmark buildbelievefit.fitness — the public Habit Architecture content is free. When the timing is right, you know where to find us."',
  '',
  '# THE MARKER',
  '',
  'Exactly when you commit to a tier recommendation, append this on its own line at the very end of your message:',
  '  [[RECOMMEND:gateway]]    OR    [[RECOMMEND:architect]]    OR    [[RECOMMEND:sovereign]]',
  'The widget parses this and renders a clickable tier card. Do NOT mention the marker text in any other context. Only use it once per conversation.',
].join('\n');

async function callClaude(
  messages: Array<{ role: string; content: string }>,
  apiKey: string,
  localeInput: string,
): Promise<{ ok: true; text: string; usage: { input: number; output: number } } | { ok: false; error: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CLAUDE_TIMEOUT_MS);

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:       MODEL,
        max_tokens:  MAX_TOKENS,
        system: [
          { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: localeDirective(localeInput, 'the reply to the prospect') },
        ],
        messages,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      return { ok: false, error: 'Anthropic ' + res.status + ': ' + txt.slice(0, 200) };
    }

    const data = await res.json();
    const block = (data.content || []).find((c: { type: string }) => c.type === 'text');
    const text  = block && typeof block.text === 'string' ? block.text : '';
    const usage = {
      input:  (data.usage && data.usage.input_tokens)  || 0,
      output: (data.usage && data.usage.output_tokens) || 0,
    };
    return { ok: true, text, usage };
  } catch (e) {
    clearTimeout(timeout);
    const msg = e && (e as Error).message ? (e as Error).message : String(e);
    return { ok: false, error: 'fetch ' + msg };
  }
}

/**
 * Pulls the [[RECOMMEND:<tier>]] marker out of Claude's reply if present.
 * Returns the cleaned reply text + the structured tier card (or null).
 */
function extractRecommendation(reply: string): { cleaned: string; recommendation: object | null } {
  const re = /\[\[RECOMMEND:(gateway|architect|sovereign)\]\]/i;
  const m  = reply.match(re);
  if (!m) return { cleaned: reply.trim(), recommendation: null };

  const tierKey = m[1].toLowerCase() as keyof typeof TIER_MATRIX;
  const tier    = TIER_MATRIX[tierKey];
  if (!tier) return { cleaned: reply.replace(re, '').trim(), recommendation: null };

  return {
    cleaned: reply.replace(re, '').trim(),
    recommendation: {
      tier:        tierKey,
      name:        tier.name,
      price:       tier.price,
      headline:    tier.headline,
      fit:         tier.fit,
      stripe_cta:  tier.cta,
    },
  };
}

function fallbackReply(): { reply: string; recommendation: null } {
  return {
    reply: [
      'The triage system is offline for a moment.',
      'Text Akeem directly at akeem@buildbelievefit.fitness or visit the pricing section on this page to choose your tier.',
      'The Sovereign Gold Standard is waiting.',
    ].join(' '),
    recommendation: null,
  };
}

function sanitizeMessages(raw: unknown): Array<{ role: string; content: string }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ role: string; content: string }> = [];
  for (const m of raw.slice(-MAX_MESSAGES)) {
    if (!m || typeof m !== 'object') continue;
    const role    = (m as { role?: string }).role;
    const content = (m as { content?: string }).content;
    if (role !== 'user' && role !== 'assistant') continue;
    if (typeof content !== 'string') continue;
    const trimmed = content.slice(0, MAX_MESSAGE_LEN).trim();
    if (!trimmed) continue;
    out.push({ role, content: trimmed });
  }
  return out;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  if (req.method !== 'POST') {
    return jsonResponse({ reply: 'Use POST.', recommendation: null }, 405);
  }

  // ─── Parse + validate ─────────────────────────────────────
  let payload: { messages?: unknown; session_id?: unknown; locale?: unknown; lang?: unknown } = {};
  try { payload = await req.json(); }
  catch { return jsonResponse({ ...fallbackReply(), model_used: MODEL, tokens_used: { input: 0, output: 0 } }); }

  const messages = sanitizeMessages(payload.messages);
  const locale = localeCode((payload?.locale ?? payload?.lang) as string | null | undefined);
  if (!messages.length) {
    return jsonResponse({
      reply:          'Welcome to BBF Pathfinder. State your training goal or your weekly time availability — whichever is the binding constraint.',
      recommendation: null,
      model_used:     MODEL,
      tokens_used:    { input: 0, output: 0 },
    });
  }
  if (messages[messages.length - 1].role !== 'user') {
    return jsonResponse({ ...fallbackReply(), model_used: MODEL, tokens_used: { input: 0, output: 0 } });
  }

  // ─── Anthropic call ───────────────────────────────────────
  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  if (!ANTHROPIC_API_KEY) {
    console.error('[bbf-agentic-pathfinder] ANTHROPIC_API_KEY missing — fallback');
    return jsonResponse({ ...fallbackReply(), model_used: MODEL, tokens_used: { input: 0, output: 0 } });
  }

  const result = await callClaude(messages, ANTHROPIC_API_KEY, locale);
  if (!result.ok) {
    console.error('[bbf-agentic-pathfinder] Claude failure:', result.error);
    return jsonResponse({ ...fallbackReply(), model_used: MODEL, tokens_used: { input: 0, output: 0 } });
  }

  const { cleaned, recommendation } = extractRecommendation(result.text);

  return jsonResponse({
    reply:          cleaned || fallbackReply().reply,
    recommendation: recommendation,
    locale,
    model_used:     MODEL,
    tokens_used:    result.usage,
  });
});
