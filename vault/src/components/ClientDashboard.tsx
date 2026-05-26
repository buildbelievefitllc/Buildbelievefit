// ═══════════════════════════════════════════════════════════════════════
// Build Believe Fit · vault/src/components/ClientDashboard.tsx
//
// Phase 4.3 · Layout Panel Componentization Pass · trainer/admin client
// roster grid + adjacent client-detail panel. React/TS extraction of the
// inline pattern at bbf-app.html where the trainer-side roster was built
// from d.u entries and clicks dispatched into selectClient(uid).
//
// VISUAL FIX (Phase 2-emergency repair · canonical version)
// Re-clicking the ACTIVE client must be a NO-OP. The legacy inline
// implementation at bbf-app.html:2921 was:
//     function selectClient(uid) {
//       if (VC === uid) return;   // <-- the fix
//       VC = uid;
//       LP(); RA();
//       ...
//     }
// Without that early return, the right-hand nutrition telemetry panel
// the trainer was inspecting would tear down + remount, dropping
// scroll/form/canvas state. The React version reproduces the fix at
// the click handler boundary (before setState) so React skips the
// re-render entirely on a same-client click. The detail panel below
// is rendered WITHOUT a key tied to the selected uid so React reuses
// the component instance across client switches → in-place data
// re-render, no unmount, no child-state drop.
// ═══════════════════════════════════════════════════════════════════════

import { useState, useCallback, useMemo } from 'react';
import type { CSSProperties } from 'react';

import {
  getActiveUid,
  setViewingAsClient,
  getUserRecord,
  isAdmin,
  type BBFUserRecord,
} from '../services/supabaseClient';

export interface ClientRosterEntry {
  uid: string;
  name?: string;
  tier?: string;
  trial_expires_at?: string | null;
  subscription_tier?: string | null;
}

export interface ClientDashboardProps {
  /** Optional roster override · defaults to a demo roster for the scaffold. */
  roster?: ClientRosterEntry[];
  /** Optional initial selection · defaults to the active uid from supabaseClient. */
  initialSelectedUid?: string | null;
}

// Demo roster · in production this comes from a Supabase query on bbf_users
// when the logged-in user holds role='trainer' or role='admin' (Phase 4.3+
// will port TRAINER_SETUP to a useEffect hook here).
const DEMO_ROSTER: ClientRosterEntry[] = [
  { uid: 'akeem',      name: 'Akeem (admin)', tier: 'sovereign'             },
  { uid: 'ana_bbf',    name: 'Ana',           tier: 'sovereign'             },
  { uid: 'noah_bbf',   name: 'Noah',          tier: 'pathfinder'            },
  { uid: 'olivia_bbf', name: 'Olivia',        tier: 'nutrition_essentials'  },
  { uid: 'elijah_bbf', name: 'Elijah',        tier: 'pathfinder'            },
];

export default function ClientDashboard(props: ClientDashboardProps) {
  const roster = props.roster ?? DEMO_ROSTER;
  const [selectedUid, setSelectedUid] = useState<string | null>(
    props.initialSelectedUid ?? getActiveUid()
  );

  // ─── selectClient guard (port of bbf-app.html:2921 fix) ─────────────
  const handleSelect = useCallback(
    (uid: string) => {
      if (selectedUid === uid) {
        // Same-client click · no-op fast path · React skips re-render.
        return;
      }
      setSelectedUid(uid);
      setViewingAsClient(uid);
    },
    [selectedUid]
  );

  // ─── Adjacent panel data resolution ─────────────────────────────────
  // Prefer the live payload (when bound to env.js · written by the legacy
  // sync engine) · fall back to the roster entry for the scaffold.
  const selectedRecord: BBFUserRecord | null = useMemo(() => {
    if (!selectedUid) return null;
    const live = getUserRecord(selectedUid);
    if (live) return live;
    const r = roster.find((e) => e.uid === selectedUid);
    if (!r) return null;
    return {
      tier: r.tier,
      subscription_tier: r.subscription_tier ?? null,
      trial_expires_at: r.trial_expires_at ?? null,
    };
  }, [selectedUid, roster]);

  const headerSub = isAdmin()
    ? 'Admin view · drill into any client'
    : 'Your roster';

  return (
    <section className="bbf-client-dashboard" style={styles.root}>
      <header style={styles.header}>
        <div style={styles.headerLabel}>Client Roster</div>
        <div style={styles.headerSub}>{headerSub}</div>
      </header>

      <div style={styles.grid} role="group" aria-label="Client roster">
        {roster.map((entry) => {
          const isActive = entry.uid === selectedUid;
          return (
            <button
              key={entry.uid}
              type="button"
              onClick={() => handleSelect(entry.uid)}
              aria-pressed={isActive}
              style={{
                ...styles.card,
                ...(isActive ? styles.cardActive : null),
              }}
            >
              <div style={styles.cardName}>{entry.name ?? entry.uid}</div>
              <div style={styles.cardTier}>{entry.tier ?? '—'}</div>
            </button>
          );
        })}
      </div>

      {/*
        Detail panel is intentionally NOT keyed on selectedUid · this
        makes React reuse the same component instance across client
        switches so any nested children (forms, canvases, scroll
        containers) keep their internal state intact. The PROPS change
        and the panel re-RENDERS in place · it never UNMOUNTS.
      */}
      <aside style={styles.detailPanel} aria-live="polite">
        {selectedRecord && selectedUid ? (
          <ClientDetailPanel uid={selectedUid} record={selectedRecord} />
        ) : (
          <div style={styles.detailEmpty}>
            Select a client to view their dashboard.
          </div>
        )}
      </aside>
    </section>
  );
}

