// src/components/vault/SovereignBriefingCard.jsx
// ─────────────────────────────────────────────────────────────────────────────
// SOVEREIGN AUDIO — the Day-30 graduation briefing tile (Client Vault Hub).
// FRONT 3.5 · AUTO-DAILY: the morning check-in tripwire pre-computes + caches each
// graduated premium athlete's briefing in the background. This tile READS that
// pre-cached blob on mount (bbf_get_sovereign_briefing RPC) so playback is INSTANT —
// no "Generate" wait. If today's briefing hasn't been pre-generated yet (e.g. no
// check-in today), it gracefully falls back to an on-demand live generation.
//
// Renders ONLY for a GRADUATED athlete (useCalibration().isGraduated); the edge fn
// enforces voice_coach + Day-30 + metering server-side (a non-premium graduate gets
// an upgrade nudge). Self-contained trilingual chrome.

import { useEffect, useRef, useState } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import { useCalibration } from '../../lib/useCalibration.js';
import { fetchSovereignBriefing, fetchCachedSovereignBriefing } from '../../lib/forecastApi.js';
import { manifestUrlById } from '../../lib/sovereignManifest.js';

// Session blob cache (locale|UTC-day → object URL) so re-mounting the Hub doesn't
// re-download today's ~1MB briefing. Session-lived; one URL per locale/day.
const _sovCache = new Map();
function utcDay() { return new Date().toISOString().slice(0, 10); }
// Generation timestamp (UTC ISO) → the athlete's LOCAL clock time, e.g. "2:13 PM".
function fmtTime(iso, lang) {
  if (!iso) return '';
  const loc = lang === 'es' ? 'es' : lang === 'pt' ? 'pt-BR' : 'en-US';
  try { return new Date(iso).toLocaleTimeString(loc, { hour: 'numeric', minute: '2-digit' }); }
  catch { return ''; }
}

