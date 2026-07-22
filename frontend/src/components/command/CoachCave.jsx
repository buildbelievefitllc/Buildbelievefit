// src/components/command/CoachCave.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The Coach's Cave — a PRIVATE, admin-only sport-psychology & motivation film
// library inside the Sovereign Command Center.
//
// "Sharpen your iron." This is the founder's continuous-knowledge edge: a curated
// library of psychology / motivation films that keeps his coaching current as the
// exercise science evolves. It is sealed to the head coach — the entire /command
// route is AdminGuard-gated, so this surface NEVER renders for a client. (It is the
// gated, curated-video pattern of the Parents' Well-Being deck, scoped to one user.)
//
// Layout (premium "Laboratory Gold", §10 modular deck — no scroll bloat):
//   1. Hero        — private-vault chrome: lock chip, EN·ES·PT library switch,
//                    title, framing copy, and a 90 / 03 / EN·ES·PT stat strip.
//   2. Knowledge   — 3 numbered deck tabs (the subjects). Only the ACTIVE deck's
//      Decks         grid mounts; a per-deck filter narrows by title/channel.
//   3. Film cards  — branded tap-to-play covers that expand IN PLACE into a native
//                    YouTube player + a caption (deck · title · channel).
//
// The roster BRANCHES on the active LanguageContext (CAVE_LIBRARY[lang]) — flipping
// the in-Cave EN/ES/PT control swaps every deck to that language's native films,
// honoring BBF's structural trilingual mission. Data lives in coachCaveData.js.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import { CAVE_SUBJECTS, CAVE_LIBRARY, CAVE_L10N } from './coachCaveData.js';
import { embedURL, thumbURL } from '../vault/exerciseVideos.js';
import { PlayIcon, CloseIcon, LockIcon } from '../vault/icons.jsx';
import './coachCave.css';

const LANG_OPTIONS = [
  { code: 'en', label: 'EN' },
  { code: 'es', label: 'ES' },
  { code: 'pt', label: 'PT' },
];

