// ═══════════════════════════════════════════════════════════════════════════
// bbf-email-events-webhook — Brevo delivery-telemetry ingest + hard-bounce ladder
// ───────────────────────────────────────────────────────────────────────────
// Brevo → us (shared-secret validated, mirrors the Stripe posture; deploy with
// --no-verify-jwt). Ingests delivery events and closes the credential-delivery loop
// (blueprint §1.5):
//   delivered   → ledger 'welcome_delivered' + pipeline steps.delivered
//   soft_bounce → treat as send failure → retry queue (backoff clock)
//   hard_bounce | invalid_email | blocked | spam → HARD-BOUNCE LADDER:
//     1. ALTERNATE EMAIL (intake email ≠ bounced) → reissue PIN → resend (email_alt)
//     2. SMS CREDENTIALS (intake.phone) → reissue PIN → Twilio (sms)
//     3. HUMAN ESCALATION → pipeline 'delivery_blocked' + admin alert
//
// Each ladder rung is logged as its own dispatch row. Best-effort per event — one
// bad event never aborts the batch. A paid customer is never silently stranded.
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import {
  CORS, jsonResponse, normLocale, num, securePin, nextAttemptAt, readConfigJson,
  sendCredentialEmail, sendCredentialSms, insertAdminAlert, type SupabaseClient,
} from '../_shared/onboarding-core.ts';

const HARD = new Set(['hard_bounce', 'invalid_email', 'blocked', 'spam', 'error', 'unsubscribed']);
const SOFT = new Set(['soft_bounce', 'deferred']);
const DELIVERED = new Set(['delivered', 'request', 'sent']);

