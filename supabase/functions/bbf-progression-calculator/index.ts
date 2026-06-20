// supabase/functions/bbf-progression-calculator/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// THE PROGRESSION ENGINE — tier-promotion calculator (Blueprint §5, STEP 3).
//
// Invoked when an athlete completes (and a coach verifies) a milestone. It compares
// the athlete's verified milestone completions against the REQUIRED milestones for
// their current_tier in sport_milestones; when the requirement is met it promotes
// athlete_profiles.current_tier up the ladder:
//
//     youth → middle_school → high_school → collegiate   (collegiate is terminal)
//
// Pure DB logic — no Claude call (CLAUDE.md §4 N/A). §5 conventions: CORS +
// jsonResponse + OPTIONS; success { ok:true, status:'checked', upgraded, ... };
// errors non-2xx { error, detail }.
//
// VERIFICATION GATE (documented): a completion counts toward promotion only when
// verified_by_coach = true. This mirrors the Blueprint §6 "Verifiers" model — the
// coach verification is the high-stakes trigger that gates the gamified ladder and
// keeps the milestone record a trustworthy "Athletic Resume".

// Built-in Deno.serve (no deno.land/std fetch) keeps bundling reliable.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-bbf-admin-token, x-bbf-vault-token, x-client-info',
};
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const TIER_ORDER = ['youth', 'middle_school', 'high_school', 'collegiate'] as const;
function nextTier(t: string): string | null {
  const i = TIER_ORDER.indexOf(t as typeof TIER_ORDER[number]);
  return (i >= 0 && i < TIER_ORDER.length - 1) ? TIER_ORDER[i + 1] : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);
  if (!SUPABASE_URL || !SERVICE_KEY) return jsonResponse({ error: 'config_unavailable', detail: 'Server identity store is unreachable.' }, 503);

  let payload: Record<string, unknown>;
  try { payload = await req.json(); } catch { return jsonResponse({ error: 'invalid_json' }, 400); }

  const athleteId = typeof payload?.athlete_id === 'string' ? payload.athlete_id : null;
  if (!athleteId) return jsonResponse({ error: 'missing_athlete_id', detail: 'athlete_id is required.' }, 400);

  const supa = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // 1 · Resolve the athlete (sport + current tier are the source of truth).
  const { data: prof, error: profErr } = await supa
    .from('athlete_profiles')
    .select('id, sport, current_tier')
    .eq('id', athleteId)
    .maybeSingle();
  if (profErr) return jsonResponse({ error: 'profile_lookup_failed', detail: profErr.message }, 502);
  if (!prof) return jsonResponse({ error: 'athlete_not_found', detail: 'No athlete_profiles row for that id.' }, 404);

  const sport = (typeof payload?.sport === 'string' && payload.sport) ? String(payload.sport) : String(prof.sport || '');
  const currentTier = String(prof.current_tier || 'youth');

  // 2 · Required milestones for (sport, current_tier).
  const { data: required, error: reqErr } = await supa
    .from('sport_milestones')
    .select('id')
    .eq('sport', sport)
    .eq('tier', currentTier);
  if (reqErr) return jsonResponse({ error: 'milestones_lookup_failed', detail: reqErr.message }, 502);

  const requiredIds = (required || []).map((r: { id: string }) => r.id);
  const requiredCount = requiredIds.length;

  const base = {
    ok: true, status: 'checked', athlete_id: athleteId, sport,
    from_tier: currentTier, required_count: requiredCount,
  };

  // No blueprint defined for this (sport, tier) → nothing to promote against.
  if (requiredCount === 0) {
    return jsonResponse({ ...base, upgraded: false, to_tier: currentTier, completed_count: 0, reason: 'no_milestones_defined' });
  }

  // 3 · Verified completions among the required set.
  const { data: sync, error: syncErr } = await supa
    .from('athlete_milestones_sync')
    .select('milestone_id, verified_by_coach')
    .eq('athlete_id', athleteId)
    .in('milestone_id', requiredIds);
  if (syncErr) return jsonResponse({ error: 'sync_lookup_failed', detail: syncErr.message }, 502);

  const verifiedDone = new Set(
    (sync || []).filter((s: { verified_by_coach: boolean }) => s.verified_by_coach === true)
      .map((s: { milestone_id: string }) => s.milestone_id),
  );
  const completedCount = verifiedDone.size;
  const met = completedCount >= requiredCount;
  const promoteTo = nextTier(currentTier);

  // 4 · Promote if the requirement is met and a higher tier exists.
  if (met && promoteTo) {
    const { error: upErr } = await supa
      .from('athlete_profiles')
      .update({ current_tier: promoteTo })
      .eq('id', athleteId);
    if (upErr) return jsonResponse({ error: 'promotion_failed', detail: upErr.message }, 502);
    return jsonResponse({ ...base, upgraded: true, to_tier: promoteTo, completed_count: completedCount });
  }

  return jsonResponse({
    ...base,
    upgraded: false,
    to_tier: currentTier,
    completed_count: completedCount,
    reason: met && !promoteTo ? 'already_at_top_tier' : 'requirements_not_met',
  });
});
