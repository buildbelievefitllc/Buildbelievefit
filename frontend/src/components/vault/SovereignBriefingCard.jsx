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
import { useDailyReadiness, localToday } from '../../lib/useDailyReadiness.js';
import { fetchSovereignBriefing, fetchCachedSovereignBriefing, fetchReadinessScoreClip } from '../../lib/forecastApi.js';
import { manifestUrlById } from '../../lib/sovereignManifest.js';
import { nearestScenario, telemetryFromReadiness } from '../../lib/biometricRouter.js';
// Owns the vh-sov-brief--pop entrance keyframes (see that file) so this
// component's motion doesn't silently depend on whichever parent happens to
// import sovereignHub.css.
import './sovereignHub.css';
// UNIFIED BRIEFING PLAYER (architectural reconciliation): the Hub's redundant
// AudioBriefCard is gone; its polished runtime-metric chrome is transplanted HERE,
// wired to THIS card's working cached-briefing source — the runtime reads off the
// actually-loaded audio's metadata, never a phantom playlist row. hub.css supplies
// the shared metric styles (flat, unscoped classes).
import { formatDuration } from '../hub/hubStrings.js';
import '../hub/hub.css';

// Session blob cache (locale|UTC-day → object URL) so re-mounting the Hub doesn't
// re-download today's ~1MB briefing. Session-lived; one URL per locale/day.
const _sovCache = new Map();
// Score-clip cache (locale|score → the globally-cached Akeem-voice URL from
// bbf-readiness-score-voice). Distinct from _sovCache: this one is NOT keyed by
// day/athlete since the sentence is identical for every athlete who ever lands
// on the same score — the backend already caches it globally, this just skips
// the redundant network round-trip within one session.
const _scoreClipCache = new Map();
async function scoreClipUrl(score, lang) {
  const key = `${lang}|${score}`;
  if (_scoreClipCache.has(key)) return _scoreClipCache.get(key);
  const url = await fetchReadinessScoreClip({ score, locale: lang });
  _scoreClipCache.set(key, url);
  return url;
}
// Plays `url` on the given <audio> element and resolves once it finishes (or
// rejects on a genuine playback error) — used to chain the exact-score intro
// clip before the coaching content, both in Coach Akeem's voice.
function playToEnd(el, url) {
  return new Promise((resolve, reject) => {
    if (!el) { resolve(); return; }
    el.onended = () => resolve();
    el.onerror = () => reject(new Error('clip_playback_failed'));
    el.src = url;
    el.play().catch(reject);
  });
}
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
    readinessLabel: 'Today’s Readiness',
    playToday: '▶ Play Today’s Briefing', generate: '▶ Generate Briefing',
    loadingToday: 'Loading today’s briefing…', generating: 'Composing your briefing…', replay: '↻ Replay',
    freshAt: (t) => `Freshly generated today at ${t}`,
    runtime: 'Runtime', readyChip: 'Ready',
    upsell: 'Upgrade to unlock your Sovereign Briefing in Akeem’s voice.',
    quota: 'Monthly voice limit reached — resets next month.',
    session: 'Your session expired — sign in again.',
    err: 'Briefing unavailable right now. Try again in a moment.',
  },
  es: {
    kicker: 'Audio Soberano · Diario',
    title: 'Tu Informe Soberano',
    sub: 'Compuesto al instante desde tu registro de esta mañana — en la voz del Coach Akeem.',
    readinessLabel: 'Preparación de Hoy',
    playToday: '▶ Reproducir el de Hoy', generate: '▶ Generar Informe',
    loadingToday: 'Cargando el informe de hoy…', generating: 'Componiendo tu informe…', replay: '↻ Repetir',
    freshAt: (t) => `Generado hoy a las ${t}`,
    runtime: 'Duración', readyChip: 'Lista',
    upsell: 'Mejora tu plan para desbloquear tu Informe Soberano en la voz de Akeem.',
    quota: 'Límite de voz mensual alcanzado — se reinicia el próximo mes.',
    session: 'Tu sesión expiró — inicia sesión de nuevo.',
    err: 'Informe no disponible ahora. Inténtalo de nuevo en un momento.',
  },
  pt: {
    kicker: 'Áudio Soberano · Diário',
    title: 'Seu Briefing Soberano',
    sub: 'Composto na hora a partir do seu check-in desta manhã — na voz do Coach Akeem.',
    readinessLabel: 'Prontidão de Hoje',
    playToday: '▶ Tocar o de Hoje', generate: '▶ Gerar Briefing',
    loadingToday: 'Carregando o briefing de hoje…', generating: 'Compondo seu briefing…', replay: '↻ Repetir',
    freshAt: (t) => `Gerado hoje às ${t}`,
    runtime: 'Duração', readyChip: 'Pronto',
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

export default function SovereignBriefingCard({ overrideActive = false, overrideRef = null, programLoad = null } = {}) {
  const { lang } = useLang();
  const { isGraduated } = useCalibration();
  const { data: readiness } = useDailyReadiness();
  const tr = SB_STR[lang] || SB_STR.en;
  const [url, setUrl] = useState(null);
  const [createdAt, setCreatedAt] = useState(null); // generation timestamp (UTC ISO)
  const [phase, setPhase] = useState('loading'); // loading | ready | idle | generating | error
  const [err, setErr] = useState(null);
  // Transplanted Hub-card runtime metric: the REAL duration read off the loaded
  // audio's metadata (the working source of truth) — never a phantom playlist row.
  const [audioMs, setAudioMs] = useState(0);
  const audioRef = useRef(null);
  const scoreAudioRef = useRef(null); // dedicated element for the exact-score intro clip

  // SQUAD INTERCEPT (Phase 3): when an override is active, the player BYPASSES the
  // bespoke daily briefing and serves the override's permanent PUBLIC URL resolved
  // from the manifest id (calendar_overrides.brief_script_reference). Additive — the
  // personalized base64 briefing path below is left fully intact for the normal case.
  const interceptUrl = overrideActive ? manifestUrlById(overrideRef) : null;
  const intercept = !!interceptUrl;

  // STRICT same-day check-in gate (CEO order): readiness.hasData alone is NOT
  // enough here — it carries a 1-day grace window (useDailyReadiness honors a
  // stored protocol up to 1 day old, by design, so volume-lock features don't
  // suddenly blank out on a missed morning check-in). This card's whole premise
  // is "composed fresh from THIS MORNING's check-in" — an athlete who checked in
  // yesterday but hasn't yet today must NOT see it. hasData + an exact date match
  // against local today is the real gate everywhere below.
  const hasTodayCheckIn = !!(readiness?.hasData && readiness.date === localToday());

  // BIOMETRIC ROUTER (Phase 3): with NO override, a graduated athlete who has live
  // check-in telemetry TODAY is routed to the nearest matrix clip for their
  // CNS/Sleep/Stress state, filtered to their language. No check-in today → null,
  // and the bespoke briefing below remains the graceful fallback.
  const bioMatch = (!intercept && isGraduated && hasTodayCheckIn)
    ? nearestScenario({ lang, ...telemetryFromReadiness(readiness, programLoad) })
    : null;
  const bioUrl = bioMatch?.url || null;

  // The live score as an integer, or null with no check-in TODAY. Feeds BOTH the
  // cache-key (so a mid-day score change never collides with an earlier score's
  // session-cached URL) and the RPC's stale-cache guard.
  const liveScore = (!intercept && hasTodayCheckIn && Number.isFinite(Number(readiness.score)))
    ? Math.round(Number(readiness.score)) : null;

  // On mount (and whenever the live score changes), precedence: (1) squad intercept
  // → override clip; (2) biometric route → nearest matrix clip from live telemetry;
  // (3) graduated + a check-in exists today → bespoke daily briefing (fast RPC;
  // absent/stale → 'idle' for on-tap generation). No check-in yet → the card stays
  // unmounted (see the render gate below) rather than offering a briefing with
  // nothing to report on. State is set ONLY inside callbacks/microtasks (never
  // synchronously) — clear of react-hooks/set-state-in-effect.
  useEffect(() => {
    let cancelled = false;
    if (intercept) {
      queueMicrotask(() => { if (!cancelled) { setUrl(interceptUrl); setCreatedAt(null); setPhase('ready'); setErr(null); } });
      return () => { cancelled = true; };
    }
    if (bioUrl) {
      queueMicrotask(() => { if (!cancelled) { setUrl(bioUrl); setCreatedAt(null); setPhase('ready'); setErr(null); } });
      return () => { cancelled = true; };
    }
    if (!isGraduated || liveScore === null) return undefined;
    const key = `${lang}|${utcDay()}|${liveScore}`;
    const hit = _sovCache.get(key);
    if (hit) {
      // Defer to a microtask so the first paint isn't a synchronous setState.
      queueMicrotask(() => { if (!cancelled) { setUrl(hit.url); setCreatedAt(hit.createdAt); setPhase('ready'); } });
      return () => { cancelled = true; };
    }
    queueMicrotask(() => { if (!cancelled) setPhase('loading'); });
    fetchCachedSovereignBriefing({ locale: lang, currentScore: liveScore })
      .then((res) => {
        if (cancelled) return;
        if (res?.url) { _sovCache.set(key, res); setUrl(res.url); setCreatedAt(res.createdAt); setPhase('ready'); }
        else { setUrl(null); setCreatedAt(null); setPhase('idle'); }
      })
      .catch(() => { if (!cancelled) { setUrl(null); setCreatedAt(null); setPhase('idle'); } });
    return () => { cancelled = true; };
  }, [intercept, interceptUrl, bioUrl, isGraduated, lang, liveScore]);

  // Render for a graduated athlete OR whenever a squad intercept is active — AND,
  // for the personalized (non-intercept) case, only once TODAY's check-in exists
  // (hasTodayCheckIn — see the strict same-day gate above, not the looser
  // hasData). "Composed fresh from this morning's check-in" has nothing to
  // compose from before that check-in happens, so the card stays off the page
  // rather than offering a stale/empty briefing pre-check-in.
  if (!isGraduated && !intercept) return null;
  if (!intercept && !bioUrl && !hasTodayCheckIn) return null;

  // Every time the briefing plays: if there's a live check-in score, lead with
  // the EXACT number in Coach Akeem's real voice (bbf-readiness-score-voice —
  // globally cached, usually an instant hit) before the coaching clip / bespoke
  // narrative. Never blocks playback — a fetch/playback failure on the intro
  // just falls through to the briefing itself. Skipped for a squad intercept
  // (a CEO-authored override clip unrelated to today's individual score).
  async function play() {
    const hasScore = !intercept && hasTodayCheckIn && Number.isFinite(Number(readiness.score));
    if (hasScore) {
      try {
        const clipUrl = await scoreClipUrl(Math.round(Number(readiness.score)), lang);
        await playToEnd(scoreAudioRef.current, clipUrl);
      } catch { /* score intro unavailable — proceed straight to the briefing */ }
    }
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
    <section className="vh-sov-brief vh-sov-brief--pop" data-testid="sovereign-briefing" data-phase={phase} data-intercept={intercept ? '1' : '0'} style={WRAP}>
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
        {/* Visible confirmation of the EXACT score the audio is about to lead with —
            the same number the Sovereign Readiness dial shows, so the card never
            visually disagrees with what plays. */}
        {!intercept && hasTodayCheckIn && Number.isFinite(Number(readiness.score)) ? (
          <div style={READINESS} data-testid="sovereign-briefing-readiness">
            {tr.readinessLabel}: <strong>{Math.round(Number(readiness.score))}</strong>/100
          </div>
        ) : null}
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
        {/* Transplanted Hub-brief chrome (unified player): the ready row + runtime
            metric, fed by the LOADED audio's real metadata. Compact — one tight
            block under the play action, keeping the check-in card contained. */}
        {url && phase === 'ready' ? (
          <div style={{ marginTop: '.7rem' }} data-testid="sovereign-briefing-meta">
            <div className="hub-brief-ready">
              <span className="hub-brief-mark" aria-hidden="true">▶</span>
              <span>{tr.title}</span>
              <span className="hub-card-tier" data-testid="sovereign-briefing-ready-chip">{tr.readyChip}</span>
            </div>
            <div className="hub-metric-grid hub-metric-grid--two">
              <div className="hub-metric">
                <span className="hub-metric-label">{tr.runtime}</span>
                <span className="hub-metric-value" data-testid="sovereign-briefing-runtime">
                  {audioMs > 0 ? formatDuration(audioMs) : '—'}
                </span>
              </div>
              <div className="hub-metric">
                <span className="hub-metric-label">{tr.readinessLabel}</span>
                <span className="hub-metric-value">
                  {!intercept && hasTodayCheckIn && Number.isFinite(Number(readiness?.score))
                    ? `${Math.round(Number(readiness.score))}/100` : '—'}
                </span>
              </div>
            </div>
          </div>
        ) : null}
        {url ? (
          <audio
            ref={audioRef}
            src={url}
            controls
            preload="auto"
            onLoadedMetadata={(e) => setAudioMs(Math.round((Number(e.currentTarget.duration) || 0) * 1000))}
            style={{ width: '100%', marginTop: '.7rem' }}
            data-testid="sovereign-briefing-audio"
          />
        ) : null}
        {/* Hidden — the exact-score intro clip chains through here before audioRef plays. */}
        <audio ref={scoreAudioRef} preload="none" style={{ display: 'none' }} data-testid="sovereign-briefing-score-audio" />
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
const READINESS = { marginTop: '.5rem', color: 'rgba(244,238,251,.9)', fontFamily: 'var(--hb)', fontSize: '.78rem', letterSpacing: '.5px' };
const BTN = { fontFamily: 'var(--hb)', fontSize: '.82rem', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 700, color: '#0e0a16', background: 'linear-gradient(90deg,#f5c800,#ffd83a)', border: 'none', borderRadius: 999, padding: '.6rem 1.25rem', cursor: 'pointer' };
const ERR = { marginTop: '.6rem', color: '#ffd24d', fontSize: '.8rem' };
// Squad-intercept flag: brushed-titanium pill on the gold/purple card, signaling the
// player is serving a CEO override asset rather than the bespoke daily briefing.
const INTERCEPT = { display: 'inline-flex', alignItems: 'center', gap: '.4rem', marginBottom: '.5rem', padding: '.22rem .65rem', borderRadius: 999, background: 'linear-gradient(90deg,#e7e9ee,#c8ccd4)', color: '#090909', fontFamily: 'var(--hb)', fontSize: '.62rem', letterSpacing: '1px', fontWeight: 700, textTransform: 'uppercase' };
// Brand-token timestamp pill: BBF Purple fill, BBF Gold border + text. Subtle,
// premium, sits between the sub and the play action without competing with it.
const STAMP = { display: 'inline-flex', alignItems: 'center', gap: '.4rem', marginTop: '.55rem', padding: '.22rem .65rem', borderRadius: 999, background: 'rgba(106,13,173,.32)', border: '1px solid rgba(245,200,0,.38)', color: '#f5cf60', fontFamily: 'var(--hb)', fontSize: '.66rem', letterSpacing: '.7px', fontWeight: 700, textTransform: 'uppercase' };
