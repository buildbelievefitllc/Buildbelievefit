// src/components/vault/ChampionMindset.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Champion's Mindset — Cognitive Conditioning module (client-facing Vault tab).
//
// A React reconstruction of the AI Studio "Champion's Mindset" prototype, now
// expanded into a Netflix-style "Premium Video Vault & Mind-Muscle
// Synchronization" surface: mental fortitude training, a daily valor
// affirmation, and a searchable/filterable "Championship Mindset Cinema" roster
// of motivational films. Four sections, faithful to the ground truth:
//   1. Hero          — Cognitive Fortitude pill + title + framing copy.
//   2. Affirmation   — the day's Daily Vault Affirmation quote block.
//   3. Cinema        — search + category-tag filters → a responsive film grid →
//                      a YouTube player + Focus Objective panel that both track
//                      the selected film.
//   4. Protocols     — the Focus Strategies / Visualization Drills split-pane.
//
// DYNAMIC REGIONAL ROSTER (Terminal India · trilingual mission): the entire
// module — affirmation, the cinema roster, category buckets, and the cognitive
// protocols — now BRANCHES on the active LanguageContext. Toggling EN · ES · PT
// instantly swaps the surface:
//   • EN — the Western canon (Kobe, Jordan, Goggins, Eric Thomas, Jocko, Arnold,
//          Serena, Courtney Dauwalter, Huberman). LOCKED data, byte-for-byte.
//   • ES — Spanish-speaking athletic icons (Canelo, Topuria, Nadal, Carolina
//          Marín, Messi, Pau Gasol) with native Spanish motivational content.
//   • PT — Brazilian / Lusophone icons (Ayrton Senna, Anderson Silva, Pelé,
//          Cristiano Ronaldo, Rebeca Andrade) with native Portuguese content.
// The `youtubeId` of every regional record is a real, verified motivational cut
// in that athlete's native language. The bucket KEYS are shared across languages
// so an active filter survives a language toggle; only the labels are localized.
//
// Selecting a champion locks the player + objective to that film; "Engage
// Obsession Cycle" advances through the films currently in view; "Lock In This
// Mindset Today" persists the day's pick to localStorage (per-day, mirroring
// MindsetEngine). Public to every authenticated client — mounted in ClientVault
// with no admin gate.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import ChampionFilmCard from './ChampionFilmCard.jsx';
import { L10N, readLocked, writeLocked } from './championMindsetData.js';
import './championMindset.css';

// The bucket labels a given champion belongs to (used for the card badge search
// surface and for tag-aware text matching). Buckets are passed in so the lookup
// tracks the active language's taxonomy.
function bucketsFor(id, buckets) {
  return buckets.filter((b) => b.ids.includes(id)).map((b) => b.label);
}

// Case-insensitive search across title, category badge, and tag labels.
function matchesQuery(champion, query, buckets) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [champion.title, champion.category, ...bucketsFor(champion.id, buckets)]
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

