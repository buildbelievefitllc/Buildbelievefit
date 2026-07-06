// src/components/vault/GeneratorVoiceBox.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Coach Akeem orientation voice box — Vault Roster Engine.
//
// Plays a pre-baked static MP3 from /audio/coach-edu/<scriptKey>.<locale>.mp3.
// No live API call, no fallback — clips are baked once via bbf-bake-coach-edu
// and shipped static. Pure <audio> element, same pattern as CoachVoiceNote.
//
// Three states driven by isUnlimited + tokenSpent:
//   gen-available — standard client, token unused: full orientation
//   gen-spent     — standard client, token used: commit + route to Program
//   gen-unlimited — admin/CEO: authoring-mode briefing
//
// Trilingual: EN / ES / PT.

import { useRef, useState } from 'react';
import { useLang } from '../../context/LangContext.jsx';

const CHROME = {
  en: { eyebrow: 'Coach Akeem · Vault Briefing', cueing: 'Loading…', listen: 'Listen to Coach Akeem', pause: 'Pause', replay: 'Replay', err: 'Coach voice unavailable.' },
  es: { eyebrow: 'Coach Akeem · Briefing del Cofre', cueing: 'Cargando…', listen: 'Escucha al Coach Akeem', pause: 'Pausar', replay: 'Repetir', err: 'Voz del coach no disponible.' },
  pt: { eyebrow: 'Coach Akeem · Briefing do Cofre', cueing: 'Carregando…', listen: 'Ouça o Coach Akeem', pause: 'Pausar', replay: 'Repetir', err: 'Voz do coach indisponível.' },
};

const TITLES = {
  en: {
    'gen-available': { title: 'Welcome to the Vault Roster Engine', topic: '8-parameter design · 3 signature splits · 1 blueprint this month' },
    'gen-spent':     { title: 'Blueprint Generated — Now Execute It', topic: 'Your program is live · Consistency is the protocol' },
    'gen-unlimited': { title: 'Vault Roster Engine — Authoring Mode', topic: 'Unlimited access · Signature chamber splits · Roster push' },
  },
  es: {
    'gen-available': { title: 'Bienvenido al Motor de Roster del Cofre', topic: 'Diseño de 8 parámetros · 3 splits insignia · 1 plan este mes' },
    'gen-spent':     { title: 'Plan Generado — Ahora Ejecútalo', topic: 'Tu programa está activo · La consistencia es el protocolo' },
    'gen-unlimited': { title: 'Motor de Roster — Modo de Autoría', topic: 'Acceso ilimitado · Splits de cámara insignia · Envío al roster' },
  },
  pt: {
    'gen-available': { title: 'Bem-vindo ao Motor de Roster do Cofre', topic: 'Design de 8 parâmetros · 3 splits assinatura · 1 plano este mês' },
    'gen-spent':     { title: 'Plano Gerado — Agora Execute', topic: 'Seu programa está ativo · Consistência é o protocolo' },
    'gen-unlimited': { title: 'Motor de Roster — Modo de Autoria', topic: 'Acesso ilimitado · Splits de câmara assinatura · Envio ao roster' },
  },
};

async function playWhenReady(node) {
  const waitReady = () => new Promise((resolve) => {
    if (node.readyState >= 2) { resolve(); return; }
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      node.removeEventListener('loadeddata', done);
      node.removeEventListener('canplay', done);
      node.removeEventListener('error', done);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(done, 6000);
    node.addEventListener('loadeddata', done, { once: true });
    node.addEventListener('canplay', done, { once: true });
    node.addEventListener('error', done, { once: true });
  });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await waitReady();
    try { await node.play(); return true; } catch { /* retry */ }
  }
  return false;
}

export default function GeneratorVoiceBox({ isUnlimited, tokenSpent }) {
  const { lang } = useLang();
  const tr = CHROME[lang] || CHROME.en;
  const titles = TITLES[lang] || TITLES.en;
  const scriptKey = isUnlimited ? 'gen-unlimited' : tokenSpent ? 'gen-spent' : 'gen-available';
  const { title, topic } = titles[scriptKey];
  const src = `/audio/coach-edu/${scriptKey}.${lang}.mp3`;

  const audioRef = useRef(null);
  // loadedSrc tracks what's currently loaded so we know when to re-load.
  const loadedSrcRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [showErr, setShowErr] = useState(false);
  // hasPlayed is only meaningful for the currently loaded src.
  const [playedSrc, setPlayedSrc] = useState(null);
  const hasPlayed = playedSrc === src;

  async function onClick() {
    if (busy) return;
    const el = audioRef.current;
    if (!el) return;

    // Toggle pause/resume for the already-loaded clip.
    if (loadedSrcRef.current === src && !el.paused) { el.pause(); return; }

    setBusy(true);
    setShowErr(false);

    // Load fresh if src changed.
    if (loadedSrcRef.current !== src) {
      el.pause();
      el.src = src;
      el.load();
      loadedSrcRef.current = src;
    } else {
      el.currentTime = 0;
    }

    const ok = await playWhenReady(el);
    if (!ok) setShowErr(true);
    setBusy(false);
  }

  const btnLabel = busy ? tr.cueing : playing ? tr.pause : hasPlayed ? tr.replay : tr.listen;

  return (
    <div
      className="cvn cvn--gate"
      data-playing={playing ? '1' : '0'}
      data-script={scriptKey}
    >
      <button
        type="button"
        className="cvn-btn"
        onClick={onClick}
        disabled={busy}
        aria-label={`${title} — ${btnLabel}`}
      >
        <span className="cvn-ic" aria-hidden="true">
          {busy ? '◌' : playing ? '❚❚' : '▶'}
        </span>
      </button>

      <div className="cvn-body">
        <div className="cvn-eyebrow">
          <span className="cvn-mic" aria-hidden="true">🎙</span>{tr.eyebrow}
        </div>
        <div className="cvn-title">{title}</div>
        <div className="cvn-topic">{topic}</div>
        {showErr ? <div className="cvn-topic" style={{ color: 'var(--bbf-gold)' }}>{tr.err}</div> : null}
      </div>

      <span className={`cvn-eq${playing ? ' is-live' : ''}`} aria-hidden="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <span key={i} className="cvn-bar" style={{ animationDelay: `${i * 120}ms` }} />
        ))}
      </span>

      <audio
        ref={audioRef}
        preload="none"
        onPlay={() => { setPlaying(true); setPlayedSrc(src); }}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => { if (!busy) setShowErr(true); }}
      />
    </div>
  );
}
