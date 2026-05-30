// src/context/AuthContext.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Global auth/session context for the BBF React app.
//
// Phase 1 (scaffolding): provides the shape and the Supabase session wiring so
// later phases can drop in the real login flow + role gating (admin / trainer /
// client) that the monolith currently enforces via BBF_IS_*_ADMIN(). No routing
// or RBAC decisions are made yet — this just exposes { session, user, loading }.

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

const AuthContext = createContext({ session: null, user: null, loading: true });

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data?.session ?? null);
      setLoading(false);
    });

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