export default function CoachCave() {
  // The global language drives the library; the in-Cave switch calls setLang so the
  // whole shell stays in lockstep. A guard keeps an unknown lang from blanking the
  // grid (falls back to EN — every deck always has an EN roster).
  const { lang, setLang } = useLang();
  const activeLang = CAVE_LIBRARY[lang] ? lang : 'en';
  const L = CAVE_L10N[activeLang] || CAVE_L10N.en;

  // Active knowledge deck (subject) — tracked by KEY so it survives a language flip
  // (keys are shared across languages). The per-deck text filter + the expanded
  // film both reset on a deck/lang change (the panel is keyed → clean remount).
  const [deckKey, setDeckKey] = useState(CAVE_SUBJECTS[0].key);
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState(null);
  const cardRefs = useRef(new Map());

  // Deep-link jump (from the Founder Assistant "Launch Coach's Cave Session"): a
  // one-shot { deck, id } hint left in localStorage preselects the deck + expands
  // the film. Consumed once, then cleared. setState is deferred to a microtask
  // (house set-state-in-effect rule).
  const jumped = useRef(false);
  useEffect(() => {
    if (jumped.current) return undefined;
    jumped.current = true;
    let hint = null;
    try {
      const raw = localStorage.getItem('bbf.cave.jump');
      if (raw) { hint = JSON.parse(raw); localStorage.removeItem('bbf.cave.jump'); }
    } catch { /* ignore — the Cave opens to its default deck */ }
    if (!hint || !hint.id) return undefined;
    queueMicrotask(() => {
      if (hint.deck && CAVE_SUBJECTS.some((s) => s.key === hint.deck)) setDeckKey(hint.deck);
      setOpenId(String(hint.id));
    });
    return undefined;
  }, []);

  const activeDeck = CAVE_SUBJECTS.find((s) => s.key === deckKey) || CAVE_SUBJECTS[0];
  // Memoized so its identity is stable per (language, deck) — keeps the filter
  // useMemo below from re-running every render (react-hooks/exhaustive-deps).
  const allFilms = useMemo(
    () => CAVE_LIBRARY[activeLang]?.[activeDeck.key] || [],
    [activeLang, activeDeck.key],
  );

  const q = query.trim().toLowerCase();
  const visible = useMemo(() => {
    if (!q) return allFilms;
    return allFilms.filter(
      (f) => f.title.toLowerCase().includes(q) || f.channel.toLowerCase().includes(q),
    );
  }, [allFilms, q]);

  // Honor the open id only while it lives in the active deck/language — a stale id
  // (after a deck or language swap) simply renders nothing open (idiomatic derive,
  // no reset-effect needed).
  const openFilmId = allFilms.some((f) => f.id === openId) ? openId : null;

  // Center the freshly expanded card. Deferred one frame so the inline player is
  // mounted/measured before scrolling; honors reduced-motion.
  useEffect(() => {
    if (!openFilmId) return undefined;
    const el = cardRefs.current.get(openFilmId);
    if (!el) return undefined;
    const reduce = typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;
    const raf = requestAnimationFrame(() => {
      try { el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' }); }
      catch { el.scrollIntoView(); }
    });
    return () => cancelAnimationFrame(raf);
  }, [openFilmId]);

  const selectDeck = (key) => { setDeckKey(key); setQuery(''); setOpenId(null); };
  const switchLang = (code) => { setLang(code); setOpenId(null); };

  const showing = L.showing
    .replace('{v}', String(visible.length))
    .replace('{t}', String(allFilms.length));

  return (
    <div className="cc" data-testid="coach-cave-module">
      {/* ── 1 · Hero — private-vault chrome ─────────────────────────────────── */}
      <section className="cc-hero">
        <div className="cc-hero-glow" aria-hidden="true" />
        <div className="cc-hero-row">
          <span className="cc-lockchip">
            <LockIcon size={11} /> {L.lockChip}
          </span>
          <div className="cc-langswitch" role="group" aria-label={L.langLabel}>
            {LANG_OPTIONS.map((o) => (
              <button
                key={o.code}
                type="button"
                className={`cc-langbtn${activeLang === o.code ? ' is-active' : ''}`}
                aria-pressed={activeLang === o.code}
                onClick={() => switchLang(o.code)}
                data-testid={`cc-lang-${o.code}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="cc-kicker">{L.kicker}</div>
        <h2 className="cc-title">{L.title}</h2>
        <p className="cc-sub">{L.sub}</p>

        <div className="cc-stats">
          <div className="cc-stat">
            <span className="cc-stat-num">90</span>
            <span className="cc-stat-lbl">{L.statFilms}</span>
          </div>
          <span className="cc-stat-div" aria-hidden="true" />
          <div className="cc-stat">
            <span className="cc-stat-num">03</span>
            <span className="cc-stat-lbl">{L.statDecks}</span>
          </div>
          <span className="cc-stat-div" aria-hidden="true" />
          <div className="cc-stat">
            <span className="cc-stat-num cc-stat-num--sm">EN·ES·PT</span>
            <span className="cc-stat-lbl">{L.statLangs}</span>
          </div>
        </div>
      </section>

      {/* ── 2 · Knowledge Decks (the subjects) ──────────────────────────────── */}
      <section className="cc-decks">
        <div className="cc-decks-kicker">{L.decksKicker}</div>
        <div className="cc-tabbar" role="tablist" aria-label={L.decksKicker}>
          {CAVE_SUBJECTS.map((s, i) => {
            const active = s.key === activeDeck.key;
            return (
              <button
                key={s.key}
                type="button"
                role="tab"
                aria-selected={active}
                className={`cc-tab${active ? ' is-active' : ''}`}
                onClick={() => selectDeck(s.key)}
                data-testid={`cc-deck-${s.key}`}
              >
                <span className="cc-tab-idx">0{i + 1}</span>
                <span className="cc-tab-label">{s.label[activeLang] || s.label.en}</span>
              </button>
            );
          })}
        </div>

        {/* Only the active deck's grid mounts — remounts on a deck/language swap. */}
        <div className="cc-panel" role="tabpanel" key={`${activeDeck.key}-${activeLang}`}>
          <p className="cc-blurb">{activeDeck.blurb[activeLang] || activeDeck.blurb.en}</p>

          <div className="cc-toolbar">
            <div className="cc-search">
              <svg className="cc-search-ic" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.2-3.2" strokeLinecap="round" />
              </svg>
              <input
                className="cc-search-input"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={L.searchPlaceholder}
                aria-label={L.searchAria}
                data-testid="cc-search"
              />
              {query ? (
                <button type="button" className="cc-search-clear" onClick={() => setQuery('')}>
                  {L.clear}
                </button>
              ) : null}
            </div>
            <div className="cc-count" aria-live="polite">{showing}</div>
          </div>

          {visible.length > 0 ? (
            <div className="cc-grid">
              {visible.map((film) => (
                <CaveFilmCard
                  key={film.id}
                  film={film}
                  deckLabel={activeDeck.label[activeLang] || activeDeck.label.en}
                  L={L}
                  open={film.id === openFilmId}
                  onOpen={() => setOpenId(film.id)}
                  onCollapse={() => setOpenId(null)}
                  cardRef={(el) => { if (el) cardRefs.current.set(film.id, el); else cardRefs.current.delete(film.id); }}
                />
              ))}
            </div>
          ) : (
            <p className="cc-empty" role="status">{L.noFilms}</p>
          )}
        </div>
      </section>
    </div>
  );
}

// ── Film card — branded tap-to-play cover that expands in place ────────────────
// Idle: a thumbnail cover with a gold play orb + a deck badge, over a title/channel
// strip. Tapped: swaps IN PLACE for the native YouTube iframe + a caption bar. Pure
// presentation; all state lives with the parent.
function CaveFilmCard({ film, deckLabel, L, open, onOpen, onCollapse, cardRef }) {
  return (
    <article
      ref={cardRef}
      className={`cc-card${open ? ' is-open' : ''}`}
      data-testid={`cc-film-${film.id}`}
    >
      {open ? (
        <div className="cc-card-open">
          <div className="cc-player">
            <iframe
              key={film.youtubeId}
              className="cc-player-iframe"
              src={embedURL(film.youtubeId)}
              title={film.title}
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          <div className="cc-card-cap">
            <div className="cc-card-cap-top">
              <span className="cc-card-deck">{deckLabel}</span>
              <button
                type="button"
                className="cc-card-close"
                onClick={onCollapse}
                aria-label={L.collapse}
              >
                <CloseIcon size={14} />
              </button>
            </div>
            <h4 className="cc-card-title">{film.title}</h4>
            <div className="cc-card-channel">
              <span className="cc-card-channel-lbl">{L.channelLabel}</span> {film.channel}
            </div>
            <p className="cc-player-note">
              <span aria-hidden="true">ⓘ</span> {L.playerNote}
            </p>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="cc-cover-btn"
          onClick={onOpen}
          data-testid={`cc-cover-${film.id}`}
          aria-label={`${film.title} — ${L.streamNow}`}
        >
          <span className="cc-cover">
            <img
              className="cc-cover-thumb"
              src={thumbURL(film.youtubeId)}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
            />
            <span className="cc-cover-shade" aria-hidden="true" />
            <span className="cc-cover-deck" aria-hidden="true">{deckLabel}</span>
            <span className="cc-cover-play" aria-hidden="true">
              <PlayIcon size={22} />
            </span>
          </span>
          <span className="cc-meta">
            <span className="cc-meta-title">{film.title}</span>
            <span className="cc-meta-foot">
              <span className="cc-meta-channel">{film.channel}</span>
              <span className="cc-meta-stream"><span aria-hidden="true">▷</span> {L.streamNow}</span>
            </span>
          </span>
        </button>
      )}
    </article>
  );
}
