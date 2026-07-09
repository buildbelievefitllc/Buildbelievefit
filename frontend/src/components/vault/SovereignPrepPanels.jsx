// src/components/vault/SovereignPrepPanels.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Shared renderer for the 3-Phase Sovereign Prep sequence — the tab DECK + active
// panel (CLAUDE.md §10: only the active panel mounts). Used by BOTH surfaces:
//   • SovereignPrepOverlay  — the modal launched from the Active Directive button.
//   • Recovery (vault tab)  — the dedicated full Recovery section.
//
//   Phase 1 · Tissue Release       → foam_rolling       (capped 2)
//   Phase 2 · Static Elongation    → recovery_stretches (capped 3)
//   Phase 3 · Dynamic Potentiation → prep_drills        (capped 4)
//
// Closed-loop (CEO order): all three phases are now weighted to the SAME focus the
// edge resolves — the athlete's reported friction zone (targeted) or, with no
// actionable friction, TODAY's program muscles (maintenance). emphasis_flag === true
// items get a gold ring + "Essential" tag and arrive sorted to the top by the edge.

import { useEffect, useState } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import { recoveryVideosFor } from '../../data/recoveryVideos.js';
import CoachAudioButton from './CoachAudioButton.jsx';
import { cueToText } from './coachNarrative.js';
import { fetchSectionCoachAudio } from '../../lib/forecastApi.js';

// Privacy-enhanced (no-cookie) embed — built ONLY inside the pop-up modal, so
// nothing streams (not even a thumbnail request) while the card sits collapsed.
// `autoplay` distinguishes the two entry points: WATCH presses play immediately,
// PREVIEW opens the same mini player paused on the athlete's own YouTube controls.
function ytEmbedModal(id, autoplay) {
  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=${autoplay ? 1 : 0}&rel=0&modestbranding=1&playsinline=1`;
}

// CEO accessibility reorder: equipment-free movements LEAD; foam rolling (needs a
// roller) is last and flagged Optional, so a user without equipment is never blocked
// at Step 01. Display order + idx only — the edge data keys are unchanged.
// `cap` mirrors the edge function's strict clinical limits (CEO order): the UI
// NEVER renders more than 4 dynamic / 3 static / 2 release, even if an override
// library or a stale cached envelope slips through more.
const PREP_PHASES = [
  { id: 'dynamic', idx: '01', key: 'prep_drills',        cap: 4, labelKey: 'sp-phase3', subKey: 'sp-phase3-sub' },
  { id: 'static',  idx: '02', key: 'recovery_stretches', cap: 3, labelKey: 'sp-phase2', subKey: 'sp-phase2-sub' },
  { id: 'release', idx: '03', key: 'foam_rolling',       cap: 2, labelKey: 'sp-phase1', subKey: 'sp-phase1-sub', optional: true },
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

// In-app mini-player pop-up — same proven pattern as the Recovery Prescription
// card's demo modal (PrescriptionMoveModal): a backdrop + centered player, Esc
// and backdrop-click both close it, background scroll locks while open. Nothing
// streams until the athlete explicitly opens it.
function PrepVideoModal({ videoId, title, autoplay, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  return (
    <div className="sp-modal-backdrop" role="dialog" aria-modal="true" aria-label={title} onClick={onClose} data-testid="sp-video-modal">
      <div className="sp-modal" onClick={(e) => e.stopPropagation()}>
        <header className="sp-modal-head">
          <span className="sp-modal-title">{title}</span>
          <button type="button" className="sp-modal-x" onClick={onClose} aria-label="Close" data-testid="sp-video-modal-close">✕</button>
        </header>
        <div className="sp-modal-video">
          <iframe
            key={`${videoId}-${autoplay ? 1 : 0}`}
            className="sp-modal-frame"
            src={ytEmbedModal(videoId, autoplay)}
            title={title}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
}

// COLLAPSED demo row — the zero-bloat replacement for the always-mounted inline
// thumbnail: a slim bar (title + WATCH / PREVIEW) that opens the mini player
// pop-up ONLY on tap. WATCH presses play immediately; PREVIEW opens the same
// player paused so the athlete can peek the form cue before committing. Nothing
// (not even a thumbnail image) renders until one of the two is pressed — a phase
// can hold 26 cards with zero permanent video weight. Current language, EN fallback.
function PrepVideo({ id, lang, t }) {
  const [modal, setModal] = useState(null); // null | { autoplay: boolean }
  const vids = recoveryVideosFor(id, lang);
  if (!vids.length) return null;
  const v = vids[0];
  return (
    <>
      <div className="sp-video-row" data-testid="sp-video-row">
        <span className="sp-video-label">
          <span className="sp-video-ic" aria-hidden="true">🎬</span>
          {t('sp-video-label')}
        </span>
        <span className="sp-video-actions">
          <button
            type="button"
            className="sp-video-preview"
            onClick={() => setModal({ autoplay: false })}
            data-testid="sp-preview"
          >
            {t('sp-preview')}
          </button>
          <button
            type="button"
            className="sp-video-watch"
            onClick={() => setModal({ autoplay: true })}
            data-testid="sp-watch"
          >
            ▶ {t('sp-watch')}
          </button>
        </span>
      </div>
      {modal ? (
        <PrepVideoModal
          videoId={v.id}
          title={v.t}
          autoplay={modal.autoplay}
          onClose={() => setModal(null)}
        />
      ) : null}
    </>
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
  // Defensive UI cap — the edge already enforces the clinical limits; this guarantees
  // the UI can never render past them regardless of payload source.
  const all = data && Array.isArray(data[activePhase.key]) ? data[activePhase.key] : [];
  const items = all.slice(0, activePhase.cap);

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
