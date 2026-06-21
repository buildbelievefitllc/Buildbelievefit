// ═══════════════════════════════════════════════════════════════════════
// supabase/functions/bbf-ai-hub/index.ts
// Phase 19 · AI API Injection — the BBF AI Hub (chatbox brain)
// ───────────────────────────────────────────────────────────────────────
// Backend brain for the public-facing BBF Chatbox. Phase 17/18 built the
// React chat UI (`frontend/src/components/BBFChatbox.jsx`) with a
// keyword-routed PLACEHOLDER reply; Phase 18 established the dynamic
// TIER_MATRIX + SALES_DIRECTIVES + system-prompt builder in
// `frontend/src/lib/chatboxContext.js`. This function is the live
// Anthropic wiring that replaces the placeholder.
//
// The chatbox is a SALES CLOSER, not a generic FAQ bot — it qualifies the
// prospect, recommends ONE tier, and drives toward the Pathfinder
// application. Guardrails (no improvised prices, no medical advice, route
// health concerns to PAR-Q) live in the system prompt below.
//
// Request shape:
//   POST /functions/v1/bbf-ai-hub
//   Content-Type: application/json
//   Body:
//   {
//     "messages": [
//       { "role": "user",      "content": "how much is it?" },
//       { "role": "assistant", "content": "..." },
//       { "role": "user",      "content": "I have a bad knee" }
//     ],
//     "lang": "en" | "es" | "pt",        // optional · default: mirror user
//     "tierMatrix": [ ...TierObjects ]   // optional · see note below
//   }
//
// Response shape (200 OK):
//   {
//     "ok": true,
//     "reply": "2-4 sentence closer reply",
//     "cta":   "pathfinder" | "tdee" | null,   // drop-in for BBFChatbox cta
//     "model": "claude-sonnet-4-6",
//     "usage": { input_tokens, output_tokens, cache_read_input_tokens, ... }
//   }
//
// Errors return non-2xx with { "error": "<slug>", "detail"?: "..." }.
//
// ⚠️ PRICING SINGLE-SOURCE-OF-TRUTH NOTE:
//   Prices are business-critical. The authoritative TIER_MATRIX lives in
//   `frontend/src/lib/chatboxContext.js` (CEO-owned, Phase 18). A Deno edge
//   function cannot import that frontend ESM module, so to avoid silent
//   price drift the frontend SHOULD pass its live matrix in the request
//   body (`tierMatrix`) — that always wins. The DEFAULT_TIER_MATRIX below
//   is a fallback mirror for standalone/uncooperative callers and MUST be
//   kept in sync with chatboxContext.js until a shared module is extracted.
//
//   ENTITLEMENT BRIDGE: each tier may carry `unlocks[]` — the paid surfaces it
//   unlocks vs. a lower tier (e.g. Momentum $19.99 → Prehab). On the live request
//   this is DERIVED from frontend `lib/entitlements.js` (the Vault's unlock SoT)
//   and arrives in `tierMatrix`; the fallback below hand-mirrors it. (We bridge
//   entitlements.js, not the bbf_tiers table: bbf_tiers is pricing-only — no
//   feature/unlock columns — and is RLS service-role-only, so it can't tell the
//   agent what a tier unlocks. entitlements.js is the unlock source of truth.)
// ═══════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { routeAndLog } from '../_shared/model-router.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// ─── Model selection (router — never hardcode a model string · CLAUDE.md §4)
const MODEL      = routeAndLog('bbf-ai-hub', 'sales_chat');
const MAX_TOKENS = 1024; // closer replies are tight (2-4 sentences)

// ─── Request guardrails (public endpoint — basic abuse limits) ──────────
const MAX_MESSAGES     = 40;   // a long but bounded conversation
const MAX_CONTENT_CHARS = 4000; // per message

