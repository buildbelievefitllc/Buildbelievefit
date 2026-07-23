// supabase/functions/bbf-night-orchestrator/index.ts
// ═══════════════════════════════════════════════════════════════════════════
// NIGHT SHIFT · MASTER ORCHESTRATION TRACK — the 2:00 AM UTC batch orchestrator.
//
// Three deterministic sweeps, ZERO LLM calls (CALCULATOR-OFF-LLM: this whole
// pipeline is native math + templates; AI never decides thresholds or content):
//
//   1) GROWTH-PLATE LOAD SAFEGUARD — pre-high-school athletes whose 7-day
//      high-impact set volume (jump/plyo/depth/bound/hop patterns in the set
//      log) exceeds the youth cap, or who logged ANY depth jump (Immutable
//      Laws: forbidden pre-Phase-3) → COACHING_INTERVENTION card with a
//      conservative deload payload (shape = bbf_apply_plan_override).
//   2) MISSED CHECK-IN SWEEP — clients who checked in within the last 14 days
//      but have NO bbf_readiness row for 2 consecutive days → outreach-only
//      COACHING_INTERVENTION (absence can't fire a row trigger; this sweep
//      owns that half of the compliance contract).
//   3) MILESTONE → REEL PRE-BAKE — the highest-tier, most recent verified
//      milestone of the past 24h becomes a pre-assembled 15s Kinetic
//      Hyperframe draft payload (segmented cards, palette, derived CTA — the
//      same deterministic core as frontend lib/hyperframe.js) staged as a
//      REEL_DRAFT_PROPOSAL card. Approving it in the Action Inbox hands the
//      draft to Studio V4 where SovereignFoundry renders it (WebCodecs is a
//      browser engine — the render happens on the founder's machine, the
//      payload here is everything the studio needs to assemble instantly).
//
// Every finding lands as a PENDING card in coach_action_inbox — the founder-
// approved dry-run rail. Nothing changes an athlete's plan without the tap.
// Auth: X-BBF-Admin-Token (pg_cron injects it from Vault). verify_jwt: false.
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-bbf-admin-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

// ── Youth load policy (native constants — the calculator, not the LLM) ──────
const HIGH_IMPACT_RE = /jump|plyo|depth|bound|hop|leap/i;
const DEPTH_JUMP_RE = /depth\s*jump/i;
const YOUTH_WEEKLY_IMPACT_CAP = 60; // high-impact sets / rolling 7 days
const PRE_HS_TIERS = new Set(['youth', 'middle_school']);

// ── Deterministic Kinetic Hyperframe core — Deno twin of lib/hyperframe.js ──
function hfSegments(text: string, maxWords = 4): string[] {
  const raw = String(text || '').replace(/\r/g, '').trim();
  if (!raw) return [];
  const cap = Math.max(2, Math.min(6, Math.round(maxWords) || 4));
  const beats: string[] = [];
  for (const line of raw.split('\n')) {
    for (const frag of line.split(/(?<=[.!?…])\s+/)) {
      const words = frag.trim().split(/\s+/).filter(Boolean);
      for (let i = 0; i < words.length; i += cap) {
        const card = words.slice(i, i + cap).join(' ').trim();
        if (card) beats.push(card);
      }
    }
  }
  return beats;
}
function hfCta(text: string): string {
  const beats = hfSegments(text, 6);
  const tail = beats.length ? beats[beats.length - 1] : '';
  const cta = tail.replace(/[.!?…]+$/, '').trim().toUpperCase();
  return cta && cta.length <= 24 ? cta : 'START TODAY';
}

