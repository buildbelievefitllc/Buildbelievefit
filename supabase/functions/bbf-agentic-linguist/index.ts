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
// Phase 6.0h-followup · raw fetch → canonical callClaude · use-case
// `i18n_translation` routes to HAIKU · fallback escalates to SONNET.
import { callClaude } from '../_shared/anthropic-call.ts';
const MAX_TOKENS         = 512;
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

// (legacy local `callClaude` + `extractTextBlock` removed · canonical
//  helper from _shared/anthropic-call.ts replaces both.)

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

  const t0     = Date.now();
  const result = await callClaude({
    useCase:         'i18n_translation',
    system:          SYSTEM_PROMPT,
    userFields:      {
      target_language:    languageLabel,
      english_cue:        safeCue,
      task: 'Translate per system instructions; emit translation + phonetic + literal_meaning.',
    },
    toolSchema:      RESPONSE_SCHEMA,
    toolName:        'submit_translation',
    toolDescription: 'Emit the localized coaching cue with phonetic + literal meaning fields.',
    maxTokens:       MAX_TOKENS,
    agentTag:        'bbf-agentic-linguist',
    apiKey:          ANTHROPIC_API_KEY,
    timeoutMs:       CLAUDE_TIMEOUT_MS,
  });
  const dur = Date.now() - t0;

  if (!result.ok) {
    console.warn(`[bbf-agentic-linguist] Claude failed (${result.error}) after ${dur}ms · attempts=${result.attempts} fallback_used=${result.fallback_used} — returning default`);
    return jsonResponse(defaultLinguistResponse('claude_failed'), 200);
  }

  const parsed = result.toolInput as { translation?: unknown; phonetic?: unknown; literal_meaning?: unknown } | null;
  if (
    !parsed ||
    typeof parsed.translation     !== 'string' ||
    typeof parsed.phonetic        !== 'string' ||
    typeof parsed.literal_meaning !== 'string'
  ) {
    console.warn(`[bbf-agentic-linguist] tool_use shape mismatch — returning default. got=${JSON.stringify(parsed).slice(0,200)}`);
    return jsonResponse(defaultLinguistResponse('schema_mismatch'), 200);
  }

  console.log(`[bbf-agentic-linguist] uid=${uid} · lang=${languageLabel} · cue_len=${safeCue.length} · model=${result.model} · attempts=${result.attempts} · fallback_used=${result.fallback_used} · duration=${dur}ms · usage=${JSON.stringify(result.usage)}`);

  return jsonResponse({
    translation:     parsed.translation,
    phonetic:        parsed.phonetic,
    literal_meaning: parsed.literal_meaning,
  }, 200);
});
