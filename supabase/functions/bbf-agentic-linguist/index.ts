// bbf-agentic-linguist (v2) — Dynamic Coaching Scripts + gram-slot contract + cache
// ─────────────────────────────────────────────────────────────────────
// v1 (unchanged): translates an English coaching cue into ready-to-shout gym-floor
// slang in the target language + phonetic guide + literal back-translation. Haiku via
// the model router. Auth/CORS preserved verbatim.
//
// v2 additions (LANGUAGE_MASTERY blueprint §0.1 / §1.4):
//   • CACHE-FIRST — a repeated cue resolves from bbf_linguist_cue_ledger (ZERO API).
//   • GRAM-SLOT CONTRACT — mass cues store the {load_g}/{body_mass_g} slot token, never
//     a number or unit; the app fills locale-grouped integer grams at display time.
//   • BANNED-LEXEME GATE — a translation containing kilo/kg/lb/lbs/libra/quilo/gram is
//     REJECTED; the model is re-prompted once with the slot contract; a second failure
//     stores the cue status 'needs_review'.
//   • LEDGER PERSIST — new translations cache to bbf_linguist_cue_ledger (es/pt only).
//   • action 'flag_term' — the "I keep forgetting this" one-tap → bbf_vocab_mastery
//     source 'linguist_flag', Box 1, due now.
//
// Request (translate): { uid, english_cue, target_language, admin_override? }
// Request (flag):      { action:'flag_term', uid, term, target_language }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

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
// Coordination contract: the linguist and every plan generator share ONE
// proprietary-name locklist (Brief 4 · Trilingual Cloud Plans) so a translated
// cue never mangles a BBF system name.
import { PROPRIETARY_TERMS } from '../_shared/locale.ts';
// v2 · the deterministic Gram cross-over gate (§0.1).
import { hasBannedLexeme, hasMassSlot } from '../_shared/language-core.ts';

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
  '- literal_meaning — a flat English back-translation of what you actually wrote. The COACH uses this to verify what was sent. Keep it close to the words. Example: ES "¡Abre las rodillas!" literal → "Open the knees!" (not the original cue "Drive your knees out!").',
  '',
  '# GRAM-SLOT CONTRACT (MANDATORY — mass is grams-only)',
  '- BBF is a gram-denominated system. If the cue references a LOAD, WEIGHT, or BODY MASS, you MUST NOT write any number or any unit (never kg, kilo, kilos, lb, lbs, libra, libras, quilo, quilos, pounds, gram, grams). Instead write the LITERAL slot token {load_g} (for a bar/plate load) or {body_mass_g} (for the athlete\'s body mass). The app fills the slot with locale-grouped integer grams at display time.',
  '  · EN "Add 20 kilos to the bar" / "Add weight to the bar" → ES "¡Súbele {load_g} a la barra!" · PT(BR) "Bota mais {load_g} na barra!"',
  '  · EN "Move your own bodyweight" → ES "¡Mueve {body_mass_g} tuyos!" (slot, never a number+unit)',
  '- A translation that contains ANY mass unit or number-as-weight is INVALID and will be rejected.',
  '',
  '# CONSTRAINTS',
  '- translation is ALWAYS in the target language. Use proper diacritics (¡! ñ á é í ó ú ã ç).',
  '- phonetic ALWAYS uses English letters only (no IPA). Stress in ALL-CAPS.',
  '- literal_meaning ALWAYS in English. Reflects what you wrote, not the original cue.',
  '- If the cue is ambiguous: pick the most coaching-floor-appropriate reading and translate that.',
  '- If the english_cue is empty/non-English/nonsensical: translation="—", phonetic="—", literal_meaning="Cue not recognized. Send a clear English coaching cue."',
  '',
  '# PROPRIETARY NAMES — keep VERBATIM in every language (never translate/transliterate/restyle):',
  PROPRIETARY_TERMS.map((t) => '"' + t + '"').join(', '),
  '',
  'Return ONLY structured JSON matching the response schema. No markdown, no preamble.',
].join('\n');

const RETRY_STRICT = 'Your previous translation contained a forbidden mass unit or a raw weight number. Re-translate NOW obeying the GRAM-SLOT CONTRACT: replace any weight/load/body-mass reference with the literal token {load_g} or {body_mass_g}. NEVER write kg, kilo, lb, libra, quilo, pounds, gram, or any digit-as-weight.';

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    translation:     { type: 'string', description: 'The cue in the target language, gym-floor imperative form. Mass → {load_g}/{body_mass_g} slot, never a unit.' },
    phonetic:        { type: 'string', description: 'English-letter pronunciation guide. ALL-CAPS for stressed syllable, hyphens between syllables.' },
    literal_meaning: { type: 'string', description: 'English literal back-translation reflecting what was actually written.' },
  },
  required: ['translation', 'phonetic', 'literal_meaning'],
  additionalProperties: false,
};

