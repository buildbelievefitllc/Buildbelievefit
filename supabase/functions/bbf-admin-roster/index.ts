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
//   roster         → { ok, count, clients:[{id,uid,name,email,role,subscription_tier,
//                      access_status,account_status,trial_expires_at,...}] }
//   detail         → { ok, client:{...macros, nutrition_plan, workout_plan, meta} }
//   analytics      → { ok, readiness:[...], volume:[...] }   (lazy, 90d)
//   update_target  → { ok, client:{id,tdee_target,macro_p,macro_c,macro_f} }
//   coach          → { ok, provider:'gemini', model, answer }   (Gemini Co-Coach)
//   compile        → { ok, plan:{name,cal,goal,days[]}, meta, persisted }
//                    (relays to Render /api/rotate-nutrition + writes the plan back)
//
//   ── Executive Access Control (Command Center · Access Control tab) ──
//   tiers          → { ok, tiers:[{slug,display_name,category,price_cents,billing_type}] }
//                    (the pricing matrix from bbf_tiers — powers the tier dropdown)
//   set_tier       → { ok, uid, subscription_tier }   (manual comp/up/downgrade;
//                    drives public.bbf_admin_set_tier — allowlist + akeem guard)
//   set_status     → { ok, uid, access_status, sessions_revoked }   (THE KILL SWITCH:
//                    drives public.bbf_admin_set_access_status → flips access_status
//                    and, on lock, revokes every live vault_token for the user)
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

// Invoke a SECURITY DEFINER RPC as the service role (PostgREST /rpc). Used by the
// access-control actions so the tier/lock logic + guards live in ONE place (the DB
// functions), never duplicated in this caller. Throws `rpc_<status>:<detail>` on a
// non-2xx so the handler can map the DB's RAISE'd slug (invalid_tier,
// akeem_cannot_be_locked, user_not_found, …) to a clean response.
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
  const text = await res.text();
  if (!res.ok) throw new Error(`rpc_${res.status}:${text.slice(0, 300)}`);
  try { return text ? JSON.parse(text) : null; } catch { return text; }
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

// ── Account status derivation (Access Control roster) ────────────────────────────
// One honest, server-owned status per athlete, from real columns only:
//   locked     — access_status='locked' (manual kill switch OR Sentinel auto-lock)
//   delinquent — not locked, non-sovereign, and the access window (trial_expires_at)
//                has lapsed → mirrors the Iron Vault bouncer (_ironVaultHasAccess):
//                sovereign OR a live trial = entitled; anything else that HAD a
//                window which expired is in arrears.
//   active     — everything else (sovereign, or a still-live access window).
// NOTE: when the Stripe webhook persists a first-class billing status (past_due /
// canceled) onto bbf_users, fold it in here as the primary 'delinquent' signal.
function deriveAccountStatus(u: Record<string, unknown>): 'locked' | 'delinquent' | 'active' {
  if (String(u?.access_status ?? '') === 'locked') return 'locked';
  const tier = String(u?.subscription_tier ?? '');
  const expRaw = u?.trial_expires_at as string | null | undefined;
  const exp = expRaw ? Date.parse(expRaw) : NaN;
  if (tier !== 'sovereign' && Number.isFinite(exp) && exp < Date.now()) return 'delinquent';
  return 'active';
}

