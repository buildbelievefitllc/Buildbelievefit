// src/components/BbfMediaPortal.jsx
// ─────────────────────────────────────────────────────────────────────────────
// BBF Lab — Dual-Media Mixer Engine for the 4K HeyGen module guides.
//
// Two exports:
//   • BbfMediaPortal  — the matte-black modal (gold→purple 1px gradient envelope)
//     with a dual-state playback layer:
//       ‣ Watch Video  → the full 4K MP4 in a constrained cinematic window.
//       ‣ Listen Only  → hides the video container entirely and streams only the
//         audio track beside a pulsing gold wavelength animation (low data overhead).
//   • GuideLauncher   — the drop-in `[ 📺 Watch Guide ] [ 🔊 Listen Only ]` trigger
//     pair, TierGate-wrapped (§7) so only active/validated accounts can play, that
//     opens the portal in the chosen mode. Hosts embed ONE line: <GuideLauncher …/>.
//
// Brand-locked (§2 — BBF Gold #f5c800 / Purple #6a0dad over matte-black canvas).
// Trilingual EN/ES/PT (§1) via useLang. Esc / backdrop / ✕ close; scroll is locked
// while open (the same modal doctrine as PrescriptionMoveModal.jsx).
//
// NOTE ON AUDIO STEMS: the HeyGen deliverables shipped as MP4 only (no split audio
// stems). Until an extracted `.m4a` stem exists, `audio` falls back to the MP4 URL,
// so Listen Only decodes the MP4's audio track. Each registry entry keeps a distinct
// `audio` field so dropping a real stem in later is a one-line, code-free change.

import { useEffect, useRef, useState } from 'react';
import { useLang } from '../context/LangContext.jsx';
import TierGate from './TierGate.jsx';
import WatchGuideButton from './WatchGuideButton.jsx';
import { SOVEREIGN_SYSTEM_GUIDES } from '../lib/sovereignSystemGuides.js';
import './bbfMediaPortal.css';

// Optional trilingual subtitle chrome layered over the catalog's id/title/url, keyed
// by guide key; missing → the portal renders no subtitle. Access + assets live in the
// catalog (sovereignSystemGuides.js); this is presentational copy only.
const GUIDE_SUB = {
  intro: {
    en: 'Your daily loop, end to end — how every surface fits the protocol.',
    es: 'Tu ciclo diario, de principio a fin — cómo cada sección encaja en el protocolo.',
    pt: 'Seu ciclo diário, de ponta a ponta — como cada tela se encaixa no protocolo.',
  },
  check_in: {
    en: 'What every field captures — and why honest numbers move you faster.',
    es: 'Qué captura cada campo — y por qué los números honestos te hacen avanzar más rápido.',
    pt: 'O que cada campo captura — e por que números honestos te fazem avançar mais rápido.',
  },
  tissue_priming: {
    en: 'Prime the tissue before load — the mobility work that protects the joint.',
    es: 'Prepara el tejido antes de la carga — la movilidad que protege la articulación.',
    pt: 'Prepare o tecido antes da carga — a mobilidade que protege a articulação.',
  },
  program_execution: {
    en: 'Read your phases, log every set, and let autoregulation drive the load.',
    es: 'Lee tus fases, registra cada serie y deja que la autorregulación ajuste la carga.',
    pt: 'Leia suas fases, registre cada série e deixe a autorregulação ajustar a carga.',
  },
  system_flush: {
    en: 'The post-lift flush — smart cardio that clears the system without burning muscle.',
    es: 'El enjuague post-pesas — cardio inteligente que limpia el sistema sin quemar músculo.',
    pt: 'O flush pós-treino — cardio inteligente que limpa o sistema sem queimar músculo.',
  },
  nutrition_locker: {
    en: 'Working the fuel wheel — hit your macros, not just the recipe, meal by meal.',
    es: 'Cómo usar la rueda de combustible — acierta tus macros, no solo la receta, comida a comida.',
    pt: 'Como usar a roda de combustível — bata seus macros, não só a receita, refeição a refeição.',
  },
  prehab_diagnostic: {
    en: 'Log a joint symptom and let the diagnostic route your recovery work.',
    es: 'Registra un síntoma articular y deja que el diagnóstico dirija tu recuperación.',
    pt: 'Registre um sintoma articular e deixe o diagnóstico guiar sua recuperação.',
  },
  champion_mindset: {
    en: 'The identity work — tuning the frequency that keeps you on protocol.',
    es: 'El trabajo de identidad — afinar la frecuencia que te mantiene en el protocolo.',
    pt: 'O trabalho de identidade — afinar a frequência que te mantém no protocolo.',
  },
};

// Resolve a guide key → the portal module shape, or null when the key is unknown or
// its asset isn't LIVE yet (ready!==true) — so a launcher never opens a dead 404.
function resolveGuide(key) {
  const g = SOVEREIGN_SYSTEM_GUIDES[key];
  if (!g || g.ready !== true) return null;
  return {
    video: g.url,
    audio: g.url,          // Listen mode streams the same object's audio track
    title: g.title,        // string; the portal also accepts an {en,es,pt} map
    sub: GUIDE_SUB[key],   // optional trilingual copy
    feature: g.feature || 'grid',
  };
}

