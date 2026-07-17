// src/components/vault/FormDemoPlayer.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Dual-Media exercise player (Material Upgrade — session retention order).
//
// Two media lanes on one execution card:
//   🎬 Play Video Summary — the full narrated form demo, embedded INSIDE the
//      card (the athlete never leaves the app mid-session; behavior unchanged).
//   🖼️ Quick View GIF — the lightweight animated loop from the ingested
//      ./videos library (exerciseGifs.js manifest) for a split-second form
//      check before a heavy set. Tap the loop to dismiss it.
//
// Fail-safe by construction: no resolvable gif (or a gif that 404s at runtime)
// renders the branded BBF placeholder panel — never a broken image. With no gif
// AND no video the component renders nothing (callers already gate). While the
// gif manifest is empty the chip row only appears when a video exists, so the
// pre-ingestion card is pixel-identical to the legacy single-media card.
//
// Chrome rides the existing .pg-video style family (vault.css) so both vault
// surfaces (Program grid + Generator) share ONE player skin.

import { useState } from 'react';
import { embedURL, thumbURL } from './exerciseVideos.js';
import { useLang } from '../../context/LangContext.jsx';
import { pickLang } from '../../lib/pickLang.js';
import { PlayIcon } from './icons.jsx';

// Trilingual chip/placeholder strings (structural EN/ES/PT — CLAUDE.md §1).
const T = {
  video: { en: 'Play Video Summary', es: 'Ver resumen en video', pt: 'Ver resumo em vídeo' },
  gif: { en: 'Quick View GIF', es: 'Vista rápida GIF', pt: 'Visão rápida GIF' },
  close: { en: 'Close quick view', es: 'Cerrar vista rápida', pt: 'Fechar visão rápida' },
  pending: { en: 'Form loop coming soon', es: 'Bucle de técnica próximamente', pt: 'Loop de técnica em breve' },
};

export default function FormDemoPlayer({ videoId, gifUrl = null, title, label = null }) {
  const { lang } = useLang();
  const [mode, setMode] = useState('idle'); // 'idle' | 'video' | 'gif'
  const [gifBroken, setGifBroken] = useState(false);
  if (!videoId && !gifUrl) return null;

  if (mode === 'video' && videoId) {
    return (
      <div className="pg-video is-playing">
        <iframe
          key={videoId}
          className="pg-video-frame"
          src={embedURL(videoId)}
          title={title}
          loading="lazy"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  if (mode === 'gif') {
    return (
      <div className="pg-video is-playing pg-gifview">
        {gifUrl && !gifBroken ? (
          <img
            className="pg-gif"
            src={gifUrl}
            alt={title}
            onError={() => setGifBroken(true)}
          />
        ) : (
          /* Branded fall-back — a missing/broken loop is a clean BBF panel,
             never a torn image (UI must not break on unmatched exercises). */
          <div className="pg-gif-placeholder" role="img" aria-label={title}>
            <span className="pg-gif-mark">BBF</span>
            <span className="pg-gif-copy">{pickLang(T.pending, lang)}</span>
          </div>
        )}
        <button
          type="button"
          className="pg-gif-close"
          onClick={() => setMode('idle')}
          aria-label={pickLang(T.close, lang)}
        >
          ✕
        </button>
      </div>
    );
  }

  // Idle — cover thumb (tap = primary medium) + the dual-media chip row. The
  // gif chip renders only when a loop actually resolved for this movement;
  // unmatched movements keep the single-media card (their fall-back placeholder
  // still guards the runtime-404 path above).
  const primary = videoId ? 'video' : 'gif';
  return (
    <div className="pg-dualmedia">
      <button
        type="button"
        className="pg-video bbf-video-cover"
        onClick={() => setMode(primary)}
        aria-label={title}
      >
        {videoId ? (
          <img className="pg-video-thumb" src={thumbURL(videoId)} alt="" loading="lazy" referrerPolicy="no-referrer" />
        ) : (
          <span className="pg-gif-placeholder" aria-hidden="true">
            <span className="pg-gif-mark">BBF</span>
          </span>
        )}
        <span className="bbf-video-overlay" aria-hidden="true">
          <span className="bbf-video-play"><PlayIcon size={24} /></span>
        </span>
        {label ? <span className="pg-video-label">{label}</span> : null}
      </button>
      {videoId && gifUrl ? (
        <div className="pg-media-actions" role="group" aria-label={title}>
          <button type="button" className="pg-media-chip" onClick={() => setMode('video')}>
            <span aria-hidden="true">🎬</span> {pickLang(T.video, lang)}
          </button>
          <button type="button" className="pg-media-chip is-gif" onClick={() => setMode('gif')}>
            <span aria-hidden="true">🖼️</span> {pickLang(T.gif, lang)}
          </button>
        </div>
      ) : null}
    </div>
  );
}
