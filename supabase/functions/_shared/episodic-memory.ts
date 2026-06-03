// ═══════════════════════════════════════════════════════════════════════════
// supabase/functions/_shared/episodic-memory.ts
// Brief 6 · Opus Max Sprint · Cross-Session Episodic Memory — retrieval layer
// ───────────────────────────────────────────────────────────────────────────
// The shared client every fleet agent uses to READ relevant prior context at
// the start of a session and WRITE what happened at the end. It is the TS face
// of the bbf_agent_episodic_memory spine (migration 20260603000000); all access
// goes through the two SECURITY DEFINER RPCs (bbf_episodic_write / _recall),
// which are callable only by service_role and resolve uid→user_id server-side.
//
// ── THE BOUNDARY (the exact read/write contract) ───────────────────────────
//   READ  · at the very START of handling a request, an agent calls
//           recallMemory()/recallContextBlock() to pull the top-N prior records
//           for this user (its own thread, or fleet-wide). The returned block is
//           injected into the agent's system/context prompt BEFORE generation.
//           Recall is best-effort: on any failure it returns EMPTY, never throws
//           — a memory miss must never block the agent.
//   WRITE · at the END of the session, once the agent has produced its output,
//           it calls commitSessionMemory() (or writeMemory directly) exactly
//           once with the durable summary + any key decisions / flags. Records
//           with flags are auto-escalated in salience so they surface first next
//           time. Writes are also best-effort: a failed write is logged and
//           swallowed so it can't corrupt the agent's response path.
//
// This module is the layer + helper ONLY. Wiring each of the 22 agents' READ
// (prompt injection) and WRITE (end-of-turn commit) call sites is a deliberate
// follow-up — this file gives them a single, safe entry point to do it.
//
// No external imports: raw fetch against the PostgREST RPC endpoint keeps the
// shared module dependency-free (same pattern as bbf-admin-roster).
// ═══════════════════════════════════════════════════════════════════════════

export type EpisodicKind = 'session_summary' | 'key_decision' | 'flag';

export const EPISODIC_KIND = {
  SESSION_SUMMARY: 'session_summary' as const,
  KEY_DECISION:    'key_decision' as const,
  FLAG:            'flag' as const,
};

export interface EpisodicRecord {
  id:         string;
  agent:      string;
  session_id: string | null;
  kind:       EpisodicKind;
  summary:    string;
  decisions:  unknown[];
  flags:      unknown[];
  tags:       string[];
  salience:   number;
  metadata:   Record<string, unknown>;
  created_at: string;
  expires_at: string | null;
}

export interface RecallOptions {
  uid:             string;        // human uid ('akeem') or bbf_users.id UUID
  agent?:          string;        // omit → fleet-wide recall; set → that agent's thread
  kinds?:          EpisodicKind[];// omit → all kinds
  limit?:          number;        // default 5 (clamped server-side to 1..50)
  includeExpired?: boolean;       // default false
}

export interface RecallResult {
  ok:      boolean;
  records: EpisodicRecord[];
  count:   number;
  error?:  string;
}

export interface WriteOptions {
  uid:        string;
  agent:      string;             // authoring fleet agent, e.g. 'bbf-co-coach'
  summary:    string;             // the durable episodic recap (required)
  kind?:      EpisodicKind;       // default 'session_summary'
  decisions?: unknown[];          // structured key decisions
  flags?:     unknown[];          // safety/wellbeing/behavioral flags
  tags?:      string[];           // coarse retrieval tags
  salience?:  number;             // 0..10 retrieval weight (default 1)
  sessionId?: string;             // optional grouping for one session/turn
  metadata?:  Record<string, unknown>;
  expiresAt?: string;             // optional ISO TTL; omit → persist
}

export interface WriteResult {
  ok:    boolean;
  id?:   string;
  error?: string;
}

// ─── Service-role env (auto-injected into every edge function) ──────────────
function env() {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return { url, key };
}

async function callRpc(name: string, body: Record<string, unknown>): Promise<unknown> {
  const { url, key } = env();
  if (!url || !key) throw new Error('missing_supabase_env');
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`rpc_${name}_http_${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`);
  }
  return await res.json();
}

