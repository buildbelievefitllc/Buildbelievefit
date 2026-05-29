// bbf-science-digest — Weekly exercise-science digest for the AI Studio Science Hub.
// ─────────────────────────────────────────────────────────────────────────────
// Returns a JSON array of { tag, finding, cite } items for the Science Hub UI in
// bbf-app.html (BBF_SCIENCE_HUB).
//
// COST CONTROL (CEO burn-rate order):
//   • Result is CACHED in public.bbf_science_digest (Postgres).
//   • Normal client calls return the cached row — NO LLM call.
//   • Regeneration (Gemini Flash) fires ONLY when: there is no cached row, the
//     cached row is older than 7 days, OR an admin sends force=true with a valid
//     X-BBF-Admin-Token. This prevents an API hit on every client page load.
//
// MODEL: Google Gemini Flash — intentionally NOT the Claude _shared/model-router.
//   Per CEO directive, this low-stakes formatting/digest task runs on Gemini
//   Flash to minimize burn rate. It is the one edge function deliberately outside
//   the Claude routing matrix (see CLAUDE.md §4). All Claude-calling functions
//   still route through model-router.ts.
//
// Request:  POST { scope?: string, max_items?: number, force?: boolean }
//           Authorization: Bearer <anon|user jwt>   (verify_jwt on)
//           X-BBF-Admin-Token: <BBF_COACH_AGENT_TOKEN>   (required only for force)
// Success:  200 { ok:true, items:[{tag,finding,cite}], model, generated_at, cached }
// Errors:   non-2xx { error:"<slug>", detail?:"..." }
//
// Secrets:  GEMINI_API_KEY (required for live refresh)
//           GEMINI_MODEL   (optional, default "gemini-2.5-flash")
//           BBF_COACH_AGENT_TOKEN (admin force gate)
//           SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (auto-injected by runtime)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-bbf-admin-token',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

const TABLE = 'bbf_science_digest';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash';
const MAX_ITEMS_CAP = 10;

// Established-baseline fallback — real, well-documented findings. Served only when
// the cache is empty AND Gemini is unavailable, so the UI is never empty/broken.
const BASELINE = [
  { tag: 'Hypertrophy · Volume', finding: 'Muscle growth follows a dose-response to weekly hard-set volume; ~10+ challenging sets per muscle per week drive more hypertrophy than lower volumes.', cite: 'Schoenfeld, Ogborn & Krieger, 2017 — Journal of Sports Sciences (meta-analysis)' },
  { tag: 'Protein · Intake', finding: 'Resistance-training gains in lean mass are maximized near ~1.6 g protein per kg bodyweight per day; intake beyond this yields little additional benefit for most lifters.', cite: 'Morton et al., 2018 — British Journal of Sports Medicine (meta-analysis)' },
  { tag: 'Training Frequency', finding: 'When weekly volume is equated, training a muscle group at least twice per week tends to produce greater hypertrophy than training it once weekly.', cite: 'Schoenfeld, Ogborn & Krieger, 2016 — Sports Medicine (meta-analysis)' },
  { tag: 'Progressive Overload', finding: 'Adaptation requires progressively increasing mechanical tension over time via load, reps, or total volume.', cite: 'ACSM Position Stand — Progression Models in Resistance Training, Med Sci Sports Exerc' },
];

function isItemArray(x: unknown): boolean {
  return Array.isArray(x) && x.every((it: any) => it && typeof it === 'object' && typeof it.finding === 'string');
}

function sanitize(items: any[], max: number) {
  return items
    .slice(0, max)
    .map((it) => ({
      tag: String(it.tag || 'Evidence').slice(0, 80),
      finding: String(it.finding || '').slice(0, 600),
      cite: it.cite ? String(it.cite).slice(0, 200) : '',
    }))
    .filter((it) => it.finding.length > 0);
}

// ─── PostgREST cache access (service-role; bypasses RLS) ───────────────────────
async function dbReadLatest(url: string, key: string, scope: string) {
  const q = `${url}/rest/v1/${TABLE}?scope=eq.${encodeURIComponent(scope)}` +
    `&select=items,model,generated_at&order=generated_at.desc&limit=1`;
  try {
    const res = await fetch(q, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!res.ok) return null;
    const rows = await res.json();
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  } catch (_) {
    return null;
  }
}

async function dbInsert(url: string, key: string, row: unknown): Promise<boolean> {
  try {
    const res = await fetch(`${url}/rest/v1/${TABLE}`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(row),
    });
    return res.ok;
  } catch (_) {
    return false;
  }
}

