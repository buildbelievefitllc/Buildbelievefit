// src/context/AuthContext.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 3 — Authentication Context, revised to mirror the LIVE auth model.
//
// IMPORTANT (architecture note): the legacy monolith does NOT use Supabase
// GoTrue / signInWithPassword. The real login is username + 6-digit PIN, POSTed
// to a Postgres RPC `bbf_verify_user_pin` (bbf-app.html:5722), which also
// enforces server-side lockout/throttle and returns the user's plans. There are
// no rows in auth.users for these accounts — a GoTrue getSession() would always
// be null. So this context wraps the PIN RPC instead.
//
// The Phase 2 contract is preserved: consumers still read { session, user,
// loading }. Added: signInWithPin(uid, pin) and signOut(). Because the PIN RPC
// issues no JWT/refresh token, the authenticated identity is persisted to
// localStorage and rehydrated on load (parity with the monolith's GD() store).
//
// Phase 21.1 — Vault session token. The PIN RPC now mints a short-lived (24h),
// server-revocable `vault_token` at login. We persist THAT token in the session
// envelope (never the raw PIN) so the cloud-write RPCs (bbf_sync_vault_session /
// bbf_sync_readiness) can authorize a SECURITY DEFINER write without ever seeing
// the PIN again. `getStoredVaultToken()` is the single, shared read-side accessor
// for non-React callers (programApi.js) — keeping STORAGE_KEY owned by this file.