function adminOverrideMock() {
  return { translation: 'ADMIN BYPASS: Empuja', phonetic: 'em-POO-ha', literal_meaning: 'Push' };
}
function defaultLinguistResponse(reason: string) {
  return { translation: '—', phonetic: '—', literal_meaning: 'Linguist engine offline (' + reason + '). Try again in a moment.' };
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
// v2 · the ledger + vocab tables only speak es/pt (the two taught languages).
function langCode(lang: string): 'es' | 'pt' {
  const t = String(lang || '').trim().toLowerCase();
  return (t === 'pt' || t.startsWith('port') || t.includes('br')) ? 'pt' : 'es';
}

async function callClaude(userMessage: string, apiKey: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CLAUDE_TIMEOUT_MS);
  const requestBody = {
    model: MODEL, max_tokens: MAX_TOKENS, thinking: { type: 'adaptive' },
    output_config: { effort: EFFORT_DEFAULT, format: { type: 'json_schema', schema: RESPONSE_SCHEMA } },
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userMessage }],
  };
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify(requestBody), signal: controller.signal,
    });
    let body: any;
    try { body = await res.json(); } catch (_) { body = null; }
    if (!res.ok) {
      const errMsg = (body && body.error && (body.error.message || body.error.type)) || `anthropic_${res.status}`;
      console.error(`[bbf-agentic-linguist] Anthropic API error: status=${res.status} body=${JSON.stringify(body).slice(0, 600)}`);
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
  for (const block of content) if (block && block.type === 'text' && typeof block.text === 'string') return block.text;
  return null;
}
function parseTranslation(result: { body: any }): { translation: string; phonetic: string; literal_meaning: string } | null {
  const text = extractTextBlock(result.body?.content);
  if (!text) return null;
  let p: any; try { p = JSON.parse(text); } catch { return null; }
  if (!p || typeof p.translation !== 'string' || typeof p.phonetic !== 'string' || typeof p.literal_meaning !== 'string') return null;
  return { translation: p.translation, phonetic: p.phonetic, literal_meaning: p.literal_meaning };
}

