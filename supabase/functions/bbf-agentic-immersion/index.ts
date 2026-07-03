// bbf-agentic-immersion (v2) — Immersion Simulator + persistence + injection loop
// ─────────────────────────────────────────────────────────────────────
// v1 (unchanged): multi-turn roleplay in the target language via the model router;
// per turn returns ai_reply + grammar_correction + fluency_score. Auth/CORS preserved.
//
// v2 additions (LANGUAGE_MASTERY blueprint §1.4):
//   • ADDITIVE errors[] — {term, cluster (closed taxonomy §4.4), severity} per turn
//     ([] when grammar_correction === "Perfect.").
//   • PERSISTENCE — bbf_immersion_sessions + bbf_immersion_turns (service role).
//   • INJECTION LOOP — every error term is injected into bbf_vocab_mastery at Box 1
//     (source immersion_inject, due now) so yesterday's live miss is a MANDATORY rep
//     tomorrow. A live miss beats box history.
//   • CLOSE (end:true) — fold avg fluency + clusters, append bbf_language_session_history,
//     roll bbf_language_profiles fluency_ewma + streak + weak_clusters.
// Persistence is best-effort: the roleplay reply never blocks on a DB write.
//
// Request: { uid, scenario, scenario_key?, target_language, user_message,
//            conversation_history?, session_id?, phase?, end?, admin_override? }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { routeAndLog } from '../_shared/model-router.ts';
import { ERROR_CLUSTERS, normalizeCluster, updateFluencyEwma, updateStreak, PRIORITY_BOOST_MAJOR, PRIORITY_BOOST_MINOR } from '../_shared/language-core.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-bbf-admin-token',
};
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

const MODEL              = routeAndLog('bbf-agentic-immersion', 'sport_immersion_seed');
const MAX_TOKENS         = 1024;
const EFFORT_DEFAULT     = 'high';
const CLAUDE_TIMEOUT_MS  = 12000;
const MAX_TURNS          = 12;
const MAX_MSG_LEN        = 500;

const SYSTEM_PROMPT = [
  'You are the BBF Immersion Simulator — a roleplay engine that drops the athlete into an authentic immersive language scenario. The athlete is using this to build fluency in their target language. You play the role of a native speaker the athlete is interacting with — fully in character, using region-appropriate slang, idioms, and tone.',
  '',
  '# WHAT YOU RECEIVE',
  '- scenario — the situational context (e.g. "Ordering at a gym smoothie bar in São Paulo").',
  '- target_language — the language the athlete is practicing (e.g. "es", "pt", "Spanish", "Portuguese").',
  '- user_message — what the athlete just said (in the target language, ideally — may contain errors).',
  '- conversation_history — prior turns of the same roleplay session, if any. Maintain continuity.',
  '',
  '# WHAT YOU RETURN',
  '- ai_reply — your in-character next reply, IN THE TARGET LANGUAGE. Natural local register. 1-3 sentences. No English. No meta-comment. Stay in character.',
  '- grammar_correction — analyze the athlete\'s user_message. If they made a grammar / vocabulary / register error, state the corrected version + a one-sentence explanation IN ENGLISH. If the message was clean, return literally "Perfect." (one word).',
  '- fluency_score — integer 0-100 (90-100 native · 70-89 competent · 50-69 developing · 30-49 early · 0-29 minimal/wrong/blank).',
  '- errors — an ARRAY of the reviewable mistakes in the athlete\'s message. Each item: { term (the word/short phrase the athlete got wrong, in the target language), cluster (EXACTLY one of the fixed taxonomy below), severity ("major" | "minor") }. Return [] (empty) when grammar_correction is "Perfect." Classify strictly against the CLOSED taxonomy — never invent a cluster name.',
  '',
  '# ERROR CLUSTER TAXONOMY (closed — pick exactly one per error):',
  '  ' + ERROR_CLUSTERS.join(' · '),
  '  ser_estar=ser vs estar · gender_agreement=noun/adjective gender · verb_conjugation=wrong tense/person · preposition=por/para, em/no · false_friend=false cognate · word_order=syntax order · vocab_gap=wrong/missing word · register=tú/usted, você/o senhor · pronunciation=phonetic (spoken).',
  '',
  '# CONSTRAINTS',
  '- Never break character or switch language in ai_reply. grammar_correction is ALWAYS English.',
  '- errors[] MUST be consistent with grammar_correction: [] iff "Perfect."; otherwise one item per distinct mistake.',
  '- If user_message is empty/non-language: ai_reply prompts them in-character to repeat, grammar_correction explains nothing was detected, fluency_score = 0, errors = [].',
  '',
  'Return ONLY structured JSON matching the response schema. No markdown, no preamble.',
].join('\n');

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    ai_reply:           { type: 'string', description: 'In-character native-speaker reply IN the target language. 1-3 sentences. No English.' },
    grammar_correction: { type: 'string', description: 'English correction, or literally "Perfect." if clean.' },
    fluency_score:      { type: 'integer', description: 'Integer 0-100.' },
    errors: {
      type: 'array',
      description: 'Reviewable mistakes; [] when "Perfect.". Cluster from the closed taxonomy.',
      items: {
        type: 'object',
        properties: {
          term:     { type: 'string', description: 'The word/short phrase the athlete got wrong (target language).' },
          cluster:  { type: 'string', enum: [...ERROR_CLUSTERS] },
          severity: { type: 'string', enum: ['major', 'minor'] },
        },
        required: ['term', 'cluster', 'severity'], additionalProperties: false,
      },
    },
  },
  required: ['ai_reply', 'grammar_correction', 'fluency_score', 'errors'],
  additionalProperties: false,
};

