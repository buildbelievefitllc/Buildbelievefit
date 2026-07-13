// src/components/vault/RecoveryQuestionsGate.jsx
// ─────────────────────────────────────────────────────────────────────────────
// First-login setup gate for knowledge-based PIN recovery. Prompts a Pathfinder
// client (role='client') — the population the CEO flagged, as opposed to the
// hardwired Founder Five / staff who use the email reset — to set TWO security
// questions once, so a future lost PIN self-resolves at the Login recovery gate
// without leaning on email.
//
// Why here (first login), not in the Pathfinder intake: the intake is anonymous
// and pre-payment (no account exists yet, and it's a single-page public form).
// Collecting the recovery secret against a LIVE authenticated session (the 24h
// vault_token) is the hardened choice AND covers the existing roster.
//
// Behavior (mirrors the Concierge first-login pattern):
//   • Self-gates: only role='client', only when bbf_recovery_status says unset.
//   • Renders nothing until that async check resolves — never blocks first paint.
//   • Dismissible ("Set up later") for the session; re-prompts next login until
//     set (status is server truth), never nags across in-session tab switches.
//   • Answers are hashed server-side; this component never sees or stores a hash.
//
// Brand (§2): matte-black canvas (approved surface), GOLD accents, PURPLE CTA.

import { useEffect, useRef, useState } from 'react';
import { useAuth, getStoredVaultToken } from '../../context/AuthContext.jsx';
import { useLang } from '../../context/LangContext.jsx';
import { SECURITY_QUESTIONS } from '../../lib/securityQuestions.js';
import { getRecoveryStatus, setRecoveryQuestions } from '../../lib/recoveryApi.js';

const DISMISS_PREFIX = 'bbf.recoveryGate.dismissed.';
function dismissKey(uid) { return DISMISS_PREFIX + String(uid || '').trim().toLowerCase(); }
function isDismissed(uid) {
  try { return !!sessionStorage.getItem(dismissKey(uid)); } catch { return false; }
}
function markDismissed(uid) {
  try { sessionStorage.setItem(dismissKey(uid), '1'); } catch { /* storage blocked */ }
}

const T = {
  title: { en: 'Secure your account', es: 'Asegura tu cuenta', pt: 'Proteja sua conta' },
  sub: {
    en: 'Set two security questions so you can reset your own PIN if you ever forget it — no waiting on your coach.',
    es: 'Configura dos preguntas de seguridad para poder restablecer tu propio PIN si lo olvidas, sin esperar a tu entrenador.',
    pt: 'Configure duas perguntas de segurança para poder redefinir seu próprio PIN caso o esqueça — sem esperar pelo seu treinador.',
  },
  q: { en: 'Question', es: 'Pregunta', pt: 'Pergunta' },
  answer: { en: 'Your answer', es: 'Tu respuesta', pt: 'Sua resposta' },
  save: { en: 'Save & Secure', es: 'Guardar y proteger', pt: 'Salvar e proteger' },
  later: { en: 'Set up later', es: 'Configurar más tarde', pt: 'Configurar depois' },
  distinct: { en: 'Please choose two different questions.', es: 'Elige dos preguntas diferentes.', pt: 'Escolha duas perguntas diferentes.' },
  tooShort: { en: 'Each answer must be at least 2 characters.', es: 'Cada respuesta debe tener al menos 2 caracteres.', pt: 'Cada resposta deve ter pelo menos 2 caracteres.' },
  failed: { en: "Couldn't save — please try again.", es: 'No se pudo guardar — inténtalo de nuevo.', pt: 'Não foi possível salvar — tente novamente.' },
  done: { en: "You're secured. You can now reset your PIN with these questions.", es: 'Listo. Ahora puedes restablecer tu PIN con estas preguntas.', pt: 'Pronto. Agora você pode redefinir seu PIN com estas perguntas.' },
};

const S = {
  backdrop: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,.72)', backdropFilter: 'blur(3px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', zIndex: 92,
  },
  panel: {
    width: '460px', maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto',
    background: '#0f0f0f', color: '#fff', border: '1px solid #6a0dad', borderRadius: '16px',
    padding: '22px 22px 18px', boxShadow: '0 18px 60px rgba(0,0,0,.6)',
  },
  title: { fontFamily: 'Bebas Neue, sans-serif', fontSize: '1.7rem', letterSpacing: '1px', margin: 0, color: '#fff' },
  gold: { color: '#f5c800' },
  sub: { fontFamily: 'Barlow Condensed, sans-serif', fontSize: '.98rem', color: '#bdbdbd', lineHeight: 1.4, margin: '.5rem 0 1.2rem' },
  label: { display: 'block', fontFamily: 'Bebas Neue, sans-serif', fontSize: '.8rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#8a8a8a', margin: '0 0 .35rem' },
  select: {
    width: '100%', boxSizing: 'border-box', background: '#0b0b0b', border: '1px solid #2a2a2a',
    borderRadius: '10px', color: '#fff', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '1rem',
    padding: '.7rem .8rem', marginBottom: '.6rem', minHeight: '46px',
  },
  input: {
    width: '100%', boxSizing: 'border-box', background: '#0b0b0b', border: '1px solid #2a2a2a',
    borderRadius: '10px', color: '#fff', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '1rem',
    fontWeight: 600, padding: '.7rem .8rem', minHeight: '46px',
  },
  block: { marginBottom: '1rem' },
  cta: {
    width: '100%', marginTop: '.4rem', minHeight: '50px', border: 'none', borderRadius: '11px',
    cursor: 'pointer', fontFamily: 'Bebas Neue, sans-serif', fontSize: '1.05rem', letterSpacing: '1.5px',
    textTransform: 'uppercase', color: '#fff', background: '#6a0dad', boxShadow: '0 10px 26px -12px rgba(106,13,173,.8)',
  },
  later: {
    width: '100%', marginTop: '.6rem', background: 'none', border: 'none', cursor: 'pointer',
    fontFamily: 'Barlow Condensed, sans-serif', fontSize: '.9rem', fontWeight: 600, color: '#8a8a8a',
  },
  msg: { minHeight: '1.1rem', marginTop: '.8rem', textAlign: 'center', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '.92rem', fontWeight: 600 },
  err: { color: '#ff6b6b' },
  ok: { color: '#f5c800' },
};

