// src/components/vault/BiokineticForecast.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Biokinetic Forecast — AUDIO-FIRST, scannable diagnostic dashboard (CEO pivot:
// the markdown "wall of text" is abandoned). Three blocks, zero paragraphs:
//   1. Sovereign Audio Briefing — a prominent PLAY AUDIO BRIEFING transport that
//      streams an mp3 the backend renders via OpenAI TTS (tts-1 · onyx).
//   2. Diagnostic Readout — the AI's verdict as scannable chips + metric gauges
//      (Projected 1RM, Confidence, A:C load ratio, Avg RPE, OT/anabolic signal).
//   3. Progression Curve — a custom SVG plot of Weight & Intensity over 6 weeks,
//      drawn in the Vault gold/purple tokens.
//
// Data: bbf-agentic-forecasting (1RM projection + Gabbett A:C overtraining signal)
// via forecastApi. The per-lift body is key-remounted so loading + the audio
// transport reset cleanly on lift switch (no setState-in-effect). Self-gates
// gracefully (loading / no-data / error) so the surface stages cleanly even before
// the briefing TTS edge function is deployed.

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLang } from '../../context/LangContext.jsx';
import { useForecast, fetchBriefingAudio } from '../../lib/forecastApi.js';
import './biokinetic.css';

const FORECAST_STR = {
  en: {
    title: 'Biokinetic Forecast', kicker: 'Sovereign Diagnostic',
    sub: 'Your 30-day strength trajectory and overtraining radar — scan it, then hear the briefing.',
    lift: 'Target Lift',
    briefingKicker: 'Sovereign Audio Briefing',
    play: 'Play Audio Briefing', preparing: 'Preparing Briefing…', pause: 'Pause Briefing', replay: 'Replay Briefing',
    briefingUnavailable: 'Audio briefing unavailable right now — diagnostics below are live.',
    diagnostics: 'Diagnostic Readout',
    projected1rm: 'Projected 1RM', confidence: 'Confidence', acLoad: 'A:C Load', avgRpe: 'Avg RPE',
    otDetected: 'Hypertrophic Arrest', otSignal: 'Overtraining Signal', anabolic: 'Anabolic Window Open',
    directive: 'Coach Directive',
    curveTitle: 'Progression Curve · 6 Weeks', wWeight: 'Weight', wIntensity: 'Intensity',
    running: 'Running diagnostics…', noData: 'Log a few sessions for this lift to generate a forecast.',
    confHigh: 'High', confMod: 'Moderate', confLow: 'Low',
  },
  es: {
    title: 'Pronóstico Biocinético', kicker: 'Diagnóstico Soberano',
    sub: 'Tu trayectoria de fuerza a 30 días y el radar de sobreentrenamiento — escanéalo y escucha el informe.',
    lift: 'Levantamiento Objetivo',
    briefingKicker: 'Informe de Audio Soberano',
    play: 'Reproducir Informe', preparing: 'Preparando Informe…', pause: 'Pausar Informe', replay: 'Repetir Informe',
    briefingUnavailable: 'Informe de audio no disponible ahora — el diagnóstico de abajo está activo.',
    diagnostics: 'Lectura Diagnóstica',
    projected1rm: '1RM Proyectado', confidence: 'Confianza', acLoad: 'Carga A:C', avgRpe: 'RPE Medio',
    otDetected: 'Arresto Hipertrófico', otSignal: 'Señal de Sobreentrenamiento', anabolic: 'Ventana Anabólica Abierta',
    directive: 'Directiva del Coach',
    curveTitle: 'Curva de Progresión · 6 Semanas', wWeight: 'Peso', wIntensity: 'Intensidad',
    running: 'Ejecutando diagnóstico…', noData: 'Registra algunas sesiones de este levantamiento para generar el pronóstico.',
    confHigh: 'Alta', confMod: 'Moderada', confLow: 'Baja',
  },
  pt: {
    title: 'Previsão Biocinética', kicker: 'Diagnóstico Soberano',
    sub: 'Sua trajetória de força em 30 dias e o radar de overtraining — escaneie e ouça o briefing.',
    lift: 'Levantamento Alvo',
    briefingKicker: 'Briefing de Áudio Soberano',
    play: 'Reproduzir Briefing', preparing: 'Preparando Briefing…', pause: 'Pausar Briefing', replay: 'Repetir Briefing',
    briefingUnavailable: 'Briefing de áudio indisponível agora — o diagnóstico abaixo está ativo.',
    diagnostics: 'Leitura Diagnóstica',
    projected1rm: '1RM Projetado', confidence: 'Confiança', acLoad: 'Carga A:C', avgRpe: 'RPE Médio',
    otDetected: 'Parada Hipertrófica', otSignal: 'Sinal de Overtraining', anabolic: 'Janela Anabólica Aberta',
    directive: 'Diretiva do Treinador',
    curveTitle: 'Curva de Progressão · 6 Semanas', wWeight: 'Carga', wIntensity: 'Intensidade',
    running: 'Executando diagnóstico…', noData: 'Registre algumas sessões deste levantamento para gerar a previsão.',
    confHigh: 'Alta', confMod: 'Moderada', confLow: 'Baixa',
  },
};