function adminOverrideMock() { return { ai_reply: 'ADMIN BYPASS: [Simulated Reply]', grammar_correction: 'Perfect execution.', fluency_score: 100, errors: [] }; }
function defaultImmersionResponse(reason: string) { return { ai_reply: '...', grammar_correction: 'Engine offline (' + reason + '). Try again in a moment.', fluency_score: 0, errors: [] }; }
function normalizeLanguage(lang: string): string {
  const t = String(lang || '').trim().toLowerCase();
  if (t === 'es' || t.startsWith('span'))                     return 'Spanish';
  if (t === 'pt' || t.startsWith('port') || t.includes('br')) return 'Portuguese (Brazilian)';
  if (t === 'en' || t.startsWith('eng'))                      return 'English';
  return lang || 'Spanish';
}
function langCode(lang: string): 'es' | 'pt' {
  const t = String(lang || '').trim().toLowerCase();
  return (t === 'pt' || t.startsWith('port') || t.includes('br')) ? 'pt' : 'es';
}

async function callClaude(systemMessages: any[], messages: any[], apiKey: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CLAUDE_TIMEOUT_MS);
  const requestBody = { model: MODEL, max_tokens: MAX_TOKENS, thinking: { type: 'adaptive' }, output_config: { effort: EFFORT_DEFAULT, format: { type: 'json_schema', schema: RESPONSE_SCHEMA } }, system: systemMessages, messages };
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify(requestBody), signal: controller.signal,
    });
    let body: any; try { body = await res.json(); } catch (_) { body = null; }
    if (!res.ok) {
      const errMsg = (body && body.error && (body.error.message || body.error.type)) || `anthropic_${res.status}`;
      console.error(`[bbf-agentic-immersion] Anthropic API error: status=${res.status} body=${JSON.stringify(body).slice(0, 600)}`);
      return { ok: false as const, status: res.status, error: errMsg, raw: body };
    }
    return { ok: true as const, status: res.status, body };
  } catch (e) {
    const err = e as Error;
    const reason = err.name === 'AbortError' ? `timeout_${CLAUDE_TIMEOUT_MS}ms` : err.message;
    console.error(`[bbf-agentic-immersion] Claude fetch threw: ${reason}`);
    return { ok: false as const, status: 0, error: reason, raw: null };
  } finally { clearTimeout(timeout); }
}
function extractTextBlock(content: any[]): string | null {
  if (!Array.isArray(content)) return null;
  for (const block of content) if (block && block.type === 'text' && typeof block.text === 'string') return block.text;
  return null;
}
function svc() {
  const url = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  return url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
}

interface TurnError { term: string; cluster: string; severity: 'major' | 'minor'; }

