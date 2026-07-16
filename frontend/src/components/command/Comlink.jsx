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
import { fetchLeads, fetchConciergeLog, fetchTdeeLeads, fetchProspectInbox, processProspectCard } from '../../lib/comlinkApi.js';
import { toErrorMessage } from '../../lib/rosterApi.js';
import CommandSurface from './CommandSurface.jsx';
import { Tile, Badge, Loading, Empty } from './primitives.jsx';

export default function Comlink() {
  // Phase 21 — "Applications" (Pathfinder, existing) vs "TDEE Signals" (new,
  // calculator-only micro-leads). Two separate lanes by design: TDEE Signals
  // carry no PAR-Q/liability disclosure, so they never mix into the Pathfinder
  // triage queue below.
  const [view, setView] = useState('applications');

  const [leads, setLeads] = useState(null);
  const [leadsLoading, setLeadsLoading] = useState(true);
  const [leadsError, setLeadsError] = useState(null);

  const [concierge, setConcierge] = useState(null);
  const [conciergeLoading, setConciergeLoading] = useState(true);
  const [conciergeError, setConciergeError] = useState(null);

  const [tdee, setTdee] = useState(null);
  const [tdeeLoading, setTdeeLoading] = useState(true);
  const [tdeeError, setTdeeError] = useState(null);

  // Prospects — Routine Interrogator lead-capture cards (NEW_PROSPECT).
  const [prospects, setProspects] = useState(null);
  const [prospectsLoading, setProspectsLoading] = useState(true);
  const [prospectsError, setProspectsError] = useState(null);

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

  const loadTdee = useCallback(async () => {
    setTdeeLoading(true);
    setTdeeError(null);
    try {
      setTdee(await fetchTdeeLeads(100));
    } catch (e) {
      setTdee(null);
      setTdeeError(toErrorMessage(e));
    } finally {
      setTdeeLoading(false);
    }
  }, []);

  const loadProspects = useCallback(async () => {
    setProspectsLoading(true);
    setProspectsError(null);
    try {
      setProspects(await fetchProspectInbox(100));
    } catch (e) {
      setProspects(null);
      setProspectsError(toErrorMessage(e));
    } finally {
      setProspectsLoading(false);
    }
  }, []);

  // Optimistically flip a card to APPROVED once its outreach is processed.
  const markApproved = useCallback((cardId, processedAt) => {
    setProspects((p) => (p ? {
      ...p,
      cards: (p.cards || []).map((c) => (c.id === cardId ? { ...c, status: 'APPROVED', processed_at: processedAt } : c)),
    } : p));
  }, []);

  // Auto-load all feeds on mount. Deferred so the initial setState lands
  // outside the synchronous effect body.
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      loadLeads();
      loadConcierge();
      loadTdee();
      loadProspects();
    });
    return () => { cancelled = true; };
  }, [loadLeads, loadConcierge, loadTdee, loadProspects]);

  return (
    <CommandSurface
      kicker="Comlink · Concierge Matrix"
      title="The Comlink"
      lede="Incoming Pathfinder leads and the autonomous Concierge log. Unconverted (PENDING) leads and Concierge failures surface first."
    >
      {/* ── Applications vs TDEE Signals — two deliberately separate lanes. ── */}
      <div role="tablist" aria-label="Comlink views" style={styles.viewToggle}>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'applications'}
          style={{ ...styles.viewTab, ...(view === 'applications' ? styles.viewTabActive : null) }}
          onClick={() => setView('applications')}
        >
          Applications
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'tdee-signals'}
          style={{ ...styles.viewTab, ...(view === 'tdee-signals' ? styles.viewTabActive : null) }}
          onClick={() => setView('tdee-signals')}
        >
          TDEE Signals
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'prospects'}
          style={{ ...styles.viewTab, ...(view === 'prospects' ? styles.viewTabActive : null) }}
          onClick={() => setView('prospects')}
          data-testid="comlink-tab-prospects"
        >
          👥 Prospects{prospects?.pending ? ` · ${prospects.pending}` : ''}
        </button>
      </div>

      {view === 'applications' ? (
        <>
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
        </>
      ) : view === 'tdee-signals' ? (
        <>
          <div style={styles.toolbar}>
            <span style={styles.count}>
              {tdeeLoading ? 'Loading…' : tdee ? `${tdee.total} signal${tdee.total === 1 ? '' : 's'}` : '—'}
            </span>
            <button type="button" style={styles.refresh} onClick={loadTdee} disabled={tdeeLoading}>
              ↻ Refresh
            </button>
          </div>

          {!tdeeLoading && !tdeeError && tdee ? (
            <div style={styles.summary}>
              <Tile label="Total" value={tdee.total} unit="signals" accent="var(--gold-soft)" />
              <Tile label="Converted" value={tdee.converted} unit="→ applied" accent="var(--grn)" />
            </div>
          ) : null}

          <Section title="TDEE / Daily Burn Signals">
            {tdeeLoading ? <Loading label="Loading TDEE signals…" /> : null}
            {!tdeeLoading && tdeeError ? (
              <ErrorBox message={tdeeError} onRetry={loadTdee} />
            ) : null}
            {!tdeeLoading && !tdeeError && tdee && (tdee.leads || []).length === 0 ? (
              <Empty>No calculator signals yet. TDEE Calculator + Daily Burn captures land here.</Empty>
            ) : null}
            {!tdeeLoading && !tdeeError && tdee && (tdee.leads || []).length > 0 ? (
              <div style={styles.list}>
                {tdee.leads.map((lead) => <TdeeLeadRow key={lead.id} lead={lead} />)}
              </div>
            ) : null}
          </Section>
        </>
      ) : (
        <>
          <div style={styles.toolbar}>
            <span style={styles.count}>
              {prospectsLoading ? 'Loading…' : prospects ? `${prospects.total} prospect${prospects.total === 1 ? '' : 's'}` : '—'}
            </span>
            <button type="button" style={styles.refresh} onClick={loadProspects} disabled={prospectsLoading}>
              ↻ Refresh
            </button>
          </div>

          {!prospectsLoading && !prospectsError && prospects ? (
            <div style={styles.summary}>
              <Tile label="Total" value={prospects.total} unit="audited" accent="var(--gold-soft)" />
              <Tile label="Pending" value={prospects.pending} unit="to reach out" accent="var(--orn)" />
            </div>
          ) : null}

          <Section title="Interrogator Prospects">
            {prospectsLoading ? <Loading label="Loading prospects…" /> : null}
            {!prospectsLoading && prospectsError ? (
              <ErrorBox message={prospectsError} onRetry={loadProspects} />
            ) : null}
            {!prospectsLoading && !prospectsError && prospects && (prospects.cards || []).length === 0 ? (
              <Empty>No prospects yet. Routine Interrogator audits (with a contact handle) land here.</Empty>
            ) : null}
            {!prospectsLoading && !prospectsError && prospects && (prospects.cards || []).length > 0 ? (
              <div style={styles.list}>
                {prospects.cards.map((card) => (
                  <ProspectCard key={card.id} card={card} onApprove={markApproved} />
                ))}
              </div>
            ) : null}
          </Section>
        </>
      )}
    </CommandSurface>
  );
}

