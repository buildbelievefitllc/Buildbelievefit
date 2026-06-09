// src/components/common/VideoSlot.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Reusable form-demo / educational video slot — the shared extraction of the
// thumbnail→autoplay-embed pattern used by Prehab, the Sports Hub metrics, and
// the Mindset YouTube panel. Standard YouTube embed, tap-to-play.
//
// MULTI-LINGUAL (Priority Delta): every text/id prop accepts EITHER a flat
// string OR a localized { en, es, pt } object. The slot reads the global
// LanguageContext (useLang) and resolves each to the active language via
// pickLang(), with automatic EN fallback — so a missing localized clip shows the
// EN video instead of a broken/blank iframe. The active id is also the iframe's
// `key`, so toggling the language cleanly remounts the player on the correct
// localized video rather than leaving a stale frame.
//
//   <VideoSlot videoId="dQw4…" title="Explosive Power" caption="Triple extension" />
//   <VideoSlot videoId={{ en:'a', es:'b', pt:'c' }} caption={{ en:'…', es:'…' }} />
//
// No resolvable videoId → a clean caption-only slot (never a dead/broken embed).

import { useState } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import { pickLang } from '../../lib/pickLang.js';
import { thumbURL } from '../vault/exerciseVideos.js';
import './VideoSlot.css';

export default function VideoSlot({ videoId, title, caption }) {
  const { lang } = useLang();
  const [playing, setPlaying] = useState(false);

  // Resolve each prop to the active language (string passes through; object →
  // lang → en → first). The id drives the iframe key so a language toggle
  // remounts the player on the localized clip.
  const id = pickLang(videoId, lang);
  const ttl = pickLang(title, lang) || 'Demonstration';
  const cap = pickLang(caption, lang);

  if (!id) {
    return (
      <div className="bbf-vslot is-empty" aria-label={ttl}>
        {cap ? <span className="bbf-vslot-cap">{cap}</span> : null}
      </div>
    );
  }

  if (playing) {
    return (
      <div className="bbf-vslot is-playing">
        <iframe
          key={id}
          className="bbf-vslot-frame"
          src={`https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`}
          title={ttl}
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
      aria-label={`${ttl} — play demonstration`}
    >
      <img className="bbf-vslot-thumb" src={thumbURL(id)} alt="" loading="lazy" />
      <span className="bbf-vslot-btn" aria-hidden="true">▶</span>
      {cap ? <span className="bbf-vslot-cap">{cap}</span> : null}
    </button>
  );
}
