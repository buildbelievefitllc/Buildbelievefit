// src/components/command/CoachVideoLibrary.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Coach Lab · Broadcast Hub — THE LECTURE HALL.
//
// A curated, sectioned study library of 100 exercise-science lecture videos
// (bundled coachLabVideoLibrary.json, 5 categories × 20). Built for the founder
// to actually LEARN from: filter by discipline, search by title, watch inline
// (privacy-enhanced youtube-nocookie embed), and mark each lecture watched — a
// per-video progress tracker (localStorage) so a 100-lecture curriculum can be
// worked through methodically.
//
// Zero backend: the library is static reference data (YouTube links), exactly
// like the Research Library's evidence grid. No DB, no edge function.

import { useMemo, useRef, useState } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import library from '../../data/coachLabVideoLibrary.json';

const WATCHED_KEY = 'bbf_lecture_hall_watched_v1';
const VIDEOS = library.videos || [];
const CATEGORIES = library.categories || [];

const LH_L10N = {
  en: {
    intro: 'Your private lecture hall — 100 curated exercise-science videos, sectioned by discipline. Filter, watch inline, and mark each one done as you work through the curriculum.',
    all: 'All', search: 'Search lectures…',
    watched: 'watched', of: 'of', progress: 'Progress',
    markWatched: 'Mark watched', markUnwatched: 'Watched ✓',
    nowPlaying: 'Now playing', watchOnYt: 'Open on YouTube ↗',
    empty: 'No lectures match your search.', pickHint: 'Pick a lecture to start studying.',
  },
  es: {
    intro: 'Tu sala de conferencias privada — 100 videos de ciencia del ejercicio, seccionados por disciplina. Filtra, mira en línea y marca cada uno mientras avanzas en el plan.',
    all: 'Todos', search: 'Buscar conferencias…',
    watched: 'vistos', of: 'de', progress: 'Progreso',
    markWatched: 'Marcar visto', markUnwatched: 'Visto ✓',
    nowPlaying: 'Reproduciendo', watchOnYt: 'Abrir en YouTube ↗',
    empty: 'Ninguna conferencia coincide con tu búsqueda.', pickHint: 'Elige una conferencia para empezar a estudiar.',
  },
  pt: {
    intro: 'Seu auditório privado — 100 vídeos de ciência do exercício, divididos por disciplina. Filtre, assista embutido e marque cada um enquanto avança no currículo.',
    all: 'Todos', search: 'Buscar aulas…',
    watched: 'assistidos', of: 'de', progress: 'Progresso',
    markWatched: 'Marcar assistido', markUnwatched: 'Assistido ✓',
    nowPlaying: 'Assistindo', watchOnYt: 'Abrir no YouTube ↗',
    empty: 'Nenhuma aula corresponde à sua busca.', pickHint: 'Escolha uma aula para começar a estudar.',
  },
};

