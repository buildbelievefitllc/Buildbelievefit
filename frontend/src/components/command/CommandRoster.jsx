// src/components/command/CommandRoster.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 20.3 — Sovereign Command Center · roster reconstruction (admin).
//
// Premium dark-mode roster: a header, quick-stat chips, and one row per client
// with three module toggles (Biometrics / Nutrition / Form Check, gold active
// state) and a status pill. Styling lives in the scoped command.css (.cc-*).
//
// DATA CONTRACT — anticipates the JSON array from the bbf-command-feed API
// (in progress, Terminal 3). Each client:
//   {
//     id:               string,                 // bbf_users.uid (slug)
//     name:             string,
//     tier?:            string,                 // e.g. "Sovereign Standard"
//     status:           "active" | "paused",
//     formChecksPending: number,
//     modules: { biometrics: boolean, nutrition: boolean, formCheck: boolean }
//   }
// Pass that array as the `clients` prop when the feed lands. Until then we render
// MOCK_CLIENTS, and the toggles are VISUAL ONLY — local state, no persistence
// (a future PATCH to bbf-command-feed / an admin-token edge function wires them).

import { useState } from 'react';
import './command.css';

const MODULES = [
  { key: 'biometrics', label: 'Biometrics' },
  { key: 'nutrition', label: 'Nutrition' },
  { key: 'formCheck', label: 'Form Check' },
];

// Stand-in for the bbf-command-feed payload (shape above). Replaced by the live
// feed via the `clients` prop.
const MOCK_CLIENTS = [
  { id: 'jacky_bbf', name: 'Jacky', tier: 'Sovereign Standard', status: 'active', formChecksPending: 2, modules: { biometrics: true, nutrition: true, formCheck: false } },
  { id: 'valerie_bbf', name: 'Valerie', tier: 'Autonomous Engine', status: 'active', formChecksPending: 1, modules: { biometrics: true, nutrition: false, formCheck: true } },
  { id: 'ana_bbf', name: 'Ana', tier: 'Sovereign Standard', status: 'active', formChecksPending: 0, modules: { biometrics: true, nutrition: true, formCheck: true } },
  { id: 'jordan_bbf', name: 'Jordan', tier: 'Autonomous Engine', status: 'paused', formChecksPending: 0, modules: { biometrics: false, nutrition: true, formCheck: false } },
  { id: 'wayne_bbf', name: 'Wayne', tier: 'Sovereign Standard', status: 'active', formChecksPending: 1, modules: { biometrics: true, nutrition: true, formCheck: false } },
];

function initials(name) {
  return String(name || '?').trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

export default function CommandRoster({ clients = MOCK_CLIENTS }) {
  // Local, visual-only toggle state seeded from the feed's module flags.
  const [modules, setModules] = useState(() => {
    const seed = {};
    clients.forEach((c) => { seed[c.id] = { ...(c.modules || {}) }; });
    return seed;
  });

  const toggle = (id, key) => {
    setModules((m) => ({ ...m, [id]: { ...m[id], [key]: !m[id]?.[key] } }));
  };

  const activeCount = clients.filter((c) => c.status === 'active').length;
  const formPending = clients.reduce((n, c) => n + (Number(c.formChecksPending) || 0), 0);

  return (
    <div className="cc">
      <header className="cc-head">
        <div className="cc-kicker">Build Believe Fit · Admin Console</div>
        <h1 className="cc-title">SOVEREIGN COMMAND CENTER</h1>
        <div className="cc-rule" />
      </header>

      <div className="cc-stats">
        <div className="cc-chip"><b>{activeCount}</b> Active Clients</div>
        <div className={`cc-chip${formPending > 0 ? ' is-alert' : ''}`}><b>{formPending}</b> Form Checks Pending</div>
        <div className="cc-chip"><b>{clients.length}</b> On Roster</div>
      </div>

      <div className="cc-roster">
        {clients.map((c) => {
          const m = modules[c.id] || {};
          return (
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
                  const on = !!m[mod.key];
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
          );
        })}
      </div>
    </div>
  );
}
