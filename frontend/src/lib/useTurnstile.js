// src/lib/useTurnstile.js
// ─────────────────────────────────────────────────────────────────────────────
// Cloudflare Turnstile (invisible mode) for the public lead form. The
// bbf-lead-capture edge function HARD-REQUIRES a valid turnstile_token and
// fail-closes (403) without one, so this is mandatory, not optional.
//
// Mirrors the legacy storefront (index.html): explicit-render an invisible widget,
// then on submit reset + execute() it and resolve the single-use token from the
// success callback. Site key is the public storefront key (safe in client code).

import { useCallback, useEffect, useRef, useState } from 'react';

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

// Load the Turnstile script once (module-level cache), resolve when window.turnstile is live.
let _scriptPromise = null;
function loadTurnstile() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no_window'));
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (_scriptPromise) return _scriptPromise;
  _scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onerror = () => { _scriptPromise = null; reject(new Error('turnstile_script_failed')); };
    s.onload = () => {
      const started = Date.now();
      const poll = setInterval(() => {
        if (window.turnstile) { clearInterval(poll); resolve(window.turnstile); }
        else if (Date.now() - started > 8000) { clearInterval(poll); reject(new Error('turnstile_unavailable')); }
      }, 40);
    };
    document.head.appendChild(s);
  });
  return _scriptPromise;
}

export function useTurnstile(siteKey) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const pendingRef = useRef(null); // { resolve, reject } for an in-flight execute()
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    loadTurnstile()
      .then((ts) => {
        if (cancelled || !containerRef.current || widgetIdRef.current != null) return;
        try {
          widgetIdRef.current = ts.render(containerRef.current, {
            sitekey: siteKey,
            size: 'invisible',
            callback: (token) => {
              const p = pendingRef.current; pendingRef.current = null;
              if (p) p.resolve(token);
            },
            'error-callback': () => {
              const p = pendingRef.current; pendingRef.current = null;
              if (p) p.reject(new Error('turnstile_error'));
            },
            'expired-callback': () => { /* token expired before use — next execute() re-issues */ },
          });
          if (!cancelled) setReady(true);
        } catch {
          if (!cancelled) setError('turnstile_render_failed');
        }
      })
      .catch(() => { if (!cancelled) setError('turnstile_unavailable'); });

    return () => {
      cancelled = true;
      if (window.turnstile && widgetIdRef.current != null) {
        try { window.turnstile.remove(widgetIdRef.current); } catch { /* already gone */ }
        widgetIdRef.current = null; // allow a clean re-render on StrictMode remount
      }
    };
  }, [siteKey]);

  // Returns a Promise<string> resolving to a fresh single-use token, or rejecting
  // with a coded Error the caller can surface.
  const obtainToken = useCallback(() => new Promise((resolve, reject) => {
    const ts = window.turnstile;
    if (!ts || widgetIdRef.current == null) { reject(new Error('turnstile_unavailable')); return; }
    try { ts.reset(widgetIdRef.current); } catch { /* fine */ }

    const timer = setTimeout(() => {
      if (pendingRef.current) { pendingRef.current = null; reject(new Error('turnstile_timeout')); }
    }, 9000);
    pendingRef.current = {
      resolve: (tok) => { clearTimeout(timer); resolve(tok); },
      reject: (err) => { clearTimeout(timer); reject(err); },
    };
    try { ts.execute(widgetIdRef.current); }
    catch { clearTimeout(timer); pendingRef.current = null; reject(new Error('turnstile_execute_failed')); }
  }), []);

  return { containerRef, obtainToken, ready, error };
}
