// src/components/BBFChatbox.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 17 — The BBF Chatbox: a distinct conversational AI assistant, separate
// from the Interrogator (which is a one-shot routine audit). This is a persistent
// floating chat bubble → panel with a running conversation.
//
// Per Phase 17 scope (mirrors the Interrogator precedent): the full conversational
// UI + state (message history, input, loading, open/close) is built; replies are a
// keyword-routed PLACEHOLDER that acknowledges the user and nudges toward the right
// tier / the Pathfinder. The real Gemini/Anthropic wiring is a later phase — the
// message shape ({ role, text }) is API-ready.
//
// Brand: Purple panel + Gold CTA accents (no red).

import { useEffect, useRef, useState } from 'react';
import { useLang } from '../context/LangContext.jsx';

const GOLD = '#F5C800';
const PURL = '#9D27C9';
const PURX = '#1E0340';
const PURP = '#110128';
const HEAD = "'Bebas Neue',sans-serif";
const BODY = "'Barlow Condensed',sans-serif";

// Keyword-routed placeholder. Returns a helpful canned reply + optional CTA intent.
// (Drop-in target for the real agent: same { text, cta } return.)
function placeholderReply(input) {
  const q = input.toLowerCase();
  if (/(price|cost|how much|\$|tier|plan)/.test(q)) {
    return { text: 'Two paths: the Autonomous Engine ($47/mo — app + AI, self-directed) or the Sovereign Standard ($897/12-wk — Founder-Direct hybrid with Akeem). Want me to point you to the application?', cta: 'pathfinder' };
  }
  if (/(nutrition|diet|macro|calorie|tdee|eat|food)/.test(q)) {
    return { text: 'Nutrition is built into both tiers — calibrated to your TDEE and training. Try the TDEE calculator just above to get your starting macros, then carry them into your application.', cta: 'tdee' };
  }
  if (/(youth|kid|child|teen|son|daughter|athlete|sport)/.test(q)) {
    return { text: 'The Youth Athlete path is sport-specific with biomechanical prehab built for ages 9–17. Apply through the Pathfinder and Akeem will scope the right protocol.', cta: 'pathfinder' };
  }
  if (/(injur|joint|knee|back|shoulder|pain|prehab|rehab)/.test(q)) {
    return { text: "Joint protection is the core of the BBF system — every protocol is engineered around your mobility and prehab needs. That's exactly what the Founder-Direct Sovereign tier specializes in.", cta: 'pathfinder' };
  }
  if (/(start|begin|sign up|join|apply|how do)/.test(q)) {
    return { text: "Easiest first step: the Pathfinder application. Tell us your goals and Akeem reaches out within 24 hours. I'll take you there.", cta: 'pathfinder' };
  }
  return { text: "Good question — Akeem can give you the precise answer. The fastest path is to drop your details in the Pathfinder application and he'll reach out within 24 hours. Anything else I can point you to?", cta: 'pathfinder' };
}

