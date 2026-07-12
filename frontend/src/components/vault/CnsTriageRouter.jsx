// src/components/vault/CnsTriageRouter.jsx
// ─────────────────────────────────────────────────────────────────────────────
// CNS Triage Router — a local, trilingual nervous-system alignment intercept.
//
// Given a day's CNS score and the athlete's language, this routes to exactly one
// of nine pre-rendered "HAGEN" alignment films (3 tiers × EN/ES/PT) and plays it
// immersively (borderless 9:16 portrait, autoplay, no controls). The instant the
// film ends it drops a matte-black "Alignment Complete" overlay carrying the
// localized Champion-Mindset anchor, which routes the athlete into the Champion
// Mindset dashboard.
//
// TIER MAP (score → film):
//   ≥ 70  → BYPASS (optimal CNS — nothing renders; the athlete trains as normal)
//   60–69 → Tier 1  (mild strain)
//   50–59 → Tier 2  (moderate strain)
//   < 50  → Tier 3  (deep strain)
//
// Props-driven by design (cnsScore, userLanguage) so any triage view can mount it
// with a live readiness read; it self-gates to null when CNS is optimal or the
// inputs are unusable, so it is always safe to render unconditionally.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './cnsTriageRouter.css';

// The Champion Mindset dashboard the completion anchor routes to (see the guarded
// /champion-mindset route in App.jsx).
const CHAMPION_MINDSET_PATH = '/champion-mindset';

// ── The nine HAGEN alignment assets — [language][tier] ────────────────────────
// Compressed (720p, ~3–5 MB) and served from the public Supabase `videos/HAGEN/`
// storage bucket (range-streamed, CDN-backed) — no heavy binaries in git. Values
// are the exact nested folder/file keys in that bucket; the browser URL is
// HAGEN_BASE + '/' + the selected asset (see `src` below).
// NOTE: the EN Tier-3 FILE name (…_Score.mp4) is intentionally shorter than its
// FOLDER name (…_Score_Under_50) — matched here byte-for-byte to the real asset.
const HAGEN_BASE = 'https://ihclbceghxpuawymlvgi.supabase.co/storage/v1/object/public/videos/HAGEN';
const TRIAGE_ASSET_MATRIX = {
  en: {
    tier1: 'THE_COURSE_CORRECTION_CNS_Score_6069/THE_COURSE_CORRECTION_CNS_Score_6069.mp4',
    tier2: 'TIER_2_THE_LOOP_BREAK_CNS_Score_5059/TIER_2_THE_LOOP_BREAK_CNS_Score_5059.mp4',
    tier3: 'Tier_3_The_Emergency_Grounding_CNS_Score_Under_50/Tier_3_The_Emergency_Grounding_CNS_Score.mp4',
  },
  es: {
    tier1: 'bbf_cns_tier1_es/bbf_cns_tier1_es.mp4',
    tier2: 'bbf_cns_tier2_es/bbf_cns_tier2_es.mp4',
    tier3: 'bbf_cns_tier3_es/bbf_cns_tier3_es.mp4',
  },
  pt: {
    tier1: 'bbf_cns_tier1_pt/bbf_cns_tier1_pt.mp4',
    tier2: 'bbf_cns_tier2_pt/bbf_cns_tier2_pt.mp4',
    tier3: 'bbf_cns_tier3_pt/bbf_cns_tier3_pt.mp4',
  },
};

// ── Localized completion copy + Champion anchor label ─────────────────────────
const COPY = {
  en: { complete: 'Alignment Complete', cta: 'CONNECT TO CHAMPION MINDSET' },
  es: { complete: 'Alineación Completa', cta: 'CONECTAR CON CHAMPION MINDSET' },
  pt: { complete: 'Alinhamento Completo', cta: 'CONECTAR AO CHAMPION MINDSET' },
};

const BYPASS_FLOOR = 70; // ≥ this → optimal CNS, no intercept.

// Map a CNS score to its alignment tier, or null when CNS is optimal / the score
// isn't a usable number (fail safe: never mis-triage on bad input — just bypass).
function tierForScore(score) {
  if (typeof score !== 'number' || !Number.isFinite(score)) return null;
  if (score >= BYPASS_FLOOR) return null; // 70+ bypasses
  if (score >= 60) return 'tier1';        // 60–69
  if (score >= 50) return 'tier2';        // 50–59
  return 'tier3';                          // < 50
}

const normLang = (l) => (l === 'es' || l === 'pt' ? l : 'en');

/**
 * @param {{ cnsScore: number, userLanguage: ('en'|'es'|'pt') }} props
 */
export default function CnsTriageRouter({ cnsScore, userLanguage }) {
  const navigate = useNavigate();
  const videoRef = useRef(null);

  const lang = normLang(userLanguage);
  const tier = tierForScore(cnsScore);
  // The nested folder/file for this locale+tier, then the full browser URL:
  // base + '/' + selected asset → /assets/videos/HAGEN/<folder>/<file>.mp4.
  const selectedAsset = tier ? TRIAGE_ASSET_MATRIX[lang]?.[tier] ?? null : null;
  const src = useMemo(() => (selectedAsset ? `${HAGEN_BASE}/${selectedAsset}` : null), [selectedAsset]);
  const copy = COPY[lang] || COPY.en;

  // A new prescription (score/lang change → new src) resets the completion overlay.
  // React's "adjust state during render" pattern — the correct way to derive state
  // from a changed prop without a setState-in-effect cascade.
  const [ended, setEnded] = useState(false);
  const [activeSrc, setActiveSrc] = useState(src);
  if (src !== activeSrc) {
    setActiveSrc(src);
    setEnded(false);
  }

  // Imperative playback (external-system sync only — no React state here). Changing
  // a <video>'s src does not re-trigger the autoPlay attribute, so we drive play()
  // on each new prescription. Autoplay-with-sound is attempted first; if the browser
  // blocks it (no gesture), we fall back to a muted play so the film still runs and
  // the onEnded handoff still fires — an immersive experience never silently stalls.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !src) return;
    v.currentTime = 0;
    const attempt = v.play();
    if (attempt && typeof attempt.catch === 'function') {
      attempt.catch(() => { v.muted = true; v.play().catch(() => { /* give up quietly */ }); });
    }
  }, [src]);

  // Gate: optimal CNS, unusable score, or a missing asset for this locale/tier.
  if (!src) return null;

  return (
    <div className="cns-triage" data-testid="cns-triage-router" data-tier={tier} data-lang={lang}>
      <video
        ref={videoRef}
        className="cns-triage-video"
        src={src}
        autoPlay
        playsInline
        preload="auto"
        onEnded={() => setEnded(true)}
        data-testid="cns-triage-video"
      />

      {ended ? (
        <div className="cns-triage-overlay" role="dialog" aria-live="polite" data-testid="cns-triage-overlay">
          <h2 className="cns-triage-complete">{copy.complete}</h2>
          <button
            type="button"
            className="cns-triage-cta"
            onClick={() => navigate(CHAMPION_MINDSET_PATH)}
            data-testid="cns-triage-cta"
          >
            {copy.cta}
          </button>
        </div>
      ) : null}
    </div>
  );
}
