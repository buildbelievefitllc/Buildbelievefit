// bbf-coach-vault — BBF Lab Research Vault (Pillar 1) edge function.
// ─────────────────────────────────────────────────────────────────────────────
// The founder pastes a study abstract / lecture / textbook passage; Claude (via
// the model router) returns a clean, coaching-oriented JSON summary which is
// stored in public.coach_knowledge_base and rendered as a flip "Research Card".
//
// ADMIN-ONLY. Authorization mirrors bbf-command-feed: accept the legacy shared
// secret (X-BBF-Admin-Token === BBF_COACH_AGENT_TOKEN) OR a validated admin
// SESSION token (X-BBF-Session-Token resolved → admin/trainer/akeem). All DB
// access uses the service-role key (the table is RLS-sealed with no policies).
//
// Request:  POST /functions/v1/bbf-coach-vault   { action, ...args }
//   action: 'list'                              → { ok, cards: [...] }
//   action: 'ingest'  { raw_text, category? }   → { ok, card, model, usage }
//   action: 'delete'  { id }                    → { ok, deleted }
// Errors: non-2xx { error: "<slug>", detail?: "..." }.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { routeAndLog } from '../_shared/model-router.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-bbf-admin-token, x-bbf-session-token',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

const CATEGORIES = ['biomechanics', 'bioenergetics', 'nutrition', 'pediatric-athletics'] as const;
const MAX_RAW = 24_000; // cap pasted text so a single call stays bounded
const MAX_TOKENS = 2048;

// ── Auth (copied pattern from bbf-command-feed) ───────────────────────────────
async function uidFromSession(url: string, key: string, session: string): Promise<string | null> {
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  try {
    const r = await fetch(`${url}/rest/v1/rpc/_bbf_uid_from_vault_token`, {
      method: 'POST', headers, body: JSON.stringify({ p_token: session }),
    });
    if (r.ok) {
      const v = await r.json();
      const id = typeof v === 'string' ? v : (Array.isArray(v) && v.length ? v[0] : null);
      if (id) return String(id);
    }
  } catch (_) { /* fall through */ }
  try {
    const nowISO = new Date().toISOString();
    const r = await fetch(
      `${url}/rest/v1/bbf_vault_sessions?select=user_id&token=eq.${encodeURIComponent(session)}` +
      `&expires_at=gt.${encodeURIComponent(nowISO)}&limit=1`,
      { headers },
    );
    if (r.ok) {
      const rows = await r.json();
      const row = Array.isArray(rows) && rows.length ? rows[0] : null;
      return row?.user_id ? String(row.user_id) : null;
    }
  } catch (_) { /* ignore */ }
  return null;
}

async function isAuthorized(req: Request, url: string, key: string, legacyToken: string): Promise<boolean> {
  const token = req.headers.get('x-bbf-admin-token') || '';
  if (legacyToken && token.length > 0 && token === legacyToken) return true;
  const session = req.headers.get('x-bbf-session-token') || '';
  if (!session || !url || !key) return false;
  const userId = await uidFromSession(url, key, session);
  if (!userId) return false;
  try {
    const r = await fetch(
      `${url}/rest/v1/bbf_users?select=uid,role&id=eq.${encodeURIComponent(userId)}&deleted_at=is.null&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    if (!r.ok) return false;
    const rows = await r.json();
    const u = Array.isArray(rows) && rows.length ? rows[0] : null;
    if (!u) return false;
    const role = String(u.role ?? '').toLowerCase();
    const uname = String(u.uid ?? '').toLowerCase();
    return role === 'admin' || role === 'trainer' || uname === 'akeem';
  } catch (_) { return false; }
}

// ── Claude ingestion (structured output) ──────────────────────────────────────
const SYSTEM_PROMPT = [
  'You are an elite Exercise Science professor and Master Strength Coach building the private research vault for Build Believe Fit (head coach: Akeem Brown).',
  'Summarize the supplied research abstract / lecture / textbook passage into a highly actionable, structured format for a coaching database.',
  'Pick the single best category. Write for a working coach: concrete, applied, no hedging or filler.',
  'Return ONLY structured JSON matching the schema. Do not fabricate findings the source does not support; if the source is thin, say so in scientific_pitfalls.',
].join('\n');

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    category: { type: 'string', enum: [...CATEGORIES], description: 'The single best-fit category.' },
    title: { type: 'string', description: 'A concise, specific title for this entry (max ~120 chars).' },
    source_citation: { type: 'string', description: 'Journal / source / date if present, else a best-effort label.' },
    claude_summary: {
      type: 'object',
      properties: {
        physiology_takeaways: {
          type: 'array', items: { type: 'string' },
          description: '2-4 crisp physiological takeaways a coach can internalize.',
        },
        coaching_application: {
          type: 'string',
          description: 'How to apply this in the gym with clients TODAY — concrete cues, loading, or programming moves.',
        },
        scientific_pitfalls: {
          type: 'string',
          description: 'Study limitations / caveats (sample size, population, animal/in-vitro, effect size).',
        },
      },
      required: ['physiology_takeaways', 'coaching_application', 'scientific_pitfalls'],
      additionalProperties: false,
    },
  },
  required: ['category', 'title', 'source_citation', 'claude_summary'],
  additionalProperties: false,
};

function extractTextBlock(content: any[]): string | null {
  if (!Array.isArray(content)) return null;
  for (const block of content) {
    if (block && block.type === 'text' && typeof block.text === 'string' && block.text) return block.text;
  }
  return null;
}

async function summarize(rawText: string, hintCategory: string | null, apiKey: string) {
  const model = routeAndLog('bbf-coach-vault', 'coach_research_ingest');
  const userMessage =
    (hintCategory ? `Preferred category (use only if it fits): ${hintCategory}\n\n` : '') +
    'Summarize the following study material. Return ONLY JSON matching the schema.\n\n```\n' +
    rawText.slice(0, MAX_RAW) + '\n```';

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: RESPONSE_SCHEMA } },
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  let body: any = null;
  try { body = await res.json(); } catch (_) { /* non-JSON */ }
  if (!res.ok) {
    const msg = (body && body.error && (body.error.message || body.error.type)) || `anthropic_${res.status}`;
    return { ok: false as const, status: res.status, error: msg };
  }
  const text = extractTextBlock(body?.content);
  if (!text) return { ok: false as const, status: 502, error: 'no_text_block' };
  let parsed: any;
  try { parsed = JSON.parse(text); } catch (e) { return { ok: false as const, status: 502, error: `parse_failed: ${(e as Error).message}` }; }
  return { ok: true as const, parsed, model: body.model || model, usage: body.usage || null };
}

