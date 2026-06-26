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
import { useAuth, getStoredVaultToken } from '../../context/AuthContext.jsx';
import { supabase } from '../../lib/supabaseClient.js';
import ClientDossier from './ClientDossier.jsx';
import './founderfive.css';

export default function ClientHub() {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeId, setActiveId] = useState(null); // selected row id | null
  const [filter, setFilter] = useState('');

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

  // Auto-load on mount (the admin token is hydrated by the Command Center gate).
  // Deferred via microtask so the initial setState lands outside the synchronous
  // effect body (satisfies react-hooks/set-state-in-effect); cancel-guarded.
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) fetchRoster(); });
    return () => { cancelled = true; };
  }, [fetchRoster]);

  const rowKey = (c) => c.id ?? c.uid ?? c.email;
  const activeClient = data.find((c) => rowKey(c) === activeId) || null;

  // Live, real stats derived from the roster payload (no fabricated numbers): the
  // active head-count and the share of athletes with a configured macro target.
  const total = data.length;
  const configured = data.filter((c) => Number(c.tdee_target) > 0).length;
  const compliancePct = total ? Math.round((configured / total) * 100) : 0;

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return data;
    return data.filter((c) => {
      const hay = `${c.name || ''} ${c.uid || ''} ${c.email || ''} ${division(c)}`.toLowerCase();
      return hay.includes(q);
    });
  }, [data, filter]);

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
            <button type="button" className="ff-refresh" onClick={fetchRoster} disabled={isLoading}>
              ↻ Refresh
            </button>
          </div>

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
    </div>
  );
}

// ── One roster row — clickable, active glass border, division + compliance dot. ─
function ClientRow({ client, active, onSelect }) {
  const name = client.name || client.uid || 'Unnamed';
  const div = division(client);
  const tier = client.subscription_tier || client.role || null;
  const color = tierColor(client.subscription_tier);
  const cal = calBadge(client);
  return (
    <li>
      <button
        type="button"
        className={`ff-row${active ? ' is-active' : ''}`}
        onClick={onSelect}
        aria-pressed={active}
        aria-label={`Open dossier for ${name}`}
      >
        <span className="ff-avatar" style={{ borderColor: color }}>{initials(name)}</span>
        <span className="ff-row-main">
          <span className="ff-row-name">{name}</span>
          <span className="ff-row-sub">{div}</span>
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
