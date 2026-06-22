// bbf-agentic-concierge — The Self-Serve BBF Lab Concierge (Onboarding Engine)
// First-open welcome agent. Reads the vault session token, resolves the
// member's EXACT access band SERVER-SIDE (Baseline / Autonomous / Apex / Youth
// / All-Access-God) and asks Sonnet to compose a warm, tier-true orientation
// that lists ONLY the features that band has unlocked.
//
// HUB-AWARE (Sports Hub fork): body.hub selects the surface.
//   • hub absent / 'vault' → Sovereign Vault welcome, gated by has_seen_welcome.
//   • hub === 'sports'     → BBF Athlete Portal welcome (sports voice + sports
//                            tool manifest), gated by has_seen_sports_welcome.
// The two gates are independent: a user gets the Vault greeting on first Vault
// open AND the Sports Hub greeting on first Sports Hub open.
//
// NO MIRAGES — never mention a feature outside the band. Enforced twice:
//   1) the system prompt forbids it, and
//   2) a deterministic server-side filter drops any feature key not in the
//      band's unlocked set before it reaches the client.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { localeDirective, localeCode } from '../_shared/locale.ts';
import { resolveEntitlement, FEATURE_ACCESS, GROUP } from '../_shared/entitlement-gate.ts';
import { routeAndLog } from '../_shared/model-router.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-bbf-admin-token, x-bbf-vault-token',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

// Durable first-open flag. localStorage is device-local and re-fires on every
// new device / cleared storage, so the AUTHORITATIVE gate is a server-side
// boolean COLUMN (has_seen_welcome for the Vault, has_seen_sports_welcome for the
// Sports Hub). claimFirstWelcome ATOMICALLY flips false->true on `column` and
// reports whether THIS call won the flip (race-safe). Degrades to 'unknown'
// (compose anyway) if the column / service key is missing, so it never errors.
function svcHeaders(serviceKey: string): HeadersInit {
  return { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };
}
async function claimFirstWelcome(url: string, serviceKey: string, userId: string, column: string): Promise<'first' | 'already' | 'unknown'> {
  try {
    const r = await fetch(`${url}/rest/v1/bbf_users?id=eq.${encodeURIComponent(userId)}&${column}=is.false&select=id`, {
      method: 'PATCH',
      headers: { ...svcHeaders(serviceKey), Prefer: 'return=representation' },
      body: JSON.stringify({ [column]: true }),
    });
    if (!r.ok) return 'unknown';
    const rows = await r.json().catch(() => null);
    if (Array.isArray(rows)) return rows.length ? 'first' : 'already';
    return 'unknown';
  } catch { return 'unknown'; }
}

const MODEL             = routeAndLog('bbf-agentic-concierge', 'concierge_greeting');
const MAX_TOKENS        = 1536;
const EFFORT_DEFAULT    = 'low';
const CLAUDE_TIMEOUT_MS = 20000;
const MAX_NAME_LEN      = 60;

interface ManifestEntry { key: string; label: string; blurb: string; }
const FEATURE_MANIFEST: ManifestEntry[] = [
  { key: 'grid',                label: 'The Program Grid',        blurb: 'Your full periodized training protocol, mapped day by day.' },
  { key: 'form_videos',         label: 'Form Video Library',      blurb: 'Founder-verified exemplar lifts for every movement you run.' },
  { key: 'base_nutrition',      label: 'Nutrition Locker',        blurb: 'Your meal plan and fasting window, calibrated to your targets.' },
  { key: 'readiness',           label: 'Daily Readiness',         blurb: 'Log how you feel and the day calibrates to your recovery.' },
  { key: 'mindset',             label: 'Champion Mindset',        blurb: 'The Mindset Engine that keeps the standard locked in.' },
  { key: 'voice_coach',         label: 'Voice Coach',             blurb: 'Hands-free audio cues coaching you through every set.' },
  { key: 'smart_cardio',        label: 'Smart Cardio',            blurb: 'Adaptive conditioning that paces to your engine.' },
  { key: 'prehab',              label: 'Prehab Friction Scanner', blurb: 'The Live Library Recovery Matrix for joint health and longevity.' },
  { key: 'advanced_nutrition',  label: 'Meal Scanner',            blurb: 'Snap a photo of any meal and get its macros instantly.' },
  { key: 'sovereign_comlink',   label: 'Sovereign Comlink',       blurb: 'Radio in a constraint mid-session and the workout rewrites itself.' },
  { key: 'coach_orchestration', label: 'Coach Orchestration',     blurb: 'Multi-agent coaching intelligence working in your corner.' },
  { key: 'sports_hub',          label: 'BBF Athlete Portal',      blurb: 'Periodized, position-specific training built for your sport.' },
  { key: 'roster',              label: 'Team Roster',             blurb: 'Your squad and coaching staff, all in one place.' },
  { key: 'kinematics',          label: 'Kinematic Form HUD',      blurb: 'The biomechanics and injury-prevention scanner.' },
];

