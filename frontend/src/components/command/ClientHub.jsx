// src/components/command/ClientHub.jsx
// ─────────────────────────────────────────────────────────────────────────────
// "Client Database Hub" — the Command Center centerpiece (admin), rebuilt to the
// Google AI Studio prototype: an executive-suite header with live roster stats, a
// filterable CLIENT SELECTION ROSTER (left), and the selected athlete's drill-in
// <ClientDossier/> (right) with the 5-deck nested nav.
//
//   MASTER  → live Sovereign Roster. A selected row keeps an active glass border;
//             the roster never unmounts. A filter narrows it client-side.
//   DETAIL  → <ClientDossier/> — athlete card + 7-Day Nutrition / 7-Day Workouts /
//             90-Day Analytics / Athlete Feed Chat / Update Target.
//
// Data path: lib/rosterApi.rosterCall('roster'), which attaches the runtime-
// hydrated X-BBF-Admin-Token (the Command Center unlock gate supplies it once;
// never bundled, §7). Roster pull:
//   POST {FUNCTIONS_BASE}/bbf-admin-roster { action:'roster' }
//   200 → { ok:true, count, clients:[{ id, uid, name, email, role,
//           metabolic_tier, subscription_tier, tdee_target, updated_at }] }
//
// We hold the WHOLE selected row (not a bare uid) — the dossier's detail action
// keys on the `id` PK, and the row gives instant header context.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { rosterCall, toErrorMessage } from '../../lib/rosterApi.js';
import { getRosterTelemetry } from '../../lib/protocolOverrideApi.js';
import { useAuth, getStoredVaultToken } from '../../context/AuthContext.jsx';
import { supabase } from '../../lib/supabaseClient.js';
import ClientDossier from './ClientDossier.jsx';
import ForgeAthlete from './ForgeAthlete.jsx';
import './founderfive.css';

// Roster sort modes. Adherence Low→High is the intervention view — slipping
// clients bubble to the top (insufficient/no-score sink to the bottom).
const SORTS = [
  ['name', 'Name'],
  ['adherence', 'Adherence ↑'],
  ['tonnage', 'Tonnage ↓'],
];

