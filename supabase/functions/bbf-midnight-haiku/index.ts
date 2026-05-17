// bbf-midnight-haiku — Midnight Haiku Engine
// ─────────────────────────────────────────────────────────────────────
// Asynchronous, cron-triggered batch that generates the next-day
// daily_brief for every Sovereign-tier athlete. Reads each user's last
// 24h of training (bbf_logs) + autonomic readiness (bbf_readiness), asks
// Claude Haiku to write a 2–3 sentence clinical intelligence brief in
// the voice of a Sovereign-tier hypertrophy + biomechanics coach, then
// UPDATEs bbf_users.daily_brief with the result. The brief surfaces on
// the next render of the Sovereign Intelligence Brief widget on the
// Workout tab (see window.BBF_SOVEREIGN_INTEL.render).
//
// CEO directive specified `claude-3-haiku-20240307` — that model is
// retired (2026 sunset). This function uses the current Haiku 4.5
// (`claude-haiku-4-5`) — the modern, cheaper, faster equivalent.
//
// Trigger:
//   POST /functions/v1/bbf-midnight-haiku
//   X-BBF-Cron-Token: <shared secret from BBF_MIDNIGHT_CRON_TOKEN>
//   (No body required; an optional { dry_run: true } skips the UPDATE.)
//
// Wire via pg_cron:
//   SELECT cron.schedule(
//     'bbf-midnight-haiku',
//     '0 5 * * *',  -- 05:00 UTC = 00:00 ET, late enough for last-set logs
//     $$ SELECT net.http_post(
//          url     := 'https://<project>.supabase.co/functions/v1/bbf-midnight-haiku',
//          headers := '{"X-BBF-Cron-Token":"<token>"}'::jsonb
//        ); $$
//   );
//
// Required secrets:
//   ANTHROPIC_API_KEY            — Anthropic API key
//   SUPABASE_URL                 — auto-provided by Supabase
//   SUPABASE_SERVICE_ROLE_KEY    — auto-provided by Supabase
//   BBF_MIDNIGHT_CRON_TOKEN      — shared cron secret (optional but recommended)
//
// Required schema:
//   bbf_users.daily_brief        — text, nullable. Add via migration:
//     alter table bbf_users add column if not exists daily_brief text;
//   bbf_users.subscription_tier  — text, already present (gateway / youth_athlete / architect / sovereign)
//
// Response (200 OK):
//   { ok: true, processed, succeeded, failed,
//     model, dry_run, batch_size, errors: [{ uid, message }] }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

// ─── Constants ────────────────────────────────────────────────────────
const MODEL          = 'claude-haiku-4-5';
const MAX_TOKENS     = 220; // 2–3 sentences ≈ 100–150 output tokens; small buffer.
const BATCH_SIZE     = 5;   // Concurrent Anthropic calls per batch.
const RETRY_LIMIT    = 3;   // Per-user retry attempts on transient API failures.
const RETRY_BASE_MS  = 800; // Exponential backoff base (800ms, 1.6s, 3.2s).
const LOOKBACK_HOURS = 24;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, authorization, x-bbf-cron-token',
};

// Cacheable system prompt — stable across every user in the batch. The
// first request in a batch writes the cache (~1.25× cost); the remaining
// N-1 reads it (~0.1× cost). Don't tweak this per-request or the prefix
// invalidates and the savings evaporate.
const SYSTEM_PROMPT = [
  'You are the BBF Midnight Haiku Engine — a Sovereign-tier hypertrophy and biomechanics coach reporting to Head Coach Akeem Brown, founder of Build Believe Fit. You write the daily intelligence brief that greets each Sovereign-tier athlete the moment they open today\'s Workout tab.',
  '',
  '# YOUR JOB',
  'Read the athlete\'s last 24 hours of training volume + intensity (bbf_logs / bbf_sets) and CNS readiness (bbf_readiness). Synthesize 2–3 sentences of highly specific, actionable intelligence the athlete can apply to today\'s session.',
  '',
  '# WHAT TO PRESCRIBE',
  '- Joint health and mobility cues when soreness is elevated or sleep is short',
  '- Glycogen routing and intra-workout fueling when volume was heavy and intensity stays heavy',
  '- Tempo, TUT, and biomechanical-form refinements when CNS is primed and volume is moderate',
  '- Recovery framing (parasympathetic emphasis, low-amplitude blood flow) when the score is sub-65 or sleep is sub-6h',
  '',
  '# TONE',
  'Relentless. Clinical. Elite. No fluff. No greeting (it is added by the client). No emoji. No exclamation marks. Speak directly to the athlete in second person. Reference their actual numbers when they sharpen the message; do not invent numbers that are not in the data.',
  '',
  '# OUTPUT CONTRACT',
  '- Exactly 2 to 3 sentences.',
  '- Plain text. No markdown, no headings, no lists, no JSON.',
  '- Do not begin with "Hey", "Hello", "Good morning", or the athlete\'s name — those are rendered by the client.',
  '- Do not end with motivational filler ("you got this", "let\'s go", etc.).',
  '- If the data is sparse (no logs, no readiness) prescribe joint integrity + sub-maximal warm-up volume and acknowledge the missing signal in one clause.',
].join('\n');