// The forecast runs on the athlete's primary compound lift. No in-UI lift picker
// (the CEO removed the rogue Squat/Bench/Deadlift buttons) — one default lift.
const DEFAULT_LIFT = 'Back Squat';

// ── Scannable building blocks ────────────────────────────────────────────────
function Chip({ tone = 'purple', children, sub }) {
  return (
    <span className={`bf-chip bf-chip--${tone}`} data-testid="forecast-chip">
      <span className="bf-chip-dot" aria-hidden="true" />
      <span className="bf-chip-body">
        <span className="bf-chip-label">{children}</span>
        {sub ? <span className="bf-chip-sub">{sub}</span> : null}
      </span>
    </span>
  );
}

function Gauge({ label, value, unit, tone = 'gold', fill = null }) {
  return (
    <div className={`bf-gauge bf-gauge--${tone}`} data-testid="forecast-gauge">
      <div className="bf-gauge-val">{value}{unit ? <span className="bf-gauge-unit">{unit}</span> : null}</div>
      <div className="bf-gauge-lbl">{label}</div>
      {fill !== null ? (
        <div className="bf-gauge-track"><div className="bf-gauge-fill" style={{ width: `${Math.max(4, Math.min(100, fill))}%` }} /></div>
      ) : null}
    </div>
  );
}

// Parse a "315 lbs" projection string → number | null.
function parseLbs(s) {
  const m = String(s ?? '').match(/[\d.]+/);
  return m ? Number(m[0]) : null;
}

// Build a deterministic 6-week Weight + Intensity series from the forecast. The
// engine returns a single projected 1RM, not a curve, so we render the trajectory
// from current→projected (weight) and a working-intensity ramp (% of 1RM). When no
// projection exists, a sane demo ramp keeps the chart legible.
function buildSeries(projected1rm) {
  const proj = parseLbs(projected1rm);
  const end = proj && proj > 0 ? proj : 315;
  const start = Math.round((end / 1.08) / 5) * 5; // ~8% projected gain over the window
  const weight = Array.from({ length: 6 }, (_, i) => Math.round((start + ((end - start) * (i / 5)) / 5) * 5));
  // Working intensity ramp 72% → 90% of 1RM across the block.
  const intensity = Array.from({ length: 6 }, (_, i) => Math.round(72 + (18 * i) / 5));
  return { weight, intensity };
}