export default function ClientHub() {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeId, setActiveId] = useState(null); // selected row id | null
  const [filter, setFilter] = useState('');
  const [sortBy, setSortBy] = useState('name');
  // Telemetry & Adherence Radar — { [id]: telemetryRow }. Loaded AFTER the
  // roster paints (one batch call), so the radar never blocks first render.
  const [telemetry, setTelemetry] = useState({});
  // The Hardwire Gateway — Forge Athlete modal (god-mode onboarding bypass).
  const [forgeOpen, setForgeOpen] = useState(false);
  // Optimistic roster injection: the forged athlete's roster-shaped row lands
  // at the head of the list INSTANTLY; the follow-up fetch reconciles.
  const onForged = useCallback((client) => {
    if (client?.id) setData((prev) => [client, ...prev.filter((c) => c.id !== client.id)]);
  }, []);

  const fetchRoster = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const body = await rosterCall('roster');
      let clients = Array.isArray(body.clients) ? body.clients : [];
      // Overlay each athlete's 30-Day Calibration day/phase (admin-gated RPC), merged by
      // id. Non-fatal: if it fails, the roster still loads — the badge just hides.
      try {
        const { data: cal } = await supabase.rpc('bbf_admin_roster_calibration', {
          p_session_token: getStoredVaultToken(),
        });
        if (Array.isArray(cal) && cal.length) {
          const byId = new Map(cal.map((r) => [r.id, r]));
          clients = clients.map((c) => {
            const m = byId.get(c.id);
            return m ? { ...c, calibration_day: m.calibration_day, calibration_phase: m.calibration_phase } : c;
          });
        }
      } catch { /* calibration overlay is non-fatal */ }
      setData(clients);
    } catch (e) {
      setError(toErrorMessage(e));
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Telemetry radar — a SEPARATE, non-blocking batch pull (one call for the whole
  // roster). Runs after the roster loads so cards paint immediately, then light up.
  const fetchTelemetry = useCallback(async () => {
    try {
      const rows = await getRosterTelemetry();
      setTelemetry(Object.fromEntries(rows.map((r) => [r.id, r])));
    } catch { /* radar is an overlay — a failure just leaves the cards un-lit */ }
  }, []);

  // Auto-load on mount (the admin token is hydrated by the Command Center gate).
  // Deferred via microtask so the initial setState lands outside the synchronous
  // effect body (satisfies react-hooks/set-state-in-effect); cancel-guarded.
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) { fetchRoster(); fetchTelemetry(); } });
    return () => { cancelled = true; };
  }, [fetchRoster, fetchTelemetry]);

  const rowKey = (c) => c.id ?? c.uid ?? c.email;
  const activeClient = data.find((c) => rowKey(c) === activeId) || null;

  // Live, real stats derived from the roster payload (no fabricated numbers): the
  // active head-count and the share of athletes with a configured macro target.
  const total = data.length;
  const configured = data.filter((c) => Number(c.tdee_target) > 0).length;
  const compliancePct = total ? Math.round((configured / total) * 100) : 0;

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const base = !q ? data : data.filter((c) => {
      const hay = `${c.name || ''} ${c.uid || ''} ${c.email || ''} ${division(c)}`.toLowerCase();
      return hay.includes(q);
    });
    if (sortBy === 'name') return base;
    const rk = (c) => c.id ?? c.uid ?? c.email;
    const rows = [...base];
    if (sortBy === 'adherence') {
      // Low→High: real scores ascending (slipping clients first); rows with no
      // score (insufficient / radar not yet loaded) sink to the bottom.
      rows.sort((a, b) => {
        const sa = telemetry[rk(a)]?.adherence_score;
        const sb = telemetry[rk(b)]?.adherence_score;
        const na = sa == null ? Infinity : sa;
        const nb = sb == null ? Infinity : sb;
        return na - nb;
      });
    } else if (sortBy === 'tonnage') {
      rows.sort((a, b) => (telemetry[rk(b)]?.tonnage_week || 0) - (telemetry[rk(a)]?.tonnage_week || 0));
    }
    return rows;
  }, [data, filter, sortBy, telemetry]);

  const execName = (user?.displayName || user?.username || 'Sovereign').toUpperCase();

  return (
    <div className="ff">
      <header className="ff-hub-head">
        {/* Eyebrow tied to the "Founder Five" tab identity (was a standalone
            "Executive Suite" header that read as a separate app on top of the
            Command Center) — consolidated to flow within the hierarchy. */}
        <div className="ff-exec-kicker">⚡ Founder Five · {execName}</div>
        <div className="ff-hub-row">
          <div className="ff-hub-titlewrap">
            <h2 className="ff-hub-title">▦ Client Database Hub</h2>
            <p className="ff-lede">
              Real-time coaching dashboard. Cross-tracks detailed 7-day meal plans, live
              interactive Voice Chef cooking guidance, and 90-day progress metrics.
            </p>
          </div>
          <div className="ff-stats">
            <div className="ff-stat">
              <span className="ff-stat-label">Total Clients</span>
              <span className="ff-stat-val">{isLoading ? '—' : total}<em> Active</em></span>
            </div>
            <div className="ff-stat ff-stat--gold">
              <span className="ff-stat-label">Macro Compliance</span>
              <span className="ff-stat-val">{isLoading ? '—' : `${compliancePct}%`}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="ff-grid">
        {/* ── MASTER: live roster ── */}
        <aside className="ff-master" aria-label="Client selection roster">
          <div className="ff-roster-kicker">● Client Selection Roster</div>
          <input
            className="ff-filter"
            type="search"
            placeholder="Filter clients…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Filter clients"
          />
          <div className="ff-toolbar">
            <span className="ff-count">
              {isLoading ? 'Loading…' : `${filtered.length} of ${total} athlete${total === 1 ? '' : 's'}`}
            </span>
            <button type="button" className="ff-refresh" onClick={() => { fetchRoster(); fetchTelemetry(); }} disabled={isLoading}>
              ↻ Refresh
            </button>
          </div>

          {/* Telemetry & Adherence Radar — sort control. Adherence ↑ floats the
              slipping clients to the top for immediate intervention. */}
          <div className="ff-sortbar" role="tablist" aria-label="Sort roster">
            {SORTS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={sortBy === id}
                className={`ff-sortchip${sortBy === id ? ' is-on' : ''}`}
                onClick={() => setSortBy(id)}
                data-testid={`roster-sort-${id}`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* The Hardwire Gateway — god-mode onboarding bypass w/ clinical profiling. */}
          <button type="button" className="ff-forge" onClick={() => setForgeOpen(true)} data-testid="forge-open">
            ⚒ Forge Athlete
          </button>

          {isLoading ? (
            <div className="ff-state" role="status" aria-live="polite">
              <span className="ff-dot" /> Loading roster…
            </div>
          ) : null}

          {!isLoading && error ? (
            <div className="ff-error" role="alert">
              <div className="ff-error-title">Roster fetch failed</div>
              <div className="ff-error-msg">{error}</div>
              <button type="button" className="ff-retry" onClick={fetchRoster}>Retry</button>
            </div>
          ) : null}

          {!isLoading && !error && total === 0 ? (
            <div className="ff-state">No athletes on the roster yet.</div>
          ) : null}

          {!isLoading && !error && total > 0 && filtered.length === 0 ? (
            <div className="ff-state">No athletes match “{filter}”.</div>
          ) : null}

          {!isLoading && !error && filtered.length > 0 ? (
            <ul className="ff-list">
              {filtered.map((c) => (
                <ClientRow
                  key={rowKey(c)}
                  client={c}
                  active={rowKey(c) === activeId}
                  onSelect={() => setActiveId(rowKey(c))}
                  tel={telemetry[rowKey(c)] || null}
                />
              ))}
            </ul>
          ) : null}
        </aside>

        {/* ── DETAIL: drill-in dossier for the selected athlete ── */}
        <section className={`ff-detail${activeClient ? ' is-open' : ''}`} aria-label="Athlete dossier">
          {activeClient ? (
            <ClientDossier client={activeClient} onBack={() => setActiveId(null)} onRosterRefresh={fetchRoster} />
          ) : (
            <div className="ff-placeholder">
              <span className="ff-placeholder-mark" aria-hidden="true">◎</span>
              <div className="ff-placeholder-title">No athlete selected</div>
              <div className="ff-placeholder-note">
                Choose an athlete from the roster to open their nutrition, workouts, 90-day
                analytics, feed chat, and target reconfigurator.
              </div>
            </div>
          )}
        </section>
      </div>

      {forgeOpen ? (
        <ForgeAthlete
          onClose={() => { setForgeOpen(false); fetchRoster(); /* reconcile the optimistic row */ }}
          onForged={onForged}
        />
      ) : null}
    </div>
  );
}

