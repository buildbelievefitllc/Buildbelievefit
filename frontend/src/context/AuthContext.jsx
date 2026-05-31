// src/context/AuthContext.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 2 — The Authentication Context ("nervous system" of the app).
//
// Responsibilities:
//   • Initialize the Supabase session on first load (getSession).
//   • Subscribe to auth changes (onAuthStateChange) for live login/logout.
//   • Expose { session, user, loading } to the whole tree via useAuth().
//
// `loading` is true until the initial session resolves — consumers (e.g. the
// protected route) MUST gate on it to avoid redirecting before auth is known.
// No UI, RBAC, or login flow is implemented here yet — that lands in later phases.

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

const AuthContext = createContext({ session: null, user: null, loading: true });

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    // 1) Resolve the session that already exists at load time.
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(data?.session ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setSession(null);
        setLoading(false);
      });

    // 2) Keep it in sync with every subsequent auth change.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next ?? null);
    });

    return () => {
      active = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  const value = { session, user: session?.user ?? null, loading };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}

export default AuthContext;
