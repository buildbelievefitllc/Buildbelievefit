// src/components/command/EagleEye.jsx
// ─────────────────────────────────────────────────────────────────────────────
// BBF EAGLE EYE — the Command Center's secondary brain.
//
// Oversees ALL client data and verifies that the coaching cues bucketed for the
// DAILY Sovereign readiness message and the WEEKLY report stay aligned with sharp
// precision, per client. The deterministic alignment engine lives server-side
// (bbf-eagle-eye); this surface renders its verdict — a status summary band plus
// a worst-first grid of client cards, each showing the daily bucket, the weekly
// bucket, and the exact findings where the two cadences disagree.
//
// "Deep Read" opens a single client's dossier and (when the Anthropic key is set)
// asks Eagle Eye to narrate that client's logic through the model router (Sonnet).
//
// Brand + chrome reuse: CommandSurface header, primitives (Tile/Badge/Loading/
// Empty), and the RiskTelemetry card idiom, so aesthetic parity is guaranteed.

import { useCallback, useEffect, useState } from 'react';
import { fetchEagleEye, fetchEagleEyeDeepRead } from '../../lib/eagleEyeApi.js';
import { toErrorMessage } from '../../lib/rosterApi.js';
import CommandSurface from './CommandSurface.jsx';
import { Tile, Badge, Loading, Empty } from './primitives.jsx';

const STATUS = {
  conflict: { color: 'var(--red)', label: '⚠ Cue Conflict' },
  drift: { color: 'var(--orn)', label: '▲ Bucket Drift' },
  aligned: { color: 'var(--grn)', label: '✓ Aligned' },
  no_data: { color: 'var(--mut)', label: '◌ No Signal' },
};

const BAND_COPY = {
  RECOVERY_PRIORITY: 'Recovery Priority',
  REDUCED_LOAD: 'Reduced Load',
  MODERATE: 'Moderate',
  PRIMED: 'Primed',
};
const TREND_GLYPH = { rising: '▲', steady: '▬', dipping: '▼' };

function humanizeBucket(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function EagleEye() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setData(await fetchEagleEye());
    } catch (e) {
      setError(toErrorMessage(e));
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) load(); });
    return () => { cancelled = true; };
  }, [load]);

  const s = data?.summary;

  return (
    <CommandSurface
      kicker="BBF Eagle Eye · Secondary Brain"
      title="BBF Eagle Eye"
      lede="Oversight of every client's data — verifying the coaching cues bucketed for the daily Sovereign readiness message and the weekly report stay aligned with sharp precision. Misalignments surface first."
    >
      <div style={styles.toolbar}>
        <span style={styles.count}>
          {isLoading
            ? 'Scanning every client…'
            : data
              ? `${data.client_count} client${data.client_count === 1 ? '' : 's'} · ISO ${data.iso_year}·W${data.iso_week}`
              : '—'}
        </span>
        <button type="button" style={styles.refresh} onClick={load} disabled={isLoading}>↻ Re-scan</button>
      </div>

      {!isLoading && !error && s ? (
        <div style={styles.summary}>
          <Tile label="Conflict" value={s.conflict} unit="opposing cues" accent="var(--red)" />
          <Tile label="Drift" value={s.drift} unit="stale source" accent="var(--orn)" />
          <Tile label="Aligned" value={s.aligned} unit="in sync" accent="var(--grn)" />
          <Tile label="No Signal" value={s.no_data} unit="no data" accent="var(--mut)" />
        </div>
      ) : null}

      {isLoading ? <Loading label="Cross-checking daily vs weekly cue buckets…" /> : null}

      {!isLoading && error ? (
        <div style={styles.errorBox} role="alert">
          <div style={styles.errorTitle}>Eagle Eye scan failed</div>
          <div style={styles.errorMsg}>{error}</div>
          <button type="button" style={styles.retry} onClick={load}>Retry</button>
        </div>
      ) : null}

      {!isLoading && !error && data && data.client_count === 0 ? (
        <Empty>No clients in the roster yet.</Empty>
      ) : null}

      {!isLoading && !error && data && data.client_count > 0 ? (
        <div style={styles.grid}>
          {data.clients.map((c) => <ClientCard key={c.uid} c={c} />)}
        </div>
      ) : null}
    </CommandSurface>
  );
}

