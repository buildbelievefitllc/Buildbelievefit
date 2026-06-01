// src/components/vault/VaultHub.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 18 — Client Vault · Hub. The athlete's personal dashboard (the
// client-facing counterpart to the admin Command Center's roster-wide Client
// Hub, which is service-role and not applicable to a single client).
//
// Pure presentational surface: it receives the already-fetched profile metrics
// from the Vault shell (single fetch-on-land) and renders counters + a 30-day
// consistency heatmap. State contract { isLoading, error, profile } is owned by
// the shell — this component only paints it.

import { Tile, Loading, Empty } from '../command/primitives.jsx';

export default function VaultHub({ profile, isLoading, error }) {
  if (isLoading) return <Loading label="Loading your Vault…" />;
  if (error) return <div style={styles.error}>{error}</div>;
  if (!profile) return <Empty>No profile data yet.</Empty>;

  const fresh = profile.found && profile.totalSessions > 0;

  return (
    <div>
      <div style={styles.grid}>
        <Tile label="Total Sessions" value={profile.totalSessions} unit="logged" accent="var(--yel)" />
        <Tile label="Current Streak" value={profile.currentStreak} unit="days" accent="var(--grn)" />
        <Tile label="Best Streak" value={profile.bestStreak} unit="days" accent="var(--purl)" />
        <Tile label="This Week" value={profile.thisWeek} unit="sessions" accent="var(--blu)" />
        <Tile label="This Month" value={profile.thisMonth} unit="sessions" accent="var(--blu)" />
        <Tile label="Avg / Week" value={profile.avgPerWeek} unit="sessions" accent="var(--orn)" />
      </div>

      <h2 style={styles.subhead}>Last 30 Days</h2>
      {profile.heatmap.length ? (
        <div style={styles.heatmap} aria-label="30-day training consistency">
          {profile.heatmap.map((d) => (
            <span
              key={d.date}
              title={`${d.date}${d.logged ? ' — trained' : ''}`}
              style={{ ...styles.cell, ...(d.logged ? styles.cellOn : null) }}
            />
          ))}
        </div>
      ) : (
        <Empty>
          {fresh
            ? 'No sessions in the last 30 days — time to log one.'
            : 'Your first logged session will light up here.'}
        </Empty>
      )}
    </div>
  );
}

const styles = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '.7rem',
    marginBottom: '2rem',
  },
  subhead: {
    fontFamily: 'var(--hb)',
    fontSize: '.8rem',
    letterSpacing: '2px',
    textTransform: 'uppercase',
    color: 'var(--mut)',
    margin: '0 0 .8rem',
  },
  heatmap: { display: 'flex', flexWrap: 'wrap', gap: 5 },
  cell: {
    width: 16,
    height: 16,
    borderRadius: 4,
    background: 'var(--gry)',
    border: '1px solid var(--line)',
  },
  cellOn: {
    background: 'var(--yel)',
    borderColor: 'var(--yel)',
    boxShadow: '0 0 8px rgba(245,200,0,.45)',
  },
  error: {
    fontFamily: 'var(--bd)',
    fontWeight: 600,
    color: 'var(--red)',
    padding: '1rem 0',
  },
};