function readWatched() {
  try {
    const raw = localStorage.getItem(WATCHED_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch { return new Set(); }
}

export default function CoachVideoLibrary() {
  const { lang } = useLang();
  const L = LH_L10N[lang] || LH_L10N.en;

  const [cat, setCat] = useState('all');
  const [query, setQuery] = useState('');
  const [playing, setPlaying] = useState(null);      // the selected video object
  const [watched, setWatched] = useState(readWatched);
  const playerRef = useRef(null);

  const catLabel = useMemo(() => {
    const m = { all: L.all };
    for (const c of CATEGORIES) m[c.key] = c.label;
    return m;
  }, [L.all]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return VIDEOS.filter((v) =>
      (cat === 'all' || v.category === cat) &&
      (!q || v.title.toLowerCase().includes(q)));
  }, [cat, query]);

  const persist = (set) => {
    try { localStorage.setItem(WATCHED_KEY, JSON.stringify([...set])); } catch { /* quota / private mode */ }
  };
  const toggleWatched = (id) => setWatched((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    persist(n);
    return n;
  });

  const play = (v) => {
    setPlaying(v);
    // scroll the player into view so a click from deep in the grid surfaces it
    requestAnimationFrame(() => playerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const totalWatched = watched.size;
  const catCount = (key) => VIDEOS.filter((v) => v.category === key).length;
  const catWatched = (key) => VIDEOS.filter((v) => v.category === key && watched.has(v.id)).length;

  return (
    <div className="lh" data-testid="lecture-hall">
      <p className="cl-intro">{L.intro}</p>

      {/* progress rail */}
      <div className="lh-progress" data-testid="lh-progress">
        <span className="lh-progress-lbl">{L.progress}</span>
        <div className="lh-progress-bar" role="progressbar" aria-valuenow={totalWatched} aria-valuemin={0} aria-valuemax={VIDEOS.length}>
          <div className="lh-progress-fill" style={{ width: `${(totalWatched / VIDEOS.length) * 100}%` }} />
        </div>
        <span className="lh-progress-num"><strong>{totalWatched}</strong> {L.of} {VIDEOS.length} {L.watched}</span>
      </div>

      {/* the inline player (once a lecture is picked) */}
      <div ref={playerRef}>
        {playing ? (
          <div className="lh-player" data-testid="lh-player">
            <div className="lh-player-frame">
              <iframe
                key={playing.videoId}
                src={`https://www.youtube-nocookie.com/embed/${playing.videoId}?rel=0`}
                title={playing.title}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                data-testid="lh-player-iframe"
              />
            </div>
            <div className="lh-player-meta">
              <span className="lh-player-kicker">{L.nowPlaying} · {catLabel[playing.category]}</span>
              <h4 className="lh-player-title">{playing.title}</h4>
              <div className="lh-player-actions">
                <button
                  type="button"
                  className={`kl-btn${watched.has(playing.id) ? ' kl-btn--gold' : ''}`}
                  onClick={() => toggleWatched(playing.id)}
                  data-testid="lh-player-watched"
                >
                  {watched.has(playing.id) ? L.markUnwatched : L.markWatched}
                </button>
                <a className="kl-btn" href={playing.url} target="_blank" rel="noopener noreferrer">{L.watchOnYt}</a>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* category pills */}
      <div className="lh-cats" role="tablist" aria-label="lecture categories">
        <button type="button" role="tab" aria-selected={cat === 'all'} className={`lh-cat${cat === 'all' ? ' is-active' : ''}`} onClick={() => setCat('all')} data-testid="lh-cat-all">
          {L.all} <span className="lh-cat-count">{totalWatched}/{VIDEOS.length}</span>
        </button>
        {CATEGORIES.map((c) => (
          <button key={c.key} type="button" role="tab" aria-selected={cat === c.key} className={`lh-cat${cat === c.key ? ' is-active' : ''}`} onClick={() => setCat(c.key)} data-testid={`lh-cat-${c.key}`}>
            <span aria-hidden="true">{c.emoji}</span> {c.label} <span className="lh-cat-count">{catWatched(c.key)}/{catCount(c.key)}</span>
          </button>
        ))}
      </div>

      <input
        className="bc-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={L.search}
        aria-label={L.search}
        data-testid="lh-search"
      />

      {/* the lecture grid */}
      {filtered.length === 0 ? (
        <p className="cl-muted" role="status">{L.empty}</p>
      ) : (
        <div className="lh-grid" data-testid="lh-grid">
          {filtered.map((v) => {
            const done = watched.has(v.id);
            const on = playing?.id === v.id;
            return (
              <div key={v.id} className={`lh-card${on ? ' is-playing' : ''}${done ? ' is-done' : ''}`} data-testid={`lh-card-${v.id}`}>
                <button type="button" className="lh-card-thumb" onClick={() => play(v)} aria-label={v.title} data-testid={`lh-play-${v.id}`}>
                  <img src={`https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`} alt="" loading="lazy" />
                  <span className="lh-card-dur">{v.duration}</span>
                  <span className="lh-card-play" aria-hidden="true">▶</span>
                  {done ? <span className="lh-card-doneflag" aria-hidden="true">✓</span> : null}
                </button>
                <div className="lh-card-body">
                  <span className="lh-card-cat">{catLabel[v.category]}</span>
                  <h5 className="lh-card-title">{v.title}</h5>
                  <button
                    type="button"
                    className={`lh-card-watch${done ? ' is-done' : ''}`}
                    onClick={() => toggleWatched(v.id)}
                    data-testid={`lh-watch-${v.id}`}
                  >
                    {done ? L.markUnwatched : L.markWatched}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
