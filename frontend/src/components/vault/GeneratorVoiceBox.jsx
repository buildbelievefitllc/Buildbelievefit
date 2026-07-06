// src/components/vault/GeneratorVoiceBox.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Coach Akeem voice orientation box — Vault Roster Engine.
//
// PRIMARY path: BBF Coach Akeem's cloned ElevenLabs voice via bbf-tts-eleven
// (feature: 'virtual_coach' → Floor Coach · turbo). Falls back to browser TTS
// ONLY if ElevenLabs errors (billing block, network, etc) — never as the primary.
//
// Three context-aware scripts selected from isUnlimited + tokenSpent:
//
//   unlimited  → admin / CEO: brief authoring-mode briefing, no limit mentioned
//   available  → standard client, token unused: full orientation — 8 parameters,
//                3 signature chamber splits, access confirmed, 1 blueprint/month
//                limit + the reason (consistency — execute it, don't redesign)
//   spent      → standard client, token used: reinforce commitment, route to Program
//
// Visual shell re-uses the locked .cvn class system (coachVoiceNote.css).
// Trilingual: EN / ES / PT.

import { useEffect, useRef, useState } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import { requestCoachVoice, decodeAudio, COACH_FEATURE } from '../../lib/voiceCoachApi.js';
import { speakWithBrowser, warmUpSpeech, browserSpeechSupported } from '../../lib/speechFallback.js';

