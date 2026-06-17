// src/components/vault/ChampionFilmCard.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Champion film card — the single inline-expansion accordion card, extracted so
// BOTH the full Champion Mindset cinema grid AND the slimmed MindsetIntercept
// render the EXACT same `.cm-vcard` structure (one markup, zero drift).
//
// Idle, it's a branded V8.7 cover (gradient + gold play SVG) over a champion
// identity strip; tapped, it swaps IN PLACE for the native YouTube iframe + that
// champion's Focus Objective (message, dictums, lock-in), spanning its row. Pure
// presentation — all state (open / locked) and persistence live with the parent,
// passed down as props so the card is reusable on either surface.
//
//   champion   — one roster record { id, category, title, youtubeId, objective,
//                dictums[], lockIn? }
//   L          — the active-language chrome strings (L10N[lang]) for every label
//   open       — is this card expanded into the inline player?
//   locked     — is this champion the day's locked-in mindset?
//   onOpen     — tap the cover (expand + stream)
//   onCollapse — close the inline player
//   onLockIn   — persist this champion as today's mindset
//   cardRef    — optional ref callback on the <article> (grid scroll-into-view)

import { embedURL, thumbURL } from './exerciseVideos.js';
import { PlayIcon, CloseIcon } from './icons.jsx';

export default function ChampionFilmCard({
  champion: c,
  L,
  open,
  locked,
  onOpen,
  onCollapse,
  onLockIn,
  cardRef,
}) {
  return (
    <article
      ref={cardRef}
      className={`cm-vcard${open ? ' is-open' : ''}`}
      data-testid={`cm-film-${c.id}`}
    >
      {open ? (
        <div className="cm-vcard-open">
          {/* Inline native YouTube player — only mounts on tap */}
          <div className="cm-player-frame">
            <iframe
              key={c.youtubeId}
              className="cm-player-iframe"
              src={embedURL(c.youtubeId)}
              title={c.title}
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>

          {/* Focus Objective — folded into the card so the message,
              dictums and lock-in travel WITH the video (no hunting). */}
          <div className="cm-vcard-obj">
            <div className="cm-obj-lbl">
              <span className="cm-obj-ic" aria-hidden="true">▶</span> {L.focusObjective}
              <button
                type="button"
                className="cm-vcard-collapse"
                onClick={onCollapse}
                aria-label={L.collapse}
              >
                <CloseIcon size={15} />
              </button>
            </div>
            <h4 className="cm-obj-title">{c.title}</h4>
            <p className="cm-obj-desc">{c.objective}</p>

            <div className="cm-obj-dictums-lbl">{L.dictumsLabel}</div>
            <ul className="cm-dictums">
              {c.dictums.map((d, i) => (
                <li className="cm-dictum" key={i}>
                  <span className="cm-dictum-arrow" aria-hidden="true">›</span>
                  <span className="cm-dictum-txt">&ldquo;{d}&rdquo;</span>
                </li>
              ))}
            </ul>

            <button
              type="button"
              className={`cm-lockin${locked ? ' is-locked' : ''}`}
              aria-pressed={locked}
              onClick={onLockIn}
            >
              <span aria-hidden="true">{locked ? '✓' : '⚡'}</span>{' '}
              {locked ? L.lockedBtn : (c.lockIn || L.lockInBtn)}
            </button>

            <p className="cm-player-note">
              <span aria-hidden="true">ⓘ</span> {L.playerNote}
            </p>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="cm-vfilm"
          data-testid={`cm-film-cover-${c.id}`}
          onClick={onOpen}
          aria-label={`${c.title} — ${L.streamNow}`}
        >
          {/* Pure V8.7 branded cover — gradient + centered gold play
              SVG, byte-identical to the Program & Prehab tabs. */}
          <span className="cm-vfilm-cover bbf-video-cover">
            <img
              className="cm-vfilm-thumb"
              src={thumbURL(c.youtubeId)}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
            />
            <span className="bbf-video-overlay" aria-hidden="true">
              <span className="bbf-video-play"><PlayIcon size={26} /></span>
            </span>
          </span>
          {/* Champion identity strip below the cover */}
          <span className="cm-vfilm-meta">
            <span className="cm-vcard-cat">{c.category}</span>
            <span className="cm-vcard-title">{c.title}</span>
            <span className="cm-vcard-foot">
              <span className="cm-vcard-stream"><span aria-hidden="true">▷</span> {L.streamNow}</span>
              {locked ? <span className="cm-vcard-locked"><span aria-hidden="true">✓</span> {L.locked}</span> : null}
            </span>
          </span>
        </button>
      )}
    </article>
  );
}