export default function RecoveryQuestionsGate() {
  const { user } = useAuth();
  const { lang } = useLang();
  const tt = (m) => (T[m]?.[lang] ?? T[m]?.en ?? '');
  const uid = user?.username || '';
  const isClient = String(user?.role || '').trim().toLowerCase() === 'client';

  const [show, setShow] = useState(false);
  const [q1, setQ1] = useState(SECURITY_QUESTIONS[0].key);
  const [a1, setA1] = useState('');
  const [q2, setQ2] = useState(SECURITY_QUESTIONS[1].key);
  const [a2, setA2] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { kind:'err'|'ok', text }
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    if (!isClient || !uid || isDismissed(uid)) return undefined;
    (async () => {
      const status = await getRecoveryStatus(getStoredVaultToken());
      // Only prompt when the check succeeded AND the client genuinely has none set.
      // A failed check (no session / RPC error) stays silent — never trap anyone.
      if (alive.current && status.ok && !status.set) setShow(true);
    })();
    return () => { alive.current = false; };
  }, [isClient, uid]);

  if (!show) return null;

  const dismiss = () => { markDismissed(uid); setShow(false); };

  async function save() {
    if (busy) return;
    if (q1 === q2) { setMsg({ kind: 'err', text: tt('distinct') }); return; }
    if (a1.trim().length < 2 || a2.trim().length < 2) { setMsg({ kind: 'err', text: tt('tooShort') }); return; }

    setBusy(true);
    setMsg(null);
    const res = await setRecoveryQuestions(getStoredVaultToken(), [
      { slot: 1, question_key: q1, answer: a1.trim() },
      { slot: 2, question_key: q2, answer: a2.trim() },
    ]);
    if (!alive.current) return;
    setBusy(false);
    if (!res.ok) { setMsg({ kind: 'err', text: tt('failed') }); return; }
    setMsg({ kind: 'ok', text: tt('done') });
    // Mark dismissed so it won't re-prompt this session, then close shortly after.
    markDismissed(uid);
    setTimeout(() => { if (alive.current) setShow(false); }, 1400);
  }

  const opts = (excludeKey) => SECURITY_QUESTIONS.filter((x) => x.key !== excludeKey);

  return (
    <div style={S.backdrop} role="dialog" aria-modal="true" aria-label={tt('title')}>
      <div style={S.panel}>
        <h2 style={S.title}>Secure your <span style={S.gold}>Vault</span></h2>
        <p style={S.sub}>{tt('sub')}</p>

        <div style={S.block}>
          <label style={S.label}>{tt('q')} 1</label>
          <select style={S.select} value={q1} disabled={busy} onChange={(e) => setQ1(e.target.value)}>
            {opts(q2).map((x) => <option key={x.key} value={x.key}>{x[lang] || x.en}</option>)}
          </select>
          <input
            style={S.input} type="text" autoComplete="off" placeholder={tt('answer')}
            value={a1} disabled={busy} onChange={(e) => setA1(e.target.value)}
          />
        </div>

        <div style={S.block}>
          <label style={S.label}>{tt('q')} 2</label>
          <select style={S.select} value={q2} disabled={busy} onChange={(e) => setQ2(e.target.value)}>
            {opts(q1).map((x) => <option key={x.key} value={x.key}>{x[lang] || x.en}</option>)}
          </select>
          <input
            style={S.input} type="text" autoComplete="off" placeholder={tt('answer')}
            value={a2} disabled={busy} onChange={(e) => setA2(e.target.value)}
          />
        </div>

        <button style={S.cta} type="button" onClick={save} disabled={busy}>
          {busy ? '…' : tt('save')}
        </button>
        <button style={S.later} type="button" onClick={dismiss} disabled={busy}>
          {tt('later')}
        </button>

        {msg ? (
          <div style={{ ...S.msg, ...(msg.kind === 'err' ? S.err : S.ok) }} role="status" aria-live="polite">
            {msg.text}
          </div>
        ) : <div style={S.msg} />}
      </div>
    </div>
  );
}
