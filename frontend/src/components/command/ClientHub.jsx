// src/components/command/ClientHub.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 5 — Client Hub (live Sovereign Roster).
// Phase 6 — drill-in: clicking a card opens the <ClientDossier/> for that client.
//
// Data path lives in lib/rosterApi.rosterCall (single source of the gateway +
// admin auth, shared with the Dossier so the two can't drift). Roster pull:
//
//   POST {FUNCTIONS_BASE}/bbf-admin-roster  { action:'roster' }
//   200 → { ok:true, count, clients:[{ id, uid, name, email, role,
//           metabolic_tier, subscription_tier, tdee_target, updated_at }] }
//
// In-component routing: `activeClient` (the selected roster row | null) decides
// list-vs-dossier. We hold the WHOLE row, not a bare uid — the detail action keys
// on the `id` PK (not uid), and the row gives the dossier instant header context.
//
// State contract: { data, isLoading, error } — no silent failures, no infinite
// spinners. A failed fetch renders the EXACT server string in var(--red).

import { useCallback, useEffect, useState } from 'react';
import { readToken, writeToken, clearToken, rosterCall, toErrorMessage } from '../../lib/rosterApi.js';
import CommandSurface from './CommandSurface.jsx';
import ClientDossier from './ClientDossier.jsx';

export default function ClientHub() {
  const [token, setToken] = useState(readToken);    // stored token ('' = none)
  const [tokenInput, setTokenInput] = useState('');  // controlled gate input
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeClient, setActiveClient] = useState(null); // selected row | null

  const fetchRoster = useCallback(async () => {
    if (!readToken()) {
      setError('Admin token required — authenticate to load the live roster.');
      return;
    }
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

  // Auto-load on mount when a token is already present. Deferred via microtask so
  // the initial setState lands outside the synchronous effect body (satisfies
  // react-hooks/set-state-in-effect); cancel-guarded against unmount.
  useEffect(() => {
    if (!readToken()) return undefined;
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) fetchRoster(); });
    return () => { cancelled = true; };
  }, [fetchRoster]);

  function handleAuthenticate(e) {
    e.preventDefault();
    const next = tokenInput.trim();
    if (!next) return;
    writeToken(next);
    setToken(next);
    setTokenInput('');
    fetchRoster();
  }

  // Recovery path for a wrong/expired token — clear it so the gate returns.
  function resetToken() {
    clearToken();
    setToken('');
    setError(null);
    setData([]);
    setActiveClient(null);
  }

  const hasToken = !!token;

  // ── Drill-in: a selected client replaces the whole surface with the dossier.
  // Placed AFTER every hook so the rules of hooks hold. Roster state survives
  // underneath, so Back is instant and needs no refetch.
  if (hasToken && activeClient) {
    return <ClientDossier client={activeClient} onBack={() => setActiveClient(null)} />;
  }

  return (
    <CommandSurface
      kicker="Roster · Secure Service-Role"
      title="Client Hub"
      lede="The live Sovereign Roster — every client and athlete, A→Z, via the admin-gated service-role feed."
    >
      {!hasToken ? (
        <TokenGate
          value={tokenInput}
          onChange={setTokenInput}
          onSubmit={handleAuthenticate}
          error={error}
        />
      ) : (
        <>
          <div style={styles.toolbar}>
            <span style={styles.count}>
              {isLoading ? 'Loading…' : `${data.length} client${data.length === 1 ? '' : 's'}`}
            </span>
            <button type="button" style={styles.refresh} onClick={fetchRoster} disabled={isLoading}>
              ↻ Refresh
            </button>
          </div>

          {isLoading ? <Loading /> : null}

          {!isLoading && error ? (
            <ErrorBanner message={error} onRetry={fetchRoster} onResetToken={resetToken} />
          ) : null}

          {!isLoading && !error && data.length === 0 ? (
            <div style={styles.empty}>No clients on the roster yet.</div>
          ) : null}

          {!isLoading && !error && data.length > 0 ? (
            <ul style={styles.list}>
              {data.map((c) => (
                <ClientRow key={c.id ?? c.uid ?? c.email} client={c} onSelect={setActiveClient} />
              ))}
            </ul>
          ) : null}
        </>
      )}
    </CommandSurface>
  );
}

// ── Token gate — the secret is never bundled, only entered at runtime. ─────────
function TokenGate({ value, onChange, onSubmit, error }) {
  return (
    <form style={styles.gate} onSubmit={onSubmit}>
      <label className="bbf-label" htmlFor="bbf-admin-token">Admin Token</label>
      <div style={styles.gateRow}>
        <input
          id="bbf-admin-token"
          className="bbf-input"
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder="Paste BBF Coach Agent Token"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button className="bbf-btn" type="submit" style={styles.gateBtn}>Authenticate</button>
      </div>
      {error ? <div className="bbf-msg bbf-msg--error">{error}</div> : null}
    </form>
  );
}

// ── Loading — explicit, bounded, never an infinite mystery spinner. ────────────
function Loading() {
  return (
    <div style={styles.loading} role="status" aria-live="polite">
      <span style={styles.spinnerDot} />
      Loading roster…
    </div>
  );
}

