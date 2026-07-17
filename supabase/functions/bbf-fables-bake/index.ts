// bbf-fables-bake — the BBF Fables episode baker (Fable Fleet Sync · wave 3)
// ─────────────────────────────────────────────────────────────────────
// Turns the days-11-90 content gap into a button. Given (language, day) this
// generates the next serialized episode of the "La Forja" / "A Forja" arc on
// the router's FABLE tier (narrative_curriculum_bake — the tag existed since
// wave 1; this is the function that finally calls it) and inserts it into
// bbf_curriculum_episodes as status 'pending_review'. The founder gate holds:
// nothing here can publish; the reader RPC already serves pending_review on
// the CEO-only surface, so a fresh bake is instantly usable AND still flagged
// "Pilot · in review" in The Path until its status is flipped by hand.
//
// CONTINUITY: the prompt carries (a) the compact arc bible — cast, canon,
// catchphrases, act structure — and (b) the two most recent episodes verbatim,
// so the narrative voice stays continuous with everything already reviewed.
//
// VALIDATION (server-side, never trusted to the model):
//   • THE GRAM STANDARD — any kilo/pound/gramos lexeme in any surfaced field
//     rejects the bake (mass appears ONLY as "<integer> g").
//   • Drill contract — exactly 3 drills, each 2-8 chip words, Path-compatible.
//   • One corrective retry, then a clean non-2xx error (admin tool: fail
//     closed and loud, unlike the athlete-facing engines that fail open).
//
// Request:  { language: 'es'|'pt', day: 11-90 }  ·  X-BBF-Admin-Token gated.
// Response: { ok: true, language, day, episode } | non-2xx { error, detail? }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { routeAndLog } from '../_shared/model-router.ts';
import { hasBannedLexeme } from '../_shared/language-core.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-bbf-admin-token',
};
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

const MODEL             = routeAndLog('bbf-fables-bake', 'narrative_curriculum_bake');
const MAX_TOKENS        = 3000;
const CLAUDE_TIMEOUT_MS = 60000;

// ── The arc bible — compact canon per language (lockstep with the seeded
//    days 1-10 and immersionScenarios.js personas; keep all three in sync). ──
const BIBLE: Record<'es' | 'pt', string> = {
  es: [
    'ARC: "La Forja" — a small strength gym in Mexico City. Serialized micro-fables, one scene per curriculum day.',
    'CAST (fixed, never rename):',
    '- Marisol — head coach, 38, ex-Olympic weightlifter from Guadalajara. Warm but exacting; uses tú; short precise cues; signature line "el hierro no miente"; a shoulder scar from never resting shaped her doctrine (technique before weight, rest is training).',
    '- Teo — 19, sprinter; his right-knee fear is fading day by day; keeps every number in his libreta; hit his first PR (sentadilla, 100000 g total) on day 10.',
    '- Doña Rosa — 60s, runs "El Batido de Rosa", the smoothie stand inside the gym; calls everyone mijo/mija; sneaks extra crema de cacahuate to the hardest workers; haggles at the mercado every Saturday with her vendor friend Lupita.',
    '- Side cast (use sparingly): Valeria (front desk, studies sports nutrition), Don Beto (taquero at "Tacos El Compa"), Andrés (newsstand, gives directions by landmarks).',
    'STORY SO FAR (days 1-10): arrival & bracing → empty-bar pattern → loading grams → breath under load → the smoothie counter → rest-day doctrine → the failed rep & asking for help → deload patience → market haggling → first PR ("el hierro no miente" payoff).',
    'ACT SHAPE: days 11-30 building (new lifts: peso muerto, press, remada; conditioning; nutrition habits) · days 31-60 testing & adversity (plateaus, a minor setback handled right, a rival gym, competition prep) · days 61-90 mastery & giving back (Teo starts helping newer members; a meet; the arc closes where it began — the empty bar).',
  ].join('\n'),
  pt: [
    'ARC: "A Forja" — a small strength gym in São Paulo. Serialized micro-fables, one scene per curriculum day.',
    'CAST (fixed, never rename):',
    '- Dona Marta — head coach, ex-rower from Porto Alegre. Dry humor, gaúcha directness; uses você; signature line "o ferro não mente"; rowed through shoulder pain for years and now guards recovery fiercely.',
    '- Rafa — 20, futsal player; his ankle fear is fading day by day; writes every number in his caderno; hit his first PR (agachamento, 100000 g total) on day 10.',
    '- Seu Chico — 60s, runs "O Balcão do Chico", the juice counter inside the gym; calls everyone meu filho/minha filha; famous banana vitamina with aveia; buys fruit at the Saturday feira from Zé da Feira.',
    '- Side cast (use sparingly): Camila (front desk, ex-volleyball), Dona Neide (padaria "Estrela do Bairro"), Bia (kiosk, gives directions with bus numbers).',
    'STORY SO FAR (days 1-10): arrival & bracing → empty-bar pattern → loading grams → breath under load → the juice counter → rest-day doctrine → the failed rep & asking for help → deload patience → feira haggling → first PR ("o ferro não mente" payoff).',
    'ACT SHAPE: days 11-30 building (new lifts: levantamento terra, desenvolvimento, remada; conditioning; nutrition habits) · days 31-60 testing & adversity (plateaus, a minor setback handled right, a rival academia, competition prep) · days 61-90 mastery & giving back (Rafa starts helping newer members; a meet; the arc closes where it began — the empty bar).',
  ].join('\n'),
};

