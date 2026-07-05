// supabase/functions/bbf-prescription-checkin/index.ts
// ═══════════════════════════════════════════════════════════════════════════
// POST-WORKOUT CHECK-IN WRITER — the client entry point of the prescription loop.
// Writes ONE row to session_feedback (service role); that INSERT fires the
// existing session_feedback tripwire → bbf-prescription-engine, which generates
// the athlete's next-day playlist. ZERO AI.
//
// WHY THIS EXISTS (not a direct browser insert): session_feedback is RLS
// service-role-only, AND the browser never holds the bbf_users UUID — it holds a
// username slug + a 24h vault_token (see AuthContext). So identity is resolved
// SERVER-SIDE from the vault bearer via the established _bbf_uid_from_vault_token
// RPC (same resolver the entitlement gate uses); the caller-supplied uid is NEVER
// trusted for identity (§7). A direct anon insert would both fail RLS and write a
// wrong (slug) user_id.
//
// AUTH: deploy verify_jwt:false. The Supabase gateway routes on the anon key; the
// REAL identity boundary is the vault_token (body `vault_token` or X-BBF-Vault-Token
// header). Mirrors bbf-agentic-recovery / -prehab. Identity-only (no tier gate): a
// post-session pain/RPE check-in is foundational logging, available to any valid
// vault session (locked accounts have their session rows revoked → never resolve).
//
// PREHAB THREADING (architectural reconciliation): a check-in reporting a real
// joint issue (mappable area + pain ≥ 4) ALSO enqueues that joint into
// prehab_queue for today — so the Hub's Prehab card and the Prehab tab reflect
// the reported joint immediately, not just the next nightly sentinel pass.
// Best-effort + fail-soft: a duplicate (uq_prehab_active: athlete/day/joint) or
// any enqueue failure never fails the already-committed check-in (house H-1).
//
// Response: 200 { ok, feedback_id, user_id, target_area, prehab_queued } ·
//           400 bad input · 401 no/invalid session · 405 method · 500 write failure.
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-bbf-vault-token',
};
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

const KNOWN_AREAS = ['shoulder', 'lower_body', 'knee', 'neck', 'upper_body', 'full_body'];
const num = (v: unknown): number | null => { const n = Number(v); return Number.isFinite(n) ? n : null; };

