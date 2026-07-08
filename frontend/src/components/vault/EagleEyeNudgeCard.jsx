// src/components/vault/EagleEyeNudgeCard.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The client-facing delivery surface for BBF Eagle Eye's re-engagement plays.
//
// Eagle Eye (the Command Center secondary brain) detects when a client has
// drifted from the process — logging lapsed, readiness checks skipped — and
// dispatches an in-app awareness nudge, escalating to a warmer, empathetic
// message if the client stays dark. This card is where that message lands: the
// first thing on the hub, in the client's own language (composed server-side).
//
// Self-contained: fetches the client's OWN active nudge (vault-gated), renders
// nothing when there is none, and lets the client acknowledge it. Escalated
// messages read warmer (the intrinsic-motivation script) and carry a softer
// accent than the direct first-touch nudge.

import { useCallback, useEffect, useState } from 'react';
import { fetchMyEagleEyeNudge } from '../../lib/eagleEyeApi.js';

export default function EagleEyeNudgeCard() {
  const [nudge, setNudge] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(async () => {
      try {
        const res = await fetchMyEagleEyeNudge(false);
        if (!cancelled && res?.nudge?.message) setNudge(res.nudge);
      } catch {
        /* silent — an awareness card should never surface an error to the client */
      }
    });
    return () => { cancelled = true; };
  }, []);

  const acknowledge = useCallback(async () => {
    setDismissed(true);
    try { await fetchMyEagleEyeNudge(true); } catch { /* best-effort ack */ }
  }, []);

  if (!nudge || dismissed) return null;

  const escalated = nudge.escalated === true;
  const accent = escalated ? 'var(--gold-soft)' : 'var(--yel)';

  return (
    <section style={{ ...styles.card, borderColor: accent, boxShadow: `0 0 0 1px ${escalated ? 'rgba(245,207,96,.18)' : 'rgba(245,200,0,.14)'}` }} aria-live="polite">
      <div style={styles.head}>
        <span style={{ ...styles.kicker, color: accent }}>
          {escalated ? '◉ A note from your coach' : "◉ Coach's Eye"}
        </span>
        <button type="button" style={styles.ack} onClick={acknowledge} aria-label="Got it">Got it</button>
      </div>
      <p style={styles.msg}>{nudge.message}</p>
    </section>
  );
}

const styles = {
  card: {
    background: 'linear-gradient(180deg, rgba(245,200,0,.045), rgba(9,9,9,0))',
    border: '1px solid var(--yel)',
    borderRadius: 14,
    padding: '1rem 1.15rem',
    margin: '0 0 1rem',
  },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '.6rem', marginBottom: '.5rem' },
  kicker: { fontFamily: 'var(--hb)', fontSize: '.72rem', letterSpacing: '2.5px', textTransform: 'uppercase' },
  ack: {
    fontFamily: 'var(--hb)', fontSize: '.66rem', letterSpacing: '1.6px', textTransform: 'uppercase',
    color: 'var(--mut)', background: 'none', border: '1px solid var(--line)', borderRadius: 7, padding: '.35rem .7rem', cursor: 'pointer', flexShrink: 0,
  },
  msg: { fontFamily: 'var(--bd)', fontSize: '1rem', fontWeight: 600, lineHeight: 1.5, color: 'var(--wht)', margin: 0, letterSpacing: '.2px' },
};
