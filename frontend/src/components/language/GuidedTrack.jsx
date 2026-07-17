// src/components/language/GuidedTrack.jsx
// ─────────────────────────────────────────────────────────────────────────────
// THE GUIDED TRACK — the Curriculum Engine's daily dose, rendered as a single
// horizontal clinical checklist strip at the top of the Language Lab hub.
//
// Shows the active day ("DAY 14") + the five dose items (Vocab Cards · Syntax
// Rule · Video Vault review · Echo Chamber rep · Grammar Clinic session) with
// live counters fed by logModuleProgress from the modules themselves — the
// athlete just USES the tools and the track fills. Completing all five stamps
// the server unlock flag; the strip flips to the gold "Day N+1 unlocked" state.
//
// SEQUENCE MAPPER BINDING: the Video Vault item is not generic — it names the
// day's ASSIGNED lesson (Day N → chronological index N−1, per language) and
// clicking it routes straight to that lesson in the Vault (onOpenVault).
//
// FREE ROAM by design: nothing below is ever locked — the strip is telemetry,
// not a gate — and the collapse chevron tucks it away entirely for pure
// free-roam sessions (persisted, so the preference survives refreshes).
//
// Degrades to null when the curriculum RPC is unavailable (no session / harness
// mounts) so it can never break the lab around it.

import { useState } from 'react';
import { useLanguageLab } from './LanguageLabContext.jsx';
import { useLang } from '../../context/LangContext.jsx';
import { getAssignedVideo } from './sequenceMapper.js';
import './language.css';

const COLLAPSE_KEY = 'bbf_lab_track_collapsed';

const GT_STR = {
  en: {
    kicker: 'Guided Track · Curriculum Engine',
    day: (n) => `Day ${n}`,
    items: { vocab: 'Vocab Cards', syntax: 'Syntax Rule', video: 'Video Vault', shadow: 'Echo Chamber', clinic: 'Grammar Clinic' },
    review: 'Review:',
    complete: (n) => `Day ${n - 1} complete — Day ${n} unlocked.`,
    freeRoam: 'The modular tools below stay open — the track fills as you train.',
    collapse: 'Hide track', expand: 'Show track',
  },
  es: {
    kicker: 'Ruta Guiada · Motor de Currículo',
    day: (n) => `Día ${n}`,
    items: { vocab: 'Tarjetas de Vocabulario', syntax: 'Regla de Sintaxis', video: 'Bóveda de Video', shadow: 'Cámara de Eco', clinic: 'Clínica Gramatical' },
    review: 'Repaso:',
    complete: (n) => `Día ${n - 1} completo — Día ${n} desbloqueado.`,
    freeRoam: 'Las herramientas modulares siguen abiertas — la ruta se llena mientras entrenas.',
    collapse: 'Ocultar ruta', expand: 'Mostrar ruta',
  },
  pt: {
    kicker: 'Trilha Guiada · Motor de Currículo',
    day: (n) => `Dia ${n}`,
    items: { vocab: 'Cartões de Vocabulário', syntax: 'Regra de Sintaxe', video: 'Cofre de Vídeo', shadow: 'Câmara de Eco', clinic: 'Clínica de Gramática' },
    review: 'Revisão:',
    complete: (n) => `Dia ${n - 1} completo — Dia ${n} desbloqueado.`,
    freeRoam: 'As ferramentas modulares continuam abertas — a trilha se preenche enquanto você treina.',
    collapse: 'Ocultar trilha', expand: 'Mostrar trilha',
  },
};

function readCollapsed() {
  try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
}

const ITEM_ORDER = ['vocab', 'syntax', 'video', 'shadow', 'clinic'];

export default function GuidedTrack({ onOpenVault }) {
  const { lang } = useLang();
  const { target, curriculum } = useLanguageLab();
  const tr = GT_STR[lang] || GT_STR.en;
  const [collapsed, setCollapsed] = useState(readCollapsed);

  // No session / RPC unreachable → the lab stays a pure free-roam toolset.
  if (!curriculum.ready) return null;

  // Sequence Mapper: the day's assigned Video Vault lesson for this language.
  const assignedVideo = getAssignedVideo(target, curriculum.day);

  const toggle = () => {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0'); } catch { /* quota */ }
      return next;
    });
  };

  const { day, requirements, progress, justUnlocked } = curriculum;
  const totalReq = ITEM_ORDER.reduce((n, k) => n + requirements[k], 0);
  const totalDone = ITEM_ORDER.reduce((n, k) => n + Math.min(progress[k], requirements[k]), 0);
  const pct = totalReq > 0 ? Math.round((totalDone / totalReq) * 100) : 0;

  return (
    <section className={`gt-shell${justUnlocked ? ' is-unlocked' : ''}`} data-testid="guided-track" aria-label={tr.kicker}>
      <div className="gt-head">
        <div className="gt-head-main">
          <span className="gt-kicker">{tr.kicker}</span>
          <span className="gt-day" data-testid="gt-day">{tr.day(day)}</span>
        </div>
        <button type="button" className="gt-collapse" onClick={toggle} aria-expanded={!collapsed}>
          {collapsed ? `▸ ${tr.expand}` : `▾ ${tr.collapse}`}
        </button>
      </div>

      {!collapsed ? (
        <>
          {justUnlocked ? (
            <div className="gt-unlocked" role="status" data-testid="gt-unlocked">✓ {tr.complete(day)}</div>
          ) : null}

          <div className="gt-items" role="list">
            {ITEM_ORDER.map((k) => {
              const req = requirements[k];
              const done = Math.min(progress[k], req);
              const isDone = done >= req;
              // The video item carries its Sequence-Mapper assignment: the day's
              // specific lesson title, click-through into the Vault.
              if (k === 'video' && assignedVideo) {
                return (
                  <button
                    key={k}
                    type="button"
                    className={`gt-item gt-item--assigned${isDone ? ' is-done' : ''}`}
                    role="listitem"
                    data-testid="gt-item-video"
                    onClick={onOpenVault}
                    title={`${tr.items.video} — ${assignedVideo.title}`}
                  >
                    <span className="gt-item-mark" aria-hidden="true">{isDone ? '✓' : ''}</span>
                    <span className="gt-item-label">{tr.review} {assignedVideo.title}</span>
                    <span className="gt-item-count">{done}/{req}</span>
                  </button>
                );
              }
              return (
                <div key={k} className={`gt-item${isDone ? ' is-done' : ''}`} role="listitem" data-testid={`gt-item-${k}`}>
                  <span className="gt-item-mark" aria-hidden="true">{isDone ? '✓' : ''}</span>
                  <span className="gt-item-label">{req} × {tr.items[k]}</span>
                  <span className="gt-item-count">{done}/{req}</span>
                </div>
              );
            })}
          </div>

          <div className="gt-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="gt-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="gt-free-note">{tr.freeRoam}</div>
        </>
      ) : null}
    </section>
  );
}
