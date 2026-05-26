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