interface BrevoEvent { event: string; email: string; messageId: string | null; reason: string | null; }
function normalizeEvents(body: unknown): BrevoEvent[] {
  const raw: unknown[] = Array.isArray(body) ? body
    : (body && typeof body === 'object' && Array.isArray((body as Record<string, unknown>).events))
      ? ((body as Record<string, unknown>).events as unknown[])
      : body ? [body] : [];
  return raw.map((e) => {
    const o = (e ?? {}) as Record<string, unknown>;
    return {
      event: String(o.event ?? o.type ?? '').trim().toLowerCase().replace(/\s+/g, '_'),
      email: String(o.email ?? '').trim().toLowerCase(),
      messageId: (o['message-id'] ?? o.messageId ?? o.message_id ?? null) as string | null,
      reason: (o.reason ?? o.detail ?? null) as string | null,
    };
  }).filter((e) => e.event && e.email);
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);

  // ── Shared-secret auth (header or ?secret= query — Brevo config-dependent) ──
  const SECRET = Deno.env.get('BREVO_WEBHOOK_SECRET') ?? '';
  if (!SECRET) return jsonResponse({ ok: false, error: 'config_missing_secret' }, 503);
  const url = new URL(req.url);
  const sent = req.headers.get('x-brevo-secret') || req.headers.get('x-mailin-custom') || url.searchParams.get('secret') || '';
  if (sent !== SECRET) return jsonResponse({ ok: false, error: 'unauthorized' }, 401);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SERVICE_ROLE) return jsonResponse({ ok: false, error: 'config_missing' }, 503);
  const supabase: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false, autoRefreshToken: false } });

  let body: unknown;
  try { body = await req.json(); } catch { return jsonResponse({ ok: false, error: 'invalid_json' }, 400); }
  const events = normalizeEvents(body);
  if (!events.length) return jsonResponse({ ok: true, processed: 0, note: 'no_events' }, 200);

  const backoffCfg = await readConfigJson<{ backoff_minutes: number[] }>(supabase, 'onboarding_backoff_v1');
  const backoffMin = backoffCfg?.backoff_minutes ?? [15, 60, 240, 720, 1440];

  const results: Array<Record<string, unknown>> = [];

  for (const ev of events) {
    try {
      if (DELIVERED.has(ev.event)) {
        await supabase.from('bbf_email_events').insert({
          event_type: 'welcome_delivered', email: ev.email, message_id: ev.messageId, channel: 'email',
          payload: { kind: 'welcome', brevo_event: ev.event, delivered_at: new Date().toISOString() },
        });
        // Flip pipeline steps.delivered (best-effort; find by user email).
        const { data: u } = await supabase.from('bbf_users').select('id').eq('email', ev.email).maybeSingle();
        if (u?.id) {
          const { data: p } = await supabase.from('bbf_onboarding_pipeline').select('id,steps').eq('user_id', u.id).neq('state', 'activated').order('created_at', { ascending: false }).limit(1).maybeSingle();
          if (p?.id) {
            const priorSteps = (p.steps && typeof p.steps === 'object') ? p.steps as Record<string, unknown> : {};
            await supabase.from('bbf_onboarding_pipeline').update({ steps: { ...priorSteps, delivered: { ok: true, at: new Date().toISOString() } }, updated_at: new Date().toISOString() }).eq('id', p.id);
          }
        }
        results.push({ email: ev.email, event: ev.event, action: 'delivered_recorded' });
        continue;
      }

      if (SOFT.has(ev.event)) {
        // Enqueue/refresh a retry (backoff clock). resend-welcome sweeps these.
        const { data: existing } = await supabase.from('bbf_email_events')
          .select('id,payload,attempts').eq('event_type', 'welcome_send_failed').eq('email', ev.email)
          .filter('payload->>status', 'eq', 'failed').order('ts', { ascending: false }).limit(1).maybeSingle();
        const attempts = (num(existing?.attempts) ?? 0) + 1;
        if (existing?.id) {
          await supabase.from('bbf_email_events').update({
            attempts, next_attempt_at: nextAttemptAt(attempts, backoffMin),
            payload: { ...(existing.payload as Record<string, unknown>), status: 'failed', last_soft_bounce: ev.reason, updated_at: new Date().toISOString() },
          }).eq('id', existing.id);
        } else {
          await supabase.from('bbf_email_events').insert({
            event_type: 'welcome_send_failed', email: ev.email, message_id: ev.messageId, channel: 'email',
            attempts, next_attempt_at: nextAttemptAt(attempts, backoffMin),
            payload: { kind: 'welcome', status: 'failed', reason: `soft_bounce:${ev.reason ?? ''}`, attempts },
          });
        }
        results.push({ email: ev.email, event: ev.event, action: 'retry_enqueued', attempts });
        continue;
      }

      if (HARD.has(ev.event)) {
        const rung = await hardBounceLadder(supabase, ev, backoffMin);
        results.push({ email: ev.email, event: ev.event, ...rung });
        continue;
      }

      // Unhandled event types (open/click/etc.) — record thin telemetry, no action.
      results.push({ email: ev.email, event: ev.event, action: 'ignored' });
    } catch (e) {
      console.error(`[bbf-email-events-webhook] event error (${ev.event} ${ev.email}):`, e instanceof Error ? e.message : String(e));
      results.push({ email: ev.email, event: ev.event, action: 'error', detail: e instanceof Error ? e.message : String(e) });
    }
  }

  const hardCount = results.filter((r) => HARD.has(String(r.event))).length;
  console.log(`[bbf-email-events-webhook] processed=${results.length} hard_bounces=${hardCount}`);
  return jsonResponse({ ok: true, processed: results.length, results }, 200);
});

