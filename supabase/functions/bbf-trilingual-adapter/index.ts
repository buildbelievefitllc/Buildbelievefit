// supabase/functions/bbf-trilingual-adapter/index.ts
// ═══════════════════════════════════════════════════════════════════════════
// TRILINGUAL CONTENT ADAPTER — EN hooks → culturally adapted ES/PT drafts,
// staged straight into the content queue Studio V4 and the Distribution
// Calendar already read (bbf_content_manager_queue, status='draft').
//
//   POST { hooks: [{ hook, caption?, series?, format?, hashtags? }],
//          languages?: ['es','pt'] }   · cap MAX_HOOKS per call
//
// One Haiku call per hook (trilingual_content_adapt · §4 — i18n parity tier)
// produces BOTH adaptations: cultural adaptation, not literal translation —
// the idiom, energy, and hook mechanics of LatAm Spanish / Brazilian
// Portuguese fitness content, with the localeDirective's proprietary-name
// locklist enforced. Drafts land as status='draft' rows (language es/pt,
// source_ref='trilingual-adapter') — founder curation still owns publishing.
//
// Auth: admin token or admin session token. Spend-gated, telemetry-logged,
// 202 + background (gateway idle limit).
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { routeAndLog } from '../_shared/model-router.ts';
import { checkSpendGate, spendLimitResponse } from '../_shared/spend-gate.ts';
import { logLlmCall } from '../_shared/llm-telemetry.ts';
import { PROPRIETARY_TERMS } from '../_shared/locale.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-bbf-admin-token, x-bbf-session-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

const MAX_HOOKS = 6;
const VALID_LANGS = new Set(['es', 'pt']);

const ADAPT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    adaptations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          language: { type: 'string', description: '"es" or "pt"' },
          hook: { type: 'string', description: 'The culturally adapted hook — punchy, native idiom, same emotional mechanic' },
          caption: { type: 'string', description: 'Adapted caption (empty string if no source caption)' },
          hashtags: { type: 'string', description: 'Space-separated hashtags natural to that market (mix adapted + source tags)' },
        },
        required: ['language', 'hook', 'caption', 'hashtags'],
      },
    },
  },
  required: ['adaptations'],
} as const;

const SYSTEM_PROMPT = [
  'You adapt Build Believe Fit\'s English social-media hooks for the Latin-American Spanish and Brazilian Portuguese fitness markets.',
  'This is CULTURAL ADAPTATION, not translation: keep the hook\'s emotional mechanic (curiosity gap, challenge, proof, urgency) but rebuild it in the native idiom real fitness creators use in that market. Rhythm and punch over literal fidelity.',
  'Rules:',
  `- These proprietary names stay VERBATIM, never translated: ${PROPRIETARY_TERMS.join(', ')}.`,
  '- es = neutral Latin-American Spanish; pt = Brazilian Portuguese. Correct diacritics always.',
  '- Hooks stay SHORT (under ~90 chars where the source allows). No hashtags inside the hook.',
  '- hashtags: 3-6 tags natural to that market\'s fitness scene.',
  '- Return one adaptation per requested language, nothing else.',
].join('\n');

