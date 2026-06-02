// src/components/command/Comlink.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 10 — The Sovereign Comlink, live-wired.   Phase 10.7 — silent-auth hotfix.
//
// Data (via lib/comlinkApi → Render Express backend, X-BBF-Admin-Token):
//   • Incoming Leads  (/api/leads-list)    — Pathfinder submissions; PENDING vs
//     PROVISIONED. PENDING = unconverted = the high-priority triage signal.
//   • Concierge log   (/api/concierge-log) — autonomous re-engagement runs;
//     FAILED sends are the red escalations.
//
// There is NO separate "SOS Queue" in the backend — the triage signal is PENDING
// leads (var(--orn)) + Concierge failures (var(--red)).
//
// Auth: the X-BBF-Admin-Token is hydrated at runtime (Command Center unlock gate /
// window global), never bundled (§7). Once hydrated, both feeds auto-load on mount;
// transient errors render in-place with a Retry.

import { useCallback, useEffect, useState } from 'react';
import { fetchLeads, fetchConciergeLog } from '../../lib/comlinkApi.js';
import { toErrorMessage } from '../../lib/rosterApi.js';
import CommandSurface from './CommandSurface.jsx';
import { Tile, Badge, Loading, Empty } from './primitives.jsx';

export default function Comlink() {
  const [leads, setLeads] = useState(null);
  const [leadsLoading, setLeadsLoading] = useState(true);
  const [leadsError, setLeadsError] = useState(null);

  const [concierge, setConcierge] = useState(null);
  const [conciergeLoading, setConciergeLoading] = useState(true);
  const [conciergeError, setConciergeError] = useState(null);

  const loadLeads = useCallback(async () => {
    setLeadsLoading(true);
    setLeadsError(null);
    try {
      setLeads(await fetchLeads(100));
    } catch (e) {
      setLeads(null);
      setLeadsError(toErrorMessage(e));
    } finally {
      setLeadsLoading(false);
    }
  }, []);

  const loadConcierge = useCallback(async () => {
    setConciergeLoading(true);
    setConciergeError(null);
    try {
      setConcierge(await fetchConciergeLog(80));
    } catch (e) {
      setConcierge(null);
      setConciergeError(toErrorMessage(e));
    } finally {
      setConciergeLoading(false);
    }
  }, []);

  // Auto-load both feeds on mount. Deferred so the initial setState lands outside
  // the synchronous effect body.
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      loadLeads();
      loadConcierge();
    });
    return () => { cancelled = true; };
  }, [loadLeads, loadConcierge]);

  return (
    <CommandSurface
      kicker="Comlink · Concierge Matrix"
      title="The Comlink"
      lede="Incoming Pathfinder leads and the autonomous Concierge log. Unconverted (PENDING) leads and Concierge failures surface first."
    >
      <div style={styles.toolbar}>
        <span style={styles.count}>
          {leadsLoading ? 'Loading…' : leads ? `${leads.total} lead${leads.total === 1 ? '' : 's'}` : '—'}
        </span>
        <button
          type="button"
          style={styles.refresh}
          onClick={() => { loadLeads(); loadConcierge(); }}
          disabled={leadsLoading || conciergeLoading}
        >
          ↻ Refresh
        </button>
      </div>

      {/* ── Leads summary (shared Tile primitive). ── */}
      {!leadsLoading && !leadsError && leads ? (
        <div style={styles.summary}>
          <Tile label="Total" value={leads.total} unit="leads" accent="var(--gold-soft)" />
          <Tile label="Pending" value={leads.pending} unit="to convert" accent="var(--orn)" />
          <Tile label="Provisioned" value={leads.provisioned} unit="onboarded" accent="var(--grn)" />
        </div>
      ) : null}

      {/* ── Incoming leads (primary feed). ── */}
      <Section title="Incoming Leads">
        {leadsLoading ? <Loading label="Loading leads…" /> : null}
        {!leadsLoading && leadsError ? (
          <ErrorBox message={leadsError} onRetry={loadLeads} />
        ) : null}
        {!leadsLoading && !leadsError && leads && (leads.leads || []).length === 0 ? (
          <Empty>No leads in the queue yet. New Pathfinder submissions land here.</Empty>
        ) : null}
        {!leadsLoading && !leadsError && leads && (leads.leads || []).length > 0 ? (
          <div style={styles.list}>
            {leads.leads.map((lead) => <LeadRow key={lead.id ?? lead.email} lead={lead} />)}
          </div>
        ) : null}
      </Section>

      {/* ── Concierge log (secondary, read-only). ── */}
      <Section title="Concierge Activity">
        {conciergeLoading ? <Loading label="Loading Concierge log…" /> : null}
        {!conciergeLoading && conciergeError ? (
          <div style={styles.inlineErr} role="alert">
            <span style={styles.errMsg}>{conciergeError}</span>
            <button type="button" style={styles.retry} onClick={loadConcierge}>Retry</button>
          </div>
        ) : null}
        {!conciergeLoading && !conciergeError && concierge ? (
          <ConciergeLog runs={concierge.runs || []} />
        ) : null}
      </Section>
    </CommandSurface>
  );
}

