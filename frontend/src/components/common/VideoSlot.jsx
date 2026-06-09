// src/components/common/VideoSlot.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Reusable form-demo / educational video slot — the shared extraction of the
// thumbnail→autoplay-embed pattern used by Prehab (and the Mindset YouTube panel).
// Standard YouTube embed, nothing interactive beyond tap-to-play.
//
//   <VideoSlot videoId="dQw4…" title="Explosive Power" caption="Triple extension" />
//
// No videoId → a clean caption-only slot (never a dead/broken embed). Thumbnail
// uses the shared exerciseVideos.thumbURL helper so it matches the rest of the app.

import { useState } from 'react';
import { thumbURL } from '../vault/exerciseVideos.js';
import './VideoSlot.css';

export default function VideoSlot({ videoId, title = 'Demonstration', caption }) {
  const [playing, setPlaying] = useState(false);

  if (!videoId) {
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
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
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
      <img className="bbf-vslot-thumb" src={thumbURL(videoId)} alt="" loading="lazy" />
      <span className="bbf-vslot-btn" aria-hidden="true">▶</span>
      {caption ? <span className="bbf-vslot-cap">{caption}</span> : null}
    </button>
  );
}
