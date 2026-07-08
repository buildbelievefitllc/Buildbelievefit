// src/components/vault/ContextualVoiceover.jsx
// ─────────────────────────────────────────────────────────────────────────────
// CONTEXTUAL VOICEOVER LAYER — a reusable "explain the WHY" audio player, styled
// to match the Sovereign Briefing tile (gold/purple card, gold play pill, native
// transport). Plays a PRE-BAKED Coach Akeem clip resolved from a static AUDIO_CTX_*
// key (see lib/contextualVoiceover.js). Pure static <audio>: no API, no synth, no
// backend ping — the clips live permanently in the public studio-audio-vault bucket.
//
// Props:
//   • audioKey  : AUDIO_CTX_* static key (or a full URL) → resolved to the clip URL.
//   • title/sub/kicker : chrome copy. Each may be a plain string OR a {en,es,pt}
//                 map (trilingual is structural, §1) — resolved by the active lang.
//   • autoPlay  : when true, the clip attempts playback STRICTLY ONCE on initial
//                 mount (never on parent re-renders). Default false (paused).
//   • testId    : data-testid for the card root (defaults to `ctx-voiceover`).
//   • compact   : tighter padding for in-modal placement.

import { useEffect, useRef, useState } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import { contextualAudioUrl } from '../../lib/contextualVoiceover.js';

const CHROME = {
  en: { kicker: 'Coach’s Voice · Why This Matters', listen: '▶ Listen to Coach Akeem', pause: '❚❚ Pause', replay: '↻ Replay' },
  es: { kicker: 'La Voz del Coach · Por Qué Importa', listen: '▶ Escucha al Coach Akeem', pause: '❚❚ Pausar', replay: '↻ Repetir' },
  pt: { kicker: 'A Voz do Coach · Por Que Importa', listen: '▶ Ouça o Coach Akeem', pause: '❚❚ Pausar', replay: '↻ Repetir' },
};

// Resolve a string-or-{en,es,pt} prop against the active language.
function loc(val, lang) {
  if (val == null) return null;
  if (typeof val === 'string') return val;
  return val[lang] || val.en || null;
}