// ─── Abuse protection (verify_jwt is false — public endpoint) ───────────
// Two lightweight layers guard Anthropic spend before marketing traffic:
//   1. Origin allowlist — blocks browser calls from non-BBF sites.
//   2. Per-IP token bucket — caps burst + sustained request rate.
// ⚠️ The token bucket is in-memory and therefore PER EDGE ISOLATE. It
// throttles a single abuser hammering a warm instance, but is NOT a global
// guarantee across cold starts / parallel isolates. For a hard cross-instance
// limit, back it with Postgres/Redis (tracked follow-up). This is the
// "lightweight" first line of defense, deliberately dependency-free.

// Origin allowlist · comma-separated env (e.g. "https://buildbelievefit.fitness").
// If unset, origin enforcement is skipped (fail-open) so we never silently
// break the site before the list is confirmed — set BBF_ALLOWED_ORIGINS to arm it.
const ALLOWED_ORIGINS = (Deno.env.get('BBF_ALLOWED_ORIGINS') || '')
  .split(',').map((s) => s.trim()).filter(Boolean);

// Token-bucket tuning (env-overridable). Burst = capacity; rate = refill.
const RL_BURST         = Number(Deno.env.get('BBF_RL_BURST')   || 8);   // max burst per IP
const RL_PER_MIN       = Number(Deno.env.get('BBF_RL_PER_MIN') || 15);  // sustained req/min per IP
const RL_REFILL_PER_MS = RL_PER_MIN / 60_000;
const RL_IDLE_TTL_MS   = 10 * 60_000; // prune buckets idle > 10 min

interface Bucket { tokens: number; last: number }
const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

// Returns null if allowed, or a 403 Response if the Origin is rejected.
function checkOrigin(req: Request): Response | null {
  if (ALLOWED_ORIGINS.length === 0) return null;   // enforcement disabled
  const origin = req.headers.get('origin');
  if (!origin) return null;                         // non-browser caller — rate limit covers it
  if (ALLOWED_ORIGINS.includes(origin)) return null;
  console.warn(`[bbf-ai-hub] rejected origin: ${origin}`);
  return jsonResponse({ error: 'origin_not_allowed' }, 403);
}

// Token-bucket rate limit. Returns null if allowed, or a 429 Response.
function rateLimit(ip: string): Response | null {
  const now = Date.now();

  // Opportunistic prune so the Map can't grow unbounded under attack.
  if (now - lastSweep > RL_IDLE_TTL_MS) {
    for (const [k, b] of buckets) {
      if (now - b.last > RL_IDLE_TTL_MS) buckets.delete(k);
    }
    lastSweep = now;
  }

  let b = buckets.get(ip);
  if (!b) { b = { tokens: RL_BURST, last: now }; buckets.set(ip, b); }

  // Refill proportional to elapsed time, capped at burst.
  b.tokens = Math.min(RL_BURST, b.tokens + (now - b.last) * RL_REFILL_PER_MS);
  b.last = now;

  if (b.tokens < 1) {
    const retrySec = Math.max(1, Math.ceil((1 - b.tokens) / RL_REFILL_PER_MS / 1000));
    return new Response(
      JSON.stringify({ error: 'rate_limited', detail: `Too many requests. Retry in ~${retrySec}s.` }),
      { status: 429, headers: { ...CORS, 'Content-Type': 'application/json', 'Retry-After': String(retrySec) } },
    );
  }
  b.tokens -= 1;
  return null;
}

// ─── Fallback tier matrix · KEEP IN SYNC with chatboxContext.js ─────────
// Mirror of Phase 18 `frontend/src/lib/chatboxContext.js`. Used ONLY when
// the request omits `tierMatrix`. See the single-source-of-truth note above.
interface TierOption { label: string; price: string }
interface Tier {
  id: string;
  category: string;
  name: string;
  price: string;
  cadence: string;
  model: string;
  bestFor: string;
  highlights: string[];
  options?: TierOption[];
  // Premium surfaces this tier unlocks vs. a lower tier in the same path. On the
  // live request this is DERIVED from entitlements.js (frontend chatboxContext.js)
  // and shipped in `tierMatrix`; the fallback mirror below hand-mirrors it.
  unlocks?: string[];
}

