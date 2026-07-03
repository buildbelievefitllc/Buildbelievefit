// ═══════════════════════════════════════════════════════════════════════════
// bbf-resend-welcome (v2) — credential-dispatch RETRY worker with backoff clock
// ───────────────────────────────────────────────────────────────────────────
// Sweeps recorded welcome-dispatch failures (bbf_email_events, event_type=
// 'welcome_send_failed', payload.status='failed') whose backoff timer is due,
// RE-ISSUES a hardened PIN (blueprint §1.3 reject-list — original is bcrypt-only),
// RESENDS the credentials, and advances the pipeline. Formalizes the live sweeper
// (blueprint §1.4):
//   BACKOFF[n] = 15m · 1h · 4h · 12h · 24h   (attempts 1→5, from onboarding_backoff_v1)
//   attempts > cap → escalate: pipeline 'delivery_blocked' (retry_exhausted) + alert
//   success        → pipeline 'credentials_dispatched'
//
// DUAL AUTH: X-BBF-Admin-Token=BBF_COACH_AGENT_TOKEN (manual) OR X-Cron-Secret=
// CRON_SECRET (pg_cron sweep). Deploy --no-verify-jwt.
// POST body (optional): { limit?=25, dry_run?=false, force?=false }
// → { ok, scanned, resent, escalated, deferred, failed, skipped, dry_run, results }
//
// SAFETY: per-row best-effort; a row is marked resolved ONLY after a 2xx send, so a
// miss stays pending for the next due sweep — a paid customer is never stranded.
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import {
  CORS, jsonResponse, normLocale, num, securePin, nextAttemptAt, readConfigJson,
  sendCredentialEmail, insertAdminAlert, type SupabaseClient,
} from '../_shared/onboarding-core.ts';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);

  const ADMIN_TOKEN = Deno.env.get('BBF_COACH_AGENT_TOKEN') ?? '';
  const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';
  const adminOk = ADMIN_TOKEN.length > 0 && (req.headers.get('x-bbf-admin-token') ?? '') === ADMIN_TOKEN;
  const cronOk = CRON_SECRET.length > 0 && (req.headers.get('x-cron-secret') ?? '') === CRON_SECRET;
  if (!adminOk && !cronOk) return jsonResponse({ ok: false, error: 'unauthorized' }, 401);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SERVICE_ROLE) return jsonResponse({ ok: false, error: 'config_missing' }, 503);
  const supabase: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false, autoRefreshToken: false } });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* defaults */ }
  const limit = Math.min(Math.max(Number(body.limit) || 25, 1), 100);
  const dryRun = body.dry_run === true;
  const force = body.force === true; // ignore the backoff gate (manual admin override)

  const backoffCfg = await readConfigJson<{ backoff_minutes: number[]; attempts_cap: number }>(supabase, 'onboarding_backoff_v1');
  const backoffMin = backoffCfg?.backoff_minutes ?? [15, 60, 240, 720, 1440];
  const attemptsCap = backoffCfg?.attempts_cap ?? 5;

  const nowIso = new Date().toISOString();

  // Pending = failed welcome dispatches whose backoff timer is due (or null), oldest first.
  const { data: pending, error: qErr } = await supabase
    .from('bbf_email_events')
    .select('id,email,message_id,payload,attempts,next_attempt_at,ts')
    .eq('event_type', 'welcome_send_failed')
    .filter('payload->>status', 'eq', 'failed')
    .order('ts', { ascending: true })
    .limit(limit);
  if (qErr) return jsonResponse({ ok: false, error: 'query_failed', detail: qErr.message }, 500);

  const results: Array<Record<string, unknown>> = [];
  let resent = 0, escalated = 0, deferred = 0, failed = 0, skipped = 0;

  for (const row of (pending ?? [])) {
    const payload: Record<string, unknown> = (row.payload as Record<string, unknown>) || {};
    const email = row.email as string | null;

    // Backoff gate: skip rows not yet due (unless force).
    if (!force && row.next_attempt_at && String(row.next_attempt_at) > nowIso) {
      deferred++; results.push({ id: row.id, email, status: 'deferred', due: row.next_attempt_at }); continue;
    }

    // Resolve credentials context (backfill from the user row + intake if the payload lacked it).
    let username = (payload.username as string | null) || null;
    let locale = normLocale(payload.locale);
    let tier = (payload.tier as string | null) || null;
    let userId: string | null = null;
    let birthYear: number | null = null;
    if (email) {
      const { data: u } = await supabase.from('bbf_users').select('id,uid,name,preferred_locale,current_tier,metabolic_tier').eq('email', email).maybeSingle();
      if (u) {
        userId = String(u.id);
        if (!username) username = u.uid as string | null;
        if (!payload.locale && u.preferred_locale) locale = normLocale(u.preferred_locale);
        if (!tier) tier = (u.current_tier ?? u.metabolic_tier ?? null) as string | null;
        const { data: intake } = await supabase.from('bbf_pathfinder_intakes').select('birth_year').eq('consumed_by_user', u.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
        birthYear = num(intake?.birth_year);
      }
    }
    if (!username || !email) { skipped++; results.push({ id: row.id, email, status: 'skipped', reason: 'no_username' }); continue; }

    const priorAttempts = Math.max(num(row.attempts) ?? 0, num(payload.attempts) ?? 0);

    // Escalation: exceeded the cap → block + alert (no further silent retries).
    if (priorAttempts >= attemptsCap) {
      if (!dryRun) {
        await supabase.from('bbf_email_events').update({ payload: { ...payload, status: 'retry_exhausted', escalated_at: nowIso } }).eq('id', row.id);
        if (userId) {
          const { data: p } = await supabase.from('bbf_onboarding_pipeline').select('id').eq('user_id', userId).neq('state', 'activated').order('created_at', { ascending: false }).limit(1).maybeSingle();
          if (p?.id) await supabase.from('bbf_onboarding_pipeline').update({ state: 'delivery_blocked', failure_reason: 'retry_exhausted', state_entered_at: nowIso, updated_at: nowIso }).eq('id', p.id);
        }
        await insertAdminAlert(supabase, { kind: 'delivery_blocked', reason: 'retry_exhausted', email, userId, detail: `Welcome dispatch exhausted ${priorAttempts} attempts.` });
      }
      escalated++; results.push({ id: row.id, email, username, status: 'escalated', attempts: priorAttempts }); continue;
    }

    if (dryRun) { results.push({ id: row.id, email, username, status: 'would_resend', attempts: priorAttempts }); continue; }

    const attempts = priorAttempts + 1;

    // 1) Re-issue a HARDENED PIN (reject-list, birth-year aware).
    const newPin = securePin(birthYear);
    const { error: pinErr } = await supabase.rpc('bbf_service_reissue_pin', { p_uid: username, p_pin: newPin });
    if (pinErr) {
      failed++;
      await supabase.from('bbf_email_events').update({ attempts, next_attempt_at: nextAttemptAt(attempts, backoffMin), payload: { ...payload, attempts, last_error: `reissue:${pinErr.message}` } }).eq('id', row.id);
      results.push({ id: row.id, email, username, status: 'reissue_failed', detail: pinErr.message }); continue;
    }

    // 2) Resend the credentials (Brevo template → trilingual inline fallback).
    const send = await sendCredentialEmail({ email, name: username, username, pin: newPin, tier, locale, tag: 'resend-welcome' });

    if (send.ok) {
      resent++;
      await supabase.from('bbf_email_events').update({
        attempts, next_attempt_at: null, provider_msg_id: send.providerMsgId ?? row.message_id ?? null,
        payload: { ...payload, status: 'resolved', resolved_at: nowIso, attempts, resent: true },
      }).eq('id', row.id);
      await supabase.from('bbf_email_events').insert({ event_type: 'welcome_resent', email, message_id: row.message_id, channel: 'email', provider_msg_id: send.providerMsgId ?? null, payload: { kind: 'welcome', username, tier, locale, source_event: row.id, resent_at: nowIso } });
      if (userId) {
        const { data: p } = await supabase.from('bbf_onboarding_pipeline').select('id,steps').eq('user_id', userId).neq('state', 'activated').order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (p?.id) {
          const priorSteps = (p.steps && typeof p.steps === 'object') ? p.steps as Record<string, unknown> : {};
          await supabase.from('bbf_onboarding_pipeline').update({ state: 'credentials_dispatched', steps: { ...priorSteps, dispatch: { ok: true, at: nowIso, channel: 'email', attempts } }, failure_reason: null, state_entered_at: nowIso, updated_at: nowIso }).eq('id', p.id);
        }
      }
      results.push({ id: row.id, email, username, status: 'resent', attempts });
    } else {
      // PIN reset but the email still didn't send — schedule the next backoff rung.
      failed++;
      await supabase.from('bbf_email_events').update({ attempts, next_attempt_at: nextAttemptAt(attempts, backoffMin), payload: { ...payload, attempts, last_error: `send:${send.error}` } }).eq('id', row.id);
      results.push({ id: row.id, email, username, status: 'send_failed', detail: send.error, next_attempt_at: nextAttemptAt(attempts, backoffMin) });
    }
  }

  console.log(`[bbf-resend-welcome] scanned=${(pending ?? []).length} resent=${resent} escalated=${escalated} deferred=${deferred} failed=${failed} skipped=${skipped} dry_run=${dryRun}`);
  return jsonResponse({ ok: true, scanned: (pending ?? []).length, resent, escalated, deferred, failed, skipped, dry_run: dryRun, results }, 200);
});