// ── One incoming lead. PENDING (unconverted) is the high-priority state. ───────
function LeadRow({ lead }) {
  const pending = !lead.provisioned;
  const color = pending ? 'var(--orn)' : 'var(--grn)';
  const bits = [
    lead.tier ? `Tier ${lead.tier}` : null,
    lead.primary_goal ? `Goal: ${String(lead.primary_goal).slice(0, 40)}` : null,
    lead.dietary_profile || null,
    (Array.isArray(lead.allergens) && lead.allergens.length) ? `${lead.allergens.length} allergen${lead.allergens.length === 1 ? '' : 's'}` : null,
  ].filter(Boolean);

  return (
    <div style={{ ...styles.row, borderLeft: `3px solid ${color}` }}>
      <div style={styles.rowHead}>
        <span style={styles.rowMain}>
          <span style={styles.rowName}>{lead.full_name || '(no name)'}</span>
          <span style={styles.rowSub}>{lead.email || '—'}</span>
        </span>
        <span style={styles.rowMeta}>
          <Badge label={pending ? 'Pending' : 'Provisioned'} color={color} />
          <span style={styles.when}>{timeAgo(lead.created_at)}</span>
        </span>
      </div>
      {bits.length ? <div style={styles.bits}>{bits.join(' · ')}</div> : null}
      {lead.email ? (
        <a style={styles.mailto} href={`mailto:${lead.email}?subject=${encodeURIComponent('Build Believe Fit — Next Steps')}`}>✉ Email lead</a>
      ) : null}
    </div>
  );
}

