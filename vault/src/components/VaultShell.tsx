// ═══════════════════════════════════════════════════════════════════════
// Build Believe Fit · vault/src/components/VaultShell.tsx
//
// Phase 4.3 Stage 2 · Vault mount + tab navigation skeleton (step b in
// PASSOVER §5 · boot directive "Vault mount + tab nav"). React port of
// the legacy bbf-app.html TAB() function which toggled .display = none/
// block on six pre-mounted tab DIVs.
//
// STABLE-STATE TAB SWITCHING CONTRACT
//   · The shell (header + tab nav + tab-panel frame) NEVER unmounts on
//     tab change · only the activeTab state flips.
//   · All six tab panels are pre-MOUNTED on first render and stay
//     mounted across switches · visibility is toggled via the `hidden`
//     attribute + display:none. This is the same pattern the legacy
//     bbf-app.html used (display:none/block on pre-mounted DIVs) and
//     preserves per-tab React state (form input, scroll position,
//     canvas state, the Nutrition Vision scanner's getUserMedia
//     handle) across tab switches.
//   · Same-tab clicks are a no-op fast path (mirrors the selectClient
//     guard in ClientDashboard.tsx · Phase 4.3a contract) so React
//     doesn't even re-render when the user clicks the already-active
//     tab.
//   · Logout clears the in-memory session AND the localStorage sigil
//     so the next reload doesn't auto-restore. The storage-event
//     listener wired in main.tsx (Phase 6.0h) propagates the logout
//     to other tabs on the same origin via window.location.reload().
// ═══════════════════════════════════════════════════════════════════════

import { useState, useCallback } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import ClientDashboard from './ClientDashboard';
import NutritionVision from './NutritionVision';
import WorkoutTracker from './WorkoutTracker';
import PrehabReadiness from './PrehabReadiness';
import CardioTracker from './CardioTracker';
import ProfileSettings from './ProfileSettings';

export type VaultTabId =
  | 'home'
  | 'nutrition'
  | 'workout'
  | 'cardio'
  | 'prehab'
  | 'profile';

const TAB_ORDER: ReadonlyArray<{ id: VaultTabId; label: string }> = [
  { id: 'home',      label: 'Home'      },
  { id: 'nutrition', label: 'Nutrition' },
  { id: 'workout',   label: 'Workout'   },
  { id: 'cardio',    label: 'Cardio'    },
  { id: 'prehab',    label: 'Prehab'    },
  { id: 'profile',   label: 'Profile'   },
];

export interface VaultShellProps {
  uid: string;
  onLogout: () => void;
  /** Optional initial tab override · defaults to 'home'. */
  initialTab?: VaultTabId;
}

export default function VaultShell({ uid, onLogout, initialTab = 'home' }: VaultShellProps) {
  const [activeTab, setActiveTab] = useState<VaultTabId>(initialTab);

  // Same-tab click is a no-op fast path · React skips re-render.
  const handleTabClick = useCallback(
    (id: VaultTabId) => {
      setActiveTab((prev) => (prev === id ? prev : id));
    },
    []
  );

  return (
    <main style={styles.root}>
      <header style={styles.header}>
        <div style={styles.brand}>
          <div style={styles.kicker}>Build Believe Fit</div>
          <div style={styles.brandTitle}>Vault</div>
        </div>
        <div style={styles.session}>
          <span style={styles.uid} aria-label="Signed in athlete id">{uid}</span>
          <button type="button" style={styles.logout} onClick={onLogout}>
            Sign out
          </button>
        </div>
      </header>

      <nav style={styles.tabNav} role="tablist" aria-label="Vault sections">
        {TAB_ORDER.map(({ id, label }) => {
          const isActive = id === activeTab;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              id={`vault-tab-trigger-${id}`}
              aria-selected={isActive}
              aria-controls={`vault-tab-panel-${id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => handleTabClick(id)}
              style={{
                ...styles.tabButton,
                ...(isActive ? styles.tabButtonActive : null),
              }}
            >
              {label}
            </button>
          );
        })}
      </nav>

      <section style={styles.tabContent}>
        <TabPanel id="home"      active={activeTab === 'home'}>
          <ClientDashboard />
        </TabPanel>
        <TabPanel id="nutrition" active={activeTab === 'nutrition'}>
          <NutritionVision />
        </TabPanel>
        <TabPanel id="workout"   active={activeTab === 'workout'}>
          <WorkoutTracker />
        </TabPanel>
        <TabPanel id="cardio"    active={activeTab === 'cardio'}>
          <CardioTracker />
        </TabPanel>
        <TabPanel id="prehab"    active={activeTab === 'prehab'}>
          <PrehabReadiness />
        </TabPanel>
        <TabPanel id="profile"   active={activeTab === 'profile'}>
          <ProfileSettings />
        </TabPanel>
      </section>
    </main>
  );
}

interface TabPanelProps {
  id: VaultTabId;
  active: boolean;
  children: ReactNode;
}

function TabPanel({ id, active, children }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      id={`vault-tab-panel-${id}`}
      aria-labelledby={`vault-tab-trigger-${id}`}
      aria-hidden={!active}
      hidden={!active}
      style={{ display: active ? 'block' : 'none' }}
    >
      {children}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  root: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    padding: '1.25rem',
    background: '#0b0d10',
    color: '#e8eaed',
    fontFamily:
      'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  header: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    gap: '0.75rem',
    alignItems: 'center',
  },
  brand: { display: 'flex', flexDirection: 'column', gap: '0.05rem', minWidth: 0 },
  kicker: {
    fontSize: '0.7rem',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    color: '#fbbf24',
    fontWeight: 600,
  },
  brandTitle: { fontSize: '1.4rem', fontWeight: 700, letterSpacing: '0.01em' },
  session: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  uid: {
    fontSize: '0.78rem',
    opacity: 0.7,
    background: '#11151a',
    border: '1px solid #1f262f',
    borderRadius: '999px',
    padding: '0.25rem 0.6rem',
  },
  logout: {
    appearance: 'none',
    background: 'transparent',
    color: '#e8eaed',
    border: '1px solid #2a323d',
    borderRadius: '0.45rem',
    padding: '0.4rem 0.7rem',
    fontSize: '0.78rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  tabNav: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 7rem), 1fr))',
    gap: '0.4rem',
    background: '#11151a',
    border: '1px solid #1f262f',
    borderRadius: '0.6rem',
    padding: '0.35rem',
  },
  tabButton: {
    appearance: 'none',
    background: 'transparent',
    color: '#e8eaed',
    border: '1px solid transparent',
    borderRadius: '0.4rem',
    padding: '0.55rem 0.4rem',
    fontWeight: 600,
    fontSize: '0.85rem',
    cursor: 'pointer',
    transition: 'background 120ms, border-color 120ms, color 120ms',
  },
  tabButtonActive: {
    background: '#1f3a2a',
    borderColor: '#34d399',
    color: '#e8eaed',
  },
  tabContent: { flex: 1, minHeight: 0 },
};
