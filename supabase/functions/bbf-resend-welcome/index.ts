// ═══════════════════════════════════════════════════════════════════════════
// bbf-resend-welcome — Credential-dispatch RECOVERY worker (Phase 2 safety net)
// ───────────────────────────────────────────────────────────────────────────
// Closes the only silent-failure leak in the onboarding pipeline: a paid buyer
// whose welcome email (username + PIN) never went out. The Stripe webhook now
// records such failures in bbf_email_events (event_type='welcome_send_failed',
// payload.status='failed'); this worker sweeps them, RE-ISSUES a fresh PIN (the
// original is unrecoverable — bcrypt-only) via bbf_service_reissue_pin, RESENDS
// the credentials email, and marks the record resolved.
//
// DUAL AUTH (no browser exposure):
//   • X-BBF-Admin-Token === BBF_COACH_AGENT_TOKEN   (manual admin run)
//   • X-Cron-Secret      === CRON_SECRET            (scheduled pg_cron sweep)
// Either one authorizes; otherwise 401. Deploy with --no-verify-jwt (the shared
// secret is the boundary, mirroring bbf-sentinel / bbf-admin-roster).
//
// POST body (all optional): { limit?=25, dry_run?=false }
// → { ok, scanned, resent, failed, skipped, dry_run, results:[...] }
//
// SAFETY: read/writes are best-effort per row; one bad row never aborts the
// sweep. A row is only marked 'resolved' AFTER a 2xx Brevo send, so a failure
// stays pending and the next sweep retries it (never strands a customer).
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-bbf-admin-token, x-cron-secret',
};
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}
function escapeHtml(input: unknown): string {
  return String(input ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function normLocale(input: unknown): 'en' | 'es' | 'pt' {
  const t = String(input ?? '').trim().toLowerCase();
  if (t === 'es' || t.startsWith('es') || t.startsWith('span')) return 'es';
  if (t === 'pt' || t.startsWith('pt') || t.startsWith('por') || t.includes('bras') || t.includes('braz') || t === 'br') return 'pt';
  return 'en';
}
function generatePin(): string { return String(100000 + Math.floor(Math.random() * 900000)); }

const LOGIN_URL = 'https://buildbelievefit.fitness/bbf-app.html';

// Trilingual inline fallback (used only when the Brevo template ids aren't set) —
// so an ES/PT customer's recovery email isn't English-only.
function inlineEmail(locale: 'en' | 'es' | 'pt', username: string, pin: string) {
  if (locale === 'es') return {
    subject: 'Tu acceso a Build Believe Fit — credenciales reenviadas',
    html: `<p>Bienvenido a Build Believe Fit.</p><p>Tu usuario es <b>${escapeHtml(username)}</b> y tu nuevo PIN es <b>${pin}</b>.</p><p>Inicia sesión en <a href="${LOGIN_URL}">el Vault</a>.</p>`,
  };
  if (locale === 'pt') return {
    subject: 'Seu acesso ao Build Believe Fit — credenciais reenviadas',
    html: `<p>Bem-vindo ao Build Believe Fit.</p><p>Seu usuário é <b>${escapeHtml(username)}</b> e seu novo PIN é <b>${pin}</b>.</p><p>Acesse <a href="${LOGIN_URL}">o Vault</a>.</p>`,
  };
  return {
    subject: 'Your Build Believe Fit access — credentials re-issued',
    html: `<p>Welcome to Build Believe Fit.</p><p>Your login is <b>${escapeHtml(username)}</b> and your new PIN is <b>${pin}</b>.</p><p>Log in at <a href="${LOGIN_URL}">the Vault</a>.</p>`,
  };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);

  // ── Dual auth: admin shared-secret OR cron secret ──
  const ADMIN_TOKEN = Deno.env.get('BBF_COACH_AGENT_TOKEN') ?? '';
  const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';
  const adminOk = ADMIN_TOKEN.length > 0 && (req.headers.get('x-bbf-admin-token') ?? '') === ADMIN_TOKEN;
  const cronOk  = CRON_SECRET.length > 0 && (req.headers.get('x-cron-secret') ?? '') === CRON_SECRET;
  if (!adminOk && !cronOk) return jsonResponse({ ok: false, error: 'unauthorized' }, 401);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SERVICE_ROLE) return jsonResponse({ ok: false, error: 'config_missing' }, 503);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* defaults */ }
  const limit = Math.min(Math.max(Number(body.limit) || 25, 1), 100);
  const dryRun = body.dry_run === true;

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false, autoRefreshToken: false } });

  const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY');
  const fromEmail = Deno.env.get('BREVO_FROM_EMAIL') || 'buildbelievefitllc@buildbelievefit.fitness';
  const fromName  = Deno.env.get('BREVO_FROM_NAME') || 'Build Believe Fit';

  // Pending = recorded welcome failures not yet resolved (oldest first).
  const { data: pending, error: qErr } = await supabase
    .from('bbf_email_events')
    .select('id,email,message_id,payload,ts')
    .eq('event_type', 'welcome_send_failed')
    .filter('payload->>status', 'eq', 'failed')
    .order('ts', { ascending: true })
    .limit(limit);
  if (qErr) return jsonResponse({ ok: false, error: 'query_failed', detail: qErr.message }, 500);

  const results: Array<Record<string, unknown>> = [];
  let resent = 0, failed = 0, skipped = 0;

  for (const row of (pending ?? [])) {
    const payload: Record<string, unknown> = (row.payload as Record<string, unknown>) || {};
    const email = row.email as string | null;
    let username = (payload.username as string | null) || null;
    let locale = normLocale(payload.locale);
    const tier = (payload.tier as string | null) || null;

    // Backfill username / locale from the user row if the failure payload lacked it.
    if (!username && email) {
      const { data: u } = await supabase.from('bbf_users').select('uid,preferred_locale').eq('email', email).maybeSingle();
      if (u) { username = u.uid as string; if (!payload.locale && u.preferred_locale) locale = normLocale(u.preferred_locale); }
    }
    if (!username || !email) {
      skipped++; results.push({ id: row.id, email, status: 'skipped', reason: 'no_username' }); continue;
    }
    if (dryRun) { results.push({ id: row.id, email, username, status: 'would_resend' }); continue; }

    const attempts = (Number(payload.attempts) || 1) + 1;

    // 1) Re-issue a fresh PIN (service-role gated; original is bcrypt-only/lost).
    const newPin = generatePin();
    const { error: pinErr } = await supabase.rpc('bbf_service_reissue_pin', { p_uid: username, p_pin: newPin });
    if (pinErr) {
      failed++;
      await supabase.from('bbf_email_events').update({ payload: { ...payload, attempts, last_error: `reissue:${pinErr.message}` } }).eq('id', row.id);
      results.push({ id: row.id, email, username, status: 'reissue_failed', detail: pinErr.message });
      continue;
    }

    // 2) Resend the credentials email (Brevo template, else trilingual inline).
    let sent = false, sendErr = '';
    if (BREVO_API_KEY) {
      try {
        const tplRaw = { en: Deno.env.get('BREVO_WELCOME_TEMPLATE_EN'), es: Deno.env.get('BREVO_WELCOME_TEMPLATE_ES'), pt: Deno.env.get('BREVO_WELCOME_TEMPLATE_PT') }[locale]
          || Deno.env.get('BREVO_WELCOME_TEMPLATE_EN');
        const templateId = tplRaw ? Number(tplRaw) : null;
        const base = { sender: { name: fromName, email: fromEmail }, to: [{ email }], tags: ['resend-welcome', `tier:${tier ?? 'unknown'}`, `locale:${locale}`] };
        let mail: Record<string, unknown>;
        if (templateId && Number.isFinite(templateId)) {
          mail = { ...base, templateId, params: { FIRSTNAME: username, USERNAME: username, PIN: newPin, TIER: tier ?? '', LANGUAGE: locale } };
        } else {
          const { subject, html } = inlineEmail(locale, username, newPin);
          mail = { ...base, subject, htmlContent: html };
        }
        const r = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'api-key': BREVO_API_KEY, accept: 'application/json' },
          body: JSON.stringify(mail),
        });
        sent = r.ok;
        if (!r.ok) sendErr = `brevo_${r.status}`;
      } catch (e) { sendErr = e instanceof Error ? e.message : String(e); }
    } else {
      sendErr = 'brevo_key_missing';
    }

    if (sent) {
      resent++;
      // Resolve the failure + append an audit row (append-only flight recorder).
      await supabase.from('bbf_email_events').update({ payload: { ...payload, status: 'resolved', resolved_at: new Date().toISOString(), attempts, resent: true } }).eq('id', row.id);
      await supabase.from('bbf_email_events').insert({ event_type: 'welcome_resent', email, message_id: row.message_id, payload: { kind: 'welcome', username, tier, locale, source_event: row.id, resent_at: new Date().toISOString() } });
      results.push({ id: row.id, email, username, status: 'resent' });
    } else {
      // PIN was reset but the email still didn't send — leave PENDING (status
      // stays 'failed') so the next sweep retries; never mark resolved on a miss.
      failed++;
      await supabase.from('bbf_email_events').update({ payload: { ...payload, attempts, last_error: `send:${sendErr}` } }).eq('id', row.id);
      results.push({ id: row.id, email, username, status: 'send_failed', detail: sendErr });
    }
  }

  console.log(`[bbf-resend-welcome] scanned=${(pending ?? []).length} resent=${resent} failed=${failed} skipped=${skipped} dry_run=${dryRun}`);
  return jsonResponse({ ok: true, scanned: (pending ?? []).length, resent, failed, skipped, dry_run: dryRun, results });
});