import { createContext, useContext, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { resolveProgramKey } from '../lib/personaResolver.js';
import { resolveSportsProfile, homePathForUser } from '../lib/sportsRoster.js';
import { formatDisplayName } from '../lib/displayName.js';
import { clearAdminToken } from '../lib/adminAuth.js';

const STORAGE_KEY = 'bbf.session.v1';

const AuthContext = createContext({
  session: null,
  user: null,
  loading: true,
  isAdmin: false,
  signInWithPin: async () => ({ ok: false }),
  signOut: () => {},
});

function readStoredSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Shared read-side accessor for the persisted vault session token. Lives here so
// STORAGE_KEY has exactly one owner; programApi.js imports this instead of
// reaching into localStorage with a duplicated key. Returns '' when absent —
// callers treat the empty/expired case identically (force a re-login).
// eslint-disable-next-line react-refresh/only-export-components
export function getStoredVaultToken() {
  return readStoredSession()?.vaultToken || '';
}

export function AuthProvider({ children }) {
  // Rehydrate synchronously via lazy initializer — localStorage is sync, so
  // there is no async session fetch to wait on; the session is known at first
  // render and `loading` is only kept for API/contract parity with Phase 2.
  const [session, setSession] = useState(readStoredSession);
  const [loading] = useState(false);

  // username + PIN → bbf_verify_user_pin RPC. Returns a normalized result the
  // Login UI can branch on: { ok } | { ok:false, lockout, retryAfter } | error.
  const signInWithPin = useCallback(async (uid, pin) => {
    const username = (uid || '').trim().toLowerCase();
    const pinAttempt = (pin || '').trim();
    if (!username || !pinAttempt) {
      return { ok: false, reason: 'missing', message: 'Enter username and PIN.' };
    }

    const { data, error } = await supabase.rpc('bbf_verify_user_pin', {
      uid: username,
      pin_attempt: pinAttempt,
    });

    if (error) {
      return { ok: false, reason: 'network', message: 'Authentication error. Check connection.' };
    }

    if (!data?.ok) {
      // Kill switch (Access Control): the PIN was correct but the account is
      // administratively locked — no vault_token was minted, so deny entry with a
      // distinct, honest message rather than the generic "incorrect PIN".
      if (data?.account_locked) {
        return {
          ok: false,
          reason: 'locked',
          message: 'This account has been locked by an administrator. Contact the head coach.',
        };
      }
      if (data?.lockout_active && data?.retry_after_seconds > 0) {
        return {
          ok: false,
          reason: 'lockout',
          retryAfter: data.retry_after_seconds,
          message: 'Account temporarily locked.',
        };
      }
      return { ok: false, reason: 'invalid', message: 'Incorrect username or PIN.' };
    }

    // Success — build a lightweight session and persist it. We store the
    // server-minted vault_token (NOT the PIN) — this is the credential the cloud
    // write RPCs replay. Absent token ⇒ '' so downstream sync force-relogins.
    const nextSession = {
      uid: username,
      vaultToken: data.vault_token ?? '',
      user: {
        id: username,
        username,
        role: data.role ?? null,
        type: data.type ?? null,
        // Assigned program persona. The PIN RPC has no key field today, so this
        // resolves from the slug map; `data.workout_plan_key` future-proofs it
        // for when the payload carries an explicit key.
        programKey: resolveProgramKey(username, data.workout_plan_key),
      },
      // Inject the plan envelope whenever the RPC returns ANY plan text — do not
      // gate solely on plans_generated_at. A client can have a coach-written
      // workout/meal plan with a null generated-at stamp (legacy backfills), and
      // suppressing it would blank the Program/Nutrition surfaces with data that
      // actually exists. `plans_available` is kept as an additional signal.
      plans: (data.plans_available || (data.workout_plan || '').trim() || (data.meal_plan || '').trim() || data.sports_protocol)
        ? {
            workout_plan: data.workout_plan ?? '',
            meal_plan: data.meal_plan ?? '',
            // Native Sport Engine payload (coach-staged in bbf_active_clients via the
            // Pathfinder intake). Carried through verbatim; SportsHub normalizes +
            // renders it (null → the General Physical Preparedness fallback).
            sports_protocol: data.sports_protocol ?? null,
            plans_generated_at: data.plans_generated_at ?? null,
          }
        : null,
      authenticatedAt: Date.now(),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
    } catch {
      /* private-mode / quota — session stays in-memory for this tab */
    }
    setSession(nextSession);
    // The Routing Fork target, resolved deterministically from the freshly-built
    // session (NOT the async context `user`, which hasn't re-rendered yet): a
    // flagged sports athlete → The Sports Hub, everyone else → the Sovereign Vault.
    // Login.jsx navigates to this so it never races the setState above.
    return { ok: true, home: homePathForUser(nextSession.user) };
  }, []);

  const signOut = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    // Wipe the session-scoped admin token too, so the next user of this tab can't
    // replay the Command Center secret (§7).
    clearAdminToken();
    setSession(null);
  }, []);

  // Authorization derived from the session role. Admin tier = role admin/trainer.
  // The `akeem` username fallback mirrors the monolith (bbf-app.html:5530) so a
  // missing/stale role in a persisted session can never lock the head coach out of
  // his own Command Center. Fail-closed: any unknown/empty role is NOT admin.
  const currentUser = session?.user ?? null;
  // Resolve the program persona here too — sessions persisted BEFORE this shipped
  // have no programKey, so re-deriving from the slug lets existing logins map
  // correctly without forcing a re-auth. Any explicit key on the session wins.
  const programKey = currentUser
    ? resolveProgramKey(currentUser.username, currentUser.programKey)
    : null;
  // Presentable full name for the Vault greeting (the slug carries no display
  // name). Client Zero `akeem` → "Akeem Brown".
  // Sports-division profile (age/sport/position/focus), resolved the same way as
  // programKey — from a client-side seed keyed off the slug (lib/sportsRoster.js),
  // or an explicit auth-payload flag. Non-null ⇒ this account is a sports athlete,
  // which drives the post-login Routing Fork into The Sports Hub. Sessions persisted
  // before this shipped re-derive on load, so no re-auth is forced.
  const sportsProfile = currentUser ? resolveSportsProfile(currentUser) : null;
  const user = currentUser
    ? { ...currentUser, programKey, displayName: formatDisplayName(currentUser.username), sportsProfile }
    : null;

  const role = String(user?.role || '').trim().toLowerCase();
  const isAdmin = role === 'admin' || role === 'trainer'
    || String(user?.username || '').trim().toLowerCase() === 'akeem';

  const value = {
    session,
    user,
    loading,
    isAdmin,
    signInWithPin,
    signOut,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}

export default AuthContext;
