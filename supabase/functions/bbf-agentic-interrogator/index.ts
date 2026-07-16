// bbf-agentic-interrogator — The Routine Interrogator (STATEFUL lead-capture)
// ─────────────────────────────────────────────────────────────────────────────
// Public lead-gen agent. A prospect pastes their current split; the engine
// surfaces 2-3 clinical programming GAPS, contrasts BBF's proprietary systems,
// and lands a hard tier VERDICT (gateway | architect).
//
// UPGRADE (Stateful Gap Analyzer):
//   • BRAIN: Google Gemini 2.5 Flash (cost-optimized) via x-goog-api-key +
//     responseSchema-enforced strict JSON. Same 9-point audit framework + the
//     2-tier verdict rule as before.
//     ⚠ ARCHITECTURE NOTE: this is a second AI vendor and bypasses the Claude
//       model router (§4) / In-House Equity Mandate — done on explicit CEO order
//       for per-call cost. Flip back to the router (Haiku) by restoring routeAndLog.
//   • STATE: on a successful audit WITH a contact handle, the service role writes
//     public.prospect_leads (the ledger) + a public.coach_action_inbox
//     'NEW_PROSPECT' card (the coach queue) — persistence never blocks the audit.
//
// Request:  POST { routine, name?, contact_handle?, session_id? }
// Response (200): { gaps:[{title,body}], sovereign_contrast:[{system,body}],
//                   verdict:{ headline, recommended_tier, rationale } }
// FAILURE POSTURE: every path returns HTTP 200 with a graceful fallback object.

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

