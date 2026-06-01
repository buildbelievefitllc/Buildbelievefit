// src/components/command/CommandRoster.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 20.3 — Sovereign Command Center · roster (admin).
// Phase 20.5 — Live data wiring: fetches the bbf-command-feed payload (Terminal 3)
// instead of mocked state. Styling in the scoped command.css (.cc-*).
//
// Feed → row mapping (see lib/commandFeedApi.js):
//   training.status   → FORM CHECK toggle   (green ⇒ on)
//   nutrition.status  → NUTRITION toggle    (green ⇒ on)
//   biometrics.status → BIOMETRICS toggle   (not in the contract yet → off)
//   overall_status    → Active/Paused pill
//
// Auth: the feed is admin-gated (X-BBF-Admin-Token = BBF_COACH_AGENT_TOKEN, the
// same secret Client Hub uses). If no token is present, we show an inline gate
// so the coach can authenticate on this surface and load immediately.
//
// The toggles reflect LIVE compliance from the feed. They remain clickable as a
// local visual affordance (override map) — there is no write-back endpoint yet,
// so a flip does not persist (a future PATCH to bbf-command-feed wires that).

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchCommandFeed } from '../../lib/commandFeedApi.js';
import { writeToken } from '../../lib/rosterApi.js';
import './command.css';

const MODULES = [
  { key: 'biometrics', label: 'Biometrics' },
  { key: 'nutrition', label: 'Nutrition' },
  { key: 'formCheck', label: 'Form Check' },
];

function initials(name) {
  return String(name || '?').trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

export default function CommandRoster() {
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [overrides, setOverrides] = useState({}); // `${id}:${key}` → bool (local visual)
  const mounted = useRef(true);

  useEffect(() => () => { mounted.current = false; }, []);

  // Kicks the async fetch; no synchronous setState here (clears the effect lint).
  const load = useCallback(() => {
    fetchCommandFeed()
      .then((cs) => { if (mounted.current) { setClients(cs); setNeedsAuth(false); setError(null); } })
      .catch((e) => {
        if (!mounted.current) return;
        if (e.code === 'no_token') setNeedsAuth(true);
        else setError(e.message || 'Failed to load the command feed.');
      })
      .finally(() => { if (mounted.current) setIsLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const reload = () => { setIsLoading(true); setError(null); load(); };
  const authenticate = () => {
    const t = tokenInput.trim();
    if (!t) return;
    writeToken(t);
    setTokenInput('');
    setIsLoading(true);
    setNeedsAuth(false);
    load();
  };

  const toggle = (id, key) => {
    setOverrides((o) => {
      const k = `${id}:${key}`;
      const client = clients.find((c) => c.id === id);
      const live = !!client?.modules?.[key];
      const cur = k in o ? o[k] : live;
      return { ...o, [k]: !cur };
    });
  };

  const moduleOn = (c, key) => {
    const k = `${c.id}:${key}`;
    return k in overrides ? overrides[k] : !!c.modules?.[key];
  };

  const activeCount = clients.filter((c) => c.status === 'active').length;
  const formPending = clients.filter((c) => !moduleOn(c, 'formCheck')).length;

  return (
    <div className="cc">
      <header className="cc-head">
        <div className="cc-kicker">Build Believe Fit · Admin Console</div>
        <h1 className="cc-title">SOVEREIGN COMMAND CENTER</h1>
        <div className="cc-rule" />
      </header>

      {isLoading ? (
        <div className="cc-state"><span className="cc-state-spinner" aria-hidden="true" /> Loading live roster…</div>
      ) : needsAuth ? (
        <div className="cc-state">
          <div>Enter the coach admin token to load the live roster.</div>
          <div className="cc-auth">
            <input
              className="cc-auth-input"
              type="password"
              autoComplete="off"
              placeholder="X-BBF-Admin-Token"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') authenticate(); }}
              aria-label="Coach admin token"
            />
            <button type="button" className="cc-retry" onClick={authenticate}>Authenticate</button>
          </div>
        </div>
      ) : error ? (
        <div className="cc-state is-error">
          <div>{error}</div>
          <button type="button" className="cc-retry" onClick={reload}>Retry</button>
        </div>
      ) : !clients.length ? (
        <div className="cc-state">No clients on the roster yet.</div>
      ) : (
        <>
          <div className="cc-stats">
            <div className="cc-chip"><b>{activeCount}</b> Active Clients</div>
            <div className={`cc-chip${formPending > 0 ? ' is-alert' : ''}`}><b>{formPending}</b> Form Checks Pending</div>
            <div className="cc-chip"><b>{clients.length}</b> On Roster</div>
          </div>

          <div className="cc-roster">
            {clients.map((c) => (
              <div className="cc-row" key={c.id}>
                <div className="cc-client">
                  <div className="cc-avatar" aria-hidden="true">{initials(c.name)}</div>
                  <div className="cc-client-meta">
                    <span className="cc-name">{c.name}</span>
                    <span className="cc-sub">{c.tier || 'Sovereign'}</span>
                  </div>
                </div>

                <div className="cc-toggles">
                  {MODULES.map((mod) => {
                    const on = moduleOn(c, mod.key);
                    return (
                      <button
                        key={mod.key}
                        type="button"
                        role="switch"
                        aria-checked={on}
                        aria-label={`${mod.label} for ${c.name}`}
                        className={`cc-toggle${on ? ' is-on' : ''}`}
                        onClick={() => toggle(c.id, mod.key)}
                      >
                        <span className="cc-toggle-label">{mod.label}</span>
                        <span className="cc-switch"><span className="cc-knob" /></span>
                      </button>
                    );
                  })}
                </div>

                <div className={`cc-status is-${c.status === 'active' ? 'active' : 'paused'}`}>
                  {c.status === 'active' ? 'Active' : 'Paused'}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
