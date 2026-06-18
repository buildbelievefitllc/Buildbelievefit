// src/components/vault/SpotifyEmbed.jsx
// ─────────────────────────────────────────────────────────────────────────────
// "Option A" Spotify integration (CEO-approved) — a low-friction Spotify embed
// iframe wrapped in a premium, BBF-branded Vault container (matte canvas · #6a0dad
// purple glow · #f5c800 gold accents). Mounted inside Smart Cardio's active-protocol
// view, directly above COMPLETE & SYNC PROTOCOL, so the athlete can cue their
// soundtrack right before the protocol starts.
//
// The embed is forced into Spotify's dark mode (theme=0) and is fully mobile
// responsive (100% width, compact player height). The playlist is prop-driven with
// a sensible high-energy default so the CEO can swap the source without code surgery.

import { useLang } from '../../context/LangContext.jsx';

// Trilingual header chrome — structural, not optional (EN / ES / PT).
const SPOTIFY_STR = {
  en: { kicker: 'Sovereign Audio Link', sub: 'Cue the soundtrack — then start your protocol.', title: 'BBF Protocol Soundtrack' },
  es: { kicker: 'Enlace de Audio Soberano', sub: 'Prepara la banda sonora — luego inicia tu protocolo.', title: 'Banda Sonora del Protocolo BBF' },
  pt: { kicker: 'Link de Áudio Soberano', sub: 'Prepare a trilha sonora — depois inicie seu protocolo.', title: 'Trilha Sonora do Protocolo BBF' },
};

// CEO-selected BBF cardio playlist (injected) — the default soundtrack for the
// Smart Cardio protocol player. Still prop-driven, so any mount can override it
// without code surgery. (Only the playlist ID is used; the share `si=` token is
// a referrer tag the embed neither needs nor honors.)
const DEFAULT_EMBED_TYPE = 'playlist';
const DEFAULT_EMBED_ID = '37FaZUuzyvDjT2RCKCZT41';

export default function SpotifyEmbed({
  embedType = DEFAULT_EMBED_TYPE,
  embedId = DEFAULT_EMBED_ID,
  height = 152, // compact player
}) {
  const { lang } = useLang();
  const tr = SPOTIFY_STR[lang] || SPOTIFY_STR.en;
  // theme=0 forces the embed's dark mode so it sits inside the matte Vault canvas.
  const src = `https://open.spotify.com/embed/${embedType}/${embedId}?utm_source=generator&theme=0`;

  return (
    <section className="bbf-spotify" data-testid="cardio-spotify">
      <div className="bbf-spotify__head">
        <span className="bbf-spotify__glyph" aria-hidden="true">
          {/* Geometric equalizer mark (gold, currentColor) — no emoji in the dossier */}
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
            <rect x="3" y="9" width="3" height="11" rx="1" />
            <rect x="8.5" y="4" width="3" height="16" rx="1" />
            <rect x="14" y="11" width="3" height="9" rx="1" />
            <rect x="19" y="6" width="3" height="14" rx="1" />
          </svg>
        </span>
        <div className="bbf-spotify__titles">
          <span className="bbf-spotify__kicker">{tr.kicker}</span>
          <span className="bbf-spotify__sub">{tr.sub}</span>
        </div>
      </div>
      <div className="bbf-spotify__frame">
        <iframe
          title={tr.title}
          src={src}
          width="100%"
          height={height}
          style={{ border: 0 }}
          loading="lazy"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
        />
      </div>
    </section>
  );
}
