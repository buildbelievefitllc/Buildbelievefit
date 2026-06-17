// bbf-agentic-prehab - Live Library Recovery Matrix (Phase 5, v2)
// ─────────────────────────────────────────────────────────────────────
// CALCULATOR-OFF-LLM (wave 1): the 3-movement matrix is now produced by the
// deterministic BBF prehab engine (_shared/prehab-matrix.mjs) — a real
// screen-flag → drill-set lookup mirroring the DYNAMIC PREHAB MATRIX
// (frontend/src/data/prehabDiagnosticMatrix.json). NO Anthropic call.
// Reported friction is parsed to a joint zone; a fixed, PT-grounded,
// trilingual 3-drill protocol is returned. Response shape unchanged · drop-in:
//   { locale, matrix: [{ name, duration, focus, reason } × 3] }
// FAILURE POSTURE: every path returns a valid matrix at HTTP 200 (baseline on
// any upstream failure); entitlement + per-IP rate limit preserved.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { localeCode } from '../_shared/locale.ts';
import { requireEntitlement } from '../_shared/entitlement-gate.ts';
import { selectPrehabMatrix } from '../_shared/prehab-matrix.mjs';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-bbf-admin-token, x-bbf-vault-token',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

async function prehabRateCheck(ip: string, cap: number, supabaseUrl: string, supabaseKey: string): Promise<{ allowed: boolean; count: number } | null> {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/bbf_prehab_ip_rate_check`, {
      method: 'POST',
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_ip: ip, p_cap: cap }),
    });
    if (!res.ok) { console.error(`[bbf-agentic-prehab v2] rate-check HTTP ${res.status} - fail-open`); return null; }
    const rows = await res.json();
    const row  = Array.isArray(rows) ? rows[0] : rows;
    if (!row || typeof row.allowed !== 'boolean') return null;
    return { allowed: row.allowed, count: Number(row.current_count) || 0 };
  } catch (e) { console.error(`[bbf-agentic-prehab v2] rate-check threw (fail-open): ${(e as Error).message}`); return null; }
}

function adminOverrideMock() {
  return { matrix: [
    { name: 'ADMIN BYPASS: Psoas Release',         duration: '2 mins', focus: 'Hip flexors / Psoas major', reason: 'Master Key Active.' },
    { name: 'ADMIN BYPASS: Thoracic Extension',    duration: '2 mins', focus: 'Upper back / T-spine',      reason: 'Master Key Active.' },
    { name: 'ADMIN BYPASS: Posterior Chain Reset', duration: '90 sec', focus: 'Hamstrings / Glutes',       reason: 'Master Key Active.' },
  ] };
}

function defaultBaselineMatrix() {
  return { matrix: [
    { name: 'Cat-Cow Spinal Flow',         duration: '2 mins',                focus: 'Full spine mobility',    reason: 'Universal baseline reset when telemetry is unavailable. Restores segmental motion top-to-bottom.' },
    { name: '90/90 Hip Switch',            duration: '30 sec hold x 3 sides', focus: 'Hip capsule + rotators', reason: 'Pairs internal + external hip rotation in a low-friction position. Safe for every demographic.' },
    { name: 'Childs Pose with Side Reach', duration: '60 sec total',          focus: 'Lats / lower back',      reason: 'Decompresses the lumbar segment and opens the lats. Safe finisher regardless of session load.' },
  ] };
}

async function fetchTodaySets(uuid: string, todayDate: string, supabaseUrl: string, supabaseKey: string): Promise<Array<Record<string, unknown>> | null> {
  const select = 'exercise_key,weight_lbs,reps,day_key';
  const qs = `user_id=eq.${encodeURIComponent(uuid)}&day_key=like.${encodeURIComponent(todayDate + '%')}&select=${select}&order=day_key.desc&limit=80`;
  const url = `${supabaseUrl}/rest/v1/bbf_sets?${qs}`;
  try {
    const res = await fetch(url, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } });
    if (!res.ok) { console.error(`[bbf-agentic-prehab v2] sets fetch failed: HTTP ${res.status} ${await res.text()}`); return null; }
    return await res.json();
  } catch (e) { console.error(`[bbf-agentic-prehab v2] sets fetch error: ${(e as Error).message}`); return null; }
}

function utcToday(): string {
  const d = new Date();
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')    return jsonResponse({ error: 'method_not_allowed' }, 405);
  let payload: any;
  try { payload = await req.json(); } catch (_) { return jsonResponse({ error: 'invalid_json' }, 400); }
  const { reported_friction, client_context, admin_override } = payload || {};
  const locale = localeCode(payload?.locale ?? payload?.lang);
  if (admin_override === true) return jsonResponse(adminOverrideMock(), 200);
  const friction = typeof reported_friction === 'string' ? reported_friction : '';
  const ctx      = (client_context && typeof client_context === 'object') ? client_context : {};
  const todayDate = (typeof ctx.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(ctx.today)) ? ctx.today : utcToday();
  const SUPABASE_URL         = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY');
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) { console.error('[bbf-agentic-prehab v2] missing Supabase config - baseline'); return jsonResponse(defaultBaselineMatrix(), 200); }
  const gate = await requireEntitlement({ supabaseUrl: SUPABASE_URL, serviceKey: SUPABASE_SERVICE_KEY, vaultToken: payload?.vault_token ?? req.headers.get('x-bbf-vault-token'), feature: 'prehab' });
  if (!gate.ok) return jsonResponse({ error: gate.denial.error, detail: gate.denial.detail }, gate.denial.status);
  const uid  = gate.ctx.uid || gate.ctx.user_id;
  const uuid = gate.ctx.user_id;
  {
    const ip  = clientIp(req);
    const cap = Math.max(1, Number(Deno.env.get('BBF_PREHAB_DAILY_CAP') || 40));
    const rl  = await prehabRateCheck(ip, cap, SUPABASE_URL, SUPABASE_SERVICE_KEY);
    if (rl && !rl.allowed) {
      const now   = new Date();
      const reset = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
      const retry = Math.max(1, Math.ceil((reset - now.getTime()) / 1000));
      console.warn(`[bbf-agentic-prehab v2] rate-limited ip=${ip} count=${rl.count} cap=${cap}`);
      return new Response(JSON.stringify({ error: 'rate_limited', detail: 'Daily prehab limit reached. Resets at 00:00 UTC.', retry_after_seconds: retry }), { status: 429, headers: { ...CORS, 'Content-Type': 'application/json', 'Retry-After': String(retry) } });
    }
  }
  // today_workload drives the friction-empty "post-session reset" rationale.
  const todaySets = await fetchTodaySets(uuid, todayDate, SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const todayWorkload = Array.isArray(todaySets) ? todaySets : [];

  // ─── Deterministic matrix selection (DYNAMIC PREHAB MATRIX lookup) ──
  // Drop-in replacement for the former Sonnet call. Baseline on any throw so
  // the client never sees an error state (matches prior failure posture).
  try {
    const { matrix, zone } = selectPrehabMatrix(friction, locale, { workloadCount: todayWorkload.length });
    console.log(`[bbf-agentic-prehab v2] uid=${uid} today=${todayDate} sets=${todayWorkload.length} friction_len=${friction.length} zone=${zone} engine=deterministic`);
    return jsonResponse({ locale, matrix }, 200);
  } catch (e) {
    console.warn(`[bbf-agentic-prehab v2] engine threw (${(e as Error).message}) - baseline`);
    return jsonResponse(defaultBaselineMatrix(), 200);
  }
});