// Custom SVG plot — two independently-normalized polylines (gold weight, purple
// intensity) over a 6-week x-axis. Pure, responsive (viewBox + 100% width).
function ProgressionChart({ series, tr }) {
  const W = 320, H = 150, padL = 8, padR = 8, padT = 14, padB = 22;
  const n = series.weight.length;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const x = (i) => padL + (innerW * i) / (n - 1);
  const norm = (arr) => {
    const min = Math.min(...arr), max = Math.max(...arr);
    const span = max - min || 1;
    return arr.map((v) => (v - min) / span);
  };
  const yW = norm(series.weight).map((v) => padT + innerH * (1 - v));
  const yI = norm(series.intensity).map((v) => padT + innerH * (1 - v));
  const path = (ys) => ys.map((y, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y.toFixed(1)}`).join(' ');

  return (
    <div className="bf-chart" data-testid="forecast-chart">
      <div className="bf-chart-head">
        <span className="bf-chart-title">{tr.curveTitle}</span>
        <span className="bf-chart-legend">
          <span className="bf-leg bf-leg--w"><span className="bf-leg-swatch" aria-hidden="true" />{tr.wWeight}</span>
          <span className="bf-leg bf-leg--i"><span className="bf-leg-swatch" aria-hidden="true" />{tr.wIntensity}</span>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="bf-chart-svg" role="img" aria-label={tr.curveTitle} preserveAspectRatio="none">
        {[0, 0.5, 1].map((g) => (
          <line key={g} x1={padL} x2={W - padR} y1={padT + innerH * g} y2={padT + innerH * g} className="bf-grid" />
        ))}
        <path d={path(yI)} className="bf-line bf-line--i" fill="none" />
        <path d={path(yW)} className="bf-line bf-line--w" fill="none" />
        {yW.map((y, i) => <circle key={`w${i}`} cx={x(i)} cy={y} r="3" className="bf-dot bf-dot--w" />)}
        {yI.map((y, i) => <circle key={`i${i}`} cx={x(i)} cy={y} r="2.5" className="bf-dot bf-dot--i" />)}
        {series.weight.map((_, i) => (
          <text key={`x${i}`} x={x(i)} y={H - 6} className="bf-axis" textAnchor="middle">W{i + 1}</text>
        ))}
      </svg>
    </div>
  );
}

// ── Per-lift body — key-remounted on lift switch so loading + audio reset clean ──
function ForecastPanel({ uid, lift, lang, tr }) {
  const { data, loading, error } = useForecast(uid, lift, lang);

  // Audio briefing transport.
  const audioRef = useRef(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioBusy, setAudioBusy] = useState(false);
  const [audioErr, setAudioErr] = useState(false);
  const [playing, setPlaying] = useState(false);

  // Revoke the object URL on unmount / url change (lift switch remounts the panel).
  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);

  async function onBriefing() {
    if (audioBusy) return;
    const el = audioRef.current;
    if (audioUrl && el) { // already loaded → toggle transport
      if (playing) el.pause(); else el.play().catch(() => setAudioErr(true));
      return;
    }
    setAudioBusy(true);
    setAudioErr(false);
    try {
      const url = await fetchBriefingAudio({ uid, liftName: lift, forecast: data, locale: lang });
      setAudioUrl(url);
      requestAnimationFrame(() => { audioRef.current?.play().catch(() => setAudioErr(true)); });
    } catch {
      setAudioErr(true);
    } finally {
      setAudioBusy(false);
    }
  }

  const conf = String(data?.confidence_score || '');
  const confTone = conf === 'High' ? 'green' : conf === 'Low' ? 'red' : 'gold';
  const confLabel = conf === 'High' ? tr.confHigh : conf === 'Low' ? tr.confLow : conf === 'Moderate' ? tr.confMod : conf;
  const ot = data?.ot_signal || null;
  const ac = ot && Number.isFinite(Number(ot.ac_ratio)) ? Number(ot.ac_ratio) : null;
  const acTone = ac == null ? 'gold' : ac > 1.5 ? 'red' : ac < 0.8 ? 'gold' : 'green';
  const rpe = ot && Number.isFinite(Number(ot.rpe_recent_avg)) ? Number(ot.rpe_recent_avg) : null;
  // LIVE: the athlete's real 6-week logged progression from the engine. Falls back
  // to the projected ramp only when there's no logged history yet.
  const prog = data?.progression;
  const series = (prog && prog.has_data && Array.isArray(prog.weight) && Array.isArray(prog.intensity))
    ? { weight: prog.weight, intensity: prog.intensity }
    : buildSeries(data?.projected_1rm);

  const briefingLabel = audioBusy ? tr.preparing
    : audioUrl ? (playing ? tr.pause : tr.replay)
    : tr.play;

  return (
    <>
      {/* ── 1 · Sovereign Audio Briefing — the audio-first hero ── */}
      <section className="bf-audio" data-testid="forecast-audio">
        <button
          type="button"
          className={`bf-audio-btn${playing ? ' is-playing' : ''}`}
          onClick={onBriefing}
          disabled={audioBusy}
          data-testid="forecast-play-briefing"
          aria-label={briefingLabel}
        >
          <span className="bf-audio-ic" aria-hidden="true">{audioBusy ? '◌' : playing ? '❚❚' : '▶'}</span>
        </button>
        <div className="bf-audio-meta">
          <span className="bf-audio-kicker">{tr.briefingKicker}</span>
          <span className="bf-audio-label">{briefingLabel}</span>
          <span className={`bf-wave${playing ? ' is-live' : ''}`} aria-hidden="true">
            {Array.from({ length: 9 }).map((_, i) => <span key={i} className="bf-wave-bar" style={{ animationDelay: `${i * 90}ms` }} />)}
          </span>
          {audioErr ? <span className="bf-audio-err" role="status">{tr.briefingUnavailable}</span> : null}
        </div>
        <audio
          ref={audioRef}
          src={audioUrl || undefined}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onError={() => { if (audioUrl) setAudioErr(true); }}
          preload="none"
        />
      </section>

      {/* ── 2 · Diagnostic Readout — chips + gauges, never paragraphs ── */}
      <section className="bf-diag" data-testid="forecast-diagnostics">
        <div className="bf-section-h">{tr.diagnostics}</div>
        {loading ? (
          <div className="bf-state">{tr.running}</div>
        ) : !data || error ? (
          <div className="bf-state">{tr.noData}</div>
        ) : (
          <>
            <div className="bf-gauges">
              <Gauge label={tr.projected1rm} value={data.projected_1rm || '—'} tone="gold" />
              <Gauge
                label={tr.acLoad}
                value={ac == null ? '—' : ac.toFixed(2)}
                tone={acTone}
                fill={ac == null ? null : Math.min(100, (ac / 2) * 100)}
              />
              <Gauge label={tr.avgRpe} value={rpe == null ? '—' : rpe.toFixed(1)} unit="/10" tone="purple" fill={rpe == null ? null : (rpe / 10) * 100} />
            </div>

            <div className="bf-chips">
              {conf ? <Chip tone={confTone}>{tr.confidence}: {confLabel}</Chip> : null}
              {ot ? (
                ot.detected
                  ? <Chip tone="red" sub={tr.otSignal}>{tr.otDetected}</Chip>
                  : <Chip tone="gold">{tr.anabolic}</Chip>
              ) : null}
            </div>

            {data.agent_insight ? (
              <div className="bf-directive" data-testid="forecast-directive">
                <span className="bf-directive-lbl">{tr.directive}</span>
                <span className="bf-directive-txt">{data.agent_insight}</span>
              </div>
            ) : null}
          </>
        )}
      </section>

      {/* ── 3 · Progression Curve — custom SVG (gold weight · purple intensity) ── */}
      <section className="bf-curve">
        <ProgressionChart series={series} tr={tr} />
      </section>
    </>
  );
}

export default function BiokineticForecast() {
  const { user } = useAuth();
  const { lang } = useLang();
  const tr = FORECAST_STR[lang] || FORECAST_STR.en;
  const uid = user?.username || user?.id || '';

  return (
    <div className="bf" data-testid="biokinetic-forecast">
      <div className="bf-head">
        <span className="bf-kicker">{tr.kicker}</span>
        <h2 className="bf-title">{tr.title}</h2>
        <p className="bf-sub">{tr.sub}</p>
      </div>

      {/* Chips + gauges, progression chart, and Play Audio Briefing only — no lift picker. */}
      <ForecastPanel uid={uid} lift={DEFAULT_LIFT} lang={lang} tr={tr} />
    </div>
  );
}
