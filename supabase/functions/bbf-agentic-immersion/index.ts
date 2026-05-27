// bbf-agentic-immersion — Sovereign Linguistics · Immersion Simulator (Phase 8)
// ─────────────────────────────────────────────────────────────────────
// Multi-turn language-immersion roleplay engine. The athlete picks a
// scenario (e.g. "Ordering at a gym smoothie bar in São Paulo"), types
// or speaks in their target language, and Claude Opus 4.7 replies in
// character as a native speaker — including local slang. Per turn it
// also returns a grammar correction + a 0-100 fluency score.
//
// Request shape:
//   POST /functions/v1/bbf-agentic-immersion
//   Content-Type: application/json
//   X-BBF-Admin-Token: <optional shared secret>
//   Body:
//   {
//     "uid": "jacque_bbf",                          // required
//     "scenario": "Ordering at a gym smoothie bar", // required
//     "target_language": "es" | "pt" | "Spanish" | "Portuguese" | ...
//     "user_message": "Quiero un batido de proteína", // required
//     "conversation_history": [                       // optional; multi-turn context
//       { "role": "user", "content": "..." },
//       { "role": "assistant", "content": "..." }
//     ],
//     "admin_override": false
//   }
//
// Response shape (200 OK):
//   {
//     "ai_reply":           string,   // in-character native-speaker reply
//     "grammar_correction": string,   // "Perfect." or specific fix
//     "fluency_score":      integer   // 0-100
//   }

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

// Phase 7 Workstream B · Sport-immersion roleplay seed · static content
// generation, doesn't need peak reasoning. Haiku 4.5 per CEO routing.
// Phase 6.0h-followup · raw fetch → canonical callClaude · use-case
// `sport_immersion_seed` routes to HAIKU · fallback escalates to SONNET.
import { callClaude } from '../_shared/anthropic-call.ts';
const MAX_TOKENS         = 1024;
const CLAUDE_TIMEOUT_MS  = 12000;
const MAX_TURNS          = 12;     // cap conversation_history to avoid runaway context
const MAX_MSG_LEN        = 500;

const SYSTEM_PROMPT = [
  'You are the BBF Immersion Simulator — a roleplay engine that drops the athlete into an authentic immersive language scenario. The athlete is using this to build fluency in their target language. You play the role of a native speaker the athlete is interacting with — fully in character, using region-appropriate slang, idioms, and tone.',
  '',
  '# WHAT YOU RECEIVE',
  '- scenario — the situational context (e.g. "Ordering at a gym smoothie bar in São Paulo", "Asking a personal trainer at a gym in Madrid for spotting help").',
  '- target_language — the language the athlete is practicing (e.g. "es", "pt", "Spanish", "Portuguese", "Brazilian Portuguese"). Honor regional slang where the scenario implies a locale.',
  '- user_message — what the athlete just said (in the target language, ideally — may contain errors).',
  '- conversation_history — prior turns of the same roleplay session, if any. Maintain continuity (remember what the athlete said earlier, your prior in-character replies, etc.).',
  '',
  '# WHAT YOU RETURN',
  '- ai_reply — your in-character next reply, IN THE TARGET LANGUAGE. Use natural local register. Keep it conversational (1-3 sentences). Do NOT switch to English. Do NOT meta-comment ("As an AI..."). Stay in character — if the scenario is "smoothie bar", you ARE the barista; if it\'s "trainer asking for a spot", you ARE the trainer.',
  '- grammar_correction — analyze the athlete\'s user_message. If they made a grammar / vocabulary / register error, state the corrected version + a one-sentence explanation IN ENGLISH (the athlete needs to learn what they got wrong). If the message was clean, return literally "Perfect." (one word).',
  '- fluency_score — integer 0-100 reflecting this single message\'s fluency:',
  '  · 90-100: native-equivalent (correct grammar, natural register, idiomatic slang).',
  '  · 70-89:  competent (intelligible, minor errors, mostly natural).',
  '  · 50-69:  developing (errors that don\'t fully obscure meaning).',
  '  · 30-49:  early (broken syntax, comprehensible only with effort).',
  '  · 0-29:   minimal/wrong language/blank.',
  '',
  '# CONSTRAINTS',
  '- Never break character in ai_reply. Never switch language in ai_reply.',
  '- grammar_correction is ALWAYS in English (the athlete\'s tutor voice).',
  '- If user_message is empty or non-language: ai_reply prompts them in-character to repeat, grammar_correction explains nothing was detected, fluency_score = 0.',
  '- Direct voice in grammar_correction. No hedging.',
  '',
  'Return ONLY structured JSON matching the response schema. No markdown, no preamble.',
].join('\n');

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    ai_reply:           { type: 'string', description: 'In-character native-speaker reply IN the target language. 1-3 sentences. No English.' },
    grammar_correction: { type: 'string', description: 'English-language correction of the athletes message, or literally "Perfect." if clean.' },
    fluency_score:      { type: 'integer', description: 'Integer 0-100. Per system prompt calibration.' },
  },
  required: ['ai_reply', 'grammar_correction', 'fluency_score'],
  additionalProperties: false,
};

function adminOverrideMock() {
  return {
    ai_reply: 'ADMIN BYPASS: [Simulated Reply]',
    grammar_correction: 'Perfect execution.',
    fluency_score: 100,
  };
}

function defaultImmersionResponse(reason: string) {
  return {
    ai_reply: '...',
    grammar_correction: 'Engine offline (' + reason + '). Try again in a moment.',
    fluency_score: 0,
  };
}

