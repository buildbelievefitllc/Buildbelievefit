// ═══════════════════════════════════════════════════════════════════════════
// _shared/onboarding-core.ts — shared primitives for the Onboarding State Machine
// ───────────────────────────────────────────────────────────────────────────
// Single source of truth for the pieces that MUST stay identical across the four
// onboarding edge functions (orchestrator · email-events-webhook · resend-welcome ·
// sweeper): the hardened PIN generator + reject list, the readiness gate check, the
// Brevo / Twilio credential transports, the backoff schedule, and admin alerting.
//
// No model-router, no TTS — the onboarding pipeline is pure deterministic
// orchestration (blueprint §2.1). Every DB write here is service-role.
// ═══════════════════════════════════════════════════════════════════════════

// The supabase-js client is passed in untyped (matches the codebase convention);
// we only need `.from()` / `.rpc()` which are stable across the v2 client.
// deno-lint-ignore no-explicit-any
export type SupabaseClient = any;

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, apikey, content-type, x-bbf-admin-token, x-cron-secret, x-brevo-secret, x-mailin-custom',
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

export function escapeHtml(input: unknown): string {
  return String(input ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Normalize any locale hint → one of BBF's three. Mirrors stripe-webhook normLocale().
export function normLocale(input: unknown): 'en' | 'es' | 'pt' {
  const t = String(input ?? '').trim().toLowerCase();
  if (t === 'es' || t.startsWith('es-') || t.startsWith('es_') || t.startsWith('span') || t.startsWith('esp')) return 'es';
  if (t === 'pt' || t.startsWith('pt-') || t.startsWith('pt_') || t.startsWith('port') || t.startsWith('por') || t.includes('bras') || t.includes('braz') || t === 'br') return 'pt';
  return 'en';
}

export const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// ── Date helpers (UTC, YYYY-MM-DD) ───────────────────────────────────────────
export function ymd(d: Date): string { return d.toISOString().slice(0, 10); }
export function todayUTC(): string { return ymd(new Date()); }
export function addDaysUTC(base: string, days: number): string {
  const d = new Date(`${base}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return ymd(d);
}

// ── Hardened PIN generation (blueprint §1.3) ─────────────────────────────────
// crypto random, 6 digits (100000–999999, no leading zero — consistent with the
// live generatePin). REJECT-AND-REDRAW: all-same, straight runs (123456/654321),
// yyyy-like leading years, or the user's birth_year embedded.
function cryptoRandInt(minInclusive: number, maxInclusive: number): number {
  const range = maxInclusive - minInclusive + 1;
  const maxUnbiased = Math.floor(0xFFFFFFFF / range) * range; // reject-sample away modulo bias
  const buf = new Uint32Array(1);
  let x = 0;
  do { crypto.getRandomValues(buf); x = buf[0]; } while (x >= maxUnbiased);
  return minInclusive + (x % range);
}
function isStraightRun(pin: string): boolean {
  let up = true, down = true;
  for (let i = 1; i < pin.length; i++) {
    const delta = pin.charCodeAt(i) - pin.charCodeAt(i - 1);
    if (delta !== 1) up = false;
    if (delta !== -1) down = false;
  }
  return up || down;
}
export function securePin(birthYear?: number | null): string {
  const by = birthYear && Number.isFinite(birthYear) ? String(Math.trunc(birthYear)) : null;
  for (let i = 0; i < 100; i++) {
    const pin = String(cryptoRandInt(100000, 999999));
    if (/^(\d)\1{5}$/.test(pin)) continue;      // all-same (111111)
    if (isStraightRun(pin)) continue;            // 123456 / 654321
    if (/^(19|20)\d{2}/.test(pin)) continue;     // leading yyyy-like (19xx/20xx)
    if (by && pin.includes(by)) continue;        // embeds the user's birth year
    return pin;
  }
  return String(cryptoRandInt(100000, 999999));  // fallback (the reject set is tiny)
}

// ── Config reader (bbf_app_config · JSON-in-TEXT) ────────────────────────────
export async function readConfigJson<T = Record<string, unknown>>(
  supabase: SupabaseClient, key: string,
): Promise<T | null> {
  try {
    const { data, error } = await supabase.from('bbf_app_config').select('value').eq('key', key).maybeSingle();
    if (error || !data?.value) return null;
    return JSON.parse(data.value as string) as T;
  } catch (_e) {
    return null;
  }
}

// ── Backoff schedule (onboarding_backoff_v1) ─────────────────────────────────
export const DEFAULT_BACKOFF_MIN = [15, 60, 240, 720, 1440]; // 15m · 1h · 4h · 12h · 24h
// next_attempt_at for a dispatch that has just recorded `attempts` failures.
// attempts=1 → +15m, 2 → +1h, … capped at the last rung.
export function nextAttemptAt(attempts: number, backoffMin: number[] = DEFAULT_BACKOFF_MIN): string {
  const idx = Math.min(Math.max(attempts, 1), backoffMin.length) - 1;
  const mins = backoffMin[idx] ?? backoffMin[backoffMin.length - 1];
  return new Date(Date.now() + mins * 60_000).toISOString();
}

// ── Brevo credential email (trilingual template + inline fallback) ───────────
const LOGIN_URL = 'https://buildbelievefit.fitness/bbf-app.html';
function inlineCredentialEmail(locale: 'en' | 'es' | 'pt', username: string, pin: string) {
  if (locale === 'es') return {
    subject: 'Tu acceso a Build Believe Fit — credenciales',
    html: `<p>Bienvenido a Build Believe Fit.</p><p>Tu usuario es <b>${escapeHtml(username)}</b> y tu PIN es <b>${escapeHtml(pin)}</b>.</p><p>Inicia sesión en <a href="${LOGIN_URL}">el Vault</a>.</p>`,
  };
  if (locale === 'pt') return {
    subject: 'Seu acesso ao Build Believe Fit — credenciais',
    html: `<p>Bem-vindo ao Build Believe Fit.</p><p>Seu usuário é <b>${escapeHtml(username)}</b> e seu PIN é <b>${escapeHtml(pin)}</b>.</p><p>Acesse <a href="${LOGIN_URL}">o Vault</a>.</p>`,
  };
  return {
    subject: 'Your Build Believe Fit access — credentials',
    html: `<p>Welcome to Build Believe Fit.</p><p>Your login is <b>${escapeHtml(username)}</b> and your PIN is <b>${escapeHtml(pin)}</b>.</p><p>Log in at <a href="${LOGIN_URL}">the Vault</a>.</p>`,
  };
}

export interface SendResult { ok: boolean; status: number; error?: string; providerMsgId?: string; }

// Sends the credential email to `email` (may be an alternate address). Returns the
// Brevo messageId for the bounce-join ledger. Never throws — returns {ok:false,...}.
export async function sendCredentialEmail(opts: {
  email: string; name?: string | null; username: string; pin: string; tier?: string | null;
  locale: 'en' | 'es' | 'pt'; tag: string;
}): Promise<SendResult> {
  const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY');
  const fromEmail = Deno.env.get('BREVO_FROM_EMAIL') || 'buildbelievefitllc@buildbelievefit.fitness';
  const fromName = Deno.env.get('BREVO_FROM_NAME') || 'Build Believe Fit';
  if (!BREVO_API_KEY) return { ok: false, status: 0, error: 'brevo_key_missing' };

  const tplRaw = ({
    en: Deno.env.get('BREVO_WELCOME_TEMPLATE_EN'),
    es: Deno.env.get('BREVO_WELCOME_TEMPLATE_ES'),
    pt: Deno.env.get('BREVO_WELCOME_TEMPLATE_PT'),
  } as Record<string, string | undefined>)[opts.locale] || Deno.env.get('BREVO_WELCOME_TEMPLATE_EN');
  const templateId = tplRaw ? Number(tplRaw) : null;

  const base = {
    sender: { name: fromName, email: fromEmail },
    to: [{ email: opts.email, name: opts.name || opts.username }],
    tags: [opts.tag, `tier:${opts.tier ?? 'unknown'}`, `locale:${opts.locale}`],
  };
  let mail: Record<string, unknown>;
  if (templateId && Number.isFinite(templateId)) {
    mail = { ...base, templateId, params: { FIRSTNAME: opts.name || opts.username, USERNAME: opts.username, PIN: opts.pin, TIER: opts.tier ?? '', LANGUAGE: opts.locale } };
  } else {
    const { subject, html } = inlineCredentialEmail(opts.locale, opts.username, opts.pin);
    mail = { ...base, subject, htmlContent: html };
  }

  try {
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': BREVO_API_KEY, accept: 'application/json' },
      body: JSON.stringify(mail),
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      return { ok: false, status: r.status, error: `brevo_${r.status}:${txt.slice(0, 160)}` };
    }
    let providerMsgId: string | undefined;
    try { const b = await r.json(); providerMsgId = b?.messageId || undefined; } catch { /* Brevo returns json */ }
    return { ok: true, status: r.status, providerMsgId };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

// ── Twilio credential SMS (hard-bounce fallback, blueprint §1.5.2) ───────────
export function normalizePhone(raw: unknown): string {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('+')) return '+' + trimmed.slice(1).replace(/\D/g, '');
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) return '+1' + digits;
  if (digits.length === 11 && digits.startsWith('1')) return '+' + digits;
  return '+' + digits;
}
export function isValidE164(p: string): boolean { return /^\+[1-9]\d{6,14}$/.test(p); }

function credentialSmsBody(locale: 'en' | 'es' | 'pt', username: string, pin: string): string {
  if (locale === 'es') return `Acceso a BBF Vault — usuario: ${username} · PIN: ${pin} · buildbelievefit.fitness`;
  if (locale === 'pt') return `Acesso ao BBF Vault — usuário: ${username} · PIN: ${pin} · buildbelievefit.fitness`;
  return `BBF Vault access — user: ${username} · PIN: ${pin} · buildbelievefit.fitness`;
}

export async function sendCredentialSms(opts: {
  to: string; username: string; pin: string; locale: 'en' | 'es' | 'pt';
}): Promise<{ ok: boolean; sid?: string; error?: string }> {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const token = Deno.env.get('TWILIO_AUTH_TOKEN');
  const from = Deno.env.get('TWILIO_PHONE_NUMBER');
  if (!sid || !token || !from) return { ok: false, error: 'twilio_config_missing' };
  const to = normalizePhone(opts.to);
  if (!isValidE164(to)) return { ok: false, error: `invalid_phone:${opts.to}` };
  try {
    const form = new URLSearchParams();
    form.append('To', to); form.append('From', from); form.append('Body', credentialSmsBody(opts.locale, opts.username, opts.pin));
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${btoa(`${sid}:${token}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    let body: Record<string, unknown> | null = null;
    try { body = await r.json(); } catch { /* twilio always returns json */ }
    if (!r.ok) return { ok: false, error: (body?.message as string) || `twilio_${r.status}` };
    return { ok: true, sid: body?.sid as string | undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ── Admin alert (blueprint §3.4) ─────────────────────────────────────────────
// Durable ledger row the Command Center onboarding board reads; best-effort admin
// email if ONBOARDING_ALERT_EMAIL is set. Never throws.
export async function insertAdminAlert(supabase: SupabaseClient, alert: {
  kind: string; reason: string; pipelineId?: string | null; userId?: string | null;
  email?: string | null; state?: string | null; codes?: string[]; detail?: string | null;
}): Promise<void> {
  try {
    await supabase.from('bbf_email_events').insert({
      event_type: 'onboarding_alert',
      email: alert.email ?? null,
      message_id: alert.pipelineId ?? null,
      channel: 'email',
      payload: {
        kind: alert.kind, reason: alert.reason, pipeline_id: alert.pipelineId ?? null,
        user_id: alert.userId ?? null, state: alert.state ?? null,
        failing_codes: alert.codes ?? [], detail: alert.detail ?? null,
        alerted_at: new Date().toISOString(),
      },
    });
  } catch (e) {
    console.error('[onboarding-core] insertAdminAlert failed:', e instanceof Error ? e.message : String(e));
  }
  // Best-effort admin email (optional).
  const to = Deno.env.get('ONBOARDING_ALERT_EMAIL');
  if (to) {
    try {
      await sendCredentialEmail({
        email: to, name: 'BBF Ops', username: 'onboarding-board', pin: '—', tier: alert.state,
        locale: 'en', tag: 'onboarding-alert',
      }).catch(() => {});
    } catch { /* non-fatal */ }
  }
}

// ── Language entitlement (blueprint §2.1 step 5 — admin/entitled only) ────────
export function languageEntitled(tier?: string | null, role?: string | null): boolean {
  const t = String(tier ?? '').trim().toLowerCase();
  const r = String(role ?? '').trim().toLowerCase();
  return r === 'admin' || r === 'trainer' || t === 'autonomous';
}

// ── The onboarding readiness gate (blueprint §3.2) ───────────────────────────
// Verifies by EXISTENCE OF OUTPUT ROWS, not step self-reports. G1–G7.
export interface GateResult { passed: boolean; failing: string[]; detail: Record<string, unknown>; }
export async function onboardingGateCheck(supabase: SupabaseClient, ctx: {
  userId: string; profileId: string | null; locale: 'en' | 'es' | 'pt';
  tier?: string | null; role?: string | null; day?: string;
}): Promise<GateResult> {
  const day = ctx.day || todayUTC();
  const day6 = addDaysUTC(day, 6);
  const failing: string[] = [];
  const detail: Record<string, unknown> = {};

  // G1 · profile + body metrics (body_mass_g NOT NULL)
  let metricsOk = false;
  if (ctx.profileId) {
    const { data: bm } = await supabase.from('athlete_body_metrics')
      .select('body_mass_g').eq('athlete_id', ctx.profileId).not('body_mass_g', 'is', null)
      .order('measured_on', { ascending: false }).limit(1).maybeSingle();
    metricsOk = !!bm?.body_mass_g;
  }
  detail.G1 = metricsOk;
  if (!ctx.profileId || !metricsOk) failing.push('G1');

  // G2 · nutrition contract depth (today AND today+6)
  let nutritionOk = false;
  if (ctx.profileId) {
    const { data: rows } = await supabase.from('athlete_nutrition_targets_daily')
      .select('day').eq('athlete_id', ctx.profileId).in('day', [day, day6]);
    const days = new Set((rows ?? []).map((r: { day: string }) => r.day));
    nutritionOk = days.has(day) && days.has(day6);
  }
  detail.G2 = nutritionOk;
  if (!nutritionOk) failing.push('G2');

  // G3 · cardio prescription for today (keyed on user_id)
  const { data: cardio } = await supabase.from('bbf_cardio_prescription')
    .select('id').eq('user_id', ctx.userId).eq('prescribed_for', day).limit(1).maybeSingle();
  detail.G3 = !!cardio?.id;
  if (!cardio?.id) failing.push('G3');

  // G4 · prehab surface: ≥1 queue row OR baseline-matrix flag (no friction → baseline)
  let prehabOk = false;
  if (ctx.profileId) {
    const { data: pq } = await supabase.from('prehab_queue')
      .select('id').eq('athlete_id', ctx.profileId).limit(1).maybeSingle();
    // A profile with no injury/friction rows renders the default baseline matrix —
    // that IS a valid prehab surface, so G4 passes on baseline too.
    const { data: inj } = await supabase.from('athlete_injury_history')
      .select('id').eq('athlete_id', ctx.profileId).limit(1).maybeSingle();
    prehabOk = !!pq?.id || !inj?.id; // queued rows, OR clean history → baseline matrix
  }
  detail.G4 = prehabOk;
  if (!ctx.profileId || !prehabOk) failing.push('G4');

  // G5 · sovereign brief playlist for today in the preferred locale
  let briefOk = false;
  if (ctx.profileId) {
    const { data: pl } = await supabase.from('sovereign_brief_playlists')
      .select('id').eq('athlete_id', ctx.profileId).eq('day', day).eq('locale', ctx.locale).limit(1).maybeSingle();
    briefOk = !!pl?.id;
  }
  detail.G5 = briefOk;
  if (!briefOk) failing.push('G5');

  // G6 · language profile IF entitled, else auto-pass
  const entitled = languageEntitled(ctx.tier, ctx.role);
  if (entitled) {
    const { data: lp } = await supabase.from('bbf_language_profiles')
      .select('id').eq('athlete_id', ctx.userId).limit(1).maybeSingle();
    detail.G6 = !!lp?.id;
    if (!lp?.id) failing.push('G6');
  } else {
    detail.G6 = 'auto_pass_not_entitled';
  }

  // G7 · credentials + tier + locale set on the user
  const { data: u } = await supabase.from('bbf_users')
    .select('pin_hash, current_tier, metabolic_tier, preferred_locale').eq('id', ctx.userId).maybeSingle();
  const g7 = !!u?.pin_hash && !!(u?.current_tier || u?.metabolic_tier || ctx.tier) && !!(u?.preferred_locale || ctx.locale);
  detail.G7 = g7;
  if (!g7) failing.push('G7');

  return { passed: failing.length === 0, failing, detail };
}
