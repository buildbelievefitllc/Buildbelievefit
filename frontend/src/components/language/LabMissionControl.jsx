// src/components/language/LabMissionControl.jsx
// ─────────────────────────────────────────────────────────────────────────────
// MISSION CONTROL — the Lab's at-a-glance telemetry strip.
//
// Every number here already lived in the database (bbf_language_profiles via
// bbf_get_language_dashboard: streak, fluency EWMA, mastered count, weak
// clusters — all rolled up nightly and per-session by the engines) but was
// invisible in the UI. Motivation loops need a scoreboard; this is it.
//
// Mounted with key={target} in LabHub so a language swap remounts it fresh
// (house rule: no sync setState in effects — the remount owns the reset).
// No profile yet / no session → renders nothing; the strip never nags.

import { useEffect, useState } from 'react';
import { getLanguageDashboard } from '../../lib/languageLabApi.js';
import { useLanguageLab } from './LanguageLabContext.jsx';
import { useLangUiStr } from './languageStrings.js';
import { useLang } from '../../context/LangContext.jsx';
import './language.css';

const MC_STR = {
  en: { kicker: 'Mission Control', day: (d) => `Day ${d}`, streak: 'streak', best: 'best', fluency: 'fluency', mastered: 'mastered', focus: 'Focus' },
  es: { kicker: 'Control de Misión', day: (d) => `Día ${d}`, streak: 'racha', best: 'mejor', fluency: 'fluidez', mastered: 'dominados', focus: 'Enfoque' },
  pt: { kicker: 'Controle de Missão', day: (d) => `Dia ${d}`, streak: 'sequência', best: 'melhor', fluency: 'fluência', mastered: 'dominados', focus: 'Foco' },
};

export default function LabMissionControl() {
  const { lang } = useLang();
  const { clusters } = useLangUiStr();
  const { target, curriculum } = useLanguageLab();
  const tr = MC_STR[lang] || MC_STR.en;

  const [profile, setProfile] = useState(null);

  useEffect(() => {
    let alive = true;
    getLanguageDashboard(target).then((res) => {
      if (!alive) return;
      if (res && res.ok && res.profile) setProfile(res.profile);
    });
    return () => { alive = false; };
  }, [target]);

  if (!profile) return null;

  const streak = Number(profile.streak_current) || 0;
  const best = Number(profile.streak_best) || 0;
  const ewma = profile.fluency_ewma != null ? Math.round(Number(profile.fluency_ewma)) : null;
  const mastered = Number(profile.vocab_mastered) || 0;
  const focus = (Array.isArray(profile.weak_clusters) ? profile.weak_clusters : []).slice(0, 2);

  return (
    <div className="lm-mc" data-testid="lm-mission-control">
      <span className="lm-mc-kicker">{tr.kicker}</span>
      <div className="lm-mc-stats">
        {curriculum.ready ? <span className="lm-mc-stat"><strong>{tr.day(curriculum.day)}</strong></span> : null}
        <span className="lm-mc-stat">🔥 <strong>{streak}</strong> {tr.streak}{best > streak ? ` · ${tr.best} ${best}` : ''}</span>
        {ewma != null ? <span className="lm-mc-stat">〰 <strong>{ewma}</strong>/100 {tr.fluency}</span> : null}
        <span className="lm-mc-stat">🏛 <strong>{mastered}</strong> {tr.mastered}</span>
        {focus.length ? (
          <span className="lm-mc-focus">
            {tr.focus}: {focus.map((c) => <span key={c} className="lm-mc-chip">{clusters[c] || c}</span>)}
          </span>
        ) : null}
      </div>
    </div>
  );
}
