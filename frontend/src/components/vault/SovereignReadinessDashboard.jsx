// src/components/vault/SovereignReadinessDashboard.jsx
// ─────────────────────────────────────────────────────────────────────────────
// SOVEREIGN READINESS DASHBOARD — the athlete's morning check-in. Elite sports-tech
// "player rating" aesthetic (not a medical form): a massive readiness score with a
// band-keyed glow, a thick touch slider for sleep, four stylized vibe pills, and a
// frosted-glass trilingual alert beneath the readout.
//
// Wires sleep + vibe → bbf-readiness-calculator → { readinessScore, volMultiplier,
// alerts }, animates the result, and writes the volMultiplier into the global
// ReadinessContext so FloorLogger / SmartCardio scale the day's targets.

import { useEffect, useState } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import { useReadiness, bandForScore } from '../../context/ReadinessContext.jsx';
import { postReadiness } from '../../lib/readinessApi.js';
import './sovereignReadiness.css';

// Trilingual chrome (component-local; trilingual is structural).
const L10N = {
  en: {
    kicker: 'Daily CNS Scan · Sovereign Readiness',
    titleA: 'Morning', titleB: 'Readiness',
    sub: 'Log how you slept and how you feel. The engine scores your nervous system and sets today’s training volume.',
    sleep: 'Sleep', hrs: 'hrs', vibe: 'Vibe Check',
    scan: 'Scan My Readiness →', scanning: 'Scanning CNS…', rescan: 'Re-Scan Readiness →',
    volume: "Today's Training Volume",
    bands: { full: 'Full Volume', reduced: 'Reduced Volume', recovery: 'Prehab / Recovery', idle: 'Awaiting Scan' },
    idleHint: 'Set your sleep + vibe, then scan.',
    pickVibe: 'Pick a vibe to scan.', err: 'Could not read your readiness. Try again.',
  },
  es: {
    kicker: 'Escaneo Diario del SNC · Preparación Soberana',
    titleA: 'Preparación', titleB: 'Matutina',
    sub: 'Registra cómo dormiste y cómo te sientes. El motor evalúa tu sistema nervioso y fija el volumen de hoy.',
    sleep: 'Sueño', hrs: 'h', vibe: 'Cómo Te Sientes',
    scan: 'Escanear Mi Preparación →', scanning: 'Escaneando SNC…', rescan: 'Re-Escanear →',
    volume: 'Volumen de Entrenamiento de Hoy',
    bands: { full: 'Volumen Completo', reduced: 'Volumen Reducido', recovery: 'Prehab / Recuperación', idle: 'Esperando Escaneo' },
    idleHint: 'Ajusta tu sueño + vibra, luego escanea.',
    pickVibe: 'Elige una vibra para escanear.', err: 'No se pudo leer tu preparación. Inténtalo de nuevo.',
  },
  pt: {
    kicker: 'Escaneamento Diário do SNC · Prontidão Soberana',
    titleA: 'Prontidão', titleB: 'Matinal',
    sub: 'Registre como dormiu e como se sente. O motor avalia seu sistema nervoso e define o volume de hoje.',
    sleep: 'Sono', hrs: 'h', vibe: 'Como Você Está',
    scan: 'Escanear Minha Prontidão →', scanning: 'Escaneando SNC…', rescan: 'Re-Escanear →',
    volume: 'Volume de Treino de Hoje',
    bands: { full: 'Volume Total', reduced: 'Volume Reduzido', recovery: 'Prehab / Recuperação', idle: 'Aguardando Escaneamento' },
    idleHint: 'Ajuste seu sono + vibe, depois escaneie.',
    pickVibe: 'Escolha uma vibe para escanear.', err: 'Não foi possível ler sua prontidão. Tente novamente.',
  },
};

// Vibe pills — map 1:1 onto the backend vibe_check enum, each with its own accent.
const VIBES = [
  { id: 'chilling', emoji: '😎', accent: '#6dd13f', en: 'Chilling', es: 'Tranqui', pt: 'De Boa' },
  { id: 'chill_restless', emoji: '🙂', accent: '#a7e635', en: 'Chill / Restless', es: 'Algo Inquieto', pt: 'Meio Inquieto' },
  { id: 'little_irritated', emoji: '😤', accent: '#f5b800', en: 'Little Irritated', es: 'Algo Irritado', pt: 'Meio Irritado' },
  { id: 'exhausted_irritated', emoji: '🥵', accent: '#ff4d4d', en: 'Exhausted / Irritated', es: 'Agotado', pt: 'Exausto' },
];

const LANG_ORDER = ['en', 'es', 'pt'];

// Count-up animation that NEVER setStates synchronously in the effect body (house
// lint rule) — the value is only written inside requestAnimationFrame callbacks.
function useCountUp(target, reduced) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target == null || !Number.isFinite(Number(target))) return undefined;
    const dest = Number(target);
    const dur = reduced ? 1 : 800;
    const start = performance.now();
    let raf = requestAnimationFrame(function tick(now) {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Number((dest * eased).toFixed(1)));
      if (p < 1) raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [target, reduced]);
  return val;
}

