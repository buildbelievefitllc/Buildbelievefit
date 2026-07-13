// ═══════════════════════════════════════════════════════════════════════════
// bbf-forgot-pin — self-service PIN recovery for the Login gate
// ───────────────────────────────────────────────────────────────────────────
// Public (anon-callable, no admin token). Client submits { username, email,
// locale? }. If uid+email match an active bbf_users row, mints a fresh
// hardened PIN (same generator/reject-list as onboarding), reissues it via
// bbf_service_reissue_pin (bcrypt-only persistence — mirrors bbf-resend-welcome),
// emails it to the address on file, and logs an admin-visible alert so the
// coach sees every self-service reset land in bbf_email_events.
//
// Anti-enumeration: the response is IDENTICAL whether or not the account/email
// match — callers can never tell from the reply. Rate-limited per submitted
// username AND per client IP via bbf_pin_attempts (same table the PIN-login
// lockout uses), so the endpoint can't be used to spam-probe emails or hammer
// Brevo sends.
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import {
  CORS, jsonResponse, normLocale, securePin, sendCredentialEmail, insertAdminAlert,
  type SupabaseClient,
} from '../_shared/onboarding-core.ts';

const GENERIC_OK = {
  ok: true,
  message: "If that account exists, we've sent a new PIN to the email on file.",
};

const MAX_ATTEMPTS = 3;
const WINDOW_MINUTES = 60;
const LOCK_MINUTES = 30;

// Non-atomic check-then-act throttle against bbf_pin_attempts — acceptable for
// a low-QPS recovery endpoint (mirrors the read-then-upsert shape already used
// for PIN-login lockouts, just done client-side instead of in one SQL RPC).
async function gateRateLimit(supabase: SupabaseClient, key: string): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  const nowMs = Date.now();
  const { data: row } = await supabase.from('bbf_pin_attempts').select('failed_count, window_started_at, locked_until').eq('key', key).maybeSingle();

  if (row?.locked_until && new Date(row.locked_until).getTime() > nowMs) {
    return { allowed: false, retryAfterSeconds: Math.ceil((new Date(row.locked_until).getTime() - nowMs) / 1000) };
  }

  const windowStart = row?.window_started_at ? new Date(row.window_started_at).getTime() : 0;
  const windowExpired = !row || nowMs - windowStart > WINDOW_MINUTES * 60_000;
  const nextCount = windowExpired ? 1 : (row.failed_count ?? 0) + 1;
  const lockedUntil = nextCount >= MAX_ATTEMPTS ? new Date(nowMs + LOCK_MINUTES * 60_000).toISOString() : null;

  await supabase.from('bbf_pin_attempts').upsert({
    key,
    failed_count: nextCount,
    window_started_at: windowExpired ? new Date(nowMs).toISOString() : row.window_started_at,
    locked_until: lockedUntil,
    last_attempt_at: new Date(nowMs).toISOString(),
  });

  if (lockedUntil) return { allowed: false, retryAfterSeconds: LOCK_MINUTES * 60 };
  return { allowed: true };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SERVICE_ROLE) return jsonResponse({ ok: false, error: 'config_missing' }, 503);
  const supabase: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false, autoRefreshToken: false } });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* defaults */ }

  const username = String(body.username ?? '').trim().toLowerCase();
  const email = String(body.email ?? '').trim().toLowerCase();
  const locale = normLocale(body.locale);

  if (!username || !/^[a-z0-9_.-]{2,64}$/.test(username) || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ ok: false, error: 'invalid_input' }, 400);
  }

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';

  // Rate-limit BEFORE the lookup, keyed on the submitted username (not whether
  // it matched) so the throttle response itself leaks nothing about the account.
  const userGate = await gateRateLimit(supabase, `forgot:${username}`);
  if (!userGate.allowed) {
    return jsonResponse({ ok: false, error: 'rate_limited', retry_after_seconds: userGate.retryAfterSeconds }, 429);
  }
  const ipGate = await gateRateLimit(supabase, `forgot_ip:${ip}`);
  if (!ipGate.allowed) {
    return jsonResponse({ ok: false, error: 'rate_limited', retry_after_seconds: ipGate.retryAfterSeconds }, 429);
  }

  const { data: u } = await supabase
    .from('bbf_users')
    .select('id, uid, name, email, preferred_locale, current_tier, metabolic_tier')
    .eq('uid', username)
    .is('deleted_at', null)
    .maybeSingle();

  // Match requires BOTH uid and the email on file — never reveal which part failed.
  if (!u || !u.email || String(u.email).trim().toLowerCase() !== email) {
    return jsonResponse(GENERIC_OK, 200);
  }

  const newPin = securePin();
  const { error: pinErr } = await supabase.rpc('bbf_service_reissue_pin', { p_uid: u.uid, p_pin: newPin });
  if (pinErr) {
    console.error('[bbf-forgot-pin] reissue failed for', u.uid, pinErr.message);
    // Still return the generic reply — an internal failure must not leak account existence either.
    return jsonResponse(GENERIC_OK, 200);
  }

  const effectiveLocale = u.preferred_locale ? normLocale(u.preferred_locale) : locale;
  const send = await sendCredentialEmail({
    email: u.email, name: u.name, username: u.uid, pin: newPin,
    tier: (u.current_tier ?? u.metabolic_tier ?? null) as string | null,
    locale: effectiveLocale, tag: 'forgot-pin-self-service',
  });

  await supabase.from('bbf_email_events').insert({
    event_type: 'forgot_pin_reissued',
    email: u.email,
    channel: 'email',
    payload: { uid: u.uid, user_id: u.id, sent: send.ok, provider_msg_id: send.providerMsgId ?? null, error: send.ok ? null : send.error, ip, source: 'login_forgot_pin' },
  });

  // Durable, admin-visible record — the Command Center reads bbf_email_events
  // (same ledger insertAdminAlert writes to), so every self-reset is auditable.
  await insertAdminAlert(supabase, {
    kind: 'forgot_pin_self_reset', reason: 'user_self_service', userId: String(u.id), email: u.email,
    detail: `${u.uid} reset their own PIN via the Login "Forgot PIN" flow.`,
  });

  return jsonResponse(GENERIC_OK, 200);
});