// Service-role client for the ledger cache + vocab flag (background writes only).
function svc() {
  const url = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  return url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')    return jsonResponse({ error: 'method_not_allowed' }, 405);

  // S-4 · FAIL CLOSED: an unset secret must DENY, not skip the check (the old
  // `if (expectedToken)` ran unauthenticated when the env var was missing).
  const expectedToken = Deno.env.get('BBF_COACH_AGENT_TOKEN') ?? '';
  const sent = req.headers.get('x-bbf-admin-token') ?? '';
  if (!expectedToken || sent !== expectedToken) {
    console.warn('[bbf-agentic-linguist] rejected: unset secret or bad/missing X-BBF-Admin-Token (fail-closed)');
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  let payload: any;
  try { payload = await req.json(); } catch (_) { return jsonResponse({ error: 'invalid_json' }, 400); }

  const { uid, english_cue, target_language, admin_override, action } = payload || {};

  // ─── v2 · "keep forgetting this" one-tap → Box-1 injection (source linguist_flag) ──
  if (action === 'flag_term') {
    const term = typeof payload?.term === 'string' ? payload.term.trim().slice(0, 120) : '';
    if (typeof uid !== 'string' || !uid) return jsonResponse({ error: 'missing_uid' }, 400);
    if (!term) return jsonResponse({ error: 'missing_term' }, 400);
    const supabase = svc();
    if (!supabase) return jsonResponse({ error: 'backend_unconfigured' }, 503);
    const lang = langCode(target_language || 'es');
    try {
      const { data: u } = await supabase.from('bbf_users').select('id').eq('uid', uid).maybeSingle();
      if (!u?.id) return jsonResponse({ error: 'unknown_uid' }, 404);
      await supabase.from('bbf_vocab_mastery').upsert(
        { athlete_id: u.id, language: lang, term, box_level: 1, source: 'linguist_flag', due_at: new Date().toISOString() },
        { onConflict: 'athlete_id,language,term' },
      );
      return jsonResponse({ ok: true, flagged: term, language: lang, box_level: 1 }, 200);
    } catch (e) {
      return jsonResponse({ ok: false, error: 'flag_failed', detail: e instanceof Error ? e.message : String(e) }, 500);
    }
  }

  // ─── 1. OMNISCIENCE PROTOCOL — ABSOLUTE FIRST GATE ─────────────
  if (admin_override === true) return jsonResponse(adminOverrideMock(), 200);

  if (typeof uid !== 'string' || !uid)                        return jsonResponse({ error: 'missing_uid' }, 400);
  if (typeof english_cue !== 'string' || !english_cue.trim()) return jsonResponse({ error: 'missing_english_cue' }, 400);

  const safeCue       = english_cue.trim().slice(0, MAX_CUE_LEN);
  const languageLabel = normalizeLanguage(target_language || 'Spanish');
  const lang          = langCode(target_language || 'es');
  const supabase      = svc();

  // ─── v2 · CACHE-FIRST — repeated cue resolves from the ledger, ZERO API ──────
  if (supabase) {
    try {
      const { data: cached } = await supabase.from('bbf_linguist_cue_ledger')
        .select('translation,phonetic,literal_meaning,has_mass_slot,status')
        .eq('cue_en', safeCue).eq('language', lang).eq('status', 'active').maybeSingle();
      if (cached?.translation) {
        console.log(`[bbf-agentic-linguist] CACHE HIT · cue_len=${safeCue.length} · lang=${lang} · zero_api`);
        return jsonResponse({ translation: cached.translation, phonetic: cached.phonetic, literal_meaning: cached.literal_meaning, has_mass_slot: cached.has_mass_slot === true, source: 'ledger', cached: true }, 200);
      }
    } catch (_) { /* cache miss is non-fatal — fall through to the LLM */ }
  }

  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  if (!ANTHROPIC_API_KEY) {
    console.error('[bbf-agentic-linguist] missing ANTHROPIC_API_KEY — returning default');
    return jsonResponse(defaultLinguistResponse('config_missing'), 200);
  }

  const baseMsg = 'Target language: ' + languageLabel + '\n\n' + 'English coaching cue: "' + safeCue + '"\n\n' + 'Translate per your system instructions. Return ONLY the JSON schema response.';

  const t0 = Date.now();
  let result = await callClaude(baseMsg, ANTHROPIC_API_KEY);
  if (!result.ok) { console.warn(`[bbf-agentic-linguist] Claude failed (${result.error}) — returning default`); return jsonResponse(defaultLinguistResponse('claude_failed'), 200); }
  let parsed = parseTranslation(result);
  if (!parsed) return jsonResponse(defaultLinguistResponse('schema_mismatch'), 200);

  // ─── v2 · BANNED-LEXEME GATE — reject mass units, re-prompt ONCE with the slot contract ──
  let status: 'active' | 'needs_review' = 'active';
  if (hasBannedLexeme(parsed.translation)) {
    const retry = await callClaude(baseMsg + '\n\n' + RETRY_STRICT, ANTHROPIC_API_KEY);
    const reParsed = retry.ok ? parseTranslation(retry) : null;
    if (reParsed && !hasBannedLexeme(reParsed.translation)) {
      parsed = reParsed;
    } else {
      // Second failure → persist for review; do NOT surface a unit-bearing translation as clean.
      status = 'needs_review';
      console.warn(`[bbf-agentic-linguist] banned lexeme survived retry · cue_len=${safeCue.length} · lang=${lang} · needs_review`);
    }
  }
  const massSlot = hasMassSlot(parsed.translation);
  const dur = Date.now() - t0;

  // ─── v2 · LEDGER PERSIST (es/pt) — cache-first on the next identical cue ──────
  if (supabase) {
    try {
      let requestedBy: string | null = null;
      const { data: u } = await supabase.from('bbf_users').select('id').eq('uid', uid).maybeSingle();
      requestedBy = u?.id ? String(u.id) : null;
      await supabase.from('bbf_linguist_cue_ledger').upsert(
        { cue_en: safeCue, language: lang, translation: parsed.translation, phonetic: parsed.phonetic, literal_meaning: parsed.literal_meaning, has_mass_slot: massSlot, status, requested_by: requestedBy },
        { onConflict: 'cue_en,language' },
      );
    } catch (e) { console.error('[bbf-agentic-linguist] ledger upsert failed (non-fatal):', e instanceof Error ? e.message : String(e)); }
  }

  console.log(`[bbf-agentic-linguist] uid=${uid} · lang=${lang} · cue_len=${safeCue.length} · model=${(result.body as any)?.model} · status=${status} · mass_slot=${massSlot} · duration=${dur}ms`);
  return jsonResponse({ translation: parsed.translation, phonetic: parsed.phonetic, literal_meaning: parsed.literal_meaning, has_mass_slot: massSlot, status, source: 'llm', cached: false }, 200);
});