export default function SovereignReadinessDashboard({ athleteId = null }) {
  const { lang } = useLang();
  const L = L10N[lang] || L10N.en;
  const ctx = useReadiness();

  const prefersReduced = typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;

  // Seed inputs + result from the day's stored verdict (so a return to the Hub
  // shows this morning's scan instead of a blank dial). Lazy initializers read the
  // context once at mount — no ref-during-render.
  const [sleep, setSleep] = useState(() => ctx.sleepHours ?? 8);
  const [vibe, setVibe] = useState(() => ctx.vibeCheck ?? null);
  const [result, setResult] = useState(() => (ctx.hasCheckedIn
    ? { readinessScore: ctx.readinessScore, volMultiplier: ctx.volMultiplier, alerts: ctx.alerts, band: ctx.band }
    : null));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const band = result ? bandForScore(result.readinessScore) : 'idle';
  const shown = useCountUp(result ? result.readinessScore : null, prefersReduced);

  async function onScan() {
    if (busy) return;
    if (!vibe) { setError(L.pickVibe); return; }
    setBusy(true);
    setError(null);
    try {
      const res = await postReadiness({ sleepHours: Number(sleep), vibeCheck: vibe, athleteId });
      const next = {
        readinessScore: Number(res.readinessScore),
        volMultiplier: Number(res.volMultiplier),
        alerts: res.alerts || null,
        band: bandForScore(res.readinessScore),
      };
      setResult(next);
      // Publish to the global channel so the workout surfaces scale the day's load.
      ctx.setReadiness({
        readinessScore: next.readinessScore,
        volMultiplier: next.volMultiplier,
        alerts: next.alerts,
        vibeCheck: vibe,
        sleepHours: Number(sleep),
      });
    } catch {
      setError(L.err);
    } finally {
      setBusy(false);
    }
  }

  const volPct = result ? Math.round(Number(result.volMultiplier) * 100) : 100;
  const alerts = result?.alerts || null;

  return (
    <section className="srd" data-testid="sovereign-readiness">
      <div className="srd-inner" data-band={band}>
        <div className="srd-head">
          <span className="srd-kicker">{L.kicker}</span>
          <span className="srd-lang" aria-hidden="true">{lang.toUpperCase()}</span>
        </div>
        <h2 className="srd-title">{L.titleA} <span>{L.titleB}</span></h2>
        <p className="srd-sub">{L.sub}</p>

        {/* ── Hero readout ───────────────────────────────────────────────── */}
        <div className="srd-hero">
          <div className="srd-dial">
            <span className={`srd-score is-${band}`} data-testid="srd-score" aria-live="polite">
              {result ? shown.toFixed(1) : '—'}
            </span>
            <span className="srd-score-max">/ 10</span>
          </div>
          <span className={`srd-band is-${band}`}>{L.bands[band]}</span>
          {!result ? <p className="srd-idle-hint">{L.idleHint}</p> : null}

          {result ? (
            <div className="srd-vol" data-testid="srd-volume">
              <div className="srd-vol-top">
                <span className="srd-vol-lbl">{L.volume}</span>
                <span className={`srd-vol-val is-${band}`}>{volPct}%</span>
              </div>
              <div className="srd-vol-track">
                <div className={`srd-vol-fill is-${band}`} style={{ width: `${volPct}%` }} />
              </div>
            </div>
          ) : null}

          {/* Frosted-glass trilingual alert (EN / ES / PT) */}
          {alerts ? (
            <div className="srd-alert" data-testid="srd-alert">
              <div className="srd-alert-main">{alerts[lang] || alerts.en}</div>
              <div className="srd-alert-subs">
                {LANG_ORDER.filter((l) => l !== lang && alerts[l]).map((l) => (
                  <div className="srd-alert-row" key={l}>
                    <span className="srd-alert-tag">{l.toUpperCase()}</span>
                    <span className="srd-alert-sub">{alerts[l]}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* ── Inputs ─────────────────────────────────────────────────────── */}
        <div className="srd-inputs">
          <div>
            <div className="srd-field-lbl">
              <span className="srd-field-k">{L.sleep}</span>
              <span className="srd-field-v">{Number(sleep).toFixed(1)}<small>{L.hrs}</small></span>
            </div>
            <input
              className="srd-range"
              type="range"
              min="0" max="12" step="0.5"
              value={sleep}
              onChange={(e) => setSleep(e.target.value)}
              aria-label={L.sleep}
              data-testid="srd-sleep"
            />
            <div className="srd-range-scale"><span>0h</span><span>8h</span><span>12h</span></div>
          </div>

          <div>
            <div className="srd-field-lbl"><span className="srd-field-k">{L.vibe}</span></div>
            <div className="srd-vibes" role="radiogroup" aria-label={L.vibe}>
              {VIBES.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  role="radio"
                  aria-checked={vibe === v.id}
                  className={`srd-vibe${vibe === v.id ? ' is-active' : ''}`}
                  style={{ '--vibe': v.accent }}
                  onClick={() => setVibe(v.id)}
                  data-testid={`srd-vibe-${v.id}`}
                >
                  <span className="srd-vibe-emoji" aria-hidden="true">{v.emoji}</span>
                  <span className="srd-vibe-lbl">{v[lang] || v.en}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <button type="button" className="srd-cta" onClick={onScan} disabled={busy} data-testid="srd-scan">
          {busy ? L.scanning : (result ? L.rescan : L.scan)}
        </button>
        {error ? <p className="srd-err" role="alert">{error}</p> : null}
      </div>
    </section>
  );
}
