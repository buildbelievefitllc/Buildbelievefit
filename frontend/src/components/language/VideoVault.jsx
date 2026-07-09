// src/components/language/VideoVault.jsx
// ─────────────────────────────────────────────────────────────────────────────
// VIDEO VAULT — the Guided Track's daily immersion-media review, promoted into
// the Language Lab as its own mode. Sources the curated languageVideoLibrary
// (the same ground-truth JSON the CEO roadmap's Video Vault reads), filtered
// STRICTLY to the active target language, grouped by level.
//
// "Mark reviewed" is the checklist hook: it bumps the curriculum 'video' dose
// counter (logModuleProgress) — one review clears the day's Video Vault item.
// Reviews this session are remembered locally so the button reads honestly.

import { useMemo, useState } from 'react';
import { useLanguageLab } from './LanguageLabContext.jsx';
import { useLang } from '../../context/LangContext.jsx';
import languageVideoLibrary from '../../data/languageVideoLibrary.json';
import './language.css';

const VV_STR = {
  en: { kicker: 'Video Vault · Immersion Media', title: 'Curated native input', sub: 'Watch one clip a day — no subtitles when you can hold it. Mark it reviewed to clear the track item.', watch: '▶ Watch', mark: 'Mark reviewed', marked: '✓ Reviewed', empty: 'The vault for this language is still being curated.' },
  es: { kicker: 'Bóveda de Video · Medios de Inmersión', title: 'Contenido nativo curado', sub: 'Mira un clip al día — sin subtítulos cuando puedas sostenerlo. Márcalo como revisado para completar el punto de la ruta.', watch: '▶ Ver', mark: 'Marcar revisado', marked: '✓ Revisado', empty: 'La bóveda para este idioma aún se está curando.' },
  pt: { kicker: 'Cofre de Vídeo · Mídia de Imersão', title: 'Conteúdo nativo curado', sub: 'Assista a um clipe por dia — sem legendas quando conseguir sustentar. Marque como revisado para completar o item da trilha.', watch: '▶ Assistir', mark: 'Marcar revisado', marked: '✓ Revisado', empty: 'O cofre para este idioma ainda está sendo curado.' },
};

// Library language names per BBF target code.
const LIB_LANG = { es: 'Spanish', pt: 'Portuguese' };
const LEVEL_ORDER = { Beginner: 1, Intermediate: 2, Advanced: 3 };

export default function VideoVault({ language = 'es' }) {
  const { lang } = useLang();
  const { logModuleProgress } = useLanguageLab();
  const tr = VV_STR[lang] || VV_STR.en;
  const [reviewed, setReviewed] = useState(() => new Set());
  const [busyId, setBusyId] = useState(null);

  const videos = useMemo(() => {
    const name = LIB_LANG[language === 'pt' ? 'pt' : 'es'];
    return languageVideoLibrary
      .filter((v) => v.language === name)
      .sort((a, b) => (a.phase - b.phase) || ((LEVEL_ORDER[a.level] || 9) - (LEVEL_ORDER[b.level] || 9)) || String(a.id).localeCompare(String(b.id)));
  }, [language]);

  async function markReviewed(id) {
    if (reviewed.has(id) || busyId) return;
    setBusyId(id);
    await logModuleProgress('video', 1);
    setBusyId(null);
    setReviewed((s) => new Set(s).add(id));
  }

  return (
    <section className="vv-shell" data-testid="video-vault">
      <span className="lm-kicker">{tr.kicker}</span>
      <h3 className="lm-title">{tr.title}</h3>
      <p className="vv-sub">{tr.sub}</p>

      {videos.length === 0 ? (
        <div className="vv-empty">{tr.empty}</div>
      ) : (
        <div className="vv-list">
          {videos.map((v) => {
            const done = reviewed.has(v.id);
            return (
              <div key={v.id} className={`vv-row${done ? ' is-reviewed' : ''}`} data-testid="vv-row">
                <div className="vv-meta">
                  <span className="vv-level">{v.level} · P{v.phase}</span>
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
          })}
        </div>
      )}
    </section>
  );
}
