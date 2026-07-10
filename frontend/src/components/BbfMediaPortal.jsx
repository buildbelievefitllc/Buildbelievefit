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
import './bbfMediaPortal.css';

// The 4K guides live in Supabase Storage (public bucket `bbf-media-vault/guides`),
// NOT in source control — keeps the repo lean and Render deploys fast. The origin is
// derived from VITE_SUPABASE_URL so it tracks the active project across environments,
// falling back to the canonical BBF project id when the env var is absent.
const SUPABASE_ORIGIN = import.meta.env.VITE_SUPABASE_URL || 'https://ihclbceghxpuawymlvgi.supabase.co';
const MEDIA_BASE = `${SUPABASE_ORIGIN}/storage/v1/object/public/bbf-media-vault/guides`;

// ── Guide registry — module id → assets + trilingual chrome ───────────────────
// `feature` is the Baseline-band entitlement key that gates playback (every active
// paid tier inherits Baseline, so validated clients pass while unentitled/expired
// accounts never see the triggers — render="hide").
const GUIDE_MODULES = {
  program_tracker: {
    feature: 'grid',
    video: `${MEDIA_BASE}/bbf_module_program_tracker_4k.mp4`,
    audio: `${MEDIA_BASE}/bbf_module_program_tracker_4k.mp4`,
    title: { en: 'Program Tracker Guide', es: 'Guía del Rastreador de Programa', pt: 'Guia do Rastreador de Programa' },
    sub: {
      en: 'How to read your phases, log every set, and let autoregulation drive the load.',
      es: 'Cómo leer tus fases, registrar cada serie y dejar que la autorregulación ajuste la carga.',
      pt: 'Como ler suas fases, registrar cada série e deixar a autorregulação ajustar a carga.',
    },
  },
  nutrition_locker: {
    feature: 'base_nutrition',
    video: `${MEDIA_BASE}/bbf_module_nutrition_locker_4k.mp4`,
    audio: `${MEDIA_BASE}/bbf_module_nutrition_locker_4k.mp4`,
    title: { en: 'Nutrition Locker Guide', es: 'Guía del Casillero de Nutrición', pt: 'Guia do Armário de Nutrição' },
    sub: {
      en: 'Working the fuel wheel — hit your macros, not just the recipe, meal by meal.',
      es: 'Cómo usar la rueda de combustible — acierta tus macros, no solo la receta, comida a comida.',
      pt: 'Como usar a roda de combustível — bata seus macros, não só a receita, refeição a refeição.',
    },
  },
  daily_protocol: {
    feature: 'readiness',
    video: `${MEDIA_BASE}/bbf_module_daily_protocol_4k.mp4`,
    audio: `${MEDIA_BASE}/bbf_module_daily_protocol_4k.mp4`,
    title: { en: 'Daily Protocol Guide', es: 'Guía del Protocolo Diario', pt: 'Guia do Protocolo Diário' },
    sub: {
      en: 'Build the streak — how your daily habits compound into readiness.',
      es: 'Construye la racha — cómo tus hábitos diarios se acumulan en preparación.',
      pt: 'Construa a sequência — como seus hábitos diários se acumulam em prontidão.',
    },
  },
  weekly_checkin: {
    feature: 'grid',
    video: `${MEDIA_BASE}/bbf_module_weekly_checkin_4k.mp4`,
    audio: `${MEDIA_BASE}/bbf_module_weekly_checkin_4k.mp4`,
    title: { en: 'Weekly Check-In Guide', es: 'Guía del Registro Semanal', pt: 'Guia do Check-In Semanal' },
    sub: {
      en: 'What every field on the check-in captures — and why honest numbers move you faster.',
      es: 'Qué captura cada campo del registro — y por qué los números honestos te hacen avanzar más rápido.',
      pt: 'O que cada campo do check-in captura — e por que números honestos te fazem avançar mais rápido.',
    },
  },
};

const STR = {
  en: { watch: 'Watch Guide', listen: 'Listen Only', close: 'Close', modeWatch: 'Watch Video', modeListen: 'Listen Only', audioNote: 'Audio only · streaming the coach track' },
  es: { watch: 'Ver Guía', listen: 'Solo Escuchar', close: 'Cerrar', modeWatch: 'Ver Video', modeListen: 'Solo Audio', audioNote: 'Solo audio · transmitiendo la pista del coach' },
  pt: { watch: 'Ver Guia', listen: 'Só Ouvir', close: 'Fechar', modeWatch: 'Ver Vídeo', modeListen: 'Só Áudio', audioNote: 'Só áudio · transmitindo a faixa do coach' },
};

const pick = (dict, lang) => dict[lang] || dict.en;

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

          <p className="bmp-sub">{sub}</p>
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
  const mod = GUIDE_MODULES[moduleId];

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
