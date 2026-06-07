// src/components/vault/ComlinkFAB.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Sovereign Comlink — a granularly-gated floating action button (feature:
// sovereign_comlink → God Tier only). The athlete radios in a mid-session
// constraint ("my lower back is fried" / "only 20 minutes") and the Comlink
// returns a coaching verdict (bbf-agentic-comlink).
//
// The TierGate wrapper is the Phase-2 deliverable: only God-Tier (Sovereign /
// Hybrid / admin / trial) athletes see the FAB; everyone else never renders it.
//
// NOTE: bbf-agentic-comlink is not yet server-tier-gated (Phase-3 follow-up); the
// FAB sends the vault_token so the gate can bind to it when that lands.

import { useState } from 'react';
import TierGate from '../TierGate.jsx';
import { FUNCTIONS_BASE, SUPABASE_ANON_KEY } from '../../lib/supabaseClient.js';
import { useAuth, getStoredVaultToken } from '../../context/AuthContext.jsx';

const S = {
  fab: {
    position: 'fixed', right: '20px', bottom: '20px', width: '56px', height: '56px',
    borderRadius: '50%', background: '#f5c800', color: '#090909', border: 'none',
    fontSize: '1.4rem', cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,0,0,.35)', zIndex: 60,
  },
  panel: {
    position: 'fixed', right: '20px', bottom: '88px', width: '330px', maxWidth: '90vw',
    background: '#141414', color: '#fff', border: '1px solid #6a0dad', borderRadius: '12px',
    padding: '14px', zIndex: 60, boxShadow: '0 8px 28px rgba(0,0,0,.5)',
  },
  head: { fontWeight: 700, color: '#f5c800', marginBottom: '8px', letterSpacing: '.5px' },
  input: {
    width: '100%', minHeight: '70px', background: '#0c0c0c', color: '#fff',
    border: '1px solid #333', borderRadius: '8px', padding: '8px', font: 'inherit', resize: 'vertical',
  },
  actions: { display: 'flex', gap: '8px', marginTop: '8px' },
  send: { background: '#6a0dad', color: '#fff', border: 'none', borderRadius: '8px', padding: '.4rem .8rem', cursor: 'pointer', fontWeight: 600 },
  close: { background: 'transparent', color: '#aaa', border: '1px solid #333', borderRadius: '8px', padding: '.4rem .8rem', cursor: 'pointer' },
  verdict: { marginTop: '10px', fontSize: '.9rem', lineHeight: 1.4, color: '#ddd', borderTop: '1px solid #222', paddingTop: '8px' },
};

function ComlinkFABInner() {
  const { user } = useAuth();
  const uid = user?.username || user?.id || '';
  const [open, setOpen] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [verdict, setVerdict] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    const t = transcript.trim();
    if (!t || busy) return;
    setBusy(true); setVerdict('');
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (SUPABASE_ANON_KEY) {
        headers.apikey = SUPABASE_ANON_KEY;
        headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
      }
      const res = await fetch(`${FUNCTIONS_BASE}/bbf-agentic-comlink`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          uid,
          transcript: t.slice(0, 800),
          current_workout: [],
          vault_token: getStoredVaultToken(),
        }),
      });
      const data = await res.json().catch(() => null);
      setVerdict((data && data.comlink_verdict) || 'Comlink could not process that — try again.');
    } catch {
      setVerdict('Comlink is offline right now. Try again shortly.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        style={S.fab}
        onClick={() => setOpen((v) => !v)}
        data-testid="vault-comlink-fab"
        aria-label="Sovereign Comlink"
        title="Sovereign Comlink"
      >
        <span aria-hidden="true">📡</span>
      </button>
      {open ? (
        <div style={S.panel} role="dialog" aria-label="Sovereign Comlink">
          <div style={S.head}>Sovereign Comlink</div>
          <textarea
            style={S.input}
            value={transcript}
            maxLength={800}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder='Radio in a constraint — e.g. "my lower back is fried" or "only 20 minutes".'
            data-testid="vault-comlink-input"
          />
          <div style={S.actions}>
            <button type="button" style={S.send} onClick={send} disabled={busy}>
              {busy ? 'Transmitting…' : 'Transmit'}
            </button>
            <button type="button" style={S.close} onClick={() => setOpen(false)}>Close</button>
          </div>
          {verdict ? <div style={S.verdict}>{verdict}</div> : null}
        </div>
      ) : null}
    </>
  );
}

export default function ComlinkFAB() {
  // Gated to sovereign_comlink (God Tier). Hidden entirely for every other tier.
  return (
    <TierGate feature="sovereign_comlink" render="hide">
      <ComlinkFABInner />
    </TierGate>
  );
}
