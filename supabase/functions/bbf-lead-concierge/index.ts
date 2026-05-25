// bbf-lead-concierge · Sovereign Lead Concierge agent
// ──────────────────────────────────────────────────────────────────────────────────
// Daily autonomous re-engagement worker. Pulls pending leads, scores
// each by intake completeness, sends a templated personalized email
// via Brevo, and logs every action to bbf_lead_actions for the
// Command Center to render.
//
// SAFETY POSTURE · belt + suspenders
//   • Hard cap MAX_LEADS_PER_RUN = 50
//   • 14-day per-lead cooldown enforced by querying bbf_lead_actions
//   • Skip leads already provisioned (email in bbf_users)
//   • Skip leads >30d old (cold graveyard)
//   • Skip leads with do_not_contact = true
//   • Templated copy — zero LLM call — deterministic + on-brand
//
// CALL MODES
//   POST /functions/v1/bbf-lead-concierge  { source: 'cron'|'manual' }
//   GET  /functions/v1/bbf-lead-concierge?diag=1   — health probe
//
// RETURNS
//   { ok:true, run_id, processed, sent, skipped:{...}, summary[] }
// All paths return HTTP 200 with { ok:bool, reason? } matching the
// rest of the agentic fleet.
// ──────────────────────────────────────────────────────────────────────────────────

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type',
};
function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

const MAX_LEADS_PER_RUN  = 50;
const COOLDOWN_DAYS      = 14;
const MAX_LEAD_AGE_DAYS  = 30;

// ─── Scoring (intake completeness only · per CEO directive) ───────
function scoreLead(lead) {
  const p = (lead.payload && typeof lead.payload === 'object') ? lead.payload : {};
  let score = 0;
  if (lead.full_name)            score += 10;
  if (lead.phone)                score += 10;
  if (lead.tier || p.tier)       score += 15;
  if (p.age)                     score += 5;
  if (p.sex)                     score += 5;
  if (p.height && p.weight)      score += 10;
  if (p.primary_goal)            score += 15;
  if (p.dietary_profile)         score += 15;
  if (Array.isArray(p.allergens) && p.allergens.length > 0) score += 10;
  if (p.health_notes)            score += 5;
  score = Math.min(100, score);
  const priority = score >= 75 ? 'HOT' : (score >= 45 ? 'WARM' : 'COLD');
  return { score, priority };
}