// ── The hard-bounce ladder (§1.5): alt-email → SMS → escalation ──────────────
async function hardBounceLadder(supabase: SupabaseClient, ev: BrevoEvent, _backoffMin: number[]): Promise<Record<string, unknown>> {
  const bounced = ev.email;

  // Record the hard bounce itself.
  await supabase.from('bbf_email_events').insert({
    event_type: 'welcome_hard_bounce', email: bounced, message_id: ev.messageId, channel: 'email',
    payload: { kind: 'welcome', brevo_event: ev.event, reason: ev.reason, at: new Date().toISOString() },
  });

  // Resolve user + pipeline + intake (by the bounced address, then by user id).
  const { data: user } = await supabase.from('bbf_users').select('*').eq('email', bounced).maybeSingle();
  if (!user?.id) {
    await insertAdminAlert(supabase, { kind: 'hard_bounce', reason: 'unknown_recipient', email: bounced, detail: 'No bbf_users row for the bounced address.' });
    return { action: 'escalated', reason: 'unknown_recipient' };
  }
  const uid = user.uid as string | null;
  const locale = normLocale(user.preferred_locale);
  const tier = (user.current_tier ?? user.metabolic_tier ?? null) as string | null;

  const { data: pipeline } = await supabase.from('bbf_onboarding_pipeline').select('*').eq('user_id', user.id).neq('state', 'activated').order('created_at', { ascending: false }).limit(1).maybeSingle();
  const { data: intake } = await supabase.from('bbf_pathfinder_intakes').select('*').eq('consumed_by_user', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
  const birthYear = num(intake?.birth_year);

  if (!uid) {
    await insertAdminAlert(supabase, { kind: 'hard_bounce', reason: 'no_uid', email: bounced, userId: user.id, pipelineId: pipeline?.id ?? null });
    return { action: 'escalated', reason: 'no_uid' };
  }

  const markDispatched = async (channel: string, detail: Record<string, unknown>) => {
    if (pipeline?.id) {
      const priorSteps = (pipeline.steps && typeof pipeline.steps === 'object') ? pipeline.steps as Record<string, unknown> : {};
      await supabase.from('bbf_onboarding_pipeline').update({
        state: 'credentials_dispatched',
        steps: { ...priorSteps, dispatch: { ok: true, at: new Date().toISOString(), channel } },
        failure_reason: null, state_entered_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq('id', pipeline.id);
    }
    await supabase.from('bbf_email_events').insert({ event_type: 'welcome_resent', email: detail.to as string, channel, payload: { kind: 'welcome', via: channel, username: uid, source: 'hard_bounce_ladder', ...detail } });
  };

  // ── Rung 1 · ALTERNATE EMAIL ──
  const altEmail = [intake?.email as string | undefined, user.email as string | undefined]
    .map((e) => (e ? String(e).trim().toLowerCase() : '')).find((e) => e && e !== bounced);
  if (altEmail) {
    const pin = securePin(birthYear);
    const { error: pinErr } = await supabase.rpc('bbf_service_reissue_pin', { p_uid: uid, p_pin: pin });
    if (!pinErr) {
      const send = await sendCredentialEmail({ email: altEmail, name: user.name as string, username: uid, pin, tier, locale, tag: 'hard-bounce-alt' });
      if (send.ok) {
        await markDispatched('email_alt', { to: altEmail, provider_msg_id: send.providerMsgId ?? null });
        return { action: 'alt_email_sent', to: altEmail };
      }
    }
  }

  // ── Rung 2 · SMS CREDENTIALS ──
  const phone = (intake?.phone ?? null) as string | null;
  if (phone) {
    const pin = securePin(birthYear);
    const { error: pinErr } = await supabase.rpc('bbf_service_reissue_pin', { p_uid: uid, p_pin: pin });
    if (!pinErr) {
      const sms = await sendCredentialSms({ to: phone, username: uid, pin, locale });
      if (sms.ok) {
        await markDispatched('sms', { to: phone, sid: sms.sid ?? null });
        return { action: 'sms_sent', sid: sms.sid ?? null };
      }
      await supabase.from('bbf_email_events').insert({ event_type: 'welcome_send_failed', email: bounced, channel: 'sms', payload: { kind: 'welcome', status: 'failed', reason: `sms:${sms.error}`, username: uid } });
    }
  }

  // ── Rung 3 · HUMAN ESCALATION ──
  if (pipeline?.id) {
    await supabase.from('bbf_onboarding_pipeline').update({
      state: 'delivery_blocked', failure_reason: 'hard_bounce_no_fallback',
      state_entered_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', pipeline.id);
  }
  await insertAdminAlert(supabase, {
    kind: 'delivery_blocked', reason: 'hard_bounce_no_fallback', email: bounced,
    userId: user.id, pipelineId: pipeline?.id ?? null, state: 'delivery_blocked',
    detail: 'Hard bounce with no alternate email and no phone on file — white-glove recovery required.',
  });
  return { action: 'escalated', reason: 'hard_bounce_no_fallback' };
}