const SYSTEM_PROMPT = [
  'You are the BBF Fables baker — the serialized-story engine for a language-learning curriculum inside a strength gym universe. You write ONE new episode: the next day of an ongoing arc.',
  '',
  '# NON-NEGOTIABLE RULES',
  '- scene_text is IN the target language, 6-9 short sentences (80-130 words), comprehensible-input style: natural repetition of the day\'s target vocabulary, em-dash dialogue (—), character voices EXACTLY consistent with the bible and the previous episodes provided.',
  '- scene_gloss is a faithful English translation of the scene.',
  '- THE GRAM STANDARD: mass appears ONLY as "<integer> g" (e.g. 120000 g). NEVER the words kilo, kg, kilos, libra, pound, quilo, gramos, or gramas — write the numeral + bare "g" symbol only, or avoid mass entirely.',
  '- drill_sentences: EXACTLY 3, each a line lifted from (or minimally adapted from) the scene. Each has: prompt (its English meaning) and words (the sentence split into 2-8 lowercase chip words, NO punctuation attached to any word, numerals kept as bare integers).',
  '- target_vocab: 6-10 dictionary-form terms the scene actually teaches (articles included for nouns, e.g. "la carga" / "a carga").',
  '- cast: the 1-3 bible characters who appear, as {name, role}.',
  '- title: 2-6 words, in the target language, evocative, no day number.',
  '- Advance the arc meaningfully for the given day per the ACT SHAPE — small, human, gym-true beats. Callbacks to earlier days are gold. Never contradict established canon.',
  '',
  'Return ONLY structured JSON matching the response schema.',
].join('\n');

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    title:       { type: 'string' },
    scene_text:  { type: 'string' },
    scene_gloss: { type: 'string' },
    drill_sentences: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          prompt: { type: 'string' },
          words:  { type: 'array', items: { type: 'string' } },
        },
        required: ['prompt', 'words'], additionalProperties: false,
      },
    },
    target_vocab: { type: 'array', items: { type: 'string' } },
    cast: {
      type: 'array',
      items: {
        type: 'object',
        properties: { name: { type: 'string' }, role: { type: 'string' } },
        required: ['name', 'role'], additionalProperties: false,
      },
    },
  },
  required: ['title', 'scene_text', 'scene_gloss', 'drill_sentences', 'target_vocab', 'cast'],
  additionalProperties: false,
};

