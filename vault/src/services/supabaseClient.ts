// ═══════════════════════════════════════════════════════════════════════
// Build Believe Fit · vault/src/services/supabaseClient.ts
//
// Phase 4.1a (operator nomenclature: Phase 4.2) · State Engine Shred ·
// foundation extraction of the data-communication layer that was
// scattered across the 17,544-line inline <script> in bbf-app.html
// (~30 duplicate _supabaseUrl()/_supabaseKey() helpers) and the
// Phase 2.1 Stage-1 extraction file src/state/bbf-auth-engine.js
// (constants K + CU + VC + GD/SD).
//
// SCOPE
//   1. Singleton typed SupabaseClient bound to the browser-exposed
//      env.js layer (window.ENV_SUPABASE_URL / window.ENV_SUPABASE_KEY ·
//      ARCHITECTURE.md §6.3 confirms these are the intended browser
//      surface · the key is the publishable sb_publishable_* prefix).
//   2. Raw-fetch URL / apikey helpers for the legacy /rest/v1/rpc/...
//      shape that the inline block still uses everywhere (parity until
//      Phase 4.3+ ports the call sites to the typed client).
//   3. localStorage payload sync · GD/SD parity for the master bbf_v7
//      {u,l,w} blob, plus typed get/set/remove for the satellite keys
//      bbf_pathfinder, bbf_lang, bbf_sync_q, bbf_athlete_portal_v2.
//   4. Active-session trackers · TypeScript parity for the CU
//      (current-user uid) and VC (viewing-as-client uid) globals.
//   5. Auth-state verification · isAdmin, getTrialState (null/active/
//      expired three-state mirror), isTrialActive, verifyUserPin RPC
//      (mirrors bbf-auth-engine.js LOGIN()).
//   6. Coach agent token mirror · BBF_COACH_AGENT_TOKEN persisted in
//      BOTH localStorage and sessionStorage (legacy bootstrap pattern).
//
// Nothing in this module touches the DOM, the React tree, or the
// legacy global namespace. Callers (React components in Phase 4.3+)
// import what they need.
// ═══════════════════════════════════════════════════════════════════════

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

declare global {
  interface Window {
    ENV_SUPABASE_URL?: string;
    ENV_SUPABASE_KEY?: string;
  }
}

// ─── Storage keys (extracted verbatim from bbf-app.html call sites) ───
export const STORAGE_KEYS = {
  /** Master {u,l,w} blob · K in bbf-auth-engine.js line 10 */
  PAYLOAD: 'bbf_v7',
  /** Pathfinder pre-vault tier · seeded by the storefront form */
  PATHFINDER: 'bbf_pathfinder',
  /** Language pack · en/es/pt */
  LANG: 'bbf_lang',
  /** Athlete portal v2 cache */
  ATHLETE_PORTAL: 'bbf_athlete_portal_v2',
  /** Queue of pending Supabase writes (drained by bbf-sync.js) */
  SYNC_QUEUE: 'bbf_sync_q',
  /** Founder/admin agent token · mirrored in sessionStorage */
  COACH_AGENT_TOKEN: 'BBF_COACH_AGENT_TOKEN',
  /** Prefix for per-record sequence ACKs (bbf_seq_ack_<recordId>) */
  SEQ_ACK_PREFIX: 'bbf_seq_ack_',
} as const;

// ─── Domain types ────────────────────────────────────────────────────
/**
 * Per-user record inside the master payload's `u` bucket. Extensible
 * because the legacy inline block adds dozens of feature-specific fields
 * at runtime (workout plan, meal plan, dietary profile, etc.).
 */
export interface BBFUserRecord {
  tier?: string;
  subscription_tier?: string | null;
  trial_expires_at?: string | null;
  dietary_profile?: string;
  allergens?: string[];
  food_likes?: string[];
  food_dislikes?: string[];
  tdee_target?: number;
  macro_p?: number;
  macro_c?: number;
  macro_f?: number;
  baseline_status?: string;
  [key: string]: unknown;
}

/** Master localStorage payload shape · bbf_v7 */
export interface BBFPayload {
  u: Record<string, BBFUserRecord>;
  l: Record<string, unknown>;
  w: Record<string, unknown>;
}

export type TrialState = 'null' | 'active' | 'expired';

export interface PinVerifyResponse {
  ok: boolean;
  uid?: string;
  lockout_active?: boolean;
  retry_after_seconds?: number;
  plans_available?: boolean;
  workout_plan?: string;
  meal_plan?: string;
  plans_generated_at?: string | null;
  [key: string]: unknown;
}

// ─── Env accessors (single chokepoint for env.js reads) ──────────────
function readEnvUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const u = window.ENV_SUPABASE_URL;
  if (typeof u !== 'string' || !u) return null;
  return u.replace(/\/$/, '');
}

function readEnvKey(): string | null {
  if (typeof window === 'undefined') return null;
  const k = window.ENV_SUPABASE_KEY;
  if (typeof k !== 'string' || !k) return null;
  return k;
}

/**
 * Trimmed Supabase project URL. Throws if env.js never loaded so the
 * caller gets a clean diagnostic instead of a `undefined.replace` crash
 * (the legacy pattern silently fell through to a hardcoded fallback;
 * we surface the misconfiguration loudly).
 */
export function getSupabaseUrl(): string {
  const u = readEnvUrl();
  if (!u) {
    throw new Error(
      'Supabase env missing · window.ENV_SUPABASE_URL not set · is /env.js loaded before the vault bundle?'
    );
  }
  return u;
}