// ── Telemetry radar chrome ──────────────────────────────────────────────────
// status → dot color + left-border accent + human label. 'insufficient' is a
// neutral gray (a freshly-forged athlete with no data — not a false flight risk).
const STATUS_META = {
  green: { dot: '#22c55e', edge: 'rgba(34,197,94,.55)', label: 'On Track' },
  yellow: { dot: '#f5c800', edge: 'rgba(245,200,0,.5)', label: 'Warning' },
  red: { dot: '#ff5470', edge: 'rgba(255,84,112,.6)', label: 'Flight Risk' },
  insufficient: { dot: 'rgba(249,245,255,.35)', edge: 'var(--line)', label: 'New · No Data' },
};

function fmtTonnage(lbs) {
  const n = Number(lbs) || 0;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(Math.round(n));
}

// Lightweight inline-SVG sparkline — 7 daily tonnage points, gold stroke. Pure
// geometry, no chart lib. Flat baseline when every point is zero.
function Sparkline({ points, color = 'var(--yel)' }) {
  const pts = Array.isArray(points) && points.length ? points.map(Number) : [0, 0, 0, 0, 0, 0, 0];
  const w = 56, h = 16, max = Math.max(...pts, 1);
  const step = pts.length > 1 ? w / (pts.length - 1) : w;
  const d = pts.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(h - (v / max) * (h - 2) - 1).toFixed(1)}`).join(' ');
  return (
    <svg className="ff-spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" preserveAspectRatio="none">
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── One roster row — clickable, active glass border, division + telemetry radar. ─
function ClientRow({ client, active, onSelect, tel }) {
  const name = client.name || client.uid || 'Unnamed';
  const div = division(client);
  const tier = client.subscription_tier || client.role || null;
  const color = tierColor(client.subscription_tier);
  const cal = calBadge(client);
  const sm = tel ? (STATUS_META[tel.status] || STATUS_META.insufficient) : null;
  const hasTon = tel && (tel.tonnage_week > 0 || tel.tonnage_prev > 0);
  const trendGlyph = { up: '📈', down: '📉', flat: '➡️' }[tel?.tonnage_trend] || '';
  return (
    <li>
      <button
        type="button"
        className={`ff-row${active ? ' is-active' : ''}${sm ? ` ff-row--${tel.status}` : ''}`}
        onClick={onSelect}
        aria-pressed={active}
        aria-label={`Open dossier for ${name}${sm ? ` — ${sm.label}${tel.adherence_score != null ? ` ${tel.adherence_score}%` : ''}` : ''}`}
      >
        <span className="ff-avatar" style={{ borderColor: color }}>{initials(name)}</span>
        <span className="ff-row-main">
          <span className="ff-row-name">{name}</span>
          <span className="ff-row-sub">{div}</span>
          {/* Telemetry chip row — clinical, single line. */}
          {sm ? (
            <span className="ff-tel">
              <span className="ff-tel-status" style={{ color: sm.dot }}>
                <span className="ff-tel-dot" style={{ background: sm.dot }} aria-hidden="true" />
                {sm.label}{tel.adherence_score != null ? ` · ${tel.adherence_score}%` : ''}
              </span>
              {tel.workout_assigned > 0 ? (
                <span className="ff-tel-chip">{tel.workout_completed}/{tel.workout_assigned} wk</span>
              ) : null}
              {hasTon ? (
                <span className="ff-tel-chip">{fmtTonnage(tel.tonnage_week)} lbs {trendGlyph}</span>
              ) : null}
              {hasTon ? <Sparkline points={tel.sparkline} /> : null}
            </span>
          ) : null}
          {cal ? <span className="ff-cal" style={{ ...CAL_BASE, ...CAL_TONE[cal.tone] }}>{cal.text}</span> : null}
        </span>
        <span className="ff-row-meta">
          <span className="ff-badge" style={{ color, borderColor: color }}>{tier || '—'}</span>
          {Number(client.tdee_target) > 0 ? (
            <span className="ff-row-flag ff-row-flag--ok">● Configured</span>
          ) : (
            <span className="ff-row-flag">○ Unset</span>
          )}
        </span>
      </button>
    </li>
  );
}

// ── Pure helpers ──────────────────────────────────────────────────────────────
function initials(name) {
  const p = String(name || '').trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '—';
}
// The athlete's "division"/category line — real fields only, most specific first.
function division(c) {
  return c.metabolic_tier || c.subscription_tier || c.role || 'Sovereign Client';
}
function tierColor(tier) {
  const map = {
    platinum: 'var(--yel)',
    essentials: 'var(--grn)',
    sovereign: 'var(--purl)',
  };
  return map[String(tier || '').toLowerCase()] || 'var(--mut)';
}

// ── 30-Day Calibration roster badge — the server sends calibration_day +
// calibration_phase (grandfathered/undatable → phase 'sovereign', day null → just
// "Sovereign"). Brand purple→gold: Baseline (locked) → Ignition → Sovereign (gold). ──
const CAL_BASE = {
  alignSelf: 'flex-start', marginTop: 4, fontFamily: "'Barlow Condensed', sans-serif",
  fontWeight: 700, fontSize: '.66rem', letterSpacing: '.5px', textTransform: 'uppercase',
  padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap', lineHeight: 1.5,
};
const CAL_TONE = {
  baseline:  { color: '#c9a3ff', border: '1px solid rgba(157,39,201,.55)', background: 'rgba(106,13,173,.22)' },
  ignition:  { color: '#f5cf60', border: '1px solid rgba(245,200,0,.5)', background: 'rgba(106,13,173,.20)' },
  sovereign: { color: '#0e0a16', border: '1px solid #f5c800', background: 'linear-gradient(90deg,#f5c800,#ffd83a)' },
};
function calBadge(client) {
  const phase = String(client.calibration_phase || '').toLowerCase();
  if (!CAL_TONE[phase]) return null;
  const day = Number(client.calibration_day);
  const text = phase === 'sovereign'
    ? (Number.isFinite(day) && day >= 30 ? `Day ${day} · Sovereign` : 'Sovereign')
    : `Day ${Number.isFinite(day) ? day : '—'} · ${phase[0].toUpperCase()}${phase.slice(1)}`;
  return { text, tone: phase };
}
