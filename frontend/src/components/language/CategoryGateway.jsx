// src/components/language/CategoryGateway.jsx
// ─────────────────────────────────────────────────────────────────────────────
// THE CURRICULUM ATLAS — the level-gated category grid that fronts the 5-Phase
// Skill Funnel. Reads the hardcoded trilingual manifest
// (data/languageLabCategories.json): three tiers — Foundations · Situational ·
// Fluency — each a deck of colorful category tiles.
//
// LEVEL GATING (client-side, no DB): Level 1 is always open. A higher tier
// unlocks once enough categories in the tier below have their full 5-phase
// CATEGORY TEST cleared. Cleared state is persisted per target language in
// localStorage ('bbf_atlas_cleared_<lang>'), so progress survives refreshes and
// a language swap keeps its own ledger — mirroring the Lab's target-keyed state.
//
// Selecting an unlocked category opens SkillFunnel for its item bank; the funnel
// reports a cleared category back up, which re-evaluates the gates live.

import { useCallback, useMemo, useState } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import { useLanguageLab } from './LanguageLabContext.jsx';
import SkillFunnel from './SkillFunnel.jsx';
import MANIFEST from '../../data/languageLabCategories.json';
import './language.css';

// Categories a tier below must clear to unlock the next tier (capped at tier size).
const UNLOCK_THRESHOLD = 3;

const GW_STR = {
  en: { kicker: 'Curriculum Atlas', title: 'Choose your track', locked: 'Locked', unlockHint: (n, t) => `Clear ${n} ${t} categories to unlock`, cleared: 'Cleared', phases: '5 phases' },
  es: { kicker: 'Atlas del Currículo', title: 'Elige tu ruta', locked: 'Bloqueado', unlockHint: (n, t) => `Completa ${n} categorías de ${t} para desbloquear`, cleared: 'Completado', phases: '5 fases' },
  pt: { kicker: 'Atlas do Currículo', title: 'Escolha sua trilha', locked: 'Bloqueado', unlockHint: (n, t) => `Conclua ${n} categorias de ${t} para desbloquear`, cleared: 'Concluído', phases: '5 fases' },
};

const clearedKey = (language) => `bbf_atlas_cleared_${language}`;

function readCleared(language) {
  try {
    const raw = localStorage.getItem(clearedKey(language));
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

export default function CategoryGateway({ language = 'es' }) {
  const { lang } = useLang();
  const { logModuleProgress } = useLanguageLab(); // Guided Track daily-dose write path
  const gw = GW_STR[lang] || GW_STR.en;
  const levels = useMemo(() => MANIFEST.levels || [], []);

  const [cleared, setCleared] = useState(() => readCleared(language));
  const [openCat, setOpenCat] = useState(null); // the selected category object

  const markCleared = useCallback((catId) => {
    setCleared((prev) => {
      if (prev.includes(catId)) return prev;
      const next = [...prev, catId];
      try { localStorage.setItem(clearedKey(language), JSON.stringify(next)); } catch { /* quota / private mode */ }
      return next;
    });
  }, [language]);

  // Clearing a category's full 5-phase test ties the game loop into the master
  // ledger: the words drilled advance the Guided Track's daily VOCAB dose and
  // the run counts as one SYNTAX rep. Non-throwing / inert off-session (the
  // provider's logModuleProgress is a resolved no-op without a vault token).
  const syncDailyDose = useCallback((cat) => {
    const words = Array.isArray(cat?.items) ? cat.items.length : 0;
    if (words > 0) logModuleProgress('vocab', words);
    logModuleProgress('syntax', 1);
  }, [logModuleProgress]);

  // A tier is unlocked if it's the first, or the tier below cleared its threshold.
  const unlocked = useMemo(() => {
    const flags = [];
    levels.forEach((lvl, idx) => {
      if (idx === 0) { flags.push(true); return; }
      const below = levels[idx - 1];
      const need = Math.min(UNLOCK_THRESHOLD, below.categories.length);
      const got = below.categories.filter((c) => cleared.includes(c.id)).length;
      flags.push(got >= need);
    });
    return flags;
  }, [levels, cleared]);

  if (openCat) {
    return (
      <SkillFunnel
        key={`${openCat.id}-${language}`}
        category={openCat}
        language={language}
        onBack={() => setOpenCat(null)}
        onCleared={(id) => { markCleared(id); syncDailyDose(openCat); }}
      />
    );
  }

  return (
    <section className="gw-shell" data-testid="category-gateway">
      <span className="lm-kicker">{gw.kicker}</span>
      <h3 className="lm-title">{gw.title}</h3>

      {levels.map((lvl, idx) => {
        const open = unlocked[idx];
        const below = idx > 0 ? levels[idx - 1] : null;
        const need = below ? Math.min(UNLOCK_THRESHOLD, below.categories.length) : 0;
        return (
          <div key={lvl.id} className={`gw-level${open ? '' : ' is-locked'}`}>
            <div className="gw-level-head">
              <span className="gw-level-tag">{lvl.id}</span>
              <span className="gw-level-title">{lvl.titles[lang] || lvl.titles.en}</span>
              {!open ? (
                <span className="gw-level-lock">🔒 {gw.unlockHint(need, below.titles[lang] || below.titles.en)}</span>
              ) : null}
            </div>
            <div className="gw-grid">
              {lvl.categories.map((cat) => {
                const isCleared = cleared.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    className={`gw-tile${isCleared ? ' is-cleared' : ''}`}
                    style={{ '--gw-accent': cat.accent }}
                    disabled={!open}
                    onClick={() => open && setOpenCat(cat)}
                    data-testid={`gw-tile-${cat.id}`}
                  >
                    <span className="gw-tile-icon" aria-hidden="true">{cat.icon}</span>
                    <span className="gw-tile-name">{cat.titles[lang] || cat.titles.en}</span>
                    <span className="gw-tile-meta">
                      {isCleared ? `✓ ${gw.cleared}` : gw.phases}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </section>
  );
}
