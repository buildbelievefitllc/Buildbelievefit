// bbf-agentic-comlink v3 — Sovereign Comlink (Phase 7 + Warheads 2/3 + Phase 4)
// ─────────────────────────────────────────────────────────────────────
// SINGLE-FN ROUTER. FOUR intents, one entrypoint:
//
//   (a) constraint   — athlete states a time / equipment / minor-pain
//                      constraint mid-session. Agent rewrites today's
//                      workout while preserving the physiological
//                      stimulus. (Original Phase 7 behavior.)
//
//   (b) friction     — athlete reports CNS fatigue, lower-back friction,
//                      heavy systemic load, or an OT-class warning sign.
//                      Agent overrides today's plan with an Occupational
//                      Therapy-informed decompression + mobility matrix
//                      (90/90 breathing, hip CARs, T-spine rotations,
//                      Z-press, banded face pulls). Same response shape
//                      as constraint — `updated_workout` is just the
//                      decompression array.
//
//   (c) positional_drill (Warhead 2) — athlete asks for an athletic
//                      improvement (e.g. "I need a faster first step").
//                      Frontend supplies the BBF founder-verified drill
//                      catalog for their sport+position. Agent selects
//                      the best-fit drill and returns its index plus a
//                      coaching verdict. Returns a DIFFERENT shape
//                      ({ drill_index, coaching_verdict, why }) so the
//                      Athlete Portal can render a drill card.
//
//   (d) form_correction (Phase 4 · Sustained-Redline cascade) — fired
//                      by BBF_PROGRAM_INTEL when the deterministic
//                      redline lookup table MISSES on a novel kinematic
//                      deviation. Rate-capped via BBF_INTERCEPT before
//                      it gets here so this code path is never hot.
//                      Returns { corrective_cue, swap_to } so the Form
//                      Swap banner can render in the rest gap.
//
// Routing: intents (a) and (b) are auto-classified by Claude inside ONE
// prompt (the default flow when `intent` is missing or = "constraint").
// Intents (c) and (d) are explicit — frontend sets `intent` accordingly.
//
// Request shape:
//   POST /functions/v1/bbf-agentic-comlink
//   Content-Type: application/json
//   X-BBF-Admin-Token: <optional shared secret>
//
//   // constraint / friction (default — FAB)
//   {
//     "uid":             "jacque_bbf",
//     "transcript":      "my lower back is fried",
//     "current_workout": [{ "name", "sets", "reps", "equipment", "notes" }, ...],
//     "client_context":  { "goal", "partner" },
//     "admin_override":  false
//   }
//
//   // positional_drill (Warhead 2 — Athlete Portal query box)
//   {
//     "intent":      "positional_drill",
//     "uid":         "jacque_bbf",
//     "query":       "I need a faster first step",
//     "sport":       "football",
//     "position":    "RB",
//     "candidates":  [{ name:{en,es,pt}, sets, focus:{en,es,pt}, equipment, kpi }, ...],
//     "lang":        "en" | "es" | "pt",
//     "admin_override": false
//   }
//
// Response shapes (always HTTP 200):
//
//   // constraint / friction
//   { "comlink_verdict": string, "updated_workout": [{name, target, weight_lbs}, ...] }
//
//   // positional_drill
//   { "drill_index": number, "coaching_verdict": string, "why": string }
//
// FAILURE POSTURE: every code path returns a valid response at HTTP 200.
// On any upstream failure, returns the original workout unchanged (or
// drill_index=0) with a verdict explaining the engine couldn't process.

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

// Phase 7 Workstream B · Comlink classifies the transcript (constraint
// vs friction) then rewrites the day's workout · including the
// form_correction intent for novel kinematic deviations. Sonnet 4.6
// handles vision-adjacent reasoning and structured rewrites at lower
// cost than Opus, per CEO routing rules.
// TODO Phase 7.x · migrate to _shared/model-router.ts once shared-file
// deploy is wired up. For now this matches routeModel('novel_form_correction').
const MODEL              = 'claude-sonnet-4-6';
const MAX_TOKENS         = 2048;
const EFFORT_DEFAULT     = 'high';
const CLAUDE_TIMEOUT_MS  = 14000;
const MAX_TRANSCRIPT_LEN = 800;
const MAX_CANDIDATES     = 12;