// Validate a candidate episode down to the Path/Fables contract. Returns null
// when clean, else a short slug describing the first violation.
function validateEpisode(ep: any): string | null {
  if (!ep || typeof ep !== 'object') return 'not_an_object';
  if (typeof ep.title !== 'string' || ep.title.trim().length < 3 || ep.title.length > 80) return 'bad_title';
  if (typeof ep.scene_text !== 'string' || ep.scene_text.trim().length < 150 || ep.scene_text.length > 1400) return 'bad_scene_text';
  if (typeof ep.scene_gloss !== 'string' || ep.scene_gloss.trim().length < 150 || ep.scene_gloss.length > 1800) return 'bad_scene_gloss';
  if (!Array.isArray(ep.drill_sentences) || ep.drill_sentences.length !== 3) return 'bad_drill_count';
  for (const d of ep.drill_sentences) {
    if (!d || typeof d.prompt !== 'string' || !d.prompt.trim() || d.prompt.length > 90) return 'bad_drill_prompt';
    if (!Array.isArray(d.words) || d.words.length < 2 || d.words.length > 8) return 'bad_drill_words';
    for (const w of d.words) if (typeof w !== 'string' || !w.trim() || w.length > 24 || /[.,!?¿¡;:]/.test(w)) return 'bad_drill_chip';
  }
  if (!Array.isArray(ep.target_vocab) || ep.target_vocab.length < 4 || ep.target_vocab.length > 12) return 'bad_vocab';
  if (!Array.isArray(ep.cast) || ep.cast.length < 1 || ep.cast.length > 4) return 'bad_cast';
  const surfaced = [ep.title, ep.scene_text, ...ep.drill_sentences.map((d: any) => d.words.join(' ')), ...ep.target_vocab].join(' ');
  if (hasBannedLexeme(surfaced)) return 'gram_standard_violation';
  return null;
}

function extractTextBlock(content: any[]): string | null {
  if (!Array.isArray(content)) return null;
  for (const block of content) if (block && block.type === 'text' && typeof block.text === 'string') return block.text;
  return null;
}

