// src/components/vault/DailyAffirmationCoach.jsx
// ─────────────────────────────────────────────────────────────────────────────
// DAILY AFFIRMATION COACH — voice-coached affirmation for Champion Mindset, sat
// right above the static Daily Vault Affirmation block. The week's affirmation is
// played from a PRE-RENDERED static clip in the Akeem voice (staticVoiceManifest:
// {LANG}_AFF_{NN}) — NO live ElevenLabs call (Operation Eviction). On a manifest
// miss, CoachAudioButton degrades to the device-native stock voice (speechFallback)
// reading `fallbackText`.
//
// Audio playback + warm voice + stock-voice fallback all come free from
// CoachAudioButton (same transport as Recovery/Prehab/Cardio). Brand-locked:
// matte surface canvas, gold/purple accents, Bebas header. Trilingual via useLang.

import { useEffect, useState } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import CoachAudioButton from './CoachAudioButton.jsx';
import { affirmationUrl } from '../../lib/staticVoice.js';
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

      {/* Static-bucket path: resolve the pre-rendered affirmation clip (no live
          ElevenLabs). On a manifest miss, throwing routes CoachAudioButton to the
          device-native speechFallback reading `fallbackText`. */}
      <CoachAudioButton
        audioRequest={() => {
          const u = affirmationUrl(lang, aff.id);
          if (!u) throw new Error('static_voice_miss');
          return Promise.resolve(u);
        }}
        fallbackText={text}
      />

      <blockquote className="aff-text">&ldquo;{text}&rdquo;</blockquote>
    </section>
  );
}