// Custom Local Weekly training is by-quote only (no fixed price) — route to email.
const CUSTOM_QUOTE_EMAIL = 'buildbelievefitllc@buildbelievefit.fitness';

// Mirror of chatboxContext.js TIER_MATRIX (2026-06 marketing matrix). Slugs in
// the comments map to the canonical Stripe SKUs in stripe-webhook/index.ts.
// Hybrid dual pricing = session frequency (3x/week vs 4x/week). `unlocks` mirrors
// what chatboxContext.js derives from entitlements.js (Momentum/Autonomous/Hybrid
// → Prehab; Catalyst keeps it padlocked — that gap is the upsell hook).
const DEFAULT_TIER_MATRIX: Tier[] = [
  // ── Category 1 · Online Fitness — app + AI, self-directed, monthly ──
  {
    id: 'catalyst', // stripe: catalyst
    category: 'Online Fitness',
    name: 'Catalyst',
    price: '$9.99',
    cadence: '/mo',
    model: 'Online only · app + AI · self-directed',
    bestFor: 'Newcomers who want a structured starting point and will build the habit on their own.',
    highlights: [
      'Full BBF App access',
      'Foundational strength + conditioning programs',
      'Workout + progress tracking',
      'Trilingual coaching (EN / ES / PT)',
    ],
  },
  {
    id: 'momentum', // stripe: momentum
    category: 'Online Fitness',
    name: 'Momentum',
    price: '$19.99',
    cadence: '/mo',
    model: 'Online only · app + AI · self-directed',
    bestFor: 'Consistent trainees ready for programming that adapts to the work they log.',
    highlights: [
      'Everything in Catalyst',
      'AI-adaptive periodization that responds to your logs',
      'Full exercise library + form cues',
      'TDEE calculator + macro targets',
    ],
    // Entry tier that unlocks Prehab (entitlements.js: momentum → FITNESS_PRO).
    unlocks: [
      'Prehab suite — the Friction Scanner / Recovery Matrix: joint-health, mobility & injury-prevention movement protocols',
    ],
  },
  {
    id: 'autonomous', // stripe: autonomous
    category: 'Online Fitness',
    name: 'Autonomous',
    price: '$49.99',
    cadence: '/mo',
    model: 'Online only · app + AI · self-directed',
    bestFor: 'Self-motivated clients who want the complete elite engine and will run the system themselves.',
    highlights: [
      'Everything in Momentum',
      'Advanced AI periodization tuned to logged data',
      'Strict progress + metabolic data capture',
      'Priority access to new BBF features',
    ],
    // entitlements.js: autonomous → FITNESS_PRO → Prehab unlocked.
    unlocks: [
      'Prehab suite — the Friction Scanner / Recovery Matrix: joint-health, mobility & injury-prevention movement protocols',
    ],
  },

  // ── Category 2 · Online Nutrition — app-based, monthly ──
  {
    id: 'fuel_foundation', // stripe: fuel_foundation
    category: 'Online Nutrition',
    name: 'Fuel Foundation',
    price: '$7.99',
    cadence: '/mo',
    model: 'Online only · nutrition coaching · app-based',
    bestFor: 'Anyone who needs to lock in the fundamentals of fueling and eat with intent.',
    highlights: [
      'Personalized macro blueprint',
      'Foundational meal framework',
      'Hydration + habit guidance',
      'Trilingual nutrition guidance (EN / ES / PT)',
    ],
  },
  {
    id: 'fuel_performance', // stripe: fuel_performance
    category: 'Online Nutrition',
    name: 'Fuel Performance',
    price: '$14.99',
    cadence: '/mo',
    model: 'Online only · nutrition coaching · app-based',
    bestFor: 'Trainees who want nutrition aligned to performance and training adaptation.',
    highlights: [
      'Everything in Fuel Foundation',
      'Performance macro targets',
      'Adaptive adjustments as you progress',
      'Recipe + meal library',
    ],
  },
  {
    id: 'fuel_sovereign', // stripe: fuel_sovereign
    category: 'Online Nutrition',
    name: 'Fuel Sovereign',
    price: '$29.99',
    cadence: '/mo',
    model: 'Online only · nutrition coaching · app-based',
    bestFor: 'Clients who want a precision, periodized nutrition system tied to their training blocks.',
    highlights: [
      'Everything in Fuel Performance',
      'Periodized nutrition aligned to training blocks',
      'Body-composition tracking',
      'Advanced metabolic guidance',
    ],
  },

  // ── Category 3 · Youth Athlete — online athletic development, monthly ──
  {
    id: 'rising_athlete', // stripe: rising_athlete
    category: 'Youth Athlete',
    name: 'Rising Athlete',
    price: '$14.99',
    cadence: '/mo',
    model: 'Online only · youth athletic development · app-based',
    bestFor: 'Youth athletes (and their parents) who want periodized sport training built on joint health.',
    highlights: [
      'Age-appropriate periodized programming',
      'Kinematic Form HUD — biomechanics + injury-prevention scanner',
      'Sport-specific athletic development',
      'Joint-protection-first design',
    ],
  },

  // ── Category 4 · Hybrid Packages — in-person + app, Founder-Direct ──
  // Dual price = session frequency. stripe: *_3x ($lower) / *_4x ($higher).
  {
    id: 'kickstart', // stripe: kickstart_6wk_3x / kickstart_6wk_4x
    category: 'Hybrid Packages',
    name: 'Kickstart',
    price: '$399–$499',
    cadence: '/ 6-week protocol',
    model: 'Hybrid · in-person + app · Founder-Direct with Akeem',
    bestFor: 'Local clients who want a hands-on jump-start with Akeem in person before going self-directed.',
    highlights: [
      'In-person sessions with Akeem',
      'Hands-on biomechanics + live form correction',
      'Custom 6-week protocol',
      'Full BBF App access included',
    ],
    options: [
      { label: '3 sessions/week', price: '$399' },
      { label: '4 sessions/week', price: '$499' },
    ],
    // Hybrid = Founder-Direct God Mode (entitlements.js: → ALL) → Prehab unlocked.
    unlocks: [
      'Prehab suite — the Friction Scanner / Recovery Matrix: joint-health, mobility & injury-prevention movement protocols',
    ],
  },
  {
    id: 'transformation', // stripe: transformation_8wk_3x / transformation_8wk_4x
    category: 'Hybrid Packages',
    name: 'Transformation',
    price: '$499–$649',
    cadence: '/ 8-week protocol',
    model: 'Hybrid · in-person + app · Founder-Direct with Akeem',
    bestFor: 'Clients committed to a complete 8-week transformation block with ongoing in-person coaching.',
    highlights: [
      'Everything in Kickstart',
      'Deeper periodization across 8 weeks',
      'Ongoing in-person protocol adjustments',
      'Nutrition integration',
    ],
    options: [
      { label: '3 sessions/week', price: '$499' },
      { label: '4 sessions/week', price: '$649' },
    ],
    // Hybrid = Founder-Direct God Mode (entitlements.js: → ALL) → Prehab unlocked.
    unlocks: [
      'Prehab suite — the Friction Scanner / Recovery Matrix: joint-health, mobility & injury-prevention movement protocols',
    ],
  },
  {
    id: 'sovereign', // stripe: sovereign_12wk_3x / sovereign_12wk_4x
    category: 'Hybrid Packages',
    name: 'Sovereign',
    price: '$699–$899',
    cadence: '/ 12-week protocol',
    model: 'Hybrid · in-person + app · Founder-Direct with Akeem',
    bestFor: 'Clients who want Akeem fully in the loop for the flagship 12-week Sovereign Gold Standard protocol.',
    highlights: [
      'Everything in Transformation',
      'Full Sovereign Gold Standard programming',
      'Founder-Verified joint protection + prehab architecture',
      'Priority direct access to Akeem',
    ],
    options: [
      { label: '3 sessions/week', price: '$699' },
      { label: '4 sessions/week', price: '$899' },
    ],
    // Hybrid = Founder-Direct God Mode (entitlements.js: → ALL) → Prehab unlocked.
    unlocks: [
      'Prehab suite — the Friction Scanner / Recovery Matrix: joint-health, mobility & injury-prevention movement protocols',
    ],
  },
];

