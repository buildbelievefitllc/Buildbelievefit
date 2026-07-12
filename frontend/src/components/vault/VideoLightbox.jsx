// src/components/vault/VideoLightbox.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Shared embedded-YouTube lightbox — extracted from SovereignPsychologyDeck so any
// video grid on the Vault (the Mind Lab, the Cognitive Fortitude library, …) opens
// the SAME modal chrome instead of re-implementing it. Escape / backdrop-click
// closes; body scroll locks while open. Styling rides the existing `.spsy-modal*`
// classes (psychologyDeck.css) — no new CSS, byte-identical across every caller.

import { useEffect } from 'react';
import './psychologyDeck.css';

function ytWatch(id) { return `https://www.youtube.com/watch?v=${id}`; }
function ytEmbed(id) {
  return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&showinfo=0&fs=1&playsinline=1`;
}

// `video` = { id, title } — a resolved 11-char YouTube id + display title.
export default function VideoLightbox({ video, onClose, closeLabel, ytLabel }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  return (
    <div className="spsy-modal" role="dialog" aria-modal="true" aria-label={video.title} onClick={onClose} data-testid="spsy-modal">
      <div className="spsy-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="spsy-modal-bar">
          <p className="spsy-modal-title">{video.title}</p>
          <button type="button" className="spsy-modal-close" onClick={onClose} aria-label={closeLabel}>✕</button>
        </div>
        <div className="spsy-modal-frame">
          <iframe
            src={ytEmbed(video.id)}
            title={video.title}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        <div className="spsy-modal-foot">
          <a className="spsy-modal-yt" href={ytWatch(video.id)} target="_blank" rel="noreferrer noopener">{ytLabel} ↗</a>
        </div>
      </div>
    </div>
  );
}