// ─── Templated email copy · three tiers ───────────────────────
function firstName(full) {
  if (!full) return 'there';
  return String(full).trim().split(/\s+/)[0] || 'there';
}
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function buildEmail(lead, score, priority) {
  const p = (lead.payload && typeof lead.payload === 'object') ? lead.payload : {};
  const name      = firstName(lead.full_name);
  const goal      = p.primary_goal ? esc(p.primary_goal) : null;
  const tier      = lead.tier || p.tier || null;
  const diet      = p.dietary_profile || null;
  const allerg    = Array.isArray(p.allergens) ? p.allergens : [];
  const checkout  = 'https://buildbelievefit.fitness';
  const unsub     = 'mailto:buildbelievefitllc@buildbelievefit.fitness?subject=Unsubscribe%20BBF%20Concierge&body=Please%20remove%20' + encodeURIComponent(lead.email || '') + '%20from%20Build%20Believe%20Fit%20outreach.';
  const sigLine   = '— Akeem Brown, Head Coach · Build Believe Fit';

  let subject, intro, body, cta, template_id;

  if (priority === 'HOT') {
    template_id = 'hot_v1';
    subject = goal
      ? `${name}, your Sovereign Protocol for "${String(p.primary_goal).slice(0,40)}" is ready to deploy`
      : `${name}, your Sovereign Protocol is ready to deploy`;
    intro = `Your Pathfinder intake is locked in. Based on what you shared, you're already operating at the discipline level most clients take weeks to reach.`;
    const goalLine = goal ? `<li><strong>Your stated goal:</strong> ${goal}</li>` : '';
    const tierLine = tier ? `<li><strong>Tier you selected:</strong> ${esc(tier)}</li>` : '';
    const dietLine = diet ? `<li><strong>Dietary profile:</strong> ${esc(diet)}${allerg.length ? ` · avoiding ${allerg.map(esc).join(', ')}` : ''}</li>` : '';
    body = `<p>${intro}</p><p>Here's what we have ready for you the moment you complete checkout:</p><ul>${goalLine}${tierLine}${dietLine}<li><strong>Sovereign Fuel Matrix:</strong> a 7-day meal protocol filtered against your allergens and dietary profile</li><li><strong>Live Coach access:</strong> Julius (form check) and Kelli LaShae (nutrition) ready on demand</li></ul>`;
    cta = `<p style="margin-top:24px"><a href="${checkout}" style="display:inline-block;padding:14px 28px;background:#f5c800;color:#000;text-decoration:none;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;border-radius:6px">Activate My Protocol →</a></p>`;
  } else if (priority === 'WARM') {
    template_id = 'warm_v1';
    subject = goal
      ? `${name}, one step closer to ${String(p.primary_goal).slice(0,40)}`
      : `${name}, one step away from your Build Believe Fit protocol`;
    intro = goal
      ? `You told us your goal was <strong>${goal}</strong>. We've got a clear path to make that real.`
      : `Your Pathfinder intake is on file. We've got a clear path waiting for you.`;
    const tierLine = tier ? `<p>You picked the <strong>${esc(tier)}</strong> tier — it's still held for you. Activation takes about 60 seconds.</p>` : '';
    body = `<p>${intro}</p>${tierLine}<p>Most clients tell us the hardest part was just hitting checkout. The protocol on the other side is built around exactly what you told us — no guesswork.</p>`;
    cta = `<p style="margin-top:24px"><a href="${checkout}" style="display:inline-block;padding:13px 26px;background:#f5c800;color:#000;text-decoration:none;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;border-radius:6px">Finish My Setup →</a></p>`;
  } else {
    template_id = 'cold_v1';
    subject = `${name}, a quick check-in from Build Believe Fit`;
    intro = `We saw you started the Pathfinder a little while back but didn't finish. No pressure — just wanted to make sure nothing slipped through.`;
    body = `<p>${intro}</p><p>If now isn't the right time, that's fine. If you'd like to pick up where you left off, the form remembers most of what you filled in.</p>`;
    cta = `<p style="margin-top:24px"><a href="${checkout}" style="display:inline-block;padding:12px 24px;background:#f5c800;color:#000;text-decoration:none;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;border-radius:6px">Pick Up Where I Left Off →</a></p>`;
  }

  const html = `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:#080808;color:#f9f5ff;margin:0;padding:32px 16px"><div style="max-width:540px;margin:0 auto;background:#0f0f12;border:1px solid #1a1a1a;border-radius:12px;padding:32px 28px"><div style="font-family:'Bebas Neue','Barlow Condensed',sans-serif;font-size:22px;letter-spacing:3px;color:#f5c800;font-weight:900;margin-bottom:8px">BUILD<span style="color:#fff">BELIEVE</span>FIT</div><div style="font-size:11px;letter-spacing:2px;color:rgba(255,255,255,0.5);text-transform:uppercase;margin-bottom:24px">Sovereign Concierge</div>${body}${cta}<p style="margin-top:32px;font-size:14px;color:rgba(255,255,255,0.7)">${sigLine}</p><div style="margin-top:32px;padding-top:16px;border-top:1px solid #1a1a1a;font-size:11px;color:rgba(255,255,255,0.4);line-height:1.6">You're receiving this because you submitted the Build Believe Fit Pathfinder. <a href="${unsub}" style="color:rgba(245,200,0,0.7)">Unsubscribe</a> · Build Believe Fit LLC</div></div></body></html>`;

  return { subject, html, template_id };
}