export default function ContextualVoiceover({
  audioKey,
  title,
  sub,
  kicker,
  autoPlay = false,
  testId = 'ctx-voiceover',
  compact = false,
}) {
  const { lang } = useLang();
  const tr = CHROME[lang] || CHROME.en;
  const url = contextualAudioUrl(audioKey);

  const audioRef = useRef(null);
  const didAutoPlay = useRef(false); // belt-and-suspenders: mount-only, never re-fire
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [autoplayFired, setAutoplayFired] = useState(false); // observable mount-fire signal
  // Spatial compaction (Repositioning S-02): the card renders as a single-row
  // voice STRIP until first engagement — the native transport mounts only after
  // play is requested (or immediately under autoPlay). Full chrome is the
  // engaged state; nothing is removed, it reveals at the moment of use.
  const [engaged, setEngaged] = useState(autoPlay);

  // AUTO-PLAY: fire strictly once on INITIAL MOUNT. Because the host (e.g. the
  // Post-Workout modal) returns null while closed and re-mounts on open, an empty-dep
  // effect + the didAutoPlay ref guarantees playback triggers on open ONLY — never on
  // a slider/state re-render (props don't change, so the effect never re-runs anyway).
  // setState is deferred to a microtask to stay clear of react-hooks/set-state-in-effect.
  useEffect(() => {
    if (!autoPlay || !url || didAutoPlay.current) return undefined;
    didAutoPlay.current = true;
    queueMicrotask(() => {
      setAutoplayFired(true); // records the hook fired regardless of browser autoplay policy
      try { audioRef.current?.play?.().catch(() => {}); } catch { /* native control remains */ }
    });
    return undefined;
  }, [autoPlay, url]);

  if (!url) return null;

  function toggle() {
    setEngaged(true); // first engagement expands the strip + mounts the transport
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => {});
    else el.pause();
  }

  const label = playing ? tr.pause : ended ? tr.replay : tr.listen;
  const heading = loc(title, lang);
  const subline = loc(sub, lang);
  const kick = loc(kicker, lang) || tr.kicker;

  return (
    <section
      className="ctx-vo"
      data-testid={testId}
      data-audiokey={audioKey}
      data-playing={playing ? '1' : '0'}
      data-engaged={engaged ? '1' : '0'}
      data-autoplay={autoPlay ? (autoplayFired ? 'fired' : 'pending') : 'off'}
      style={engaged ? (compact ? { ...WRAP, ...WRAP_COMPACT } : WRAP) : { ...WRAP, ...WRAP_STRIP }}
    >
      <div style={GLOW} aria-hidden="true" />
      {engaged ? (
        <div style={{ position: 'relative' }}>
          <span style={KICKER}>★ {kick}</span>
          {heading ? <h3 style={TITLE}>{heading}</h3> : null}
          {subline ? <p style={SUB}>{subline}</p> : null}
          <div style={{ display: 'flex', alignItems: 'center', gap: '.7rem', flexWrap: 'wrap', marginTop: '.7rem' }}>
            <button type="button" onClick={toggle} style={BTN} data-testid={`${testId}-play`}>
              {label}
            </button>
          </div>
        </div>
      ) : (
        /* Single-row strip — same copy (kicker · title · sub), one line each,
           play pill left. Engaging expands to the full card + transport. */
        <div style={STRIP_ROW}>
          <button type="button" onClick={toggle} style={{ ...BTN, ...BTN_STRIP }} data-testid={`${testId}-play`}>
            {label}
          </button>
          <div style={{ minWidth: 0 }}>
            <span style={KICKER}>★ {kick}</span>
            {heading ? <h3 style={{ ...TITLE, ...TITLE_STRIP }}>{heading}</h3> : null}
            {subline ? <p style={{ ...SUB, ...SUB_STRIP }}>{subline}</p> : null}
          </div>
        </div>
      )}
      {/* The audio element always mounts (the ref + autoplay hook depend on it);
          the visible transport appears once engaged. */}
      <audio
        ref={audioRef}
        src={url}
        controls={engaged}
        preload={autoPlay ? 'auto' : 'none'}
        style={engaged ? { position: 'relative', width: '100%', marginTop: '.7rem' } : { display: 'none' }}
        data-testid={`${testId}-audio`}
        onPlay={() => { setPlaying(true); setEnded(false); }}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setEnded(true); }}
      />
    </section>
  );
}

// Brand-locked styling — mirrors the Sovereign Briefing tile (WRAP/GLOW/etc.).
const WRAP = { position: 'relative', overflow: 'hidden', margin: '0 0 1rem', padding: '1rem 1.1rem', borderRadius: 16, border: '1px solid rgba(245,200,0,.45)', background: 'linear-gradient(135deg, rgba(106,13,173,.30), rgba(9,9,9,.55))' };
const WRAP_COMPACT = { padding: '.8rem .9rem', margin: '0 0 .85rem' };
// Pre-engagement strip chrome (S-02): one ~64px row until the athlete presses play.
const WRAP_STRIP = { padding: '.6rem .9rem', margin: '0 0 .85rem' };
const STRIP_ROW = { position: 'relative', display: 'flex', alignItems: 'center', gap: '.8rem' };
const BTN_STRIP = { flexShrink: 0, padding: '.5rem .95rem', fontSize: '.72rem' };
const TITLE_STRIP = { fontSize: '1.05rem', margin: '.1rem 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
const SUB_STRIP = { fontSize: '.82rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
const GLOW = { position: 'absolute', inset: 0, background: 'radial-gradient(120% 80% at 100% 0%, rgba(245,200,0,.14), transparent 60%)', pointerEvents: 'none' };
const KICKER = { fontFamily: 'var(--hb)', fontSize: '.66rem', letterSpacing: '2px', textTransform: 'uppercase', color: '#f5c800' };
const TITLE = { fontFamily: 'var(--hb)', fontSize: '1.5rem', margin: '.25rem 0 .2rem', color: '#fff', letterSpacing: '.5px', lineHeight: 1.1 };
const SUB = { margin: 0, color: 'rgba(244,238,251,.82)', fontSize: '.9rem', lineHeight: 1.45 };
const BTN = { fontFamily: 'var(--hb)', fontSize: '.82rem', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 700, color: '#0e0a16', background: 'linear-gradient(90deg,#f5c800,#ffd83a)', border: 'none', borderRadius: 999, padding: '.6rem 1.25rem', cursor: 'pointer' };
