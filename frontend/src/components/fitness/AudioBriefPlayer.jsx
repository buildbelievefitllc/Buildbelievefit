// src/components/fitness/AudioBriefPlayer.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 3.4 — the morning-brief tile (CARDIO_AUDIO_STITCHING §3).
//
// Consumes the sovereign_brief_playlists fragment array (via useBriefPlayer) and
// plays it gaplessly, honoring each fragment's gap_after_ms. ZERO-API: the hook
// constructs public-bucket URLs (sovereign-fragments / language-fragments) and
// never touches an external TTS service.
//
// AUTH: standard Vault Token API (through the hook). TRILINGUAL: all chrome + the
// no-brief fallback resolve through useFitnessStr by preferred_locale; the brief is
// fetched in the athlete's locale.
//
// @param {{ locale?: 'en'|'es'|'pt' }} props  overrides the athlete's UI locale

import { useLang } from '../../context/LangContext.jsx';
import { useFitnessStr } from './fitnessStrings.js';
import { useBriefPlayer } from './useBriefPlayer.js';
import './fitness.css';

export default function AudioBriefPlayer({ locale }) {
  const { lang } = useLang();
  const { fs } = useFitnessStr();
  const briefLocale = locale || lang || 'en';
  const { loading, found, tone, segments, status, currentIndex, play, pause, replay } = useBriefPlayer(briefLocale);

  const total = segments.length;
  const playing = status === 'playing';
  const shownIndex = Math.min(currentIndex + (status === 'ended' ? 0 : 1), total);
  const toneLabel = tone ? (fs.tone[tone] || tone) : null;
  // progress across the whole brief (segment-granular; the bar advances per fragment)
  const progressPct = total ? Math.round((Math.min(currentIndex, total) / total) * 100) : 0;

  return (
    <section className="ab-tile" data-testid="audio-brief" aria-label={fs.briefTitle}>
      <header className="ab-head">
        <span className="ab-kicker">{fs.briefKicker}</span>
        <div className="ab-headline">
          <h3 className="ab-title">{fs.briefTitle}</h3>
          {toneLabel ? <span className="ab-tone">{toneLabel}</span> : null}
        </div>
      </header>

      {loading ? (
        <div className="ab-status">{fs.briefLoading}</div>
      ) : !found || total === 0 ? (
        <div className="ab-status ab-status--none">{fs.briefNone}</div>
      ) : (
        <>
          <div className="ab-controls">
            <button
              type="button"
              className="ab-play"
              onClick={playing ? pause : play}
              aria-label={playing ? fs.pause : fs.play}
            >
              <span aria-hidden="true">{playing ? '❚❚' : '▶'}</span>
            </button>
            <button type="button" className="ab-replay" onClick={replay} aria-label={fs.replay}>
              <span aria-hidden="true">↻</span>
            </button>
            <span className="ab-segment">{fs.segment(shownIndex, total)}</span>
          </div>

          <div className="ab-progress" aria-hidden="true">
            <div className="ab-progress-fill" style={{ width: `${status === 'ended' ? 100 : progressPct}%` }} />
          </div>

          {/* segment rail — one pip per fragment; the active one is lit */}
          <div className="ab-rail" role="img" aria-label={fs.segment(shownIndex, total)}>
            {segments.map((s, i) => (
              <span
                key={`${s.variant_key || s.slot}-${i}`}
                className={`ab-pip${i < currentIndex || status === 'ended' ? ' is-done' : ''}${i === currentIndex && status !== 'ended' ? ' is-active' : ''}`}
                title={`${s.slot || ''} · ${s.variant_key || ''}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