const SALES_DIRECTIVES = [
  // Identity & diagnostic persona
  'You are "Ask BBF," Akeem Brown\'s Autonomous Performance Architect — a clinical consultant, not a passive FAQ bot. You operate with professional authority grounded in elite performance science. Your goal is to move prospects from "friction" to "checkout" through scientific diagnosis and tiered solution mapping. Never pitch prematurely.',

  // The Four Pillars of the Sovereign Gold Standard
  'Every interaction is filtered through the FOUR PILLARS OF THE SOVEREIGN GOLD STANDARD: (1) Joint Safety — prioritize structural longevity over temporary intensity, starting with connective tissue preservation. (2) Time-as-Context — acknowledge the prospect is often a high-performer with low time margins; design around shift work and corporate reality. (3) Bioenergetic Efficiency — optimize ATP-CP, Glycolytic, and Oxidative energy systems for maximum output with minimal systemic waste. (4) Clinical Integrity — ground all advice in peer-reviewed sports science, focusing on muscle protein synthesis and nervous system recovery.',

  // Sovereign Conversion Framework (SCF) — 4-stage diagnostic flow
  'Follow the SOVEREIGN CONVERSION FRAMEWORK (SCF) in sequence: STAGE 1 (Discovery): ask 1-2 sharp diagnostic questions to identify the prospect\'s "Primary Anchor" — lack of time, recurring injury, poor recovery, diet confusion, or desire for structure. Example openers: "What is your typical work shift length?" or "Where do you feel physical tightness or friction during training?" STAGE 2 (Clinical Calibration): explain the SCIENCE behind why their anchor exists, citing BBF principles like Periodized Volume Landmarks, bioenergetic efficiency, or nervous system recovery. STAGE 3 (Protocol Projection): provide a "micro-win" — a specific set/rep scheme, recovery tactic, or mobility cue — to demonstrate immediate value. STAGE 4 (Frictionless Conversion): map their anchor to the ONE optimal BBF tier and provide a direct path to purchase or inquiry.',

  // Pitfall-to-Pivot Playbook — diagnostic-to-tier mapping
  'PITFALL-TO-PIVOT PLAYBOOK — match the prospect\'s primary friction to the right tier: (a) Lack of Structure / Language Barriers → Catalyst ($9.99/mo): emphasize trilingual workout tracking, structured programs, and the cardio engine for self-starters needing an elite roadmap. (b) Joint Pain & Training Friction → Momentum ($19.99/mo): lead with the Prehab Friction Scanner and AI-adaptive periodization that bypasses stiffness and prioritizes structural longevity. (c) Diet, Fatigue & Bio-fueling → Autonomous ($49.99/mo): close on the full performance engine, TDEE bio-fuel macros, and advanced metabolic data capture to solve systemic waste. (d) Desire for Custom Elite Coaching → Hybrid Packages or Local Weekly Training: direct close for prospects seeking Akeem\'s hands-on biomechanical architectural planning.',

  // Qualification fork
  'QUALIFY FIRST. Before quoting a menu, ask 1-2 sharp clarifying questions to place them. The primary fork: "Are you looking for an AI-driven, app-only experience you run yourself, or do you want direct, in-person human coaching from Akeem?" Then narrow by goal (fitness, nutrition, or youth athlete) and budget/commitment.',

  // Recommendation discipline
  'RECOMMEND ONE TIER. After qualifying via the SCF, recommend a single specific tier by name and price and say exactly why it fits their diagnosed anchor — do not dump the whole matrix. Offer the next tier up only as a brief, honest upsell when it clearly serves their goal.',

  // Pricing guardrail
  'Quote prices ONLY from the tier matrix provided. Never invent, discount, bundle, or estimate a price. For Hybrid packages, state BOTH session-frequency options (e.g., "$399 for 3 sessions/week, $499 for 4").',

  // Custom local weekly
  `CUSTOM LOCAL WEEKLY: if a prospect wants ongoing, bespoke weekly in-person training beyond the fixed Hybrid packages, do NOT quote a number — tell them to email ${CUSTOM_QUOTE_EMAIL} to request a custom quote, and set cta="pathfinder" so Akeem also captures them.`,

  // Close mechanics
  'ALWAYS CLOSE with a clear next step: route to the Pathfinder application (cta="pathfinder"), or to the TDEE calculator (cta="tdee") for macro/calorie questions. Additional frictionless paths: downloading the companion app or completing the direct web app install.',

  // Joint / Prehab upsell
  'JOINT / MOBILITY → PREHAB UPSELL: when a prospect raises joint health, stiffness, mobility, nagging aches, an old injury, or injury-prevention as a GOAL, lead with the Prehab suite (the in-app joint-health / mobility / injury-prevention protocols). State plainly that Momentum ($19.99/mo) is the entry tier that unlocks Prehab, and only claim an unlock the matrix marks "Unlocks" for that tier. This is product fit — NOT medical advice: never diagnose, prescribe, or promise a clinical outcome.',

  // Medical safety
  'MEDICAL SAFETY: never give medical advice. If a prospect describes ACTIVE pain, an acute injury, or a diagnosed condition, do not assess it — note that the PAR-Q intake captures it and Akeem reviews it personally, and set cta="pathfinder".',

  // Competitive posture
  'Never disparage competitors. Sell BBF on the Sovereign Gold Standard: biomechanical precision, joint protection, and real periodization.',

  // Reply discipline
  'Keep replies tight and persuasive — 2-4 sentences. You are a clinical closer in conversation, not a brochure.',

  // Trilingual with micro-close templates
  'BBF is trilingual: reply in the prospect\'s language (English, Spanish, or Portuguese). If a language is specified, use it; otherwise mirror the language of their last message. Use clinical micro-close language naturally, e.g. English: "Based on your fatigue markers, the Autonomous Tier is your optimal architect. Shall we lock in your bio-fuel plan now?" Spanish: "¿Listo para eliminar esa fricción articular con Momentum? Podemos activar tu escáner de Pre-Hab hoy mismo." Portuguese: "Para o seu nível de desempenho, o plano Catalyst oferece a estrutura ideal. Vamos começar o seu acompanhamento trilingue?"',
];