export default function BBFChatbox({ onCta }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  // Seed the greeting as the initial message (lazy init — no setState-in-effect).
  const [messages, setMessages] = useState(() => [{ role: 'bot', text: t('chat-greeting') }]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  function send(e) {
    e.preventDefault();
    if (loading) return;
    const text = input.trim();
    if (!text) return;
    setMessages((m) => [...m, { role: 'user', text }]);
    setInput('');
    setLoading(true);
    timerRef.current = setTimeout(() => {
      const reply = placeholderReply(text);
      setMessages((m) => [...m, { role: 'bot', text: reply.text, cta: reply.cta }]);
      setLoading(false);
    }, 900);
  }

  return (
    <>
      {/* Floating launcher */}
      <button
        type="button"
        style={{ ...st.fab, ...(open ? st.fabHidden : null) }}
        onClick={() => setOpen(true)}
        aria-label={t('chat-title')}
      >
        <span style={st.fabDot} aria-hidden="true" /> {t('chat-title')}
      </button>

      {/* Panel */}
      {open ? (
        <div style={st.panel} role="dialog" aria-label={t('chat-title')}>
          <div style={st.header}>
            <span style={st.headTitle}>
              <span style={st.headDot} aria-hidden="true" /> {t('chat-title')}
            </span>
            <button type="button" style={st.close} onClick={() => setOpen(false)} aria-label="Close chat">✕</button>
          </div>

          <div style={st.body} ref={scrollRef}>
            {messages.map((m, i) => (
              <div key={i} style={m.role === 'user' ? st.userRow : st.botRow}>
                <div style={m.role === 'user' ? st.userMsg : st.botMsg}>
                  {m.text}
                  {m.cta ? (
                    <button type="button" style={st.inlineCta} onClick={() => onCta?.(m.cta)}>
                      {m.cta === 'tdee' ? 'Open the TDEE calculator →' : 'Go to the application →'}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
            {loading ? (
              <div style={st.botRow}>
                <div style={{ ...st.botMsg, ...st.typing }}>
                  <span style={st.typeDot} /><span style={{ ...st.typeDot, animationDelay: '.15s' }} /><span style={{ ...st.typeDot, animationDelay: '.3s' }} />
                </div>
              </div>
            ) : null}
          </div>

          <form style={st.inputRow} onSubmit={send}>
            <input
              style={st.input}
              value={input}
              disabled={loading}
              placeholder={t('chat-placeholder')}
              onChange={(e) => setInput(e.target.value)}
              aria-label={t('chat-placeholder')}
            />
            <button type="submit" style={st.send} disabled={loading || !input.trim()}>{t('chat-send')}</button>
          </form>
        </div>
      ) : null}
    </>
  );
}

const st = {
  fab: { position: 'fixed', bottom: 24, right: 24, zIndex: 9000, display: 'inline-flex', alignItems: 'center', gap: '.55rem', background: `linear-gradient(135deg, ${PURX} 0%, ${PURP} 60%)`, color: GOLD, border: `2px solid ${GOLD}`, borderRadius: 999, padding: '.85rem 1.3rem', fontFamily: HEAD, fontSize: '.85rem', letterSpacing: '2.4px', textTransform: 'uppercase', cursor: 'pointer', boxShadow: '0 12px 36px -10px rgba(0,0,0,.7), 0 0 22px rgba(106,13,173,.35)' },
  fabHidden: { display: 'none' },
  fabDot: { width: 8, height: 8, borderRadius: '50%', background: GOLD, boxShadow: `0 0 10px ${GOLD}` },

  panel: { position: 'fixed', bottom: 24, right: 24, zIndex: 9001, width: 'min(380px, calc(100vw - 32px))', height: 'min(560px, calc(100vh - 48px))', background: `linear-gradient(170deg, ${PURX} 0%, #060606 50%, ${PURX} 100%)`, border: `1px solid rgba(245,200,0,.32)`, borderRadius: 18, boxShadow: '0 28px 64px -20px rgba(0,0,0,.85), 0 0 32px rgba(106,13,173,.25)', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '.9rem 1.1rem', borderBottom: `1px solid rgba(157,39,201,.3)`, background: 'rgba(106,13,173,.15)' },
  headTitle: { display: 'inline-flex', alignItems: 'center', gap: '.5rem', fontFamily: HEAD, fontSize: '1rem', letterSpacing: '2px', textTransform: 'uppercase', color: '#fff' },
  headDot: { width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 10px #22c55e' },
  close: { background: 'none', border: 'none', color: 'rgba(255,255,255,.6)', fontSize: '1rem', cursor: 'pointer', padding: 4, lineHeight: 1 },

  body: { flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '.7rem' },
  botRow: { display: 'flex', justifyContent: 'flex-start' },
  userRow: { display: 'flex', justifyContent: 'flex-end' },
  botMsg: { maxWidth: '85%', background: 'rgba(157,39,201,.16)', border: `1px solid rgba(157,39,201,.3)`, borderRadius: '12px 12px 12px 4px', padding: '.7rem .85rem', fontFamily: BODY, fontSize: '.95rem', fontWeight: 600, lineHeight: 1.45, color: 'rgba(255,255,255,.9)' },
  userMsg: { maxWidth: '85%', background: 'rgba(245,200,0,.12)', border: `1px solid rgba(245,200,0,.3)`, borderRadius: '12px 12px 4px 12px', padding: '.7rem .85rem', fontFamily: BODY, fontSize: '.95rem', fontWeight: 600, lineHeight: 1.45, color: '#fff' },
  inlineCta: { display: 'block', marginTop: '.6rem', fontFamily: HEAD, fontSize: '.74rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: GOLD, background: 'none', border: `1px solid rgba(245,200,0,.4)`, borderRadius: 6, padding: '.4rem .7rem', cursor: 'pointer', width: '100%' },
  typing: { display: 'inline-flex', gap: 5, alignItems: 'center' },
  typeDot: { width: 7, height: 7, borderRadius: '50%', background: PURL, display: 'inline-block' },

  inputRow: { display: 'flex', gap: '.5rem', padding: '.8rem', borderTop: `1px solid rgba(157,39,201,.3)`, background: 'rgba(8,2,18,.6)' },
  input: { flex: 1, minWidth: 0, background: '#0a0414', border: `1px solid rgba(157,39,201,.4)`, borderRadius: 8, color: '#fff', fontFamily: BODY, fontSize: '.95rem', fontWeight: 600, padding: '.65rem .8rem', outline: 'none' },
  send: { fontFamily: HEAD, fontSize: '.82rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#1B1106', background: GOLD, border: 'none', borderRadius: 8, padding: '0 1.1rem', cursor: 'pointer' },
};
