// src/components/vault/CognitiveFortitudeLibrary.jsx
// ─────────────────────────────────────────────────────────────────────────────
// COGNITIVE FORTITUDE LIBRARY — a supplementary "more films" video grid that
// hydrates each Championship Mindset Cinema category (Championship Drive / Stoic
// Heavy Grit / Female Strength Grace / Neurological Synapse) with extra film
// beyond the hand-curated champion cards above it. Mounts INSIDE ChampionMindset's
// cm-deck-panel, keyed to the SAME active bucket, so switching category tabs
// swaps this grid too.
//
// Unlike the curated roster (which needs a written `objective` + `dictums` per
// card), this is a flat video list — title, url, duration — so it renders with
// the SAME lightweight thumbnail-grid + lightbox pattern as the Mind Lab
// (SovereignPsychologyDeck), reusing its `.spsy-*` CSS classes and the shared
// VideoLightbox for byte-identical visual treatment (matte panel, gold hairline,
// duration badge). The source library is English-only (no ES/PT variant videos
// exist yet), so video titles stay in English across every language toggle —
// only the section chrome (kicker/CTA copy) localizes.
//
// DATA · src/data/cognitiveFortitudeLibrary.json — keyed by bucket KEY (shared
// with championMindsetData.js buckets) → [{ title, url, duration }].

import { useMemo, useState } from 'react';
import LIBRARY from '../../data/cognitiveFortitudeLibrary.json';
import VideoLightbox from './VideoLightbox.jsx';
import './psychologyDeck.css';

const L10N = {
  en: { kicker: 'More Championship Films', watch: 'Watch', close: 'Close', youtube: 'Watch on YouTube' },
  es: { kicker: 'Más Películas de Campeonato', watch: 'Ver', close: 'Cerrar', youtube: 'Ver en YouTube' },
  pt: { kicker: 'Mais Filmes de Campeonato', watch: 'Assistir', close: 'Fechar', youtube: 'Assistir no YouTube' },
};

function ytId(url) {
  const s = String(url || '');
  const m = s.match(/[?&]v=([A-Za-z0-9_-]{11})/)
    || s.match(/youtu\.be\/([A-Za-z0-9_-]{11})/)
    || s.match(/\/embed\/([A-Za-z0-9_-]{11})/);
  return m ? m[1] : '';
}
const ytThumb = (id) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;

// `bucketKey` — the active Championship Mindset Cinema bucket (e.g.
// 'championship-drive'); `lang` — the active LanguageContext code for chrome copy.
export default function CognitiveFortitudeLibrary({ bucketKey, lang }) {
  const L = L10N[lang] || L10N.en;
  const [openVideo, setOpenVideo] = useState(null);

  const films = useMemo(() => {
    const list = LIBRARY[bucketKey] || [];
    const seen = new Set();
    return list
      .map((f) => ({ ...f, id: ytId(f.url) }))
      .filter((f) => {
        if (!f.id || seen.has(f.id)) return false;
        seen.add(f.id);
        return true;
      });
  }, [bucketKey]);

  if (!films.length) return null;

  return (
    <div className="cm-fortitude" data-testid="cognitive-fortitude-library">
      <div className="cm-kicker cm-fortitude-kicker">{L.kicker}</div>
      <div className="spsy-grid">
        {films.map((f, i) => (
          <button
            key={`${f.id}-${i}`}
            type="button"
            className="spsy-card"
            onClick={() => setOpenVideo({ id: f.id, title: f.title })}
            data-testid="fortitude-card"
            aria-label={`${f.title} — ${L.watch}`}
          >
            <span className="spsy-thumb">
              <img src={ytThumb(f.id)} alt="" loading="lazy" referrerPolicy="no-referrer" />
              <span className="spsy-thumb-ov" aria-hidden="true"><span className="spsy-thumb-play">▶</span></span>
              {f.duration ? <span className="spsy-thumb-dur">{f.duration}</span> : null}
            </span>
            <span className="spsy-cardmeta">
              <span className="spsy-cardtitle">{f.title}</span>
              <span className="spsy-cardcta">▷ {L.watch}</span>
            </span>
          </button>
        ))}
      </div>

      {openVideo ? (
        <VideoLightbox
          video={openVideo}
          onClose={() => setOpenVideo(null)}
          closeLabel={L.close}
          ytLabel={L.youtube}
        />
      ) : null}
    </div>
  );
}
