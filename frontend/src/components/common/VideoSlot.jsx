// src/components/common/VideoSlot.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Reusable form-demo / educational video slot — the shared extraction of the
// thumbnail→autoplay-embed pattern used by Prehab (and the Mindset YouTube panel).
// Standard YouTube embed, nothing interactive beyond tap-to-play.
//
//   <VideoSlot videoId="dQw4…" title="Explosive Power" caption="Triple extension" />
//   <VideoSlot videoId={{ en:'id_en', es:'id_es', pt:'id_pt' }} … />
//
// MULTI-LINGUAL: `videoId` may be a plain string (the en/legacy id) OR a
// language-keyed { en, es, pt } object. It reads the GLOBAL active language
// (useLang) and resolves via localizedVideoId — falling back to en so a missing
// es/pt cut never renders a broken iframe. No videoId → a clean caption-only slot.
// Thumbnail uses exerciseVideos.thumbURL so it matches the rest of the app.

import { useState } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import { thumbURL, localizedVideoId } from '../vault/exerciseVideos.js';
import './VideoSlot.css';

export default function VideoSlot({ videoId, title = 'Demonstration', caption }) {
  const [playing, setPlaying] = useState(false);
  const { lang } = useLang();
  // Localize to the active language (en fallback) — accepts a string or { en, es, pt }.
  const id = localizedVideoId(videoId, lang);

  if (!id) {
    return (
      <div className="bbf-vslot is-empty" aria-label={title}>
        {caption ? <span className="bbf-vslot-cap">{caption}</span> : null}
      </div>
    );
  }

  if (playing) {
    return (
      <div className="bbf-vslot is-playing">
        <iframe
          className="bbf-vslot-frame"
          src={`https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`}
          title={title}
          loading="lazy"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      className="bbf-vslot bbf-vslot--thumb"
      onClick={() => setPlaying(true)}
      aria-label={`${title} — play demonstration`}
    >
      <img className="bbf-vslot-thumb" src={thumbURL(id)} alt="" loading="lazy" />
      <span className="bbf-vslot-btn" aria-hidden="true">▶</span>
      {caption ? <span className="bbf-vslot-cap">{caption}</span> : null}
    </button>
  );
}