// ═══════════════════════════════════════════════════════════════════════
// (a) + (b) — Constraint + Friction router (FAB voice flow)
// ═══════════════════════════════════════════════════════════════════════
const SYSTEM_PROMPT_REWRITE = [
  'You are the BBF Sovereign Comlink — an elite strength coach + Occupational Therapist receiving a real-time radio transmission from an athlete already mid-session. They state EITHER a tactical constraint (time, equipment, minor pain in a specific joint) OR a friction signal (CNS fatigue, lower-back friction, "I\'m fried", "heavy day", general systemic load). You dynamically rewrite the day\'s workout to match.',
  '',
  '# YOU RECEIVE',
  '- transcript — the athlete\'s spoken or typed signal (Web Speech API; expect noisy / fragmented). Examples: "I only have 20 minutes", "the squat rack is taken", "my left knee is acting up", "my lower back is fried", "CNS is cooked", "I need to deload today".',
  '- current_workout — the day\'s planned exercises. Array of { name, sets, reps, equipment, notes, ... }.',
  '- profile context — uid, optional goal / partner.',
  '',
  '# ROUTE THE SIGNAL',
  'STEP 1 — Classify the transcript silently as ONE of:',
  '  · CONSTRAINT — finite tactical limit (time, equipment, single-joint pain). Preserve the stimulus, work around the limit.',
  '  · FRICTION   — systemic / autonomic / OT-class warning. Examples: lower-back fried, CNS fatigue, "I\'m cooked", "deload day", "everything hurts", spinal compression after heavy lifting, sleep-debt + heavy soreness.',
  '',
  '# IF CONSTRAINT — REWRITE PRINCIPLES',
  '1. PRESERVE THE STIMULUS. Lower-body strength day stays lower-body strength. Swap exercises, never the goal.',
  '2. RESPECT THE CONSTRAINT VERBATIM. "20 minutes" = fits in ≤20 minutes. "All barbells taken" = zero barbell exercises.',
  '3. SAFETY OVERRIDES EVERYTHING. Pain at a joint → no load on that joint.',
  '4. KEEP NAMES SPECIFIC AND COACHED. "DB Romanian Deadlift" not "Hamstring Exercise".',
  '',
  '# IF FRICTION — OCCUPATIONAL-THERAPY OVERRIDE',
  'When the signal is friction (CNS fatigue / lower-back fried / systemic load), the day\'s heavy compound lifts (squat / deadlift / bench / OHP / clean) are CANCELLED. Replace with an OT-informed decompression + mobility protocol designed to shift the athlete from sympathetic to parasympathetic and protect joint integrity.',
  '',
  'FRICTION TOOLKIT — draw 4–6 movements from this OT-informed library, prioritized for the friction zone the athlete named:',
  '  · 90/90 Diaphragmatic Breathing (5 minutes) — vagal reset, parasympathetic shift.',
  '  · Cat-Cow Spinal Flow (2 minutes) — segmental spinal articulation.',
  '  · Hip CARs (Controlled Articular Rotations, 5/side) — capsule decompression.',
  '  · Thoracic Spine Open-Book Rotations (8/side) — thoracic mobility.',
  '  · Z-Press (light, 3x8) — overhead strength with locked lumbar — anti-extension.',
  '  · Banded Face Pulls (3x15) — posterior chain reactivation, light load.',
  '  · Dead Hang from Pull-up Bar (3x20-30 sec) — axial decompression for spine.',
  '  · McGill Big-3 (Curl-up, Side Plank, Bird Dog) — back-safe core endurance.',
  '  · Half-Kneeling Hip Flexor Mobilization (30 sec hold x 3/side) — anterior chain release.',
  '  · Wall Slides + Scap Push-ups (3x10) — shoulder reset, low-load.',
  '  · Childs Pose with Side Reach (60 sec total) — lumbar + lat decompression.',
  '  · Standing Banded Pull-Apart (3x20) — postural reset, easy on the CNS.',
  '',
  'For friction, comlink_verdict must explicitly name the override. Examples:',
  '  · "Friction registered. Compounds cancelled — today is decompression and parasympathetic shift."',
  '  · "CNS read: cooked. Pulling all heavy loading. OT decompression protocol active."',
  '  · "Lower back fried. Day pivots to axial decompression + mobility. Recovery is the gain."',
  '',
  '# OUTPUT FIELDS (BOTH PATHS)',
  '- comlink_verdict — ONE short radio-style sentence (under 120 chars). Direct coach voice, references the constraint OR friction explicitly.',
  '- updated_workout — array of { name, target, weight_lbs } objects.',
  '  · name: specific movement name including any tempo/variation cue.',
  '  · target: rep/set/duration prescription as a free-form string. Examples: "3x10", "5x5", "30 sec hold x 3 sides", "5 minutes", "20 controlled reps".',
  '  · weight_lbs: numeric string ("100"), or "BW" (bodyweight), or "" (no specific load).',
  '- Array length: 3–8 entries. Constraint compressed sessions → 3–4 movements. Friction overrides → 4–6 mobility/decompression movements.',
  '',
  '# UNIVERSAL CONSTRAINTS',
  '- If the transcript is unclear / nonsensical / not a workout signal: return the current_workout unchanged (mapped into the new schema shape) and use comlink_verdict to ask the athlete to repeat.',
  '- Never increase load relative to the original plan.',
  '- Direct voice. No hedging. No "consider", no "may want to".',
  '',
  'Return ONLY structured JSON matching the response schema. No markdown, no preamble.',
].join('\n');

