// src/components/vault/PremiumSessionPlayer.jsx
// ─────────────────────────────────────────────────────────────────────────────
// PREMIUM SESSION PLAYER — Product 1 client surface (Program tab, Apex band,
// mounted inside <TierGate feature="premium_audio">). One card:
//
//   GENERATE → bbf-premium-session-composer compiles today's programming into a
//   play contract (cache-first server-side — the second tap of the day is free).
//   PLAY     → the two-layer engine (lib/premiumSessionAudio.js): Akeem narration
//   over the generated music bed, ducked under every cue.
//   LIVE HR  → the local inflection governor splices pre-baked pacing cues at
//   timeline seams when heart rate crosses the block's band — zero mid-workout
//   network calls. No wearable → the layer silently disables (house posture).
//
// Test seams (harness): `fetchManifest` overrides the composer call;
// `hrSource` overrides the Health Connect subscription.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import { fetchPremiumSession, resignPremiumAssets } from '../../lib/premiumSessionApi.js';
import { createPremiumSessionPlayer } from '../../lib/premiumSessionAudio.js';

const STR = {
  en: {
    title: 'Premium Session Audio', sub: 'Coach Akeem narrates today’s protocol over a live-composed track.',
    generate: 'Generate Today’s Session', composing: 'Composing…', play: 'Start Session', pause: 'Pause', resume: 'Resume', stop: 'End',
    hrOn: 'Biometric coaching armed', hrOff: 'No wearable signal — narration only',
    err: { quota_exhausted: 'Monthly voice quota reached.', no_program: 'No trainable programming found for today.', default: 'Session audio is unavailable right now.' },
    inflection: { INF_HR_LOW: 'Pace push injected', INF_HR_HIGH: 'Recovery hold injected', INF_ON_TARGET: 'In the zone' },
  },
  es: {
    title: 'Audio Premium de Sesión', sub: 'Coach Akeem narra el protocolo de hoy sobre una pista compuesta en vivo.',
    generate: 'Generar la Sesión de Hoy', composing: 'Componiendo…', play: 'Iniciar Sesión', pause: 'Pausar', resume: 'Reanudar', stop: 'Terminar',
    hrOn: 'Coaching biométrico armado', hrOff: 'Sin señal del wearable — solo narración',
    err: { quota_exhausted: 'Cuota mensual de voz alcanzada.', no_program: 'No hay programación entrenable para hoy.', default: 'El audio de sesión no está disponible ahora.' },
    inflection: { INF_HR_LOW: 'Ajuste de ritmo inyectado', INF_HR_HIGH: 'Pausa de recuperación inyectada', INF_ON_TARGET: 'En la zona' },
  },
  pt: {
    title: 'Áudio Premium de Sessão', sub: 'Coach Akeem narra o protocolo de hoje sobre uma trilha composta ao vivo.',
    generate: 'Gerar a Sessão de Hoje', composing: 'Compondo…', play: 'Iniciar Sessão', pause: 'Pausar', resume: 'Retomar', stop: 'Encerrar',
    hrOn: 'Coaching biométrico armado', hrOff: 'Sem sinal do wearable — apenas narração',
    err: { quota_exhausted: 'Cota mensal de voz atingida.', no_program: 'Nenhuma programação treinável para hoje.', default: 'O áudio da sessão não está disponível agora.' },
    inflection: { INF_HR_LOW: 'Ajuste de ritmo injetado', INF_HR_HIGH: 'Pausa de recuperação injetada', INF_ON_TARGET: 'Na zona' },
  },
};

