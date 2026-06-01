// src/components/vault/SmartCardio.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 22 — Smart Cardio (Client Vault surface). Restores the legacy Phase 10
// engine with a persistent backend:
//   • Zone legend — HIIT / Tempo / Zone-2 (the legacy time-budget routing).
//   • Active protocols — target duration + intensity + the minute-by-minute
//     prescription, treadmill-readable monospace (legacy .cardio-protocol).
//   • History — previously logged sessions.
//   • Logger — write a completed session (token-gated RPC), then refetch.
//
// ISOLATION: new file; touches only cardioApi + cardio.css. Never imports or
// edits T2's ProgramGrid / programData / programApi.

import { useState } from 'react';
import { useCardio, logCardio, CARDIO_ZONES } from '../../lib/cardioApi.js';
import './cardio.css';

function fmtDate(d) {
  if (!d) return '—';
  const t = Date.parse(d);
  if (Number.isNaN(t)) return String(d);
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
function zoneMeta(z) {
  return CARDIO_ZONES[z] || { label: z, blurb: '', accent: '#FF4500' };
}

export default function SmartCardio() {
  const { data, isLoading, error, refetch } = useCardio();

  return (
    <div className="bbf-cardio">
      <div className="bbf-cardio__head">
        <h2 className="bbf-cardio__title">Smart Cardio</h2>
        <span className="bbf-cardio__kicker">Conditioning Engine</span>
      </div>
      <p className="bbf-cardio__sub">
        The engine routes between HIIT (&lt; 20 min), Tempo (20–35 min), and Zone 2 (&gt; 35 min) —
        each protocol is built for your time budget. Log every session to keep your conditioning honest.
      </p>

      {/* Zone legend */}
      <div className="bbf-cardio__zones">
        {Object.entries(CARDIO_ZONES).map(([id, z]) => (
          <div key={id} className="bbf-cardio__zone" style={{ '--zone-accent': z.accent }}>
            <div className="bbf-cardio__zone-name">{z.label}</div>
            <div className="bbf-cardio__zone-blurb">{z.blurb}</div>
          </div>
        ))}
      </div>

      {isLoading ? <div className="bbf-cardio__loading">Loading your cardio protocols…</div> : null}
      {!isLoading && error ? <div className="bbf-cardio__error" role="alert">{error}</div> : null}

      {!isLoading && !error && data ? (
        <>
          <ActiveProtocols protocols={data.protocols} />
          <LogSession onLogged={refetch} />
          <History logs={data.logs} />
        </>
      ) : null}
    </div>
  );
}

function ActiveProtocols({ protocols }) {
  return (
    <section>
      <h3 className="bbf-cardio__section-h">Active Protocols</h3>
      {protocols.length === 0 ? (
        <div className="bbf-cardio__empty">
          No cardio protocol assigned yet — your coach is dialing in your conditioning. It will appear here once assigned.
        </div>
      ) : (
        <div className="bbf-cardio__protocols">
          {protocols.map((p) => {
            const z = zoneMeta(p.zone);
            return (
              <article key={p.id} className="bbf-cardio__protocol">
                <div className="bbf-cardio__protocol-top">
                  <span className="bbf-cardio__protocol-title">{p.title || z.label}</span>
                  <span className="bbf-cardio__pill" style={{ color: z.accent }}>{z.label}</span>
                </div>
                <div className="bbf-cardio__targets">
                  <div className="bbf-cardio__target">
                    <span className="bbf-cardio__target-val">{p.target_duration_min}<span style={{ fontSize: '.9rem' }}> min</span></span>
                    <span className="bbf-cardio__target-lbl">Target Duration</span>
                  </div>
                  {p.intensity ? (
                    <div className="bbf-cardio__target">
                      <span className="bbf-cardio__target-val" style={{ fontSize: '1.2rem' }}>{p.intensity}</span>
                      <span className="bbf-cardio__target-lbl">Intensity</span>
                    </div>
                  ) : null}
                </div>
                {p.protocol_detail ? <div className="bbf-cardio__detail">{p.protocol_detail}</div> : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function History({ logs }) {
  return (
    <section>
      <h3 className="bbf-cardio__section-h">Session History</h3>
      {logs.length === 0 ? (
        <div className="bbf-cardio__empty">No sessions logged yet. Log your first cardio session below.</div>
      ) : (
        <div className="bbf-cardio__logs">
          {logs.map((l) => {
            const z = zoneMeta(l.zone);
            const meta = [l.intensity, l.avg_hr ? `${l.avg_hr} bpm` : null, l.notes].filter(Boolean).join(' · ');
            return (
              <div key={l.id} className="bbf-cardio__log" style={{ '--zone-accent': z.accent }}>
                <span className="bbf-cardio__log-date">{fmtDate(l.session_date)}</span>
                <span className="bbf-cardio__log-main">
                  <span className="bbf-cardio__log-zone">{z.label}</span>
                  {meta ? <span className="bbf-cardio__log-meta">{meta}</span> : null}
                </span>
                <span className="bbf-cardio__log-dur">{l.duration_min}<span> min</span></span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function LogSession({ onLogged }) {
  const [zone, setZone] = useState('zone2');
  const [duration, setDuration] = useState('');
  const [intensity, setIntensity] = useState('');
  const [avgHr, setAvgHr] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { kind:'ok'|'err', text }

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const dur = parseInt(duration, 10);
    if (!dur || dur <= 0 || dur > 600) {
      setMsg({ kind: 'err', text: 'Enter a duration between 1 and 600 minutes.' });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await logCardio({
        zone,
        duration_min: dur,
        intensity: intensity.trim() || undefined,
        avg_hr: avgHr.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setMsg({ kind: 'ok', text: 'Session logged. Conditioning stays honest. 🔥' });
      setDuration(''); setIntensity(''); setAvgHr(''); setNotes('');
      onLogged?.();
    } catch (err) {
      setMsg({ kind: 'err', text: err?.message || 'Could not log session. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h3 className="bbf-cardio__section-h">Log a Session</h3>
      <form className="bbf-cardio__logger" onSubmit={submit}>
        <div className="bbf-cardio__row">
          <div className="bbf-cardio__field">
            <label htmlFor="bc-zone">Zone</label>
            <select id="bc-zone" className="bbf-input" value={zone} disabled={busy} onChange={(e) => setZone(e.target.value)}>
              {Object.entries(CARDIO_ZONES).map(([id, z]) => <option key={id} value={id}>{z.label}</option>)}
            </select>
          </div>
          <div className="bbf-cardio__field">
            <label htmlFor="bc-dur">Duration (min)</label>
            <input id="bc-dur" className="bbf-input" type="number" inputMode="numeric" min="1" max="600"
              value={duration} disabled={busy} onChange={(e) => setDuration(e.target.value)} placeholder="40" />
          </div>
          <div className="bbf-cardio__field">
            <label htmlFor="bc-int">Intensity</label>
            <input id="bc-int" className="bbf-input" type="text" value={intensity} disabled={busy}
              onChange={(e) => setIntensity(e.target.value)} placeholder="RPE 7 / 65-75% HRmax" />
          </div>
          <div className="bbf-cardio__field">
            <label htmlFor="bc-hr">Avg HR (bpm)</label>
            <input id="bc-hr" className="bbf-input" type="number" inputMode="numeric" min="40" max="230"
              value={avgHr} disabled={busy} onChange={(e) => setAvgHr(e.target.value)} placeholder="142" />
          </div>
        </div>
        <div className="bbf-cardio__field" style={{ marginBottom: '.8rem' }}>
          <label htmlFor="bc-notes">Notes</label>
          <input id="bc-notes" className="bbf-input" type="text" value={notes} disabled={busy}
            onChange={(e) => setNotes(e.target.value)} placeholder="How it felt, splits, terrain…" />
        </div>
        <div className="bbf-cardio__actions">
          <button type="submit" className="bbf-cardio__btn" disabled={busy}>{busy ? 'Logging…' : 'Log Session →'}</button>
          {msg ? <span className={`bbf-cardio__msg bbf-cardio__msg--${msg.kind}`} role="status">{msg.text}</span> : null}
        </div>
      </form>
    </section>
  );
}