const RESPONSE_SCHEMA_REWRITE = {
  type: 'object',
  properties: {
    comlink_verdict: {
      type: 'string',
      description: 'Short radio-style coach reply referencing the constraint or friction signal. Under 120 chars.',
    },
    updated_workout: {
      type: 'array',
      description: '3-8 rewritten exercises — constraint-aware swaps OR friction-driven OT decompression protocol.',
      items: {
        type: 'object',
        properties: {
          name:       { type: 'string', description: 'Specific movement name including variation/tempo cue.' },
          target:     { type: 'string', description: 'Rep/set/duration prescription as a free-form string.' },
          weight_lbs: { type: 'string', description: 'Numeric weight as a string, or "BW", or "".' },
        },
        required: ['name', 'target', 'weight_lbs'],
      },
    },
  },
  required: ['comlink_verdict', 'updated_workout'],
  additionalProperties: false,
};

// ═══════════════════════════════════════════════════════════════════════
// (c) — Positional Drill (Warhead 2 — Athlete Portal query box)
// ═══════════════════════════════════════════════════════════════════════
const SYSTEM_PROMPT_POSITIONAL = [
  'You are the BBF Positional Intelligence Comlink — an elite sports-performance coach with deep biomechanical knowledge of every position in football, basketball, soccer, baseball, and volleyball. An athlete states a SPECIFIC athletic improvement they want to develop (faster first step, higher vertical, lateral agility, throwing velocity, etc.). You select the SINGLE best-fit drill from the BBF founder-verified catalog they have access to and return a tactical coaching verdict.',
  '',
  '# YOU RECEIVE',
  '- query — the athlete\'s typed improvement request. Examples: "I need a faster first step", "my vertical is stuck", "I want better lateral agility on pass-protection", "more torque on my throws".',
  '- sport + position — narrows the catalog. The candidates array contains ONLY drills already filtered to this sport+position.',
  '- candidates — array of founder-verified drills for this athlete\'s slot. Each has multilingual name + focus, sets prescription, equipment, and KPI tag.',
  '- lang — output language for verdict + why text ("en" | "es" | "pt").',
  '',
  '# YOUR JOB',
  '1. Read the athlete\'s query and match its intent to one of the KPI/focus tags in the candidate drills.',
  '2. Return the INDEX (0-based) of the best-fit drill in the candidates array.',
  '3. Write a coaching verdict (one direct sentence, under 100 chars, in the requested lang) that confirms the match.',
  '4. Write a "why" line (one sentence, under 180 chars, in the requested lang) that explains the biomechanical link between the drill\'s KPI and the athlete\'s stated goal.',
  '',
  '# MATCH HEURISTICS',
  '- "first step" / "burst" / "explosive start" → look for KPIs containing "First-Step", "Linear Acceleration", "Off-Ball Acceleration", "Lateral Agility".',
  '- "vertical" / "jump higher" / "rim touch" → "Vertical Displacement", "Vertical Jump Height", "Block Reach", "Rebounding Force".',
  '- "lateral" / "cut" / "agility" → "Lateral Agility", "Change of Direction", "Multi-Directional Quickness", "Lateral Tracking".',
  '- "throw" / "velocity" / "arm" → "Rotational Torque", "Throwing Velocity", "Pitch Velocity", "Rotational Throw Force", "Kinetic Sequencing".',
  '- "hip" / "mobility" / "hip drive" → "Triple Extension Power", "Pivot Speed", "Hip Transition".',
  '- "endurance" / "stamina" / "match fitness" → "Repeat Sprint Ability", "Total Distance", "Jump Count Tolerance", "Versatility Endurance".',
  '- If multiple drills tie, prefer the one whose `focus` text reads closest to the athlete\'s stated mechanism.',
  '- If nothing cleanly matches, pick the drill whose focus is closest in domain and acknowledge the partial fit in `why`.',
  '',
  '# VOICE',
  '- Direct. Confident. Coach radio. No hedging.',
  '- Reference the chosen drill by name in the verdict.',
  '- Why field must cite the SPECIFIC KPI the drill develops and how it serves the athlete\'s query.',
  '',
  'Return ONLY structured JSON matching the response schema. No markdown, no preamble.',
].join('\n');

