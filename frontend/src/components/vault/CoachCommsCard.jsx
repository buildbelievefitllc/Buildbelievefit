// src/components/vault/CoachCommsCard.jsx
// ─────────────────────────────────────────────────────────────────────────────
// COACH COMMS — the athlete side of the Founder Five messaging bridge.
//
// A slim strip on the Vault Hub (same collapsed-strip grammar as the Weekly
// Brief / Sovereign Audio Link): shows the coach line + a GOLD UNREAD BADGE
// when un-read coach directives are waiting (the notification flag —
// bbf_athlete_unread_count on mount, so it raises on every app open / next
// pull). Expanding loads the full thread (bbf_athlete_inbox), marks it read
// (clears the flag), and offers a reply composer (bbf_athlete_send_message).
//
// Identity is the vault session token — the server only ever returns THIS
// athlete's thread (§7). Zero markdown/innerHTML: message bodies render as
// pre-wrapped text, no XSS surface.

import { useEffect, useState, useCallback, useRef } from 'react';
import { athleteInbox, athleteMarkRead, athleteSendMessage, athleteUnreadCount, commsErrorMessage, MESSAGE_MAX } from '../../lib/coachMessagesApi.js';
import { useLang } from '../../context/LangContext.jsx';

const STR = {
  en: {
    title: 'Coach Comms', sub: 'Direct line to Coach Akeem', unread: (n) => `${n} new`,
    empty: 'No messages from your coach yet.', reply: 'Reply to your coach…', send: 'Send',
    sending: 'Sending…', coach: 'Coach Akeem', you: 'You', loading: 'Opening the channel…',
  },
  es: {
    title: 'Comms del Coach', sub: 'Línea directa con el Coach Akeem', unread: (n) => `${n} nuevo${n === 1 ? '' : 's'}`,
    empty: 'Aún no hay mensajes de tu coach.', reply: 'Responde a tu coach…', send: 'Enviar',
    sending: 'Enviando…', coach: 'Coach Akeem', you: 'Tú', loading: 'Abriendo el canal…',
  },
  pt: {
    title: 'Comms do Coach', sub: 'Linha direta com o Coach Akeem', unread: (n) => `${n} novo${n === 1 ? '' : 's'}`,
    empty: 'Ainda não há mensagens do seu coach.', reply: 'Responda ao seu coach…', send: 'Enviar',
    sending: 'Enviando…', coach: 'Coach Akeem', you: 'Você', loading: 'Abrindo o canal…',
  },
};

export default function CoachCommsCard() {
  const { lang } = useLang();
  const tr = STR[lang] || STR.en;

  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [thread, setThread] = useState([]);
  const [state, setState] = useState({ loading: false, error: null });
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);

  // The notification flag — a single lightweight poll on mount (every app
  // open / hub visit re-raises it). Silent on failure: no session, no badge.
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(async () => {
      try {
        const n = await athleteUnreadCount();
        if (!cancelled) setUnread(n);
      } catch { /* signed-out / offline — the strip just shows no badge */ }
    });
    return () => { cancelled = true; };
  }, []);

  const openThread = useCallback(async () => {
    setOpen(true);
    setState({ loading: true, error: null });
    try {
      const { messages } = await athleteInbox();
      setThread(messages);
      setState({ loading: false, error: null });
      // Opening the thread consumes the notification — mark read, clear badge.
      athleteMarkRead().then(() => setUnread(0)).catch(() => {});
    } catch (e) {
      setState({ loading: false, error: commsErrorMessage(e) });
    }
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [thread.length]);

  async function sendReply(e) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    const tempId = `tmp-${Date.now()}`;
    setThread((t) => [...t, { id: tempId, sender: 'athlete', body, created_at: new Date().toISOString(), pending: true }]);
    setDraft('');
    try {
      const saved = await athleteSendMessage(body);
      setThread((t) => t.map((m) => (m.id === tempId ? saved : m)));
    } catch (err) {
      setThread((t) => t.filter((m) => m.id !== tempId));
      setDraft(body);
      setState((s) => ({ ...s, error: commsErrorMessage(err) }));
    } finally {
      setSending(false);
    }
  }

  return (
    <section className={`cc-card${open ? ' is-open' : ''}`} data-testid="coach-comms" data-unread={unread}>
      <button
        type="button"
        className="cc-strip"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openThread())}
        data-testid="coach-comms-toggle"
      >
        <span className="cc-ic" aria-hidden="true">🎧</span>
        <span className="cc-titles">
          <span className="cc-title">{tr.title}</span>
          <span className="cc-sub">{tr.sub}</span>
        </span>
        {unread > 0 ? (
          <span className="cc-badge" data-testid="coach-comms-unread">{tr.unread(unread)}</span>
        ) : null}
        <span className="cc-chev" aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>

      {open ? (
        <div className="cc-body">
          {state.loading && !thread.length ? (
            <div className="cc-note" role="status">{tr.loading}</div>
          ) : state.error ? (
            <div className="cc-error" role="alert">{state.error}</div>
          ) : (
            <div className="cc-thread" aria-label={tr.title}>
              {thread.length === 0 ? (
                <span className="cc-note">{tr.empty}</span>
              ) : thread.map((m) => {
                const coach = m.sender === 'coach';
                return (
                  <div key={m.id} className={`cc-msg${coach ? ' is-coach' : ' is-you'}${m.pending ? ' is-pending' : ''}`}>
                    <span className="cc-bubble">{m.body}</span>
                    <span className="cc-meta">{coach ? tr.coach : tr.you}</span>
                  </div>
                );
              })}
              <span ref={endRef} />
            </div>
          )}

          <form className="cc-composer" onSubmit={sendReply}>
            <input
              className="cc-input"
              type="text"
              maxLength={MESSAGE_MAX}
              placeholder={tr.reply}
              value={draft}
              disabled={sending}
              onChange={(e) => setDraft(e.target.value)}
              data-testid="coach-comms-input"
            />
            <button type="submit" className="cc-send" disabled={sending || !draft.trim()} data-testid="coach-comms-send">
              {sending ? tr.sending : tr.send}
            </button>
          </form>
        </div>
      ) : null}
    </section>
  );
}
