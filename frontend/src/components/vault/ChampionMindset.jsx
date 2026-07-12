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
import { useAuth } from '../../context/AuthContext.jsx';
import ChampionFilmCard from './ChampionFilmCard.jsx';
import CognitiveFortitudeLibrary from './CognitiveFortitudeLibrary.jsx';
import SovereignPsychologyDeck from './SovereignPsychologyDeck.jsx';
import DailyAffirmationCoach from './DailyAffirmationCoach.jsx';
import { L10N, readLocked, writeLocked } from './championMindsetData.js';
import { isParent } from '../../lib/personalTouches.js';
import { PARENTS_WELLBEING, parentsBucket } from './parentsWellbeingData.js';
import TierGate from '../TierGate.jsx';
import LiveCheckinCoach from './LiveCheckinCoach.jsx';
import { GuideLauncher } from '../BbfMediaPortal.jsx';
import './championMindset.css';

export default function ChampionMindset() {
  // Active language drives the entire roster + chrome. A toggle re-renders this
  // component with a different L, instantly swapping every champion and string.
  const { lang } = useLang();
  const { user } = useAuth();
  const L = L10N[lang] || L10N.en;
  // "Parents' Well-Being" — a private educational health module appended ONLY for
  // the founder's parents (gated by login slug). For every other client the deck
  // is byte-for-byte unchanged.
  const parent = isParent(user?.username || user?.id || '');
  const champions = useMemo(
    () => (parent ? [...L.champions, ...PARENTS_WELLBEING] : L.champions),
    [L, parent],
  );
  const buckets = useMemo(
    () => (parent ? [...L.buckets, parentsBucket(lang)] : L.buckets),
    [L, parent, lang],
  );

  // Inline-expansion accordion state: the id of the currently EXPANDED champion
  // card — the only one streaming an in-card iframe — or null when the grid is at
  // rest. Nothing autoplays on load (mirrors the V8.7 tap-to-play covers). This
  // replaces the old detached-player "selectedId": the video now lives INSIDE the
  // tapped card, so there is no separate top-level player to scroll-hunt for.
  const [activeVideoId, setActiveVideoId] = useState(null);

  // Today's "locked-in" mindset (persisted, per-day, BY champion id — survives a
  // language toggle, so its badge re-appears whenever that roster is back in view).
  const [lockedToday, setLockedToday] = useState(() => readLocked());

  // Active category tab (§10 deck) — tracked by bucket KEY so the selection
  // survives a language toggle (keys are shared across languages); a key absent
  // in the active language (neuro-synapse is EN-only) falls back to the first tab.
  const [filterKey, setFilterKey] = useState(buckets[0]?.key || null);

  // Per-card DOM handles → smooth-scroll the freshly expanded card to viewport
  // center (this is what kills the mobile "scroll-hunting" the detached top-level
  // player used to cause).
  const cardRefs = useRef(new Map());

  // The active category bucket (resolved by key, first-tab fallback) and the
  // films inside it. Buckets partition the roster, so a tab is never empty.
  const activeBucket = buckets.find((b) => b.key === filterKey) || buckets[0];
  const visible = useMemo(() => {
    const ids = new Set(activeBucket.ids);
    return champions.filter((c) => ids.has(c.id));
  }, [champions, activeBucket]);

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
        {/* System guide — The Sovereign Frequency & Identity walkthrough. */}
        <GuideLauncher module="champion_mindset" testId="mindset-guide" />
      </section>

      {/* ── 1b · LIVE MINDSET CHECK-IN — Product 2 (Apex band). Real-time spoken
          accountability session with the Akeem persona (ConvAI 2.0 / WebRTC).
          Locked tiers see the upsell overlay (visibility-as-sales). ── */}
      <TierGate feature="mindset_live" featureLabel="Live Mindset Check-In" testId="mindset-live-gate">
        <LiveCheckinCoach mode="mindset" />
      </TierGate>

      {/* ── 2 · Affirmation row (Repositioning V-07): the voice-coached daily
          affirmation and the static Vault affirmation are sibling content — they
          share one responsive band instead of stacking two full-width banners. ── */}
      <div className="cm-affirm-row">
      <DailyAffirmationCoach />

      {/* ── 2b · Daily Vault Affirmation (static quote block) ─────────────── */}
      <section className="cm-affirm" aria-label={L.affirmLabel}>
        <div className="cm-affirm-orb" aria-hidden="true">✦</div>
        <div className="cm-affirm-lbl">{L.affirmLabel}</div>
        <blockquote className="cm-affirm-quote">&ldquo;{L.affirmation}&rdquo;</blockquote>
      </section>
      </div>

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

        {/* Category deck tabs — numbered 01/02/03, one active panel (LOCKED §10,
            mirrors the Mind Lab deck below). The buckets partition the roster. */}
        <div className="cm-deck-tabbar" role="tablist" aria-label={L.filterAria}>
          {buckets.map((b, i) => (
            <button
              key={b.key}
              type="button"
              role="tab"
              aria-selected={b.key === activeBucket.key}
              className={`cm-deck-tab${b.key === activeBucket.key ? ' is-active' : ''}`}
              onClick={() => setFilterKey(b.key)}
              data-testid={`cm-tab-${b.key}`}
            >
              <span className="cm-deck-tabidx">0{i + 1}</span>
              <span className="cm-deck-tablabel">{b.label}</span>
            </button>
          ))}
        </div>

        {/* Active category panel — only this bucket's grid mounts (remounts per
            category/language). Each film is a branded cover; tapping expands it IN
            PLACE for the inline YouTube iframe + that champion's Focus Objective. */}
        <div className="cm-deck-panel" role="tabpanel" key={`${activeBucket.key}-${lang}`}>
          <div className="cm-count" aria-live="polite">
            {L.showing(visible.length, champions.length)}
          </div>
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
            <p className="cm-deck-empty" role="status">{L.noFilmsTitle}</p>
          )}

          {/* Cognitive Fortitude Library — supplementary "more films" grid for
              this same bucket, hydrated from raw video data (no objective/
              dictums required). Renders null if the bucket has no library entry
              (e.g. the Parents' Well-Being bucket). */}
          <CognitiveFortitudeLibrary bucketKey={activeBucket.key} lang={lang} />
        </div>
      </section>

      {/* ── 3b · Sport Psychology Lab — evidence-based adherence film deck ──── */}
      <SovereignPsychologyDeck />

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