// ── Error surface — exact failure string, high-contrast red, with recovery. ────
function ErrorBanner({ message, onRetry, onResetToken }) {
  return (
    <div style={styles.errorBox} role="alert">
      <div style={styles.errorTitle}>Roster fetch failed</div>
      <div style={styles.errorMsg}>{message}</div>
      <div style={styles.errorActions}>
        <button type="button" style={styles.retry} onClick={onRetry}>Retry</button>
        {onResetToken ? (
          <button type="button" style={styles.retry} onClick={onResetToken}>Re-enter token</button>
        ) : null}
      </div>
    </div>
  );
}

// ── One client card — clickable, drills into the dossier. ──────────────────────
function ClientRow({ client, onSelect }) {
  const name = client.name || client.uid || 'Unnamed';
  const tier = client.subscription_tier || null;
  const color = tierColor(tier);
  const roleLine = [client.role || 'client', client.metabolic_tier].filter(Boolean).join(' · ');
  return (
    <li>
      <button type="button" style={styles.row} onClick={() => onSelect(client)} aria-label={`Open dossier for ${name}`}>
        <span style={{ ...styles.avatar, borderColor: color }}>{initials(name)}</span>
        <span style={styles.rowMain}>
          <span style={styles.rowName}>{name}</span>
          <span style={styles.rowSub}>{client.email || '—'}</span>
        </span>
        <span style={styles.rowMeta}>
          <span style={styles.rowRole}>{roleLine}</span>
          <span style={styles.rowSub}>{client.tdee_target ? `${client.tdee_target} kcal` : '—'}</span>
        </span>
        <span style={{ ...styles.badge, color, borderColor: color }}>{tier || (client.role || '—')}</span>
        <span style={styles.chevron} aria-hidden="true">›</span>
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

const styles = {
  gate: { maxWidth: 480, marginTop: '.5rem' },
  gateRow: { display: 'flex', gap: '.6rem', alignItems: 'stretch' },
  gateBtn: { width: 'auto', whiteSpace: 'nowrap', padding: '0 1.2rem' },

  toolbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' },
  count: { fontFamily: 'var(--hb)', fontSize: '.78rem', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--mut)' },
  refresh: {
    fontFamily: 'var(--hb)', fontSize: '.72rem', letterSpacing: '2px', textTransform: 'uppercase',
    color: 'var(--gold-soft)', background: 'none', border: '1px solid rgba(245,200,0,.3)',
    borderRadius: 8, padding: '.45rem .8rem', cursor: 'pointer',
  },

  loading: { display: 'flex', alignItems: 'center', gap: '.6rem', padding: '1.5rem .2rem', color: 'var(--mut)', fontFamily: 'var(--bd)', letterSpacing: '.5px' },
  spinnerDot: { width: 10, height: 10, borderRadius: '50%', background: 'var(--yel)', boxShadow: '0 0 12px rgba(245,200,0,.6)' },

  errorBox: { border: '1px solid var(--red)', borderRadius: 12, padding: '1rem 1.2rem', background: 'rgba(239,68,68,.06)' },
  errorTitle: { fontFamily: 'var(--hb)', fontSize: '.8rem', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--red)', marginBottom: '.35rem' },
  errorMsg: { fontFamily: 'var(--bd)', fontSize: '.95rem', color: 'var(--red)', wordBreak: 'break-word' },
  errorActions: { display: 'flex', gap: '.6rem', marginTop: '.8rem' },
  retry: {
    fontFamily: 'var(--hb)', fontSize: '.72rem', letterSpacing: '2px', textTransform: 'uppercase',
    color: 'var(--red)', background: 'none', border: '1px solid var(--red)', borderRadius: 8, padding: '.45rem .9rem', cursor: 'pointer',
  },

  empty: { padding: '1.5rem .2rem', color: 'var(--mut)', fontFamily: 'var(--bd)', letterSpacing: '.5px' },

  list: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '.6rem' },
  row: {
    display: 'flex', alignItems: 'center', gap: '1rem', width: '100%', textAlign: 'left', cursor: 'pointer',
    background: 'var(--gry)', border: '1px solid var(--line)', borderRadius: 14, padding: '.9rem 1.1rem',
  },
  avatar: {
    width: 42, height: 42, flexShrink: 0, borderRadius: '50%', border: '2px solid var(--mut)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'var(--hb)', fontSize: '.9rem', letterSpacing: '1px', color: 'var(--wht)', background: '#050505',
  },
  rowMain: { display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 },
  rowName: { fontFamily: 'var(--hb)', fontSize: '1rem', letterSpacing: '1px', color: 'var(--wht)' },
  rowSub: { fontFamily: 'var(--bd)', fontSize: '.78rem', fontWeight: 700, color: 'var(--mut)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  rowMeta: { display: 'flex', flexDirection: 'column', textAlign: 'right', minWidth: 110 },
  rowRole: { fontFamily: 'var(--bd)', fontSize: '.82rem', fontWeight: 800, color: 'var(--wht)', textTransform: 'capitalize' },
  badge: {
    fontFamily: 'var(--hb)', fontSize: '.66rem', letterSpacing: '1.5px', textTransform: 'uppercase',
    border: '1px solid var(--mut)', borderRadius: 6, padding: '.25rem .55rem', whiteSpace: 'nowrap',
  },
  chevron: { fontFamily: 'var(--bd)', fontSize: '1.5rem', color: 'var(--mut)', lineHeight: 1, flexShrink: 0 },
};
