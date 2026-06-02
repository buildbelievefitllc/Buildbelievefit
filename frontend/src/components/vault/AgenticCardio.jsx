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

import { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { generateCardio } from '../../lib/agenticCardioApi.js';

// ── Smart Cardio Lobby selectors ──
// Duration drives the ONLY value the frozen engine contract consumes
// (available_minutes). Pacing / Equipment / Kinetic Modality are athlete-preference
// inputs that refine the Dynamic CRP projection (and are forward-looking for when
// the contract expands); the engine still auto-routes the modality tier server-side.
const DURATIONS = [12, 18, 25, 40, 60];
const PACING = [
  { id: 'epoc', label: 'Max EPOC', factor: 1.4 },
  { id: 'burn', label: 'Caloric Burn', factor: 1.1 },
  { id: 'aerobic', label: 'Aerobic Base', factor: 0.9 },
  { id: 'negsplit', label: 'Negative Split', factor: 1.2 },
];
const EQUIPMENT = [
  { id: 'full', label: 'Full Gym' },
  { id: 'home', label: 'Home Gym' },
  { id: 'minimal', label: 'Minimal' },
  { id: 'bodyweight', label: 'Bodyweight' },
];
const MODALITIES = [
  { id: 'treadmill', label: 'Treadmill', factor: 1.0 },
  { id: 'incline', label: 'Incline', factor: 1.2 },
  { id: 'assault', label: 'Assault Bike', factor: 1.4 },
  { id: 'stairs', label: 'Stairs', factor: 1.3 },
];
const byId = (list, id) => list.find((x) => x.id === id) || list[0];

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

  const [minutes, setMinutes] = useState('18');
  const [pacing, setPacing] = useState('epoc');
  const [equipment, setEquipment] = useState('full');
  const [kinetic, setKinetic] = useState('assault');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [plan, setPlan] = useState(null);

  // ── Dynamic CRP (Cardio-Respiratory Prescription) — reactive to the selectors. ──
  const crp = useMemo(() => {
    const mins = Math.max(0, Math.round(Number(minutes) || 0));
    const p = byId(PACING, pacing);
    const m = byId(MODALITIES, kinetic);
    const index = Math.round(mins * p.factor * m.factor);
    const kcal = Math.round(mins * 8.5 * m.factor);
    const epoc = Math.round((6 + mins * 0.35) * p.factor);
    return { mins, p, m, index, kcal, epoc };
  }, [minutes, pacing, kinetic]);

  async function generate() {
    if (busy) return;
    const m = Math.round(Number(minutes) || 0);
    if (!m || m <= 0) { setError('Pick a duration to route your cardio.'); return; }
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

  const durationValue = DURATIONS.includes(Number(minutes)) ? String(Number(minutes)) : 'custom';

  return (
    <section className="bbf-gps">
      <div className="bbf-gps__head">
        <span className="bbf-cardio__kicker">Smart Cardio Lobby</span>
        <h3 className="bbf-cardio__title" style={{ fontSize: '1.3rem' }}>Configure Today’s Protocol</h3>
        <p className="bbf-gps__sub">
          Dial in your duration, pacing, equipment, and kinetic modality. The engine routes the tier, checks your
          CNS load, and writes the minute-by-minute plan — softening intensity automatically when your nervous
          system needs it.
        </p>
      </div>

      {/* ── The Lobby: selectors (left) + Dynamic CRP Formula (right) ── */}
      <form className="bbf-lobby" onSubmit={(e) => { e.preventDefault(); generate(); }}>
        <div className="bbf-lobby__controls">
          <div className="bbf-lobby__grid">
            <Field label="Duration">
              <select className="bbf-input" value={durationValue} disabled={busy}
                onChange={(e) => { if (e.target.value !== 'custom') setMinutes(e.target.value); }}
                aria-label="Duration">
                {DURATIONS.map((d) => <option key={d} value={d}>{d} min</option>)}
                <option value="custom">Custom…</option>
              </select>
            </Field>
            <Field label="Custom Minutes">
              <input className="bbf-input" type="number" inputMode="numeric" min="1" max="120"
                value={minutes} disabled={busy} placeholder="minutes"
                onChange={(e) => setMinutes(e.target.value)}
                aria-label="Available minutes" data-testid="cardio-gen-minutes" />
            </Field>
            <Field label="Pacing Strategy">
              <select className="bbf-input" value={pacing} disabled={busy}
                onChange={(e) => setPacing(e.target.value)} aria-label="Pacing strategy">
                {PACING.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </Field>
            <Field label="Gym Equipment">
              <select className="bbf-input" value={equipment} disabled={busy}
                onChange={(e) => setEquipment(e.target.value)} aria-label="Gym equipment">
                {EQUIPMENT.map((q) => <option key={q.id} value={q.id}>{q.label}</option>)}
              </select>
            </Field>
            <Field label="Active Kinetic Modality">
              <select className="bbf-input" value={kinetic} disabled={busy}
                onChange={(e) => setKinetic(e.target.value)} aria-label="Active kinetic modality">
                {MODALITIES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </Field>
          </div>
          <button type="submit" className="bbf-cardio__btn bbf-lobby__go" disabled={busy}
            data-testid="cardio-gen-submit">
            {busy ? 'Routing…' : 'Route My Cardio →'}
          </button>
        </div>

        <aside className="bbf-crp" aria-label="Dynamic CRP formula">
          <div className="bbf-crp__kicker">Dynamic CRP Formula</div>
          <div className="bbf-crp__title">Cardio-Respiratory Prescription</div>
          <div className="bbf-crp__formula">
            CRP <span className="bbf-crp__op">=</span> Duration
            <span className="bbf-crp__op">×</span> Modality
            <span className="bbf-crp__op">×</span> Pacing
          </div>
          <div className="bbf-crp__vars">
            <div className="bbf-crp__var"><span className="bbf-crp__var-v">{crp.mins}</span><span className="bbf-crp__var-l">min</span></div>
            <div className="bbf-crp__var"><span className="bbf-crp__var-v">×{crp.m.factor.toFixed(1)}</span><span className="bbf-crp__var-l">{crp.m.label}</span></div>
            <div className="bbf-crp__var"><span className="bbf-crp__var-v">×{crp.p.factor.toFixed(1)}</span><span className="bbf-crp__var-l">{crp.p.label}</span></div>
          </div>
          <div className="bbf-crp__score">
            <span className="bbf-crp__score-v">{crp.index}</span>
            <span className="bbf-crp__score-l">CRP Index</span>
          </div>
          <div className="bbf-crp__proj">
            <div className="bbf-crp__proj-cell"><span className="bbf-crp__proj-v">~{crp.kcal}</span><span className="bbf-crp__proj-l">kcal burn</span></div>
            <div className="bbf-crp__proj-cell"><span className="bbf-crp__proj-v">~{crp.epoc}h</span><span className="bbf-crp__proj-l">EPOC window</span></div>
          </div>
        </aside>
      </form>

      {error ? <div className="bbf-cardio__error" role="alert" style={{ marginTop: '.9rem' }}>{error}</div> : null}

      {plan ? <ProtocolResult plan={plan} /> : null}
    </section>
  );
}

function Field({ label, children }) {
  return (
    <label className="bbf-lobby__field">
      <span className="bbf-lobby__label">{label}</span>
      {children}
    </label>
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
