// src/components/vault/SovereignBriefingCard.jsx
// ─────────────────────────────────────────────────────────────────────────────
// SOVEREIGN AUDIO — the Day-30 graduation briefing tile (Client Vault Hub).
//
// Renders ONLY for a GRADUATED athlete (useCalibration().isGraduated) — the reward
// for completing the 30-Day Biometric Calibration. Tapping Play streams a
// personalized spoken address in Coach Akeem's cloned voice (trilingual) from the
// bbf-sovereign-briefing edge fn, which enforces the voice_coach tier + the Day-30
// graduation (re-derived server-side) + voice metering. A graduated NON-premium
// athlete sees the tile and gets an upgrade nudge on play (intentional upsell).
//
// Layered orthogonally on the calibration brain (useCalibration) + the audio-first
// data layer (forecastApi.fetchSovereignBriefing). Self-contained trilingual chrome.

import { useRef, useState } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import { useCalibration } from '../../lib/useCalibration.js';
import { fetchSovereignBriefing } from '../../lib/forecastApi.js';

const SB_STR = {
  en: {
    kicker: 'Sovereign Audio · Earned',
    title: 'Your Sovereign Briefing',
    sub: 'Calibration complete — the Vault is open. Hear it from Coach Akeem.',
    play: '▶ Play Briefing', loading: 'Composing your briefing…', replay: '↻ Replay',
    upsell: 'Upgrade to unlock your Sovereign Briefing in Akeem’s voice.',
    quota: 'Monthly voice limit reached — resets next month.',
    session: 'Your session expired — sign in again.',
    err: 'Briefing unavailable right now. Try again in a moment.',
  },
  es: {
    kicker: 'Audio Soberano · Ganado',
    title: 'Tu Informe Soberano',
    sub: 'Calibración completa — el Vault está abierto. Escúchalo del Coach Akeem.',
    play: '▶ Reproducir', loading: 'Componiendo tu informe…', replay: '↻ Repetir',
    upsell: 'Mejora tu plan para desbloquear tu Informe Soberano en la voz de Akeem.',
    quota: 'Límite de voz mensual alcanzado — se reinicia el próximo mes.',
    session: 'Tu sesión expiró — inicia sesión de nuevo.',
    err: 'Informe no disponible ahora. Inténtalo de nuevo en un momento.',
  },
  pt: {
    kicker: 'Áudio Soberano · Conquistado',
    title: 'Seu Briefing Soberano',
    sub: 'Calibração completa — o Vault está aberto. Ouça do Coach Akeem.',
    play: '▶ Reproduzir', loading: 'Compondo seu briefing…', replay: '↻ Repetir',
    upsell: 'Faça upgrade para desbloquear seu Briefing Soberano na voz do Akeem.',
    quota: 'Limite mensal de voz atingido — reinicia no próximo mês.',
    session: 'Sua sessão expirou — entre novamente.',
    err: 'Briefing indisponível agora. Tente novamente em instantes.',
  },
};

function mapErr(slug, tr) {
  if (slug === 'tier_not_entitled' || slug === 'not_entitled') return tr.upsell;
  if (slug === 'quota_exhausted') return tr.quota;
  if (slug === 'missing_session' || slug === 'invalid_session' || slug === 'account_locked') return tr.session;
  return tr.err;
}

export default function SovereignBriefingCard() {
  const { lang } = useLang();
  const { isGraduated } = useCalibration();
  const tr = SB_STR[lang] || SB_STR.en;
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState(null);
  const [err, setErr] = useState(null);
  const audioRef = useRef(null);

  // Graduation gate (defense-in-depth — the server re-derives Day-30 too). Only the
  // graduated athlete ever sees the tile; mid-calibration sessions render nothing.
  if (!isGraduated) return null;

  async function play() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const next = await fetchSovereignBriefing({ locale: lang });
      setUrl((old) => { if (old) { try { URL.revokeObjectURL(old); } catch { /* noop */ } } return next; });
      // Autoplay once the <audio> element mounts with the fresh src (next paint).
      queueMicrotask(() => { try { audioRef.current?.play?.(); } catch { /* user can press play */ } });
    } catch (e) {
      setErr(mapErr(e?.message, tr));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="vh-sov-brief" data-testid="sovereign-briefing" style={WRAP}>
      <div style={GLOW} aria-hidden="true" />
      <div style={{ position: 'relative' }}>
        <span style={KICKER}>★ {tr.kicker}</span>
        <h3 style={TITLE}>{tr.title}</h3>
        <p style={SUB}>{tr.sub}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.7rem', flexWrap: 'wrap', marginTop: '.7rem' }}>
          <button type="button" onClick={play} disabled={busy} style={{ ...BTN, opacity: busy ? 0.7 : 1 }} data-testid="sovereign-briefing-play">
            {busy ? tr.loading : (url ? tr.replay : tr.play)}
          </button>
        </div>
        {url ? (
          <audio ref={audioRef} src={url} controls preload="auto" style={{ width: '100%', marginTop: '.7rem' }} data-testid="sovereign-briefing-audio" />
        ) : null}
        {err ? <div role="alert" style={ERR} data-testid="sovereign-briefing-err">{err}</div> : null}
      </div>
    </section>
  );
}

const WRAP = { position: 'relative', overflow: 'hidden', margin: '0 0 1rem', padding: '1rem 1.1rem', borderRadius: 16, border: '1px solid rgba(245,200,0,.45)', background: 'linear-gradient(135deg, rgba(106,13,173,.30), rgba(9,9,9,.55))' };
const GLOW = { position: 'absolute', inset: 0, background: 'radial-gradient(120% 80% at 100% 0%, rgba(245,200,0,.14), transparent 60%)', pointerEvents: 'none' };
const KICKER = { fontFamily: 'var(--hb)', fontSize: '.66rem', letterSpacing: '2px', textTransform: 'uppercase', color: '#f5c800' };
const TITLE = { fontFamily: 'var(--hb)', fontSize: '1.5rem', margin: '.25rem 0 .2rem', color: '#fff', letterSpacing: '.5px', lineHeight: 1.1 };
const SUB = { margin: 0, color: 'rgba(244,238,251,.82)', fontSize: '.9rem', lineHeight: 1.45 };
const BTN = { fontFamily: 'var(--hb)', fontSize: '.82rem', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 700, color: '#0e0a16', background: 'linear-gradient(90deg,#f5c800,#ffd83a)', border: 'none', borderRadius: 999, padding: '.6rem 1.25rem', cursor: 'pointer' };
const ERR = { marginTop: '.6rem', color: '#ffd24d', fontSize: '.8rem' };