// Sports Hub manifest — the SAME entitlement keys (so the band gate + no-mirage
// filter still hold), re-framed in an athlete/sport voice for the BBF Athlete
// Portal. unlockedSports() intersects with the member's band exactly like the
// Vault path, so a tool the band has NOT unlocked is never surfaced.
const SPORTS_MANIFEST: ManifestEntry[] = [
  { key: 'sports_hub',  label: 'Daily Athlete Protocol', blurb: 'Your periodized 7-day training, drills, and film — built for your sport and position.' },
  { key: 'kinematics',  label: 'Kinematic Form HUD',     blurb: 'The biomechanics scanner that flags injury risk before it costs you a season.' },
  { key: 'form_videos', label: 'Film Room',              blurb: 'Founder-verified exemplar reps for every movement in your protocol.' },
  { key: 'readiness',   label: 'Daily Readiness',        blurb: 'Log how you feel and today\'s session scales to how recovered you are.' },
  { key: 'roster',      label: 'Team Roster',            blurb: 'Your squad and coaching staff, all in one place.' },
];

const BAND_LABEL: Record<string, string> = {
  [GROUP.BASELINE]:   'Baseline',
  [GROUP.AUTONOMOUS]: 'Autonomous',
  [GROUP.APEX]:       'Apex',
  [GROUP.YOUTH]:      'Youth Athlete',
  [GROUP.ALL]:        'All-Access',
};

const SURFACE_LABEL: Record<string, string> = {
  [GROUP.BASELINE]:   'Sovereign Vault',
  [GROUP.AUTONOMOUS]: 'Sovereign Vault',
  [GROUP.APEX]:       'Sovereign Vault',
  [GROUP.YOUTH]:      'BBF Athlete Portal',
  [GROUP.ALL]:        'BBF lab',
};
const SPORTS_SURFACE = 'BBF Athlete Portal';

function unlockedForGroup(group: string): ManifestEntry[] {
  return FEATURE_MANIFEST.filter((f) => {
    const bands = FEATURE_ACCESS[f.key];
    return Array.isArray(bands) && (bands as string[]).includes(group);
  });
}
function unlockedSports(group: string): ManifestEntry[] {
  return SPORTS_MANIFEST.filter((f) => {
    const bands = FEATURE_ACCESS[f.key];
    return Array.isArray(bands) && (bands as string[]).includes(group);
  });
}

const SYSTEM_PROMPT = [
  'You are the BBF Lab Concierge — the warm, precise welcome agent for Build Believe Fit, an elite human-optimization laboratory. A member has just opened their portal for the first time. Your job: greet them by name and orient them to EXACTLY the tools their membership unlocks — nothing more, nothing less.',
  '',
  '# THE ONE INVIOLABLE RULE — NO MIRAGES',
  'You will be given the member\'s access BAND and the EXACT list of features they have unlocked. Mention ONLY features from that unlocked list. NEVER mention, tease, hint at, allude to, or "upsell" a feature that is not on the list. Do NOT say "upgrade to unlock", do NOT name higher tiers, do NOT reference anything they cannot use today. The member must feel their membership is complete and abundant — never that something is missing or fenced off. A single teased feature outside their band is a failure.',
  '',
  '# YOU RECEIVE',
  '- member — display name, access band (for your tone, not to quote verbatim), and `surface` (the EXACT name of the portal this member is in).',
  '- unlocked_features — the canonical list of features this member can use RIGHT NOW. Each has a `feature` key, a `label`, and a `blurb`. This is the ONLY menu you may draw from.',
  '',
  '# YOUR OUTPUT',
  '- greeting — 1-2 warm, confident sentences welcoming the member by name into their `surface`, calling it by that EXACT name (never rename the portal or substitute another BBF product). Convey the breadth of what they have without naming the band as a tier or a price. Direct coach voice, Sovereign Gold Standard. No hedging, no fluff.',
  '- unlocked — an array describing the tools to surface. Include EVERY feature in unlocked_features, in the order given. For EACH item: echo the exact `feature` key verbatim, write a punchy `title` (the feature name, lightly stylized is fine), and a one-sentence `blurb` saying what it does FOR THEM. Use ONLY keys present in unlocked_features.',
  '- first_move — ONE specific suggested first action that names ONE of the unlocked features (e.g. "Open The Program Grid and run day one.").',
  '',
  '# VOICE',
  '- Warm but elite. You are the concierge of a high-performance laboratory, not a generic chatbot.',
  '- Never mention pricing, tier names, "premium", "plan", locks, or anything unavailable.',
  '- Keep it tight. The member wants to start training, not read an essay.',
  '- Use the BBF proprietary names verbatim.',
  '',
  'Return ONLY structured JSON matching the response schema. No markdown, no preamble.',
].join('\n');