export default function ChampionMindset() {
  // Active language drives the entire roster + chrome. A toggle re-renders this
  // component with a different L, instantly swapping every champion and string.
  const { lang } = useLang();
  const L = L10N[lang] || L10N.en;
  const { champions, buckets } = L;

  // Inline-expansion accordion state: the id of the currently EXPANDED champion
  // card — the only one streaming an in-card iframe — or null when the grid is at
  // rest. Nothing autoplays on load (mirrors the V8.7 tap-to-play covers). This
  // replaces the old detached-player "selectedId": the video now lives INSIDE the
  // tapped card, so there is no separate top-level player to scroll-hunt for.
  const [activeVideoId, setActiveVideoId] = useState(null);

  // Today's "locked-in" mindset (persisted, per-day, BY champion id — survives a
  // language toggle, so its badge re-appears whenever that roster is back in view).
  const [lockedToday, setLockedToday] = useState(() => readLocked());

  // Search + category-tag filter state for the cinema grid. The bucket KEYS are
  // shared across languages, so an active filter survives a language toggle.
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  // Per-card DOM handles → smooth-scroll the freshly expanded card to viewport
  // center (this is what kills the mobile "scroll-hunting" the detached top-level
  // player used to cause).
  const cardRefs = useRef(new Map());

  // Films currently in view, after applying the active tag filter + search.
  const visible = useMemo(() => {
    const bucket = buckets.find((b) => b.key === filter);
    return champions.filter((c) => {
      const inBucket = !bucket || bucket.ids.includes(c.id);
      return inBucket && matchesQuery(c, query, buckets);
    });
  }, [champions, buckets, filter, query]);

  // A language switch swaps the entire roster wholesale, so a previously-open id
  // may not exist in the new one. Rather than reset state inside an effect, derive
  // the EFFECTIVE open id — honored only while it lives in the current roster; a
  // stale id simply renders nothing as open (and the scroll effect no-ops). This
  // is the idiomatic "you might not need an effect" path.
  const openId = champions.some((c) => c.id === activeVideoId) ? activeVideoId : null;

  // Center the active inline video on expansion. Deferred one frame so the
  // accordion panel is mounted/measured before we scroll; honors reduced-motion.
  useEffect(() => {
    if (!openId) return undefined;
    const el = cardRefs.current.get(openId);
    if (!el) return undefined;
    const reduce = typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;
    const raf = requestAnimationFrame(() => {
      try { el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' }); }
      catch { el.scrollIntoView(); }
    });
    return () => cancelAnimationFrame(raf);
  }, [openId]);

  // "Engage Obsession Cycle" — walk the expansion through the films in view
  // (opens the first when none is open), so the inline player advances the roster.
  const cycle = () => {
    const pool = visible.length ? visible : champions;
    const i = pool.findIndex((c) => c.id === openId);
    setActiveVideoId(pool[(i + 1) % pool.length].id);
  };

  const clearFilters = () => { setQuery(''); setFilter('all'); };

  // "Lock In This Mindset Today" — persist a champion as the day's mindset.
  const lockIn = (id) => { writeLocked(id); setLockedToday(id); };

  return (
    <div className="cm" data-testid="champion-mindset-module">
      {/* ── 1 · Hero ──────────────────────────────────────────────────────── */}
      <section className="cm-hero">
        <span className="cm-pill">{L.pill}</span>
        <h2 className="cm-title">
          <span className="cm-spark" aria-hidden="true">✦</span> {L.title}
        </h2>
        <p className="cm-sub">{L.sub}</p>
      </section>

      {/* ── 2 · Daily Vault Affirmation ───────────────────────────────────── */}
      <section className="cm-affirm" aria-label={L.affirmLabel}>
        <div className="cm-affirm-orb" aria-hidden="true">✦</div>
        <div className="cm-affirm-lbl">{L.affirmLabel}</div>
        <blockquote className="cm-affirm-quote">&ldquo;{L.affirmation}&rdquo;</blockquote>
      </section>

      {/* ── 3 · Championship Mindset Cinema ───────────────────────────────── */}
      <section className="cm-cinema">
        <div className="cm-cinema-head">
          <div>
            <div className="cm-kicker"><span aria-hidden="true">🏆</span> {L.cinemaKicker}</div>
            <h3 className="cm-cinema-title">{L.cinemaTitle}</h3>
          </div>
          <button type="button" className="cm-obsession" onClick={cycle}>
            <span aria-hidden="true">🔥</span> {L.obsession}
          </button>
        </div>

        {/* Search + category-tag filter toolbar */}
        <div className="cm-toolbar">
          <div className="cm-search">
            <span className="cm-search-ic" aria-hidden="true">⌕</span>
            <input
              type="search"
              className="cm-search-input"
              placeholder={L.searchPlaceholder}
              aria-label={L.searchAria}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="cm-filters" role="group" aria-label={L.filterAria}>
            <button
              type="button"
              className={`cm-chip${filter === 'all' ? ' is-active' : ''}`}
              aria-pressed={filter === 'all'}
              onClick={() => setFilter('all')}
            >
              {L.allFilms}
            </button>
            {buckets.map((b) => (
              <button
                key={b.key}
                type="button"
                className={`cm-chip${filter === b.key ? ' is-active' : ''}`}
                aria-pressed={filter === b.key}
                onClick={() => setFilter(b.key)}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        <div className="cm-count" aria-live="polite">
          {L.showing(visible.length, champions.length)}
        </div>

        {/* Cinema grid — INLINE-EXPANSION accordion. Each film is a branded V8.7
            cover (purple/gold gradient + gold play SVG, identical to the Program
            & Prehab tabs); tapping swaps it IN PLACE for the native YouTube
            iframe + that champion's Focus Objective, spanning the full row and
            pushing the rest of the roster down. No detached top-level player. */}
        {visible.length > 0 ? (
          <div className="cm-grid">
            {visible.map((c) => (
              <ChampionFilmCard
                key={c.id}
                champion={c}
                L={L}
                open={c.id === openId}
                locked={lockedToday === c.id}
                onOpen={() => setActiveVideoId(c.id)}
                onCollapse={() => setActiveVideoId(null)}
                onLockIn={() => lockIn(c.id)}
                cardRef={(el) => { if (el) cardRefs.current.set(c.id, el); else cardRefs.current.delete(c.id); }}
              />
            ))}
          </div>
        ) : (
          <div className="cm-empty" role="status">
            <p className="cm-empty-title">{L.noFilmsTitle}</p>
            <p className="cm-empty-sub">{L.noFilmsSub}</p>
            <button type="button" className="cm-empty-clear" onClick={clearFilters}>
              {L.clearFilters}
            </button>
          </div>
        )}
      </section>

      {/* ── 4 · Cognitive Action Protocols (split-pane) ───────────────────── */}
      <section className="cm-protocols">
        <div className="cm-pane">
          <div className="cm-pane-head">
            <span className="cm-pane-ic cm-pane-ic--focus" aria-hidden="true">⚡</span>
            <div>
              <h4 className="cm-pane-title">{L.focusTitle}</h4>
              <div className="cm-pane-sub">{L.focusSub}</div>
            </div>
          </div>
          <ul className="cm-list">
            {L.focusStrategies.map((s, i) => (
              <li className="cm-list-item cm-list-item--focus" key={i}>
                <span className="cm-bullet cm-bullet--focus" aria-hidden="true" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="cm-pane">
          <div className="cm-pane-head">
            <span className="cm-pane-ic cm-pane-ic--viz" aria-hidden="true">👁</span>
            <div>
              <h4 className="cm-pane-title">{L.vizTitle}</h4>
              <div className="cm-pane-sub">{L.vizSub}</div>
            </div>
          </div>
          <ul className="cm-list">
            {L.visualizationDrills.map((s, i) => (
              <li className="cm-list-item cm-list-item--viz" key={i}>
                <span className="cm-bullet cm-bullet--viz" aria-hidden="true" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