// ── One prospect card. Gold 👥 badge; [⚡ SEND SMS] copies the Gemini outreach
// draft, opens the native SMS composer, stamps processed_at + status APPROVED. ──
function ProspectCard({ card, onApprove }) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const p = card.prospect || {};
  const approved = String(card.status) === 'APPROVED';
  const verdict = p.gap_verdict || card.prospect?.gap_report?.verdict?.recommended_tier || '—';
  const gaps = Array.isArray(p.gap_report?.gaps) ? p.gap_report.gaps : [];
  const color = approved ? 'var(--grn)' : 'var(--gold-soft)';

  async function sendSms() {
    if (busy || approved) return;
    setBusy(true);
    const text = card.draft_message || '';
    // Copy the pre-written outreach.
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    } catch { /* clipboard blocked — the sms: link still carries the body */ }
    setCopied(true);
    // Open the native SMS composer (handle may be a phone; the coach picks the recipient).
    try {
      const phone = /^[+0-9().\-\s]{7,}$/.test(String(p.contact_handle || '')) ? String(p.contact_handle).replace(/[^+0-9]/g, '') : '';
      window.open(`sms:${phone}?body=${encodeURIComponent(text)}`, '_self');
    } catch { /* no sms handler — copy already done */ }
    // Stamp + approve server-side.
    try {
      const res = await processProspectCard(card.id);
      onApprove?.(card.id, res?.card?.processed_at || new Date().toISOString());
    } catch { /* leave as pending on failure */ }
    finally { setBusy(false); }
  }

  return (
    <div style={{ ...styles.row, borderLeft: `3px solid ${color}` }} data-testid="prospect-card">
      <div style={styles.rowHead}>
        <span style={styles.rowMain}>
          <span style={styles.rowName}>
            <span style={styles.prospectBadge}>👥 PROSPECT</span>{' '}
            {p.name || '(no name)'}
          </span>
          <span style={styles.rowSub}>{p.contact_handle || '—'}</span>
        </span>
        <span style={styles.rowMeta}>
          <Badge label={approved ? 'Approved' : `Verdict: ${verdict}`} color={color} />
          <span style={styles.when}>{timeAgo(card.created_at)}</span>
        </span>
      </div>

      {card.insight_summary ? <div style={styles.bits}>{card.insight_summary}</div> : null}
      {gaps.length ? (
        <div style={styles.gapChips}>
          {gaps.slice(0, 3).map((g, i) => <span key={i} style={styles.gapChip}>{g.title}</span>)}
        </div>
      ) : null}
      {card.proposed_action ? <div style={styles.proposed}>▸ {card.proposed_action}</div> : null}

      <div style={styles.prospectActions}>
        <button
          type="button"
          style={{ ...styles.smsBtn, ...(approved ? styles.smsBtnDone : null) }}
          onClick={sendSms}
          disabled={busy || approved}
          data-testid="prospect-send-sms"
        >
          {approved ? '✓ Approved' : busy ? 'Sending…' : copied ? '✓ Copied — Send SMS' : '⚡ Send SMS'}
        </button>
      </div>
    </div>
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

// ── One TDEE / Daily Burn calculator signal. A "Converted" badge shows once the
// same email later completes a full Pathfinder application (converted_lead_id
// backfilled server-side) — the intent-to-conversion timeline for the coach. ──
function TdeeLeadRow({ lead }) {
  const converted = !!lead.converted_lead_id;
  const color = converted ? 'var(--grn)' : 'var(--gold-soft)';
  const bits = [
    lead.goal ? `Goal: ${lead.goal}` : null,
    Number.isFinite(lead.tdee_maintenance) ? `${lead.tdee_maintenance.toLocaleString()} maintenance kcal` : null,
    Number.isFinite(lead.tdee_target) ? `${lead.tdee_target.toLocaleString()} target kcal` : null,
    (Number.isFinite(lead.macro_p) || Number.isFinite(lead.macro_c) || Number.isFinite(lead.macro_f))
      ? `P${lead.macro_p ?? '–'} · C${lead.macro_c ?? '–'} · F${lead.macro_f ?? '–'}`
      : null,
    lead.source === 'daily_burn' ? 'Daily Burn (/burn)' : 'TDEE Calculator',
  ].filter(Boolean);

  return (
    <div style={{ ...styles.row, borderLeft: `3px solid ${color}` }}>
      <div style={styles.rowHead}>
        <span style={styles.rowMain}>
          <span style={styles.rowName}>{lead.full_name || '(no name)'}</span>
          <span style={styles.rowSub}>{lead.email || '—'}</span>
        </span>
        <span style={styles.rowMeta}>
          {converted ? <Badge label="Converted" color={color} /> : null}
          <span style={styles.when}>{timeAgo(lead.created_at)}</span>
        </span>
      </div>
      {bits.length ? <div style={styles.bits}>{bits.join(' · ')}</div> : null}
      {lead.email ? (
        <a style={styles.mailto} href={`mailto:${lead.email}?subject=${encodeURIComponent('Build Believe Fit — Your Numbers')}`}>✉ Email lead</a>
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
  viewToggle: { display: 'flex', gap: '.5rem', marginBottom: '1.2rem' },
  viewTab: {
    fontFamily: 'var(--hb)', fontSize: '.72rem', letterSpacing: '2px', textTransform: 'uppercase',
    color: 'var(--mut)', background: 'var(--gry)', border: '1px solid var(--line)',
    borderRadius: 8, padding: '.55rem 1rem', cursor: 'pointer',
  },
  viewTabActive: { color: 'var(--wht)', borderColor: 'rgba(245,200,0,.5)', background: 'rgba(245,200,0,.08)' },

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

  prospectBadge: { fontFamily: 'var(--hb)', fontSize: '.62rem', letterSpacing: '1.5px', color: '#0e0a16', background: 'linear-gradient(90deg,#f5c800,#ffd83a)', border: '1px solid #f5c800', borderRadius: 999, padding: '1px 7px', marginRight: '.4rem', verticalAlign: 'middle' },
  gapChips: { display: 'flex', flexWrap: 'wrap', gap: '.35rem', marginTop: '.55rem' },
  gapChip: { fontFamily: 'var(--bd)', fontWeight: 700, fontSize: '.68rem', letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--gold-soft)', border: '1px solid rgba(245,200,0,.4)', background: 'rgba(245,200,0,.07)', borderRadius: 999, padding: '2px 9px' },
  proposed: { fontFamily: 'var(--bd)', fontSize: '.82rem', fontWeight: 700, color: 'rgba(249,245,255,.72)', marginTop: '.6rem' },
  prospectActions: { display: 'flex', gap: '.6rem', marginTop: '.7rem' },
  smsBtn: { fontFamily: 'var(--hb)', fontSize: '.8rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#0e0a16', background: 'linear-gradient(90deg,#f5c800,#ffd83a)', border: '1px solid #f5c800', borderRadius: 10, padding: '.6rem 1.1rem', cursor: 'pointer' },
  smsBtnDone: { color: '#0e1a10', background: 'linear-gradient(90deg,#22c55e,#7dffb0)', border: '1px solid #22c55e', cursor: 'default' },

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
