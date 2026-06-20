// src/components/vault/DailyAffirmationCoach.jsx
// ─────────────────────────────────────────────────────────────────────────────
// DAILY AFFIRMATION COACH — voice-coached affirmation for Champion Mindset, sat
// right above the static Daily Vault Affirmation block. The week's affirmation is
// spoken VERBATIM in the athlete's language by the SAME locale-mapped ElevenLabs
// voice the rest of the platform uses (en → BBF Coach · es → Ana María · pt → Ana
// Alice), via bbf-biokinetic-briefing (context='affirmation', cached by aff id).
//
// Audio playback + warm voice + server cache + stock-voice fallback all come free
// from CoachAudioButton (same transport as Recovery/Prehab/Cardio). Brand-locked:
// matte surface canvas, gold/purple accents, Bebas header. Trilingual via useLang.

import { useEffect, useState } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import CoachAudioButton from './CoachAudioButton.jsx';
import { fetchSectionCoachAudio } from '../../lib/forecastApi.js';
import { affirmationForToday, affirmationText, currentWeekKey } from '../../data/affirmations.js';
import './affirmation.css';

const SEEN_KEY = 'bbf_aff_seen_week';

export default function DailyAffirmationCoach() {
  const { t, lang } = useLang();
  const aff = affirmationForToday();
  const text = affirmationText(aff, lang);
  const weekKey = currentWeekKey();

  // "New" badge — true the first time this week's affirmation is viewed, then the
  // week is marked seen (side-effect only; never setState in the effect body).
  const [fresh] = useState(() => {
    try { return localStorage.getItem(SEEN_KEY) !== weekKey; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem(SEEN_KEY, weekKey); } catch { /* private mode / no storage */ }
  }, [weekKey]);

  if (!text) return null;

  return (
    <section className="aff-card" aria-label={t('aff-header')} data-testid="daily-affirmation-coach">
      <div className="aff-head">
        <span className="aff-mic" aria-hidden="true">🎙️</span>
        <h3 className="aff-title">{t('aff-header')}</h3>
        <span className="aff-lang" data-testid="aff-lang">{lang.toUpperCase()}</span>
        {fresh ? <span className="aff-badge" data-testid="aff-new">{t('aff-new')}</span> : null}
      </div>

      <CoachAudioButton
        audioRequest={() => fetchSectionCoachAudio({ context: 'affirmation', cueRef: `aff:${aff.id}`, cueText: text, locale: lang })}
        fallbackText={text}
      />

      <blockquote className="aff-text">&ldquo;{text}&rdquo;</blockquote>
    </section>
  );
}