interface ClientDetailPanelProps {
  uid: string;
  record: BBFUserRecord;
}

function ClientDetailPanel({ uid, record }: ClientDetailPanelProps) {
  const rows: Array<{ label: string; value: string }> = [
    { label: 'Tier',          value: stringOrDash(record.tier) },
    { label: 'Subscription',  value: stringOrDash(record.subscription_tier) },
    { label: 'Trial expires', value: stringOrDash(record.trial_expires_at) },
    { label: 'Baseline',      value: stringOrDash(record.baseline_status) },
  ];
  return (
    <div>
      <div style={styles.detailLabel}>Viewing</div>
      <div style={styles.detailUid}>{uid}</div>
      <dl style={styles.detailGrid}>
        {rows.map((r) => (
          <DetailRow key={r.label} label={r.label} value={r.value} />
        ))}
      </dl>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt style={styles.dt}>{label}</dt>
      <dd style={styles.dd}>{value}</dd>
    </>
  );
}

function stringOrDash(v: string | null | undefined): string {
  if (v === null || v === undefined || v === '') return '—';
  return v;
}

// ─── Styles ──────────────────────────────────────────────────────────
const styles: Record<string, CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    padding: '1rem',
    background: '#11151a',
    color: '#e8eaed',
    borderRadius: '0.75rem',
    border: '1px solid #1f262f',
    minHeight: 0,
  },
  header: { display: 'flex', flexDirection: 'column', gap: '0.15rem' },
  headerLabel: {
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '0.9rem',
    fontWeight: 600,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: '#fbbf24',
  },
  headerSub: { fontSize: '0.78rem', opacity: 0.65 },
  grid: {
    display: 'grid',
    // Auto-fill + minmax = roster cards reflow into 1/2/3/4 columns as
    // the panel resizes · no media queries needed.
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: '0.5rem',
  },
  card: {
    appearance: 'none',
    background: '#1a2028',
    color: '#e8eaed',
    border: '1px solid #2a323d',
    borderRadius: '0.5rem',
    padding: '0.7rem 0.6rem',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background 120ms, border-color 120ms',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  cardActive: {
    background: '#1f3a2a',
    borderColor: '#34d399',
  },
  cardName: { fontWeight: 600, fontSize: '0.92rem' },
  cardTier: { fontSize: '0.72rem', opacity: 0.7 },
  detailPanel: {
    background: '#0d1217',
    border: '1px solid #1f262f',
    borderRadius: '0.5rem',
    padding: '0.9rem',
    minHeight: '5rem',
  },
  detailEmpty: {
    opacity: 0.6,
    fontSize: '0.88rem',
    textAlign: 'center',
    padding: '1rem 0',
  },
  detailLabel: {
    fontSize: '0.72rem',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    opacity: 0.6,
  },
  detailUid: { fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.6rem' },
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr',
    columnGap: '1rem',
    rowGap: '0.35rem',
    margin: 0,
    fontSize: '0.85rem',
  },
  dt: { opacity: 0.6, margin: 0 },
  dd: { margin: 0 },
};
