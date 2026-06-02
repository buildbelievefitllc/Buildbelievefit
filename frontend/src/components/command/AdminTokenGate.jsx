// src/components/command/AdminTokenGate.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Sovereign unlock gate for the token-gated coach surfaces (Founder Five roster,
// Comlink, Analytics roster). Shown ONLY when the admin token is not already
// hydrated (window global / sessionStorage). The CEO types the shared admin secret
// once; setAdminToken caches it for the tab session (CLAUDE.md §7: never bundled,
// never localStorage) and EVERY gated surface unlocks at once.
//
// Mirrors the Analytics Admin-PIN gate's look (CommandSurface header + the shared
// bbf-an form classes). The advanced disclosure covers deploys where the Supabase
// coach token and the Render admin token are DIFFERENT secrets; left blank ⇒ the
// Render token reuses the primary value.

import { useState } from 'react';
import CommandSurface from './CommandSurface.jsx';
import { setAdminToken } from '../../lib/adminAuth.js';
import './analytics.css';

export default function AdminTokenGate({ onUnlock, surface = 'the coach surfaces' }) {
  const [primary, setPrimary] = useState('');
  const [renderTok, setRenderTok] = useState('');
  const [advanced, setAdvanced] = useState(false);

  function unlock(e) {
    e.preventDefault();
    const tok = primary.trim();
    if (!tok) return;
    // One value sets both tokens (common single-secret deploy); the advanced field
    // overrides the Render token when the two secrets differ.
    setAdminToken(tok, advanced ? renderTok.trim() || tok : tok);
    setPrimary('');
    setRenderTok('');
    onUnlock?.();
  }

  return (
    <CommandSurface
      kicker="Sovereign Command · Secure"
      title="Admin Authorization"
      lede={`Enter the Sovereign admin token to load ${surface}. These endpoints gate every request on this shared secret server-side — it is held in memory for this session only.`}
    >
      <form className="bbf-an bbf-an__gate" onSubmit={unlock}>
        <label className="bbf-label" htmlFor="cc-token">Admin Token</label>
        <div className="bbf-an__gate-row">
          <input
            id="cc-token"
            className="bbf-input"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="Paste admin token"
            value={primary}
            onChange={(e) => setPrimary(e.target.value)}
          />
          <button
            className="bbf-btn"
            type="submit"
            style={{ width: 'auto', whiteSpace: 'nowrap', padding: '0 1.2rem' }}
          >
            Unlock
          </button>
        </div>

        {advanced ? (
          <div style={{ marginTop: '.9rem' }}>
            <label className="bbf-label" htmlFor="cc-token-render">
              Render Token (Comlink) — optional
            </label>
            <input
              id="cc-token-render"
              className="bbf-input"
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="Leave blank to reuse the token above"
              value={renderTok}
              onChange={(e) => setRenderTok(e.target.value)}
            />
          </div>
        ) : null}

        <button
          type="button"
          className="bbf-an__refresh"
          style={{ marginTop: '.7rem', width: 'auto' }}
          onClick={() => setAdvanced((s) => !s)}
        >
          {advanced ? 'Use one token' : 'Supabase / Render tokens differ?'}
        </button>

        <div className="bbf-an__gate-note">
          Held in memory for this tab session only — never written to disk or shipped in the
          bundle. You won&apos;t be re-prompted while this session is open.
        </div>
      </form>
    </CommandSurface>
  );
}