const RESPONSE_SCHEMA_POSITIONAL = {
  type: 'object',
  properties: {
    drill_index: {
      type: 'integer',
      description: '0-based index of the chosen drill in the candidates array.',
      minimum: 0,
    },
    coaching_verdict: {
      type: 'string',
      description: 'One direct sentence (under 100 chars, in requested lang) confirming the drill choice.',
    },
    why: {
      type: 'string',
      description: 'One sentence (under 180 chars, in requested lang) linking the drill KPI to the athlete\'s stated improvement.',
    },
  },
  required: ['drill_index', 'coaching_verdict', 'why'],
  additionalProperties: false,
};

// ═══════════════════════════════════════════════════════════════════════
// (d) — Form Correction (Phase 4 · Sustained-Redline cascade)
// ═══════════════════════════════════════════════════════════════════════
const SYSTEM_PROMPT_FORM_CORRECTION = [
  'You are the BBF Form-Correction Comlink. The athlete is mid-session. The deterministic redline lookup table has MISSED — this is a NOVEL kinematic deviation that has persisted across multiple reps. The Sustained-Redline gate has already fired, the rate-cap has already cleared. Your only job: return ONE direct corrective cue and the single best alternate exercise to swap to.',
  '',
  '# YOU RECEIVE',
  '- exercise_name — the lift the athlete is currently performing.',
  '- deviation — a canonical key for the kinematic fault (e.g. "valgus_collapse", "lumbar_flexion", "elbow_flare", or something novel the vision agent flagged).',
  '- recent_events — array of up to 6 most-recent flagged reps: { deviation, severity (0-1), rep_index, ts }.',
  '- client_context.systemContext — the BBF Occupational Therapy reasoning frame (MEANINGFUL OCCUPATION + GRADED PROGRESSION + ADAPTIVE COMPENSATION). Honor it.',
  '- client_context.cns_snapshot — the athlete\'s current Systemic / Localized / Axial state.',
  '',
  '# YOUR OUTPUT',
  '- corrective_cue — ONE direct sentence (under 140 chars). Sharp coach voice. Imperative. Describes (a) what the deviation IS in plain English and (b) the specific fix the athlete should apply on the next attempt. Examples:',
  '    · "Pelvis rotating left on the descent. Brace harder on the right oblique, mid-foot pressure."',
  '    · "Bar drifting forward on the second pull. Reset stance two inches narrower, pull through the heels."',
  '- swap_to — the SINGLE best alternate exercise to switch to (string · specific movement name). If the deviation is mild AND the athlete can correct it with the cue alone, return the same exercise_name (it signals "stay on the lift, apply the cue"). Otherwise pick a movement that delivers the same training stimulus but removes the friction pattern.',
  '',
  '# CONSTRAINTS',
  '- ADAPTIVE COMPENSATION — never push through. The swap exercise must REMOVE the friction, not work around it.',
  '- Direct voice. No "consider", "perhaps", "may want to". Imperatives only.',
  '- The cue is read aloud mid-session — keep it tight, no preamble, NO clinical vocabulary (no "pathology", "diagnosis", "dysfunction"; use "friction", "pattern variance", "load alert").',
  '- If the deviation is severe AND recurring, bias toward a machine or regression (e.g. hack squat instead of back squat, landmine press instead of OHP).',
  '',
  'Return ONLY structured JSON matching the response schema. No markdown, no preamble.',
].join('\n');

const RESPONSE_SCHEMA_FORM_CORRECTION = {
  type: 'object',
  properties: {
    corrective_cue: {
      type: 'string',
      description: 'One direct coach sentence under 140 chars describing the deviation and the fix.',
    },
    swap_to: {
      type: 'string',
      description: 'Single best alternate exercise name. May equal exercise_name when the cue alone suffices.',
    },
  },
  required: ['corrective_cue', 'swap_to'],
  additionalProperties: false,
};

