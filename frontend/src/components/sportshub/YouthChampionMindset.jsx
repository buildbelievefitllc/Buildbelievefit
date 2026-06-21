// src/components/sportshub/YouthChampionMindset.jsx
// ─────────────────────────────────────────────────────────────────────────────
// YOUTH CHAMPION MINDSET — the psychological-conditioning deck for the BBF Athlete
// Portal (Sports Hub). Sister surface to the adult Vault's ChampionMindset, tuned
// for youth athletes: a sport- and language-aware roster of championship-mindset
// films, framed by the Architect's spoken welcome.
//
// PHASE 1 · DATA INGESTION & FILTERING
//   The payload (src/data/mindset_videos.json) is keyed by sport → language →
//   [{ title, url }]. We read the athlete's SPORT from global state (the resolved
//   sportId passed by SportsHub, or user.sportsProfile.sportId) and LANGUAGE from
//   LanguageContext (seeded at login from preferred_language). The list auto-filters
//   to that sport+language; an unmapped sport falls back to the canonical
//   "Multi-Sport (General Athlete Mindset)" category.
//
// PHASE 2 · UI/UX
//   Sovereign Vault dark-mode aesthetic + the LOCKED modular tab-deck design system
//   (CLAUDE.md §10): a numbered 01/02 tab bar — "Your Sport" + "General Mindset" —
//   over a single active panel of film cards. A card's clickable thumbnail opens an
//   embedded YouTube modal (with a deep-link "Watch on YouTube" fallback).
//
// PHASE 3 · THE ARCHITECT VOICE OVERRIDE (State D)
//   On mount we set the psychological tone with the Architect's spoken welcome.
//   ARCHITECTURE NOTE: the literal bbf-weekly-brief-scenario-engine is GET-only,
//   telemetry-driven (accepts no hardcoded text) and gated behind voice_coach
//   (AUTO_BAND) — which EXCLUDES youth tiers (→ 403). The correct path that delivers
//   the SAME intent — the ARCHITECT (State D) vocal state speaking our verbatim
//   payload, and entitled for YOUTH — is bbf-biokinetic-briefing with
//   context:'affirmation': it returns cue_text verbatim, maps to the architect vocal
//   state (_shared/bbf-voice-engine.ts), and gates on `mindset` = BASE_BAND (incl.
//   YOUTH). Same transport DailyAffirmationCoach already uses. Best-effort autoplay
//   on mount (browser autoplay policy may defer it to one tap); degrades to the
//   device stock voice, with the directive always visible as transcript.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLang } from '../../context/LangContext.jsx';
import { fetchSectionCoachAudio } from '../../lib/forecastApi.js';
import { speakWithBrowser, warmUpSpeech, browserSpeechSupported } from '../../lib/speechFallback.js';
import MINDSET_VIDEOS from '../../data/mindset_videos.json';
import './youthChampionMindset.css';

// ── Filtering taxonomy ───────────────────────────────────────────────────────
// Athlete sportId (sportsData / youthSports) → mindset_videos.json category key.
const GENERAL_CATEGORY = 'Multi-Sport (General Athlete Mindset)';
const SPORT_TO_CATEGORY = {
  football: 'American Football',
  soccer: 'Soccer',
  volleyball: 'Volleyball',
  basketball: 'Basketball',
  baseball: 'Baseball',
  softball: 'Softball',
  track: 'Track & Field',
  multi: 'Combat Sports', // the Combat/Multi node maps to the combat-sports roster
};
const SPORT_LABEL_KEY = {
  football: 'yi-sport-football', basketball: 'yi-sport-basketball', soccer: 'yi-sport-soccer',
  baseball: 'yi-sport-baseball', volleyball: 'yi-sport-volleyball', track: 'yi-sport-track',
  softball: 'yi-sport-softball', multi: 'yi-sport-multi',
};
const LANG_TO_KEY = { en: 'English', es: 'Spanish', pt: 'Portuguese' };

// Resolve a sport+language slice with safe fallbacks (sport → general; language → English).
function videosFor(category, langKey) {
  const cat = MINDSET_VIDEOS[category] ? category : GENERAL_CATEGORY;
  const byCat = MINDSET_VIDEOS[cat] || {};
  return byCat[langKey] || byCat.English || MINDSET_VIDEOS[GENERAL_CATEGORY]?.[langKey] || [];
}

// ── YouTube URL helpers (the payload carries full watch URLs, not bare ids) ──
function ytId(url) {
  const s = String(url || '');
  const m = s.match(/[?&]v=([A-Za-z0-9_-]{11})/)
    || s.match(/youtu\.be\/([A-Za-z0-9_-]{11})/)
    || s.match(/\/embed\/([A-Za-z0-9_-]{11})/);
  return m ? m[1] : '';
}
const ytThumb = (id) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
const ytWatch = (id) => `https://www.youtube.com/watch?v=${id}`;
// Stripped chrome: no related videos (rel=0), minimal branding, no title/uploader
// overlay (showinfo=0), fullscreen allowed (fs=1). autoplay/playsinline keep the
// modal's tap-to-open behavior on mobile.
const ytEmbed = (id) => `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&showinfo=0&fs=1&playsinline=1`;