const GEMINI_MODEL      = 'gemini-2.5-flash';
const MAX_TOKENS        = 2048;
const GEMINI_TIMEOUT_MS = 16000;
const MAX_ROUTINE_LEN   = 4000;
const MAX_HANDLE_LEN    = 160;
const MAX_NAME_LEN      = 120;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const SYSTEM_PROMPT = [
  'You are the BBF Routine Interrogator — a ruthless but clinically precise exercise scientist auditing a prospect\'s current training routine. You hold credentials in occupational therapy, exercise physiology, and NASM-CPT biomechanics. You speak with the directness of a strength coach who has audited 10,000 programs and knows exactly where they fail.',
  '',
  '# CRITICAL CONSTRAINTS',
  '- You DO NOT rewrite the prospect\'s workout. You do not prescribe replacement exercises, sets, or reps. That is paid work.',
  '- You DO NOT hedge, soften, or congratulate. No "great start", no "solid foundation". The prospect came here for a clinical audit, not validation.',
  '- You DO surface the specific structural gaps in their programming and contrast them against BBF\'s proprietary systems.',
  '- You DO end with a hard recommendation to upgrade.',
  '',
  '# REQUIRED OUTPUT STRUCTURE — three sections, no preamble',
  '',
  '## (1) GAPS — 2 to 3 entries',
  'Identify SPECIFIC programming failures in the routine they pasted. Each entry has a short `title` (3-6 words, all caps, clinical) and a `body` (1-3 sentences) explaining the failure in measurable, biomechanical terms. Draw from this audit framework:',
  '  · JUNK VOLUME — sets that don\'t contribute to the stated stimulus (e.g. 4 sets of cable lateral raises after a heavy push day).',
  '  · MISSING OT PREHAB — no joint capsule work, no thoracic mobility, no scapular control work between heavy compound days.',
  '  · OVERLAPPING JOINT STRESS — back-to-back days that load the same joint (e.g. heavy squats then heavy deadlifts with no decompression).',
  '  · NO PERIODIZATION — same load / volume week to week with no taper, deload, or wave progression.',
  '  · ENERGY-SYSTEM MISMATCH — heavy strength work on the same day as long Zone-2 cardio (cancels the strength signal).',
  '  · UNILATERAL BLIND SPOT — only bilateral compounds, no single-leg or single-arm work to correct asymmetries.',
  '  · VOLUME / FREQUENCY INVERSION — too few weekly sets per muscle group for hypertrophy, OR too many to recover from.',
  '  · NEURAL OVERLOAD — daily CNS-demanding work (squats, deadlifts, oly lifts) with no parasympathetic shift programmed in.',
  '  · NUTRITION OMISSION — no fueling or recovery nutrition mentioned alongside the loading pattern.',
  'Pick the 2-3 failures that are the LOUDEST in the actual text the prospect pasted. Quote or reference specific exercises/days from their routine when you can — it proves you read it.',
  '',
  '## (2) SOVEREIGN CONTRAST — 2 to 3 entries (mirror the GAPS count)',
  'For each gap, name ONE BBF proprietary system that solves it. Each entry has a `system` field (the proprietary name, exactly as listed below) and a `body` (1-3 sentences) explaining the mechanism by which that system closes the gap. Available systems — use the exact name:',
  '  · DYNAMIC PREHAB MATRIX — daily 3-movement OT-informed recovery protocol that adapts to the day\'s load and the athlete\'s reported friction zone. Closes the prehab gap before it becomes injury.',
  '  · HYPERTROPHY HEATMAP — 4-week axial load + volume tracker per muscle group + joint. Surfaces junk volume and overlapping joint stress in real time. Architect-tier and above.',
  '  · MIDNIGHT HAIKU ENGINE — nightly briefing engine that reads the prospect\'s 24h log + readiness state and writes the next day\'s adjustment. Eliminates the "same routine every week" inversion.',
  '  · SOVEREIGN COMLINK — voice-rewrite agent. State a friction or constraint mid-session; the engine rewrites the day\'s exercises while preserving the stimulus.',
  '  · CNS FRICTION SCORE — autonomic readiness reading that gates heavy CNS work when systemic load is already redlined.',
  '  · BIOMECHANICAL HEALTH MATRIX — 4-week per-lift heatmap (squat, deadlift, OHP, bench). Flags repeated joint stress before tissue debt compounds.',
  '  · OT-INFORMED FRICTION SCANNER — keyword-aware override that swaps heavy compounds for decompression + mobility when CNS or spinal load is flagged.',
  '  · POSITIONAL INTELLIGENCE COMLINK — athletic-improvement query that returns founder-verified drills filtered to the prospect\'s sport + position.',
  '  · KINEMATIC FORM HUD — vision-agent form audit that flags valgus collapse, anterior pelvic tilt, and ACL shear during the actual lift.',
  '',
  '## (3) VERDICT — single object',
  'A hard tier recommendation, no hedging.',
  '  · `headline` — ONE direct sentence (under 110 chars) naming the tier and the verdict (e.g. "Architect Hybrid. Stop guessing — start auditing every variable.").',
  '  · `recommended_tier` — exactly "gateway" OR "architect".',
  '    Pick gateway when the routine shows basic structural issues + the prospect is solo / self-coaching and needs the habit architecture engine + Dynamic Prehab Matrix.',
  '    Pick architect when the routine shows compounded gaps (3 of the failures above) + the prospect needs the full Hypertrophy Heatmap + Midnight Haiku + coach check-ins.',
  '  · `rationale` — 1-2 sentences explaining why that specific tier closes the specific gaps you surfaced above. Reference at least one gap and one system by name.',
  '',
  '# VOICE',
  '- Clinical. Direct. Sovereign brand voice.',
  '- No exclamation marks. No emoji. No "consider", no "may want to", no "honestly".',
  '- Quote the prospect\'s specific exercises / days when you can.',
  '- If the input is empty, gibberish, or not a workout (e.g. "test", "abc", a sentence asking a question): return a graceful audit explaining you need a real routine to audit, with a verdict pointing to Gateway as the entry path.',
  '',
  'Return ONLY structured JSON matching the response schema. No markdown headings, no preamble, no closing remarks.',
].join('\n');