/** Publishable Supabase key (sb_publishable_* per ARCHITECTURE.md §6.3). */
export function getSupabaseKey(): string {
  const k = readEnvKey();
  if (!k) {
    throw new Error(
      'Supabase env missing · window.ENV_SUPABASE_KEY not set · is /env.js loaded before the vault bundle?'
    );
  }
  return k;
}

/** Non-throwing variant for boot-time probes / health surfaces. */
export function isSupabaseEnvReady(): boolean {
  return readEnvUrl() !== null && readEnvKey() !== null;
}

// ─── Singleton @supabase/supabase-js client ──────────────────────────
let _client: SupabaseClient | null = null;

/**
 * Lazy singleton. The client is constructed on first call so env.js has
 * a chance to populate window globals before vault code runs. Subsequent
 * calls return the same instance. BBF uses a custom PIN-RPC session
 * model, so we disable Supabase Auth's built-in session/refresh.
 */
export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;
  const url = getSupabaseUrl();
  const key = getSupabaseKey();
  _client = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return _client;
}

/** Test/diagnostic hook · drops the cached client so the next call rebuilds. */
export function resetSupabaseClient(): void {
  _client = null;
}

// ─── Master payload sync (GD/SD parity) ──────────────────────────────
function emptyPayload(): BBFPayload {
  return { u: {}, l: {}, w: {} };
}

/**
 * Get the master {u,l,w} blob from localStorage · always returns a
 * fully-shaped object even on parse failure / missing key, matching
 * the bbf-auth-engine.js GD() semantics: `return parsed || {u,l,w}`.
 */
export function getPayload(): BBFPayload {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PAYLOAD);
    if (!raw) return emptyPayload();
    const parsed = JSON.parse(raw) as Partial<BBFPayload> | null;
    if (!parsed || typeof parsed !== 'object') return emptyPayload();
    return {
      u: parsed.u ?? {},
      l: parsed.l ?? {},
      w: parsed.w ?? {},
    };
  } catch {
    return emptyPayload();
  }
}

