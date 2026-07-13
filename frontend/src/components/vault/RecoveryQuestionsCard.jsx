// src/components/vault/RecoveryQuestionsCard.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Settings surface for managing PIN-recovery security questions. Lets a signed-in
// client set them (if the first-login gate was skipped) or update them anytime.
// Shares the recoveryApi + trilingual question bank with the first-login gate;
// answers are hashed server-side and never returned here.

import { useEffect, useRef, useState } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import { getStoredVaultToken } from '../../context/AuthContext.jsx';
import { SECURITY_QUESTIONS } from '../../lib/securityQuestions.js';
import { getRecoveryStatus, setRecoveryQuestions } from '../../lib/recoveryApi.js';

const T = {
  title: { en: 'PIN Recovery Questions', es: 'Preguntas de Recuperación de PIN', pt: 'Perguntas de Recuperação de PIN' },
  set: { en: 'Set — you can reset your own PIN.', es: 'Configuradas — puedes restablecer tu PIN.', pt: 'Configuradas — você pode redefinir seu PIN.' },
  unset: { en: 'Not set yet — set two so you can reset a lost PIN yourself.', es: 'Sin configurar — configura dos para restablecer un PIN perdido.', pt: 'Não configuradas — configure duas para redefinir um PIN perdido.' },
  q: { en: 'Question', es: 'Pregunta', pt: 'Pergunta' },
  answer: { en: 'Your answer', es: 'Tu respuesta', pt: 'Sua resposta' },
  manage: { en: 'Set / update questions', es: 'Configurar / actualizar', pt: 'Configurar / atualizar' },
  save: { en: 'Save', es: 'Guardar', pt: 'Salvar' },
  cancel: { en: 'Cancel', es: 'Cancelar', pt: 'Cancelar' },
  distinct: { en: 'Choose two different questions.', es: 'Elige dos preguntas diferentes.', pt: 'Escolha duas perguntas diferentes.' },
  tooShort: { en: 'Each answer needs at least 2 characters.', es: 'Cada respuesta necesita al menos 2 caracteres.', pt: 'Cada resposta precisa de pelo menos 2 caracteres.' },
  failed: { en: "Couldn't save — try again.", es: 'No se pudo guardar — inténtalo de nuevo.', pt: 'Não foi possível salvar — tente novamente.' },
  done: { en: 'Saved.', es: 'Guardado.', pt: 'Salvo.' },
};

const box = { background: '#0b0b0b', border: '1px solid #2a2a2a', borderRadius: '10px', color: '#fff', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '1rem', padding: '.6rem .7rem', minHeight: '44px', width: '100%', boxSizing: 'border-box', marginTop: '.4rem' };

export default function RecoveryQuestionsCard() {
  const { lang } = useLang();
  const tt = (m) => (T[m]?.[lang] ?? T[m]?.en ?? '');

  const [status, setStatus] = useState(null); // { set } | null
  const [editing, setEditing] = useState(false);
  const [q1, setQ1] = useState(SECURITY_QUESTIONS[0].key);
  const [a1, setA1] = useState('');
  const [q2, setQ2] = useState(SECURITY_QUESTIONS[1].key);
  const [a2, setA2] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    (async () => {
      const s = await getRecoveryStatus(getStoredVaultToken());
      if (alive.current) setStatus(s);
    })();
    return () => { alive.current = false; };
  }, []);

  async function save() {
    if (busy) return;
    if (q1 === q2) { setMsg({ kind: 'err', text: tt('distinct') }); return; }
    if (a1.trim().length < 2 || a2.trim().length < 2) { setMsg({ kind: 'err', text: tt('tooShort') }); return; }
    setBusy(true); setMsg(null);
    const res = await setRecoveryQuestions(getStoredVaultToken(), [
      { slot: 1, question_key: q1, answer: a1.trim() },
      { slot: 2, question_key: q2, answer: a2.trim() },
    ]);
    if (!alive.current) return;
    setBusy(false);
    if (!res.ok) { setMsg({ kind: 'err', text: tt('failed') }); return; }
    setMsg({ kind: 'ok', text: tt('done') });
    setStatus({ ok: true, set: true });
    setA1(''); setA2('');
    setEditing(false);
  }

  const opts = (excludeKey) => SECURITY_QUESTIONS.filter((x) => x.key !== excludeKey);

  return (
    <div className="pg-card">
      <div className="pg-set-title">{tt('title')}</div>
      <div className="pg-set-row">
        <span className="pg-set-v" style={{ color: status?.set ? '#f5c800' : '#bdbdbd', fontFamily: 'Barlow Condensed, sans-serif' }}>
          {status == null ? '…' : (status.set ? tt('set') : tt('unset'))}
        </span>
      </div>

      {editing ? (
        <div style={{ marginTop: '.6rem' }}>
          <select style={box} value={q1} disabled={busy} onChange={(e) => setQ1(e.target.value)}>
            {opts(q2).map((x) => <option key={x.key} value={x.key}>{x[lang] || x.en}</option>)}
          </select>
          <input style={box} type="text" autoComplete="off" placeholder={tt('answer')} value={a1} disabled={busy} onChange={(e) => setA1(e.target.value)} />
          <select style={{ ...box, marginTop: '.7rem' }} value={q2} disabled={busy} onChange={(e) => setQ2(e.target.value)}>
            {opts(q1).map((x) => <option key={x.key} value={x.key}>{x[lang] || x.en}</option>)}
          </select>
          <input style={box} type="text" autoComplete="off" placeholder={tt('answer')} value={a2} disabled={busy} onChange={(e) => setA2(e.target.value)} />
          <div style={{ display: 'flex', gap: '.6rem', marginTop: '.7rem' }}>
            <button type="button" className="pg-set-replay" style={{ flex: 1 }} onClick={save} disabled={busy}>{busy ? '…' : tt('save')}</button>
            <button type="button" className="pg-set-signout" style={{ flex: 1 }} onClick={() => { setEditing(false); setMsg(null); }} disabled={busy}>{tt('cancel')}</button>
          </div>
        </div>
      ) : (
        <button type="button" className="pg-set-replay" style={{ marginTop: '.5rem' }} onClick={() => { setEditing(true); setMsg(null); }}>
          {tt('manage')}
        </button>
      )}

      {msg ? (
        <div style={{ marginTop: '.6rem', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 600, color: msg.kind === 'err' ? '#ff6b6b' : '#f5c800' }} role="status" aria-live="polite">
          {msg.text}
        </div>
      ) : null}
    </div>
  );
}
