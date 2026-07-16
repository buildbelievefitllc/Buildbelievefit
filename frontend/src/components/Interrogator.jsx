// src/components/Interrogator.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 16 — The Routine Interrogator (BBF Chatbox), restored into React.
//
// Faithful rebuild of the legacy #interrogator surface (index.html): a brutalist
// lead-gen audit where a prospect pastes their training split and the engine
// surfaces structural GAPS → the Sovereign Contrast → a tier VERDICT.
//
// STATEFUL (Gap Analyzer): this is now LIVE-wired. The submit handler performs a
// real fetch to the bbf-agentic-interrogator edge function (Gemini 2.5 Flash),
// captures the prospect's name + contact handle, and renders the resolved gap
// report + verdict. The engine also persists the lead + a coach inbox card
// server-side, so every submission becomes a durable prospect record.
//
// Brand: true legacy palette — purple atmosphere, gold/cyan accents, Victory Gold
// reserved for the recommended CTA only.

import { useEffect, useRef, useState } from 'react';
import { FUNCTIONS_BASE, SUPABASE_ANON_KEY } from '../lib/supabaseClient.js';

// Phase 17 — brand correction: the legacy Interrogator leaned RED, which clashes
// with BBF. Re-skinned to Purple/Gold. Cyan is retained ONLY as the subtle
// "diagnostic scan" accent (legacy lab motif); the dominant accents are purple +
// gold, and Victory Gold stays reserved for the recommended CTA.
const C = {
  goldVictory: '#F5C800',   // RESERVED — recommended CTA only
  gold: '#D4AF37',          // laboratory gold (accents)
  goldSoft: '#F5CF60',
  purpleRoyal: '#9D27C9',
  purple: '#6A0DAD',
  purpleDeep: '#2D0555',
  purpleNear: '#110128',
  cyan: '#22D3EE',          // diagnostic-scan accent only
  ink: '#E8FBFF',
};
const HEAD = "'Bebas Neue',sans-serif";
const BODY = "'Barlow Condensed',sans-serif";
const MONO = "'Menlo','Courier New',monospace";
const MAX_LEN = 4000;
const MIN_LEN = 18;

// Recommended-tier → CTA copy. The engine returns 'gateway' | 'architect'; the
// primary CTA reflects that verdict, the secondary opens the full tier deck.
const TIER_CTA = {
  gateway:   { tier: 'The Gateway',   sub: 'Entry architecture · App + AI' },
  architect: { tier: 'The Architect', sub: 'Full system · Heatmap + coach check-ins' },
};

// Stable anonymous session id (parity with the legacy bbf_interrogator_session_v1).
const SESSION_KEY = 'bbf_interrogator_session_v1';
function ensureSessionId() {
  try {
    let sid = localStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = (crypto?.randomUUID?.() || `s_${Date.now()}_${Math.round(Math.random() * 1e9)}`);
      localStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  } catch { return 'anonymous'; }
}

// Live call to the bbf-agentic-interrogator edge function (Gemini 2.5 Flash).
// Returns { gaps:[{title,body}], sovereign_contrast:[{system,body}],
//           verdict:{ headline, recommended_tier, rationale } }.
async function runInterrogation({ routine, name, contactHandle }) {
  const headers = { 'Content-Type': 'application/json' };
  if (SUPABASE_ANON_KEY) {
    headers.apikey = SUPABASE_ANON_KEY;
    headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
  }
  const res = await fetch(`${FUNCTIONS_BASE}/bbf-agentic-interrogator`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      routine,
      name: name || '',
      contact_handle: contactHandle || '',
      session_id: ensureSessionId(),
    }),
  });
  const raw = await res.text();
  let body = null;
  try { body = raw ? JSON.parse(raw) : null; } catch { /* non-JSON */ }
  if (!res.ok || !body || !Array.isArray(body.gaps)) {
    throw new Error(body?.error || `audit_failed_${res.status}`);
  }
  return body;
}