function normalizeLanguage(lang: string): string {
  const t = String(lang || '').trim().toLowerCase();
  if (t === 'es' || t.startsWith('span'))                     return 'Spanish';
  if (t === 'pt' || t.startsWith('port') || t.includes('br')) return 'Portuguese (Brazilian)';
  if (t === 'en' || t.startsWith('eng'))                      return 'English';
  if (t === 'fr' || t.startsWith('fre') || t === 'french')    return 'French';
  if (t === 'de' || t.startsWith('ger') || t === 'german')    return 'German';
  return lang || 'Spanish';
}

// (legacy local `callClaude` + `extractTextBlock` removed · canonical
//  helper from _shared/anthropic-call.ts replaces both. The multi-
//  message conversation history collapses into a single serialized
//  userField so the helper's sealed-boundary armor wraps it as
//  UNTRUSTED data · the assistant's own prior turns are also treated
//  as untrusted because a hijacked history could be injected by a
//  caller, so re-interpreting them as instructions would be unsafe.)

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')    return jsonResponse({ error: 'method_not_allowed' }, 405);

  const expectedToken = Deno.env.get('BBF_COACH_AGENT_TOKEN');
  if (expectedToken) {
    const sent = req.headers.get('x-bbf-admin-token') || '';
    if (sent !== expectedToken) {
      console.warn('[bbf-agentic-immersion] rejected: bad/missing X-BBF-Admin-Token');
      return jsonResponse({ error: 'unauthorized' }, 401);
    }
  }

  let payload: any;
  try { payload = await req.json(); } catch (_) { return jsonResponse({ error: 'invalid_json' }, 400); }

  const { uid, scenario, target_language, user_message, conversation_history, admin_override } = payload || {};

  // ─── 1. OMNISCIENCE PROTOCOL — ABSOLUTE FIRST GATE ─────────────
  if (admin_override === true) {
    return jsonResponse(adminOverrideMock(), 200);
  }

  if (typeof uid !== 'string' || !uid)                                  return jsonResponse({ error: 'missing_uid' }, 400);
  if (typeof scenario !== 'string' || !scenario.trim())                 return jsonResponse({ error: 'missing_scenario' }, 400);
  if (typeof user_message !== 'string' || !user_message.trim())         return jsonResponse({ error: 'missing_user_message' }, 400);

  const safeMessage   = user_message.trim().slice(0, MAX_MSG_LEN);
  const safeScenario  = scenario.trim().slice(0, MAX_MSG_LEN);
  const languageLabel = normalizeLanguage(target_language || 'Spanish');
  const history       = Array.isArray(conversation_history) ? conversation_history.slice(-MAX_TURNS * 2) : [];

  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  if (!ANTHROPIC_API_KEY) {
    console.error('[bbf-agentic-immersion] missing ANTHROPIC_API_KEY — returning default');
    return jsonResponse(defaultImmersionResponse('config_missing'), 200);
  }

  // Conversation history collapses into a serialized userField so the
  // helper's <user_input> shell wraps it as untrusted data. Per-session
  // scenario + language framing also rides inside the user block (the
  // stable SYSTEM_PROMPT stays as `system` for prompt-caching).
  const cleanHistory = history
    .filter((m: { role?: unknown; content?: unknown }) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m: { role: string; content: string }) => ({ role: m.role, content: String(m.content).slice(0, MAX_MSG_LEN) }));

  const historySerialized = cleanHistory.length
    ? cleanHistory.map((m, i) => `[turn ${i + 1} · ${m.role}] ${m.content}`).join('\n')
    : '(no prior turns)';

  const t0     = Date.now();
  const result = await callClaude({
    useCase:         'sport_immersion_seed',
    system:          SYSTEM_PROMPT,
    userFields:      {
      scenario:             safeScenario,
      target_language:      languageLabel,
      conversation_history: historySerialized,
      current_user_message: safeMessage,
      task: 'Stay in character as a native speaker. Emit ai_reply + grammar_correction + fluency_score per the schema.',
    },
    toolSchema:      RESPONSE_SCHEMA,
    toolName:        'submit_immersion_turn',
    toolDescription: 'Emit the next conversational reply, grammar correction, and fluency score for the language-immersion scenario.',
    maxTokens:       MAX_TOKENS,
    agentTag:        'bbf-agentic-immersion',
    apiKey:          ANTHROPIC_API_KEY,
    timeoutMs:       CLAUDE_TIMEOUT_MS,
  });
  const dur = Date.now() - t0;

  if (!result.ok) {
    console.warn(`[bbf-agentic-immersion] Claude failed (${result.error}) after ${dur}ms · attempts=${result.attempts} fallback_used=${result.fallback_used} — returning default`);
    return jsonResponse(defaultImmersionResponse('claude_failed'), 200);
  }

  const parsed = result.toolInput as { ai_reply?: unknown; grammar_correction?: unknown; fluency_score?: unknown } | null;
  if (
    !parsed ||
    typeof parsed.ai_reply           !== 'string' ||
    typeof parsed.grammar_correction !== 'string' ||
    typeof parsed.fluency_score      !== 'number'
  ) {
    console.warn(`[bbf-agentic-immersion] tool_use shape mismatch — returning default. got=${JSON.stringify(parsed).slice(0,200)}`);
    return jsonResponse(defaultImmersionResponse('schema_mismatch'), 200);
  }

  const clampedScore = Math.max(0, Math.min(100, Math.round(parsed.fluency_score)));

  console.log(`[bbf-agentic-immersion] uid=${uid} · lang=${languageLabel} · turns=${cleanHistory.length} · score=${clampedScore} · model=${result.model} · attempts=${result.attempts} · fallback_used=${result.fallback_used} · duration=${dur}ms · usage=${JSON.stringify(result.usage)}`);

  return jsonResponse({
    ai_reply:           parsed.ai_reply,
    grammar_correction: parsed.grammar_correction,
    fluency_score:      clampedScore,
  }, 200);
});