// ─── System prompt builder · generated from the matrix (not hardcoded) ──
function buildSystemPrompt(matrix: Tier[], lang?: string): string {
  // Group tiers by category, preserving first-appearance order.
  const order: string[] = [];
  const groups = new Map<string, Tier[]>();
  for (const t of matrix) {
    const cat = t.category || 'Other';
    if (!groups.has(cat)) { groups.set(cat, []); order.push(cat); }
    groups.get(cat)!.push(t);
  }

  let n = 0;
  const tierBlocks = order.map((cat) => {
    const lines = groups.get(cat)!.map((t) => {
      n += 1;
      const hl = (t.highlights || []).map((h) => `        - ${h}`).join('\n');
      const opt = Array.isArray(t.options) && t.options.length
        ? `\n       Options: ${t.options.map((o) => `${o.label} → ${o.price}`).join(' · ')}`
        : '';
      const block = [
        `    ${n}. ${t.name} — ${t.price} ${t.cadence}`,
        `       Model: ${t.model}`,
        `       Best for: ${t.bestFor}${opt}`,
        '       Includes:',
        hl,
      ];
      if (Array.isArray(t.unlocks) && t.unlocks.length) {
        block.push('       Unlocks (vs. a lower tier in this path):');
        block.push(t.unlocks.map((u) => `        - ${u}`).join('\n'));
      }
      return block.join('\n');
    }).join('\n\n');
    return `  ${cat}\n${lines}`;
  }).join('\n\n');

  const langLine = lang
    ? `The prospect's preferred language is "${lang}" (en=English, es=Spanish, pt=Portuguese). Reply in that language.`
    : 'Reply in the language of the prospect\'s most recent message (English, Spanish, or Portuguese).';

  return [
    'You are "Ask BBF," the Autonomous Performance Architect for Build Believe Fit LLC — a clinical',
    'consultant that bridges elite performance science with the friction of daily life.',
    'Build Believe Fit is a universal human-optimization fitness platform founded by Akeem Brown',
    '(Movement Specialist · Exercise Science · future Occupational Therapist). The brand standard',
    'is the "Sovereign Gold Standard": biomechanical precision, joint protection, and real periodization.',
    '',
    langLine,
    '',
    'CURRENT PRICE MATRIX (quote prices ONLY from this list — never invent, discount, or estimate):',
    tierBlocks,
    '',
    '  Custom Local Weekly — ongoing, fully bespoke in-person training (beyond the fixed Hybrid packages)',
    `       Pricing is by custom quote only. Direct the prospect to email ${CUSTOM_QUOTE_EMAIL} to request a custom quote.`,
    '',
    'SALES DIRECTIVES:',
    ...SALES_DIRECTIVES.map((d) => `  • ${d}`),
    '',
    '# OUTPUT',
    'Return ONLY structured JSON matching the response schema: a `reply` (your message to the',
    'prospect) and a `cta` routing hint. Use cta="pathfinder" to push toward the application,',
    'cta="tdee" for macro/calorie questions, or cta="none" when no call-to-action fits yet.',
  ].join('\n');
}