function adminOverrideMockFormCorrection() {
  return {
    corrective_cue: 'MASTER KEY: Form correction bypassed · admin override active.',
    swap_to:        'ADMIN BYPASS: Hack Squat',
  };
}
function defaultFormCorrectionFallback(exerciseName: string, deviation: string, reason: string) {
  return {
    corrective_cue: 'Comlink offline (' + reason + '). Sustained ' + (deviation || 'pattern') + ' variance · lighten the load 20% and finish the set with strict tempo.',
    swap_to:        exerciseName || 'Same exercise (lightened)',
  };
}

async function handleFormCorrection(payload: any, apiKey: string) {
  const uid           = payload && payload.uid;
  const exerciseName  = payload && payload.exercise_name;
  const deviation     = payload && payload.deviation;
  const recentEvents  = Array.isArray(payload && payload.recent_events) ? payload.recent_events.slice(0, 6) : [];
  const clientContext = (payload && typeof payload.client_context === 'object') ? payload.client_context : {};

  if (typeof uid !== 'string' || !uid)                        return jsonResponse({ error: 'missing_uid' }, 400);
  if (typeof exerciseName !== 'string' || !exerciseName)      return jsonResponse({ error: 'missing_exercise_name' }, 400);
  if (typeof deviation !== 'string' || !deviation)            return jsonResponse({ error: 'missing_deviation' }, 400);

  const systemContext = (clientContext && typeof clientContext.systemContext === 'string')
    ? clientContext.systemContext : '';

  const userMessage =
    '## athlete profile\n' +
    '```json\n' + JSON.stringify({ uid }, null, 2) + '\n```\n\n' +
    '## current exercise\n' +
    '"' + exerciseName + '"\n\n' +
    '## deviation (novel · not in deterministic lookup)\n' +
    '"' + deviation + '"\n\n' +
    '## recent_events (last ' + recentEvents.length + ' flagged reps)\n' +
    '```json\n' + JSON.stringify(recentEvents, null, 2) + '\n```\n\n' +
    '## client_context\n' +
    '```json\n' + JSON.stringify(clientContext, null, 2) + '\n```\n\n' +
    (systemContext ? '## OT reasoning frame (injected from BBF_OT_PROMPT.systemContext)\n' + systemContext + '\n\n' : '') +
    'Return ONLY the JSON schema response.';

  const t0     = Date.now();
  const result = await callClaude(userMessage, SYSTEM_PROMPT_FORM_CORRECTION, RESPONSE_SCHEMA_FORM_CORRECTION, apiKey);
  const dur    = Date.now() - t0;

  if (!result.ok) {
    console.warn(`[bbf-agentic-comlink:form_correction] Claude failed (${result.error}) after ${dur}ms — fallback`);
    return jsonResponse(defaultFormCorrectionFallback(exerciseName, deviation, 'claude_failed'), 200);
  }
  const respBody: any = result.body;
  const text = extractTextBlock(respBody?.content);
  if (!text) return jsonResponse(defaultFormCorrectionFallback(exerciseName, deviation, 'no_text_block'), 200);

  let parsed: any;
  try { parsed = JSON.parse(text); }
  catch (e) {
    console.warn(`[bbf-agentic-comlink:form_correction] parse failed (${(e as Error).message}) — fallback`);
    return jsonResponse(defaultFormCorrectionFallback(exerciseName, deviation, 'parse_failed'), 200);
  }
  if (!parsed || typeof parsed.corrective_cue !== 'string' || typeof parsed.swap_to !== 'string') {
    console.warn(`[bbf-agentic-comlink:form_correction] schema mismatch — fallback. got=${JSON.stringify(parsed).slice(0,200)}`);
    return jsonResponse(defaultFormCorrectionFallback(exerciseName, deviation, 'schema_mismatch'), 200);
  }

  console.log(`[bbf-agentic-comlink:form_correction] uid=${uid} · ex=${exerciseName} · dev=${deviation} · model=${respBody.model} · duration=${dur}ms · usage=${JSON.stringify(respBody.usage)}`);
  return jsonResponse({
    corrective_cue: parsed.corrective_cue.slice(0, 240),
    swap_to:        parsed.swap_to.slice(0, 120),
  }, 200);
}