async function callClaude(systemText: string, messages: any[], apiKey: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CLAUDE_TIMEOUT_MS);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL, max_tokens: MAX_TOKENS, thinking: { type: 'adaptive' },
        output_config: { effort: 'high', format: { type: 'json_schema', schema: RESPONSE_SCHEMA } },
        system: [{ type: 'text', text: systemText, cache_control: { type: 'ephemeral' } }],
        messages,
      }),
      signal: controller.signal,
    });
    let body: any; try { body = await res.json(); } catch (_) { body = null; }
    if (!res.ok) {
      const errMsg = (body && body.error && (body.error.message || body.error.type)) || `anthropic_${res.status}`;
      console.error(`[bbf-fables-bake] Anthropic API error: status=${res.status} msg=${errMsg}`);
      return { ok: false as const, error: errMsg };
    }
    return { ok: true as const, body };
  } catch (e) {
    const err = e as Error;
    return { ok: false as const, error: err.name === 'AbortError' ? `timeout_${CLAUDE_TIMEOUT_MS}ms` : err.message };
  } finally { clearTimeout(timeout); }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')    return jsonResponse({ error: 'method_not_allowed' }, 405);

  // Fail closed (S-4): unset secret denies.
  const expectedToken = Deno.env.get('BBF_COACH_AGENT_TOKEN') ?? '';
  const sent = req.headers.get('x-bbf-admin-token') ?? '';
  if (!expectedToken || sent !== expectedToken) return jsonResponse({ error: 'unauthorized' }, 401);

  let payload: any;
  try { payload = await req.json(); } catch (_) { return jsonResponse({ error: 'invalid_json' }, 400); }
  const lang: 'es' | 'pt' = payload?.language === 'pt' ? 'pt' : 'es';
  const day = Number(payload?.day);
  if (!Number.isInteger(day) || day < 1 || day > 90) return jsonResponse({ error: 'invalid_day' }, 400);

  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  const url = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!ANTHROPIC_API_KEY || !url || !key) return jsonResponse({ error: 'config_missing' }, 500);
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  // Never overwrite a reviewed (or pending) episode.
  const { data: existing } = await supabase.from('bbf_curriculum_episodes')
    .select('id').eq('language', lang).eq('day_number', day).maybeSingle();
  if (existing?.id) return jsonResponse({ error: 'exists', detail: `episode for ${lang} day ${day} already exists` }, 409);

  // Continuity window: the two most recent prior episodes, verbatim.
  const { data: prior } = await supabase.from('bbf_curriculum_episodes')
    .select('day_number,title,scene_text').eq('language', lang).lt('day_number', day)
    .order('day_number', { ascending: false }).limit(2);
  const priorBlock = (prior ?? []).reverse()
    .map((p: any) => `Day ${p.day_number} — "${p.title}"\n${p.scene_text}`)
    .join('\n\n') || '(none yet)';

  const systemText = SYSTEM_PROMPT + '\n\n# ARC BIBLE\n' + BIBLE[lang];
  const userMsg = [
    `Write day ${day} (of 90) for target language "${lang}".`,
    '',
    '# MOST RECENT EPISODES (match this exact voice and continue from here)',
    priorBlock,
  ].join('\n');

  // Up to 2 attempts: generate → validate → (on failure) one corrective retry.
  let messages: any[] = [{ role: 'user', content: userMsg }];
  let episode: any = null;
  let lastErr = 'unknown';
  for (let attempt = 1; attempt <= 2 && !episode; attempt++) {
    const result = await callClaude(systemText, messages, ANTHROPIC_API_KEY);
    if (!result.ok) { lastErr = result.error; break; }
    const text = extractTextBlock(result.body?.content);
    let parsed: any = null;
    try { parsed = text ? JSON.parse(text) : null; } catch (_) { parsed = null; }
    const violation = validateEpisode(parsed);
    if (!violation) { episode = parsed; break; }
    lastErr = violation;
    console.warn(`[bbf-fables-bake] attempt ${attempt} rejected: ${violation}`);
    messages = messages.concat([
      { role: 'assistant', content: text ?? '(no output)' },
      { role: 'user', content: `Rejected: ${violation}. Re-read the NON-NEGOTIABLE RULES and return corrected JSON for the same episode.` },
    ]);
  }
  if (!episode) return jsonResponse({ error: 'bake_failed', detail: lastErr }, 502);

  // Path-shape the drills (stable ids) and insert as pending_review.
  const drills = episode.drill_sentences.map((d: any, i: number) => ({
    id: `${lang}-d${day}-${i + 1}`, prompt: String(d.prompt).trim(),
    words: d.words.map((w: string) => String(w).trim()),
  }));
  const row = {
    language: lang, day_number: day, episode_number: day, arc: 'la_forja',
    title: String(episode.title).trim(),
    cast_list: episode.cast,
    scene_text: String(episode.scene_text).trim(),
    scene_gloss: String(episode.scene_gloss).trim(),
    drill_sentences: drills,
    target_vocab: episode.target_vocab.map((v: string) => String(v).trim()),
    status: 'pending_review',
  };
  const { data: inserted, error: insErr } = await supabase.from('bbf_curriculum_episodes')
    .insert(row).select('id').maybeSingle();
  if (insErr || !inserted?.id) {
    console.error(`[bbf-fables-bake] insert failed: ${insErr?.message ?? 'no id'}`);
    return jsonResponse({ error: 'insert_failed', detail: insErr?.message }, 500);
  }

  console.log(`[bbf-fables-bake] baked ${lang} day ${day} · "${row.title}" · model=${MODEL}`);
  return jsonResponse({
    ok: true, language: lang, day,
    episode: {
      arc: row.arc, episode_number: day, title: row.title, cast: row.cast_list,
      scene_text: row.scene_text, scene_gloss: row.scene_gloss,
      drill_sentences: row.drill_sentences, target_vocab: row.target_vocab, status: row.status,
    },
  }, 200);
});
