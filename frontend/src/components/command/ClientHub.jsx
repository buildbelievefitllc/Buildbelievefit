// src/components/command/ClientHub.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 23 — "Founder Five" master-detail roster (the Command Center centerpiece,
// modeled on the Google AI Studio prototype).
//
//   MASTER  → live Sovereign Roster on the side (desktop) / top (mobile). A
//             selected row stays highlighted; the roster never unmounts.
//   DETAIL  → the selected athlete's <ClientDossier/>, a tabbed Program /
//             Nutrition / Analytics interface, beside the roster.
//
// Data path: lib/rosterApi.rosterCall('roster') via the standard anon-key pattern
// (zero-friction — no token gate). Roster pull:
//   POST {FUNCTIONS_BASE}/bbf-admin-roster { action:'roster' }
//   200 → { ok:true, count, clients:[{ id, uid, name, email, role,
//           metabolic_tier, subscription_tier, tdee_target, updated_at }] }
//
// We hold the WHOLE selected row (not a bare uid) — the dossier's detail action
// keys on the `id` PK, and the row gives instant header context.

import { useCallback, useEffect, useState } from 'react';
import { rosterCall, toErrorMessage } from '../../lib/rosterApi.js';
import ClientDossier from './ClientDossier.jsx';
import './founderfive.css';

export default function ClientHub() {
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeId, setActiveId] = useState(null); // selected row id | null

  const fetchRoster = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const body = await rosterCall('roster');
      setData(Array.isArray(body.clients) ? body.clients : []);
    } catch (e) {
      setError(toErrorMessage(e));
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Zero-friction auto-load on mount — no token gate. Deferred via microtask so
  // the initial setState lands outside the synchronous effect body (satisfies
  // react-hooks/set-state-in-effect); cancel-guarded against unmount.
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) fetchRoster(); });
    return () => { cancelled = true; };
  }, [fetchRoster]);

  const rowKey = (c) => c.id ?? c.uid ?? c.email;
  const activeClient = data.find((c) => rowKey(c) === activeId) || null;

  return (
    <div className="ff">
      <header className="ff-head">
        <div className="ff-kicker">Roster · Secure Service-Role</div>
        <h2 className="ff-title">Founder Five</h2>
        <p className="ff-lede">The live Sovereign Roster — select an athlete to open their dossier.</p>
      </header>

      <div className="ff-grid">
        {/* ── MASTER: live roster ── */}
        <aside className="ff-master" aria-label="Athlete roster">
          <div className="ff-toolbar">
            <span className="ff-count">
              {isLoading ? 'Loading…' : `${data.length} athlete${data.length === 1 ? '' : 's'}`}
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

          {!isLoading && !error && data.length === 0 ? (
            <div className="ff-state">No athletes on the roster yet.</div>
          ) : null}

          {!isLoading && !error && data.length > 0 ? (
            <ul className="ff-list">
              {data.map((c) => (
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

        {/* ── DETAIL: tabbed dossier for the selected athlete ── */}
        <section className={`ff-detail${activeClient ? ' is-open' : ''}`} aria-label="Athlete dossier">
          {activeClient ? (
            <ClientDossier client={activeClient} onBack={() => setActiveId(null)} />
          ) : (
            <div className="ff-placeholder">
              <span className="ff-placeholder-mark" aria-hidden="true">◎</span>
              <div className="ff-placeholder-title">No athlete selected</div>
              <div className="ff-placeholder-note">
                Choose an athlete from the roster to open their Program, Nutrition, and Analytics.
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// ── One roster row — clickable, highlights when active. ────────────────────────
function ClientRow({ client, active, onSelect }) {
  const name = client.name || client.uid || 'Unnamed';
  const tier = client.subscription_tier || null;
  const color = tierColor(tier);
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
          <span className="ff-row-sub">{client.email || '—'}</span>
        </span>
        <span className="ff-badge" style={{ color, borderColor: color }}>{tier || (client.role || '—')}</span>
      </button>
    </li>
  );
}

// ── Pure helpers ──────────────────────────────────────────────────────────────
function initials(name) {
  const p = String(name || '').trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '—';
}
function tierColor(tier) {
  const map = {
    platinum: 'var(--yel)',
    essentials: 'var(--grn)',
    sovereign: 'var(--purl)',
  };
  return map[String(tier || '').toLowerCase()] || 'var(--mut)';
}
