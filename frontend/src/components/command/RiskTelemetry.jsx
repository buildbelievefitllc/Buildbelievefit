// src/components/command/RiskTelemetry.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 9 — The Sovereign Panopticon, live-wired.
//
// Data path (lib/telemetryApi → 4 anon PostgREST reads, RLS-gated) + client-side
// risk math (lib/intelCore, verbatim port of the canonical kernel). Athletes are
// classified red / yellow / green / dormant and SORTED worst-first (red→…→dormant,
// ties by ACWR descending) — done in telemetryApi.processRoster.
//
// Status → color: RED = active violation (var(--red)), YELLOW = ACWR caution zone
// (var(--orn)) — i.e. the highest-risk athletes are the most visible, per order.
// (The order's "Restricted/Contraindicated" are cardiac_clearance values that live
// in the per-client dossier, NOT in this load-telemetry contract; mapping the
// intent — high risk = high visibility — onto the real red/yellow statuses.)
//
// State contract: { data, isLoading, error } — no silent failures, no infinite
// spinners. No admin token: the Panopticon reads anon + RLS, not the edge gateway.

import { useCallback, useEffect, useState } from 'react';
import { fetchPanopticon } from '../../lib/telemetryApi.js';
import { toErrorMessage } from '../../lib/rosterApi.js';
import CommandSurface from './CommandSurface.jsx';
import { Tile, Badge, Loading, Empty } from './primitives.jsx';

const STATUS = {
  red: { color: 'var(--red)', label: '⚠ Active Violation' },
  yellow: { color: 'var(--orn)', label: '▲ Caution Zone' },
  green: { color: 'var(--grn)', label: '✓ Nominal' },
  dormant: { color: 'var(--mut)', label: '◌ No Telemetry' },
};

export default function RiskTelemetry() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setData(await fetchPanopticon());
    } catch (e) {
      setError(toErrorMessage(e));
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Auto-load on mount. Deferred via microtask so the initial setState lands
  // outside the synchronous effect body (satisfies react-hooks/set-state-in-effect).
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) load(); });
    return () => { cancelled = true; };
  }, [load]);

  const counts = data?.counts;

  return (
    <CommandSurface
      kicker="Risk Telemetry · Sovereign Panopticon"
      title="The Panopticon"
      lede="Every athlete's last 28 days of training load plus today's bouts, scored by the Intelligence Engine — highest risk surfaced first."
    >
      <div style={styles.toolbar}>
        <span style={styles.count}>
          {isLoading ? 'Scanning…' : data ? `${data.total} athlete${data.total === 1 ? '' : 's'}` : '—'}
        </span>
        <button type="button" style={styles.refresh} onClick={load} disabled={isLoading}>↻ Refresh</button>
      </div>

      {/* Status summary band — uses the shared Tile primitive. */}
      {!isLoading && !error && counts ? (
        <div style={styles.summary}>
          <Tile label="Red" value={counts.red} unit="active" accent="var(--red)" />
          <Tile label="Yellow" value={counts.yellow} unit="caution" accent="var(--orn)" />
          <Tile label="Green" value={counts.green} unit="nominal" accent="var(--grn)" />
          <Tile label="Dormant" value={counts.dormant} unit="no data" accent="var(--mut)" />
        </div>
      ) : null}

      {isLoading ? <Loading label="Fetching live roster telemetry…" /> : null}

      {!isLoading && error ? (
        <div style={styles.errorBox} role="alert">
          <div style={styles.errorTitle}>Panopticon fetch failed</div>
          <div style={styles.errorMsg}>{error}</div>
          <button type="button" style={styles.retry} onClick={load}>Retry</button>
        </div>
      ) : null}

      {!isLoading && !error && data && data.total === 0 ? (
        <Empty>No athletes in the roster yet.</Empty>
      ) : null}

      {!isLoading && !error && data && data.total > 0 ? (
        <div style={styles.grid}>
          {data.athletes.map((p) => (
            <AthleteCard key={p.athlete.athlete_id} p={p} />
          ))}
        </div>
      ) : null}
    </CommandSurface>
  );
}

// ── One athlete risk card. ─────────────────────────────────────────────────────
function AthleteCard({ p }) {
  const s = STATUS[p.status] || STATUS.dormant;
  const a = p.athlete;
  const report = p.report;
  const ratioStr = (report && report.acwr.ratio !== null) ? report.acwr.ratio.toFixed(2) : '—';
  const meta = [a.sport, a.position].filter(Boolean).join(' · ') || (a.role || 'No profile');

  return (
    <article style={{ ...styles.card, borderColor: s.color, borderLeft: `3px solid ${s.color}` }}>
      <div style={styles.cardHead}>
        <Badge label={s.label} color={s.color} />
        <div style={styles.acwrWrap}>
          <span style={{ ...styles.acwrNum, color: p.status === 'green' ? 'var(--wht)' : s.color }}>{ratioStr}</span>
          <span style={styles.acwrLbl}>ACWR</span>
        </div>
      </div>
      <div style={styles.cardName}>{a.name || a.slug || 'Unknown'}</div>
      <div style={styles.cardMeta}>{meta}</div>
      <RiskAlerts status={p.status} report={report} ratioStr={ratioStr} />
    </article>
  );
}