// Sports Hub variant — same no-mirage contract + schema, athlete voice.
const SPORTS_SYSTEM_PROMPT = [
  'You are the BBF Athlete Portal Concierge — the welcome agent for a young/developing athlete opening the BBF Athlete Portal (the youth & sports side of Build Believe Fit) for the FIRST time. Greet them by name and orient them to EXACTLY the tools their portal unlocks — nothing more, nothing less.',
  '',
  '# THE ONE INVIOLABLE RULE — NO MIRAGES',
  'You will be given the athlete\'s access BAND and the EXACT list of features they have unlocked. Mention ONLY features from that unlocked list. NEVER mention, tease, hint at, or "upsell" a feature that is not on the list. Do NOT say "upgrade to unlock", do NOT name tiers or prices. The athlete must feel their portal is complete — never that something is fenced off. A single teased feature outside their band is a failure.',
  '',
  '# YOU RECEIVE',
  '- member — display name, access band (for tone only), and `surface` (the EXACT name of the portal — always "BBF Athlete Portal").',
  '- unlocked_features — the canonical list of tools this athlete can use RIGHT NOW (feature key, label, blurb). This is the ONLY menu you may draw from.',
  '',
  '# YOUR OUTPUT',
  '- greeting — 1-2 confident sentences welcoming the athlete by name into their `surface`, calling it by that EXACT name. Frame it around THEIR game — getting faster, stronger, more explosive, and staying healthy for the long season ahead.',
  '- unlocked — an array describing the tools. Include EVERY feature in unlocked_features, in the order given. For each: echo the exact `feature` key verbatim, a punchy `title`, and a one-sentence `blurb` on what it does FOR THIS ATHLETE. Use ONLY keys present in unlocked_features.',
  '- first_move — ONE concrete first action naming ONE unlocked feature (e.g. "Open your Daily Athlete Protocol and run today\'s session.").',
  '',
  '# VOICE',
  '- A sharp, motivating sports coach talking to a developing athlete — confident, direct, never condescending, never babyish.',
  '- Frame everything around their sport, their position, performance, and staying durable. Avoid adult lifestyle / fat-loss framing.',
  '- Never mention pricing, tiers, "premium", locks, or anything unavailable. Use BBF proprietary names verbatim.',
  '- Keep it tight — the athlete wants to train, not read.',
  '',
  'Return ONLY structured JSON matching the response schema. No markdown, no preamble.',
].join('\n');

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    greeting: { type: 'string', description: '1-2 sentence personalized, on-brand welcome addressing the member by name.' },
    unlocked: {
      type: 'array',
      description: 'One entry per unlocked feature, in the order provided. feature MUST be a key from unlocked_features — never invent one.',
      items: {
        type: 'object',
        properties: {
          feature: { type: 'string', description: 'Exact feature key copied verbatim from unlocked_features.' },
          title:   { type: 'string', description: 'Punchy feature title (the feature name, lightly stylized).' },
          blurb:   { type: 'string', description: 'One sentence on what this tool does for the member.' },
        },
        required: ['feature', 'title', 'blurb'],
        additionalProperties: false,
      },
    },
    first_move: { type: 'string', description: 'One concrete first action that names exactly one unlocked feature.' },
  },
  required: ['greeting', 'unlocked', 'first_move'],
  additionalProperties: false,
};