const SB_STR = {
  en: {
    kicker: 'Sovereign Audio · Daily',
    title: 'Your Sovereign Briefing',
    sub: 'Composed fresh from this morning’s check-in — in Coach Akeem’s voice.',
    playToday: '▶ Play Today’s Briefing', generate: '▶ Generate Briefing',
    loadingToday: 'Loading today’s briefing…', generating: 'Composing your briefing…', replay: '↻ Replay',
    freshAt: (t) => `Freshly generated today at ${t}`,
    upsell: 'Upgrade to unlock your Sovereign Briefing in Akeem’s voice.',
    quota: 'Monthly voice limit reached — resets next month.',
    session: 'Your session expired — sign in again.',
    err: 'Briefing unavailable right now. Try again in a moment.',
  },
  es: {
    kicker: 'Audio Soberano · Diario',
    title: 'Tu Informe Soberano',
    sub: 'Compuesto al instante desde tu registro de esta mañana — en la voz del Coach Akeem.',
    playToday: '▶ Reproducir el de Hoy', generate: '▶ Generar Informe',
    loadingToday: 'Cargando el informe de hoy…', generating: 'Componiendo tu informe…', replay: '↻ Repetir',
    freshAt: (t) => `Generado hoy a las ${t}`,
    upsell: 'Mejora tu plan para desbloquear tu Informe Soberano en la voz de Akeem.',
    quota: 'Límite de voz mensual alcanzado — se reinicia el próximo mes.',
    session: 'Tu sesión expiró — inicia sesión de nuevo.',
    err: 'Informe no disponible ahora. Inténtalo de nuevo en un momento.',
  },
  pt: {
    kicker: 'Áudio Soberano · Diário',
    title: 'Seu Briefing Soberano',
    sub: 'Composto na hora a partir do seu check-in desta manhã — na voz do Coach Akeem.',
    playToday: '▶ Tocar o de Hoje', generate: '▶ Gerar Briefing',
    loadingToday: 'Carregando o briefing de hoje…', generating: 'Compondo seu briefing…', replay: '↻ Repetir',
    freshAt: (t) => `Gerado hoje às ${t}`,
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

export default function SovereignBriefingCard({ overrideActive = false, overrideRef = null } = {}) {
  const { lang } = useLang();
  const { isGraduated } = useCalibration();
  const tr = SB_STR[lang] || SB_STR.en;
  const [url, setUrl] = useState(null);
  const [createdAt, setCreatedAt] = useState(null); // generation timestamp (UTC ISO)
  const [phase, setPhase] = useState('loading'); // loading | ready | idle | generating | error
  const [err, setErr] = useState(null);
  const audioRef = useRef(null);

  // SQUAD INTERCEPT (Phase 3): when an override is active, the player BYPASSES the
  // bespoke daily briefing and serves the override's permanent PUBLIC URL resolved
  // from the manifest id (calendar_overrides.brief_script_reference). Additive — the
  // personalized base64 briefing path below is left fully intact for the normal case.
  const interceptUrl = overrideActive ? manifestUrlById(overrideRef) : null;
  const intercept = !!interceptUrl;

  // On mount: an active intercept wins (play the public URL immediately). Otherwise,
  // for a graduated athlete, pull TODAY'S pre-cached briefing (fast RPC). Present →
  // ready for instant play. Absent (no check-in yet) → 'idle' for on-tap generation.
  // State is set ONLY inside callbacks/microtasks (never synchronously) — clear of
  // react-hooks/set-state-in-effect, StrictMode-safe.
  useEffect(() => {
    let cancelled = false;
    if (intercept) {
      queueMicrotask(() => { if (!cancelled) { setUrl(interceptUrl); setCreatedAt(null); setPhase('ready'); setErr(null); } });
      return () => { cancelled = true; };
    }
    if (!isGraduated) return undefined;
    const key = `${lang}|${utcDay()}`;
    const hit = _sovCache.get(key);
    if (hit) {
      // Defer to a microtask so the first paint isn't a synchronous setState.
      queueMicrotask(() => { if (!cancelled) { setUrl(hit.url); setCreatedAt(hit.createdAt); setPhase('ready'); } });
      return () => { cancelled = true; };
    }
    fetchCachedSovereignBriefing({ locale: lang })
      .then((res) => {
        if (cancelled) return;
        if (res?.url) { _sovCache.set(key, res); setUrl(res.url); setCreatedAt(res.createdAt); setPhase('ready'); }
        else { setUrl(null); setCreatedAt(null); setPhase('idle'); }
      })
      .catch(() => { if (!cancelled) { setUrl(null); setCreatedAt(null); setPhase('idle'); } });
    return () => { cancelled = true; };
  }, [intercept, interceptUrl, isGraduated, lang]);

  // Render for a graduated athlete OR whenever a squad intercept is active.
  if (!isGraduated && !intercept) return null;

  function play() {
    queueMicrotask(() => { try { audioRef.current?.play?.(); } catch { /* user can press the native control */ } });
  }

  async function generate() {
    if (phase === 'generating') return;
    setPhase('generating');
    setErr(null);
    try {
      const next = await fetchSovereignBriefing({ locale: lang }); // on-demand live (cache-miss path)
      const entry = { url: next, createdAt: new Date().toISOString() }; // generated just now
      _sovCache.set(`${lang}|${utcDay()}`, entry);
      setUrl(next);
      setCreatedAt(entry.createdAt);
      setPhase('ready');
      play();
    } catch (e) {
      setErr(mapErr(e?.message, tr));
      setPhase('error');
    }
  }

  // Plain render values (no ref access) + one event-handler that branches on phase
  // — ref reads happen only inside play()/generate(), called on click.
  function onPrimary() {
    if (phase === 'ready') play();
    else if (phase === 'idle' || phase === 'error') generate();
    // loading / generating → button is disabled (no-op)
  }
  const disabled = phase === 'loading' || phase === 'generating';
  const label =
    phase === 'ready'      ? (url ? tr.playToday : tr.generate) :
    phase === 'loading'    ? tr.loadingToday :
    phase === 'generating' ? tr.generating :
                             tr.generate; // idle | error

  return (
    <section className="vh-sov-brief" data-testid="sovereign-briefing" data-phase={phase} data-intercept={intercept ? '1' : '0'} style={WRAP}>
      <div style={GLOW} aria-hidden="true" />
      <div style={{ position: 'relative' }}>
        {intercept ? (
          <div style={INTERCEPT} data-testid="sovereign-briefing-intercept">
            ⚑ {({ en: 'Squad Intercept', es: 'Intercepción del Escuadrón', pt: 'Interceptação do Esquadrão' }[lang] || 'Squad Intercept')}
          </div>
        ) : null}
        <span style={KICKER}>★ {tr.kicker}</span>
        <h3 style={TITLE}>{tr.title}</h3>
        <p style={SUB}>{tr.sub}</p>
        {/* Premium "freshly generated" stamp — reads created_at off the cached blob.
            Purple pill + gold border/text; only when a briefing is ready. */}
        {createdAt && phase === 'ready' ? (
          <div style={STAMP} data-testid="sovereign-briefing-stamp">
            <span aria-hidden="true">◷</span> {tr.freshAt(fmtTime(createdAt, lang))}
          </div>
        ) : null}
        <div style={{ display: 'flex', alignItems: 'center', gap: '.7rem', flexWrap: 'wrap', marginTop: '.7rem' }}>
          <button type="button" onClick={onPrimary} disabled={disabled} style={{ ...BTN, opacity: disabled ? 0.7 : 1 }} data-testid="sovereign-briefing-play">
            {label}
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
// Squad-intercept flag: brushed-titanium pill on the gold/purple card, signaling the
// player is serving a CEO override asset rather than the bespoke daily briefing.
const INTERCEPT = { display: 'inline-flex', alignItems: 'center', gap: '.4rem', marginBottom: '.5rem', padding: '.22rem .65rem', borderRadius: 999, background: 'linear-gradient(90deg,#e7e9ee,#c8ccd4)', color: '#090909', fontFamily: 'var(--hb)', fontSize: '.62rem', letterSpacing: '1px', fontWeight: 700, textTransform: 'uppercase' };
// Brand-token timestamp pill: BBF Purple fill, BBF Gold border + text. Subtle,
// premium, sits between the sub and the play action without competing with it.
const STAMP = { display: 'inline-flex', alignItems: 'center', gap: '.4rem', marginTop: '.55rem', padding: '.22rem .65rem', borderRadius: 999, background: 'rgba(106,13,173,.32)', border: '1px solid rgba(245,200,0,.38)', color: '#f5cf60', fontFamily: 'var(--hb)', fontSize: '.66rem', letterSpacing: '.7px', fontWeight: 700, textTransform: 'uppercase' };