// Gemini responseSchema (OpenAPI-subset dialect — uppercase Type enums).
const GEMINI_SCHEMA = {
  type: 'OBJECT',
  properties: {
    gaps: {
      type: 'ARRAY',
      minItems: 2,
      maxItems: 3,
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          body:  { type: 'STRING' },
        },
        required: ['title', 'body'],
      },
    },
    sovereign_contrast: {
      type: 'ARRAY',
      minItems: 2,
      maxItems: 3,
      items: {
        type: 'OBJECT',
        properties: {
          system: { type: 'STRING' },
          body:   { type: 'STRING' },
        },
        required: ['system', 'body'],
      },
    },
    verdict: {
      type: 'OBJECT',
      properties: {
        headline:         { type: 'STRING' },
        recommended_tier: { type: 'STRING', enum: ['gateway', 'architect'] },
        rationale:        { type: 'STRING' },
      },
      required: ['headline', 'recommended_tier', 'rationale'],
    },
  },
  required: ['gaps', 'sovereign_contrast', 'verdict'],
};

// ─── Static fallback if the upstream call fails ───────────────────────────────
function defaultFallback(reason: string) {
  return {
    gaps: [
      { title: 'AUDIT ENGINE OFFLINE',    body: 'The interrogator could not complete the clinical read (reason: ' + reason + '). Your routine was received but not analyzed in this transmission.' },
      { title: 'PROGRAMMING UNCERTAINTY', body: 'Without the audit, the structural risk in your current split is unknown. Most routines we receive show at least two of the eight common failures: junk volume, missing prehab, overlapping joint stress, or no periodization.' },
    ],
    sovereign_contrast: [
      { system: 'DYNAMIC PREHAB MATRIX', body: 'Daily 3-movement OT-informed recovery protocol — runs regardless of the audit so the prehab gap closes from day one.' },
      { system: 'MIDNIGHT HAIKU ENGINE', body: 'Nightly readiness briefing that adjusts the next day\'s load based on actual recovery state. Eliminates the same-week-every-week trap.' },
    ],
    verdict: {
      headline:         'Gateway tier. Open the architecture — the audit re-runs the moment the engine\'s back online.',
      recommended_tier: 'gateway',
      rationale:        'The Dynamic Prehab Matrix and Midnight Haiku Engine are the two systems every BBF tier starts with — they close the universal gaps before custom programming layers on top.',
    },
  };
}

// ─── Gemini call w/ AbortController timeout ───────────────────────────────────
async function callGemini(userMessage: string, apiKey: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

  const requestBody = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: userMessage }] }],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: MAX_TOKENS,
      responseMimeType: 'application/json',
      responseSchema: GEMINI_SCHEMA,
    },
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    let body: any;
    try { body = await res.json(); } catch (_) { body = null; }
    if (!res.ok) {
      const errMsg = (body && body.error && (body.error.message || body.error.status)) || `gemini_${res.status}`;
      console.error(`[bbf-agentic-interrogator] Gemini API error: status=${res.status} body=${JSON.stringify(body).slice(0, 600)}`);
      return { ok: false as const, status: res.status, error: errMsg };
    }
    return { ok: true as const, status: res.status, body };
  } catch (e) {
    const err = e as Error;
    const reason = err.name === 'AbortError' ? `timeout_${GEMINI_TIMEOUT_MS}ms` : err.message;
    console.error(`[bbf-agentic-interrogator] Gemini fetch threw: ${reason}`);
    return { ok: false as const, status: 0, error: reason };
  } finally {
    clearTimeout(timeout);
  }
}

function geminiText(body: any): string | null {
  const parts = body?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return null;
  const text = parts.map((p: any) => (p && typeof p.text === 'string' ? p.text : '')).join('');
  return text || null;
}

// ─── Service-role persistence (never blocks the audit) ────────────────────────
async function pgPost(path: string, rows: unknown): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`pg_post_${res.status}:${(await res.text()).slice(0, 200)}`);
  return res.json();
}

