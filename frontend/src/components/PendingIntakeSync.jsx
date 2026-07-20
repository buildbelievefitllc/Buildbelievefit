// src/components/PendingIntakeSync.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Post-auth intake consumer. Mounted once at the app root; it listens for a
// resolved Supabase auth session (the /assessment wizard ends in OAuth, so a real
// GoTrue session lands on the /select-tier redirect). On the first session it
// finds a staged intake in localStorage['bbf_pending_intake'], writes it to
// public.bbf_intake_submissions (RLS self-insert: auth.uid() = user_id), and
// purges the storage key. Renders nothing.
//
// Failure is non-fatal to the session: on a write error the key is LEFT in place
// and the guard released so a later auth event retries. One in-flight attempt at a
// time (ref guard) so a burst of auth events can't double-insert.

import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient.js';

export const PENDING_INTAKE_KEY = 'bbf_pending_intake';

export default function PendingIntakeSync() {
  const inFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function trySync(session) {
      const uid = session?.user?.id;
      if (!uid || inFlight.current || cancelled) return;

      let raw;
      try { raw = localStorage.getItem(PENDING_INTAKE_KEY); } catch { return; }
      if (!raw) return;

      let parsed;
      try { parsed = JSON.parse(raw); }
      catch { try { localStorage.removeItem(PENDING_INTAKE_KEY); } catch { /* ignore */ } return; }

      inFlight.current = true;
      const { error } = await supabase
        .from('bbf_intake_submissions')
        .insert({ user_id: uid, payload: parsed?.answers ?? parsed, source: 'assessment' });

      if (cancelled) return;
      if (error) {
        // Leave the payload staged; a later auth event will retry.
        inFlight.current = false;
        console.warn('[PendingIntakeSync] intake write deferred:', error.message);
        return;
      }
      try { localStorage.removeItem(PENDING_INTAKE_KEY); } catch { /* ignore */ }
    }

    // Catch an already-established session (redirect already resolved)…
    supabase.auth.getSession().then(({ data }) => trySync(data?.session)).catch(() => {});
    // …and any that resolves after mount (OAuth hash exchange completes).
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => { trySync(session); });

    return () => { cancelled = true; sub?.subscription?.unsubscribe?.(); };
  }, []);

  return null;
}