// ─── Omniscience Mocks (CEO spec, verbatim) ────────────────────────────
function adminOverrideMockRewrite() {
  return {
    comlink_verdict: 'MASTER KEY: Protocol compressed for time.',
    updated_workout: [
      { name: 'ADMIN BYPASS: 100x Pushups', target: '100', weight_lbs: 'BW' },
    ],
  };
}
function adminOverrideMockPositional() {
  return {
    drill_index:      0,
    coaching_verdict: 'MASTER KEY: First candidate drill selected.',
    why:              'Admin Override active — bypassing positional intelligence routing.',
  };
}

// ─── Fallback — preserve the original workout when LLM fails ───────────
function defaultPassThrough(currentWorkout: any[], reason: string) {
  const mapped = (Array.isArray(currentWorkout) ? currentWorkout : []).slice(0, 8).map((ex: any) => {
    const sets = ex && (ex.sets != null) ? String(ex.sets) : '1';
    const reps = ex && (ex.reps != null) ? String(ex.reps) : '';
    return {
      name:       String((ex && ex.name) || 'Exercise'),
      target:     reps ? sets + 'x' + reps : sets,
      weight_lbs: '',
    };
  });
  return {
    comlink_verdict: 'Comlink offline (' + reason + '). Holding original protocol — radio in again.',
    updated_workout: mapped.length ? mapped : [{ name: 'Active recovery', target: '20 min walk', weight_lbs: 'BW' }],
  };
}
function defaultPositionalFallback(reason: string) {
  return {
    drill_index:      0,
    coaching_verdict: 'Comlink offline (' + reason + '). Holding the catalog\'s default drill.',
    why:              'Engine could not route your query. Founder-verified default drill is still on target for this position.',
  };
}

