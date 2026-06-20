// src/components/vault/WeeklyBriefCard.jsx
// ─────────────────────────────────────────────────────────────────────────────
// WEEKLY BRIEF — top-of-fold Hub card. The first thing the athlete sees on land:
// the coach's Monday voice memo (scenario verdict + audio + transcript) from
// bbf-weekly-brief-scenario-engine.
//
// Brand (CLAUDE.md §2): BBF Gold canvas, BBF Purple accent + CTA, Bebas header.
// Trilingual via useLang. Audio-first: `audio_url` streams in <audio>;
// `rendered_script` backs the transcript drawer. Degrades gracefully — a missing/
// failed brief shows the "not ready" line, never an invented brief, and an audio
// playback error nudges the athlete to the transcript instead of dead-ending.
//
// Data contract { scenario, substatus, audio_url, locked_in, timestamp,
// rendered_script } is owned by the Vault Hub (useWeeklyBrief) — this paints it.

import { useRef, useState } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import './weeklyBrief.css';

// Server scenario → trilingual verdict chip key. Falls back to the raw slug so a
// new server scenario still renders something legible (never a blank chip).
const SCENARIO_TKEY = {
  PROGRESSION: 'wb-sc-progression',
  COMPLIANCE: 'wb-sc-compliance',
  PLATEAU_WITH_HIGH_RPE: 'wb-sc-plateau',
  NEUTRAL: 'wb-sc-neutral',
};
const LOCALE_TAG = { en: 'en-US', es: 'es', pt: 'pt-BR' };

function isFresh(timestamp) {
  if (!timestamp) return false;
  const ms = Date.parse(timestamp);
  return Number.isFinite(ms) && (Date.now() - ms) < 24 * 60 * 60 * 1000;
}

function fmtGenerated(timestamp, lang) {
  const ms = Date.parse(timestamp || '');
  if (!Number.isFinite(ms)) return '';
  try {
    return new Intl.DateTimeFormat(LOCALE_TAG[lang] || 'en-US', {
      weekday: 'short', hour: 'numeric', minute: '2-digit',
    }).format(new Date(ms));
  } catch { return ''; }
}

export default function WeeklyBriefCard({ brief, loading, error }) {
  const { t, lang } = useLang();
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [audioErr, setAudioErr] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  // While the brief is loading, hold a slim placeholder so the Hub doesn't jump.
  if (loading) {
    return (
      <section className="wb-card wb-card--loading" aria-busy="true" data-testid="weekly-brief-card">
        <span className="wb-skel" aria-hidden="true" />
        <span className="wb-loading-text">{t('wb-loading')}</span>
      </section>
    );
  }

  // No usable brief (API error or empty payload) → honest "not ready" state.
  if (error || !brief || !brief.audio_url) {
    return (
      <section className="wb-card wb-card--empty" data-testid="weekly-brief-card">
        <div className="wb-head">
          <span className="wb-mic" aria-hidden="true">🎙️</span>
          <h2 className="wb-title">{t('wb-title')}</h2>
        </div>
        <p className="wb-empty-msg">{t('wb-unavailable')}</p>
      </section>
    );
  }

  const fresh = isFresh(brief.timestamp);
  const generated = fmtGenerated(brief.timestamp, lang);
  const verdictKey = SCENARIO_TKEY[brief.scenario];
  const verdict = verdictKey ? t(verdictKey) : (brief.scenario || '').replace(/_/g, ' ');
  const transcript = brief.rendered_script || '';

  function togglePlay() {
    const el = audioRef.current;
    if (!el) return;
    if (playing) { el.pause(); return; }
    setAudioErr(false);
    el.play().catch(() => { setAudioErr(true); setShowTranscript(true); });
  }

  return (
    <section className="wb-card" data-testid="weekly-brief-card">
      <div className="wb-head">
        <span className="wb-mic" aria-hidden="true">🎙️</span>
        <h2 className="wb-title">{t('wb-title')}</h2>
        {fresh ? <span className="wb-badge" data-testid="wb-new-badge">{t('wb-new')}</span> : null}
        {generated ? <span className="wb-stamp">{t('wb-generated')} · {generated}</span> : null}
      </div>

      <div className="wb-controls">
        <button
          type="button"
          className={`wb-play${playing ? ' is-playing' : ''}`}
          onClick={togglePlay}
          data-testid="wb-play"
          aria-label={playing ? t('wb-pause') : t('wb-play')}
        >
          <span className="wb-play-ic" aria-hidden="true">{playing ? '❚❚' : '►'}</span>
          <span className="wb-play-txt">{playing ? t('wb-pause') : t('wb-play')}</span>
        </button>

        {transcript ? (
          <button
            type="button"
            className="wb-transcript-btn"
            onClick={() => setShowTranscript((v) => !v)}
            aria-expanded={showTranscript}
            data-testid="wb-transcript-toggle"
          >
            {t('wb-transcript')}
          </button>
        ) : null}
      </div>

      <div className="wb-meta">
        {verdict ? <span className="wb-verdict">{verdict}</span> : null}
        {brief.locked_in ? <span className="wb-locked" data-testid="wb-locked-in">✓ {t('wb-locked-in')}</span> : null}
      </div>

      {showTranscript && transcript ? (
        <div className="wb-transcript" role="region" aria-label={t('wb-transcript-title')} data-testid="wb-transcript">
          <h3 className="wb-transcript-h">{t('wb-transcript-title')}</h3>
          <p className="wb-transcript-body">{transcript}</p>
          <button type="button" className="wb-transcript-close" onClick={() => setShowTranscript(false)}>
            {t('wb-close')}
          </button>
        </div>
      ) : null}

      {audioErr ? <span className="wb-audio-err" role="status">{t('wb-unavailable')}</span> : null}

      <audio
        ref={audioRef}
        src={brief.audio_url}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => { setAudioErr(true); setPlaying(false); }}
        preload="none"
      />
    </section>
  );
}