export default function Interrogator({ onChooseTier }) {
  const [input, setInput] = useState('');
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [history, setHistory] = useState([]); // [{ role:'user'|'audit', ... }]
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const outputRef = useRef(null);

  // Scroll the latest result into view when an audit lands.
  useEffect(() => {
    if (history.length && outputRef.current) {
      outputRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [history]);

  const len = input.length;
  const counterState = len >= MAX_LEN ? 'cap' : len > MAX_LEN * 0.85 ? 'warn' : 'ok';

  async function runAudit(e) {
    e.preventDefault();
    if (loading) return;
    const split = input.trim();
    if (split.length < MIN_LEN) {
      setError(`Paste a bit more of your split (min ${MIN_LEN} characters) so the audit has something to dissect.`);
      return;
    }
    if (!handle.trim()) {
      setError('Add an email, phone, or IG handle so Coach Akeem can send your full breakdown.');
      return;
    }
    setError(null);
    setLoading(true);
    // Record the user's submission immediately (chat-style history).
    setHistory((h) => [...h, { role: 'user', text: split }]);

    try {
      const data = await runInterrogation({ routine: split, name, contactHandle: handle });
      setHistory((h) => [...h, { role: 'audit', data }]);
      setInput('');
    } catch (err) {
      setError('The audit engine hit a snag — try again in a moment.');
      // Roll back the optimistic user bubble so the transcript stays clean.
      setHistory((h) => (h.length && h[h.length - 1].role === 'user' ? h.slice(0, -1) : h));
      if (err) console.warn('[Interrogator] audit failed:', err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section id="interrogator" style={st.shell} aria-labelledby="intg-title">
      <div style={st.scanline} aria-hidden="true" />
      <div style={st.inner}>
        <div style={st.kicker}>
          <span style={st.kickerDot} aria-hidden="true" /> Lead-Gen Audit · The Interrogator
        </div>
        <h2 id="intg-title" style={st.title}>The Routine <span style={st.titleGold}>Interrogator</span></h2>
        <p style={st.sub}>
          Paste your current workout split. The audit engine surfaces the structural gaps your program is
          hiding and prescribes the exact BBF architecture that closes them. No email. No friction.
        </p>

        <div style={st.console}>
          {/* History transcript */}
          {history.map((m, i) => (
            m.role === 'user'
              ? <UserBubble key={i} text={m.text} />
              : <AuditBlock key={i} data={m.data} onChooseTier={onChooseTier} />
          ))}

          {loading ? (
            <div style={st.loading} role="status" aria-live="polite">
              <span style={st.loadingDot} /> RUNNING CLINICAL AUDIT…
            </div>
          ) : null}

          <div ref={outputRef} />

          {/* Input form */}
          <form onSubmit={runAudit} style={st.form}>
            {/* Lead capture — name (optional) + contact handle (required so the
                coach can follow up with the full breakdown). */}
            <div style={st.leadRow}>
              <input
                style={st.leadInput}
                type="text"
                value={name}
                maxLength={120}
                disabled={loading}
                onChange={(e) => setName(e.target.value)}
                placeholder="First name (optional)"
                aria-label="Your first name"
              />
              <input
                style={st.leadInput}
                type="text"
                value={handle}
                maxLength={160}
                disabled={loading}
                onChange={(e) => { setHandle(e.target.value); if (error) setError(null); }}
                placeholder="Email, phone, or @IG — where to send your plan"
                aria-label="Email, phone, or Instagram handle"
              />
            </div>
            <div style={st.labelRow}>
              <span style={st.labelL}>&gt; PASTE YOUR PROTOCOL</span>
              <span style={{ ...st.labelR, color: counterState === 'cap' ? C.goldVictory : counterState === 'warn' ? C.gold : 'rgba(255,255,255,.32)' }}>
                {len} / {MAX_LEN}
              </span>
            </div>
            <textarea
              style={st.textarea}
              value={input}
              maxLength={MAX_LEN}
              disabled={loading}
              onChange={(e) => { setInput(e.target.value); if (error) setError(null); }}
              placeholder={'MON — Chest + Triceps\nBench 4x8 / Incline DB 3x10 / Cable Fly 3x12\n\nTUE — Back + Biceps\nPull-ups 4xAMRAP / Row 4x8 / Lat Pulldown 3x12\n\nWED — Legs\nSquat 5x5 / RDL 4x8 / Leg Press 3x12\n\n…paste your full week'}
              aria-label="Paste your current workout routine for clinical audit"
            />
            {error ? <div style={st.error} role="alert">⚠ {error}</div> : null}
            <button type="submit" style={{ ...st.go, opacity: loading ? 0.55 : 1 }} disabled={loading}>
              {loading ? 'Auditing…' : 'Audit My Protocol →'}
              <span style={st.goSub}>Clinical breakdown · ~10-second read</span>
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}

function UserBubble({ text }) {
  return (
    <div style={st.userBubble}>
      <div style={st.userLabel}>YOUR PROTOCOL</div>
      <pre style={st.userText}>{text}</pre>
    </div>
  );
}

function AuditBlock({ data, onChooseTier }) {
  if (!data) return null;
  const v = data.verdict || {};
  const contrast = Array.isArray(data.sovereign_contrast) ? data.sovereign_contrast : [];
  const rec = TIER_CTA[v.recommended_tier] || { tier: 'Apply Now', sub: '' };
  return (
    <div style={st.audit} role="region" aria-label="Interrogator audit results">
      <div style={st.scanComplete}><span style={st.scanDot} /> AUDIT · COMPLETE</div>

      {Array.isArray(data.gaps) && data.gaps.length ? (
        <div style={st.section}>
          <h3 style={{ ...st.sectionH, color: C.purpleRoyal }}>[ 01 ] THE GAPS</h3>
          {data.gaps.map((g, i) => (
            <div key={i} style={st.entry}>
              <div style={{ ...st.entryT, color: C.goldSoft }}>{g.title}</div>
              <p style={st.entryB}>{g.body}</p>
            </div>
          ))}
        </div>
      ) : null}

      {contrast.length ? (
        <div style={st.section}>
          <h3 style={{ ...st.sectionH, color: C.goldVictory }}>[ 02 ] THE SOVEREIGN CONTRAST</h3>
          {contrast.map((c, i) => (
            <div key={i} style={st.entry}>
              <div style={{ ...st.entryT, color: C.goldVictory }}>{c.system}</div>
              <p style={st.entryB}>{c.body}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div style={st.section}>
        <h3 style={{ ...st.sectionH, color: C.cyan }}>[ 03 ] THE VERDICT</h3>
        <div style={st.verdictHead}>{v.headline}</div>
        <p style={st.verdictRationale}>{v.rationale}</p>
        <div style={st.ctaRow}>
          <button type="button" style={{ ...st.cta, ...st.ctaPrim }} onClick={() => onChooseTier?.(v.recommended_tier)}>
            {rec.tier}
            <span style={st.ctaSub}>{rec.sub}</span>
          </button>
          <button type="button" style={{ ...st.cta, ...st.ctaSec }} onClick={() => onChooseTier?.()}>
            See All Tiers
            <span style={st.ctaSub}>Compare the full deck</span>
          </button>
        </div>
      </div>
    </div>
  );
}

const st = {
  shell: { position: 'relative', background: `linear-gradient(180deg, ${C.purpleNear} 0%, #050507 60%, ${C.purpleNear} 100%)`, padding: 'clamp(48px,8vw,80px) clamp(16px,4vw,40px)', borderTop: `2px solid rgba(157,39,201,.5)`, borderBottom: `2px solid rgba(245,200,0,.35)`, overflow: 'hidden', isolation: 'isolate' },
  scanline: { position: 'absolute', left: 0, right: 0, top: 0, height: 1, background: `linear-gradient(90deg, transparent, ${C.purple} 22%, ${C.goldVictory} 50%, ${C.purpleRoyal} 78%, transparent)`, opacity: .85, zIndex: 1 },
  inner: { position: 'relative', zIndex: 2, maxWidth: 920, margin: '0 auto' },
  kicker: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.55rem', fontFamily: HEAD, fontSize: '.72rem', letterSpacing: '4px', textTransform: 'uppercase', color: C.purpleRoyal, marginBottom: '.7rem' },
  kickerDot: { width: 9, height: 9, borderRadius: '50%', background: C.purpleRoyal, boxShadow: `0 0 14px ${C.purpleRoyal}` },
  title: { fontFamily: HEAD, fontSize: 'clamp(2rem,7vw,3.4rem)', lineHeight: .95, letterSpacing: '2px', textTransform: 'uppercase', textAlign: 'center', margin: '0 0 .55rem', color: '#fff' },
  titleGold: { background: `linear-gradient(90deg, ${C.goldSoft} 0%, ${C.goldVictory} 45%, ${C.gold} 100%)`, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent' },
  sub: { textAlign: 'center', maxWidth: 640, margin: '0 auto 2rem', fontFamily: BODY, fontSize: '1rem', lineHeight: 1.55, color: 'rgba(255,255,255,.62)' },

  console: { background: `linear-gradient(180deg, #0a0a10 0%, #080812 100%)`, border: `1px solid rgba(245,200,0,.22)`, borderRadius: 14, padding: 'clamp(16px,3vw,22px)', boxShadow: '0 24px 70px rgba(0,0,0,.55), 0 0 0 1px rgba(34,211,238,.06)' },

  userBubble: { background: 'rgba(157,39,201,.08)', border: '1px solid rgba(157,39,201,.3)', borderRadius: 10, padding: '.8rem 1rem', marginBottom: '1rem' },
  userLabel: { fontFamily: HEAD, fontSize: '.62rem', letterSpacing: '3px', textTransform: 'uppercase', color: C.purpleRoyal, marginBottom: '.4rem' },
  userText: { fontFamily: MONO, fontSize: '.8rem', lineHeight: 1.5, color: 'rgba(255,255,255,.8)', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 140, overflow: 'auto' },

  loading: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.6rem', padding: '1.4rem 1rem', color: C.cyan, fontFamily: MONO, fontSize: '.82rem', letterSpacing: '2.5px', textTransform: 'uppercase' },
  loadingDot: { width: 12, height: 12, borderRadius: '50%', background: C.cyan, boxShadow: `0 0 12px ${C.cyan}`, animation: 'none' },

  form: { marginTop: '1rem' },
  leadRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '.6rem', marginBottom: '.9rem' },
  leadInput: { width: '100%', boxSizing: 'border-box', background: '#04040a', border: `1px solid rgba(157,39,201,.4)`, color: C.ink, fontFamily: BODY, fontWeight: 700, fontSize: '.9rem', padding: '.8rem 1rem', borderRadius: 10, outline: 'none' },
  labelRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '.55rem' },
  labelL: { fontFamily: HEAD, fontSize: '.66rem', letterSpacing: '3px', textTransform: 'uppercase', color: C.cyan },
  labelR: { fontFamily: MONO, fontSize: '.62rem', letterSpacing: '2px', textTransform: 'uppercase' },
  textarea: { width: '100%', boxSizing: 'border-box', background: '#04040a', border: `1px solid rgba(34,211,238,.32)`, color: C.ink, fontFamily: MONO, fontSize: '.9rem', lineHeight: 1.55, padding: '1rem', borderRadius: 10, minHeight: 170, resize: 'vertical', outline: 'none' },
  error: { fontFamily: MONO, fontSize: '.82rem', color: C.goldSoft, background: 'rgba(106,13,173,.12)', border: `1px dashed rgba(157,39,201,.45)`, borderRadius: 8, padding: '.7rem .9rem', marginTop: '.7rem' },
  go: { display: 'block', width: '100%', marginTop: '1rem', background: `linear-gradient(180deg, ${C.goldVictory} 0%, ${C.gold} 100%)`, color: '#1B1106', border: `1px solid ${C.goldSoft}`, borderRadius: 12, padding: '1.1rem 1rem', fontFamily: HEAD, fontSize: '1.15rem', letterSpacing: '3px', textTransform: 'uppercase', cursor: 'pointer', boxShadow: '0 12px 32px rgba(245,200,0,.4)' },
  goSub: { display: 'block', fontFamily: BODY, fontSize: '.66rem', letterSpacing: '2.5px', fontWeight: 700, marginTop: '.25rem', color: 'rgba(255,255,255,.85)' },

  audit: { marginTop: '1.2rem', background: '#020208', border: `1px solid rgba(34,211,238,.45)`, borderRadius: 12, padding: 'clamp(16px,3vw,20px)', boxShadow: 'inset 0 0 32px rgba(34,211,238,.05), 0 18px 50px rgba(0,0,0,.45)' },
  scanComplete: { display: 'flex', alignItems: 'center', gap: '.5rem', fontFamily: MONO, fontSize: '.66rem', letterSpacing: '2.8px', textTransform: 'uppercase', color: C.cyan, marginBottom: '.9rem' },
  scanDot: { width: 7, height: 7, borderRadius: '50%', background: C.cyan, boxShadow: `0 0 12px ${C.cyan}` },
  section: { marginBottom: '1.25rem' },
  sectionH: { fontFamily: HEAD, fontSize: '.82rem', letterSpacing: '3px', textTransform: 'uppercase', margin: '0 0 .55rem', paddingBottom: '.45rem', borderBottom: '1px dashed rgba(255,255,255,.12)' },
  entry: { padding: '.6rem 0', borderBottom: '1px dotted rgba(255,255,255,.06)' },
  entryT: { fontFamily: HEAD, fontSize: '.9rem', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '.25rem' },
  entryB: { fontFamily: BODY, fontSize: '.92rem', lineHeight: 1.55, color: 'rgba(255,255,255,.78)', margin: 0 },
  verdictHead: { fontFamily: HEAD, fontSize: '1.1rem', lineHeight: 1.25, letterSpacing: '1.4px', textTransform: 'uppercase', color: '#fff', margin: '0 0 .55rem' },
  verdictRationale: { fontFamily: BODY, fontSize: '.92rem', lineHeight: 1.55, color: 'rgba(255,255,255,.78)', margin: '0 0 1rem' },
  ctaRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '.7rem' },
  cta: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '.2rem', padding: '1rem', borderRadius: 12, cursor: 'pointer', fontFamily: HEAD, letterSpacing: '2px', textTransform: 'uppercase', border: 'none', textAlign: 'center' },
  ctaPrim: { background: `linear-gradient(180deg, ${C.goldVictory} 0%, ${C.gold} 100%)`, color: '#1B1106', fontSize: '1rem', boxShadow: `0 14px 36px rgba(245,200,0,.5), 0 0 0 2px ${C.goldSoft}` },
  ctaSec: { background: 'rgba(34,211,238,.08)', border: `1px solid rgba(34,211,238,.55)`, color: C.cyan, fontSize: '.92rem' },
  ctaSub: { fontFamily: BODY, fontSize: '.64rem', letterSpacing: '1.5px', fontWeight: 700, opacity: .85 },
};