// ── Trilingual chrome (component-local; trilingual is structural, CLAUDE.md) ──
const L10N = {
  en: {
    kicker: 'Champion Mindset · Cognitive Conditioning',
    titleA: 'Champion', titleB: 'Mindset',
    sub: 'The body is just the vessel. The mind is the engine. Lock in to championship film — picked for your sport and your language — and train the mental game that wins on the field.',
    tabSport: 'Your Sport', tabGeneral: 'General Mindset',
    tagSport: 'Your Sport', tagGeneral: 'All Athletes',
    count: (n) => `${n} ${n === 1 ? 'film' : 'films'}`,
    watch: 'Watch', close: 'Close', youtube: 'Watch on YouTube',
    empty: 'No films available yet for this selection.',
  },
  es: {
    kicker: 'Mentalidad de Campeón · Acondicionamiento Cognitivo',
    titleA: 'Mentalidad de', titleB: 'Campeón',
    sub: 'El cuerpo es solo el vehículo. La mente es el motor. Conéctate con el cine de campeones — elegido para tu deporte y tu idioma — y entrena el juego mental que gana en el campo.',
    tabSport: 'Tu Deporte', tabGeneral: 'Mentalidad General',
    tagSport: 'Tu Deporte', tagGeneral: 'Todos los Atletas',
    count: (n) => `${n} ${n === 1 ? 'vídeo' : 'vídeos'}`,
    watch: 'Ver', close: 'Cerrar', youtube: 'Ver en YouTube',
    empty: 'Aún no hay vídeos para esta selección.',
  },
  pt: {
    kicker: 'Mentalidade de Campeão · Condicionamento Cognitivo',
    titleA: 'Mentalidade de', titleB: 'Campeão',
    sub: 'O corpo é apenas o veículo. A mente é o motor. Conecte-se ao cinema dos campeões — escolhido para o seu esporte e o seu idioma — e treine o jogo mental que vence em campo.',
    tabSport: 'Seu Esporte', tabGeneral: 'Mentalidade Geral',
    tagSport: 'Seu Esporte', tagGeneral: 'Todos os Atletas',
    count: (n) => `${n} ${n === 1 ? 'vídeo' : 'vídeos'}`,
    watch: 'Assistir', close: 'Fechar', youtube: 'Assistir no YouTube',
    empty: 'Ainda não há vídeos para esta seleção.',
  },
};

// The Architect's welcome (State D). EN is the CEO-supplied verbatim payload;
// ES/PT are faithful translations so the cue lands in-language (trilingual mandate).
const ARCH_L10N = {
  en: {
    kicker: 'The Architect', state: 'State D',
    text: 'Welcome to the Champion Mindset... The body is just the vessel... but the mind is the engine. You cannot dominate on the field if you lose the battle in your head. Lock in... absorb the data... and break out of the box.',
    play: 'Play the Architect’s Welcome', pause: 'Pause the Architect', cueing: 'Cueing the Architect…',
    err: 'Architect audio is unavailable — read the directive below.',
  },
  es: {
    kicker: 'El Arquitecto', state: 'State D',
    text: 'Bienvenido a la Mentalidad de Campeón... El cuerpo es solo el vehículo... pero la mente es el motor. No puedes dominar en el campo si pierdes la batalla en tu cabeza. Concéntrate... absorbe los datos... y rompe el molde.',
    play: 'Reproducir el Saludo del Arquitecto', pause: 'Pausar al Arquitecto', cueing: 'Preparando al Arquitecto…',
    err: 'El audio del Arquitecto no está disponible — lee la directiva abajo.',
  },
  pt: {
    kicker: 'O Arquiteto', state: 'State D',
    text: 'Bem-vindo à Mentalidade de Campeão... O corpo é apenas o veículo... mas a mente é o motor. Você não pode dominar em campo se perder a batalha dentro da sua cabeça. Concentre-se... absorva os dados... e quebre a caixa.',
    play: 'Ouvir a Saudação do Arquiteto', pause: 'Pausar o Arquiteto', cueing: 'Preparando o Arquiteto…',
    err: 'O áudio do Arquiteto está indisponível — leia a diretiva abaixo.',
  },
};