// Alert block — verbatim engine rule/reason for red, caution text for yellow,
// state line for green/dormant. Mirrors the monolith's _cardHTML alerts.
function RiskAlerts({ status, report, ratioStr }) {
  if (status === 'red' && report && report.alerts.length > 0) {
    return (
      <div style={styles.alerts}>
        {report.alerts.map((al, i) => (
          <div key={i} style={{ ...styles.alert, borderColor: al.severity === 'high' ? 'var(--red)' : 'var(--orn)' }}>
            <span style={styles.alertRule}>{al.rule}</span>
            <span style={styles.alertReason}>{al.reason}</span>
          </div>
        ))}
      </div>
    );
  }
  if (status === 'yellow') {
    return (
      <div style={{ ...styles.alert, borderColor: 'var(--orn)', marginTop: '.45rem' }}>
        <span style={styles.alertRule}>Approaching ACWR Threshold</span>
        <span style={styles.alertReason}>{`ACWR ${ratioStr} is in the 1.30–1.50 caution zone`}</span>
      </div>
    );
  }
  return <div style={styles.stateLine}>{status === 'dormant' ? 'No sessions logged in 28-day window' : 'All systems nominal'}</div>;
}

const styles = {
  toolbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' },
  count: { fontFamily: 'var(--hb)', fontSize: '.78rem', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--mut)' },
  refresh: {
    fontFamily: 'var(--hb)', fontSize: '.72rem', letterSpacing: '2px', textTransform: 'uppercase',
    color: 'var(--gold-soft)', background: 'none', border: '1px solid rgba(245,200,0,.3)',
    borderRadius: 8, padding: '.45rem .8rem', cursor: 'pointer',
  },

  summary: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '.7rem', marginBottom: '1.4rem' },

  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '.85rem' },
  card: {
    background: 'var(--gry)', border: '1px solid var(--line)', borderRadius: 12, padding: '.95rem 1.1rem',
  },
  cardHead: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '.5rem', marginBottom: '.55rem' },
  acwrWrap: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1 },
  acwrNum: { fontFamily: 'var(--display)', fontSize: '1.65rem', fontWeight: 900, letterSpacing: '1px', fontVariantNumeric: 'tabular-nums' },
  acwrLbl: { fontFamily: 'var(--bd)', fontSize: '.55rem', letterSpacing: '1.6px', textTransform: 'uppercase', color: 'var(--mut)', fontWeight: 700, marginTop: '.1rem' },
  cardName: { fontFamily: 'var(--hb)', fontSize: '1.05rem', letterSpacing: '1.2px', color: 'var(--wht)', textTransform: 'uppercase' },
  cardMeta: { fontFamily: 'var(--bd)', fontSize: '.74rem', fontWeight: 700, letterSpacing: '.4px', color: 'var(--mut)', textTransform: 'capitalize', marginBottom: '.5rem' },

  alerts: { display: 'flex', flexDirection: 'column', gap: '.4rem', marginTop: '.45rem' },
  alert: {
    display: 'flex', flexDirection: 'column', gap: '.18rem', padding: '.5rem .65rem',
    borderRadius: 7, border: '1px solid var(--line)', background: 'rgba(255,255,255,.03)',
  },
  alertRule: { fontFamily: 'var(--hb)', fontSize: '.72rem', letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--wht)' },
  alertReason: { fontFamily: 'var(--bd)', fontSize: '.82rem', fontWeight: 600, color: 'var(--mut)', lineHeight: 1.4 },
  stateLine: { fontFamily: 'var(--bd)', fontSize: '.8rem', fontWeight: 700, color: 'var(--mut)', marginTop: '.45rem' },

  errorBox: { border: '1px solid var(--red)', borderRadius: 12, padding: '1rem 1.2rem', background: 'rgba(239,68,68,.06)' },
  errorTitle: { fontFamily: 'var(--hb)', fontSize: '.8rem', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--red)', marginBottom: '.35rem' },
  errorMsg: { fontFamily: 'var(--bd)', fontSize: '.95rem', color: 'var(--red)', wordBreak: 'break-word', marginBottom: '.8rem' },
  retry: {
    fontFamily: 'var(--hb)', fontSize: '.72rem', letterSpacing: '2px', textTransform: 'uppercase',
    color: 'var(--red)', background: 'none', border: '1px solid var(--red)', borderRadius: 8, padding: '.45rem .9rem', cursor: 'pointer',
  },
};