// v2 · persistence + injection loop (best-effort; never blocks the reply).
async function persistTurn(supabase: any, ctx: {
  uid: string; lang: 'es' | 'pt'; scenarioKey: string; phase: number; sessionId: string | null;
  userInput: string; aiReply: string; grammar: string; fluency: number; errors: TurnError[]; end: boolean;
}): Promise<{ session_id: string | null; injected: number }> {
  const { data: u } = await supabase.from('bbf_users').select('id').eq('uid', ctx.uid).maybeSingle();
  if (!u?.id) return { session_id: ctx.sessionId, injected: 0 };
  const athleteId = String(u.id);

  // open or continue the session
  let sessionId = ctx.sessionId;
  let turnNum = 1;
  if (sessionId) {
    const { data: s } = await supabase.from('bbf_immersion_sessions').select('turn_count').eq('id', sessionId).maybeSingle();
    turnNum = (Number(s?.turn_count) || 0) + 1;
  } else {
    const { data: created } = await supabase.from('bbf_immersion_sessions')
      .insert({ athlete_id: athleteId, language: ctx.lang, scenario_key: ctx.scenarioKey, phase: ctx.phase, turn_count: 0 })
      .select('id').maybeSingle();
    sessionId = created?.id ? String(created.id) : null;
  }
  if (!sessionId) return { session_id: null, injected: 0 };

  // append the turn + bump the session count
  await supabase.from('bbf_immersion_turns').upsert(
    { session_id: sessionId, turn_num: turnNum, user_input: ctx.userInput, ai_reply: ctx.aiReply, grammar_correction: ctx.grammar, errors: ctx.errors, fluency_score: ctx.fluency },
    { onConflict: 'session_id,turn_num' },
  );
  await supabase.from('bbf_immersion_sessions').update({ turn_count: turnNum }).eq('id', sessionId);

  // INJECTION LOOP · every error term → Box 1, due now (a live miss beats history)
  let injected = 0;
  const now = new Date().toISOString();
  for (const e of ctx.errors) {
    const term = String(e.term ?? '').trim().slice(0, 120);
    if (!term) continue;
    const { data: existing } = await supabase.from('bbf_vocab_mastery').select('box_level,lapses').eq('athlete_id', athleteId).eq('language', ctx.lang).eq('term', term).maybeSingle();
    const lapses = existing && Number(existing.box_level) >= 2 ? (Number(existing.lapses) || 0) + 1 : (Number(existing?.lapses) || 0);
    await supabase.from('bbf_vocab_mastery').upsert(
      { athlete_id: athleteId, language: ctx.lang, term, box_level: 1, source: 'immersion_inject', injected_from: sessionId, error_cluster: normalizeCluster(e.cluster), priority_boost: e.severity === 'major' ? PRIORITY_BOOST_MAJOR : PRIORITY_BOOST_MINOR, lapses, due_at: now },
      { onConflict: 'athlete_id,language,term' },
    );
    injected++;
  }

  // CLOSE · fold the session + roll the profile
  if (ctx.end) {
    const { data: turns } = await supabase.from('bbf_immersion_turns').select('fluency_score,errors').eq('session_id', sessionId);
    const scores = (turns ?? []).map((t: any) => Number(t.fluency_score)).filter((n: number) => Number.isFinite(n) && n > 0);
    const avg = scores.length ? Math.round((scores.reduce((s: number, n: number) => s + n, 0) / scores.length) * 100) / 100 : null;
    const clusterCounts: Record<string, number> = {};
    for (const t of (turns ?? [])) for (const er of (Array.isArray(t.errors) ? t.errors : [])) { const c = normalizeCluster(er.cluster); clusterCounts[c] = (clusterCounts[c] || 0) + 1; }
    await supabase.from('bbf_immersion_sessions').update({ avg_fluency: avg, error_clusters: clusterCounts, ended_at: now }).eq('id', sessionId);
    await supabase.from('bbf_language_session_history').insert({ athlete_id: athleteId, language: ctx.lang, module: 'immersion', mode: ctx.scenarioKey, phase: ctx.phase, started_at: now, fluency_score: avg, error_clusters: clusterCounts, items: [], meta: { session_id: sessionId, turns: turnNum } });
    // roll the profile (fluency EWMA + streak)
    const today = now.slice(0, 10);
    const { data: prof } = await supabase.from('bbf_language_profiles').select('fluency_ewma,streak_current,streak_best,last_qualified_on').eq('athlete_id', athleteId).eq('language', ctx.lang).maybeSingle();
    const newEwma = avg != null ? updateFluencyEwma(prof?.fluency_ewma != null ? Number(prof.fluency_ewma) : null, avg) : (prof?.fluency_ewma ?? null);
    const st = updateStreak(Number(prof?.streak_current) || 0, prof?.last_qualified_on ?? null, today);
    const weakClusters = Object.entries(clusterCounts).sort((a, b) => b[1] - a[1]).map(([c]) => c);
    await supabase.from('bbf_language_profiles').upsert(
      { athlete_id: athleteId, language: ctx.lang, fluency_ewma: newEwma, streak_current: st.streak_current, streak_best: Math.max(Number(prof?.streak_best) || 0, st.streak_current), last_qualified_on: today, weak_clusters: weakClusters, updated_at: now },
      { onConflict: 'athlete_id,language' },
    );
  }
  return { session_id: sessionId, injected };
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

  const { uid, scenario, scenario_key, target_language, user_message, conversation_history, session_id, phase, end, admin_override } = payload || {};

  if (admin_override === true) return jsonResponse(adminOverrideMock(), 200);

  if (typeof uid !== 'string' || !uid)                          return jsonResponse({ error: 'missing_uid' }, 400);
  if (typeof scenario !== 'string' || !scenario.trim())         return jsonResponse({ error: 'missing_scenario' }, 400);
  if (typeof user_message !== 'string' || !user_message.trim()) return jsonResponse({ error: 'missing_user_message' }, 400);

  const safeMessage   = user_message.trim().slice(0, MAX_MSG_LEN);
  const safeScenario  = scenario.trim().slice(0, MAX_MSG_LEN);
  const languageLabel = normalizeLanguage(target_language || 'Spanish');
  const lang          = langCode(target_language || 'es');
  const history       = Array.isArray(conversation_history) ? conversation_history.slice(-MAX_TURNS * 2) : [];

  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  if (!ANTHROPIC_API_KEY) { console.error('[bbf-agentic-immersion] missing ANTHROPIC_API_KEY — returning default'); return jsonResponse(defaultImmersionResponse('config_missing'), 200); }

  const systemMessages = [
    { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: '# THIS SESSION\nScenario: ' + safeScenario + '\nTarget language: ' + languageLabel + '\nStay in character as a native speaker the athlete is interacting with in this scenario.' },
  ];
  const cleanHistory = history.filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string').map((m: any) => ({ role: m.role, content: String(m.content).slice(0, MAX_MSG_LEN) }));
  const messages = cleanHistory.concat([{ role: 'user', content: safeMessage }]);

  const t0 = Date.now();
  const result = await callClaude(systemMessages, messages, ANTHROPIC_API_KEY);
  const dur = Date.now() - t0;
  if (!result.ok) { console.warn(`[bbf-agentic-immersion] Claude failed (${result.error}) after ${dur}ms — returning default`); return jsonResponse(defaultImmersionResponse('claude_failed'), 200); }

  const respBody: any = result.body;
  const text = extractTextBlock(respBody?.content);
  if (!text) { console.warn('[bbf-agentic-immersion] no text block — returning default'); return jsonResponse(defaultImmersionResponse('no_text_block'), 200); }
  let parsed: any;
  try { parsed = JSON.parse(text); } catch (e) { console.warn(`[bbf-agentic-immersion] parse failed (${(e as Error).message}) — returning default`); return jsonResponse(defaultImmersionResponse('parse_failed'), 200); }
  if (!parsed || typeof parsed.ai_reply !== 'string' || typeof parsed.grammar_correction !== 'string' || typeof parsed.fluency_score !== 'number') {
    console.warn(`[bbf-agentic-immersion] schema shape mismatch — returning default. got=${JSON.stringify(parsed).slice(0, 200)}`);
    return jsonResponse(defaultImmersionResponse('schema_mismatch'), 200);
  }

  const clampedScore = Math.max(0, Math.min(100, Math.round(parsed.fluency_score)));
  // Normalize errors[] to the closed taxonomy; "Perfect." forces [].
  const perfect = parsed.grammar_correction.trim().toLowerCase() === 'perfect.';
  const errors: TurnError[] = (!perfect && Array.isArray(parsed.errors))
    ? parsed.errors.filter((e: any) => e && typeof e.term === 'string' && e.term.trim())
        .map((e: any): TurnError => ({ term: String(e.term).trim().slice(0, 120), cluster: normalizeCluster(e.cluster), severity: e.severity === 'major' ? 'major' : 'minor' }))
    : [];

  // ─── v2 · PERSISTENCE + INJECTION (best-effort; never blocks the reply) ──────
  let sessionOut: string | null = typeof session_id === 'string' ? session_id : null;
  let injected = 0;
  const supabase = svc();
  if (supabase) {
    try {
      const r = await persistTurn(supabase, {
        uid, lang, scenarioKey: String(scenario_key ?? safeScenario).slice(0, 120), phase: Number(phase) || 1,
        sessionId: sessionOut, userInput: safeMessage, aiReply: parsed.ai_reply, grammar: parsed.grammar_correction,
        fluency: clampedScore, errors, end: end === true,
      });
      sessionOut = r.session_id; injected = r.injected;
    } catch (e) { console.error('[bbf-agentic-immersion] persistence failed (non-fatal):', e instanceof Error ? e.message : String(e)); }
  }

  console.log(`[bbf-agentic-immersion] uid=${uid} · lang=${lang} · turns=${cleanHistory.length} · score=${clampedScore} · errors=${errors.length} · injected=${injected} · end=${end === true} · model=${respBody.model} · duration=${dur}ms`);
  return jsonResponse({ ai_reply: parsed.ai_reply, grammar_correction: parsed.grammar_correction, fluency_score: clampedScore, errors, session_id: sessionOut, injected }, 200);
});
