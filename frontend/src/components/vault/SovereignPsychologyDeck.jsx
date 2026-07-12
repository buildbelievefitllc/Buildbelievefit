// src/components/vault/SovereignPsychologyDeck.jsx
// ─────────────────────────────────────────────────────────────────────────────
// SOVEREIGN PSYCHOLOGY DECK — the evidence-based sport-psychology film library for
// the adult Vault's Champion's Mindset tab. Sister surface to the curated champion
// cinema (ChampionMindset): where the cinema is motivational icon film, this is the
// SCIENCE — self-determination, flow state, mental-resilience, and (as of the 4th
// topic below) guided-meditation CNS-restoration education that keeps an athlete
// adherent when motivation fades.
//
// DATA · src/data/championsPsychology.json — keyed topic → language → [{title,url}]
//   (135 verified, distinct trilingual videos: 10/language across the first three
//   topics, 15/language for Guided Meditation & CNS Restoration). Topic KEYS are
//   the stable English source strings; their LABELS localize in-component.
//
// UI · the LOCKED modular tab-deck (CLAUDE.md §10): a numbered 01/02/03/04 tab bar
//   over a SINGLE active panel — only the active topic's grid mounts (kills scroll
//   weight); the bar flex-wraps on narrow viewports so a 4th tab never overflows
//   the container edge. Trilingual: the active LanguageContext drives both the
//   topic labels and the video list. A card's thumbnail opens an embedded YouTube
//   lightbox (deep-link fallback).

import { useMemo, useState } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import PSYCH from '../../data/championsPsychology.json';
import VideoLightbox from './VideoLightbox.jsx';
import './psychologyDeck.css';

const LANG_TO_KEY = { en: 'English', es: 'Spanish', pt: 'Portuguese' };

// Stable source topic keys → numbered, trilingual tab labels. Order is the deck order.
const TOPICS = [
  {
    key: 'Self-Determination & Intrinsic Motivation',
    label: { en: 'Intrinsic Motivation', es: 'Motivación Intrínseca', pt: 'Motivação Intrínseca' },
    tag: { en: 'Self-Determination', es: 'Autodeterminación', pt: 'Autodeterminação' },
  },
  {
    key: 'Mind-Muscle Connection & Flow State',
    label: { en: 'Mind-Muscle & Flow', es: 'Mente-Músculo y Flujo', pt: 'Mente-Músculo e Flow' },
    tag: { en: 'Flow State', es: 'Estado de Flujo', pt: 'Estado de Flow' },
  },
  {
    key: 'Overcoming Subconscious Resistance & Mental Fatigue',
    label: { en: 'Mental Resilience', es: 'Resiliencia Mental', pt: 'Resiliência Mental' },
    tag: { en: 'Anti-Fatigue', es: 'Anti-Fatiga', pt: 'Antifadiga' },
  },
  {
    key: 'Guided Meditation & CNS Restoration',
    label: { en: 'Guided Meditation', es: 'Meditación Guiada', pt: 'Meditação Guiada' },
    tag: { en: 'CNS Restoration', es: 'Restauración del SNC', pt: 'Restauração do SNC' },
  },
];

const L10N = {
  en: {
    kicker: 'Sport Psychology · Adherence Engine',
    title: 'The Mind Lab',
    sub: 'Evidence-based sport-psychology film — self-determination, flow, and mental resilience — to keep you training when motivation runs dry.',
    count: (n) => `${n} ${n === 1 ? 'film' : 'films'}`,
    watch: 'Watch', close: 'Close', youtube: 'Watch on YouTube',
    empty: 'No films available yet for this topic.',
  },
  es: {
    kicker: 'Psicología Deportiva · Motor de Adherencia',
    title: 'El Laboratorio Mental',
    sub: 'Cine de psicología deportiva basado en evidencia — autodeterminación, flujo y resiliencia mental — para seguir entrenando cuando la motivación se agota.',
    count: (n) => `${n} ${n === 1 ? 'vídeo' : 'vídeos'}`,
    watch: 'Ver', close: 'Cerrar', youtube: 'Ver en YouTube',
    empty: 'Aún no hay vídeos para este tema.',
  },
  pt: {
    kicker: 'Psicologia do Esporte · Motor de Aderência',
    title: 'O Laboratório Mental',
    sub: 'Cinema de psicologia do esporte baseado em evidências — autodeterminação, flow e resiliência mental — para continuar treinando quando a motivação acaba.',
    count: (n) => `${n} ${n === 1 ? 'vídeo' : 'vídeos'}`,
    watch: 'Assistir', close: 'Fechar', youtube: 'Assistir no YouTube',
    empty: 'Ainda não há vídeos para este tema.',
  },
};

