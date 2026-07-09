// src/components/command/DossierPulse.jsx
// ─────────────────────────────────────────────────────────────────────────────
// DOSSIER PULSE — the first consumer of the consolidated useAthleteDossier hook
// (Redundancy Fix R2). ONE bbf_athlete_dossier RPC hydrates the whole strip:
// readiness trend, latest vitals, workout/nutrition/prehab protocol state, and
// the last coach-thread touch — data that previously required five separate
// per-athlete round-trips across the coaching panels. Renders as a compact
// clinical band at the top of the athlete dossier; every tile degrades to '—'
// when a source has no rows (a fresh athlete is not an error state).

import { useAthleteDossier } from '../../lib/useAthleteDossier.js';

const fmtDate = (v) => {
  if (!v) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : null;
};
const daysSince = (v) => {
  const t = Date.parse(v || '');
  return Number.isFinite(t) ? Math.floor((Date.now() - t) / 86400000) : null;
};

function trendOf(protocols) {
  const scores = (protocols || []).map((r) => Number(r.readiness_score)).filter(Number.isFinite);
  if (scores.length < 2) return null;
  const recent = scores.slice(0, Math.min(3, scores.length));
  const prior = scores.slice(Math.min(3, scores.length), 7);
  if (!prior.length) return null;
  const rA = recent.reduce((a, b) => a + b, 0) / recent.length;
  const pA = prior.reduce((a, b) => a + b, 0) / prior.length;
  return rA > pA + 2 ? '↗ rising' : rA < pA - 2 ? '↘ dipping' : '→ steady';
}

export default function DossierPulse({ athleteId }) {
  const { dossier, isLoading, error, refresh } = useAthleteDossier(athleteId);

  if (error) {
    return (
      <div style={styles.band} data-testid="dossier-pulse">
        <span style={styles.kicker}>◈ Dossier Pulse</span>
        <span style={styles.err}>{error}</span>
        <button type="button" style={styles.retry} onClick={refresh}>Retry</button>
      </div>
    );
  }

  const m = dossier?.metrics || {};
  const t = dossier?.timeline || {};
  const p = dossier?.protocols || {};
  const readiness = (m.readiness_protocols || [])[0];
  const vitals = (m.daily_biometrics || [])[0];
  const lastSession = (t.completion_events || [])[0];
  const lastMsg = (t.messages || [])[0];
  const prehabOpen = (p.prehab_open || []).length;
  const cardio = p.cardio_prescription_latest;
  const fuel = p.nutrition_target_latest;
  const trend = trendOf(m.readiness_protocols);

  const tiles = [
    {
      label: 'Readiness',
      value: readiness?.readiness_score != null ? `${Math.round(readiness.readiness_score)}` : '—',
      sub: trend || (readiness ? fmtDate(readiness.date) : 'no check-ins'),
    },
    {
      label: 'Vitals',
      value: vitals?.hrv_ms != null ? `${Math.round(vitals.hrv_ms)}ms HRV` : '—',
      sub: vitals?.sleep_minutes != null ? `${(vitals.sleep_minutes / 60).toFixed(1)}h sleep` : null,
    },
    {
      label: 'Last Session',
      value: lastSession ? (daysSince(lastSession.occurred_at) === 0 ? 'Today' : `${daysSince(lastSession.occurred_at)}d ago`) : '—',
      sub: lastSession?.source || null,
    },
    {
      label: 'Fuel Contract',
      value: fuel?.tdee_kcal ? `${fuel.tdee_kcal} kcal` : '—',
      sub: fuel ? `${fuel.protein_g}P · ${fuel.carbs_g}C · ${fuel.fat_g}F` : null,
    },
    {
      label: 'Cardio Rx',
      value: cardio?.recovery_state || '—',
      sub: cardio?.interval_directive ? String(cardio.interval_directive).slice(0, 26) : null,
    },
    {
      label: 'Prehab Queue',
      value: prehabOpen ? `${prehabOpen} open` : 'Clear',
      sub: prehabOpen ? (p.prehab_open[0]?.joint_zone || null) : null,
      alert: prehabOpen > 0,
    },
    {
      label: 'Last Touch',
      value: lastMsg ? `${daysSince(lastMsg.created_at) === 0 ? 'Today' : `${daysSince(lastMsg.created_at)}d`}` : '—',
      sub: lastMsg ? (lastMsg.sender === 'coach' ? 'coach → athlete' : 'athlete → coach') : 'no thread yet',
    },
  ];

  return (
    <div style={styles.band} data-testid="dossier-pulse" aria-busy={isLoading}>
      <span style={styles.kicker}>◈ Dossier Pulse{isLoading ? ' · syncing…' : ''}</span>
      <div style={styles.tiles}>
        {tiles.map((tile) => (
          <div key={tile.label} style={styles.tile}>
            <span style={styles.tileLabel}>{tile.label}</span>
            <span style={{ ...styles.tileValue, ...(tile.alert ? styles.tileAlert : null) }}>{tile.value}</span>
            {tile.sub ? <span style={styles.tileSub}>{tile.sub}</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  band: {
    background: 'linear-gradient(180deg, rgba(106,13,173,.14), rgba(9,9,9,.2))',
    border: '1px solid var(--line)', borderRadius: 12,
    padding: '.7rem .9rem', margin: '0 0 1rem',
  },
  kicker: {
    fontFamily: 'var(--hb)', fontSize: '.68rem', letterSpacing: '2.2px',
    textTransform: 'uppercase', color: 'var(--gold-soft)',
  },
  tiles: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(108px, 1fr))',
    gap: '.55rem', marginTop: '.55rem',
  },
  tile: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  tileLabel: {
    fontFamily: 'var(--hb)', fontSize: '.6rem', letterSpacing: '1.6px',
    textTransform: 'uppercase', color: 'var(--mut)',
  },
  tileValue: { fontFamily: 'var(--display)', fontSize: '1.02rem', color: 'var(--wht)', lineHeight: 1.1 },
  tileAlert: { color: '#ff5470' },
  tileSub: {
    fontFamily: 'var(--bd)', fontSize: '.74rem', color: 'var(--mut)',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  err: { fontFamily: 'var(--bd)', fontSize: '.85rem', color: '#e0655f', marginLeft: '.7rem' },
  retry: {
    marginLeft: '.6rem', fontFamily: 'var(--hb)', fontSize: '.7rem', letterSpacing: '1.5px',
    textTransform: 'uppercase', background: 'transparent', color: 'var(--wht)',
    border: '1px solid var(--line)', borderRadius: 8, padding: '.25rem .6rem', cursor: 'pointer',
  },
};