// ─── Gemini Flash digest synthesis ─────────────────────────────────────────────
async function callGemini(apiKey: string, model: string, maxItems: number, lang: string) {
  const langName = lang === 'es' ? 'Spanish' : lang === 'pt' ? 'Portuguese' : 'English';
  const sys =
    'You are a sports-science librarian for a clinical fitness platform. ' +
    'Summarize current, well-established findings in resistance-training and exercise ' +
    'science (hypertrophy, strength, protein/nutrition, recovery, injury prevention, ' +
    'training frequency and volume). Report only findings that reflect the weight of ' +
    'peer-reviewed evidence — no fringe claims. Never fabricate a citation: if you are ' +
    'not confident a specific paper is real, attribute generically (e.g. "meta-analytic ' +
    'consensus") instead of inventing a DOI or title.';
  const prompt =
    `Return EXACTLY ${maxItems} items as a JSON array. Each item is an object with ` +
    '"tag" (short topic label, e.g. "Hypertrophy · Volume"), "finding" (one or two ' +
    'plain-language sentences a coach can act on), and "cite" (author/year/journal, or ' +
    '"meta-analytic consensus"). Write the "tag" and "finding" in ' + langName + '; keep ' +
    'author names and journal titles in their original form. Output ONLY the JSON array, no prose.';

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: sys }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, responseMimeType: 'application/json' },
      }),
    });
  } catch (err) {
    return { ok: false, status: 0, error: String((err as Error)?.message || err) };
  }

  const text = await res.text();
  if (!res.ok) return { ok: false, status: res.status, error: text.slice(0, 500) };

  let envelope: any = null;
  try { envelope = JSON.parse(text); } catch (_) { return { ok: false, status: 502, error: 'gemini envelope not JSON' }; }

  const raw = envelope?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  let items: any = null;
  try {
    items = JSON.parse(raw);
  } catch (_) {
    const m = raw.match(/\[[\s\S]*\]/); // recover array if wrapped in a code fence/object
    if (m) { try { items = JSON.parse(m[0]); } catch (_) { /* noop */ } }
  }
  if (!isItemArray(items)) return { ok: false, status: 502, error: 'gemini output not an item array' };
  return { ok: true, items };
}

// ─── Handler ───────────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')    return jsonResponse({ error: 'method_not_allowed' }, 405);

  let payload: any = {};
  try { payload = await req.json(); } catch (_) { payload = {}; }

  const scope = String(payload.scope || 'exercise-science').slice(0, 60);
  const lang = (['en', 'es', 'pt'].indexOf(String(payload.lang)) !== -1) ? String(payload.lang) : 'en';
  const cacheScope = scope + ':' + lang;   // per-language cache key
  const maxItems = Math.max(3, Math.min(MAX_ITEMS_CAP, parseInt(payload.max_items, 10) || 8));
  const wantForce = payload.force === true;

  // Admin gate — required ONLY for a forced refresh. Reads are open to any caller
  // that passed verify_jwt (anon key is sufficient).
  const expectedToken = Deno.env.get('BBF_COACH_AGENT_TOKEN');
  const sentToken = req.headers.get('x-bbf-admin-token') || '';
  const isAdmin = !!expectedToken && sentToken === expectedToken;
  if (wantForce && !isAdmin) {
    return jsonResponse({ error: 'unauthorized', detail: 'force refresh requires a valid X-BBF-Admin-Token.' }, 401);
  }
  const force = wantForce && isAdmin;

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('[bbf-science-digest] missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
    return jsonResponse({ error: 'config_missing_supabase' }, 503);
  }

  // 1) Read the latest cached digest for this scope.
  const cached = await dbReadLatest(SUPABASE_URL, SERVICE_KEY, cacheScope);
  const ageMs = cached ? (Date.now() - new Date(cached.generated_at).getTime()) : Infinity;
  const isFresh = !!cached && ageMs < WEEK_MS;

  // 2) Serve cache unless it is stale or an admin forced a refresh.
  if (isFresh && !force) {
    return jsonResponse({ ok: true, items: cached.items, model: cached.model || DEFAULT_MODEL, generated_at: cached.generated_at, cached: true });
  }

  // 3) Need fresh data → call Gemini Flash (guarded so we never break the UI).
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
  if (!GEMINI_API_KEY) {
    console.warn('[bbf-science-digest] GEMINI_API_KEY not set — serving cache/baseline.');
    if (cached) return jsonResponse({ ok: true, items: cached.items, model: cached.model || 'cache', generated_at: cached.generated_at, cached: true, stale: true });
    return jsonResponse({ ok: true, items: BASELINE, model: 'baseline', generated_at: new Date().toISOString(), cached: false, baseline: true });
  }

  const gen = await callGemini(GEMINI_API_KEY, DEFAULT_MODEL, maxItems, lang);
  if (!gen.ok) {
    console.warn('[bbf-science-digest] gemini failed:', gen.status, gen.error);
    if (cached) return jsonResponse({ ok: true, items: cached.items, model: cached.model || 'cache', generated_at: cached.generated_at, cached: true, stale: true });
    return jsonResponse({ ok: true, items: BASELINE, model: 'baseline', generated_at: new Date().toISOString(), cached: false, baseline: true });
  }

  const items = sanitize(gen.items as any[], maxItems);
  if (items.length === 0) {
    if (cached) return jsonResponse({ ok: true, items: cached.items, model: cached.model || 'cache', generated_at: cached.generated_at, cached: true, stale: true });
    return jsonResponse({ ok: true, items: BASELINE, model: 'baseline', generated_at: new Date().toISOString(), cached: false, baseline: true });
  }

  // 4) Persist the fresh digest (best-effort) and return it.
  const generated_at = new Date().toISOString();
  const wrote = await dbInsert(SUPABASE_URL, SERVICE_KEY, { scope: cacheScope, items, model: DEFAULT_MODEL, generated_at });
  if (!wrote) console.warn('[bbf-science-digest] cache write failed (returning fresh items anyway).');

  return jsonResponse({ ok: true, items, model: DEFAULT_MODEL, generated_at, cached: false });
});