// ── Architect's Welcome — State D voice cue, best-effort autoplay on mount ─────
function ArchitectIntro({ lang }) {
  const L = ARCH_L10N[lang] || ARCH_L10N.en;
  const text = L.text;
  const audioRef = useRef(null);
  const stockRef = useRef(null); // active stock-voice controller (failure fallback)
  const [url, setUrl] = useState(null);
  const [playing, setPlaying] = useState(false);
  // `busy` seeds true (we always fetch on mount) so we never setState synchronously
  // in the effect body (house rule: react-hooks/set-state-in-effect). The parent
  // key-remounts this on a language toggle, which re-seeds busy + re-fires the cue.
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState(false);

  // Fetch the Architect (State D) cue for the active language and try to play it
  // immediately. Autoplay-with-sound is often blocked without a gesture — that's
  // fine, the cue stays one tap away. State is mutated ONLY inside async callbacks.
  useEffect(() => {
    let cancelled = false;
    fetchSectionCoachAudio({ context: 'affirmation', cueRef: `youth-champion-architect-intro-${lang}`, cueText: text, locale: lang })
      .then((u) => {
        if (cancelled) { URL.revokeObjectURL(u); return; }
        setUrl(u);
        requestAnimationFrame(() => { audioRef.current?.play().catch(() => { /* autoplay deferred to a tap */ }); });
      })
      .catch(() => { if (!cancelled) setErr(true); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [lang, text]);

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  useEffect(() => () => { if (stockRef.current) { try { stockRef.current.stop(); } catch { /* noop */ } } }, []);

  async function onToggle() {
    const el = audioRef.current;
    if (url && el) { if (playing) el.pause(); else el.play().catch(() => setErr(true)); return; }
    if (stockRef.current) { try { stockRef.current.stop(); } catch { /* noop */ } stockRef.current = null; setPlaying(false); return; }

    // No premium clip ready (autoplay path errored or still loading) — unlock
    // speechSynthesis inside this gesture, retry the premium path, then degrade.
    warmUpSpeech();
    setBusy(true);
    setErr(false);
    try {
      const u = await fetchSectionCoachAudio({ context: 'affirmation', cueRef: `youth-champion-architect-intro-${lang}`, cueText: text, locale: lang });
      setUrl(u);
      requestAnimationFrame(() => { audioRef.current?.play().catch(() => setErr(true)); });
    } catch {
      if (browserSpeechSupported()) {
        try {
          stockRef.current = await speakWithBrowser({
            text, lang,
            onEnd: () => { setPlaying(false); stockRef.current = null; },
            onError: () => { setErr(true); setPlaying(false); stockRef.current = null; },
          });
          setPlaying(true);
        } catch { setErr(true); }
      } else {
        setErr(true);
      }
    } finally {
      setBusy(false);
    }
  }

  const label = busy ? L.cueing : playing ? L.pause : L.play;
  return (
    <section className="ycm-arch" data-testid="ycm-architect">
      <div className="ycm-arch-top">
        <span className="ycm-arch-mic" aria-hidden="true">🎙️</span>
        <span className="ycm-arch-kicker">{L.kicker}</span>
        <span className="ycm-arch-state">{L.state}</span>
      </div>
      <div className="ycm-arch-body">
        <button
          type="button"
          className={`ycm-arch-btn${playing ? ' is-playing' : ''}`}
          onClick={onToggle}
          disabled={busy}
          data-testid="ycm-architect-play"
          aria-label={label}
        >
          <span aria-hidden="true">{busy ? '◌' : playing ? '❚❚' : '►'}</span>
          <span>{label}</span>
          <span className="ycm-arch-eq" aria-hidden="true"><span /><span /><span /><span /></span>
        </button>
        <blockquote className="ycm-arch-quote">&ldquo;{text}&rdquo;</blockquote>
      </div>
      {err ? <p className="ycm-arch-err" role="status">{L.err}</p> : null}
      <audio
        ref={audioRef}
        src={url || undefined}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => { if (url) setErr(true); }}
        preload="none"
      />
    </section>
  );
}

// ── Embedded YouTube modal (lightbox) ────────────────────────────────────────
function VideoModal({ video, onClose, closeLabel, ytLabel }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; };
  }, [onClose]);

  return (
    <div className="ycm-modal" role="dialog" aria-modal="true" aria-label={video.title} onClick={onClose} data-testid="ycm-modal">
      <div className="ycm-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="ycm-modal-bar">
          <p className="ycm-modal-title">{video.title}</p>
          <button type="button" className="ycm-modal-close" onClick={onClose} aria-label={closeLabel}>✕</button>
        </div>
        <div className="ycm-modal-frame">
          <iframe
            src={ytEmbed(video.id)}
            title={video.title}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        <div className="ycm-modal-foot">
          <a className="ycm-modal-yt" href={ytWatch(video.id)} target="_blank" rel="noreferrer noopener">{ytLabel} ↗</a>
        </div>
      </div>
    </div>
  );
}