export default function PremiumSessionPlayer({ plan, fetchManifest, hrSource }) {
  const { lang } = useLang();
  const tr = STR[lang] || STR.en;
  const [manifest, setManifest] = useState(null);
  const [phase, setPhase] = useState('idle');   // idle|composing|ready|playing|paused|ended|error
  const [error, setError] = useState(null);
  const [activeSlot, setActiveSlot] = useState(null);
  const [lastInflection, setLastInflection] = useState(null);
  const playerRef = useRef(null);

  useEffect(() => () => { playerRef.current?.destroy(); }, []);

  const hrArmed = useMemo(() => !!(manifest?.inflections && hrSource), [manifest, hrSource]);

  async function generate() {
    setPhase('composing');
    setError(null);
    try {
      const track = fetchManifest
        ? await fetchManifest({ plan, locale: lang })
        : await fetchPremiumSession({ plan, locale: lang });
      setManifest(track);
      setPhase('ready');
    } catch (e) {
      setError(tr.err[e?.message] || tr.err.default);
      setPhase('error');
    }
  }

  function start() {
    if (!manifest) return;
    if (!playerRef.current) {
      playerRef.current = createPremiumSessionPlayer(manifest, {
        hrSource,
        resign: (paths) => resignPremiumAssets(paths),
        onState: (s) => {
          if (s === 'playing') setPhase('playing');
          else if (s === 'paused') setPhase('paused');
          else if (s === 'ended') setPhase('ended');
          else if (s === 'idle') setPhase('ready');
        },
        onSlot: (slot) => setActiveSlot(slot),
        onInflection: (key) => setLastInflection(key),
      });
    }
    playerRef.current.play();
  }
  const pause = () => playerRef.current?.pause();
  const resume = () => playerRef.current?.resume();
  const stop = () => { playerRef.current?.stop(); setActiveSlot(null); setLastInflection(null); };

  return (
    <section style={styles.card} data-testid="premium-session-player">
      <div style={styles.head}>
        <div>
          <div style={styles.kicker}>✦ {tr.title}</div>
          <p style={styles.sub}>{tr.sub}</p>
        </div>
        <span
          style={{ ...styles.hrChip, ...(hrArmed ? styles.hrChipOn : null) }}
          data-testid="premium-hr-chip"
        >
          {hrArmed ? tr.hrOn : tr.hrOff}
        </span>
      </div>

      <div style={styles.controls}>
        {(phase === 'idle' || phase === 'error') && (
          <button type="button" style={styles.primary} onClick={generate} data-testid="premium-generate">
            {tr.generate}
          </button>
        )}
        {phase === 'composing' && (
          <button type="button" style={{ ...styles.primary, opacity: 0.6 }} disabled data-testid="premium-composing">
            {tr.composing}
          </button>
        )}
        {(phase === 'ready' || phase === 'ended') && (
          <button type="button" style={styles.primary} onClick={start} data-testid="premium-play">
            {tr.play}
          </button>
        )}
        {phase === 'playing' && (
          <>
            <button type="button" style={styles.secondary} onClick={pause} data-testid="premium-pause">{tr.pause}</button>
            <button type="button" style={styles.secondary} onClick={stop} data-testid="premium-stop">{tr.stop}</button>
          </>
        )}
        {phase === 'paused' && (
          <>
            <button type="button" style={styles.primary} onClick={resume} data-testid="premium-resume">{tr.resume}</button>
            <button type="button" style={styles.secondary} onClick={stop} data-testid="premium-stop">{tr.stop}</button>
          </>
        )}
      </div>

      {activeSlot ? (
        <div style={styles.slotLine} data-testid="premium-active-slot">{activeSlot}</div>
      ) : null}
      {lastInflection ? (
        <div style={styles.inflectionLine} data-testid="premium-inflection" data-inflection={lastInflection}>
          ⚡ {tr.inflection[lastInflection] || lastInflection}
        </div>
      ) : null}
      {error ? <div style={styles.err} data-testid="premium-error">{error}</div> : null}
    </section>
  );
}

const styles = {
  card: {
    background: 'var(--gry)', border: '1px solid var(--line)', borderRadius: 14,
    padding: '1rem 1.1rem', margin: '1rem 0',
  },
  head: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '.8rem', flexWrap: 'wrap' },
  kicker: {
    fontFamily: 'var(--hb)', fontSize: '.82rem', letterSpacing: '2px',
    textTransform: 'uppercase', color: 'var(--gold-soft)',
  },
  sub: { fontFamily: 'var(--bd)', fontSize: '.92rem', color: 'var(--mut)', margin: '.3rem 0 0', maxWidth: 460 },
  hrChip: {
    fontFamily: 'var(--hb)', fontSize: '.68rem', letterSpacing: '1.5px', textTransform: 'uppercase',
    border: '1px solid var(--line)', borderRadius: 999, padding: '.3rem .7rem', color: 'var(--mut)', whiteSpace: 'nowrap',
  },
  hrChipOn: { borderColor: 'var(--gold-soft)', color: 'var(--gold-soft)' },
  controls: { display: 'flex', gap: '.6rem', marginTop: '.9rem', flexWrap: 'wrap' },
  primary: {
    fontFamily: 'var(--hb)', fontSize: '.85rem', letterSpacing: '1.5px', textTransform: 'uppercase',
    background: 'linear-gradient(135deg, #6a0dad, #8b2fd6)', color: '#fff', border: 'none',
    borderRadius: 10, padding: '.65rem 1.2rem', cursor: 'pointer',
  },
  secondary: {
    fontFamily: 'var(--hb)', fontSize: '.85rem', letterSpacing: '1.5px', textTransform: 'uppercase',
    background: 'transparent', color: 'var(--wht)', border: '1px solid var(--line)',
    borderRadius: 10, padding: '.65rem 1.2rem', cursor: 'pointer',
  },
  slotLine: { fontFamily: 'var(--bd)', fontSize: '.82rem', color: 'var(--mut)', marginTop: '.7rem', letterSpacing: '1px' },
  inflectionLine: { fontFamily: 'var(--bd)', fontSize: '.88rem', color: 'var(--gold-soft)', marginTop: '.4rem' },
  err: { fontFamily: 'var(--bd)', fontSize: '.88rem', color: '#e0655f', marginTop: '.7rem' },
};
