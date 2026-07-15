// src/components/command/NudgeDrawer.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The 48-Hour Accountability nudge — a slide-out drawer for a STAGNANT athlete.
// Shows a pre-formatted, editable outreach draft (athlete first name + days since
// their last check-in) with Copy-to-Clipboard and an "Open in SMS" trigger
// (native sms: composer — no backend, works from the coach's device).
//
// Scoped under `.nudge-` (+ `nudge-slide` keyframe): no global bleed. Brand-locked
// (§2): void canvas, muted warning-gold accents, Bebas/Barlow.

import { useState, useEffect, useCallback, useMemo } from 'react';
import './NudgeDrawer.css';

function firstNameOf(client) {
  const raw = String(client?.name || client?.uid || 'Athlete').trim();
  const first = raw.split(/\s+/)[0];
  return first || 'Athlete';
}

function buildDraft(client, stag) {
  const name = firstNameOf(client);
  const span = stag?.days != null && stag.days >= 1 ? `${stag.days} day${stag.days === 1 ? '' : 's'}` : 'a while';
  return (
    `Hey ${name}, I noticed we haven't seen any check-ins or workout logs from you ` +
    `in the last ${span}. Let's lock back in and get that data logged today! ` +
    `Built Believe Fit.`
  );
}

export default function NudgeDrawer({ client, stag, onClose }) {
  const initialDraft = useMemo(() => buildDraft(client, stag), [client, stag]);
  const [text, setText] = useState(initialDraft);
  const [copied, setCopied] = useState(false);

  // ESC-to-close + body scroll lock while open.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const copy = useCallback(async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text; document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked — the textarea is selectable as a fallback */ }
  }, [text]);

  const phone = client?.phone || client?.phone_number || client?.mobile || '';
  const smsHref = `sms:${phone ? encodeURIComponent(phone) : ''}?body=${encodeURIComponent(text)}`;
  const name = firstNameOf(client);
  const lastSeen = stag?.days != null && stag.days >= 1 ? `${stag.days}d` : '—';

  return (
    <div className="nudge-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <aside
        className="nudge-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nudge-title"
        data-testid="nudge-drawer"
      >
        <header className="nudge-head">
          <div>
            <div className="nudge-kicker">⚡ Accountability Nudge</div>
            <h3 id="nudge-title" className="nudge-title">{name}</h3>
          </div>
          <button type="button" className="nudge-x" onClick={onClose} aria-label="Close">✕</button>
        </header>

        <div className="nudge-meta">
          <span className="nudge-flag">STAGNANT</span>
          <span className="nudge-meta-sub">No check-in · last logged {lastSeen} ago</span>
        </div>

        <label className="nudge-label" htmlFor="nudge-msg">Message draft</label>
        <textarea
          id="nudge-msg"
          className="nudge-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          data-testid="nudge-draft"
        />

        <div className="nudge-actions">
          <button type="button" className="nudge-btn nudge-btn--copy" onClick={copy} data-testid="nudge-copy">
            {copied ? '✓ Copied' : 'Copy to Clipboard'}
          </button>
          <a className="nudge-btn nudge-btn--sms" href={smsHref} data-testid="nudge-sms">
            Open in SMS
          </a>
        </div>
        <p className="nudge-note">
          Opens your device’s SMS composer with the draft{phone ? '' : ' — add the athlete’s number in the composer'}.
        </p>
      </aside>
    </div>
  );
}