// ── Handler ───────────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const legacyToken = Deno.env.get('BBF_COACH_AGENT_TOKEN') || '';

  if (!(await isAuthorized(req, SUPABASE_URL, SERVICE_KEY, legacyToken))) {
    console.warn('[bbf-coach-vault] auth rejected (no valid admin token or session)');
    return jsonResponse({ error: 'unauthorized' }, 401);
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return jsonResponse({ error: 'config_missing_supabase' }, 503);
  }

  let payload: any;
  try { payload = await req.json(); } catch (_) { return jsonResponse({ error: 'invalid_json' }, 400); }
  const action = String(payload?.action || '').toLowerCase();

  const supa = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

  // ── list ──
  if (action === 'list') {
    const { data, error } = await supa
      .from('coach_knowledge_base')
      .select('id, category, title, source_citation, claude_summary, model, created_at')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) return jsonResponse({ error: 'list_failed', detail: error.message }, 500);
    return jsonResponse({ ok: true, cards: data ?? [] }, 200);
  }

  // ── delete ──
  if (action === 'delete') {
    const id = String(payload?.id || '').trim();
    if (!id) return jsonResponse({ error: 'missing_id' }, 400);
    const { error } = await supa.from('coach_knowledge_base').delete().eq('id', id);
    if (error) return jsonResponse({ error: 'delete_failed', detail: error.message }, 500);
    return jsonResponse({ ok: true, deleted: id }, 200);
  }

  // ── ingest ──
  if (action === 'ingest') {
    const rawText = String(payload?.raw_text || '').trim();
    if (rawText.length < 40) {
      return jsonResponse({ error: 'text_too_short', detail: 'Paste at least a full abstract (~40+ chars).' }, 400);
    }
    const hintCategory = CATEGORIES.includes(String(payload?.category)) ? String(payload.category) : null;

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) return jsonResponse({ error: 'config_missing_anthropic_key' }, 503);

    const t0 = Date.now();
    const result = await summarize(rawText, hintCategory, ANTHROPIC_API_KEY);
    if (!result.ok) {
      return jsonResponse({ error: 'summarize_failed', detail: result.error, status: result.status }, 502);
    }

    const p = result.parsed;
    const row = {
      category: CATEGORIES.includes(p?.category) ? p.category : (hintCategory || 'biomechanics'),
      title: String(p?.title || 'Untitled study').slice(0, 255),
      source_citation: p?.source_citation ? String(p.source_citation) : null,
      original_abstract: rawText.slice(0, MAX_RAW),
      claude_summary: p?.claude_summary ?? {},
      model: result.model,
    };
    const { data, error } = await supa.from('coach_knowledge_base').insert(row).select(
      'id, category, title, source_citation, claude_summary, model, created_at',
    ).single();
    if (error) return jsonResponse({ error: 'insert_failed', detail: error.message }, 500);

    console.log(`[bbf-coach-vault] ingested · category=${row.category} · model=${result.model} · ${Date.now() - t0}ms`);
    return jsonResponse({ ok: true, card: data, model: result.model, usage: result.usage }, 200);
  }

  return jsonResponse({ error: 'unknown_action', detail: "action must be 'list' | 'ingest' | 'delete'." }, 400);
});