// Structured output — guarantees the frontend gets { reply, cta } without
// defensive parsing. Mirrors the BBFChatbox { text, cta } drop-in shape.
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    reply: {
      type: 'string',
      description: 'The closer reply to the prospect. Tight, 2-4 sentences, in the prospect\'s language.',
    },
    cta: {
      type: 'string',
      enum: ['pathfinder', 'tdee', 'none'],
      description: 'Call-to-action routing hint. "pathfinder"=the application, "tdee"=TDEE calculator, "none"=no CTA yet.',
    },
  },
  required: ['reply', 'cta'],
  additionalProperties: false,
};

// ─── Validate + normalize the conversation turns ────────────────────────
type Turn = { role: 'user' | 'assistant'; content: string };

function normalizeMessages(raw: unknown): { ok: true; turns: Turn[] } | { ok: false; error: string; detail: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, error: 'no_messages', detail: 'POST body must include a non-empty `messages` array.' };
  }
  if (raw.length > MAX_MESSAGES) {
    return { ok: false, error: 'too_many_messages', detail: `Max ${MAX_MESSAGES} messages per call.` };
  }
  const turns: Turn[] = [];
  for (const m of raw as any[]) {
    const role = m?.role === 'assistant' ? 'assistant' : m?.role === 'user' ? 'user' : null;
    const content = typeof m?.content === 'string' ? m.content : (typeof m?.text === 'string' ? m.text : null);
    if (!role || content === null) {
      return { ok: false, error: 'invalid_message', detail: 'Each message needs a role ("user"|"assistant") and string content.' };
    }
    if (content.length > MAX_CONTENT_CHARS) {
      return { ok: false, error: 'message_too_long', detail: `Each message must be ≤ ${MAX_CONTENT_CHARS} chars.` };
    }
    turns.push({ role, content });
  }
  // Anthropic requires the conversation to begin with a user turn.
  if (turns[0].role !== 'user') {
    return { ok: false, error: 'must_start_with_user', detail: 'The first message must have role "user".' };
  }
  return { ok: true, turns };
}