// Server-authoritative identity: resolve bbf_users.id (uuid) from the 24h vault
// bearer via the established SECURITY DEFINER RPC. Returns null on any miss
// (expired / invalid / revoked-on-lock).
async function uidFromVaultToken(supabaseUrl: string, serviceKey: string, token: string): Promise<string | null> {
  try {
    const r = await fetch(`${supabaseUrl}/rest/v1/rpc/_bbf_uid_from_vault_token`, {
      method: 'POST',
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_session_token: token }),
    });
    if (!r.ok) return null;
    const v = await r.json().catch(() => null); // scalar RPC → uuid string or null
    return (typeof v === 'string' && v) ? v : null;
  } catch { return null; }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SERVICE_KEY) return jsonResponse({ error: 'config_missing' }, 503);

  let payload: Record<string, unknown>;
  try { payload = await req.json(); } catch { return jsonResponse({ error: 'invalid_json' }, 400); }

  const pain = num(payload.pain_score);
  const rpe = num(payload.rpe_score);
  if (pain === null || rpe === null) return jsonResponse({ error: 'missing_scores' }, 400);
  if (pain < 1 || pain > 10 || rpe < 1 || rpe > 10) return jsonResponse({ error: 'scores_out_of_range' }, 400);

  // Canonicalize the target area; unknown/empty → full_body (the engine also normalizes).
  const rawArea = String(payload.target_area ?? '').trim().toLowerCase().replace(/\s+/g, '_');
  const targetArea = KNOWN_AREAS.includes(rawArea) ? rawArea : 'full_body';

  // Identity from the vault bearer (body or header) — never the client-supplied uid.
  const vaultToken = String(payload.vault_token ?? req.headers.get('x-bbf-vault-token') ?? '').trim();
  if (!vaultToken) return jsonResponse({ error: 'missing_session', detail: 'A vault session token is required.' }, 401);
  const userId = await uidFromVaultToken(SUPABASE_URL, SERVICE_KEY, vaultToken);
  if (!userId) return jsonResponse({ error: 'invalid_session', detail: 'Vault session is invalid or expired.' }, 401);

  // Service-role insert → fires the session_feedback tripwire → prescription engine.
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1/session_feedback`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json', Prefer: 'return=representation',
      },
      body: JSON.stringify({ user_id: userId, pain_score: pain, rpe_score: rpe, target_area: targetArea }),
    });
  } catch (e) {
    console.error(`[bbf-prescription-checkin] insert threw: ${(e as Error).message}`);
    return jsonResponse({ error: 'write_failed' }, 500);
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error(`[bbf-prescription-checkin] insert HTTP ${res.status}: ${detail}`);
    return jsonResponse({ error: 'write_failed', detail: `HTTP ${res.status}` }, 500);
  }
  const rows = await res.json().catch(() => null);
  const feedbackId = (Array.isArray(rows) && rows[0]?.id) ? rows[0].id : null;

  // ── PREHAB THREADING — enqueue the reported joint (best-effort, fail-soft) ──
  // Reported area → prehab_queue.joint_zone (schema CHECK taxonomy). full_body =
  // no joint complaint → nothing to enqueue; low pain (<4) = no clinical flag.
  //
  // ⚠ KEEP IN SYNC — SINGLE SOURCE OF TRUTH for area→joint routing.
  // This MUST stay byte-identical to the frontend's AREA_TO_PREHAB_REGION in
  // src/lib/useActiveSymptom.js. The Hub Prehab card renders THIS queue row's
  // joint_zone while the Prehab tab renders the deck AREA_TO_PREHAB_REGION picks —
  // if the two maps drift, the same complaint is named two different joints across
  // the two surfaces (the exact bug this alignment fixes). Only joints that own a
  // real drill deck are targeted: 'hip'/'neck' have NO deck, so lower_body routes to
  // lower_back and neck to its shoulder clinical neighbor (scapular/rotator work).
  // The athlete's ACTUAL reported area is preserved verbatim in
  // trigger_reason.target_area below, so no clinical signal is lost.
  const AREA_TO_JOINT: Record<string, string> = {
    shoulder: 'shoulder', knee: 'knee', neck: 'shoulder', upper_body: 'shoulder', lower_body: 'lower_back',
  };
  let prehabQueued = false;
  const joint = AREA_TO_JOINT[targetArea];
  if (joint && pain >= 4) {
    try {
      const svc = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };
      const pr = await fetch(
        `${SUPABASE_URL}/rest/v1/athlete_profiles?user_id=eq.${encodeURIComponent(userId)}&select=id&order=created_at.asc&limit=1`,
        { headers: svc },
      );
      const profs = pr.ok ? await pr.json().catch(() => []) : [];
      const profileId = Array.isArray(profs) && profs[0]?.id ? String(profs[0].id) : null;
      if (profileId) {
        const today = new Date().toISOString().slice(0, 10);
        const ins = await fetch(`${SUPABASE_URL}/rest/v1/prehab_queue`, {
          method: 'POST',
          headers: { ...svc, Prefer: 'return=minimal' },
          body: JSON.stringify({
            athlete_id: profileId,
            scheduled_for: today,
            joint_zone: joint,
            priority: pain >= 7 ? 'mandatory' : pain >= 5 ? 'strong' : 'advisory',
            risk_score: pain * 10,
            status: 'queued',
            trigger_reason: { source: 'post_workout_checkin', target_area: targetArea, pain_score: pain, rpe_score: rpe },
            // protocol is NOT NULL — the check-in flags the joint; the prehab
            // agent/sentinel fills the drill content when the card is served.
            protocol: { origin: 'post_workout_checkin', drills: [], pending: true },
          }),
        });
        // 409/23505 = this joint is already queued today (uq_prehab_active) — that IS
        // the desired end state, so it counts as queued (fail-soft, house H-1 pattern).
        prehabQueued = ins.ok || ins.status === 409;
        if (!ins.ok && ins.status !== 409) {
          console.warn(`[bbf-prescription-checkin] prehab enqueue failed HTTP ${ins.status} (non-fatal)`);
        }
      }
    } catch (e) {
      console.warn(`[bbf-prescription-checkin] prehab enqueue threw (non-fatal): ${(e as Error).message}`);
    }
  }

  console.log(`[bbf-prescription-checkin] user=${userId} pain=${pain} rpe=${rpe} area=${targetArea} feedback_id=${feedbackId} prehab_queued=${prehabQueued}`);
  return jsonResponse({ ok: true, feedback_id: feedbackId, user_id: userId, target_area: targetArea, prehab_queued: prehabQueued }, 200);
});