/** Persist the master payload · returns false if localStorage refuses (quota / privacy mode). */
export function setPayload(payload: BBFPayload): boolean {
  try {
    localStorage.setItem(STORAGE_KEYS.PAYLOAD, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

/** Read a single user record from the payload, or null if absent. */
export function getUserRecord(uid: string): BBFUserRecord | null {
  const d = getPayload();
  return d.u[uid] ?? null;
}

/**
 * Merge-patch a user record. Mirrors the inline `if (!d.u[uid]) d.u[uid]
 * = {}; d.u[uid].field = value; SD(d);` idiom repeated throughout
 * bbf-app.html (e.g. dietary hydrate at line 2810, trial-state writeback
 * at line 410 of bbf-auth-engine.js).
 */
export function setUserRecord(uid: string, patch: Partial<BBFUserRecord>): boolean {
  const d = getPayload();
  d.u[uid] = { ...(d.u[uid] ?? {}), ...patch };
  return setPayload(d);
}

// ─── Typed generic localStorage sync ─────────────────────────────────
/**
 * Store any JSON-serialisable value (or raw string). Returns false on
 * quota / disabled-storage failures so callers can degrade gracefully.
 */
export function syncToStorage<T>(key: string, value: T): boolean {
  try {
    const serialised = typeof value === 'string' ? value : JSON.stringify(value);
    localStorage.setItem(key, serialised);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read + JSON-parse a stored value. Returns `fallback` on any failure,
 * matching the legacy `try { JSON.parse(...) } catch { return default }`
 * pattern. If the stored value isn't valid JSON the raw string is
 * coerced to T (caller's responsibility to type narrow).
 */
export function readFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as unknown as T;
    }
  } catch {
    return fallback;
  }
}

export function removeFromStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* best-effort · localStorage may be disabled */
  }
}

// ─── Active session trackers (CU / VC parity) ────────────────────────
let _currentUser: string | null = null;
let _viewingAsClient: string | null = null;

/** Logged-in user uid · TS parity for the inline `CU` variable. */
export function getCurrentUser(): string | null {
  return _currentUser;
}

export function setCurrentUser(uid: string | null): void {
  _currentUser = uid;
}

/**
 * Admin "view as <client>" override · TS parity for the inline `VC`
 * variable. When non-null, getActiveUid() returns this instead of the
 * actual logged-in user so admin tabs render the target client's data.
 */
export function getViewingAsClient(): string | null {
  return _viewingAsClient;
}

export function setViewingAsClient(uid: string | null): void {
  _viewingAsClient = uid;
}

/**
 * The "effective" uid for data lookups · mirrors the
 * `(typeof VC !== 'undefined' && VC) || (typeof CU !== 'undefined' && CU)`
 * pattern repeated throughout the inline block (e.g. BBF_IS_NUTRITION_ONLY,
 * BBF_TRIAL_STATE, _activeUid).
 */
export function getActiveUid(): string | null {
  return _viewingAsClient ?? _currentUser;
}

/** Clear both session trackers · used at logout. */
export function clearActiveSession(): void {
  _currentUser = null;
  _viewingAsClient = null;
}

// ─── Boot-time session hydration (Phase 6.0h) ────────────────────────
/**
 * Synchronous boot-time session restorer. Read the master payload from
 * localStorage, pick the most plausible active uid (priority: ADMIN_UID
 * present → sovereign tier → non-expired trial), and populate the
 * module-level `_currentUser`. Returns the chosen uid + the routing
 * source so the boot caller can log it.
 *
 * Idempotent · safe to call multiple times (each call re-reads
 * localStorage and overwrites the module state from scratch).
 *
 * Best-effort · the legacy auth flow never wrote a "logged-in uid"
 * sentinel to localStorage (CU lives only in memory). This hydrate
 * therefore picks the BEST CANDIDATE from cached records rather than
 * the AUTHORITATIVE current user. Stage 2 will add a
 * `bbf_current_user` localStorage sigil written by the React login
 * flow · this function will then prefer that explicit sigil when
 * present.
 *
 * The real auth gate is server-side (the `bbf_verify_user_pin` RPC).
 * This function never asserts that the chosen uid is authorized;
 * it only restores the in-memory tracker so React components don't
 * see `null` on first render.
 */
export type HydrationSource = 'admin' | 'sovereign' | 'trial' | 'none' | 'sigil';

export interface HydrationResult {
  uid: string | null;
  source: HydrationSource;
}

const CURRENT_USER_SIGIL_KEY = 'bbf_current_user';

export function hydrateSessionFromStorage(): HydrationResult {
  // 1. Explicit sigil (Stage 2 forward-compat · written by future React login)
  try {
    const sigil = localStorage.getItem(CURRENT_USER_SIGIL_KEY);
    if (sigil && typeof sigil === 'string' && sigil.trim().length > 0) {
      _currentUser = sigil.trim().toLowerCase();
      return { uid: _currentUser, source: 'sigil' };
    }
  } catch {
    /* localStorage disabled · fall through to payload scan */
  }

  // 2. Master payload scan · priority order
  const payload = getPayload();

  // 2a · admin first
  if (payload.u[ADMIN_UID]) {
    _currentUser = ADMIN_UID;
    return { uid: ADMIN_UID, source: 'admin' };
  }

  // 2b · sovereign tier (paid annual / lifetime)
  for (const uid of Object.keys(payload.u)) {
    const record = payload.u[uid];
    if (record && record.subscription_tier === 'sovereign') {
      _currentUser = uid;
      return { uid, source: 'sovereign' };
    }
  }

  // 2c · non-expired trial
  const now = Date.now();
  for (const uid of Object.keys(payload.u)) {
    const record = payload.u[uid];
    if (record && record.trial_expires_at) {
      const expiresMs = new Date(record.trial_expires_at).getTime();
      if (Number.isFinite(expiresMs) && expiresMs > now) {
        _currentUser = uid;
        return { uid, source: 'trial' };
      }
    }
  }

  // 3. No active candidate · leave module state explicitly null
  _currentUser = null;
  return { uid: null, source: 'none' };
}

/**
 * Set the boot sigil (Phase 6.0h · Stage 2 forward-compat). When the
 * React login flow eventually exists, it should call this after a
 * successful PIN verify so subsequent hydrate() calls find the explicit
 * uid without scanning the payload.
 */
export function setCurrentUserSigil(uid: string | null): void {
  try {
    if (uid === null || uid === '') {
      localStorage.removeItem(CURRENT_USER_SIGIL_KEY);
    } else {
      localStorage.setItem(CURRENT_USER_SIGIL_KEY, uid.trim().toLowerCase());
    }
  } catch {
    /* best-effort */
  }
}

// ─── Auth state verification ─────────────────────────────────────────
export const ADMIN_UID = 'akeem' as const;

/** TS parity for BBF_IS_ADMIN · operator-wide override. */
export function isAdmin(): boolean {
  return _currentUser === ADMIN_UID;
}

/**
 * Three-state trial mirror · ports BBF_TRIAL_STATE() from
 * bbf-auth-engine.js lines 69-83 verbatim:
 *   - 'null'    → no trial ever started → blur + Sovereign CTA
 *   - 'active'  → trial running OR sovereign tier → full access
 *   - 'expired' → trial_expires_at <= NOW() → grey + lock + paywall
 * Display-only · server WS upgrade gate is the source of truth.
 */
export function getTrialState(uid: string | null = getActiveUid()): TrialState {
  if (isAdmin()) return 'active';
  if (!uid) return 'null';
  const u = getUserRecord(uid);
  if (!u) return 'null';
  if (u.subscription_tier === 'sovereign') return 'active';
  if (!u.trial_expires_at) return 'null';
  const ms = new Date(u.trial_expires_at).getTime();
  if (!isFinite(ms)) return 'null';
  return ms > Date.now() ? 'active' : 'expired';
}

export function isTrialActive(uid: string | null = getActiveUid()): boolean {
  return getTrialState(uid) === 'active';
}

/**
 * PIN-verify RPC · mirrors bbf-auth-engine.js LOGIN() lines 446-461.
 * Returns the raw RPC body so callers can drive their own UX (lockout
 * countdown, plans hydration, etc.). Lowercases the uid before sending
 * to satisfy the Phase 2.4 universal-lowercase-email CHECK constraints.
 */
export async function verifyUserPin(
  uid: string,
  pin: string,
  opts: { timeoutMs?: number } = {}
): Promise<PinVerifyResponse> {
  const url = getSupabaseUrl();
  const key = getSupabaseKey();
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutMs = opts.timeoutMs ?? 10000;
  const to = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null;
  try {
    const res = await fetch(`${url}/rest/v1/rpc/bbf_verify_user_pin`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uid: uid.trim().toLowerCase(),
        pin_attempt: pin.trim(),
      }),
      signal: ctl ? ctl.signal : null,
    });
    return (await res.json()) as PinVerifyResponse;
  } finally {
    if (to !== null) clearTimeout(to);
  }
}