function firstNameOf(name: string, handle: string): string {
  const n = String(name || '').trim().split(/\s+/)[0];
  if (n) return n;
  const h = String(handle || '').replace(/^@/, '').split(/[@.]/)[0];
  return h || 'there';
}

function buildInsight(parsed: any, name: string, handle: string): string {
  const titles = parsed.gaps.map((g: any) => g.title).join(', ');
  const who = (name && name.trim()) || handle || 'Prospect';
  return `${who}: ${parsed.gaps.length} programming gap${parsed.gaps.length === 1 ? '' : 's'} (${titles}). Verdict → ${parsed.verdict.recommended_tier}.`.slice(0, 600);
}

function buildProposedAction(parsed: any): string {
  const sys = parsed.sovereign_contrast?.[0]?.system || 'Sovereign Contrast';
  const loudest = parsed.gaps?.[0]?.title || 'their loudest gap';
  return `Invite to try the ${sys} system — it matches their loudest gap (${loudest}).`.slice(0, 600);
}

function buildDraftMessage(parsed: any, name: string, handle: string): string {
  const fn = firstNameOf(name, handle);
  const gap = parsed.gaps?.[0]?.title ? String(parsed.gaps[0].title).toLowerCase() : 'a structural gap';
  const sys = parsed.sovereign_contrast?.[0]?.system || 'BBF system';
  return (
    `Hey ${fn}, Coach Akeem here. I ran your split through our clinical audit — the loudest gap I flagged is ${gap}. ` +
    `Our ${sys} is built to close exactly that. Want me to walk you through how it works for you? ` +
    `— Coach Akeem, Build Believe Fit`
  ).slice(0, 800);
}

async function persistLead(parsed: any, ctx: { name: string; contactHandle: string; routine: string }) {
  const leadRows = await pgPost('prospect_leads', [{
    name: ctx.name || null,
    contact_handle: ctx.contactHandle,
    raw_workout_split: ctx.routine,
    gap_verdict: parsed.verdict.recommended_tier,
    gap_report: parsed,
  }]);
  const prospectId = (Array.isArray(leadRows) && leadRows.length) ? leadRows[0].id : null;
  await pgPost('coach_action_inbox', [{
    type: 'NEW_PROSPECT',
    // status 'NEW' (not the default 'PENDING') keeps prospect cards OUT of the
    // agentic Action Inbox desk (bbf-agent-brain lists status=PENDING only) — they
    // live solely in the Comlink Prospects lane (bbf-prospect-inbox reads by type).
    status: 'NEW',
    risk_score: null,
    insight_summary: buildInsight(parsed, ctx.name, ctx.contactHandle),
    proposed_action: buildProposedAction(parsed),
    draft_message: buildDraftMessage(parsed, ctx.name, ctx.contactHandle),
    prospect_id: prospectId,
  }]);
  return prospectId;
}

