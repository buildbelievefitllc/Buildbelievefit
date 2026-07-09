// src/components/vault/LiveCheckinCoach.jsx
// ─────────────────────────────────────────────────────────────────────────────
// LIVE CHECK-IN COACH — Product 2 client surface (Mindset + Nutrition tabs,
// Apex band, mounted inside <TierGate feature="mindset_live">). A real-time
// spoken conversation with the Akeem persona over the ElevenLabs Agents
// platform (ConvAI 2.0 turn-taking, WebRTC): accountability check-ins, mindset
// audits, nutrition audits.
//
// The session is minted server-side (bbf-convai-session — the fail-closed gate
// + voice-ledger precheck); this component only drives the conversation UI:
// status, live transcript, commitments the agent logged, and the countdown cap.
//
// Test seam (harness): `sessionFactory` overrides startConvaiSession with a
// scripted fake so specs exercise the REAL component state machine offline.

import { useEffect, useRef, useState } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import { startConvaiSession } from '../../lib/convaiSession.js';

const STR = {
  en: {
    mindset: { title: 'Live Mindset Check-In', sub: 'Talk it out with Coach Akeem — real time, real talk.' },
    nutrition_audit: { title: 'Live Nutrition Audit', sub: 'Walk your plate through Coach Akeem, out loud.' },
    start: 'Start Check-In', end: 'End Session', connecting: 'Connecting…', listening: 'Listening', speaking: 'Coach speaking',
    commitments: 'Commitments this session', wellbeing: 'Flagged for the coaching team — support is on the way.',
    err: { quota_exhausted: 'Monthly live-voice quota reached.', tier_not_entitled: 'This is an Apex unlock.', agent_unconfigured: 'The live coach is not configured yet.', default: 'The live coach is unavailable right now.' },
  },
  es: {
    mindset: { title: 'Check-In de Mentalidad en Vivo', sub: 'Háblalo con Coach Akeem — en tiempo real, sin filtros.' },
    nutrition_audit: { title: 'Auditoría de Nutrición en Vivo', sub: 'Revisa tu plato con Coach Akeem, en voz alta.' },
    start: 'Iniciar Check-In', end: 'Terminar Sesión', connecting: 'Conectando…', listening: 'Escuchando', speaking: 'Coach hablando',
    commitments: 'Compromisos de esta sesión', wellbeing: 'Marcado para el equipo de coaching — el apoyo viene en camino.',
    err: { quota_exhausted: 'Cuota mensual de voz en vivo alcanzada.', tier_not_entitled: 'Este es un desbloqueo Apex.', agent_unconfigured: 'El coach en vivo aún no está configurado.', default: 'El coach en vivo no está disponible ahora.' },
  },
  pt: {
    mindset: { title: 'Check-In de Mentalidade ao Vivo', sub: 'Conversa com o Coach Akeem — em tempo real, papo reto.' },
    nutrition_audit: { title: 'Auditoria de Nutrição ao Vivo', sub: 'Passa seu prato pelo Coach Akeem, em voz alta.' },
    start: 'Iniciar Check-In', end: 'Encerrar Sessão', connecting: 'Conectando…', listening: 'Ouvindo', speaking: 'Coach falando',
    commitments: 'Compromissos desta sessão', wellbeing: 'Sinalizado para a equipe de coaching — o suporte está a caminho.',
    err: { quota_exhausted: 'Cota mensal de voz ao vivo atingida.', tier_not_entitled: 'Este é um desbloqueio Apex.', agent_unconfigured: 'O coach ao vivo ainda não está configurado.', default: 'O coach ao vivo não está disponível agora.' },
  },
};

