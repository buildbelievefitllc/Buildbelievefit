// src/components/command/ClientHub.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 5 — Client Hub, live-wired to the Sovereign Roster.
//
// Data path — mirrors the legacy monolith EXACTLY (bbf-app.html BBF_DATABASE_HUB
// `loadRoster` → `_post('roster')`):
//
//   POST {FUNCTIONS_BASE}/bbf-admin-roster
//   headers: apikey + Authorization: Bearer <anon>   (gateway routing — REQUIRED
//            even though the function is verify_jwt:false; omit it and the gateway
//            401s before the function runs — the monolith learned this the hard way)
//            X-BBF-Admin-Token: <admin secret>        (the real authorization gate)
//   body:    { action: 'roster' }
//   200 →    { ok:true, count, clients:[{ id, uid, name, email, role,
//              metabolic_tier, subscription_tier, tdee_target, updated_at }] }
//   401 →    { error:'unauthorized' }   (bad/missing admin token)
//   503 →    { error:'backend_unconfigured' }
//   500 →    { error:'server_error', detail }
//
// Why the edge function and not supabase.from('bbf_users'): the roster is a
// service-role (RLS-bypassing) read so the trainer sees EVERY client. That key
// lives ONLY inside the function. The browser authorizes with X-BBF-Admin-Token.
//
// SECURITY (CLAUDE.md §7): the admin token is a shared secret, NEVER bundled (no
// VITE_ var). Supplied at runtime, kept in sessionStorage under the monolith's
// own key (BBF_COACH_AGENT_TOKEN) so the two surfaces share the convention. No
// token → a token gate, not a silent failure.
//
// State contract: { data, isLoading, error } — no silent failures, no infinite
// spinners. A failed fetch renders the EXACT server string in var(--red).

import { useCallback, useEffect, useState } from 'react';
import { FUNCTIONS_BASE, SUPABASE_ANON_KEY } from '../../lib/supabaseClient.js';
import CommandSurface from './CommandSurface.jsx';

// Mirror the monolith's token storage (sessionStorage · BBF_COACH_AGENT_TOKEN).
const TOKEN_KEY = 'BBF_COACH_AGENT_TOKEN';
const readToken = () => {
  try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
};
const writeToken = (t) => { try { sessionStorage.setItem(TOKEN_KEY, t); } catch { /* blocked */ } };
const clearToken = () => { try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* blocked */ } };

// Human-readable line for an HTTP status, so the surfaced error is precise rather
// than a bare code (parity with the monolith's _errMsg).
function statusHint(status) {
  if (status === 401) return 'admin token missing or mismatched';
  if (status === 403) return 'gateway rejected the request (check anon apikey)';
  if (status === 404) return 'not found';
  if (status === 503) return 'backend not configured (missing secret)';
  return 'request failed';
}

export default function ClientHub() {
  const [token, setToken] = useState(readToken);   // stored token ('' = none)
  const [tokenInput, setTokenInput] = useState(''); // controlled gate input
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchRoster = useCallback(async () => {
    const t = readToken();
    if (!t) {
      setError('Admin token required — authenticate to load the live roster.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const headers = { 'Content-Type': 'application/json', 'X-BBF-Admin-Token': t };
      // Gateway routing headers — without these the request never reaches the
      // function (it 401s at the edge). The anon key is safe in the bundle.
      if (SUPABASE_ANON_KEY) {
        headers.apikey = SUPABASE_ANON_KEY;
        headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
      }

      const res = await fetch(`${FUNCTIONS_BASE}/bbf-admin-roster`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'roster' }),
      });

      // Read the body once as text so we can surface the EXACT server string
      // whether the response is ok or an error envelope.
      const raw = await res.text();
      let body = null;
      try { body = raw ? JSON.parse(raw) : null; } catch { /* non-JSON body */ }

      if (!res.ok) {
        const slug = body?.detail || body?.error || raw || 'unknown error';
        throw new Error(`Error ${res.status} — ${statusHint(res.status)} (${slug}).`);
      }
      if (!body?.ok) {
        throw new Error(body?.error || body?.detail || 'Malformed roster response.');
      }

      setData(Array.isArray(body.clients) ? body.clients : []);
    } catch (e) {
      // Network/CORS throws land here too — surface them, never swallow.
      const msg = e?.message || String(e);
      setError(/^Error /.test(msg) ? msg : `Network/CORS error — ${msg}.`);
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
  }

  const hasToken = !!token;

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
                <ClientRow key={c.id ?? c.uid ?? c.email} client={c} />
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

// ── One client card. Maps the fields the roster query actually returns. ────────
function ClientRow({ client }) {
  const name = client.name || client.uid || 'Unnamed';
  const tier = client.subscription_tier || null;
  const color = tierColor(tier);
  const roleLine = [client.role || 'client', client.metabolic_tier].filter(Boolean).join(' · ');
  return (
    <li style={styles.row}>
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
    display: 'flex', alignItems: 'center', gap: '1rem',
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
};
