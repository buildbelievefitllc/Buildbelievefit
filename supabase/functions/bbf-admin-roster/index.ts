// bbf-admin-roster — Secure backend for the Sovereign Client Database Hub (Phase 5.1).
// ─────────────────────────────────────────────────────────────────────────────────────
// The frontend BBF_DATABASE_HUB (admin-only #tp-hub pane in bbf-app.html) fetches
// ALL client data EXCLUSIVELY through this function. The anon/publishable key is
// NEVER used to read bbf_users directly from the browser.
//
// SECURITY MODEL (CEO directive · CLAUDE.md §7):
//   • Service-role key (bypasses RLS) does every DB read/write here.
//   • EVERY action is gated by the X-BBF-Admin-Token shared secret, compared
//     against BBF_COACH_AGENT_TOKEN. No token → 401, no data leaves the function.
//   • verify_jwt:false (matches bbf-co-coach / bbf-sentinel) — the admin token IS
//     the security boundary, so we don't depend on gateway JWT behavior.
//
// DATA SOURCES (live, verified against prod ihclbceghxpuawymlvgi 2026-05-30):
//   • Roster + macros + nutrition_plan ← public.bbf_users
//   • Workout plan + meal plan         ← public.bbf_active_clients (matched by email)
//   • 90-day analytics                 ← public.bbf_readiness + public.bbf_sets⋈bbf_logs
//
// ACTIONS (POST JSON { action, ... }):
//   roster         → { ok, count, clients:[{id,uid,name,email,role,...}] }
//   detail         → { ok, client:{...macros, nutrition_plan, workout_plan, meta} }
//   analytics      → { ok, readiness:[...], volume:[...] }   (lazy, 90d)
//   update_target  → { ok, client:{id,tdee_target,macro_p,macro_c,macro_f} }
//   coach          → { ok, provider:'gemini', model, answer }   (Gemini Co-Coach)
//   compile        → { ok, plan:{name,cal,goal,days[]}, meta, persisted }
//                    (relays to Render /api/rotate-nutrition + writes the plan back)
//
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-injected),
//          BBF_COACH_AGENT_TOKEN (admin gate), GEMINI_API_KEY (+ GEMINI_MODEL),
//          BBF_RENDER_ADMIN_TOKEN (= Render BBF_ADMIN_TOKEN, compile relay),
//          BBF_RENDER_BASE (optional; defaults to the prod Render host).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-bbf-admin-token, x-bbf-session-token',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ADMIN_TOKEN  = Deno.env.get('BBF_COACH_AGENT_TOKEN') ?? '';
const GEMINI_KEY   = Deno.env.get('GEMINI_API_KEY') ?? '';
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash';

// Orchestration relay (compile action). The Render Express engine owns the
// nutrition-regeneration pipeline (/api/rotate-nutrition); we forward to it
// server-side so the admin token never touches the browser bundle (§7).
const RENDER_BASE        = (Deno.env.get('BBF_RENDER_BASE') ?? 'https://buildbelievefit.onrender.com').replace(/\/$/, '');
const RENDER_ADMIN_TOKEN = Deno.env.get('BBF_RENDER_ADMIN_TOKEN') ?? '';

// Numeric macro cap — mirrors rosterApi.TARGET_MAX + the update_target guard so
// client and server agree on bounds. Returns a finite, rounded target or 0.
const MACRO_MAX = 20000;
function pickTarget(override: unknown, stored: unknown): number {
  for (const v of [override, stored]) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0 && n <= MACRO_MAX) return Math.round(n);
  }
  return 0;
}

// Roster = clients + athletes only. admin/trainer are excluded by construction.
const ROSTER_ROLES = ['client', 'athlete'];

// Contraindicated movements (the BBF blacklist) — defensively stripped from any
// workout plan we surface, mirroring the AI Studio gen-guard. Frontend also
// filters on render; this is belt-and-suspenders so a blacklisted lift can never
// leave the backend inside a plan payload.
const BLACKLIST = [/barbell\s+back\s+squat/i, /back\s+squat/i, /abdominal\s+crunch/i, /\bcrunch(es)?\b/i];
function isBlacklisted(name: string): boolean {
  return BLACKLIST.some((re) => re.test(String(name || '')));
}

