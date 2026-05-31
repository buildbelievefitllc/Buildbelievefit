// src/pages/CommandCenter.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 4 — Command Center: the authenticated home surface. A sub-navigation
// (segmented tabs) switches between the three administrative surfaces the live
// monolith groups here:
//
//   Client Hub      → Roster (secure service-role)
//   Risk Telemetry  → Sovereign Panopticon (ACWR injury-risk grid)
//   Comlink         → Concierge + incoming leads + SOS queue
//
// Structure only — each surface renders its own skeleton until live wiring lands.
// State is local (`activeTab`); no routing per-tab yet.

import { useState } from 'react';
import ClientHub from '../components/command/ClientHub.jsx';
import RiskTelemetry from '../components/command/RiskTelemetry.jsx';
import Comlink from '../components/command/Comlink.jsx';

const TABS = [
  { id: 'roster', label: 'Client Hub', Panel: ClientHub },
  { id: 'telemetry', label: 'Risk Telemetry', Panel: RiskTelemetry },
  { id: 'comlink', label: 'Comlink', Panel: Comlink },
];

export default function CommandCenter() {
  const [activeTab, setActiveTab] = useState(TABS[0].id);
  const ActivePanel = (TABS.find((t) => t.id === activeTab) ?? TABS[0]).Panel;

  return (
    <div style={styles.page}>
      <header style={styles.head}>
        <div style={styles.kicker}>Sovereign Command</div>
        <h1 style={styles.title}>Command Center</h1>
      </header>

      <nav style={styles.tabs} role="tablist" aria-label="Command Center surfaces">
        {TABS.map((t) => {
          const active = t.id === activeTab;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(t.id)}
              style={{ ...styles.tab, ...(active ? styles.tabActive : null) }}
            >
              {t.label}
            </button>
          );
        })}
      </nav>

      <div style={styles.panel}>
        <ActivePanel />
      </div>
    </div>
  );
}

const styles = {
  page: { maxWidth: 1100 },
  head: { marginBottom: '1.5rem' },
  kicker: {
    fontFamily: 'var(--hb)',
    fontSize: '.7rem',
    letterSpacing: '4px',
    textTransform: 'uppercase',
    color: 'var(--gold-deep)',
    marginBottom: '.35rem',
  },
  title: { fontFamily: 'var(--display)', fontSize: '2.6rem', letterSpacing: '1px', margin: 0 },
  tabs: {
    display: 'flex',
    gap: '.4rem',
    borderBottom: '1px solid var(--line)',
    marginBottom: '2rem',
  },
  tab: {
    fontFamily: 'var(--hb)',
    fontSize: '.82rem',
    letterSpacing: '2px',
    textTransform: 'uppercase',
    color: 'rgba(249,245,255,.55)',
    background: 'none',
    border: 'none',
    borderBottom: '3px solid transparent',
    padding: '.7rem 1rem',
    marginBottom: '-1px',
    cursor: 'pointer',
    transition: 'color .15s ease, border-color .15s ease',
  },
  tabActive: { color: 'var(--wht)', borderBottomColor: 'var(--yel)' },
  panel: {},
};
