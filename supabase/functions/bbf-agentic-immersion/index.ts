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

const MODEL              = 'claude-opus-4-7';
const MAX_TOKENS         = 1024;
const EFFORT_DEFAULT     = 'high';
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

async function callClaude(systemMessages: any[], messages: any[], apiKey: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CLAUDE_TIMEOUT_MS);

  const requestBody = {
    model:      MODEL,
    max_tokens: MAX_TOKENS,
    thinking:   { type: 'adaptive' },
    output_config: {
      effort: EFFORT_DEFAULT,
      format: { type: 'json_schema', schema: RESPONSE_SCHEMA },
    },
    system: systemMessages,
    messages,
  };

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      body:   JSON.stringify(requestBody),
      signal: controller.signal,
    });

    let body: any;
    try { body = await res.json(); } catch (_) { body = null; }

    if (!res.ok) {
      const errMsg = (body && body.error && (body.error.message || body.error.type)) || `anthropic_${res.status}`;
      console.error(`[bbf-agentic-immersion] Anthropic API error: status=${res.status} body=${JSON.stringify(body).slice(0,600)}`);
      return { ok: false as const, status: res.status, error: errMsg, raw: body };
    }
    return { ok: true as const, status: res.status, body };
  } catch (e) {
    const err = e as Error;
    const reason = err.name === 'AbortError' ? `timeout_${CLAUDE_TIMEOUT_MS}ms` : err.message;
    console.error(`[bbf-agentic-immersion] Claude fetch threw: ${reason}`);
    return { ok: false as const, status: 0, error: reason, raw: null };
  } finally {
    clearTimeout(timeout);
  }
}

function extractTextBlock(content: any[]): string | null {
  if (!Array.isArray(content)) return null;
  for (const block of content) {
    if (block && block.type === 'text' && typeof block.text === 'string') return block.text;
  }
  return null;
}

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

  // System prompt is split: stable global SYSTEM_PROMPT (cacheable) +
  // scenario/language framing (per-session). The cacheable block keeps
  // the dominant token cost down across turns of the same chat.
  const systemMessages = [
    { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: '# THIS SESSION\nScenario: ' + safeScenario + '\nTarget language: ' + languageLabel + '\nStay in character as a native speaker the athlete is interacting with in this scenario.' },
  ];

  // Roll conversation_history through as proper messages. Filter to
  // valid role+content shape. The current user_message is appended last.
  const cleanHistory = history.filter((m: any) => {
    return m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string';
  }).map((m: any) => ({ role: m.role, content: String(m.content).slice(0, MAX_MSG_LEN) }));

  const messages = cleanHistory.concat([{ role: 'user', content: safeMessage }]);

  const t0     = Date.now();
  const result = await callClaude(systemMessages, messages, ANTHROPIC_API_KEY);
  const dur    = Date.now() - t0;

  if (!result.ok) {
    console.warn(`[bbf-agentic-immersion] Claude failed (${result.error}) after ${dur}ms — returning default`);
    return jsonResponse(defaultImmersionResponse('claude_failed'), 200);
  }

  const respBody: any = result.body;
  const text = extractTextBlock(respBody?.content);
  if (!text) {
    console.warn('[bbf-agentic-immersion] no text block in response — returning default');
    return jsonResponse(defaultImmersionResponse('no_text_block'), 200);
  }

  let parsed: any;
  try { parsed = JSON.parse(text); } catch (e) {
    console.warn(`[bbf-agentic-immersion] parse failed (${(e as Error).message}) — returning default`);
    return jsonResponse(defaultImmersionResponse('parse_failed'), 200);
  }

  if (
    !parsed ||
    typeof parsed.ai_reply !== 'string' ||
    typeof parsed.grammar_correction !== 'string' ||
    typeof parsed.fluency_score !== 'number'
  ) {
    console.warn(`[bbf-agentic-immersion] schema shape mismatch — returning default. got=${JSON.stringify(parsed).slice(0,200)}`);
    return jsonResponse(defaultImmersionResponse('schema_mismatch'), 200);
  }

  const clampedScore = Math.max(0, Math.min(100, Math.round(parsed.fluency_score)));

  console.log(`[bbf-agentic-immersion] uid=${uid} · lang=${languageLabel} · turns=${cleanHistory.length} · score=${clampedScore} · model=${respBody.model} · duration=${dur}ms · usage=${JSON.stringify(respBody.usage)}`);

  return jsonResponse({
    ai_reply:           parsed.ai_reply,
    grammar_correction: parsed.grammar_correction,
    fluency_score:      clampedScore,
  }, 200);
});
