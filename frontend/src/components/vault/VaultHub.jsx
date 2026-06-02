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

// Daily Blueprint — static placeholders for now (Phase 23). The training split
// and macro targets are intentionally hard-wired here; a future phase replaces
// these with the live values from the athlete's assigned program / nutrition
// plan (the backend wiring is out of scope for this pass).
const BLUEPRINT_SPLIT = 'Phase 4 — Back & Biceps';
const BLUEPRINT_MACROS = [
  { key: 'kcal', label: 'Calories', value: '2,400', unit: 'kcal' },
  { key: 'protein', label: 'Protein', value: '210', unit: 'g' },
  { key: 'carbs', label: 'Carbs', value: '240', unit: 'g' },
  { key: 'fat', label: 'Fat', value: '70', unit: 'g' },
];

// Brutalist hero at the top of the Hub — greets the athlete by formatted name and
// surfaces today's blueprint. Always rendered (independent of the profile fetch).
function BlueprintHero({ displayName }) {
  return (
    <section className="cv-hero" aria-label="Daily blueprint">
      <div className="cv-hero-kicker">Sovereign Vault · Today</div>
      <h1 className="cv-hero-greet">Welcome, {displayName}</h1>
      <div className="cv-hero-blueprint">
        <span className="cv-hero-blueprint-k">Daily Blueprint</span>
        <span className="cv-hero-blueprint-v">{BLUEPRINT_SPLIT}</span>
      </div>
      <div className="cv-hero-macros">
        {BLUEPRINT_MACROS.map((m) => (
          <div key={m.key} className="cv-hero-macro">
            <span className="cv-hero-macro-k">{m.label}</span>
            <span className="cv-hero-macro-v">{m.value}</span>
            <span className="cv-hero-macro-u">{m.unit}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function VaultHub({ profile, isLoading, error, displayName = 'Athlete' }) {
  return (
    <div className="pg">
      <BlueprintHero displayName={displayName} />
      {isLoading ? <Loading label="Loading your Vault…" /> : null}
      {!isLoading && error ? <div className="pg-hub-error">{error}</div> : null}
      {!isLoading && !error && !profile ? <Empty>No profile data yet.</Empty> : null}
      {!isLoading && !error && profile ? (
        <HubMetrics profile={profile} />
      ) : null}
    </div>
  );
}

function HubMetrics({ profile }) {
  const fresh = profile.found && profile.totalSessions > 0;

  return (
    <>
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