// ── Concierge runs — compact, read-only. FAILED sends render red. ──────────────
function ConciergeLog({ runs }) {
  if (!runs.length) return <Empty>No Concierge runs yet. The agent fires daily at 09:00 UTC.</Empty>;
  const totalSent = runs.reduce((n, r) => n + (r.sent || 0), 0);
  const totalFailed = runs.reduce((n, r) => n + (r.failed || 0), 0);
  return (
    <div>
      <div style={styles.conciergeHead}>
        <Badge label={`${runs.length} runs`} color="var(--mut)" />
        <Badge label={`${totalSent} sent`} color="var(--grn)" />
        {totalFailed > 0 ? <Badge label={`${totalFailed} failed`} color="var(--red)" /> : null}
        <span style={styles.when}>last run {timeAgo(runs[0]?.started_at)}</span>
      </div>
      <div style={styles.list}>
        {runs.slice(0, 12).map((run, i) => {
          const failed = (run.failed || 0) > 0;
          return (
            <div key={run.run_id ?? i} style={{ ...styles.runRow, borderLeft: `3px solid ${failed ? 'var(--red)' : 'var(--line)'}` }}>
              <span style={styles.rowSub}>Run · {timeAgo(run.started_at)}</span>
              <span style={styles.runStats}>
                <Badge label={`${run.sent || 0} sent`} color="var(--grn)" />
                {run.failed ? <Badge label={`${run.failed} failed`} color="var(--red)" /> : null}
                {run.skipped ? <Badge label={`${run.skipped} skipped`} color="var(--mut)" /> : null}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section style={styles.section}>
      <div style={styles.sectionTitle}>{title}</div>
      {children}
    </section>
  );
}
function ErrorBox({ message, onRetry }) {
  return (
    <div style={styles.errorBox} role="alert">
      <div style={styles.errorTitle}>Comlink fetch failed</div>
      <div style={styles.errMsg}>{message}</div>
      <div style={styles.errActions}>
        <button type="button" style={styles.retry} onClick={onRetry}>Retry</button>
      </div>
    </div>
  );
}

function timeAgo(iso) {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return '—';
  if (ms < 0) return 'just now';
  const s = Math.floor(ms / 1000); if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24); if (d < 30) return `${d}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
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

  section: { borderTop: '1px solid var(--line)', paddingTop: '1.1rem', marginTop: '1.4rem' },
  sectionTitle: { fontFamily: 'var(--hb)', fontSize: '.92rem', letterSpacing: '2.5px', textTransform: 'uppercase', color: 'var(--wht)', marginBottom: '.9rem' },

  list: { display: 'flex', flexDirection: 'column', gap: '.6rem' },
  row: { background: 'var(--gry)', border: '1px solid var(--line)', borderRadius: 12, padding: '.85rem 1.1rem' },
  rowHead: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' },
  rowMain: { display: 'flex', flexDirection: 'column', minWidth: 0 },
  rowName: { fontFamily: 'var(--hb)', fontSize: '1rem', letterSpacing: '1px', color: 'var(--wht)' },
  rowSub: { fontFamily: 'var(--bd)', fontSize: '.82rem', fontWeight: 700, color: 'var(--mut)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  rowMeta: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '.3rem', flexShrink: 0 },
  when: { fontFamily: 'var(--bd)', fontSize: '.72rem', fontWeight: 700, color: 'var(--mut)' },
  bits: { fontFamily: 'var(--bd)', fontSize: '.82rem', fontWeight: 700, color: 'var(--mut)', marginTop: '.5rem' },
  mailto: { display: 'inline-block', marginTop: '.6rem', fontFamily: 'var(--hb)', fontSize: '.7rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--gold-soft)' },

  conciergeHead: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '.5rem', marginBottom: '.9rem' },
  runRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', background: 'var(--gry)', border: '1px solid var(--line)', borderRadius: 10, padding: '.55rem .9rem' },
  runStats: { display: 'flex', gap: '.35rem', flexWrap: 'wrap', justifyContent: 'flex-end' },

  errorBox: { border: '1px solid var(--red)', borderRadius: 12, padding: '1rem 1.2rem', background: 'rgba(239,68,68,.06)' },
  errorTitle: { fontFamily: 'var(--hb)', fontSize: '.8rem', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--red)', marginBottom: '.35rem' },
  inlineErr: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', border: '1px solid var(--red)', borderRadius: 10, padding: '.7rem 1rem' },
  errMsg: { fontFamily: 'var(--bd)', fontSize: '.95rem', color: 'var(--red)', wordBreak: 'break-word' },
  errActions: { display: 'flex', gap: '.6rem', marginTop: '.8rem' },
  retry: {
    fontFamily: 'var(--hb)', fontSize: '.72rem', letterSpacing: '2px', textTransform: 'uppercase',
    color: 'var(--red)', background: 'none', border: '1px solid var(--red)', borderRadius: 8, padding: '.45rem .9rem', cursor: 'pointer', whiteSpace: 'nowrap',
  },
};