// ─── READ · pull relevant prior context (best-effort, never throws) ─────────
export async function recallMemory(opts: RecallOptions): Promise<RecallResult> {
  try {
    const out = await callRpc('bbf_episodic_recall', {
      p_uid:             opts.uid,
      p_agent:           opts.agent ?? null,
      p_kinds:           opts.kinds ?? null,
      p_limit:           opts.limit ?? 5,
      p_include_expired: opts.includeExpired ?? false,
    }) as { ok?: boolean; records?: EpisodicRecord[]; count?: number; error?: string };

    if (!out || out.ok !== true) {
      return { ok: false, records: [], count: 0, error: out?.error ?? 'recall_failed' };
    }
    const records = Array.isArray(out.records) ? out.records : [];
    return { ok: true, records, count: out.count ?? records.length };
  } catch (e) {
    console.warn(`[episodic-memory] recall failed: ${(e as Error).message}`);
    return { ok: false, records: [], count: 0, error: (e as Error).message };
  }
}

// ─── READ · convenience — a compact text block for prompt injection ─────────
// Returns '' when there is nothing to recall, so callers can unconditionally
// concatenate it into a system prompt.
export async function recallContextBlock(opts: RecallOptions): Promise<string> {
  const { records } = await recallMemory(opts);
  return formatContextBlock(records, opts.agent);
}

export function formatContextBlock(records: EpisodicRecord[], agent?: string): string {
  if (!records.length) return '';
  const scope = agent ? `${agent}` : 'fleet';
  const lines = records.map((r) => {
    const date = (r.created_at || '').slice(0, 10);
    const tag = r.kind === 'flag' ? '⚑ FLAG' : r.kind === 'key_decision' ? '◆ DECISION' : '•';
    const decisions = Array.isArray(r.decisions) && r.decisions.length
      ? ` | decisions: ${safeJoin(r.decisions)}` : '';
    const flags = Array.isArray(r.flags) && r.flags.length
      ? ` | flags: ${safeJoin(r.flags)}` : '';
    return `${tag} (${date} · ${r.agent} · s${r.salience}) ${r.summary}${decisions}${flags}`;
  });
  return `[PRIOR CONTEXT · ${scope} · ${records.length} record${records.length === 1 ? '' : 's'}]\n${lines.join('\n')}`;
}

function safeJoin(items: unknown[]): string {
  return items
    .map((i) => (typeof i === 'string' ? i : (() => { try { return JSON.stringify(i); } catch { return String(i); } })()))
    .join('; ');
}

// ─── WRITE · persist one episodic record (best-effort, never throws) ────────
export async function writeMemory(opts: WriteOptions): Promise<WriteResult> {
  try {
    const out = await callRpc('bbf_episodic_write', {
      p_uid:        opts.uid,
      p_agent:      opts.agent,
      p_summary:    opts.summary,
      p_kind:       opts.kind ?? EPISODIC_KIND.SESSION_SUMMARY,
      p_decisions:  opts.decisions ?? [],
      p_flags:      opts.flags ?? [],
      p_tags:       opts.tags ?? [],
      p_salience:   opts.salience ?? 1,
      p_session_id: opts.sessionId ?? null,
      p_metadata:   opts.metadata ?? {},
      p_expires_at: opts.expiresAt ?? null,
    }) as { ok?: boolean; id?: string; error?: string };

    if (!out || out.ok !== true) {
      console.warn(`[episodic-memory] write rejected: ${out?.error ?? 'unknown'}`);
      return { ok: false, error: out?.error ?? 'write_failed' };
    }
    return { ok: true, id: out.id };
  } catch (e) {
    console.warn(`[episodic-memory] write failed: ${(e as Error).message}`);
    return { ok: false, error: (e as Error).message };
  }
}

// ─── WRITE · the end-of-session boundary helper ─────────────────────────────
// One call an agent makes when its turn is done. Bundles the summary + optional
// decisions/flags; if flags are present and the caller didn't request a higher
// weight, salience is auto-escalated so the flag surfaces first next session.
export async function commitSessionMemory(opts: WriteOptions): Promise<WriteResult> {
  const hasFlags = Array.isArray(opts.flags) && opts.flags.length > 0;
  const salience = opts.salience ?? (hasFlags ? 8 : 3);
  return writeMemory({ ...opts, salience });
}