// ── YouTube URL helpers (payload carries full watch URLs) ────────────────────
function ytId(url) {
  const s = String(url || '');
  const m = s.match(/[?&]v=([A-Za-z0-9_-]{11})/)
    || s.match(/youtu\.be\/([A-Za-z0-9_-]{11})/)
    || s.match(/\/embed\/([A-Za-z0-9_-]{11})/)
    || s.match(/\/shorts\/([A-Za-z0-9_-]{11})/);
  return m ? m[1] : '';
}
const ytThumb = (id) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;

export default function SovereignPsychologyDeck() {
  const { lang } = useLang();
  const L = L10N[lang] || L10N.en;
  const langKey = LANG_TO_KEY[lang] || 'English';

  const [activeIdx, setActiveIdx] = useState(0);
  const activeTopic = TOPICS[activeIdx] || TOPICS[0];

  // Active topic + language slice → distinct, parseable films (English fallback).
  const films = useMemo(() => {
    const byTopic = PSYCH[activeTopic.key] || {};
    const list = byTopic[langKey] || byTopic.English || [];
    const seen = new Set();
    return list
      .map((f) => ({ ...f, id: ytId(f.url) }))
      .filter((f) => {
        if (!f.id || seen.has(f.id)) return false;
        seen.add(f.id);
        return true;
      });
  }, [activeTopic, langKey]);

  const [openVideo, setOpenVideo] = useState(null);

  return (
    <section className="spsy" data-testid="sovereign-psychology-deck">
      <div className="spsy-head">
        <div className="spsy-kicker"><span aria-hidden="true">🧠</span> {L.kicker}</div>
        <h3 className="spsy-title">{L.title}</h3>
        <p className="spsy-sub">{L.sub}</p>
      </div>

      {/* §10 deck tab bar — numbered 01/02/03, purple→gold active */}
      <div className="spsy-tabbar" role="tablist" aria-label={L.kicker}>
        {TOPICS.map((tab, i) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={i === activeIdx}
            className={`spsy-tab${i === activeIdx ? ' is-active' : ''}`}
            onClick={() => setActiveIdx(i)}
            data-testid={`spsy-tab-${i}`}
          >
            <span className="spsy-tabidx">0{i + 1}</span>
            <span className="spsy-tablabel">{tab.label[lang] || tab.label.en}</span>
            <span className="spsy-tabtag">{tab.tag[lang] || tab.tag.en}</span>
          </button>
        ))}
      </div>

      {/* Active panel — only this topic's grid mounts (remounts per topic/language) */}
      <div className="spsy-panel" role="tabpanel" key={`${activeTopic.key}-${langKey}`}>
        <p className="spsy-count" aria-live="polite">{L.count(films.length)}</p>
        {films.length ? (
          <div className="spsy-grid">
            {films.map((f, i) => (
              <button
                key={`${f.id}-${i}`}
                type="button"
                className="spsy-card"
                onClick={() => setOpenVideo({ id: f.id, title: f.title })}
                data-testid="spsy-card"
                aria-label={`${f.title} — ${L.watch}`}
              >
                <span className="spsy-thumb">
                  <img src={ytThumb(f.id)} alt="" loading="lazy" referrerPolicy="no-referrer" />
                  <span className="spsy-thumb-ov" aria-hidden="true"><span className="spsy-thumb-play">▶</span></span>
                  {/* Duration is optional per-topic data (only Guided Meditation
                      carries it today) — the badge simply omits itself when absent. */}
                  {f.duration ? <span className="spsy-thumb-dur">{f.duration}</span> : null}
                </span>
                <span className="spsy-cardmeta">
                  <span className="spsy-cardtitle">{f.title}</span>
                  <span className="spsy-cardcta">▷ {L.watch}</span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="spsy-empty">{L.empty}</p>
        )}
      </div>

      {openVideo ? (
        <VideoLightbox
          video={openVideo}
          onClose={() => setOpenVideo(null)}
          closeLabel={L.close}
          ytLabel={L.youtube}
        />
      ) : null}
    </section>
  );
}