function ClientCard({ c }) {
  const st = STATUS[c.alignment?.status] || STATUS.no_data;
  const [open, setOpen] = useState(false);
  const [read, setRead] = useState(null);
  const [reading, setReading] = useState(false);
  const [readErr, setReadErr] = useState(null);

  const daily = c.daily || {};
  const weekly = c.weekly || null;
  const findings = c.alignment?.findings || [];

  const deepRead = useCallback(async () => {
    setOpen(true);
    if (read || reading) return;
    setReading(true);
    setReadErr(null);
    try {
      setRead(await fetchEagleEyeDeepRead(c.uid));
    } catch (e) {
      setReadErr(toErrorMessage(e));
    } finally {
      setReading(false);
    }
  }, [c.uid, read, reading]);

  return (
    <article style={{ ...styles.card, borderColor: st.color, borderLeft: `3px solid ${st.color}` }}>
      <div style={styles.cardHead}>
        <Badge label={st.label} color={st.color} />
        <div style={styles.scoreWrap}>
          <span style={{ ...styles.scoreNum, color: c.alignment?.status === 'aligned' ? 'var(--wht)' : st.color }}>
            {daily.score ?? '—'}
          </span>
          <span style={styles.scoreLbl}>Readiness</span>
        </div>
      </div>

      <div style={styles.cardName}>{c.name}</div>
      <div style={styles.cardMeta}>
        {[c.subscription_tier, c.current_streak ? `${c.current_streak}-day streak` : null].filter(Boolean).join(' · ') || 'No profile'}
      </div>

      {/* The two cue buckets, side by side. */}
      <div style={styles.buckets}>
        <div style={styles.bucket}>
          <div style={styles.bucketLbl}>Daily Readiness</div>
          <div style={styles.bucketVal}>
            {daily.band ? BAND_COPY[daily.band] || humanizeBucket(daily.band) : '—'}
            {daily.trend ? <span style={styles.trend}> {TREND_GLYPH[daily.trend] || ''}</span> : null}
          </div>
          <div style={styles.bucketSub}>
            {daily.stale
              ? `stale · ${daily.days_since_last ?? '?'}d dark`
              : daily.volume_multiplier != null ? `vol ×${daily.volume_multiplier}` : 'no reading'}
          </div>
        </div>
        <div style={styles.bucket}>
          <div style={styles.bucketLbl}>Weekly Report</div>
          <div style={styles.bucketVal}>{weekly ? humanizeBucket(weekly.substatus) : '—'}</div>
          <div style={styles.bucketSub}>
            {weekly ? (weekly.locked_in ? 'locked in' : 'compliance watch') : 'not derived'}
          </div>
        </div>
      </div>

      {findings.length > 0 ? (
        <div style={styles.findings}>
          {findings.map((f, i) => (
            <div
              key={i}
              style={{
                ...styles.finding,
                borderColor: f.severity === 'conflict' ? 'var(--red)' : f.severity === 'drift' ? 'var(--orn)' : 'var(--line)',
              }}
            >
              <span style={styles.findingCode}>{humanizeBucket(f.code)}</span>
              <span style={styles.findingMsg}>{f.message}</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={styles.stateLine}>
          {c.alignment?.status === 'no_data' ? 'No daily or weekly signal yet' : 'Cue buckets agree — nothing to reconcile'}
        </div>
      )}

      <button type="button" style={styles.readBtn} onClick={deepRead}>
        {open ? '↻ Eagle Eye Read' : '⊙ Deep Read'}
      </button>

      {open ? (
        <div style={styles.readBox}>
          {reading ? <div style={styles.readMuted}>Reading the client's logic…</div> : null}
          {!reading && readErr ? <div style={styles.readErr}>{readErr}</div> : null}
          {!reading && !readErr && read ? (
            read.synthesis
              ? <p style={styles.readText}>{read.synthesis}</p>
              : <div style={styles.readMuted}>Synthesis unavailable (Anthropic key not configured) — the deterministic verdict above is authoritative.</div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
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

  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '.85rem' },
  card: { background: 'var(--gry)', border: '1px solid var(--line)', borderRadius: 12, padding: '.95rem 1.1rem' },
  cardHead: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '.5rem', marginBottom: '.55rem' },
  scoreWrap: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1 },
  scoreNum: { fontFamily: 'var(--display)', fontSize: '1.65rem', fontWeight: 900, letterSpacing: '1px', fontVariantNumeric: 'tabular-nums' },
  scoreLbl: { fontFamily: 'var(--bd)', fontSize: '.55rem', letterSpacing: '1.6px', textTransform: 'uppercase', color: 'var(--mut)', fontWeight: 700, marginTop: '.1rem' },
  cardName: { fontFamily: 'var(--hb)', fontSize: '1.05rem', letterSpacing: '1.2px', color: 'var(--wht)', textTransform: 'uppercase' },
  cardMeta: { fontFamily: 'var(--bd)', fontSize: '.74rem', fontWeight: 700, letterSpacing: '.4px', color: 'var(--mut)', textTransform: 'capitalize', marginBottom: '.65rem' },

  buckets: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.55rem', marginBottom: '.55rem' },
  bucket: { border: '1px solid var(--line)', borderRadius: 8, padding: '.5rem .6rem', background: 'rgba(255,255,255,.02)' },
  bucketLbl: { fontFamily: 'var(--hb)', fontSize: '.58rem', letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--gold-deep)' },
  bucketVal: { fontFamily: 'var(--hb)', fontSize: '.86rem', letterSpacing: '.6px', color: 'var(--wht)', textTransform: 'uppercase', marginTop: '.2rem' },
  trend: { color: 'var(--mut)' },
  bucketSub: { fontFamily: 'var(--bd)', fontSize: '.68rem', fontWeight: 700, color: 'var(--mut)', marginTop: '.15rem' },

  findings: { display: 'flex', flexDirection: 'column', gap: '.4rem', marginTop: '.3rem' },
  finding: {
    display: 'flex', flexDirection: 'column', gap: '.18rem', padding: '.5rem .65rem',
    borderRadius: 7, border: '1px solid var(--line)', background: 'rgba(255,255,255,.03)',
  },
  findingCode: { fontFamily: 'var(--hb)', fontSize: '.68rem', letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--wht)' },
  findingMsg: { fontFamily: 'var(--bd)', fontSize: '.82rem', fontWeight: 600, color: 'var(--mut)', lineHeight: 1.4 },
  stateLine: { fontFamily: 'var(--bd)', fontSize: '.8rem', fontWeight: 700, color: 'var(--mut)', marginTop: '.3rem' },

  readBtn: {
    fontFamily: 'var(--hb)', fontSize: '.68rem', letterSpacing: '1.6px', textTransform: 'uppercase',
    color: 'var(--gold-soft)', background: 'none', border: '1px solid rgba(245,200,0,.3)',
    borderRadius: 8, padding: '.4rem .7rem', cursor: 'pointer', marginTop: '.7rem',
  },
  readBox: { marginTop: '.6rem', paddingTop: '.6rem', borderTop: '1px solid var(--line)' },
  readText: { fontFamily: 'var(--bd)', fontSize: '.86rem', fontWeight: 600, color: 'var(--wht)', lineHeight: 1.5, margin: 0 },
  readMuted: { fontFamily: 'var(--bd)', fontSize: '.8rem', fontWeight: 600, color: 'var(--mut)', fontStyle: 'italic' },
  readErr: { fontFamily: 'var(--bd)', fontSize: '.82rem', color: 'var(--red)' },

  errorBox: { border: '1px solid var(--red)', borderRadius: 12, padding: '1rem 1.2rem', background: 'rgba(239,68,68,.06)' },
  errorTitle: { fontFamily: 'var(--hb)', fontSize: '.8rem', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--red)', marginBottom: '.35rem' },
  errorMsg: { fontFamily: 'var(--bd)', fontSize: '.95rem', color: 'var(--red)', wordBreak: 'break-word', marginBottom: '.8rem' },
  retry: {
    fontFamily: 'var(--hb)', fontSize: '.72rem', letterSpacing: '2px', textTransform: 'uppercase',
    color: 'var(--red)', background: 'none', border: '1px solid var(--red)', borderRadius: 8, padding: '.45rem .9rem', cursor: 'pointer',
  },
};
