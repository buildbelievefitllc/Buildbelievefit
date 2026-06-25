// src/components/vault/SovereignPrepPanels.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Shared renderer for the 3-Phase Sovereign Prep sequence — the tab DECK + active
// panel (CLAUDE.md §10: only the active panel mounts). Used by BOTH surfaces:
//   • SovereignPrepOverlay  — the modal launched from the Active Directive button.
//   • Recovery (vault tab)  — the dedicated full Recovery section.
//
//   Phase 1 · Tissue Release       → foam_rolling      (no emphasis)
//   Phase 2 · Static Elongation    → recovery_stretches (emphasis = yesterday)
//   Phase 3 · Dynamic Potentiation → prep_drills        (emphasis = today)
//
// emphasis_flag === true items get a gold ring + "Essential" tag and arrive sorted
// to the top of their phase by the edge function.

import { useState } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import { recoveryVideosFor } from '../../data/recoveryVideos.js';
import { thumbURL } from './exerciseVideos.js';
import { PlayIcon } from './icons.jsx';
import CoachAudioButton from './CoachAudioButton.jsx';
import { cueToText } from './coachNarrative.js';
import { fetchSectionCoachAudio } from '../../lib/forecastApi.js';

// Privacy-enhanced (no-cookie) autoplay embed — built ONLY after the athlete taps
// the branded cover, so nothing streams on initial render (same as Prehab/Program).
function ytEmbedAutoplay(id) {
  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`;
}

// CEO accessibility reorder: equipment-free movements LEAD; foam rolling (needs a
// roller) is last and flagged Optional, so a user without equipment is never blocked
// at Step 01. Display order + idx only — the edge data keys are unchanged.
const PREP_PHASES = [
  { id: 'dynamic', idx: '01', key: 'prep_drills',        labelKey: 'sp-phase3', subKey: 'sp-phase3-sub' },
  { id: 'static',  idx: '02', key: 'recovery_stretches', labelKey: 'sp-phase2', subKey: 'sp-phase2-sub' },
  { id: 'release', idx: '03', key: 'foam_rolling',       labelKey: 'sp-phase1', subKey: 'sp-phase1-sub', optional: true },
];

// "Optional" badge on the equipment-dependent phase (trilingual; the rest of the
// deck chrome resolves through the dictionary).
const OPTIONAL_LABEL = { en: 'Optional', es: 'Opcional', pt: 'Opcional' };

// Phase-specific prescription line — each library family carries a different shape.
function Prescription({ phaseId, prescription, t }) {
  const p = prescription || {};
  if (phaseId === 'static') {
    const seg = (k, lbl) => (p[k] != null ? <span className="sp-rx-seg" key={k}><em>{lbl}</em> {p[k]}s</span> : null);
    return <div className="sp-rx">{seg('light', t('sp-hold-light'))}{seg('standard', t('sp-hold-standard'))}{seg('deep', t('sp-hold-deep'))}</div>;
  }
  if (phaseId === 'dynamic') {
    return (
      <div className="sp-rx">
        {p.reps ? <span className="sp-rx-seg"><em>{t('sp-reps')}</em> {p.reps}</span> : null}
        {p.tempo ? <span className="sp-rx-seg"><em>{t('sp-tempo')}</em> {p.tempo}</span> : null}
      </div>
    );
  }
  return (
    <div className="sp-rx">
      {p.passes ? <span className="sp-rx-seg"><em>{t('sp-passes')}</em> {p.passes}</span> : null}
      {p.dwell ? <span className="sp-rx-seg"><em>{t('sp-dwell')}</em> {p.dwell}</span> : null}
      {p.timing ? <span className="sp-rx-seg"><em>{t('sp-timing')}</em> {p.timing}</span> : null}
    </div>
  );
}

function groupLabel(g) {
  return String(g || '').split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// In-app mini-player — same branded pattern as Program / Prehab: a thumbnail
// cover with a purple/gold press-play button that swaps to an autoplay embed ON
// TAP (nothing streams on render; a phase can hold 26 cards). Stays in-app — never
// sends the athlete out to YouTube. Current language, EN fallback.
function PrepVideo({ id, lang, t }) {
  const [playing, setPlaying] = useState(false);
  const vids = recoveryVideosFor(id, lang);
  if (!vids.length) return null;
  const v = vids[0];
  if (playing) {
    return (
      <div className="sp-player is-playing">
        <iframe
          key={v.id}
          className="sp-player-frame"
          src={ytEmbedAutoplay(v.id)}
          title={v.t}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>
    );
  }
  return (
    <button
      type="button"
      className="sp-player bbf-video-cover"
      onClick={() => setPlaying(true)}
      aria-label={t('sp-watch')}
      data-testid="sp-watch"
    >
      <img className="sp-player-thumb" src={thumbURL(v.id)} alt="" loading="lazy" referrerPolicy="no-referrer" />
      <span className="bbf-video-overlay" aria-hidden="true">
        <span className="bbf-video-play"><PlayIcon size={24} /></span>
      </span>
    </button>
  );
}

function PrepCard({ item, phaseId, lang, t }) {
  const emphasis = item.emphasis_flag === true;
  const cues = item.cues || {};
  const cueText = cueToText(cues);
  return (
    <li className={`sp-card${emphasis ? ' is-essential' : ''}`} data-testid="sp-card">
      <div className="sp-card-head">
        <div className="sp-card-titles">
          <span className="sp-card-name">{item.name}</span>
          <span className="sp-card-meta">{groupLabel(item.muscle_group)}{item.tool ? ` · ${groupLabel(item.tool)}` : ''}</span>
        </div>
        {emphasis ? <span className="sp-tag" data-testid="sp-essential-tag">{t('sp-essential')}</span> : null}
      </div>
      <Prescription phaseId={phaseId} prescription={item.prescription} t={t} />
      <dl className="sp-cues">
        {cues.breathing ? <div className="sp-cue"><dt>{t('sp-cue-breathing')}</dt><dd>{cues.breathing}</dd></div> : null}
        {cues.form ? <div className="sp-cue"><dt>{t('sp-cue-form')}</dt><dd>{cues.form}</dd></div> : null}
        {cues.intensity ? <div className="sp-cue"><dt>{t('sp-cue-intensity')}</dt><dd>{cues.intensity}</dd></div> : null}
      </dl>
      {cueText ? (
        <CoachAudioButton
          audioRequest={() => fetchSectionCoachAudio({ context: 'recovery', cueRef: `recovery:${item.id}`, cueText, locale: lang })}
          fallbackText={cueText}
        />
      ) : null}
      <PrepVideo id={item.id} lang={lang} t={t} />
    </li>
  );
}

export default function SovereignPrepPanels({ data }) {
  const { t, lang } = useLang();
  const [active, setActive] = useState('dynamic');

  const activePhase = PREP_PHASES.find((p) => p.id === active) || PREP_PHASES[0];
  const items = data && Array.isArray(data[activePhase.key]) ? data[activePhase.key] : [];

  return (
    <>
      <div className="sp-tabs" role="tablist" aria-label={t('sp-title')}>
        {PREP_PHASES.map((p) => {
          const on = p.id === active;
          return (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={on}
              className={`sp-tab${on ? ' is-active' : ''}`}
              onClick={() => setActive(p.id)}
              data-testid={`sp-tab-${p.id}`}
            >
              <span className="sp-tab-idx">{p.idx}</span>
              <span className="sp-tab-text">
                <span className="sp-tab-label">
                  {t(p.labelKey)}
                  {p.optional ? <span className="sp-tab-opt">{OPTIONAL_LABEL[lang] || OPTIONAL_LABEL.en}</span> : null}
                </span>
                <span className="sp-tab-sub">{t(p.subKey)}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="sp-panel" role="tabpanel">
        {items.length ? (
          <ul className="sp-list">
            {items.map((it) => <PrepCard key={it.id} item={it} phaseId={activePhase.id} lang={lang} t={t} />)}
          </ul>
        ) : (
          <p className="sp-empty">{t('sp-empty')}</p>
        )}
      </div>
    </>
  );
}
