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

import { Loading, Empty } from '../command/primitives.jsx';
import './vault.css';

const STATS = [
  { key: 'totalSessions', label: 'Total Sessions', unit: 'logged', accent: 'var(--yel)' },
  { key: 'currentStreak', label: 'Current Streak', unit: 'days', accent: 'var(--grn)' },
  { key: 'bestStreak', label: 'Best Streak', unit: 'days', accent: 'var(--purl)' },
  { key: 'thisWeek', label: 'This Week', unit: 'sessions', accent: 'var(--blu)' },
  { key: 'thisMonth', label: 'This Month', unit: 'sessions', accent: 'var(--blu)' },
  { key: 'avgPerWeek', label: 'Avg / Week', unit: 'sessions', accent: 'var(--orn)' },
];

export default function VaultHub({ profile, isLoading, error }) {
  if (isLoading) return <Loading label="Loading your Vault…" />;
  if (error) return <div className="pg-hub-error">{error}</div>;
  if (!profile) return <Empty>No profile data yet.</Empty>;

  const fresh = profile.found && profile.totalSessions > 0;

  return (
    <div className="pg">
      <div className="pg-hub-grid">
        {STATS.map((s) => {
          const v = profile[s.key];
          const has = v !== null && v !== undefined && v !== '';
          return (
            <div key={s.key} className="pg-stat" style={{ borderTopColor: s.accent }}>
              <div className="pg-stat-k">{s.label}</div>
              <div className="pg-stat-v">{has ? Number(v).toLocaleString() : '—'}</div>
              <div className="pg-stat-u">{has ? s.unit : ''}</div>
            </div>
          );
        })}
      </div>

      <h2 className="pg-hub-subhead">Last 30 Days</h2>
      {profile.heatmap.length ? (
        <div className="pg-heatmap" aria-label="30-day training consistency">
          {profile.heatmap.map((d) => (
            <span
              key={d.date}
              title={`${d.date}${d.logged ? ' — trained' : ''}`}
              className={`pg-heat-cell${d.logged ? ' is-on' : ''}`}
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
