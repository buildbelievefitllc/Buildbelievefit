// src/components/vault/FormDemoPlayer.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Inline form-demo player (Material Upgrade — session retention order).
//
// Replaces the old external-YouTube anchors in the Program grid and the
// Generator: the thumbnail is now a tap-to-play toggle that swaps to an embedded
// iframe INSIDE the execution card — the athlete never leaves the application
// mid-session. The underlying video data structures (resolveVideoId / VIDEO_MAP)
// are untouched; this is presentation only.
//
// Chrome rides the existing .pg-video style family (vault.css), so both vault
// surfaces share ONE player skin. Host contexts size it via scoped rules
// (.gen-ex .pg-video keeps the compact roster-row thumb; .is-playing spans the
// row). No resolvable id → render nothing (the caller already gates).

import { useState } from 'react';
import { embedURL, thumbURL } from './exerciseVideos.js';
import { PlayIcon } from './icons.jsx';

export default function FormDemoPlayer({ videoId, title, label = null }) {
  const [playing, setPlaying] = useState(false);
  if (!videoId) return null;

  if (playing) {
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

  return (
    <button
      type="button"
      className="pg-video bbf-video-cover"
      onClick={() => setPlaying(true)}
      aria-label={title}
    >
      <img className="pg-video-thumb" src={thumbURL(videoId)} alt="" loading="lazy" referrerPolicy="no-referrer" />
      <span className="bbf-video-overlay" aria-hidden="true">
        <span className="bbf-video-play"><PlayIcon size={24} /></span>
      </span>
      {label ? <span className="pg-video-label">{label}</span> : null}
    </button>
  );
}