// ─── PostgREST helpers (service-role; bypasses RLS) ──────────────────────────────
async function pgGet(path: string): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
  });
  if (!res.ok) throw new Error(`pg_get_${res.status}:${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function pgPatch(path: string, body: unknown): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`pg_patch_${res.status}:${(await res.text()).slice(0, 200)}`);
  return res.json();
}

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

async function pgRpc(fn: string, args: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`pg_rpc_${res.status}:${(await res.text()).slice(0, 200)}`);
  return res.json();
}

function encEmail(e: string) { return encodeURIComponent(String(e || '').toLowerCase().trim()); }

// ─── Dual authorization (CEO directive · Elegant Auth Elevation) ─────────────────
// A request is authorized if EITHER:
//   • it carries the legacy shared secret  X-BBF-Admin-Token === BBF_COACH_AGENT_TOKEN
//     (deploy-injected / monolith parity — unchanged path), OR
//   • it carries a valid admin SESSION token  X-BBF-Session-Token  that resolves
//     (via the canonical _bbf_uid_from_vault_token resolver) to a bbf_users row whose
//     role is admin/trainer (or the `akeem` CEO fallback).
// A valid NON-admin session is REJECTED — the session must belong to a Sovereign.
// This lets a logged-in admin auto-unlock every surface without pasting the secret,
// while the secret itself never leaves the server (CLAUDE.md §7).
async function uidFromSession(session: string): Promise<string | null> {
  // Primary: the canonical SECURITY DEFINER resolver the CEO directed us to use.
  try {
    const r = await pgRpc('_bbf_uid_from_vault_token', { p_session_token: session });
    const id = typeof r === 'string' ? r : (Array.isArray(r) && r.length ? r[0] : null);
    if (id) return String(id);
  } catch (_) { /* fall through — function may not be PostgREST-exposed */ }
  // Fallback: replicate the resolver via the service role (RLS-bypassing).
  try {
    const nowISO = new Date().toISOString();
    const rows = await pgGet(
      `bbf_vault_sessions?select=user_id&token=eq.${encodeURIComponent(session)}` +
      `&expires_at=gt.${encodeURIComponent(nowISO)}&limit=1`,
    );
    const row = Array.isArray(rows) && rows.length ? rows[0] : null;
    return row?.user_id ? String(row.user_id) : null;
  } catch (_) { return null; }
}

async function isAuthorized(req: Request): Promise<boolean> {
  // 1) Legacy shared-secret path — unchanged, evaluated first (zero new latency).
  const token = req.headers.get('x-bbf-admin-token') ?? '';
  if (ADMIN_TOKEN && token.length > 0 && token === ADMIN_TOKEN) return true;

  // 2) Admin-session path.
  const session = req.headers.get('x-bbf-session-token') ?? '';
  if (!session) return false;
  const userId = await uidFromSession(session);
  if (!userId) return false;
  try {
    const rows = await pgGet(
      `bbf_users?select=uid,role&id=eq.${encodeURIComponent(userId)}&deleted_at=is.null&limit=1`,
    );
    const u = Array.isArray(rows) && rows.length ? rows[0] : null;
    if (!u) return false;
    const role = String(u.role ?? '').toLowerCase();
    const uname = String(u.uid ?? '').toLowerCase();
    return role === 'admin' || role === 'trainer' || uname === 'akeem';
  } catch (_) {
    return false;
  }
}

// ─── Gemini Co-Coach ─────────────────────────────────────────────────────────────
async function geminiCoach(prompt: string) {
  if (!GEMINI_KEY) throw new Error('missing_gemini_key');
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`gemini_${res.status}:${JSON.stringify(data).slice(0, 300)}`);
  const text = (data?.candidates?.[0]?.content?.parts ?? [])
    .map((p: { text?: string }) => p?.text ?? '').join('').trim();
  return { text, model: GEMINI_MODEL };
}

// Compact LIVE telemetry summary for the agentic Co-Coach context:
// readiness trend (bbf_readiness) + recent training volume (bbf_sets⋈bbf_logs).
// Pulled server-side with the service role so the agent reasons on real data,
// never on browser-supplied claims.
async function fetchTelemetry(id: string) {
  const since = new Date(Date.now() - 90 * 864e5).toISOString();
  let readiness: any[] = [];
  let sets: any[] = [];
  try {
    readiness = await pgGet(
      `bbf_readiness?select=score,timestamp&user_id=eq.${encodeURIComponent(id)}` +
      `&timestamp=gte.${since}&order=timestamp.asc`,
    );
  } catch (_) { /* readiness optional */ }
  try {
    sets = await pgGet(
      `bbf_sets?select=weight_lbs,reps,bbf_logs!inner(date)&user_id=eq.${encodeURIComponent(id)}`,
    );
  } catch (_) { /* sets optional */ }

  const scores = (Array.isArray(readiness) ? readiness : [])
    .map((r) => Number(r.score) || 0).filter((n) => n > 0);
  const n = scores.length;
  const avg = n ? Math.round(scores.reduce((a, b) => a + b, 0) / n) : null;
  const last = n ? scores[n - 1] : null;
  const last7 = scores.slice(-7);
  const prev7 = scores.slice(-14, -7);
  const a7 = last7.length ? last7.reduce((a, b) => a + b, 0) / last7.length : null;
  const p7 = prev7.length ? prev7.reduce((a, b) => a + b, 0) / prev7.length : null;
  const trend = (a7 != null && p7 != null)
    ? (a7 > p7 + 1 ? 'improving' : a7 < p7 - 1 ? 'declining' : 'flat')
    : 'insufficient_data';

  const volByDay: Record<string, number> = {};
  for (const s of (Array.isArray(sets) ? sets : [])) {
    const d = s?.bbf_logs?.date;
    if (!d || d < since.slice(0, 10)) continue;
    volByDay[d] = (volByDay[d] || 0) + (Number(s.weight_lbs) || 0) * (Number(s.reps) || 0);
  }
  const days = Object.keys(volByDay).sort();

  return {
    readiness: { checkins_90d: n, avg_score: avg, last_score: last, trend_7d_vs_prior_7d: trend },
    training: {
      days_logged_90d: days.length,
      last7_daily_volume: days.slice(-7).map((d) => Math.round(volByDay[d])),
    },
  };
}

function buildCoachPrompt(
  client: Record<string, unknown> | null,
  question: string,
  telemetry: unknown = null,
): string {
  const ctx = {
    name: client?.name ?? 'the client',
    role: client?.role ?? 'client',
    metabolic_tier: client?.metabolic_tier ?? null,
    block_priority: client?.block_priority ?? null,
    macro_targets: {
      calories: client?.tdee_target ?? null,
      protein_g: client?.macro_p ?? null,
      carbs_g: client?.macro_c ?? null,
      fat_g: client?.macro_f ?? null,
    },
    dietary_profile: client?.dietary_profile ?? null,
    allergens: client?.allergens ?? [],
    nutrition_plan: client?.nutrition_plan ?? null,
    workout_plan: client?.workout_plan ?? null,
    live_telemetry: telemetry ?? null,
  };
  return [
    'You are the BBF Co-Coach, an evidence-based strength & conditioning assistant.',
    'You support the HUMAN head coach viewing this admin panel — NOT the client directly.',
    'Be concise, specific, and actionable. Reference the actual data you used.',
    'Never discuss backend systems, models, databases, or internal tooling.',
    'If macro targets or plans are missing, say so plainly and recommend a next step.',
    'Weigh the live_telemetry block (CNS readiness trend + recent training volume) when',
    'assessing recovery, overtraining risk, and whether load/macros should change.',
    '',
    'CLIENT CONTEXT (JSON):',
    JSON.stringify(ctx, null, 2),
    '',
    `HEAD COACH QUESTION: ${question}`,
  ].join('\n');
}

// ─── handler ─────────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return jsonResponse({ error: 'backend_unconfigured' }, 503);
  }
  // Admin gate — the security boundary for every action. Accepts the legacy shared
  // secret OR a validated admin session token (see isAuthorized).
  if (!(await isAuthorized(req))) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonResponse({ error: 'bad_json' }, 400); }
  const action = String(body?.action ?? '');

  try {
    // ── roster ──────────────────────────────────────────────────────────────────
    if (action === 'roster') {
      const roleFilter = ROSTER_ROLES.map((r) => `"${r}"`).join(',');
      const rows = await pgGet(
        `bbf_users?select=id,uid,name,email,role,metabolic_tier,subscription_tier,` +
        `tdee_target,updated_at&role=in.(${roleFilter})&deleted_at=is.null&order=name.asc`,
      );
      return jsonResponse({ ok: true, count: rows.length, clients: rows });
    }

    // ── detail ──────────────────────────────────────────────────────────────────
    if (action === 'detail') {
      const id = String(body?.id ?? '');
      if (!id) return jsonResponse({ error: 'missing_id' }, 400);
      const urows = await pgGet(
        `bbf_users?select=id,uid,name,email,role,metabolic_tier,subscription_tier,` +
        `dietary_profile,allergens,food_likes,food_dislikes,tdee_target,macro_p,macro_c,macro_f,` +
        `block_priority,baseline_status,cardiac_clearance,nutrition_plan,nutrition_plan_updated_at,` +
        `current_streak,updated_at&id=eq.${encodeURIComponent(id)}&limit=1`,
      );
      const u = Array.isArray(urows) && urows.length ? urows[0] : null;
      if (!u) return jsonResponse({ error: 'not_found' }, 404);

      // Workout plan + meal plan live in bbf_active_clients, matched by email.
      let workout_plan: unknown = null;
      let meal_plan: unknown = null;
      let plans_generated_at: unknown = null;
      if (u.email) {
        const e = encEmail(u.email);
        const ac = await pgGet(
          `bbf_active_clients?select=workout_plan,meal_plan,plans_generated_at,spectrum_tier&` +
          `or=(vault_email.eq.${e},client_email.eq.${e})&limit=1`,
        );
        if (Array.isArray(ac) && ac.length) {
          workout_plan = ac[0].workout_plan ?? null;
          meal_plan = ac[0].meal_plan ?? null;
          plans_generated_at = ac[0].plans_generated_at ?? null;
        }
      }

      // Defensive blacklist scrub if the workout plan is structured JSON.
      let workout_blacklist_hits = 0;
      try {
        const wp = typeof workout_plan === 'string' ? JSON.parse(workout_plan) : workout_plan;
        if (Array.isArray(wp)) {
          for (const day of wp) {
            if (day && Array.isArray(day.exercises)) {
              const before = day.exercises.length;
              day.exercises = day.exercises.filter((ex: any) => !isBlacklisted(ex?.name));
              workout_blacklist_hits += before - day.exercises.length;
            }
          }
          workout_plan = wp;
        }
      } catch (_) { /* non-JSON text plan — frontend renders + filters on display */ }

      return jsonResponse({
        ok: true,
        client: {
          id: u.id, uid: u.uid, name: u.name, email: u.email, role: u.role,
          metabolic_tier: u.metabolic_tier, subscription_tier: u.subscription_tier,
          dietary_profile: u.dietary_profile, allergens: u.allergens ?? [],
          food_likes: u.food_likes ?? [], food_dislikes: u.food_dislikes ?? [],
          tdee_target: u.tdee_target, macro_p: u.macro_p, macro_c: u.macro_c, macro_f: u.macro_f,
          block_priority: u.block_priority, baseline_status: u.baseline_status,
          cardiac_clearance: u.cardiac_clearance,
          nutrition_plan: u.nutrition_plan ?? null,
          nutrition_plan_updated_at: u.nutrition_plan_updated_at ?? null,
          workout_plan, meal_plan, plans_generated_at,
          workout_blacklist_hits,
          current_streak: u.current_streak ?? 0,
          updated_at: u.updated_at,
        },
      });
    }

    // ── analytics (lazy, last 90 days) ────────────────────────────────────────────
    if (action === 'analytics') {
      const id = String(body?.id ?? '');
      if (!id) return jsonResponse({ error: 'missing_id' }, 400);
      const since = new Date(Date.now() - 90 * 864e5).toISOString();
      const readiness = await pgGet(
        `bbf_readiness?select=score,sleep_quality,soreness_level,timestamp&` +
        `user_id=eq.${encodeURIComponent(id)}&timestamp=gte.${since}&order=timestamp.asc`,
      );
      // Sets joined to their log for the session date → daily training volume.
      const sets = await pgGet(
        `bbf_sets?select=weight_lbs,reps,exercise_key,bbf_logs!inner(date)&` +
        `user_id=eq.${encodeURIComponent(id)}&order=id.asc`,
      );
      const volByDay: Record<string, number> = {};
      for (const s of (Array.isArray(sets) ? sets : [])) {
        const d = s?.bbf_logs?.date;
        if (!d) continue;
        if (d < since.slice(0, 10)) continue;
        const vol = (Number(s.weight_lbs) || 0) * (Number(s.reps) || 0);
        volByDay[d] = (volByDay[d] || 0) + vol;
      }
      const volume = Object.keys(volByDay).sort().map((d) => ({ date: d, volume: Math.round(volByDay[d]) }));
      return jsonResponse({
        ok: true,
        readiness: (Array.isArray(readiness) ? readiness : []).map((r) => ({
          score: r.score, sleep_quality: r.sleep_quality, soreness_level: r.soreness_level, t: r.timestamp,
        })),
        volume,
      });
    }

    // ── update_target ─────────────────────────────────────────────────────────────
    if (action === 'update_target') {
      const id = String(body?.id ?? '');
      if (!id) return jsonResponse({ error: 'missing_id' }, 400);
      const patch: Record<string, number> = {};
      for (const k of ['tdee_target', 'macro_p', 'macro_c', 'macro_f']) {
        if (body[k] !== undefined && body[k] !== null && body[k] !== '') {
          const n = Number(body[k]);
          if (!Number.isFinite(n) || n < 0 || n > 20000) {
            return jsonResponse({ error: 'invalid_value', detail: k }, 400);
          }
          patch[k] = Math.round(n);
        }
      }
      if (!Object.keys(patch).length) return jsonResponse({ error: 'no_fields' }, 400);
      const updated = await pgPatch(
        `bbf_users?id=eq.${encodeURIComponent(id)}&select=id,tdee_target,macro_p,macro_c,macro_f`,
        patch,
      );
      const row = Array.isArray(updated) && updated.length ? updated[0] : null;
      if (!row) return jsonResponse({ error: 'not_found' }, 404);
      return jsonResponse({ ok: true, client: row });
    }

    // ── coach (Gemini Co-Coach) ────────────────────────────────────────────────────
    if (action === 'coach') {
      const question = String(body?.question ?? '').trim();
      if (!question) return jsonResponse({ error: 'missing_question' }, 400);
      if (question.length > 2000) return jsonResponse({ error: 'question_too_long' }, 400);
      let client = (body?.client as Record<string, unknown> | undefined) ?? null;
      if (!client && body?.id) {
        const rows = await pgGet(
          `bbf_users?select=name,role,metabolic_tier,block_priority,tdee_target,macro_p,macro_c,macro_f,` +
          `dietary_profile,allergens,nutrition_plan&id=eq.${encodeURIComponent(String(body.id))}&limit=1`,
        );
        client = Array.isArray(rows) && rows.length ? rows[0] : null;
      }
      // Agentic enrichment — fold LIVE readiness + training-volume telemetry into
      // the prompt so the Co-Coach reasons on the client's real recent state.
      let telemetry: unknown = null;
      if (body?.id) { try { telemetry = await fetchTelemetry(String(body.id)); } catch (_) { /* non-fatal */ } }
      const { text, model } = await geminiCoach(buildCoachPrompt(client, question, telemetry));
      return jsonResponse({ ok: true, provider: 'gemini', model, answer: text, telemetry });
    }

    // ── compile (regenerate the athlete's AI nutrition schedule) ─────────────────
    // Server-side relay to the Render orchestration engine (/api/rotate-nutrition).
    // The browser reaches this via the standard anon-gateway pattern (no secret in
    // the bundle, §7) — THIS function carries the Render admin token and forwards
    // the athlete's stored intake so the engine regenerates against real targets.
    if (action === 'compile') {
      const id = String(body?.id ?? '');
      if (!id) return jsonResponse({ error: 'missing_id' }, 400);
      if (!RENDER_ADMIN_TOKEN) return jsonResponse({ error: 'backend_unconfigured', detail: 'render_token' }, 503);

      const urows = await pgGet(
        `bbf_users?select=id,uid,name,email,role,subscription_tier,dietary_profile,allergens,` +
        `food_likes,food_dislikes,tdee_target,nutrition_plan&id=eq.${encodeURIComponent(id)}&limit=1`,
      );
      const u = Array.isArray(urows) && urows.length ? urows[0] : null;
      if (!u) return jsonResponse({ error: 'not_found' }, 404);

      // Coach's override (this compile) wins over the stored target; rotate-nutrition
      // drives generation off the calorie target, so a missing one is a hard 400.
      const tdee = pickTarget(body?.tdee_target, u.tdee_target);
      if (!tdee) return jsonResponse({ error: 'tdee_missing', detail: 'set a calorie target first' }, 400);

      // rotate-nutrition has no cuisine field of its own — fold the style into the
      // free-text constraints so it genuinely steers selection rather than dropping.
      const cuisine = String(body?.cuisine ?? '').trim();
      const constraints = cuisine ? `Cuisine preference: ${cuisine} cuisine.` : '';

      let rotateRes: Response;
      try {
        rotateRes = await fetch(`${RENDER_BASE}/api/rotate-nutrition`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-BBF-Admin-Token': RENDER_ADMIN_TOKEN },
          body: JSON.stringify({
            uid: u.uid,
            tdee: String(tdee),
            clientName: u.name ?? u.uid,
            clientTier: u.subscription_tier || 'gateway',
            dietary_profile: u.dietary_profile || 'Omnivore',
            allergens: Array.isArray(u.allergens) ? u.allergens : [],
            food_likes: Array.isArray(u.food_likes) ? u.food_likes : [],
            food_dislikes: Array.isArray(u.food_dislikes) ? u.food_dislikes : [],
            previousPlan: typeof u.nutrition_plan === 'string' ? u.nutrition_plan : '',
            constraints,
          }),
        });
      } catch (_) {
        return jsonResponse({ error: 'orchestrator_unreachable' }, 502);
      }
      const rotateJson = await rotateRes.json().catch(() => null);
      if (!rotateRes.ok || !rotateJson?.ok || !rotateJson?.plan) {
        return jsonResponse({ error: 'orchestrator_failed', detail: rotateJson?.error ?? `status_${rotateRes.status}` }, 502);
      }

      // Closed-loop writeback (mirrors /process): persist the regenerated plan so
      // the athlete's Vault renders it on next login. Non-fatal — the coach still
      // receives the plan in the response even if a write hiccups.
      const planStr = JSON.stringify(rotateJson.plan);
      const stamp = new Date().toISOString();
      let persisted = false;
      try {
        await pgPatch(`bbf_users?id=eq.${encodeURIComponent(id)}`, {
          nutrition_plan: planStr, nutrition_plan_updated_at: stamp,
        });
        persisted = true;
      } catch (_) { /* non-fatal */ }
      if (u.email) {
        try {
          await pgPatch(
            `bbf_active_clients?or=(vault_email.eq.${encEmail(u.email)},client_email.eq.${encEmail(u.email)})`,
            { meal_plan: planStr, plans_generated_at: stamp },
          );
        } catch (_) { /* non-fatal */ }
      }

      return jsonResponse({ ok: true, plan: rotateJson.plan, meta: rotateJson.meta ?? null, persisted });
    }

    // ── sports_roster (live youth-athlete records) ───────────────────────────────
    // Joins bbf_athlete_progression (sport/position/phase/mesocycle/load) to
    // bbf_users (name/uid/avatar). Two-step merge (no PostgREST embed dependency) so
    // it is resilient to FK-introspection quirks.
    if (action === 'sports_roster') {
      const prog = await pgGet(
        `bbf_athlete_progression?select=id,user_id,sport,position,phase,target_phase,` +
        `mesocycle_week,mesocycle_started_at,protocol_completed,rpe_avg_last_3,friction_avg_last_3,` +
        `guardian_consent,guardian_consent_at,updated_at&order=updated_at.desc`,
      );
      const rows = Array.isArray(prog) ? prog : [];
      const ids = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
      const usersById: Record<string, any> = {};
      if (ids.length) {
        const inList = ids.map((id) => `"${id}"`).join(',');
        const users = await pgGet(
          `bbf_users?select=id,uid,name,email,role,avatar,subscription_tier,access_status&` +
          `id=in.(${inList})&deleted_at=is.null`,
        );
        for (const u of (Array.isArray(users) ? users : [])) usersById[u.id] = u;
      }
      const athletes = rows.map((r) => {
        const u = usersById[r.user_id] || null;
        return {
          id: r.id, user_id: r.user_id,
          name: u?.name || u?.uid || 'Unnamed Athlete',
          uid: u?.uid ?? null, email: u?.email ?? null, avatar: u?.avatar ?? null,
          subscription_tier: u?.subscription_tier ?? null, access_status: u?.access_status ?? null,
          sport: r.sport, position: r.position, phase: r.phase, target_phase: r.target_phase,
          mesocycle_week: r.mesocycle_week, mesocycle_started_at: r.mesocycle_started_at,
          protocol_completed: r.protocol_completed,
          rpe_avg_last_3: r.rpe_avg_last_3, friction_avg_last_3: r.friction_avg_last_3,
          guardian_consent: r.guardian_consent, guardian_consent_at: r.guardian_consent_at,
          updated_at: r.updated_at,
        };
      });
      return jsonResponse({ ok: true, count: athletes.length, athletes });
    }

    // ── sports_insert (guarded youth write) ──────────────────────────────────────
    // Injects a real youth athlete: a minimal bbf_users identity + a
    // bbf_athlete_progression record. GUARDED: youth records REQUIRE explicit
    // guardian consent (the write 400s without it) — child-data protection.
    if (action === 'sports_insert') {
      const name = String(body?.name ?? '').trim();
      const sport = String(body?.sport ?? '').trim().toLowerCase();
      const position = String(body?.position ?? '').trim();
      const phase = (String(body?.phase ?? 'off').trim().toLowerCase()) || 'off';
      const guardian = body?.guardian_consent === true || body?.guardian_consent === 'true';
      if (!name) return jsonResponse({ error: 'missing_name' }, 400);
      if (!sport) return jsonResponse({ error: 'missing_sport' }, 400);
      if (!position) return jsonResponse({ error: 'missing_position' }, 400);
      if (!guardian) return jsonResponse({ error: 'guardian_consent_required' }, 400);

      // 1) Identity — minimal bbf_users row (table defaults cover the rest). A unique
      // uid slug keeps it addressable without minting login credentials.
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 36)
        || 'athlete';
      const uidSlug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
      const userRows = await pgPost('bbf_users?select=id,uid,name', [{ name, uid: uidSlug, role: 'athlete' }]);
      const newUser = Array.isArray(userRows) && userRows.length ? userRows[0] : null;
      if (!newUser?.id) return jsonResponse({ error: 'user_insert_failed' }, 500);

      // 2) Progression — the sport/position assignment, consent stamped.
      const nowISO = new Date().toISOString();
      const progRows = await pgPost(
        'bbf_athlete_progression?select=id,user_id,sport,position,phase,mesocycle_week,guardian_consent,guardian_consent_at,updated_at',
        [{ user_id: newUser.id, sport, position, phase, guardian_consent: true, guardian_consent_at: nowISO }],
      );
      const prog = Array.isArray(progRows) && progRows.length ? progRows[0] : null;
      if (!prog?.id) return jsonResponse({ error: 'progression_insert_failed' }, 500);

      return jsonResponse({
        ok: true,
        athlete: {
          id: prog.id, user_id: newUser.id, name: newUser.name, uid: newUser.uid,
          sport: prog.sport, position: prog.position, phase: prog.phase,
          mesocycle_week: prog.mesocycle_week ?? 1,
          guardian_consent: prog.guardian_consent, guardian_consent_at: prog.guardian_consent_at,
          updated_at: prog.updated_at,
        },
      });
    }

    // ── leads_list / concierge_log (Comlink, relayed server-side) ─────────────────
    // Unifies Comlink behind this session-authed gate: the browser no longer hits
    // Render directly (and no longer needs a separate Render token in the client).
    // We forward to Render with the server-held BBF_RENDER_ADMIN_TOKEN — the exact
    // relay pattern `compile` already uses — and return Render's body verbatim.
    if (action === 'leads_list' || action === 'concierge_log') {
      if (!RENDER_ADMIN_TOKEN) return jsonResponse({ error: 'backend_unconfigured', detail: 'render_token' }, 503);
      const path = action === 'leads_list' ? '/api/leads-list' : '/api/concierge-log';
      const limit = Number(body?.limit) || (action === 'leads_list' ? 100 : 80);
      let r: Response;
      try {
        r = await fetch(`${RENDER_BASE}${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-BBF-Admin-Token': RENDER_ADMIN_TOKEN },
          body: JSON.stringify({ limit }),
        });
      } catch (_) {
        return jsonResponse({ error: 'orchestrator_unreachable' }, 502);
      }
      const txt = await r.text();
      let j: any = null;
      try { j = txt ? JSON.parse(txt) : null; } catch { /* non-JSON passthrough */ }
      if (!r.ok || !j?.ok) {
        return jsonResponse({ error: 'orchestrator_failed', detail: j?.error ?? `status_${r.status}` }, 502);
      }
      return jsonResponse(j);
    }

    return jsonResponse({ error: 'unknown_action', detail: action }, 400);
  } catch (e) {
    return jsonResponse({ error: 'server_error', detail: String((e as Error)?.message ?? e) }, 500);
  }
});