// ─── Handler ──────────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')    return jsonResponse({ error: 'method_not_allowed' }, 405);

  let payload: any;
  try { payload = await req.json(); }
  catch (_) { return jsonResponse({ error: 'invalid_json' }, 400); }

  const { routine, name, contact_handle, session_id } = payload || {};
  if (typeof routine !== 'string' || !routine.trim()) {
    return jsonResponse({ error: 'missing_routine' }, 400);
  }

  const safeRoutine = routine.slice(0, MAX_ROUTINE_LEN);
  const safeSession = (typeof session_id === 'string' && session_id) ? session_id.slice(0, 64) : 'anonymous';
  const safeName    = (typeof name === 'string' ? name : '').trim().slice(0, MAX_NAME_LEN);
  const safeHandle  = (typeof contact_handle === 'string' ? contact_handle : '').trim().slice(0, MAX_HANDLE_LEN);

  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
  if (!GEMINI_API_KEY) {
    console.error('[bbf-agentic-interrogator] missing GEMINI_API_KEY — returning fallback');
    return jsonResponse(defaultFallback('config_missing'), 200);
  }

  const userMessage =
    '## prospect routine submission\n' +
    'session_id: ' + safeSession + '\n' +
    'length_chars: ' + safeRoutine.length + '\n\n' +
    '```\n' + safeRoutine + '\n```\n\n' +
    'Audit per your system instructions. Return ONLY the JSON schema response — { gaps, sovereign_contrast, verdict }.';

  const t0     = Date.now();
  const result = await callGemini(userMessage, GEMINI_API_KEY);
  const dur    = Date.now() - t0;

  if (!result.ok) {
    console.warn(`[bbf-agentic-interrogator] Gemini failed (${result.error}) after ${dur}ms — returning fallback`);
    return jsonResponse(defaultFallback('gemini_failed'), 200);
  }

  const text = geminiText(result.body);
  if (!text) {
    console.warn('[bbf-agentic-interrogator] no text in Gemini response — returning fallback');
    return jsonResponse(defaultFallback('no_text'), 200);
  }

  let parsed: any;
  try { parsed = JSON.parse(text); }
  catch (e) {
    console.warn(`[bbf-agentic-interrogator] parse failed (${(e as Error).message}) — returning fallback`);
    return jsonResponse(defaultFallback('parse_failed'), 200);
  }

  if (
    !parsed ||
    !Array.isArray(parsed.gaps) || parsed.gaps.length < 2 ||
    !Array.isArray(parsed.sovereign_contrast) || parsed.sovereign_contrast.length < 2 ||
    !parsed.verdict || typeof parsed.verdict !== 'object' ||
    typeof parsed.verdict.headline !== 'string' ||
    (parsed.verdict.recommended_tier !== 'gateway' && parsed.verdict.recommended_tier !== 'architect') ||
    typeof parsed.verdict.rationale !== 'string'
  ) {
    console.warn(`[bbf-agentic-interrogator] schema shape mismatch — fallback. got=${JSON.stringify(parsed).slice(0, 200)}`);
    return jsonResponse(defaultFallback('schema_mismatch'), 200);
  }

  // Defensive shape coercion — trim and stringify every field.
  const cleanGaps = parsed.gaps.slice(0, 3).map((g: any) => ({
    title: String((g && g.title) || 'Gap').slice(0, 80),
    body:  String((g && g.body)  || '').slice(0, 600),
  }));
  const cleanContrast = parsed.sovereign_contrast.slice(0, 3).map((c: any) => ({
    system: String((c && c.system) || 'BBF System').slice(0, 80),
    body:   String((c && c.body)   || '').slice(0, 600),
  }));
  const cleanVerdict = {
    headline:         String(parsed.verdict.headline).slice(0, 200),
    recommended_tier: parsed.verdict.recommended_tier,
    rationale:        String(parsed.verdict.rationale).slice(0, 400),
  };
  const audit = { gaps: cleanGaps, sovereign_contrast: cleanContrast, verdict: cleanVerdict };

  // ── STATE: persist the lead + coach inbox card (only with a contact handle;
  //    never let a persistence failure break the prospect's audit response). ──
  let persisted = false;
  if (safeHandle) {
    try {
      await persistLead(audit, { name: safeName, contactHandle: safeHandle, routine: safeRoutine });
      persisted = true;
    } catch (e) {
      console.error(`[bbf-agentic-interrogator] persistence failed (non-fatal): ${(e as Error).message}`);
    }
  }

  console.log(`[bbf-agentic-interrogator] session=${safeSession} · routine_len=${safeRoutine.length} · gaps=${cleanGaps.length} · tier=${cleanVerdict.recommended_tier} · handle=${safeHandle ? 'y' : 'n'} · persisted=${persisted} · model=${GEMINI_MODEL} · duration=${dur}ms`);

  return jsonResponse(audit, 200);
});