// Tier slugs the kill-switch/override surface may assign. Mirrors bbf_admin_set_tier's
// allowlist (DB is the source of truth + the guard); kept here only to fail fast on
// an obviously bad slug before the round trip.
const SETTABLE_TIERS = new Set([
  'catalyst', 'momentum', 'autonomous',
  'fuel_foundation', 'fuel_performance', 'fuel_sovereign',
  'rising_athlete',
  'kickstart_6wk_3x', 'kickstart_6wk_4x',
  'transformation_8wk_3x', 'transformation_8wk_4x',
  'sovereign_12wk_3x', 'sovereign_12wk_4x',
  'lite', 'gateway', 'architect', 'sovereign',
  'youth_athlete', 'nutrition_essentials', 'nutrition_platinum',
]);

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
        `access_status,trial_expires_at,tdee_target,updated_at&role=in.(${roleFilter})` +
        `&deleted_at=is.null&order=name.asc`,
      );
      // Stamp each row with a single, server-derived account_status so the Access
      // Control grid renders one badge without re-deriving the rule client-side.
      const clients = (Array.isArray(rows) ? rows : []).map((u: Record<string, unknown>) => ({
        ...u,
        account_status: deriveAccountStatus(u),
      }));
      return jsonResponse({ ok: true, count: clients.length, clients });
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

      // Active language from the coach's LangContext (forwarded by the React
      // Nutrition console). rotate-nutrition appends the output-language clause off
      // this so the regenerated plan is localized end-to-end. Defaults to 'en'.
      const lang = (() => {
        const s = String(body?.lang ?? '').trim().toLowerCase().slice(0, 2);
        return (s === 'es' || s === 'pt') ? s : 'en';
      })();

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
            lang,
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
          `bbf_users?select=id,uid,name,email,role,avatar,subscription_tier,access_status,sport,position&` +
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
          // role surfaced so the Sports Portal's youth gate (sportsApi.isYouthAthlete)
          // keeps portal-injected athletes (role:'athlete', no tier yet) visible.
          role: u?.role ?? null,
          // bbf_users is the SoT for sport/position (the Sovereign Override writes there);
          // bbf_athlete_progression is the legacy fallback so pre-migration athletes resolve.
          sport: u?.sport ?? r.sport, position: u?.position ?? r.position,
          phase: r.phase, target_phase: r.target_phase,
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

    // ── sports_set_profile (Sovereign Override — persist discipline + position) ───
    // The Admin Override Panel's "Apply" writes the selected sport + position to the
    // athlete's canonical bbf_users columns — now the SINGLE SOURCE OF TRUTH for sport
    // assignment (bbf_athlete_progression is deprecated for this). Service-role pgPatch
    // keyed on the bbf_users PK (the roster row's user_id). Biological age is NOT
    // persisted — there is no column; the slider stays a reference lens.
    if (action === 'sports_set_profile') {
      const id = String(body?.id ?? '').trim();
      const sport = String(body?.sport ?? '').trim().toLowerCase().slice(0, 40);
      const position = String(body?.position ?? '').trim().slice(0, 40);
      if (!id) return jsonResponse({ error: 'missing_id' }, 400);
      if (!sport) return jsonResponse({ error: 'missing_sport' }, 400);
      if (!position) return jsonResponse({ error: 'missing_position' }, 400);
      const updated = await pgPatch(
        `bbf_users?id=eq.${encodeURIComponent(id)}&deleted_at=is.null&select=id,uid,sport,position`,
        { sport, position },
      );
      const row = Array.isArray(updated) && updated.length ? updated[0] : null;
      if (!row) return jsonResponse({ error: 'not_found' }, 404);
      return jsonResponse({ ok: true, id: row.id, uid: row.uid, sport: row.sport, position: row.position });
    }

    // ── assign_workout (push a generated program to an athlete's active state) ────
    // Writes the structured workout blueprint (the Command Center Generator output,
    // already transformed to the Vault's ProgramGrid shape) to the selected athlete's
    // bbf_users.workout_plan — the PRIMARY source bbf_verify_user_pin reads at login —
    // and stamps plans_generated_at so plans_available flips true and the Program tab
    // renders it on next sign-in. Best-effort mirror to bbf_active_clients (by email)
    // keeps the admin Client Hub dossier (detail) consistent. Service-role write
    // behind the admin gate; the browser never writes the DB directly (§7).
    if (action === 'assign_workout') {
      const id = String(body?.id ?? '').trim();
      if (!id) return jsonResponse({ error: 'missing_id' }, 400);
      const plan = body?.plan;
      if (!Array.isArray(plan) || !plan.length) return jsonResponse({ error: 'empty_plan' }, 400);
      if (plan.length > 14) return jsonResponse({ error: 'plan_too_large' }, 400);

      // Defense in depth — strip any contraindicated movement (the engine already
      // forbids them and `detail` scrubs on read; scrub on write too).
      const safePlan = (plan as any[]).map((d) => (
        d && Array.isArray(d.exercises)
          ? { ...d, exercises: d.exercises.filter((ex: any) => !isBlacklisted(ex?.name)) }
          : d
      ));
      const planStr = JSON.stringify(safePlan);
      const stamp = new Date().toISOString();

      // Resolve the athlete (id → email) so the active_clients mirror can match.
      const urows = await pgGet(`bbf_users?select=id,uid,email&id=eq.${encodeURIComponent(id)}&limit=1`);
      const u = Array.isArray(urows) && urows.length ? urows[0] : null;
      if (!u) return jsonResponse({ error: 'not_found' }, 404);

      // PRIMARY write — bbf_users (the login's first plan source). Keyed on the PK.
      const updated = await pgPatch(
        `bbf_users?id=eq.${encodeURIComponent(id)}&select=id`,
        { workout_plan: planStr, plans_generated_at: stamp },
      );
      if (!(Array.isArray(updated) && updated.length)) return jsonResponse({ error: 'not_found' }, 404);

      // Best-effort mirror — bbf_active_clients (the admin detail view reads here). Non-fatal.
      if (u.email) {
        try {
          await pgPatch(
            `bbf_active_clients?or=(vault_email.eq.${encEmail(u.email)},client_email.eq.${encEmail(u.email)})`,
            { workout_plan: planStr, plans_generated_at: stamp },
          );
        } catch (_) { /* non-fatal — the primary write already landed */ }
      }

      return jsonResponse({ ok: true, persisted: true, plans_generated_at: stamp, days: safePlan.length });
    }

    // ── leads_list / concierge_log (Comlink) — read DIRECTLY via the service role ──
    // Previously this RELAYED to Render with the server-held BBF_RENDER_ADMIN_TOKEN.
    // That second server-to-server token drifted from Render's BBF_ADMIN_TOKEN, so
    // Render rejected the relay (admin_token_invalid) and we surfaced it as a 500/502
    // — the Comlink crash. The data lives in Supabase (bbf_leads / bbf_lead_actions)
    // and THIS function already holds the service role AND has authorized the admin,
    // so we read it here directly: no Render hop, no second token to juggle (§7).
    // Response shapes are byte-for-byte what Render returned, so the frontend is
    // unchanged. (Logic ported verbatim from index.js /api/leads-list + /concierge-log.)
    if (action === 'leads_list') {
      const limit = Math.max(1, Math.min(200, Number(body?.limit) || 100));
      const leads = await pgGet(
        `bbf_leads?select=id,source,email,full_name,phone,tier,payload,created_at` +
        `&order=created_at.desc&limit=${limit}`,
      );
      const list = Array.isArray(leads) ? leads : [];
      // Cross-reference bbf_users by email → PROVISIONED vs PENDING (hash-join in JS).
      const emails = [...new Set(list.map((l) => String(l.email || '').toLowerCase()).filter(Boolean))];
      const provisioned = new Set<string>();
      if (emails.length) {
        const inList = emails.map((e) => `"${encodeURIComponent(e)}"`).join(',');
        try {
          const users = await pgGet(`bbf_users?select=email&email=in.(${inList})`);
          for (const u of (Array.isArray(users) ? users : [])) {
            if (u.email) provisioned.add(String(u.email).toLowerCase());
          }
        } catch (_) { /* cross-ref non-fatal — rows read as pending */ }
      }
      const decorated = list.map((l) => {
        const p = (l.payload && typeof l.payload === 'object') ? l.payload : {};
        return {
          id: l.id, source: l.source, email: l.email, full_name: l.full_name, phone: l.phone,
          tier: l.tier || p.tier || null, created_at: l.created_at,
          provisioned: provisioned.has(String(l.email || '').toLowerCase()),
          dietary_profile: p.dietary_profile || null,
          allergens: Array.isArray(p.allergens) ? p.allergens : [],
          age: p.age || null, sex: p.sex || null, height: p.height || null, weight: p.weight || null,
          primary_goal: p.primary_goal || null, program: p.program || null,
          health_notes: p.health_notes || null, full_payload: p,
        };
      });
      return jsonResponse({
        ok: true,
        total: decorated.length,
        provisioned: decorated.filter((l) => l.provisioned).length,
        pending: decorated.filter((l) => !l.provisioned).length,
        leads: decorated,
      });
    }

    if (action === 'concierge_log') {
      const limit = Math.max(1, Math.min(200, Number(body?.limit) || 80));
      const rows = await pgGet(
        `bbf_lead_actions?select=id,run_id,lead_id,lead_email,action_type,score,priority,` +
        `template_id,email_subject,email_body_preview,brevo_message_id,error,created_at` +
        `&order=created_at.desc&limit=${limit}`,
      );
      const acts = Array.isArray(rows) ? rows : [];
      // Group by run_id → run cards (sent / failed / skipped counts), newest first.
      const runs: Record<string, any> = {};
      for (const a of acts) {
        const rid = String(a.run_id ?? 'unknown');
        if (!runs[rid]) runs[rid] = { run_id: a.run_id, started_at: a.created_at, actions: [], sent: 0, failed: 0, skipped: 0 };
        const run = runs[rid];
        run.actions.push(a);
        if (a.action_type === 'email_sent') run.sent++;
        if (a.action_type === 'email_failed') run.failed++;
        if (typeof a.action_type === 'string' && a.action_type.indexOf('skipped_') === 0) run.skipped++;
        if (a.created_at && a.created_at < run.started_at) run.started_at = a.created_at;
      }
      const runList = Object.values(runs).sort((a: any, b: any) => (b.started_at > a.started_at ? 1 : -1));
      return jsonResponse({ ok: true, total: acts.length, runs: runList });
    }

    // ── tiers (pricing matrix → tier-reassignment dropdown) ──────────────────────
    if (action === 'tiers') {
      const rows = await pgGet(
        `bbf_tiers?select=slug,display_name,category,price_cents,billing_type` +
        `&order=category.asc,price_cents.asc`,
      );
      return jsonResponse({ ok: true, tiers: Array.isArray(rows) ? rows : [] });
    }

    // ── set_tier (manual comp / up / downgrade — bypasses Stripe) ─────────────────
    // Drives public.bbf_admin_set_tier: allowlist-validated, akeem locked to
    // 'sovereign'. Keys on uid (the roster row carries it).
    if (action === 'set_tier') {
      const uid = String(body?.uid ?? '').trim().toLowerCase();
      const tier = String(body?.tier ?? '').trim().toLowerCase();
      if (!uid) return jsonResponse({ error: 'missing_uid' }, 400);
      if (!tier || !SETTABLE_TIERS.has(tier)) return jsonResponse({ error: 'invalid_tier', detail: tier }, 400);
      try {
        await pgRpc('bbf_admin_set_tier', { p_uid: uid, p_tier: tier });
      } catch (e) {
        const m = String((e as Error)?.message ?? e);
        if (m.includes('akeem_locked_to_sovereign')) return jsonResponse({ error: 'akeem_locked_to_sovereign' }, 409);
        if (m.includes('user_not_found')) return jsonResponse({ error: 'not_found' }, 404);
        if (m.includes('invalid_tier')) return jsonResponse({ error: 'invalid_tier', detail: tier }, 400);
        throw e;
      }
      return jsonResponse({ ok: true, uid, subscription_tier: tier });
    }

    // ── set_status (THE KILL SWITCH — lock / unlock) ──────────────────────────────
    // Drives public.bbf_admin_set_access_status: flips access_status and, on lock,
    // DELETES every live vault_token for the user (instant session revocation) so
    // the athlete's Vault ejects to the public login on its next heartbeat. akeem
    // can never be locked. Service-role ONLY at the DB layer — never anon-callable.
    if (action === 'set_status') {
      const uid = String(body?.uid ?? '').trim().toLowerCase();
      const status = String(body?.status ?? '').trim().toLowerCase();
      if (!uid) return jsonResponse({ error: 'missing_uid' }, 400);
      if (status !== 'locked' && status !== 'unlocked') {
        return jsonResponse({ error: 'invalid_status', detail: status }, 400);
      }
      let result: any;
      try {
        result = await pgRpc('bbf_admin_set_access_status', {
          p_uid: uid, p_status: status, p_actor: 'command_center',
        });
      } catch (e) {
        const m = String((e as Error)?.message ?? e);
        if (m.includes('akeem_cannot_be_locked')) return jsonResponse({ error: 'akeem_cannot_be_locked' }, 409);
        if (m.includes('user_not_found')) return jsonResponse({ error: 'not_found' }, 404);
        if (m.includes('invalid_status')) return jsonResponse({ error: 'invalid_status', detail: status }, 400);
        throw e;
      }
      return jsonResponse({
        ok: true,
        uid,
        access_status: result?.access_status ?? status,
        sessions_revoked: result?.sessions_revoked ?? 0,
      });
    }

    return jsonResponse({ error: 'unknown_action', detail: action }, 400);
  } catch (e) {
    return jsonResponse({ error: 'server_error', detail: String((e as Error)?.message ?? e) }, 500);
  }
});