// `sportId` is the athlete's resolved discipline, passed by SportsHub (which honors
// the intake selection); we fall back to the auth profile, then to the General
// roster — so the deck always renders something on mission.
export default function YouthChampionMindset({ sportId = null }) {
  const { user } = useAuth();
  const { lang, t } = useLang();
  const L = L10N[lang] || L10N.en;
  const langKey = LANG_TO_KEY[lang] || 'English';

  const resolvedSportId = sportId || user?.sportsProfile?.sportId || '';
  const sportCategory = SPORT_TO_CATEGORY[resolvedSportId] && MINDSET_VIDEOS[SPORT_TO_CATEGORY[resolvedSportId]]
    ? SPORT_TO_CATEGORY[resolvedSportId]
    : GENERAL_CATEGORY;

  // Tabs (§10 deck): "01 Your Sport" + "02 General Mindset". When the athlete's
  // sport already IS the general roster (unmapped sport), collapse to a single tab.
  const tabs = useMemo(() => {
    const labelKey = SPORT_LABEL_KEY[resolvedSportId];
    const sportLabel = labelKey ? t(labelKey) : L.tabSport;
    const general = { key: 'general', category: GENERAL_CATEGORY, label: L.tabGeneral, tag: L.tagGeneral };
    if (sportCategory === GENERAL_CATEGORY) return [general];
    return [{ key: 'sport', category: sportCategory, label: sportLabel, tag: L.tagSport }, general];
  }, [resolvedSportId, sportCategory, t, L]);

  // Strict state-driven tab-deck (§10): ONE panel mounts at a time. String-keyed
  // ('sport' | 'general'); resolve to an index, falling back to the first tab when the
  // keyed tab isn't present (an unmapped sport collapses the deck to a single tab).
  const [activeTab, setActiveTab] = useState('sport');
  const activeIdx = Math.max(0, tabs.findIndex((tb) => tb.key === activeTab));
  const activeCategory = tabs[activeIdx].category;

  const films = useMemo(
    () => videosFor(activeCategory, langKey)
      .map((f) => ({ ...f, id: ytId(f.url) }))
      .filter((f) => f.id),
    [activeCategory, langKey],
  );

  const [openVideo, setOpenVideo] = useState(null);

  return (
    <section className="ycm" data-testid="youth-champion-mindset">
      <div className="ycm-frame">
        <div className="ycm-inner">
          <div className="ycm-head">
            <div className="ycm-kicker"><span aria-hidden="true">🧠</span> {L.kicker}</div>
            <h2 className="ycm-title">{L.titleA} <span>{L.titleB}</span></h2>
            <p className="ycm-sub">{L.sub}</p>
          </div>

          {/* Phase 3 — Architect (State D) spoken welcome, fired on mount.
              key={lang} re-mounts (and re-cues) the welcome on a language toggle. */}
          <ArchitectIntro key={lang} lang={lang} />

          {/* Phase 2 — deck tab bar */}
          <div className="ycm-tabbar" role="tablist" aria-label={L.kicker}>
            {tabs.map((tab, i) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={i === activeIdx}
                className={`ycm-tab${i === activeIdx ? ' is-active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
                data-testid={`ycm-tab-${tab.key}`}
              >
                <span className="ycm-tabidx">0{i + 1}</span>
                <span className="ycm-tablabel">{tab.label}</span>
                <span className="ycm-tabtag">{tab.tag}</span>
              </button>
            ))}
          </div>

          {/* Active panel — remounts per tab/language so the surface refreshes cleanly */}
          <div className="ycm-panel" role="tabpanel" key={`${activeCategory}-${langKey}`}>
            <p className="ycm-count" aria-live="polite">{L.count(films.length)}</p>
            {films.length ? (
              <div className="ycm-grid">
                {films.map((f, i) => (
                  <button
                    key={`${f.id}-${i}`}
                    type="button"
                    className="ycm-card"
                    onClick={() => setOpenVideo({ id: f.id, title: f.title })}
                    data-testid="ycm-card"
                    aria-label={`${f.title} — ${L.watch}`}
                  >
                    <span className="ycm-thumb">
                      <img src={ytThumb(f.id)} alt="" loading="lazy" referrerPolicy="no-referrer" />
                      <span className="ycm-thumb-ov" aria-hidden="true">
                        <span className="ycm-thumb-play">▶</span>
                      </span>
                    </span>
                    <span className="ycm-cardmeta">
                      <span className="ycm-cardtitle">{f.title}</span>
                      <span className="ycm-cardcta">▷ {L.watch}</span>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="ycm-empty">{L.empty}</p>
            )}
          </div>
        </div>
      </div>

      {openVideo ? (
        <VideoModal
          video={openVideo}
          onClose={() => setOpenVideo(null)}
          closeLabel={L.close}
          ytLabel={L.youtube}
        />
      ) : null}
    </section>
  );
}
