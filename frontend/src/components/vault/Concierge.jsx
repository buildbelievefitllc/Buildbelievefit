// src/components/vault/Concierge.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The Self-Serve BBF Lab Concierge — a first-login welcome modal that greets the
// member by name and lists EXACTLY the tools their access band unlocks (the copy
// is generated server-side by bbf-agentic-concierge, which enforces "no mirages":
// nothing outside the member's band is ever surfaced).
//
// Behavior:
//   • Fires ONCE per member per device (a localStorage "seen" flag keyed by uid).
//   • Renders nothing until the async greeting resolves — so it never blocks the
//     Vault's first paint and silently no-ops if the member isn't entitled or the
//     engine is unreachable (fetchConciergeGreeting returns null in those cases).
//   • Passes the secure vault session token to the edge function via conciergeApi.
//
// Brand (CLAUDE.md §2): matte-black canvas (approved surface), GOLD accents, the
// PURPLE primary CTA — matte black is never used for the load-bearing CTA.

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLang } from '../../context/LangContext.jsx';
import { fetchConciergeGreeting } from '../../lib/conciergeApi.js';

const SEEN_PREFIX = 'bbf.concierge.seen.';
function seenKey(uid) { return SEEN_PREFIX + String(uid || '').trim().toLowerCase(); }
function hasSeen(uid) {
  try { return !!localStorage.getItem(seenKey(uid)); } catch { return false; }
}
function markSeen(uid) {
  try { localStorage.setItem(seenKey(uid), String(Date.now())); } catch { /* storage blocked */ }
}

// Cosmetic glyph per canonical feature key (mirrors the Vault tab iconography).
const FEATURE_ICON = {
  grid: '▤', form_videos: '▶', base_nutrition: '◆', readiness: '✓', mindset: '🧠',
  voice_coach: '🎙', smart_cardio: '♥', prehab: '✚', advanced_nutrition: '📷',
  sovereign_comlink: '📡', coach_orchestration: '⚙', sports_hub: '🏈', roster: '👥',
  kinematics: '🎯',
};

const S = {
  backdrop: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,.72)', backdropFilter: 'blur(3px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', zIndex: 90,
  },
  panel: {
    width: '460px', maxWidth: '94vw', maxHeight: '88vh', overflowY: 'auto',
    background: '#0f0f0f', color: '#fff', border: '1px solid #6a0dad', borderRadius: '16px',
    padding: '22px 22px 18px', boxShadow: '0 18px 60px rgba(0,0,0,.6)',
  },
  kicker: {
    fontSize: '.72rem', letterSpacing: '1.5px', textTransform: 'uppercase',
    color: '#f5c800', fontWeight: 700, marginBottom: '6px',
  },
  greeting: { fontSize: '1.18rem', lineHeight: 1.4, fontWeight: 700, color: '#fff', margin: '0 0 4px' },
  band: { fontSize: '.78rem', color: '#b98cff', marginBottom: '14px', fontWeight: 600 },
  sectionH: {
    fontSize: '.7rem', letterSpacing: '1.2px', textTransform: 'uppercase', color: '#8a8a8a',
    fontWeight: 700, margin: '8px 0 8px',
  },
  list: { display: 'flex', flexDirection: 'column', gap: '8px', margin: '0 0 14px' },
  card: {
    display: 'flex', gap: '11px', alignItems: 'flex-start',
    background: '#161616', border: '1px solid #262626', borderRadius: '10px', padding: '10px 12px',
  },
  icon: { fontSize: '1.1rem', lineHeight: 1.4, color: '#f5c800', flex: '0 0 auto', width: '20px', textAlign: 'center' },
  cardTitle: { fontWeight: 700, fontSize: '.92rem', color: '#fff' },
  cardBlurb: { fontSize: '.82rem', color: '#bdbdbd', lineHeight: 1.35, marginTop: '1px' },
  firstMove: {
    background: 'rgba(106,13,173,.16)', border: '1px solid #6a0dad', borderRadius: '10px',
    padding: '10px 12px', margin: '0 0 16px',
  },
  firstMoveH: { fontSize: '.66rem', letterSpacing: '1.2px', textTransform: 'uppercase', color: '#b98cff', fontWeight: 700, marginBottom: '3px' },
  firstMoveBody: { fontSize: '.9rem', color: '#fff', lineHeight: 1.35 },
  cta: {
    width: '100%', background: '#6a0dad', color: '#fff', border: 'none', borderRadius: '10px',
    padding: '.7rem 1rem', fontWeight: 700, fontSize: '.95rem', cursor: 'pointer', letterSpacing: '.3px',
  },
};

export default function Concierge() {
  const { user } = useAuth();
  const { lang, t } = useLang();
  const uid = user?.username || user?.id || '';
  const displayName = user?.displayName || '';

  const [card, setCard] = useState(null);
  const dismissedRef = useRef(false);

  // Fetch-once-on-land: only for a member who hasn't seen the concierge yet.
  // State is mutated exclusively inside the promise callback (never synchronously
  // in the effect body) so it stays clear of react-hooks/set-state-in-effect.
  useEffect(() => {
    if (!uid || hasSeen(uid)) return undefined;
    let cancelled = false;
    fetchConciergeGreeting({ displayName, lang })
      .then((res) => { if (!cancelled && res && !dismissedRef.current) setCard(res); })
      .catch(() => { /* delight, never a blocker — swallow */ });
    return () => { cancelled = true; };
  }, [uid, displayName, lang]);

  const close = () => {
    dismissedRef.current = true;
    markSeen(uid);
    setCard(null);
  };

  // Escape-to-dismiss while the modal is open.
  useEffect(() => {
    if (!card) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card]);

  if (!card) return null;

  return (
    <div
      style={S.backdrop}
      onClick={close}
      data-testid="vault-concierge"
      role="presentation"
    >
      <div
        style={S.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bbf-concierge-greeting"
        onClick={(e) => e.stopPropagation()}
      >
        <div style={S.kicker}>{t('concierge-kicker')}</div>
        <p id="bbf-concierge-greeting" style={S.greeting}>{card.greeting}</p>
        {card.bandLabel ? (
          <div style={S.band}>{t('concierge-access')}: {card.bandLabel}</div>
        ) : null}

        <div style={S.sectionH}>{t('concierge-unlocked-h')}</div>
        <div style={S.list}>
          {card.unlocked.map((f) => (
            <div key={f.feature} style={S.card}>
              <span style={S.icon} aria-hidden="true">{FEATURE_ICON[f.feature] || '◆'}</span>
              <div>
                <div style={S.cardTitle}>{f.title}</div>
                {f.blurb ? <div style={S.cardBlurb}>{f.blurb}</div> : null}
              </div>
            </div>
          ))}
        </div>

        {card.firstMove ? (
          <div style={S.firstMove}>
            <div style={S.firstMoveH}>{t('concierge-firstmove-h')}</div>
            <div style={S.firstMoveBody}>{card.firstMove}</div>
          </div>
        ) : null}

        <button
          type="button"
          style={S.cta}
          onClick={close}
          data-testid="vault-concierge-dismiss"
          autoFocus
        >
          {t('concierge-dismiss')}
        </button>
      </div>
    </div>
  );
}