// ─── Anthropic call ─────────────────────────────────────────────────────
async function callClaude(turns: Turn[], systemPrompt: string, apiKey: string) {
  const requestBody = {
    model:      MODEL,
    max_tokens: MAX_TOKENS,
    output_config: {
      format: { type: 'json_schema', schema: RESPONSE_SCHEMA },
    },
    // Cacheable system prompt — stable across a conversation, dominant cost.
    system: [
      { type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } },
    ],
    messages: turns.map((t) => ({ role: t.role, content: t.content })),
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
    console.error(`[bbf-ai-hub] Anthropic API error: status=${res.status} body=${JSON.stringify(body)}`);
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

// ─── Handler ─────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')    return jsonResponse({ error: 'method_not_allowed' }, 405);

  // Abuse gates (verify_jwt is false): origin allowlist, then per-IP rate limit.
  const originRejection = checkOrigin(req);
  if (originRejection) return originRejection;
  const limited = rateLimit(clientIp(req));
  if (limited) return limited;

  let payload: any;
  try { payload = await req.json(); }
  catch (_) { return jsonResponse({ error: 'invalid_json' }, 400); }

  const norm = normalizeMessages(payload?.messages);
  if (!norm.ok) return jsonResponse({ error: norm.error, detail: norm.detail }, 400);

  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  if (!ANTHROPIC_API_KEY) {
    console.error('[bbf-ai-hub] missing ANTHROPIC_API_KEY in Supabase secrets.');
    return jsonResponse({ error: 'config_missing_anthropic_key' }, 503);
  }

  // The frontend's live matrix (single source of truth) wins; fall back to
  // the in-function mirror only if the request omits it.
  const matrix: Tier[] = Array.isArray(payload?.tierMatrix) && payload.tierMatrix.length > 0
    ? payload.tierMatrix
    : DEFAULT_TIER_MATRIX;
  const lang = typeof payload?.lang === 'string' ? payload.lang : undefined;
  const systemPrompt = buildSystemPrompt(matrix, lang);

  const t0 = Date.now();
  const result = await callClaude(norm.turns, systemPrompt, ANTHROPIC_API_KEY);
  const dur = Date.now() - t0;

  if (!result.ok) {
    return jsonResponse({ error: 'anthropic_call_failed', detail: result.error, status: result.status }, 502);
  }

  const respBody: any = result.body;
  const text = extractTextBlock(respBody?.content);
  if (!text) {
    console.error(`[bbf-ai-hub] no text block in Anthropic response. content=${JSON.stringify(respBody?.content)}`);
    return jsonResponse({ error: 'no_text_block_in_response' }, 502);
  }

  let parsed: any;
  try { parsed = JSON.parse(text); }
  catch (e) {
    console.error(`[bbf-ai-hub] failed to parse JSON from Claude: ${(e as Error).message}. text=${text.slice(0, 400)}`);
    return jsonResponse({ error: 'bad_model_json' }, 502);
  }

  const cta = parsed?.cta === 'pathfinder' || parsed?.cta === 'tdee' ? parsed.cta : null;

  return jsonResponse({
    ok:          true,
    reply:       typeof parsed?.reply === 'string' ? parsed.reply : '',
    cta,
    model:       MODEL,
    usage:       respBody?.usage ?? null,
    duration_ms: dur,
  }, 200);
});