const TIER_WEIGHT: Record<string, number> = { collegiate: 4, high_school: 3, middle_school: 2, youth: 1 };
const firstName = (s: unknown) => String(s || 'Athlete').trim().split(/\s+/)[0] || 'Athlete';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const ADMIN_TOKEN = Deno.env.get('BBF_COACH_AGENT_TOKEN') ?? '';
  if (!SUPABASE_URL || !SERVICE_KEY) return jsonResponse({ error: 'backend_unconfigured' }, 503);
  if (!ADMIN_TOKEN || req.headers.get('x-bbf-admin-token') !== ADMIN_TOKEN) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }
  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

  const out = { growth_plate_flags: 0, missed_checkin_flags: 0, reel_drafts: 0, errors: [] as string[] };
  const nowIso = new Date().toISOString();
  const daysAgo = (n: number) => new Date(Date.now() - n * 86400e3).toISOString();

  // Dedup helper: one live PENDING card per athlete+type.
  const hasPending = async (userId: string, type: string) => {
    const { data } = await db.from('coach_action_inbox').select('id')
      .eq('athlete_id', userId).eq('type', type).eq('status', 'PENDING').limit(1);
    return !!(data && data.length);
  };

  // ── 1 · GROWTH-PLATE LOAD SAFEGUARD ────────────────────────────────────────
  try {
    const { data: youth } = await db.from('athlete_profiles')
      .select('id, user_id, full_name, sport, current_tier')
      .in('current_tier', [...PRE_HS_TIERS]);
    for (const a of youth ?? []) {
      if (!a.user_id) continue;
      const { data: sets } = await db.from('bbf_athlete_set_log')
        .select('exercise_name, completed_at')
        .eq('user_id', a.user_id).gte('completed_at', daysAgo(7)).limit(1000);
      const impact = (sets ?? []).filter((s) => HIGH_IMPACT_RE.test(String(s.exercise_name || '')));
      const depthJumps = impact.filter((s) => DEPTH_JUMP_RE.test(String(s.exercise_name || '')));
      const breach = depthJumps.length > 0 || impact.length > YOUTH_WEEKLY_IMPACT_CAP;
      if (!breach || await hasPending(a.user_id, 'COACHING_INTERVENTION')) continue;
      const first = firstName(a.full_name);
      const why = depthJumps.length > 0
        ? `${depthJumps.length} depth-jump set${depthJumps.length === 1 ? '' : 's'} logged — forbidden pre-high-school (Immutable Laws)`
        : `${impact.length} high-impact sets in 7 days (youth cap: ${YOUTH_WEEKLY_IMPACT_CAP})`;
      const { error } = await db.from('coach_action_inbox').insert({
        athlete_id: a.user_id, type: 'COACHING_INTERVENTION', status: 'PENDING',
        risk_score: depthJumps.length > 0 ? 10 : Math.min(10, impact.length / 10),
        insight_summary: `Growth-plate safeguard: ${first} (${String(a.current_tier).replace('_', '-')}) — ${why}.`,
        proposed_action: `Apply a 3-day low-impact override for ${first} and swap the plyometric slots for landing-mechanics work.`,
        draft_message: `${first} — great intensity this week, and we're going to channel it smarter. I'm swapping your jump work for landing mechanics for a few days: your growth plates outrank any single week of training. Trust the process. — Coach Akeem`,
        proposed_plan_modification: {
          volume_multiplier: 0.6, intensity_multiplier: 0.8, target_days: 3,
          modification_reason: `Growth-plate load safeguard: ${why}. Low-impact window auto-proposed.`,
          intervention: { reason: 'growth_plate_load', high_impact_sets_7d: impact.length, depth_jump_sets: depthJumps.length, tier: a.current_tier, sport: a.sport },
        },
      });
      if (error) out.errors.push(`gp:${error.message.slice(0, 60)}`); else out.growth_plate_flags++;
    }
  } catch (e) { out.errors.push(`gp:${String((e as Error)?.message).slice(0, 80)}`); }

  // ── 2 · MISSED CHECK-IN SWEEP (2 consecutive silent days) ──────────────────
  try {
    const { data: recent } = await db.from('bbf_readiness')
      .select('user_id, reading_date').gte('reading_date', daysAgo(14).slice(0, 10));
    const byUser = new Map<string, string[]>();
    for (const r of recent ?? []) {
      if (!r.user_id) continue;
      (byUser.get(r.user_id) ?? byUser.set(r.user_id, []).get(r.user_id)!).push(String(r.reading_date));
    }
    const cutoff = daysAgo(2).slice(0, 10); // no check-in ON or AFTER this date = 2 silent days
    for (const [userId, dates] of byUser) {
      if (dates.some((d) => d >= cutoff)) continue; // checked in within the window
      if (await hasPending(userId, 'COACHING_INTERVENTION')) continue;
      const { data: u } = await db.from('bbf_users').select('name, uid').eq('id', userId).maybeSingle();
      const first = firstName(u?.name || u?.uid);
      const lastSeen = dates.sort().at(-1);
      const { error } = await db.from('coach_action_inbox').insert({
        athlete_id: userId, type: 'COACHING_INTERVENTION', status: 'PENDING',
        risk_score: null,
        insight_summary: `${first} has gone 2+ days without a check-in (last: ${lastSeen}). Compliance is drifting.`,
        proposed_action: `Reach out to ${first} directly — a silent client is a leaving client.`,
        draft_message: `${first} — haven't seen your check-in in a couple days. No judgment, life happens. One tap tonight and we're back on rhythm. What's going on? — Coach Akeem`,
        proposed_plan_modification: {
          intervention: { reason: 'missed_checkins', last_checkin: lastSeen, silent_days: 2 },
        },
      });
      if (error) out.errors.push(`mc:${error.message.slice(0, 60)}`); else out.missed_checkin_flags++;
    }
  } catch (e) { out.errors.push(`mc:${String((e as Error)?.message).slice(0, 80)}`); }

  // ── 3 · MILESTONE → 15s KINETIC HYPERFRAME PRE-BAKE ────────────────────────
  try {
    const { data: ms } = await db.from('athlete_milestones_sync')
      .select('athlete_id, completed_at, verified_by_coach, milestone:sport_milestones(title_en, tier, sport, category)')
      .gte('completed_at', daysAgo(1)).not('completed_at', 'is', null);
    const verified = (ms ?? []).filter((m) => m.verified_by_coach && (m as Record<string, unknown>).milestone);
    verified.sort((a, b) => {
      const ta = TIER_WEIGHT[String((a.milestone as Record<string, unknown>)?.tier)] ?? 0;
      const tb = TIER_WEIGHT[String((b.milestone as Record<string, unknown>)?.tier)] ?? 0;
      return (tb - ta) || String(b.completed_at).localeCompare(String(a.completed_at));
    });
    const top = verified[0];
    if (top) {
      const m = top.milestone as Record<string, string>;
      const { data: prof } = await db.from('athlete_profiles')
        .select('user_id, full_name, sport, current_tier').eq('id', top.athlete_id).maybeSingle();
      if (prof?.user_id && !(await hasPending(prof.user_id, 'REEL_DRAFT_PROPOSAL'))) {
        const first = firstName(prof.full_name).toUpperCase();
        const title = String(m.title_en || 'A NEW MILESTONE').toUpperCase();
        const hook = `${first} JUST CLEARED\n${title}.\nTHE LAB BUILDS DIFFERENT.`;
        const cards = hfSegments(hook, 4);
        const cta = hfCta(hook);
        const { error } = await db.from('coach_action_inbox').insert({
          athlete_id: prof.user_id, type: 'REEL_DRAFT_PROPOSAL', status: 'PENDING',
          risk_score: null,
          insight_summary: `Top milestone of the last 24h: ${firstName(prof.full_name)} cleared "${m.title_en}" (${String(m.tier).replace('_', '-')} · ${m.sport}). A 15s Kinetic Hyperframe is pre-assembled.`,
          proposed_action: 'Approve to load the pre-baked Hyperframe into Studio V4 — review, render, and push to the story queues. First name only; confirm guardian media consent before posting.',
          draft_message: '',
          proposed_plan_modification: {
            reel_draft: {
              hook, cards, bg: 'alt', cta, target_duration: 15,
              hook_sub: `${String(m.sport || '').toUpperCase()} · ${String(m.tier || '').replace('_', ' ').toUpperCase()} TRACK`,
              athlete_first: firstName(prof.full_name),
              milestone: { title: m.title_en, tier: m.tier, sport: m.sport, category: m.category },
              privacy_note: 'first_name_only; verify guardian media consent before publishing',
            },
          },
        });
        if (error) out.errors.push(`reel:${error.message.slice(0, 60)}`); else out.reel_drafts++;
      }
    }
  } catch (e) { out.errors.push(`reel:${String((e as Error)?.message).slice(0, 80)}`); }

  console.log(`[bbf-night-orchestrator] ${nowIso} gp=${out.growth_plate_flags} mc=${out.missed_checkin_flags} reels=${out.reel_drafts} errs=${out.errors.length}`);
  return jsonResponse({ ok: true, ...out, ts: nowIso });
});