// ── Scripted copy (3 states × 3 languages) ───────────────────────────────────
const SCRIPTS = {
  en: {
    unlimited: {
      title: 'Vault Roster Engine — Authoring Mode',
      topic: 'Unlimited access · Signature chamber splits · Roster push',
      text: "Vault Roster Engine — authoring mode. Unlimited access. Design blueprints, activate any of the three Signature Chamber Splits — Arnold Era Classic, FST-7 Fascia Expand, or Elite NASM Clinical — reshuffle at will, and push blueprints directly to your athlete roster from the Deployment Bay below.",
    },
    available: {
      title: 'Welcome to the Vault Roster Engine',
      topic: '8-parameter design · 3 signature splits · 1 blueprint this month',
      text: "Welcome to the Vault Roster Engine — your personal program design studio. You have full access. Here you dial in your training with eight precision parameters: training priority, athletic gender focus, experience level, equipment availability, weekly frequency, workout pace, splits architecture, and intensifier technique. Or activate one of my three Signature Chamber Splits — Arnold Era Classic, FST-7 Fascia Expand, or Elite NASM Clinical — loaded directly from my golden-era protocols. You get one blueprint per month. That limit is intentional. A program works when you work it. Your job is to execute what you generate, not keep redesigning. Build it, commit to it, dominate it. See you next month with a new base to build from.",
    },
    spent: {
      title: 'Blueprint Generated — Now Execute It',
      topic: 'Your program is live · Consistency is the protocol',
      text: "You've generated your blueprint for this month — now execute it. The one-blueprint-per-month discipline is not a restriction, it's the protocol. Programs produce results through consistent repetition, not constant redesign. Your program is live in your Program tab. Go run it. Come back next month with a new base to build from.",
    },
  },
  es: {
    unlimited: {
      title: 'Motor de Roster — Modo de Autoría',
      topic: 'Acceso ilimitado · Splits de cámara insignia · Envío al roster',
      text: "Motor de Roster del Cofre — modo de autoría. Acceso ilimitado. Diseña planes, activa cualquiera de los tres Splits de Cámara Insignia — Arnold Era Classic, FST-7 Fascia Expand o Elite NASM Clinical — rebaraja a voluntad y envía planes directamente al roster de tus atletas desde la Bahía de Despliegue.",
    },
    available: {
      title: 'Bienvenido al Motor de Roster del Cofre',
      topic: 'Diseño de 8 parámetros · 3 splits insignia · 1 plan este mes',
      text: "Bienvenido al Motor de Roster del Cofre — tu estudio personal de diseño de programas. Tienes acceso completo. Aquí ajustas tu entrenamiento con ocho parámetros de precisión: prioridad de entrenamiento, enfoque de género atlético, nivel de experiencia, disponibilidad de equipo, frecuencia semanal, ritmo de entrenamiento, arquitectura de splits y técnica intensificadora. O activa uno de mis tres Splits de Cámara Insignia — cargados directamente desde mis protocolos de la era dorada. Tienes un plan por mes. Ese límite es intencional. Un programa funciona cuando tú lo ejecutas. Tu trabajo es hacer lo que generas, no seguir rediseñando. Constrúyelo, comprométete con él, domínalo. Nos vemos el próximo mes con una nueva base.",
    },
    spent: {
      title: 'Plan Generado — Ahora Ejecútalo',
      topic: 'Tu programa está activo · La consistencia es el protocolo',
      text: "Has generado tu plan este mes — ahora ejecútalo. La disciplina de un plan por mes no es una restricción, es el protocolo. Los programas producen resultados a través de la repetición constante, no del rediseño continuo. Tu programa está activo en tu pestaña de Programa. Ve a ejecutarlo. Vuelve el próximo mes con una nueva base.",
    },
  },
  pt: {
    unlimited: {
      title: 'Motor de Roster — Modo de Autoria',
      topic: 'Acesso ilimitado · Splits de câmara assinatura · Envio ao roster',
      text: "Motor de Roster do Cofre — modo de autoria. Acesso ilimitado. Crie planos, ative qualquer um dos três Splits de Câmara Assinatura — Arnold Era Classic, FST-7 Fascia Expand ou Elite NASM Clinical — reembaralhe à vontade e envie planos diretamente ao roster dos seus atletas pela Baía de Implantação.",
    },
    available: {
      title: 'Bem-vindo ao Motor de Roster do Cofre',
      topic: 'Design de 8 parâmetros · 3 splits assinatura · 1 plano este mês',
      text: "Bem-vindo ao Motor de Roster do Cofre — seu estúdio pessoal de design de programas. Você tem acesso completo. Aqui você ajusta seu treino com oito parâmetros de precisão: prioridade de treino, foco de gênero atlético, nível de experiência, disponibilidade de equipamento, frequência semanal, ritmo de treino, arquitetura de splits e técnica intensificadora. Ou ative um dos meus três Splits de Câmara Assinatura — carregados diretamente dos meus protocolos da era de ouro. Você tem um plano por mês. Esse limite é intencional. Um programa funciona quando você o executa. Seu trabalho é executar o que você gera, não ficar redesenhando. Construa, comprometa-se, domine. Nos vemos no próximo mês com uma nova base.",
    },
    spent: {
      title: 'Plano Gerado — Agora Execute',
      topic: 'Seu programa está ativo · Consistência é o protocolo',
      text: "Você gerou seu plano este mês — agora execute. A disciplina de um plano por mês não é uma restrição, é o protocolo. Programas produzem resultados através de repetição consistente, não de redesenho constante. Seu programa está ativo na aba Programa. Vá executá-lo. Volte no próximo mês com uma nova base.",
    },
  },
};

const CHROME = {
  en: { eyebrow: 'Coach Akeem · Vault Briefing', cueing: 'Cueing Coach…', listen: 'Listen to Coach Akeem', pause: 'Pause', replay: 'Replay', err: 'Coach voice unavailable.' },
  es: { eyebrow: 'Coach Akeem · Briefing del Cofre', cueing: 'Preparando Coach…', listen: 'Escucha al Coach Akeem', pause: 'Pausar', replay: 'Repetir', err: 'Voz del coach no disponible.' },
  pt: { eyebrow: 'Coach Akeem · Briefing do Cofre', cueing: 'Preparando Coach…', listen: 'Ouça o Coach Akeem', pause: 'Pausar', replay: 'Repetir', err: 'Voz do coach indisponível.' },
};