// ─── Coach agent token (BBF_COACH_AGENT_TOKEN dual-storage) ──────────
/**
 * Read the founder/admin agent token. Mirrors the legacy bootstrap
 * (bbf-auth-engine.js lines 599-604) which persists the token in BOTH
 * localStorage and sessionStorage so cross-tab and same-tab gates both
 * work · sessionStorage wins on read because it survives tab refresh
 * but resets on close.
 */
export function getCoachAgentToken(): string | null {
  try {
    const s = sessionStorage.getItem(STORAGE_KEYS.COACH_AGENT_TOKEN);
    if (s) return s;
  } catch {
    /* sessionStorage may be disabled · fall through */
  }
  try {
    return localStorage.getItem(STORAGE_KEYS.COACH_AGENT_TOKEN);
  } catch {
    return null;
  }
}

export function setCoachAgentToken(token: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.COACH_AGENT_TOKEN, token);
  } catch {
    /* best-effort */
  }
  try {
    sessionStorage.setItem(STORAGE_KEYS.COACH_AGENT_TOKEN, token);
  } catch {
    /* best-effort */
  }
}

export function clearCoachAgentToken(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.COACH_AGENT_TOKEN);
  } catch {
    /* best-effort */
  }
  try {
    sessionStorage.removeItem(STORAGE_KEYS.COACH_AGENT_TOKEN);
  } catch {
    /* best-effort */
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Phase 4.3d · Live-Wire Data Layer (PASSOVER §5 steps d + e)
//
// All public.bbf_readiness + public.bbf_logs + public.bbf_sets writes go
// through this section. React components NEVER hit fetch / supabase
// directly · they call the named insert function below.
//
// SLUG → UUID RESOLVER
// The React layer identifies users by stable text slugs ('akeem',
// 'ana_bbf', etc.) stored in bbf_users.uid. The relational FK target
// for log tables is bbf_users.id (uuid). The legacy bbf-sync.js solved
// this with a `bbf_get_uid_map()` SECURITY DEFINER RPC that returns
// `TABLE(uid text, id uuid)` · we mirror the pattern here with a
// promise-shared one-flight bootstrap + Map cache so concurrent
// callers share a single network round-trip.
// ═══════════════════════════════════════════════════════════════════════

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const _uidMap: Map<string, string> = new Map();
let _uidMapPromise: Promise<void> | null = null;

function _restHeaders(): Record<string, string> {
  const key = getSupabaseKey();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
}

async function _ensureUidMap(force = false): Promise<void> {
  if (_uidMapPromise && !force) return _uidMapPromise;
  _uidMapPromise = (async () => {
    let success = false;
    try {
      const res = await fetch(`${getSupabaseUrl()}/rest/v1/rpc/bbf_get_uid_map`, {
        method: 'POST',
        headers: _restHeaders(),
        body: '{}',
      });
      if (!res.ok) {
        console.error(`[supabaseClient] bbf_get_uid_map HTTP ${res.status}`);
        return;
      }
      const rows: unknown = await res.json();
      if (!Array.isArray(rows)) {
        console.error('[supabaseClient] bbf_get_uid_map non-array response');
        return;
      }
      for (const r of rows) {
        if (r && typeof r === 'object') {
          const slug = (r as { uid?: unknown }).uid;
          const id = (r as { id?: unknown }).id;
          if (typeof slug === 'string' && typeof id === 'string' && slug && id) {
            // Normalize slug case at STORE time · the legacy server
            // sometimes returns mixed-case slugs (`Akeem`) while the
            // React layer always lowercases (Login.tsx::canonical).
            // Storing lower-case keeps lookups O(1) regardless of
            // server casing without a second pass at lookup time.
            _uidMap.set(slug.toLowerCase(), id);
            success = true;
          }
        }
      }
    } catch (err) {
      console.error(`[supabaseClient] bbf_get_uid_map threw: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      // Clear the cached promise on failure so the NEXT caller retries.
      // Without this, a single transient RPC failure (network blip,
      // 401 during a key rotation, etc.) wedged the resolver for the
      // lifetime of the page · `uid_not_resolvable` forever.
      if (!success) {
        _uidMapPromise = null;
      }
    }
  })();
  return _uidMapPromise;
}

/**
 * Convert a slug (e.g. 'akeem') OR a raw uuid pass-through into the
 * bbf_users.id uuid. Returns null when the slug isn't known to the
 * server (RPC empty, network failure, or genuinely missing user).
 * Idempotent · safe to call concurrently · the bootstrap RPC is
 * one-flight via a shared promise.
 *
 * Cache-miss retry · if the first lookup misses (stale cache from a
 * prior failed RPC, or a user provisioned server-side AFTER the cache
 * warmed), one forced refresh runs before giving up. This means a
 * just-signed-up user can submit on their first session without
 * waiting for a page reload to drop the cache.
 */
export async function resolveUserUuid(slugOrUuid: string | null | undefined): Promise<string | null> {
  if (!slugOrUuid) return null;
  const trimmed = slugOrUuid.trim();
  if (!trimmed) return null;
  if (UUID_RE.test(trimmed)) return trimmed;
  const lowered = trimmed.toLowerCase();

  await _ensureUidMap();
  const cached = _uidMap.get(lowered);
  if (cached) return cached;

  // Cache miss · force a refresh and try once more. Covers two cases:
  //   1. The first _ensureUidMap call failed (network blip) and left
  //      the cache empty · the retry now hits a working endpoint.
  //   2. The user was provisioned server-side AFTER the cache
  //      warmed (e.g. stripe-webhook fulfilment between page load
  //      and the user's first action) · the retry pulls the fresh
  //      slug → uuid row.
  await _ensureUidMap(true);
  return _uidMap.get(lowered) ?? null;
}

/** Test/diagnostic · drop the cached uid map so the next resolve re-fetches. */
export function resetUidMapCache(): void {
  _uidMap.clear();
  _uidMapPromise = null;
}

// ─── insertSomaticReadiness · PASSOVER §5e ──────────────────────────────
/**
 * Caller-facing payload for `insertSomaticReadiness`. The composite
 * `score` is the 0-100 readiness band; `sleep_quality` and
 * `soreness_level` are the 1-10 raw slider dimensions persisted as
 * their own columns. Energy / mood / stress feed into the composite
 * but have no dedicated column on `bbf_readiness` (6-col schema).
 */
export interface SomaticReadinessInsert {
  /** Composite 0-100 · the headline score the coach reads. */
  score: number;
  /** Optional · 1-10 raw slider value. */
  sleep_quality?: number;
  /** Optional · 1-10 raw slider value. */
  soreness_level?: number;
  /** Optional ISO timestamp · defaults to server `now()`. */
  timestamp?: string;
}

export type InsertReadinessResult =
  | { ok: true; id: string | null }
  | { ok: false; error: string };

/**
 * Write one row to `public.bbf_readiness`. Resolves the caller's slug
 * to the bbf_users.id uuid first, then POSTs the row via PostgREST
 * (`Prefer: return=representation` so we hand the created id back to
 * the caller for any follow-on writes). The anon role has INSERT
 * policy `Allow Anon Insert Readiness` (with_check true) so the
 * publishable key alone is sufficient · no service_role needed.
 */
export async function insertSomaticReadiness(
  uidSlugOrUuid: string,
  payload: SomaticReadinessInsert
): Promise<InsertReadinessResult> {
  const uuid = await resolveUserUuid(uidSlugOrUuid);
  if (!uuid) return { ok: false, error: 'uid_not_resolvable' };

  const row: Record<string, unknown> = {
    user_id: uuid,
    score: payload.score,
  };
  if (payload.sleep_quality  !== undefined) row.sleep_quality  = payload.sleep_quality;
  if (payload.soreness_level !== undefined) row.soreness_level = payload.soreness_level;
  if (payload.timestamp) row.timestamp = payload.timestamp;

  try {
    const res = await fetch(`${getSupabaseUrl()}/rest/v1/bbf_readiness`, {
      method: 'POST',
      headers: { ..._restHeaders(), Prefer: 'return=representation' },
      body: JSON.stringify(row),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `bbf_readiness HTTP ${res.status}: ${text.slice(0, 200)}` };
    }
    const created: unknown = await res.json();
    const id = Array.isArray(created) && created[0] && typeof (created[0] as { id?: unknown }).id === 'string'
      ? (created[0] as { id: string }).id
      : null;
    return { ok: true, id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `bbf_readiness network: ${msg}` };
  }
}

// ─── insertWorkoutSession · PASSOVER §5d ────────────────────────────────
/**
 * One `bbf_logs` row · the session header. All columns are optional
 * per the loose 10-col schema · `date` defaults to CURRENT_DATE
 * server-side and `language` defaults to 'en'.
 */
export interface WorkoutSessionLogInsert {
  date?: string;          // YYYY-MM-DD · defaults server-side
  sport?: string;
  position?: string;
  drill_name?: string;
  coach_notes?: string;
  language?: string;      // 'en' | 'es' | 'pt'
  body_fat?: string;
  duration?: string;
}

/**
 * One `bbf_sets` row · per-set tonnage. `log_id` and `user_id` are
 * injected by `insertWorkoutSession` from the parent log + the
 * resolved uuid · callers never specify them.
 */
export interface WorkoutSessionSetInsert {
  set_number?: number;
  reps?: number | null;
  weight_lbs?: number | null;
  rpe?: number | null;
  day_key?: string | null;
  exercise_key?: string | null;
}

export type InsertWorkoutSessionResult =
  | { ok: true; log_id: string; sets_inserted: number }
  | { ok: false; error: string; partial?: { log_id?: string; cleanup_ok?: boolean } };

/**
 * Relational write to `public.bbf_logs` + `public.bbf_sets`. PostgREST
 * has no multi-table transaction primitive so we order the inserts
 * carefully and fall back to a best-effort orphan cleanup on the
 * second-step failure:
 *
 *   1. POST /rest/v1/bbf_logs (Prefer: return=representation) → log_id
 *   2. POST /rest/v1/bbf_sets (bulk array body · single request) ·
 *      each set gets `log_id` + `user_id` injected
 *   3. If step 2 fails, DELETE /rest/v1/bbf_logs?id=eq.<log_id> ·
 *      anon has DELETE policy `Allow Anon Delete Logs` · cleanup_ok
 *      flag reports whether the deletion 200'd
 *
 * Returns the inserted log_id + set count on full success, or a
 * structured error with the partial state on failure so the caller
 * can surface a diagnostic without ambiguity about whether a row was
 * left behind.
 *
 * NOTE on transactional integrity: true ACID requires a server-side
 * RPC that wraps both inserts in BEGIN/COMMIT. That path lands when
 * the operator authorizes a `bbf_insert_workout_session` migration ·
 * for now the orphan-cleanup fallback is the best the REST layer can
 * offer without DDL.
 */
export async function insertWorkoutSession(
  uidSlugOrUuid: string,
  logPayload: WorkoutSessionLogInsert,
  setsPayload: ReadonlyArray<WorkoutSessionSetInsert>
): Promise<InsertWorkoutSessionResult> {
  const uuid = await resolveUserUuid(uidSlugOrUuid);
  if (!uuid) return { ok: false, error: 'uid_not_resolvable' };

  const url = getSupabaseUrl();
  const headers = _restHeaders();

  // ── Step 1 · insert bbf_logs row ────────────────────────────────────
  const logRow: Record<string, unknown> = { user_id: uuid };
  if (logPayload.date)        logRow.date = logPayload.date;
  if (logPayload.sport)       logRow.sport = logPayload.sport;
  if (logPayload.position)    logRow.position = logPayload.position;
  if (logPayload.drill_name)  logRow.drill_name = logPayload.drill_name;
  if (logPayload.coach_notes) logRow.coach_notes = logPayload.coach_notes;
  if (logPayload.language)    logRow.language = logPayload.language;
  if (logPayload.body_fat)    logRow.body_fat = logPayload.body_fat;
  if (logPayload.duration)    logRow.duration = logPayload.duration;

  let logId: string;
  try {
    const res = await fetch(`${url}/rest/v1/bbf_logs`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify(logRow),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `bbf_logs HTTP ${res.status}: ${text.slice(0, 200)}` };
    }
    const created: unknown = await res.json();
    const candidate = Array.isArray(created) && created[0] && typeof (created[0] as { id?: unknown }).id === 'string'
      ? (created[0] as { id: string }).id
      : null;
    if (!candidate) return { ok: false, error: 'bbf_logs response missing id' };
    logId = candidate;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `bbf_logs network: ${msg}` };
  }

  // ── Step 2 · early-return when no sets queued ──────────────────────
  if (setsPayload.length === 0) {
    return { ok: true, log_id: logId, sets_inserted: 0 };
  }

  // ── Step 3 · bulk insert bbf_sets · single round-trip ──────────────
  const setRows: Record<string, unknown>[] = setsPayload.map((s, idx) => {
    const row: Record<string, unknown> = {
      log_id: logId,
      user_id: uuid,
      set_number: s.set_number ?? idx + 1,
    };
    if (s.reps         != null) row.reps         = s.reps;
    if (s.weight_lbs   != null) row.weight_lbs   = s.weight_lbs;
    if (s.rpe          != null) row.rpe          = s.rpe;
    if (s.day_key)              row.day_key      = s.day_key;
    if (s.exercise_key)         row.exercise_key = s.exercise_key;
    return row;
  });

  try {
    const res = await fetch(`${url}/rest/v1/bbf_sets`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify(setRows),
    });
    if (!res.ok) {
      const text = await res.text();
      const cleanupOk = await _bestEffortDeleteLog(logId);
      return {
        ok: false,
        error: `bbf_sets HTTP ${res.status}: ${text.slice(0, 200)}`,
        partial: { log_id: logId, cleanup_ok: cleanupOk },
      };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const cleanupOk = await _bestEffortDeleteLog(logId);
    return {
      ok: false,
      error: `bbf_sets network: ${msg}`,
      partial: { log_id: logId, cleanup_ok: cleanupOk },
    };
  }

  return { ok: true, log_id: logId, sets_inserted: setRows.length };
}

async function _bestEffortDeleteLog(logId: string): Promise<boolean> {
  try {
    const res = await fetch(
      `${getSupabaseUrl()}/rest/v1/bbf_logs?id=eq.${encodeURIComponent(logId)}`,
      { method: 'DELETE', headers: _restHeaders() }
    );
    return res.ok;
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Phase 4.3e · Cardio + Profile + Edge-function bindings
// (PASSOVER §5 steps c + f · final UI grocery-list closeout)
//
// Three additions:
//   1. `insertCardioSession(uid, payload)` writes one row to
//      `public.bbf_athlete_load_logs` (anon INSERT confirmed via
//      pg_policy · client generates the log_id uuid since the column
//      is NOT NULL with no default).
//   2. `updateUserProfile(uidSlug, patch)` writes to the local
//      BBFPayload via `setUserRecord`. Anon has only SELECT on
//      bbf_users · a cloud-sync RPC `bbf_update_profile` does not
//      exist yet · the patch lands in localStorage immediately and
//      the future sync RPC will drain it to bbf_users.
//   3. `callEdgeFunction<T>(name, body)` is the typed POST helper
//      for `/functions/v1/<name>` · used by `generateMealImage` and
//      `analyzeMealMacros` (the NutritionVision live-wire targets).
//      Edge functions return `{ ok: false, error }` on validation
//      failure so the helper normalises both transport-level errors
//      (HTTP 4xx/5xx) and application-level errors (`ok: false`)
//      into a single discriminated union the React caller can
//      surface in a UI banner.
// ═══════════════════════════════════════════════════════════════════════

// ─── insertCardioSession · PASSOVER §5c ────────────────────────────────
export interface CardioSessionInsert {
  /** 'cardio_run' | 'cardio_bike' | 'cardio_swim' | 'cardio_row' | 'cardio_other'. */
  session_type: string;
  duration_minutes: number;
  /** Session RPE 1-10. */
  srpe_intensity: number;
  /** Optional · defaults to `duration_minutes * srpe_intensity` (Foster sRPE-load). */
  load_au?: number;
  /** Optional ISO timestamp · defaults to now. */
  session_timestamp?: string;
}

export type InsertCardioResult =
  | { ok: true; log_id: string }
  | { ok: false; error: string };

/**
 * Write one row to `public.bbf_athlete_load_logs`. The column
 * `log_id` is NOT NULL with no default, so we generate a uuid
 * client-side via `crypto.randomUUID()` (universally available in
 * the evergreen browsers Vite targets). `load_au` defaults to the
 * Foster sRPE-load product (duration × sRPE) when the caller doesn't
 * supply one · sentinel guarantees the column stays meaningful even
 * when callers omit the explicit value.
 */
export async function insertCardioSession(
  uidSlugOrUuid: string,
  payload: CardioSessionInsert
): Promise<InsertCardioResult> {
  const uuid = await resolveUserUuid(uidSlugOrUuid);
  if (!uuid) return { ok: false, error: 'uid_not_resolvable' };

  const logId = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    ? crypto.randomUUID()
    : _fallbackUuid();

  const row = {
    log_id: logId,
    athlete_id: uuid,
    session_timestamp: payload.session_timestamp ?? new Date().toISOString(),
    session_type: payload.session_type,
    duration_minutes: payload.duration_minutes,
    srpe_intensity: payload.srpe_intensity,
    load_au: payload.load_au ?? (payload.duration_minutes * payload.srpe_intensity),
  };

  try {
    const res = await fetch(`${getSupabaseUrl()}/rest/v1/bbf_athlete_load_logs`, {
      method: 'POST',
      headers: { ..._restHeaders(), Prefer: 'return=minimal' },
      body: JSON.stringify(row),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `bbf_athlete_load_logs HTTP ${res.status}: ${text.slice(0, 200)}` };
    }
    return { ok: true, log_id: logId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `bbf_athlete_load_logs network: ${msg}` };
  }
}

function _fallbackUuid(): string {
  // Best-effort v4-shaped string for the rare environment without
  // crypto.randomUUID (e.g. some older Safari iframes). The DB
  // accepts any uuid-shaped value · this is purely a graceful
  // degradation path, not a security-grade source of randomness.
  const r = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1);
  return `${r()}${r()}-${r()}-4${r().slice(1)}-${(8 + Math.floor(Math.random() * 4)).toString(16)}${r().slice(1)}-${r()}${r()}${r()}`;
}

// ─── updateUserProfile · PASSOVER §5f (local-write path) ───────────────
export interface ProfilePatch {
  name?: string;
  email?: string;
  tdee_target?: number;
  macro_p?: number;
  macro_c?: number;
  macro_f?: number;
  dietary_profile?: string;
}

export type UpdateProfileResult =
  | { ok: true; persisted_locally: true }
  | { ok: false; error: string };

/**
 * Write profile fields to the local BBFPayload via `setUserRecord`.
 *
 * Why local-only: anon's RLS on `bbf_users` permits SELECT only ·
 * a `bbf_update_profile` SECURITY DEFINER RPC does not exist (only
 * `bbf_get_profile_metrics`, `bbf_soft_delete_user`, and
 * `bbf_verify_user_pin` are present per pg_proc). The legacy
 * `bbf-sync.js` queue drains these patches to the server via the
 * batched outbound sync pipeline · until that pipeline is ported to
 * React, the patches survive only on the device.
 *
 * The return shape is intentionally async (Promise) so React callers
 * can apply the same double-submit shield they use for the cloud
 * inserts · the awaited resolution is effectively zero-latency but
 * the contract is identical.
 */
export async function updateUserProfile(
  uidSlug: string,
  patch: ProfilePatch
): Promise<UpdateProfileResult> {
  if (!uidSlug) return { ok: false, error: 'no_uid' };
  const ok = setUserRecord(uidSlug, patch as Partial<BBFUserRecord>);
  if (!ok) return { ok: false, error: 'localStorage_write_failed' };
  return { ok: true, persisted_locally: true };
}

// ─── Edge-function caller + Nutrition wire-ups ──────────────────────────
export type EdgeFunctionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

/**
 * Typed POST to `${SUPABASE_URL}/functions/v1/<name>`. Normalises
 * three failure modes into a single error path:
 *
 *   1. Network failure (`fetch` rejection) · returns
 *      `{ok:false,error:'network: <msg>'}`.
 *   2. Transport-level HTTP error (4xx / 5xx) · returns
 *      `{ok:false,error:<body.error || 'HTTP <n>'>, status:<n>}`.
 *   3. Application-level error · the function returned 200 but with
 *      `{ ok: false, error: <msg> }` per the BBF edge-function
 *      convention · returns `{ok:false,error:<msg>}`.
 *
 * On success returns `{ok:true,data:<parsed JSON>}`. Callers cast
 * the generic via the explicit type parameter.
 *
 * The optional `headers` field merges into the base apikey +
 * Authorization + Content-Type triplet · agentic-* functions that
 * env-gate on `X-BBF-Admin-Token` rely on this so the legacy admin
 * path keeps working from the React layer.
 */
export async function callEdgeFunction<T>(
  name: string,
  body: unknown,
  opts: { headers?: Record<string, string> } = {}
): Promise<EdgeFunctionResult<T>> {
  try {
    const res = await fetch(`${getSupabaseUrl()}/functions/v1/${name}`, {
      method: 'POST',
      headers: { ..._restHeaders(), ...(opts.headers ?? {}) },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let parsed: unknown = null;
    try { parsed = text ? JSON.parse(text) : null; } catch { /* not JSON */ }

    if (!res.ok) {
      const msg = (parsed && typeof parsed === 'object' && 'error' in parsed && typeof (parsed as { error: unknown }).error === 'string')
        ? (parsed as { error: string }).error
        : `HTTP ${res.status}`;
      return { ok: false, error: msg, status: res.status };
    }
    if (parsed && typeof parsed === 'object' && 'ok' in parsed && (parsed as { ok: unknown }).ok === false) {
      const err = (parsed as { error?: unknown }).error;
      return { ok: false, error: typeof err === 'string' ? err : 'edge_function_error' };
    }
    return { ok: true, data: parsed as T };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `network: ${msg}` };
  }
}

/**
 * Build the optional admin-token header for `bbf-agentic-*` edge
 * functions. The functions env-gate on `BBF_COACH_AGENT_TOKEN` ·
 * if the token is set server-side, callers MUST forward it as
 * `X-BBF-Admin-Token` or the function returns 401. Coaches have the
 * token in localStorage/sessionStorage; athletes don't, so for
 * athlete-facing surfaces this returns an empty object and the
 * function defaults to allow when env unset.
 */
function _agentHeaders(): Record<string, string> {
  const tok = getCoachAgentToken();
  return tok ? { 'X-BBF-Admin-Token': tok } : {};
}

export interface MealImageResponse {
  ok: true;
  image_url: string;
  source: 'cache' | 'gemini_imagen_3';
  name_display: string;
}

/**
 * Generate (or fetch from cache) a top-down stock photograph for a
 * named meal · powers the NutritionVision "Scan Meal" button.
 */
export function generateMealImage(
  name: string,
  ingredients?: string
): Promise<EdgeFunctionResult<MealImageResponse>> {
  return callEdgeFunction<MealImageResponse>('bbf-meal-image', { name, ingredients });
}

export interface MealMacrosResponse {
  ok: true;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: number;
  source: 'cache' | 'claude_haiku';
  name_display: string;
}

/**
 * Resolve macros (kcal + P/C/F) for a named meal · cache-first, then
 * Claude Haiku · powers the NutritionVision "Generate Protocol"
 * button.
 */
export function analyzeMealMacros(
  name: string,
  opts: { ingredients?: string; lang?: 'en' | 'es' | 'pt' } = {}
): Promise<EdgeFunctionResult<MealMacrosResponse>> {
  return callEdgeFunction<MealMacrosResponse>('bbf-meal-macros', {
    name,
    ingredients: opts.ingredients,
    lang: opts.lang ?? 'en',
  });
}

// ─── Phase 4.3h · Prehab Friction Scanner + Linguist wire-ups ──────────
// Both surfaces talk to the existing Phase 6.0k-converted edge
// functions (`bbf-agentic-prehab` + `bbf-agentic-linguist`) which
// route through the canonical _shared/anthropic-call.ts helper. The
// response shapes were preserved verbatim across that conversion ·
// these client helpers map 1:1 onto the edge functions' JSON
// contracts.

export interface PrehabMovement {
  name:     string;
  duration: string;
  focus:    string;
  reason:   string;
}

export interface PrehabMatrixResponse {
  matrix: ReadonlyArray<PrehabMovement>;
}

export interface PrehabMatrixRequest {
  reported_friction?: string;
  goal?:    string;
  partner?: string;
}

/**
 * Generate a 3-movement recovery / prehab matrix for the active
 * athlete · powers the Friction Scanner "Generate Recovery Matrix"
 * button. The edge function pre-resolves the uid via its own RPC
 * lookup; we forward a hint `actual_uuid` from our local resolver
 * when it's already warm to save the round-trip.
 */
export async function generatePrehabMatrix(
  uidSlug: string,
  payload: PrehabMatrixRequest = {}
): Promise<EdgeFunctionResult<PrehabMatrixResponse>> {
  const actualUuid = await resolveUserUuid(uidSlug);
  const today = new Date().toISOString().slice(0, 10);
  return callEdgeFunction<PrehabMatrixResponse>(
    'bbf-agentic-prehab',
    {
      uid:               uidSlug,
      actual_uuid:       actualUuid,
      reported_friction: payload.reported_friction ?? '',
      client_context:    {
        today,
        goal:    payload.goal,
        partner: payload.partner,
      },
      admin_override:    false,
    },
    { headers: _agentHeaders() }
  );
}

export interface TranslationResponse {
  translation:     string;
  phonetic:        string;
  literal_meaning: string;
}

/**
 * Translate an English coaching cue into the target language with a
 * phonetic guide + literal back-translation · powers the Sovereign
 * Linguistics card. Backed by `bbf-agentic-linguist` (Haiku-tier ·
 * fallback escalates to Sonnet per FALLBACK_POLICY).
 */
export function translateCoachingCue(
  uidSlug: string,
  englishCue: string,
  targetLanguage: string = 'es'
): Promise<EdgeFunctionResult<TranslationResponse>> {
  return callEdgeFunction<TranslationResponse>(
    'bbf-agentic-linguist',
    {
      uid:             uidSlug,
      english_cue:     englishCue,
      target_language: targetLanguage,
    },
    { headers: _agentHeaders() }
  );
}