const STR = {
  en: { watch: 'Watch Guide', listen: 'Listen Only', close: 'Close', modeWatch: 'Watch Video', modeListen: 'Listen Only', audioNote: 'Audio only · streaming the coach track' },
  es: { watch: 'Ver Guía', listen: 'Solo Escuchar', close: 'Cerrar', modeWatch: 'Ver Video', modeListen: 'Solo Audio', audioNote: 'Solo audio · transmitiendo la pista del coach' },
  pt: { watch: 'Ver Guia', listen: 'Só Ouvir', close: 'Fechar', modeWatch: 'Ver Vídeo', modeListen: 'Só Áudio', audioNote: 'Só áudio · transmitindo a faixa do coach' },
};

// Accepts either a plain string (catalog title) or an {en,es,pt} map (chrome copy).
const pick = (v, lang) => (v == null ? undefined : (typeof v === 'string' ? v : (v[lang] || v.en)));

// ── The modal ─────────────────────────────────────────────────────────────────
export function BbfMediaPortal({ module, initialMode = 'watch', onClose }) {
  const { lang } = useLang();
  const S = STR[lang] || STR.en;
  const [mode, setMode] = useState(initialMode === 'listen' ? 'listen' : 'watch');
  const mediaRef = useRef(null);

  // Esc closes; lock background scroll while open.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  if (!module) return null;
  const title = pick(module.title, lang);
  const sub = pick(module.sub, lang);

  return (
    <div
      className="bmp-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      data-testid="bmp-portal"
    >
      {/* gold→purple 1px gradient envelope */}
      <div className="bmp-envelope" onClick={(e) => e.stopPropagation()}>
        <div className="bmp-frame">
          <header className="bmp-head">
            <div className="bmp-head-txt">
              <span className="bmp-kicker">BBF Lab</span>
              <h3 className="bmp-title">{title}</h3>
            </div>
            <button type="button" className="bmp-x" onClick={onClose} aria-label={S.close} data-testid="bmp-close">✕</button>
          </header>

          {/* Mode switch — Watch Video / Listen Only */}
          <div className="bmp-modes" role="tablist" aria-label={title}>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'watch'}
              className={`bmp-mode${mode === 'watch' ? ' is-active' : ''}`}
              onClick={() => setMode('watch')}
              data-testid="bmp-mode-watch"
            >
              📺 {S.modeWatch}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'listen'}
              className={`bmp-mode${mode === 'listen' ? ' is-active' : ''}`}
              onClick={() => setMode('listen')}
              data-testid="bmp-mode-listen"
            >
              🔊 {S.modeListen}
            </button>
          </div>

          {/* Watch Video — full 4K MP4 in a constrained cinematic window. Only the
              active mode's media element mounts, so Listen Only never fetches the
              video container. */}
          {mode === 'watch' ? (
            <div className="bmp-stage" data-testid="bmp-video-stage">
              <video
                key="bmp-video"
                ref={mediaRef}
                className="bmp-video"
                src={module.video}
                controls
                autoPlay
                playsInline
                preload="metadata"
                data-testid="bmp-video"
              />
            </div>
          ) : (
            // Listen Only — video container hidden entirely; audio track + pulsing
            // gold wavelength keep the data footprint light.
            <div className="bmp-audio-stage" data-testid="bmp-audio-stage">
              <div className="bmp-wave" aria-hidden="true">
                {Array.from({ length: 7 }).map((_, i) => (
                  <span key={i} className="bmp-wave-bar" style={{ animationDelay: `${i * 0.12}s` }} />
                ))}
              </div>
              <p className="bmp-audio-note">{S.audioNote}</p>
              <audio
                key="bmp-audio"
                ref={mediaRef}
                className="bmp-audio"
                src={module.audio}
                controls
                autoPlay
                preload="metadata"
                data-testid="bmp-audio"
              />
            </div>
          )}

          {sub ? <p className="bmp-sub">{sub}</p> : null}
        </div>
      </div>
    </div>
  );
}

// ── Drop-in launcher — the trigger pair + portal state, TierGate-wrapped ───────
// Hosts embed a single line, e.g.:
//   <GuideLauncher module="nutrition_locker" testId="nutrition-guide" />
export function GuideLauncher({ module: moduleId, testId, className }) {
  const { lang } = useLang();
  const S = STR[lang] || STR.en;
  const [open, setOpen] = useState(null); // null | 'watch' | 'listen'
  const mod = resolveGuide(moduleId);

  if (!mod) return null;

  return (
    <TierGate feature={mod.feature} render="hide">
      <div className={`bmp-launch${className ? ` ${className}` : ''}`} data-testid={testId || `guide-launch-${moduleId}`}>
        {/* Premium gold→purple capsule pill — the high-visibility primary trigger. */}
        <WatchGuideButton
          onClick={() => setOpen('watch')}
          label={S.watch}
          testId={`${testId || `guide-${moduleId}`}-watch`}
        />
        {/* Listen Only — complementary secondary capsule (keeps the dual-media design). */}
        <button
          type="button"
          className="bmp-trigger bmp-trigger--listen"
          onClick={() => setOpen('listen')}
          data-testid={`${testId || `guide-${moduleId}`}-listen`}
        >
          <span aria-hidden="true">🔊</span> {S.listen}
        </button>
      </div>

      {open ? (
        <BbfMediaPortal module={mod} initialMode={open} onClose={() => setOpen(null)} />
      ) : null}
    </TierGate>
  );
}

export default BbfMediaPortal;