// ─── HTTP plumbing ────────────────────────────────────────────────────
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Types ────────────────────────────────────────────────────────────
type SovereignUser = {
  id: string;
  name: string | null;
};

type LogRow = {
  id: string;
  date: string;
  type: string | null;
  tier_phases: unknown;
  coach_notes: string | null;
};

type ReadinessRow = {
  timestamp: string;
  score: number | null;
  sleep_quality: number | null;
  soreness_level: number | null;
};

// ─── Sovereign roster sweep ───────────────────────────────────────────
async function fetchSovereignRoster(
  supabaseUrl: string,
  supabaseKey: string,
): Promise<SovereignUser[]> {
  const url = `${supabaseUrl}/rest/v1/bbf_users` +
    `?subscription_tier=eq.sovereign` +
    `&select=id,name`;
  const res = await fetch(url, {
    headers: {
      'apikey':        supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
    },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`roster_fetch_failed: HTTP ${res.status} ${detail}`);
  }
  const rows = await res.json();
  return Array.isArray(rows) ? rows as SovereignUser[] : [];
}

// ─── Per-user 24h windows ─────────────────────────────────────────────
async function fetchRecentLogs(
  uuid: string,
  sinceIso: string,
  supabaseUrl: string,
  supabaseKey: string,
): Promise<LogRow[]> {
  const select = 'id,date,type,tier_phases,coach_notes';
  const url = `${supabaseUrl}/rest/v1/bbf_logs` +
    `?user_id=eq.${encodeURIComponent(uuid)}` +
    `&date=gte.${encodeURIComponent(sinceIso)}` +
    `&order=date.desc` +
    `&select=${select}`;
  const res = await fetch(url, {
    headers: {
      'apikey':        supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
    },
  });
  if (!res.ok) return [];
  const rows = await res.json();
  return Array.isArray(rows) ? rows as LogRow[] : [];
}

async function fetchRecentReadiness(
  uuid: string,
  sinceIso: string,
  supabaseUrl: string,
  supabaseKey: string,
): Promise<ReadinessRow[]> {
  const select = 'timestamp,score,sleep_quality,soreness_level';
  const url = `${supabaseUrl}/rest/v1/bbf_readiness` +
    `?user_id=eq.${encodeURIComponent(uuid)}` +
    `&timestamp=gte.${encodeURIComponent(sinceIso)}` +
    `&order=timestamp.desc` +
    `&select=${select}`;
  const res = await fetch(url, {
    headers: {
      'apikey':        supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
    },
  });
  if (!res.ok) return [];
  const rows = await res.json();
  return Array.isArray(rows) ? rows as ReadinessRow[] : [];
}

// ─── Anthropic call with retry/backoff ────────────────────────────────
async function generateBrief(
  user: SovereignUser,
  logs: LogRow[],
  readiness: ReadinessRow[],
  apiKey: string,
): Promise<string> {
  const userPayload = {
    athlete: {
      name: user.name || 'Athlete',
      uid:  user.id,
    },
    window_hours: LOOKBACK_HOURS,
    bbf_logs:      logs,
    bbf_readiness: readiness,
  };

  const requestBody = {
    model:      MODEL,
    max_tokens: MAX_TOKENS,
    // System prompt is cacheable — identical across every user in the
    // batch. The first request writes; the rest read at ~0.1×.
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content:
          'Last 24h telemetry for one Sovereign-tier athlete. Write the brief.\n\n' +
          '```json\n' + JSON.stringify(userPayload, null, 2) + '\n```',
      },
    ],
  };

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < RETRY_LIMIT; attempt++) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key':         apiKey,
          'anthropic-version': '2023-06-01',
          'content-type':      'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      // Retry transient: 408 timeout, 409, 429 rate limit, 5xx server.
      if (res.status === 408 || res.status === 409 || res.status === 429 || res.status >= 500) {
        const detail = await res.text().catch(() => '');
        lastError = new Error(`anthropic_${res.status}: ${detail.slice(0, 200)}`);
      } else if (!res.ok) {
        // Non-transient — fail fast.
        const detail = await res.text().catch(() => '');
        throw new Error(`anthropic_${res.status}: ${detail.slice(0, 200)}`);
      } else {
        const body = await res.json();
        const text = extractTextBlock(body?.content);
        if (!text) throw new Error('anthropic_empty_response');
        return text.trim();
      }
    } catch (e) {
      // Network-level failure — count as transient.
      lastError = e instanceof Error ? e : new Error(String(e));
    }

    if (attempt < RETRY_LIMIT - 1) {
      await sleep(RETRY_BASE_MS * Math.pow(2, attempt));
    }
  }

  throw lastError ?? new Error('anthropic_unknown_error');
}

