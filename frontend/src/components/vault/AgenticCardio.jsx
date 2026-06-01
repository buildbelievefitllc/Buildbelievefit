// src/components/vault/AgenticCardio.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 22.x — Agentic Cardio GPS. The PROACTIVE protocol generator (not a timer):
// the athlete enters a time budget, the bbf-agentic-cardio engine routes a modality
// tier, evaluates CNS fatigue, optionally down-regulates the tier to protect the
// CNS, and returns a minute-by-minute protocol + physiological ROI ("Sovereign
// Toast").
//
// Renders three things the mission calls for:
//   1. The minute-by-minute grid (protocol_steps).
//   2. A CNS-awareness banner when cns_downregulation.down_regulated is true —
//      visibly showing the tier was softened (base → effective) to spare the CNS.
//   3. The Sovereign Toast (roi.toast + roi.primary_metric), elegantly surfaced.
//
// Brand: the legacy Smart Cardio brutalist red/orange, scoped via .bbf-cardio /
// .bbf-gps classes. Isolated — touches only agenticCardioApi.

import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { generateCardio } from '../../lib/agenticCardioApi.js';

const QUICK = [12, 18, 25, 40]; // common time budgets — one tap to route a tier

// Phase → accent + glyph for the minute grid (matches the warmup/work/recovery/
// steady/cooldown enum from the contract).
const PHASE = {
  warmup: { accent: '#F5CF60', glyph: '◐', label: 'Warm-Up' },
  work: { accent: '#FF4500', glyph: '▲', label: 'Work' },
  recovery: { accent: '#22c55e', glyph: '◡', label: 'Recovery' },
  steady: { accent: '#9D27C9', glyph: '■', label: 'Steady' },
  cooldown: { accent: '#8b1abf', glyph: '◑', label: 'Cool-Down' },
};
function phaseMeta(p) { return PHASE[p] || { accent: '#FF4500', glyph: '•', label: p }; }
function pad(n) { return String(n).padStart(2, '0'); }

export default function AgenticCardio() {
  const { user } = useAuth();
  const uid = user?.username || user?.id || '';

  const [minutes, setMinutes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [plan, setPlan] = useState(null);

  async function generate(mins) {
    if (busy) return;
    const m = Math.round(Number(mins) || 0);
    if (!m || m <= 0) { setError('Enter how many minutes you have.'); return; }
    setBusy(true);
    setError(null);
    try {
      const result = await generateCardio(uid, m);
      setPlan(result);
    } catch (e) {
      setError(e?.message || 'Could not generate a protocol.');
      setPlan(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bbf-gps">
      <div className="bbf-gps__head">
        <span className="bbf-cardio__kicker">Proactive GPS</span>
        <h3 className="bbf-cardio__title" style={{ fontSize: '1.3rem' }}>Generate Today’s Protocol</h3>
        <p className="bbf-gps__sub">
          Tell the engine your time budget. It routes the right modality, checks your CNS load, and writes the
          minute-by-minute plan — softening intensity automatically when your nervous system needs it.
        </p>
      </div>

      {/* Time-budget input */}
      <form className="bbf-gps__form" onSubmit={(e) => { e.preventDefault(); generate(minutes); }}>
        <div className="bbf-gps__quick">
          {QUICK.map((q) => (
            <button key={q} type="button" className="bbf-gps__chip" disabled={busy}
              onClick={() => { setMinutes(String(q)); generate(q); }}>{q} min</button>
          ))}
        </div>
        <div className="bbf-gps__inputrow">
          <input className="bbf-input" type="number" inputMode="numeric" min="1" max="120"
            placeholder="minutes you have" value={minutes} disabled={busy}
            onChange={(e) => setMinutes(e.target.value)} aria-label="Available minutes" />
          <button type="submit" className="bbf-cardio__btn" disabled={busy}>
            {busy ? 'Routing…' : 'Route My Cardio →'}
          </button>
        </div>
      </form>

      {error ? <div className="bbf-cardio__error" role="alert" style={{ marginTop: '.9rem' }}>{error}</div> : null}

      {plan ? <ProtocolResult plan={plan} /> : null}
    </section>
  );
}

function ProtocolResult({ plan }) {
  const cns = plan.cns_downregulation || {};
  const modality = plan.modality || {};
  const roi = plan.roi || {};
  const steps = Array.isArray(plan.protocol_steps) ? plan.protocol_steps : [];

  return (
    <div className="bbf-gps__result">
      {/* Modality header */}
      <div className="bbf-gps__modality">
        <span className="bbf-gps__modality-label">{modality.label || modality.tier}</span>
        <span className="bbf-gps__modality-mins">{plan.available_minutes} min</span>
      </div>
      {modality.strategy ? <div className="bbf-gps__strategy">{modality.strategy}</div> : null}

      {/* CNS down-regulation banner — only when the system softened the tier */}
      {cns.down_regulated ? (
        <div className="bbf-gps__cns" role="status">
          <div className="bbf-gps__cns-top">
            <span className="bbf-gps__cns-icon" aria-hidden="true">🛡</span>
            <span className="bbf-gps__cns-title">CNS Protection Engaged</span>
            {Number.isFinite(Number(cns.score)) ? (
              <span className="bbf-gps__cns-score">fatigue {cns.score}/100</span>
            ) : null}
          </div>
          <div className="bbf-gps__cns-body">
            Your nervous system is taxed{cns.fatigue_level ? ` (${cns.fatigue_level})` : ''} — the engine
            softened your session from <b>{cns.base_tier}</b> to <b>{cns.effective_tier}</b> to protect tomorrow’s output.
          </div>
        </div>
      ) : null}

      {/* Minute-by-minute grid */}
      <div className="bbf-gps__grid-h">Minute-by-Minute</div>
      <div className="bbf-gps__grid" role="list">
        {steps.map((s, i) => {
          const pm = phaseMeta(s.phase);
          const dur = Math.max(0, (Number(s.end_min) || 0) - (Number(s.start_min) || 0));
          return (
            <div key={i} className="bbf-gps__step" role="listitem" style={{ '--phase-accent': pm.accent }}>
              <div className="bbf-gps__step-time">
                <span className="bbf-gps__step-range">{pad(s.start_min)}–{pad(s.end_min)}</span>
                <span className="bbf-gps__step-dur">{dur} min</span>
              </div>
              <div className="bbf-gps__step-main">
                <span className="bbf-gps__step-phase">{pm.glyph} {pm.label}</span>
                <span className="bbf-gps__step-label">{s.label}</span>
                {s.target ? <span className="bbf-gps__step-target">{s.target}</span> : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* The Sovereign Toast — physiological ROI */}
      {roi.toast ? (
        <div className="bbf-gps__toast">
          <div className="bbf-gps__toast-glow" aria-hidden="true" />
          <div className="bbf-gps__toast-body">
            <div className="bbf-gps__toast-kicker">The Sovereign Toast</div>
            <div className="bbf-gps__toast-headline">{roi.toast}</div>
            {roi.detail ? <div className="bbf-gps__toast-detail">{roi.detail}</div> : null}
            {roi.primary_metric ? (
              <div className="bbf-gps__toast-metric">
                <span className="bbf-gps__toast-metric-lbl">Primary ROI</span>
                <span className="bbf-gps__toast-metric-val">{roi.primary_metric}</span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {plan.meta?.source === 'fallback' ? (
        <div className="bbf-gps__fallback">Generated from the deterministic engine (AI writer offline) — targets are sound.</div>
      ) : null}
    </div>
  );
}