// ─── Anthropic call w/ AbortController timeout ─────────────────────────
async function callClaude(userMessage: string, systemPrompt: string, schema: unknown, apiKey: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CLAUDE_TIMEOUT_MS);

  const requestBody = {
    model:      MODEL,
    max_tokens: MAX_TOKENS,
    thinking:   { type: 'adaptive' },
    output_config: {
      effort: EFFORT_DEFAULT,
      format: { type: 'json_schema', schema: schema },
    },
    system: [
      {
        type:          'text',
        text:          systemPrompt,
        cache_control: { type: 'ephemeral' },
      },
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
    try { body = await res.json(); }
    catch (_) { body = null; }

    if (!res.ok) {
      const errMsg = (body && body.error && (body.error.message || body.error.type)) || `anthropic_${res.status}`;
      console.error(`[bbf-agentic-comlink] Anthropic API error: status=${res.status} body=${JSON.stringify(body).slice(0,600)}`);
      return { ok: false as const, status: res.status, error: errMsg, raw: body };
    }
    return { ok: true as const, status: res.status, body };
  } catch (e) {
    const err = e as Error;
    const reason = err.name === 'AbortError' ? `timeout_${CLAUDE_TIMEOUT_MS}ms` : err.message;
    console.error(`[bbf-agentic-comlink] Claude fetch threw: ${reason}`);
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

// ═══════════════════════════════════════════════════════════════════════
// Intent (c) handler — positional drill selector
// ═══════════════════════════════════════════════════════════════════════
async function handlePositionalDrill(payload: any, apiKey: string) {
  const uid       = payload && payload.uid;
  const query     = payload && payload.query;
  const sport     = payload && payload.sport;
  const position  = payload && payload.position;
  const lang      = (payload && payload.lang) || 'en';
  const candidatesRaw = Array.isArray(payload && payload.candidates) ? payload.candidates : [];

  if (typeof uid !== 'string' || !uid)            return jsonResponse({ error: 'missing_uid' }, 400);
  if (typeof query !== 'string' || !query.trim()) return jsonResponse({ error: 'missing_query' }, 400);
  if (typeof sport !== 'string' || !sport)        return jsonResponse({ error: 'missing_sport' }, 400);
  if (typeof position !== 'string' || !position)  return jsonResponse({ error: 'missing_position' }, 400);
  if (!candidatesRaw.length)                       return jsonResponse(defaultPositionalFallback('no_candidates'), 200);

  const candidates = candidatesRaw.slice(0, MAX_CANDIDATES);
  const safeQuery  = query.slice(0, MAX_TRANSCRIPT_LEN);
  const safeLang   = (lang === 'es' || lang === 'pt') ? lang : 'en';

  // Trim candidates to a compact summary for prompt efficiency. Frontend
  // already filtered by sport+position so all candidates are eligible.
  const summary = candidates.map((d: any, i: number) => {
    const name  = (d && d.name && (d.name[safeLang] || d.name.en)) || d.name || 'Drill';
    const focus = (d && d.focus && (d.focus[safeLang] || d.focus.en)) || d.focus || '';
    return {
      index:     i,
      name:      String(name),
      sets:      String((d && d.sets) || ''),
      focus:     String(focus),
      equipment: String((d && d.equipment) || ''),
      kpi:       String((d && d.kpi) || ''),
    };
  });

  const userMessage =
    '## athlete\n' +
    '```json\n' + JSON.stringify({ uid, sport, position, lang: safeLang }, null, 2) + '\n```\n\n' +
    '## query\n' +
    '"' + safeQuery + '"\n\n' +
    '## candidates (founder-verified drills for ' + sport + ' / ' + position + ')\n' +
    '```json\n' + JSON.stringify(summary, null, 2) + '\n```\n\n' +
    'Select the best-fit drill index. Return ONLY the JSON schema response.';

  const t0     = Date.now();
  const result = await callClaude(userMessage, SYSTEM_PROMPT_POSITIONAL, RESPONSE_SCHEMA_POSITIONAL, apiKey);
  const dur    = Date.now() - t0;

  if (!result.ok) {
    console.warn(`[bbf-agentic-comlink:positional] Claude failed (${result.error}) after ${dur}ms — fallback`);
    return jsonResponse(defaultPositionalFallback('claude_failed'), 200);
  }

  const respBody: any = result.body;
  const text = extractTextBlock(respBody?.content);
  if (!text) return jsonResponse(defaultPositionalFallback('no_text_block'), 200);

  let parsed: any;
  try { parsed = JSON.parse(text); }
  catch (e) {
    console.warn(`[bbf-agentic-comlink:positional] parse failed (${(e as Error).message}) — fallback`);
    return jsonResponse(defaultPositionalFallback('parse_failed'), 200);
  }

  const rawIdx = (parsed && typeof parsed.drill_index === 'number') ? Math.floor(parsed.drill_index) : -1;
  if (
    !parsed ||
    rawIdx < 0 ||
    rawIdx >= candidates.length ||
    typeof parsed.coaching_verdict !== 'string' ||
    typeof parsed.why !== 'string'
  ) {
    console.warn(`[bbf-agentic-comlink:positional] schema mismatch — fallback. got=${JSON.stringify(parsed).slice(0,200)}`);
    return jsonResponse(defaultPositionalFallback('schema_mismatch'), 200);
  }

  console.log(`[bbf-agentic-comlink:positional] uid=${uid} · sport=${sport} · pos=${position} · query_len=${safeQuery.length} · idx=${rawIdx} · model=${respBody.model} · duration=${dur}ms · usage=${JSON.stringify(respBody.usage)}`);

  return jsonResponse({
    drill_index:      rawIdx,
    coaching_verdict: parsed.coaching_verdict.slice(0, 200),
    why:              parsed.why.slice(0, 280),
  }, 200);
}

// ─── Handler ───────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')    return jsonResponse({ error: 'method_not_allowed' }, 405);

  const expectedToken = Deno.env.get('BBF_COACH_AGENT_TOKEN');
  if (expectedToken) {
    const sent = req.headers.get('x-bbf-admin-token') || '';
    if (sent !== expectedToken) {
      console.warn('[bbf-agentic-comlink] rejected: bad/missing X-BBF-Admin-Token');
      return jsonResponse({ error: 'unauthorized' }, 401);
    }
  }

  let payload: any;
  try { payload = await req.json(); }
  catch (_) { return jsonResponse({ error: 'invalid_json' }, 400); }

  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

  const intent = (payload && typeof payload.intent === 'string') ? payload.intent : 'constraint';

  // ─── Route to positional drill flow (Warhead 2) ────────────────
  if (intent === 'positional_drill') {
    if (payload.admin_override === true) {
      return jsonResponse(adminOverrideMockPositional(), 200);
    }
    if (!ANTHROPIC_API_KEY) {
      console.error('[bbf-agentic-comlink:positional] missing ANTHROPIC_API_KEY — fallback');
      return jsonResponse(defaultPositionalFallback('config_missing'), 200);
    }
    return await handlePositionalDrill(payload, ANTHROPIC_API_KEY);
  }

  // ─── Route to form_correction flow (Phase 4 cascade fallback) ──
  if (intent === 'form_correction') {
    if (payload.admin_override === true) {
      return jsonResponse(adminOverrideMockFormCorrection(), 200);
    }
    if (!ANTHROPIC_API_KEY) {
      console.error('[bbf-agentic-comlink:form_correction] missing ANTHROPIC_API_KEY — fallback');
      return jsonResponse(defaultFormCorrectionFallback(payload?.exercise_name || '', payload?.deviation || '', 'config_missing'), 200);
    }
    return await handleFormCorrection(payload, ANTHROPIC_API_KEY);
  }

  // ─── Default flow — constraint OR friction (Warhead 3) ─────────
  const { uid, transcript, current_workout, client_context, admin_override } = payload || {};

  if (admin_override === true) {
    return jsonResponse(adminOverrideMockRewrite(), 200);
  }
  if (typeof uid !== 'string' || !uid) return jsonResponse({ error: 'missing_uid' }, 400);
  if (typeof transcript !== 'string' || !transcript.trim()) return jsonResponse({ error: 'missing_transcript' }, 400);

  const safeTranscript = transcript.slice(0, MAX_TRANSCRIPT_LEN);
  const workout = Array.isArray(current_workout) ? current_workout : [];
  const ctx     = (client_context && typeof client_context === 'object') ? client_context : {};

  if (!ANTHROPIC_API_KEY) {
    console.error('[bbf-agentic-comlink] missing ANTHROPIC_API_KEY — passing through');
    return jsonResponse(defaultPassThrough(workout, 'config_missing'), 200);
  }

  const userMessage =
    '## athlete profile\n' +
    '```json\n' + JSON.stringify({ uid: uid, goal: ctx.goal || null, partner: ctx.partner || null }, null, 2) + '\n```\n\n' +
    '## current_workout (' + workout.length + ' planned exercises)\n' +
    '```json\n' + JSON.stringify(workout, null, 2) + '\n```\n\n' +
    '## transcript (athlete radio transmission)\n' +
    '"' + safeTranscript + '"\n\n' +
    'Classify constraint vs friction silently, then rewrite the workout per your system instructions. Return ONLY the JSON schema response.';

  const t0     = Date.now();
  const result = await callClaude(userMessage, SYSTEM_PROMPT_REWRITE, RESPONSE_SCHEMA_REWRITE, ANTHROPIC_API_KEY);
  const dur    = Date.now() - t0;

  if (!result.ok) {
    console.warn(`[bbf-agentic-comlink] Claude failed (${result.error}) after ${dur}ms — passing through`);
    return jsonResponse(defaultPassThrough(workout, 'claude_failed'), 200);
  }

  const respBody: any = result.body;
  const text = extractTextBlock(respBody?.content);
  if (!text) {
    console.warn('[bbf-agentic-comlink] no text block in response — passing through');
    return jsonResponse(defaultPassThrough(workout, 'no_text_block'), 200);
  }

  let parsed: any;
  try { parsed = JSON.parse(text); }
  catch (e) {
    console.warn(`[bbf-agentic-comlink] parse failed (${(e as Error).message}) — passing through`);
    return jsonResponse(defaultPassThrough(workout, 'parse_failed'), 200);
  }

  if (
    !parsed ||
    typeof parsed.comlink_verdict !== 'string' ||
    !Array.isArray(parsed.updated_workout) ||
    parsed.updated_workout.length === 0
  ) {
    console.warn(`[bbf-agentic-comlink] schema shape mismatch — passing through. got=${JSON.stringify(parsed).slice(0,200)}`);
    return jsonResponse(defaultPassThrough(workout, 'schema_mismatch'), 200);
  }

  const cleanWorkout = parsed.updated_workout.slice(0, 8).map((ex: any) => ({
    name:       String((ex && ex.name) || 'Exercise'),
    target:     String((ex && ex.target) || ''),
    weight_lbs: String((ex && ex.weight_lbs) || ''),
  }));

  console.log(`[bbf-agentic-comlink] uid=${uid} · transcript_len=${safeTranscript.length} · workout_in=${workout.length} · workout_out=${cleanWorkout.length} · model=${respBody.model} · duration=${dur}ms · usage=${JSON.stringify(respBody.usage)}`);

  return jsonResponse({
    comlink_verdict: parsed.comlink_verdict.slice(0, 240),
    updated_workout: cleanWorkout,
  }, 200);
});