function extractTextBlock(content: unknown): string | null {
  if (!Array.isArray(content)) return null;
  for (const block of content) {
    if (block && typeof block === 'object' && (block as { type?: string }).type === 'text') {
      const text = (block as { text?: unknown }).text;
      if (typeof text === 'string') return text;
    }
  }
  return null;
}

// ─── Injection: UPDATE bbf_users.daily_brief ──────────────────────────
async function persistBrief(
  uuid: string,
  brief: string,
  supabaseUrl: string,
  supabaseKey: string,
): Promise<void> {
  const url = `${supabaseUrl}/rest/v1/bbf_users?id=eq.${encodeURIComponent(uuid)}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'apikey':        supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type':  'application/json',
      'Prefer':        'return=minimal',
    },
    body: JSON.stringify({
      daily_brief: brief,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`update_failed: HTTP ${res.status} ${detail.slice(0, 200)}`);
  }
}

// ─── Per-user pipeline ────────────────────────────────────────────────
async function processUser(
  user: SovereignUser,
  sinceIso: string,
  supabaseUrl: string,
  supabaseKey: string,
  apiKey: string,
  dryRun: boolean,
): Promise<{ uid: string; brief: string }> {
  const [logs, readiness] = await Promise.all([
    fetchRecentLogs(user.id, sinceIso, supabaseUrl, supabaseKey),
    fetchRecentReadiness(user.id, sinceIso, supabaseUrl, supabaseKey),
  ]);
  const brief = await generateBrief(user, logs, readiness, apiKey);
  if (!dryRun) {
    await persistBrief(user.id, brief, supabaseUrl, supabaseKey);
  }
  return { uid: user.id, brief };
}

// ─── Batch orchestration ──────────────────────────────────────────────
async function runBatch(
  roster: SovereignUser[],
  sinceIso: string,
  supabaseUrl: string,
  supabaseKey: string,
  apiKey: string,
  dryRun: boolean,
) {
  const errors: { uid: string; message: string }[] = [];
  let succeeded = 0;

  for (let i = 0; i < roster.length; i += BATCH_SIZE) {
    const slice = roster.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      slice.map((user) =>
        processUser(user, sinceIso, supabaseUrl, supabaseKey, apiKey, dryRun)
      ),
    );
    results.forEach((r, idx) => {
      const user = slice[idx];
      if (r.status === 'fulfilled') {
        succeeded++;
        console.log(`[bbf-midnight-haiku] OK uid=${user.id} brief="${r.value.brief.slice(0, 80)}..."`);
      } else {
        const message = r.reason instanceof Error ? r.reason.message : String(r.reason);
        errors.push({ uid: user.id, message });
        console.error(`[bbf-midnight-haiku] FAIL uid=${user.id} error=${message}`);
      }
    });
  }

  return { succeeded, failed: errors.length, errors };
}

// ─── Entry point ──────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405);
  }

  // Cron-only gate. If the secret is set in env, demand it from the caller.
  const expectedToken = Deno.env.get('BBF_MIDNIGHT_CRON_TOKEN');
  if (expectedToken) {
    const presented = req.headers.get('x-bbf-cron-token');
    if (presented !== expectedToken) {
      console.warn('[bbf-midnight-haiku] rejected: missing or wrong cron token.');
      return jsonResponse({ error: 'unauthorized' }, 401);
    }
  }

  const ANTHROPIC_API_KEY      = Deno.env.get('ANTHROPIC_API_KEY');
  const SUPABASE_URL           = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!ANTHROPIC_API_KEY)    return jsonResponse({ error: 'config_missing_anthropic_key' }, 503);
  if (!SUPABASE_URL)         return jsonResponse({ error: 'config_missing_supabase_url' }, 503);
  if (!SUPABASE_SERVICE_KEY) return jsonResponse({ error: 'config_missing_service_role_key' }, 503);

  let dryRun = false;
  try {
    const text = await req.text();
    if (text) {
      const parsed = JSON.parse(text);
      dryRun = Boolean(parsed?.dry_run);
    }
  } catch {
    // Empty or malformed body is fine — cron typically POSTs no body.
  }

  const sinceIso = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();

  let roster: SovereignUser[];
  try {
    roster = await fetchSovereignRoster(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[bbf-midnight-haiku] roster sweep failed: ${message}`);
    return jsonResponse({ error: 'roster_fetch_failed', detail: message }, 502);
  }

  console.log(`[bbf-midnight-haiku] sweep: ${roster.length} sovereign athletes, dry_run=${dryRun}`);

  if (roster.length === 0) {
    return jsonResponse({
      ok:         true,
      processed:  0,
      succeeded:  0,
      failed:     0,
      model:      MODEL,
      dry_run:    dryRun,
      batch_size: BATCH_SIZE,
      errors:     [],
    });
  }

  const { succeeded, failed, errors } = await runBatch(
    roster,
    sinceIso,
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
    ANTHROPIC_API_KEY,
    dryRun,
  );

  return jsonResponse({
    ok:         true,
    processed:  roster.length,
    succeeded,
    failed,
    model:      MODEL,
    dry_run:    dryRun,
    batch_size: BATCH_SIZE,
    errors,
  });
});