// Wait for the audio element to be decodable before calling play() — same
// pattern as CoachAudioButton to prevent "unavailable" on the first tap.
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
    const timer = setTimeout(done, 4000);
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
  const scripts = SCRIPTS[lang] || SCRIPTS.en;
  const scriptKey = isUnlimited ? 'unlimited' : tokenSpent ? 'spent' : 'available';
  const script = scripts[scriptKey];

  const audioRef = useRef(null);
  const stockRef = useRef(null);
  const busyRef = useRef(false);
  const revokeRef = useRef(null);
  const loadedLangRef = useRef(null);

  const [url, setUrl] = useState(null);
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [showErr, setShowErr] = useState(false);
  const [usingStock, setUsingStock] = useState(false);

  // Revoke the blob URL on unmount or when a new one is set.
  useEffect(() => () => { revokeRef.current?.(); }, []);

  // When the script key changes (token spent mid-session), stop any active
  // playback and reset so the next tap delivers the correct script.
  useEffect(() => {
    const el = audioRef.current;
    if (el && !el.paused) { el.pause(); el.src = ''; }
    stockRef.current?.stop?.();
    stockRef.current = null;
    revokeRef.current?.();
    revokeRef.current = null;
    setUrl(null);
    setPlaying(false);
    setHasPlayed(false);
    setUsingStock(false);
    setShowErr(false);
    loadedLangRef.current = null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptKey]);

  async function onClick() {
    if (busy) return;

    // Toggle cached ElevenLabs clip (same language).
    const el = audioRef.current;
    if (url && el && loadedLangRef.current === lang) {
      if (playing) el.pause(); else el.play().catch(() => setShowErr(true));
      return;
    }
    // Stop active stock-voice fallback.
    if (stockRef.current) {
      stockRef.current.stop?.();
      stockRef.current = null;
      setPlaying(false);
      return;
    }

    warmUpSpeech(); // unlock iOS speechSynthesis inside the click gesture
    busyRef.current = true;
    setBusy(true);
    setShowErr(false);
    setUsingStock(false);

    try {
      // PRIMARY: BBF Coach Akeem via bbf-tts-eleven (virtual_coach feature).
      const { audioBase64, mime } = await requestCoachVoice({
        feature: COACH_FEATURE,
        text: script.text,
      });
      const { url: blobUrl, revoke } = decodeAudio(audioBase64, mime);
      revokeRef.current?.();
      revokeRef.current = revoke;
      loadedLangRef.current = lang;
      setUrl(blobUrl);
      const node = audioRef.current;
      if (node) {
        node.src = blobUrl;
        node.load();
        const ok = await playWhenReady(node);
        if (!ok) setShowErr(true);
        else setHasPlayed(true);
      }
    } catch {
      // FAILURE-ONLY fallback: browser TTS. Never the primary.
      if (browserSpeechSupported()) {
        try {
          setUsingStock(true);
          stockRef.current = await speakWithBrowser({
            text: script.text,
            lang,
            voiceGender: 'male',
            rate: 0.95,
            onEnd: () => { setPlaying(false); setUsingStock(false); stockRef.current = null; },
            onError: () => { setShowErr(true); setPlaying(false); setUsingStock(false); stockRef.current = null; },
          });
          setPlaying(true);
          setHasPlayed(true);
        } catch { setShowErr(true); setUsingStock(false); }
      } else {
        setShowErr(true);
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const btnLabel = busy ? tr.cueing
    : playing ? tr.pause
    : hasPlayed ? tr.replay
    : tr.listen;

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
        aria-label={`${script.title} — ${btnLabel}`}
      >
        <span className="cvn-ic" aria-hidden="true">
          {busy ? '◌' : playing ? '❚❚' : '▶'}
        </span>
      </button>

      <div className="cvn-body">
        <div className="cvn-eyebrow">
          <span className="cvn-mic" aria-hidden="true">🎙</span>{tr.eyebrow}
        </div>
        <div className="cvn-title">{script.title}</div>
        <div className="cvn-topic">{script.topic}</div>
        {usingStock ? <div className="cvn-topic" style={{ opacity: 0.5 }}>· stock voice</div> : null}
        {showErr ? <div className="cvn-topic" style={{ color: 'var(--bbf-gold)' }}>{tr.err}</div> : null}
      </div>

      <span className={`cvn-eq${playing ? ' is-live' : ''}`} aria-hidden="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <span key={i} className="cvn-bar" style={{ animationDelay: `${i * 120}ms` }} />
        ))}
      </span>

      <audio
        ref={audioRef}
        src={url || undefined}
        preload="none"
        onPlay={() => { setPlaying(true); setHasPlayed(true); }}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => { if (url && !busyRef.current) setShowErr(true); }}
      />
    </div>
  );
}