async function fireBrevoEmail(apiKey, fromName, fromEmail, toEmail, toName, subject, html, tags) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      sender:      { name: fromName, email: fromEmail },
      to:          [{ email: toEmail, name: toName || toEmail }],
      subject,
      htmlContent: html,
      tags:        Array.isArray(tags) ? tags : [],
    }),
  });
  if (!res.ok) {
    let bodyTxt = '';
    try { bodyTxt = await res.text(); } catch (_) {}
    return { ok: false, status: res.status, error: bodyTxt.slice(0, 300) };
  }
  const j = await res.json().catch(() => ({}));
  return { ok: true, status: res.status, message_id: j.messageId || null };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  // Health probe · cheap GET
  if (req.method === 'GET') {
    const url = new URL(req.url);
    if (url.searchParams.get('diag') === '1') {
      return jsonResponse({
        ok: true,
        diag: {
          has_supabase_url:       !!Deno.env.get('SUPABASE_URL'),
          has_service_role_key:   !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
          has_brevo_api_key:      !!Deno.env.get('BREVO_API_KEY'),
          brevo_from_email:       Deno.env.get('BREVO_FROM_EMAIL') || '(default)',
          max_leads_per_run:      MAX_LEADS_PER_RUN,
          cooldown_days:          COOLDOWN_DAYS,
          max_lead_age_days:      MAX_LEAD_AGE_DAYS,
        },
      });
    }
    return jsonResponse({ ok: false, reason: 'method_not_allowed' }, 405);
  }

  if (req.method !== 'POST') return jsonResponse({ ok: false, reason: 'method_not_allowed' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SR_KEY       = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const BREVO_KEY    = Deno.env.get('BREVO_API_KEY');
  const FROM_EMAIL   = Deno.env.get('BREVO_FROM_EMAIL') || 'buildbelievefitllc@buildbelievefit.fitness';
  const FROM_NAME    = Deno.env.get('BREVO_FROM_NAME')  || 'Build Believe Fit';
  if (!SUPABASE_URL || !SR_KEY) return jsonResponse({ ok: false, reason: 'config_missing_supabase' }, 200);
  if (!BREVO_KEY)               return jsonResponse({ ok: false, reason: 'config_missing_brevo' }, 200);

  let body;
  try { body = await req.json(); } catch (_) { body = {}; }
  const source = (body && body.source) || 'manual';

  const run_id = crypto.randomUUID();
  const t0 = Date.now();

  // Helper · PostgREST request with service-role auth
  async function rest(method, path, opts) {
    opts = opts || {};
    const headers = {
      'apikey':        SR_KEY,
      'Authorization': 'Bearer ' + SR_KEY,
      'Content-Type':  'application/json',
      ...(opts.headers || {})
    };
    if (opts.prefer) headers['Prefer'] = opts.prefer;
    const url = SUPABASE_URL + '/rest/v1/' + path;
    const r = await fetch(url, { method, headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
    if (!r.ok) {
      let t = ''; try { t = await r.text(); } catch (_) {}
      throw new Error(`rest ${method} ${path}: HTTP ${r.status} ${t.slice(0,200)}`);
    }
    if (method === 'DELETE' || r.status === 204) return null;
    return await r.json();
  }

  // 1. Pull candidate leads · not too old, not do-not-contact
  const cutoffStaleIso = new Date(Date.now() - MAX_LEAD_AGE_DAYS * 86400000).toISOString();
  let candidates;
  try {
    candidates = await rest('GET',
      `bbf_leads?do_not_contact=is.false&created_at=gte.${encodeURIComponent(cutoffStaleIso)}&order=created_at.desc&limit=${MAX_LEADS_PER_RUN * 3}`);
  } catch (e) {
    console.error('[bbf-lead-concierge] candidate fetch failed:', e.message);
    return jsonResponse({ ok: false, reason: 'candidates_fetch_failed', detail: e.message }, 200);
  }
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return jsonResponse({ ok: true, run_id, processed: 0, sent: 0, skipped: {}, summary: [], note: 'no_candidates', elapsed_ms: Date.now() - t0 });
  }

  // 2. Cross-reference provisioned (bbf_users) AND recent outreach (bbf_lead_actions)
  const emails = Array.from(new Set(candidates.map(l => String(l.email || '').toLowerCase()).filter(Boolean)));
  const provisionedSet = new Set();
  if (emails.length) {
    const inList = emails.map(e => `"${e.replace(/"/g, '\\"')}"`).join(',');
    try {
      const users = await rest('GET', `bbf_users?email=in.(${inList})&select=email`);
      (users || []).forEach(u => { if (u.email) provisionedSet.add(String(u.email).toLowerCase()); });
    } catch (e) { console.warn('[bbf-lead-concierge] bbf_users cross-ref failed (non-fatal):', e.message); }
  }

  const cooldownCutoffIso = new Date(Date.now() - COOLDOWN_DAYS * 86400000).toISOString();
  let recentActions = [];
  try {
    recentActions = await rest('GET',
      `bbf_lead_actions?action_type=eq.email_sent&created_at=gte.${encodeURIComponent(cooldownCutoffIso)}&select=lead_email`);
  } catch (e) { console.warn('[bbf-lead-concierge] cooldown fetch failed (non-fatal):', e.message); }
  const cooldownSet = new Set((recentActions || []).map(a => String(a.lead_email || '').toLowerCase()));

  // 3. Process each candidate · honor caps + skips
  const summary = [];
  const skipped = { cooldown: 0, provisioned: 0, dnc: 0, stale: 0, no_email: 0 };
  let sent = 0, processed = 0;

  for (const lead of candidates) {
    if (sent >= MAX_LEADS_PER_RUN) break;
    const emailLc = String(lead.email || '').toLowerCase();
    if (!emailLc) { skipped.no_email++; continue; }

    let skipReason = null;
    if (lead.do_not_contact)        skipReason = 'skipped_dnc';
    else if (provisionedSet.has(emailLc)) skipReason = 'skipped_provisioned';
    else if (cooldownSet.has(emailLc))    skipReason = 'skipped_cooldown';

    if (skipReason) {
      if (skipReason === 'skipped_cooldown')   skipped.cooldown++;
      if (skipReason === 'skipped_provisioned')skipped.provisioned++;
      if (skipReason === 'skipped_dnc')        skipped.dnc++;
      const { score, priority } = scoreLead(lead);
      try {
        await rest('POST', 'bbf_lead_actions', { body: {
          run_id, lead_id: lead.id, lead_email: lead.email,
          action_type: skipReason, score, priority,
        }});
      } catch (e) { console.warn('[bbf-lead-concierge] skip log failed:', e.message); }
      continue;
    }

    processed++;
    const { score, priority } = scoreLead(lead);
    const { subject, html, template_id } = buildEmail(lead, score, priority);

    const send = await fireBrevoEmail(BREVO_KEY, FROM_NAME, FROM_EMAIL, lead.email, lead.full_name || lead.email, subject, html, ['bbf-concierge', `priority:${priority}`, `template:${template_id}`, `run:${run_id}`]);

    if (send.ok) {
      sent++;
      summary.push({ email: lead.email, name: lead.full_name, score, priority, template_id, message_id: send.message_id });
      try {
        await rest('POST', 'bbf_lead_actions', { body: {
          run_id, lead_id: lead.id, lead_email: lead.email,
          action_type: 'email_sent', score, priority, template_id,
          email_subject: subject, email_body_preview: html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 240),
          brevo_message_id: send.message_id,
        }});
      } catch (e) { console.warn('[bbf-lead-concierge] sent-log write failed:', e.message); }
      console.log(`[bbf-lead-concierge] sent · ${lead.email} · ${priority} (${score}) · ${template_id}`);
    } else {
      summary.push({ email: lead.email, name: lead.full_name, score, priority, template_id, error: send.error });
      try {
        await rest('POST', 'bbf_lead_actions', { body: {
          run_id, lead_id: lead.id, lead_email: lead.email,
          action_type: 'email_failed', score, priority, template_id,
          email_subject: subject, error: 'brevo_' + send.status + ': ' + (send.error || '').slice(0, 200),
        }});
      } catch (e) { console.warn('[bbf-lead-concierge] fail-log write failed:', e.message); }
      console.warn(`[bbf-lead-concierge] FAILED · ${lead.email} · brevo_${send.status} · ${(send.error||'').slice(0,200)}`);
    }
  }

  const elapsed_ms = Date.now() - t0;
  console.log(`[bbf-lead-concierge] run ${run_id} (${source}) · candidates=${candidates.length} · processed=${processed} · sent=${sent} · skipped=${JSON.stringify(skipped)} · elapsed=${elapsed_ms}ms`);
  return jsonResponse({ ok: true, run_id, source, processed, sent, skipped, summary, elapsed_ms });
});
