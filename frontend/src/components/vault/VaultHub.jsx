// src/components/vault/VaultHub.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 18 → 25 — Client Vault · Hub tab body.
//
// Phase 25 (Prototype Sync): the "MY CLIENT PROFILE HUB" banner, the WELCOME
// identity card, and the Smart-Day-Sync blueprint moved UP into the persistent
// <VaultHeader>, which the shell renders above the nested nav on every tab
// (faithful to the AI Studio prototype). What remains here is the Hub tab's own
// deeper read-out: the Performance Index stat grid and the 30-day consistency
// heatmap.
//
// Data contract { isLoading, error, profile } is owned by the Vault shell — this
// component only paints it.

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
  return (
    <div className="pg">
      {isLoading ? <Loading label="Loading your Vault…" /> : null}
      {!isLoading && error ? <div className="pg-hub-error">{error}</div> : null}
      {!isLoading && !error && !profile ? <Empty>No profile data yet.</Empty> : null}
      {!isLoading && !error && profile ? <HubMetrics profile={profile} /> : null}
    </div>
  );
}

function HubMetrics({ profile }) {
  const fresh = profile.found && profile.totalSessions > 0;

  return (
    <>
      <h2 className="pg-hub-subhead">Performance Index</h2>
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
    </>
  );
}
