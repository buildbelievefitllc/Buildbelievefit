// src/components/command/DevToolsPanel.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Admin-only Dev Tools — a discrete floating action widget for zero-friction
// testing (no terminal). Renders ONLY for an admin session; mounted by the
// Command Center (itself AdminGuard-gated, so this is defence-in-depth).
//
// Current tool: "Simulate CNS Breach (Health Connect)" — fires a compromised
// wearable reading (HRV < 35 ms, sleep < 240 m) at a target athlete through the
// admin-session-gated RPC bbf_admin_simulate_wearable, which runs the SAME ingest
// the live bbf-wearable-ingest webhook path runs. The webhook Vault secret stays
// server-side — authorization is the admin's own session, never a bundled key.

import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { simulateCnsBreach, buildCnsBreachReading } from '../../lib/devToolsApi.js';
import { WEARABLE_UPDATED_EVENT } from '../../lib/wearableApi.js';

const ERR = {
  not_authorized: 'Not authorized — an admin session is required.',
  unknown_user: 'No athlete found for that uid.',
  no_session: 'No admin session — sign in again.',
  no_target: 'Enter a target athlete uid.',
  invalid_strain: 'Rejected — invalid strain in payload.',
  missing_reading_date: 'Rejected — missing reading date.',
};
const errText = (e) => ERR[e] || e || 'Simulation failed.';
const shortId = (v) => String(v ?? '').replace(/"/g, '').slice(0, 8);

export default function DevToolsPanel() {
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [uid, setUid] = useState('marcus_bbf');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  if (!isAdmin) return null; // hard gate — never renders for a non-admin

  const preview = buildCnsBreachReading();

  async function fireBreach() {
    if (busy) return;
    setBusy(true);
    setResult(null);
    // Capture the exact payload sent so the panel reflects the server-confirmed write.
    const reading = buildCnsBreachReading();
    const res = await simulateCnsBreach(uid, { reading });
    setBusy(false);
    setResult(res.ok ? { ...res, reading } : res);
    if (res.ok) {
      // LIVE state invalidation — NO reload. Signal the open dossier to refetch the
      // athlete's wearable readiness; it re-pulls the real data and bleeds red.
      window.dispatchEvent(new CustomEvent(WEARABLE_UPDATED_EVENT, { detail: { uid: String(uid).trim().toLowerCase() } }));
    }
  }

  return (
    <div style={s.wrap}>
      {open ? (
        <section style={s.panel} role="dialog" aria-label="Admin Dev Tools">
          <header style={s.head}>
            <span style={s.kicker}>⚙ Dev Tools · Admin</span>
            <button type="button" style={s.x} onClick={() => setOpen(false)} aria-label="Close dev tools">✕</button>
          </header>

          <div style={s.body}>
            <span style={s.simKicker}>Simulation · Health Connect</span>

            <label style={s.fieldL} htmlFor="dt-uid">Target athlete (uid)</label>
            <input
              id="dt-uid"
              style={s.input}
              value={uid}
              spellCheck={false}
              autoComplete="off"
              placeholder="marcus_bbf"
              onChange={(e) => setUid(e.target.value.trim())}
            />

            <div style={s.payload}>
              Payload — HRV <b style={s.bad}>{preview.hrv_ms}ms</b> (&lt;35) · Sleep <b style={s.bad}>{preview.sleep_minutes}m</b> (&lt;240) · Strain {preview.strain} · Recovery {preview.readiness_score}
            </div>

            <button
              type="button"
              style={{ ...s.fire, ...(busy ? s.fireBusy : null) }}
              onClick={fireBreach}
              disabled={busy}
            >
              {busy ? 'Transmitting…' : '⚡ Simulate CNS Breach (Health Connect)'}
            </button>

            {result ? (
              result.ok ? (
                <div style={s.ok} role="status">
                  <span>✓ Ingested for <b>{result.uid || uid}</b> · reading <code style={s.code}>{shortId(result.reading_id)}</code></span>
                  <span style={s.okLine}>
                    HRV <b style={s.bad}>{result.reading?.hrv_ms}ms</b> · Sleep <b style={s.bad}>{result.reading?.sleep_minutes}m</b> · Recovery {result.reading?.readiness_score} · ACWR <b>{result.acwr?.flag || '—'}</b>
                  </span>
                  <span style={s.reload}>↻ Live — the open dossier just re-pulled this.</span>
                </div>
              ) : (
                <div style={s.err} role="alert">✕ {errText(result.error)}</div>
              )
            ) : null}

            <div style={s.secNote}>🔒 Secret stays server-side — authorized by your admin session, not a bundled key.</div>
          </div>
        </section>
      ) : (
        <button type="button" style={s.fab} onClick={() => setOpen(true)} aria-label="Open admin dev tools" title="Dev Tools (admin)">
          ⚙
        </button>
      )}
    </div>
  );
}

const s = {
  wrap: { position: 'fixed', right: '1.1rem', bottom: '1.1rem', zIndex: 9999 },
  fab: {
    width: 52, height: 52, borderRadius: '50%', cursor: 'pointer',
    background: 'linear-gradient(135deg, var(--purl), #4a0a78)', border: '2px solid var(--gold-soft, #f5c800)',
    color: 'var(--gold-soft, #f5c800)', fontSize: '1.3rem', lineHeight: 1,
    boxShadow: '0 10px 28px -8px rgba(0,0,0,.7), 0 0 16px rgba(106,13,173,.5)',
  },
  panel: {
    width: 320, maxWidth: 'calc(100vw - 2rem)', background: '#0d0716',
    border: '1px solid rgba(245,200,0,.4)', borderRadius: 14, overflow: 'hidden',
    boxShadow: '0 20px 50px -12px rgba(0,0,0,.8)',
  },
  head: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '.6rem .8rem', background: 'rgba(106,13,173,.25)', borderBottom: '1px solid rgba(245,200,0,.25)',
  },
  kicker: { fontFamily: 'var(--hb)', fontSize: '.7rem', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--gold-soft, #f5c800)' },
  x: { cursor: 'pointer', background: 'none', border: 'none', color: 'var(--mut)', fontSize: '.95rem', lineHeight: 1 },
  body: { padding: '.85rem .9rem', display: 'flex', flexDirection: 'column', gap: '.5rem' },
  simKicker: { fontFamily: 'var(--hb)', fontSize: '.58rem', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--gold-deep, #d4af37)' },
  fieldL: { fontFamily: 'var(--hb)', fontSize: '.56rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--mut)' },
  input: {
    width: '100%', boxSizing: 'border-box', background: '#050505', border: '1px solid var(--line)',
    borderRadius: 8, color: 'var(--wht)', fontFamily: 'var(--bd)', fontSize: '.95rem', fontWeight: 700,
    padding: '.5rem .6rem', outline: 'none',
  },
  payload: { fontFamily: 'var(--bd)', fontSize: '.76rem', fontWeight: 600, color: 'var(--mut)', lineHeight: 1.45 },
  bad: { color: 'var(--red, #ef4444)' },
  fire: {
    width: '100%', cursor: 'pointer', marginTop: '.2rem',
    fontFamily: 'var(--hb)', fontSize: '.74rem', letterSpacing: '1.5px', textTransform: 'uppercase',
    color: '#090909', background: 'var(--yel)', border: '1px solid var(--yel)', borderRadius: 9,
    padding: '.7rem .6rem', lineHeight: 1.2,
  },
  fireBusy: { opacity: 0.6, cursor: 'progress' },
  ok: { display: 'flex', flexDirection: 'column', gap: '.25rem', fontFamily: 'var(--bd)', fontSize: '.8rem', fontWeight: 600, color: 'var(--grn)', border: '1px solid rgba(34,197,94,.4)', background: 'rgba(34,197,94,.08)', borderRadius: 8, padding: '.5rem .6rem' },
  okLine: { color: 'var(--wht)', fontWeight: 700 },
  reload: { fontFamily: 'var(--bd)', fontSize: '.74rem', fontWeight: 700, fontStyle: 'italic', color: 'var(--gold-soft, #f5c800)' },
  err: { fontFamily: 'var(--bd)', fontSize: '.82rem', fontWeight: 600, color: 'var(--red, #ef4444)', border: '1px solid var(--red, #ef4444)', borderRadius: 8, padding: '.5rem .6rem' },
  code: { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '.78rem', color: 'var(--gold-soft, #f5c800)' },
  secNote: { fontFamily: 'var(--bd)', fontSize: '.68rem', fontWeight: 600, fontStyle: 'italic', color: 'var(--mut)', lineHeight: 1.4 },
};
