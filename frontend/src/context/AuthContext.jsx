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

import { createContext, useContext, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { resolveProgramKey } from '../lib/personaResolver.js';

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

    // Success — build a lightweight session and persist it.
    const nextSession = {
      uid: username,
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
      plans: data.plans_available
        ? {
            workout_plan: data.workout_plan ?? '',
            meal_plan: data.meal_plan ?? '',
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
    return { ok: true };
  }, []);

  const signOut = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
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
  const user = currentUser ? { ...currentUser, programKey } : null;

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
