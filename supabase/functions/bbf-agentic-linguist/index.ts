// bbf-agentic-linguist — Dynamic Coaching Scripts (Phase 9)
// ─────────────────────────────────────────────────────────────────────
// Translates an English coaching cue ("Drive your knees out", "Brace
// like you're about to take a punch") into the athlete's target
// language using GYM-FLOOR slang — not literary translation. Returns
// the translation, a phonetic English pronunciation guide, and a
// literal back-translation for the coach to verify what was sent.
//
// Request shape:
//   POST /functions/v1/bbf-agentic-linguist
//   Content-Type: application/json
//   X-BBF-Admin-Token: <optional shared secret>
//   Body:
//   {
//     "uid": "akeem",                       // required
//     "english_cue": "Drive your knees out", // required
//     "target_language": "es" | "pt" | "Spanish" | "Brazilian Portuguese" | ...
//     "admin_override": false
//   }
//
// Response shape (200 OK):
//   {
//     "translation":     string,   // ready-to-shout gym-floor phrase
//     "phonetic":        string,   // English-letter pronunciation guide
//     "literal_meaning": string    // English literal back-translation
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

// Phase 7 Workstream B · i18n translation · low-stakes, deterministic-
// schema output. Haiku 4.5 per CEO routing rules.
import { routeAndLog } from '../_shared/model-router.ts';

const MODEL              = routeAndLog('bbf-agentic-linguist', 'i18n_translation');
const MAX_TOKENS         = 512;
const EFFORT_DEFAULT     = 'high';
const CLAUDE_TIMEOUT_MS  = 10000;
const MAX_CUE_LEN        = 240;

const SYSTEM_PROMPT = [
  'You are the BBF Dynamic Linguist — a translator that converts English coaching cues into ready-to-shout gym-floor phrases in the athlete\'s target language. You are NOT a literary translator. You are a strength-coach interpreter who has spent years on gym floors in Spain, Mexico, São Paulo, Lisbon, Berlin, Paris — wherever the target language is spoken. Use the actual idiom a coach yells across the floor, not the textbook translation.',
  '',
  '# WHAT YOU RECEIVE',
  '- english_cue — an English coaching cue, command, or instruction. Examples: "Drive your knees out!", "Brace like you\'re about to take a punch", "One more rep!", "Slow on the way down", "Eyes up, chest up".',
  '- target_language — the language to translate INTO (e.g. "es", "pt", "Spanish", "Brazilian Portuguese"). Honor regional slang where the language has variants.',
  '',
  '# WHAT YOU RETURN',
  '- translation — the cue in the target language as it would actually be SHOUTED on the gym floor. Short. Imperative. Idiomatic. Examples: EN "Drive your knees out!" → ES "¡Abre las rodillas!", PT(BR) "Abre os joelhos!". Use the imperative form a coach uses, not the formal infinitive.',
  '- phonetic — an English-letter pronunciation guide for the translation. Use ALL-CAPS for the stressed syllable. Hyphens between syllables. Examples: ES "¡Abre las rodillas!" → "AH-bre lahss roh-DEE-yahss". PT "Abre os joelhos!" → "AH-bree oze zho-EL-yose". Aim for what a native English speaker can sound out and be understood.',
  '- literal_meaning — a flat English back-translation of what you actually wrote. The COACH uses this to verify the message they sent. Keep it close to the words. Example: ES "¡Abre las rodillas!" literal → "Open the knees!" (not the original cue "Drive your knees out!").',
  '',
  '# CONSTRAINTS',
  '- translation is ALWAYS in the target language. Use proper diacritics (¡! ñ á é í ó ú ã ç).',
  '- phonetic ALWAYS uses English letters only (no IPA). Stress in ALL-CAPS.',
  '- literal_meaning ALWAYS in English. Reflects what you wrote, not the original cue.',
  '- If the cue is ambiguous: pick the most coaching-floor-appropriate reading and translate that.',
  '- If the english_cue is empty/non-English/nonsensical: translation="—", phonetic="—", literal_meaning="Cue not recognized. Send a clear English coaching cue."',
  '',
  'Return ONLY structured JSON matching the response schema. No markdown, no preamble.',
].join('\n');

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    translation:     { type: 'string', description: 'The cue in the target language, gym-floor imperative form. Use proper diacritics.' },
    phonetic:        { type: 'string', description: 'English-letter pronunciation guide. ALL-CAPS for stressed syllable, hyphens between syllables.' },
    literal_meaning: { type: 'string', description: 'English literal back-translation reflecting what was actually written.' },
  },
  required: ['translation', 'phonetic', 'literal_meaning'],
  additionalProperties: false,
};