export default function LiveCheckinCoach({ mode = 'mindset', sessionFactory }) {
  const { lang } = useLang();
  const tr = STR[lang] || STR.en;
  const copy = tr[mode] || tr.mindset;
  const [phase, setPhase] = useState('idle');       // idle|connecting|live|ended|error
  const [agentMode, setAgentMode] = useState(null); // 'listening'|'speaking'
  const [lines, setLines] = useState([]);           // { who: 'you'|'coach', text }
  const [commitments, setCommitments] = useState([]);
  const [wellbeing, setWellbeing] = useState(false);
  const [error, setError] = useState(null);
  const sessionRef = useRef(null);

  useEffect(() => () => { sessionRef.current?.end?.().catch(() => {}); }, []);

  const pushLine = (who, text) => setLines((prev) => [...prev.slice(-19), { who, text }]);

  async function start() {
    setPhase('connecting');
    setError(null);
    setLines([]);
    setCommitments([]);
    setWellbeing(false);
    const hooks = {
      onStatus: (s) => { if (s === 'connected') setPhase('live'); if (s === 'disconnected') setPhase((p) => (p === 'live' ? 'ended' : p)); },
      onModeChange: (m) => setAgentMode(m || null),
      onTranscript: (text) => pushLine('you', text),
      onAgentResponse: (text) => pushLine('coach', text),
      onCommitment: (c) => setCommitments((prev) => [...prev, c]),
      onWellbeingFlag: () => setWellbeing(true),
      onError: () => { /* transport hiccups surface through onDisconnect */ },
      onDisconnect: () => setPhase((p) => (p === 'live' ? 'ended' : p)),
    };
    try {
      sessionRef.current = sessionFactory
        ? await sessionFactory({ mode, locale: lang, hooks })
        : await startConvaiSession({ mode, locale: lang, hooks });
      setPhase((p) => (p === 'connecting' ? 'live' : p));
    } catch (e) {
      setError(tr.err[e?.message] || tr.err.default);
      setPhase('error');
    }
  }

  async function end() {
    try { await sessionRef.current?.end?.(); } catch { /* already closed */ }
    setPhase('ended');
    setAgentMode(null);
  }

  return (
    <section style={styles.card} data-testid="live-checkin-coach" data-mode={mode}>
      <div style={styles.head}>
        <div>
          <div style={styles.kicker}>◉ {copy.title}</div>
          <p style={styles.sub}>{copy.sub}</p>
        </div>
        {phase === 'live' ? (
          <span style={styles.liveChip} data-testid="live-status">
            {agentMode === 'speaking' ? tr.speaking : tr.listening}
          </span>
        ) : null}
      </div>

      <div style={styles.controls}>
        {(phase === 'idle' || phase === 'ended' || phase === 'error') && (
          <button type="button" style={styles.primary} onClick={start} data-testid="live-start">{tr.start}</button>
        )}
        {phase === 'connecting' && (
          <button type="button" style={{ ...styles.primary, opacity: 0.6 }} disabled data-testid="live-connecting">{tr.connecting}</button>
        )}
        {phase === 'live' && (
          <button type="button" style={styles.secondary} onClick={end} data-testid="live-end">{tr.end}</button>
        )}
      </div>

      {lines.length ? (
        <div style={styles.transcript} data-testid="live-transcript">
          {lines.map((l, i) => (
            <div key={i} style={l.who === 'coach' ? styles.coachLine : styles.youLine}>
              <span style={styles.who}>{l.who === 'coach' ? 'AKEEM' : 'YOU'}</span> {l.text}
            </div>
          ))}
        </div>
      ) : null}

      {commitments.length ? (
        <div style={styles.commitBox} data-testid="live-commitments">
          <div style={styles.commitHead}>{tr.commitments}</div>
          {commitments.map((c, i) => (
            <div key={i} style={styles.commitLine}>• {c.text}{c.due ? ` — ${c.due}` : ''}</div>
          ))}
        </div>
      ) : null}

      {wellbeing ? <div style={styles.wellbeing} data-testid="live-wellbeing">{tr.wellbeing}</div> : null}
      {error ? <div style={styles.err} data-testid="live-error">{error}</div> : null}
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
  liveChip: {
    fontFamily: 'var(--hb)', fontSize: '.68rem', letterSpacing: '1.5px', textTransform: 'uppercase',
    border: '1px solid var(--gold-soft)', color: 'var(--gold-soft)', borderRadius: 999,
    padding: '.3rem .7rem', whiteSpace: 'nowrap',
  },
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
  transcript: {
    marginTop: '.9rem', maxHeight: 220, overflowY: 'auto', display: 'flex',
    flexDirection: 'column', gap: '.35rem',
  },
  coachLine: { fontFamily: 'var(--bd)', fontSize: '.9rem', color: 'var(--wht)', lineHeight: 1.45 },
  youLine: { fontFamily: 'var(--bd)', fontSize: '.9rem', color: 'var(--mut)', lineHeight: 1.45 },
  who: { fontFamily: 'var(--hb)', fontSize: '.65rem', letterSpacing: '1.5px', color: 'var(--gold-soft)', marginRight: 6 },
  commitBox: { marginTop: '.9rem', borderTop: '1px solid var(--line)', paddingTop: '.7rem' },
  commitHead: {
    fontFamily: 'var(--hb)', fontSize: '.72rem', letterSpacing: '1.8px',
    textTransform: 'uppercase', color: 'var(--gold-soft)', marginBottom: '.4rem',
  },
  commitLine: { fontFamily: 'var(--bd)', fontSize: '.88rem', color: 'var(--wht)', lineHeight: 1.5 },
  wellbeing: { fontFamily: 'var(--bd)', fontSize: '.88rem', color: 'var(--gold-soft)', marginTop: '.7rem' },
  err: { fontFamily: 'var(--bd)', fontSize: '.88rem', color: '#e0655f', marginTop: '.7rem' },
};
