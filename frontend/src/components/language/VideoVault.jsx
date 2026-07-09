// src/components/language/VideoVault.jsx
// ─────────────────────────────────────────────────────────────────────────────
// VIDEO VAULT — the Guided Track's daily immersion-media review, promoted into
// the Language Lab as its own mode. Sources the chronologically structured
// lesson payload (languageVideoLibrary.json) through the SEQUENCE MAPPER, so
// the list order IS the curriculum order and the day's ASSIGNED lesson (Day N →
// index N−1, per language) renders as the featured card at the top.
//
// "Mark reviewed" is the checklist hook: it bumps the curriculum 'video' dose
// counter (logModuleProgress) — reviewing the assigned lesson clears the day's
// Video Vault item and helps unlock Day N+1. Free roam holds: every lesson in
// the library stays watchable and markable, not just the assigned one.

import { useMemo, useState } from 'react';
import { useLanguageLab } from './LanguageLabContext.jsx';
import { useLang } from '../../context/LangContext.jsx';
import { getVideoSequence, getAssignedVideo } from './sequenceMapper.js';
import './language.css';

const VV_STR = {
  en: { kicker: 'Video Vault · Immersion Media', title: 'Curated native input', sub: 'One assigned lesson a day — no subtitles when you can hold it. Mark it reviewed to clear the track item.', assigned: (n) => `Today's assignment · Day ${n}`, watch: '▶ Watch', mark: 'Mark reviewed', marked: '✓ Reviewed', library: 'Full sequence', empty: 'The vault for this language is still being curated.' },
  es: { kicker: 'Bóveda de Video · Medios de Inmersión', title: 'Contenido nativo curado', sub: 'Una lección asignada al día — sin subtítulos cuando puedas sostenerlo. Márcala como revisada para completar el punto de la ruta.', assigned: (n) => `Lección de hoy · Día ${n}`, watch: '▶ Ver', mark: 'Marcar revisado', marked: '✓ Revisado', library: 'Secuencia completa', empty: 'La bóveda para este idioma aún se está curando.' },
  pt: { kicker: 'Cofre de Vídeo · Mídia de Imersão', title: 'Conteúdo nativo curado', sub: 'Uma lição designada por dia — sem legendas quando conseguir sustentar. Marque como revisada para completar o item da trilha.', assigned: (n) => `Lição de hoje · Dia ${n}`, watch: '▶ Assistir', mark: 'Marcar revisado', marked: '✓ Revisado', library: 'Sequência completa', empty: 'O cofre para este idioma ainda está sendo curado.' },
};

export default function VideoVault({ language = 'es' }) {
  const { lang } = useLang();
  const { curriculum, logModuleProgress } = useLanguageLab();
  const tr = VV_STR[lang] || VV_STR.en;
  const [reviewed, setReviewed] = useState(() => new Set());
  const [busyId, setBusyId] = useState(null);

  const sequence = useMemo(() => getVideoSequence(language), [language]);
  // The day's assigned lesson (Sequence Mapper) — only when the track is live.
  const assigned = curriculum.ready ? getAssignedVideo(language, curriculum.day) : null;
  const rest = assigned ? sequence.filter((v) => v.id !== assigned.id) : sequence;

  async function markReviewed(id) {
    if (reviewed.has(id) || busyId) return;
    setBusyId(id);
    await logModuleProgress('video', 1);
    setBusyId(null);
    setReviewed((s) => new Set(s).add(id));
  }

  const row = (v, featured = false) => {
    const done = reviewed.has(v.id);
    return (
      <div
        key={v.id}
        id={`vv-${v.id}`}
        className={`vv-row${done ? ' is-reviewed' : ''}${featured ? ' is-assigned' : ''}`}
        data-testid={featured ? 'vv-assigned' : 'vv-row'}
      >
        <div className="vv-meta">
          {featured ? <span className="vv-assigned-tag">{tr.assigned(curriculum.day)}</span> : null}
          <span className="vv-level">{v.id} · {v.level} · P{v.phase}</span>
          <span className="vv-name">{v.title}</span>
          <span className="vv-channel">{v.channel} — {v.focus_areas}</span>
        </div>
        <div className="vv-actions">
          <a className="vv-watch" href={v.url} target="_blank" rel="noopener noreferrer">{tr.watch}</a>
          <button
            type="button"
            className={`vv-mark${done ? ' is-done' : ''}`}
            disabled={done || busyId === v.id}
            onClick={() => markReviewed(v.id)}
            data-testid="vv-mark"
          >
            {done ? tr.marked : tr.mark}
          </button>
        </div>
      </div>
    );
  };

  return (
    <section className="vv-shell" data-testid="video-vault">
      <span className="lm-kicker">{tr.kicker}</span>
      <h3 className="lm-title">{tr.title}</h3>
      <p className="vv-sub">{tr.sub}</p>

      {sequence.length === 0 ? (
        <div className="vv-empty">{tr.empty}</div>
      ) : (
        <>
          {/* ── THE DAY'S ASSIGNED LESSON — Sequence Mapper binding, featured ── */}
          {assigned ? row(assigned, true) : null}

          {/* ── the full chronological sequence (free roam — always open) ── */}
          {assigned ? <div className="vv-library-label">{tr.library}</div> : null}
          <div className="vv-list">
            {rest.map((v) => row(v))}
          </div>
        </>
      )}
    </section>
  );
}
