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
//
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-injected),
//          BBF_COACH_AGENT_TOKEN (admin gate), GEMINI_API_KEY (+ GEMINI_MODEL).

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

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ADMIN_TOKEN  = Deno.env.get('BBF_COACH_AGENT_TOKEN') ?? '';
const GEMINI_KEY   = Deno.env.get('GEMINI_API_KEY') ?? '';
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash';

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

function encEmail(e: string) { return encodeURIComponent(String(e || '').toLowerCase().trim()); }

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

function buildCoachPrompt(client: Record<string, unknown> | null, question: string): string {
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
  };
  return [
    'You are the BBF Co-Coach, an evidence-based strength & conditioning assistant.',
    'You support the HUMAN head coach viewing this admin panel — NOT the client directly.',
    'Be concise, specific, and actionable. Reference the actual data you used.',
    'Never discuss backend systems, models, databases, or internal tooling.',
    'If macro targets or plans are missing, say so plainly and recommend a next step.',
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

  // Admin gate — the security boundary for every action.
  const provided = req.headers.get('x-bbf-admin-token') ?? '';
  if (!ADMIN_TOKEN || provided.length === 0 || provided !== ADMIN_TOKEN) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return jsonResponse({ error: 'backend_unconfigured' }, 503);
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
      const { text, model } = await geminiCoach(buildCoachPrompt(client, question));
      return jsonResponse({ ok: true, provider: 'gemini', model, answer: text });
    }

    return jsonResponse({ error: 'unknown_action', detail: action }, 400);
  } catch (e) {
    return jsonResponse({ error: 'server_error', detail: String((e as Error)?.message ?? e) }, 500);
  }
});