function deterministicGreeting(unlocked: ManifestEntry[], name: string, surface: string) {
  return {
    greeting: `Welcome to your ${surface}, ${name}. Everything below is unlocked and ready — let's get to work.`,
    unlocked: unlocked.map((f) => ({ feature: f.key, title: f.label, blurb: f.blurb })),
    first_move: unlocked.length ? `Start with ${unlocked[0].label}.` : 'Open your portal and begin.',
  };
}

async function callClaude(userMessage: string, localeInput: string, apiKey: string, systemPrompt: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CLAUDE_TIMEOUT_MS);
  const requestBody = {
    model: MODEL, max_tokens: MAX_TOKENS,
    thinking: { type: 'disabled' },
    output_config: { effort: EFFORT_DEFAULT, format: { type: 'json_schema', schema: RESPONSE_SCHEMA } },
    system: [
      { type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: localeDirective(localeInput, 'the greeting, every feature title and blurb, and the first move') },
    ],
    messages: [{ role: 'user', content: userMessage }],
  };
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify(requestBody), signal: controller.signal,
    });
    let body: any; try { body = await res.json(); } catch (_) { body = null; }
    if (!res.ok) {
      const errMsg = (body && body.error && (body.error.message || body.error.type)) || `anthropic_${res.status}`;
      console.error(`[bbf-agentic-concierge] Anthropic API error: status=${res.status} body=${JSON.stringify(body).slice(0, 600)}`);
      return { ok: false as const, status: res.status, error: errMsg, raw: body };
    }
    return { ok: true as const, status: res.status, body };
  } catch (e) {
    const err = e as Error;
    const reason = err.name === 'AbortError' ? `timeout_${CLAUDE_TIMEOUT_MS}ms` : err.message;
    console.error(`[bbf-agentic-concierge] Claude fetch threw: ${reason}`);
    return { ok: false as const, status: 0, error: reason, raw: null };
  } finally { clearTimeout(timeout); }
}