function adminOverrideMock() {
  return {
    translation:     'ADMIN BYPASS: Empuja',
    phonetic:        'em-POO-ha',
    literal_meaning: 'Push',
  };
}

function defaultLinguistResponse(reason: string) {
  return {
    translation:     '—',
    phonetic:        '—',
    literal_meaning: 'Linguist engine offline (' + reason + '). Try again in a moment.',
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

async function callClaude(userMessage: string, apiKey: string) {
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
    system: [
      { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    ],
    messages: [
      { role: 'user', content: userMessage },
    ],
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
      console.error(`[bbf-agentic-linguist] Anthropic API error: status=${res.status} body=${JSON.stringify(body).slice(0,600)}`);
      return { ok: false as const, status: res.status, error: errMsg, raw: body };
    }
    return { ok: true as const, status: res.status, body };
  } catch (e) {
    const err = e as Error;
    const reason = err.name === 'AbortError' ? `timeout_${CLAUDE_TIMEOUT_MS}ms` : err.message;
    console.error(`[bbf-agentic-linguist] Claude fetch threw: ${reason}`);
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
      console.warn('[bbf-agentic-linguist] rejected: bad/missing X-BBF-Admin-Token');
      return jsonResponse({ error: 'unauthorized' }, 401);
    }
  }

  let payload: any;
  try { payload = await req.json(); } catch (_) { return jsonResponse({ error: 'invalid_json' }, 400); }

  const { uid, english_cue, target_language, admin_override } = payload || {};

  // ─── 1. OMNISCIENCE PROTOCOL — ABSOLUTE FIRST GATE ─────────────
  if (admin_override === true) {
    return jsonResponse(adminOverrideMock(), 200);
  }

  if (typeof uid !== 'string' || !uid)                              return jsonResponse({ error: 'missing_uid' }, 400);
  if (typeof english_cue !== 'string' || !english_cue.trim())       return jsonResponse({ error: 'missing_english_cue' }, 400);

  const safeCue       = english_cue.trim().slice(0, MAX_CUE_LEN);
  const languageLabel = normalizeLanguage(target_language || 'Spanish');

  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  if (!ANTHROPIC_API_KEY) {
    console.error('[bbf-agentic-linguist] missing ANTHROPIC_API_KEY — returning default');
    return jsonResponse(defaultLinguistResponse('config_missing'), 200);
  }

  const userMessage =
    'Target language: ' + languageLabel + '\n\n' +
    'English coaching cue: "' + safeCue + '"\n\n' +
    'Translate per your system instructions. Return ONLY the JSON schema response.';

  const t0     = Date.now();
  const result = await callClaude(userMessage, ANTHROPIC_API_KEY);
  const dur    = Date.now() - t0;

  if (!result.ok) {
    console.warn(`[bbf-agentic-linguist] Claude failed (${result.error}) after ${dur}ms — returning default`);
    return jsonResponse(defaultLinguistResponse('claude_failed'), 200);
  }

  const respBody: any = result.body;
  const text = extractTextBlock(respBody?.content);
  if (!text) {
    console.warn('[bbf-agentic-linguist] no text block in response — returning default');
    return jsonResponse(defaultLinguistResponse('no_text_block'), 200);
  }

  let parsed: any;
  try { parsed = JSON.parse(text); } catch (e) {
    console.warn(`[bbf-agentic-linguist] parse failed (${(e as Error).message}) — returning default`);
    return jsonResponse(defaultLinguistResponse('parse_failed'), 200);
  }

  if (
    !parsed ||
    typeof parsed.translation !== 'string' ||
    typeof parsed.phonetic !== 'string' ||
    typeof parsed.literal_meaning !== 'string'
  ) {
    console.warn(`[bbf-agentic-linguist] schema shape mismatch — returning default. got=${JSON.stringify(parsed).slice(0,200)}`);
    return jsonResponse(defaultLinguistResponse('schema_mismatch'), 200);
  }

  console.log(`[bbf-agentic-linguist] uid=${uid} · lang=${languageLabel} · cue_len=${safeCue.length} · model=${respBody.model} · duration=${dur}ms · usage=${JSON.stringify(respBody.usage)}`);

  return jsonResponse({
    translation:     parsed.translation,
    phonetic:        parsed.phonetic,
    literal_meaning: parsed.literal_meaning,
  }, 200);
});