async function isCoachAuthorized(req: Request, supabase: any): Promise<boolean> {
  const ADMIN_TOKEN = Deno.env.get('BBF_COACH_AGENT_TOKEN') ?? '';
  const token = req.headers.get('x-bbf-admin-token') ?? '';
  if (ADMIN_TOKEN && token.length > 0 && token === ADMIN_TOKEN) return true;
  const session = req.headers.get('x-bbf-session-token') ?? '';
  if (!session) return false;
  const { data: srow } = await supabase
    .from('bbf_vault_sessions').select('user_id')
    .eq('token', session).gt('expires_at', new Date().toISOString()).limit(1).maybeSingle();
  if (!srow?.user_id) return false;
  const { data: u } = await supabase
    .from('bbf_users').select('uid, role').eq('id', srow.user_id).is('deleted_at', null).maybeSingle();
  if (!u) return false;
  const role = String(u.role ?? '').toLowerCase();
  return role === 'admin' || role === 'trainer' || String(u.uid ?? '').toLowerCase() === 'akeem';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  if (!SUPABASE_URL || !SERVICE_KEY || !ANTHROPIC_API_KEY) return jsonResponse({ error: 'backend_unconfigured' }, 503);
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

  if (!(await isCoachAuthorized(req, supabase))) return jsonResponse({ error: 'unauthorized' }, 401);

  let body: any;
  try { body = await req.json(); } catch { return jsonResponse({ error: 'bad_json' }, 400); }

  const hooks = (Array.isArray(body?.hooks) ? body.hooks : [])
    .map((h: any) => ({
      hook: String(h?.hook ?? '').trim().slice(0, 300),
      caption: String(h?.caption ?? '').trim().slice(0, 1000),
      series: String(h?.series ?? 'studio-v4').slice(0, 60),
      format: String(h?.format ?? 'reel').slice(0, 40),
      hashtags: String(h?.hashtags ?? '').slice(0, 300),
    }))
    .filter((h: any) => h.hook);
  if (!hooks.length) return jsonResponse({ error: 'missing_hooks' }, 400);
  if (hooks.length > MAX_HOOKS) return jsonResponse({ error: 'too_many_hooks', max: MAX_HOOKS }, 400);
  const languages = (Array.isArray(body?.languages) ? body.languages : ['es', 'pt'])
    .map((l: any) => String(l).toLowerCase()).filter((l: string) => VALID_LANGS.has(l));
  if (!languages.length) return jsonResponse({ error: 'invalid_languages' }, 400);

  const gate = await checkSpendGate(SUPABASE_URL, SERVICE_KEY);
  if (gate.stopped) return spendLimitResponse(gate);

  const model = routeAndLog('bbf-trilingual-adapter', 'trilingual_content_adapt');
  const batchId = crypto.randomUUID();

  const runAdapt = async () => {
    let staged = 0, failed = 0;
    for (const h of hooks) {
      const t0 = Date.now();
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model,
          max_tokens: 4000,
          thinking: { type: 'adaptive' },
          output_config: { format: { type: 'json_schema', schema: ADAPT_SCHEMA } },
          system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
          messages: [{
            role: 'user',
            content: [
              `Adapt for languages: ${languages.join(', ')}`,
              `EN hook: ${h.hook}`,
              h.caption ? `EN caption: ${h.caption}` : 'No caption.',
              h.hashtags ? `EN hashtags: ${h.hashtags}` : '',
              'Return the adaptations JSON now.',
            ].filter(Boolean).join('\n'),
          }],
        }),
      });
      const latencyMs = Date.now() - t0;
      let rbody: any = null;
      try { rbody = await res.json(); } catch { /* handled below */ }
      let parsed: any = null;
      if (res.ok) {
        for (const block of (rbody?.content ?? [])) {
          if (block?.type === 'text' && typeof block.text === 'string') {
            try { parsed = JSON.parse(block.text); } catch { parsed = null; }
            break;
          }
        }
      }
      const adaptations = (Array.isArray(parsed?.adaptations) ? parsed.adaptations : [])
        .filter((a: any) => VALID_LANGS.has(String(a?.language)) && String(a?.hook ?? '').trim());
      const ok = adaptations.length > 0;

      await logLlmCall(supabase, {
        agent: 'bbf-trilingual-adapter', model, ok,
        latencyMs, inputTokens: rbody?.usage?.input_tokens ?? null, outputTokens: rbody?.usage?.output_tokens ?? null,
        finishReason: res.ok ? (rbody?.stop_reason ?? null) : null,
        error: ok ? null : (res.ok ? 'parse_failed' : `anthropic_${res.status}`), promptName: 'trilingual_content_adapt',
      });
      if (!ok) { failed++; continue; }

      for (const a of adaptations) {
        const { error: insErr } = await supabase.from('bbf_content_manager_queue').insert({
          series: h.series,
          target_angle: 'trilingual-adaptation',
          hook: String(a.hook).slice(0, 300),
          caption: String(a.caption ?? '').slice(0, 1500),
          hashtags: String(a.hashtags ?? '').slice(0, 300),
          status: 'draft',
          language: String(a.language),
          format: h.format,
          source_ref: `trilingual-adapter:${batchId}`,
        });
        if (insErr) { failed++; console.error(`[bbf-trilingual-adapter] insert failed: ${insErr.message.slice(0, 160)}`); }
        else staged++;
      }
    }
    console.log(`[bbf-trilingual-adapter] batch=${batchId} staged=${staged} failed=${failed}`);
  };

  const rt = (globalThis as any).EdgeRuntime;
  if (rt?.waitUntil) rt.waitUntil(runAdapt());
  else runAdapt();
  return jsonResponse({ ok: true, accepted: true, batch_id: batchId, hooks: hooks.length, languages, model }, 202);
});