function extractTextBlock(content: any[]): string | null {
  if (!Array.isArray(content)) return null;
  for (const block of content) if (block && block.type === 'text' && typeof block.text === 'string') return block.text;
  return null;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')    return jsonResponse({ error: 'method_not_allowed' }, 405);

  let payload: any;
  try { payload = await req.json(); } catch (_) { return jsonResponse({ error: 'invalid_json' }, 400); }

  const locale = localeCode(payload?.locale ?? payload?.lang);
  // HUB FORK — 'sports' selects the BBF Athlete Portal surface + its own gate.
  const hub = (String(payload?.hub ?? payload?.context ?? '').trim().toLowerCase() === 'sports') ? 'sports' : 'vault';

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY');
  const gate = await resolveEntitlement({
    supabaseUrl: SUPABASE_URL,
    serviceKey:  SERVICE_KEY,
    vaultToken:  payload?.vault_token ?? req.headers.get('x-bbf-vault-token'),
  });
  if ('status' in gate) return jsonResponse({ error: gate.error, detail: gate.detail }, gate.status);

  const group     = gate.group;
  const bandLabel = BAND_LABEL[group] || 'Member';
  const surface   = hub === 'sports' ? SPORTS_SURFACE : (SURFACE_LABEL[group] || 'BBF lab');
  const unlocked  = hub === 'sports' ? unlockedSports(group) : unlockedForGroup(group);
  const systemPrompt = hub === 'sports' ? SPORTS_SYSTEM_PROMPT : SYSTEM_PROMPT;
  const seenColumn   = hub === 'sports' ? 'has_seen_sports_welcome' : 'has_seen_welcome';

  // DURABLE FIRST-OPEN GATE — auto-fire only on the absolute first open of THIS
  // surface; an explicit summon (body.summon) always bypasses. Atomically claim
  // the per-surface flag; an already-welcomed member gets { already_seen } (no
  // LLM, no modal) across every device. Degrades to compose if column absent.
  const summon = payload?.summon === true || payload?.force === true;
  const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!summon && SUPABASE_URL && SERVICE_ROLE_KEY) {
    const claim = await claimFirstWelcome(SUPABASE_URL, SERVICE_ROLE_KEY, gate.user_id, seenColumn);
    if (claim === 'already') return jsonResponse({ ok: true, already_seen: true, locale, hub, band: group, band_label: bandLabel }, 200);
  }

  const rawName = (typeof payload?.display_name === 'string' && payload.display_name.trim()) ? payload.display_name.trim() : (gate.uid || 'there');
  const name = rawName.slice(0, MAX_NAME_LEN);

  if (!unlocked.length) {
    console.warn(`[bbf-agentic-concierge] empty unlocked set for band=${group} hub=${hub} uid=${gate.uid}`);
    return jsonResponse({ locale, hub, band: group, band_label: bandLabel, ...deterministicGreeting(unlocked, name, surface) }, 200);
  }

  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  if (!ANTHROPIC_API_KEY) {
    console.error('[bbf-agentic-concierge] missing ANTHROPIC_API_KEY — deterministic fallback');
    return jsonResponse({ locale, hub, band: group, band_label: bandLabel, ...deterministicGreeting(unlocked, name, surface) }, 200);
  }

  const unlockedForPrompt = unlocked.map((f) => ({ feature: f.key, label: f.label, blurb: f.blurb }));
  const userMessage =
    '## member\n' +
    '```json\n' + JSON.stringify({ name, band: bandLabel, surface }, null, 2) + '\n```\n\n' +
    '## unlocked_features (the ONLY features you may mention — no mirages)\n' +
    '```json\n' + JSON.stringify(unlockedForPrompt, null, 2) + '\n```\n\n' +
    'Write the welcome for this member. Use ONLY these features, all of them, in this order. Return ONLY the JSON schema response.';

  const t0     = Date.now();
  const result = await callClaude(userMessage, locale, ANTHROPIC_API_KEY, systemPrompt);
  const dur    = Date.now() - t0;

  if (!result.ok) {
    console.warn(`[bbf-agentic-concierge] Claude failed (${result.error}) after ${dur}ms — deterministic fallback`);
    return jsonResponse({ locale, hub, band: group, band_label: bandLabel, ...deterministicGreeting(unlocked, name, surface) }, 200);
  }

  const respBody: any = result.body;
  const text = extractTextBlock(respBody?.content);
  if (!text) { console.warn('[bbf-agentic-concierge] no text block — deterministic fallback'); return jsonResponse({ locale, hub, band: group, band_label: bandLabel, ...deterministicGreeting(unlocked, name, surface) }, 200); }

  let parsed: any;
  try { parsed = JSON.parse(text); } catch (e) { console.warn(`[bbf-agentic-concierge] parse failed (${(e as Error).message}) — deterministic fallback`); return jsonResponse({ locale, hub, band: group, band_label: bandLabel, ...deterministicGreeting(unlocked, name, surface) }, 200); }

  if (!parsed || typeof parsed.greeting !== 'string' || !Array.isArray(parsed.unlocked)) {
    console.warn(`[bbf-agentic-concierge] schema mismatch — deterministic fallback. got=${JSON.stringify(parsed).slice(0, 200)}`);
    return jsonResponse({ locale, hub, band: group, band_label: bandLabel, ...deterministicGreeting(unlocked, name, surface) }, 200);
  }

  const allowed = new Map(unlocked.map((f) => [f.key, f] as const));
  const seen    = new Set<string>();
  const cleaned: Array<{ feature: string; title: string; blurb: string }> = [];
  for (const item of parsed.unlocked) {
    const key = item && typeof item.feature === 'string' ? item.feature : '';
    if (!allowed.has(key) || seen.has(key)) continue;
    seen.add(key);
    const fb = allowed.get(key)!;
    cleaned.push({
      feature: key,
      title:   (typeof item.title === 'string' && item.title.trim() ? item.title.trim() : fb.label).slice(0, 80),
      blurb:   (typeof item.blurb === 'string' && item.blurb.trim() ? item.blurb.trim() : fb.blurb).slice(0, 220),
    });
  }
  for (const f of unlocked) if (!seen.has(f.key)) cleaned.push({ feature: f.key, title: f.label, blurb: f.blurb });

  const greeting  = parsed.greeting.trim().slice(0, 400) || deterministicGreeting(unlocked, name, surface).greeting;
  const firstMove = (typeof parsed.first_move === 'string' && parsed.first_move.trim()) ? parsed.first_move.trim().slice(0, 200) : `Start with ${unlocked[0].label}.`;

  console.log(`[bbf-agentic-concierge] uid=${gate.uid} hub=${hub} band=${group} god=${gate.god_mode} features=${cleaned.length} model=${respBody.model} duration=${dur}ms usage=${JSON.stringify(respBody.usage)}`);

  return jsonResponse({ locale, hub, band: group, band_label: bandLabel, greeting, unlocked: cleaned, first_move: firstMove }, 200);
});
