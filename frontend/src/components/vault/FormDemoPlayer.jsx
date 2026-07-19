// src/components/vault/FormDemoPlayer.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Dual-Media exercise player (Material Upgrade — session retention order).
//
// Two media lanes on one execution card:
//   🎬 Play Video Summary — the full narrated form demo.
//   🖼️ Quick View GIF — the lightweight animated loop from the ingested
//      ./videos library (exerciseGifs.js manifest) for a split-second form
//      check before a heavy set.
//
// Both now open a CENTERED POP-UP MODAL (FormDemoModal) instead of swapping the
// card content inline — mirroring the Recovery PrescriptionMoveModal aesthetic
// (dimmed + blurred backdrop, gold-edged dossier card, ✕ / backdrop / Esc close).
// The modal is PORTALED to <body>, so opening/closing it never re-lays-out the
// Program card or the active lifting-set trackers beneath it — the idle card
// stays mounted and the player's own local state is all that toggles.
//
// Fail-safe by construction: no resolvable gif (or a gif that 404s at runtime)
// renders the branded BBF placeholder panel — never a broken image. With no gif
// AND no video the component renders nothing (callers already gate).
//
// Chrome rides the existing .pg-video style family (vault.css) for the idle card;
// the pop-up rides formDemoModal.css.

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { embedURL, thumbURL } from './exerciseVideos.js';
import { useLang } from '../../context/LangContext.jsx';
import { pickLang } from '../../lib/pickLang.js';
import { PlayIcon } from './icons.jsx';
import './formDemoModal.css';

// Trilingual chip/placeholder strings (structural EN/ES/PT — CLAUDE.md §1).
const T = {
  video: { en: 'Play Video Summary', es: 'Ver resumen en video', pt: 'Ver resumo em vídeo' },
  gif: { en: 'Quick View GIF', es: 'Vista rápida GIF', pt: 'Visão rápida GIF' },
  close: { en: 'Close quick view', es: 'Cerrar vista rápida', pt: 'Fechar visão rápida' },
  pending: { en: 'Form loop coming soon', es: 'Bucle de técnica próximamente', pt: 'Loop de técnica em breve' },
};

// The centered pop-up — video summary OR quick-view GIF. Backdrop, ✕ and Esc all
// close it; portaled to <body> so it overlays the app without disturbing the card.
function FormDemoModal({ mode, videoId, gifUrl, title, lang, onClose }) {
  const [gifBroken, setGifBroken] = useState(false);

  // Esc closes; lock background scroll while open (matches PrescriptionMoveModal).
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const isVideo = mode === 'video' && !!videoId;

  return createPortal(
    <div
      className="fdm-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      data-testid="form-demo-modal"
    >
      <div className={`fdm${isVideo ? ' fdm--video' : ' fdm--gif'}`} onClick={(e) => e.stopPropagation()}>
        <header className="fdm-head">
          <span className="fdm-title">{title}</span>
          <button
            type="button"
            className="fdm-x"
            onClick={onClose}
            aria-label={pickLang(T.close, lang)}
            data-testid="form-demo-close"
          >
            ✕
          </button>
        </header>

        <div className="fdm-media">
          {isVideo ? (
            <iframe
              key={videoId}
              className="fdm-frame"
              src={embedURL(videoId)}
              title={title}
              loading="lazy"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          ) : gifUrl && !gifBroken ? (
            <img className="fdm-gif" src={gifUrl} alt={title} onError={() => setGifBroken(true)} />
          ) : (
            /* Branded fall-back — a missing/broken loop is a clean BBF panel. */
            <div className="fdm-placeholder" role="img" aria-label={title}>
              <span className="fdm-mark">BBF</span>
              <span className="fdm-copy">{pickLang(T.pending, lang)}</span>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function FormDemoPlayer({ videoId, gifUrl = null, title, label = null }) {
  const { lang } = useLang();
  const [mode, setMode] = useState('idle'); // 'idle' | 'video' | 'gif'
  const close = useCallback(() => setMode('idle'), []); // stable → modal effect runs once
  if (!videoId && !gifUrl) return null;

  // Idle — cover thumb (tap = primary medium) + the dual-media chip row. The gif
  // chip renders only when a loop actually resolved for this movement; unmatched
  // movements keep the single-media card. The idle card stays mounted while the
  // pop-up is open, so nothing beneath it re-renders on open/close.
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

      {mode !== 'idle' ? (
        <FormDemoModal mode={mode} videoId={videoId} gifUrl={gifUrl} title={title} lang={lang} onClose={close} />
      ) : null}
    </div>
  );
}
