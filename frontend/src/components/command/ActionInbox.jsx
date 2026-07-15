// src/components/command/ActionInbox.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The Agentic Command Center ACTION INBOX — the coach's triage desk for the
// autonomous agent loop (sentinels → bbf-agent-brain/Gemini → coach_action_inbox).
//
//   • Floating status badge (fixed, bottom-right) with the live PENDING count.
//     Self-hides at zero — the desk only surfaces when there is work to triage.
//   • Slide-in panel of action cards: athlete + risk type, the Gemini insight &
//     proposed action in glass panels, an EDITABLE draft message, and the two
//     triggers — [⚡ NUDGE / SEND SMS] (copies the text, opens the native sms:
//     composer, resolves APPROVED) and [❌ DISMISS] (resolves DISMISSED).
//
// Data path: lib/inboxApi (bbf-agent-brain admin gate) — the inbox table itself
// is RLS-sealed; nothing here touches PostgREST directly. Resolves are
// optimistic: the card leaves the deck instantly, and a failed resolve puts it
// back. Styles are fully scoped under `.ainbox-` (see ActionInbox.css).

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchActionInbox, resolveInboxAction } from '../../lib/inboxApi.js';
import './ActionInbox.css';

const POLL_MS = 120000; // background count refresh — light, non-blocking

const RISK_META = {
  ACWR_SPIKE:      { glyph: '🔴', label: 'ACWR Spike',  tone: 'spike' },
  STAGNANCY_ALERT: { glyph: '🟡', label: 'Stagnant',    tone: 'stag'  },
};

function riskLine(action) {
  const n = Number(action.risk_score);
  if (!Number.isFinite(n)) return null;
  return action.type === 'ACWR_SPIKE'
    ? `Ratio ${n.toFixed(2)}`
    : `${Math.round(n)}h silent`;
}

function firstNameOf(action) {
  const raw = String(action?.athlete?.name || action?.athlete?.uid || 'Athlete').trim();
  return raw.split(/\s+/)[0] || 'Athlete';
}

// ── One triage card ──────────────────────────────────────────────────────────
function ActionCard({ action, onResolve }) {
  const [text, setText] = useState(String(action.draft_message || ''));
  const [busy, setBusy] = useState(false);
  const meta = RISK_META[action.type] || { glyph: '⚠️', label: action.type, tone: 'stag' };
  const risk = riskLine(action);
  const name = String(action?.athlete?.name || action?.athlete?.uid || 'Athlete');

  const copyText = useCallback(async (value) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const ta = document.createElement('textarea');
        ta.value = value; document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta);
      }
    } catch { /* clipboard blocked — the sms: body still carries the text */ }
  }, []);

  // ⚡ NUDGE — copy (or edited) text, open the native sms: composer, APPROVE.
  // bbf_users has no phone column: sms:?body= opens the composer for the coach
  // to pick the recipient (same graceful path NudgeDrawer ships).
  const nudge = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    await copyText(text);
    window.location.href = `sms:?body=${encodeURIComponent(text)}`;
    onResolve(action, 'APPROVED');
  }, [busy, text, copyText, onResolve, action]);

  const dismiss = useCallback(() => {
    if (busy) return;
    setBusy(true);
    onResolve(action, 'DISMISSED');
  }, [busy, onResolve, action]);

  return (
    <article className={`ainbox-card ainbox-card--${meta.tone}`} data-testid={`ainbox-card-${action.id}`}>
      <header className="ainbox-card-head">
        <span className="ainbox-card-name">{name}</span>
        <span className={`ainbox-risk ainbox-risk--${meta.tone}`}>
          {meta.glyph} {meta.label}{risk ? ` · ${risk}` : ''}
        </span>
      </header>

      <div className="ainbox-glass">
        <div className="ainbox-glass-label">Insight</div>
        <p className="ainbox-glass-body">{action.insight_summary}</p>
      </div>
      <div className="ainbox-glass ainbox-glass--action">
        <div className="ainbox-glass-label">Proposed Action</div>
        <p className="ainbox-glass-body">{action.proposed_action}</p>
      </div>

      <label className="ainbox-draft-label" htmlFor={`ainbox-draft-${action.id}`}>
        Draft message · {firstNameOf(action)}
      </label>
      <textarea
        id={`ainbox-draft-${action.id}`}
        className="ainbox-draft"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        data-testid="ainbox-draft"
      />

      <div className="ainbox-card-actions">
        <button type="button" className="ainbox-btn ainbox-btn--nudge" onClick={nudge} disabled={busy} data-testid="ainbox-nudge">
          ⚡ NUDGE / SEND SMS
        </button>
        <button type="button" className="ainbox-btn ainbox-btn--dismiss" onClick={dismiss} disabled={busy} data-testid="ainbox-dismiss">
          ❌ DISMISS
        </button>
      </div>
    </article>
  );
}

// ── The floating badge + slide-in triage panel ───────────────────────────────
export default function ActionInbox() {
  const [actions, setActions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchActionInbox();
      if (alive.current) { setActions(rows); setError(null); }
    } catch {
      // Non-fatal overlay: the Command Center never breaks on an inbox hiccup.
      if (alive.current) setError('Inbox fetch failed');
    } finally {
      if (alive.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    // Deferred via microtask (ClientHub overlay parity) — no synchronous
    // setState inside the effect body.
    queueMicrotask(() => { if (alive.current) refresh(); });
    const t = setInterval(refresh, POLL_MS);
    return () => { alive.current = false; clearInterval(t); };
  }, [refresh]);

  // ESC-to-close + body scroll lock while the panel is open (NudgeDrawer parity).
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Optimistic resolve — the card leaves instantly; a failed call puts it back.
  const onResolve = useCallback(async (action, status) => {
    setActions((prev) => prev.filter((a) => a.id !== action.id));
    try {
      await resolveInboxAction(action.id, status);
    } catch {
      setActions((prev) => (prev.some((a) => a.id === action.id) ? prev : [action, ...prev]));
    }
  }, []);

  const count = actions.length;

  return (
    <>
      {count > 0 ? (
        <button
          type="button"
          className="ainbox-fab"
          onClick={() => setOpen(true)}
          aria-label={`Open Action Inbox — ${count} pending action${count === 1 ? '' : 's'}`}
          data-testid="ainbox-fab"
        >
          <span className="ainbox-fab-glyph" aria-hidden="true">⚡</span>
          <span className="ainbox-fab-count" data-testid="ainbox-count">{count}</span>
        </button>
      ) : null}

      {open ? (
        <div className="ainbox-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <aside className="ainbox-panel" role="dialog" aria-modal="true" aria-labelledby="ainbox-title" data-testid="ainbox-panel">
            <header className="ainbox-head">
              <div>
                <div className="ainbox-kicker">⚡ Agentic Command Center</div>
                <h3 id="ainbox-title" className="ainbox-title">Action Inbox</h3>
              </div>
              <div className="ainbox-head-tools">
                <button type="button" className="ainbox-refresh" onClick={refresh} disabled={loading} aria-label="Refresh inbox">
                  ↻
                </button>
                <button type="button" className="ainbox-x" onClick={() => setOpen(false)} aria-label="Close">✕</button>
              </div>
            </header>

            {error ? <div className="ainbox-error" role="alert">{error}</div> : null}

            {count === 0 ? (
              <div className="ainbox-empty">
                <span aria-hidden="true">◎</span> Inbox zero — no pending agent actions.
              </div>
            ) : (
              <div className="ainbox-list">
                {actions.map((a) => (
                  <ActionCard key={a.id} action={a} onResolve={onResolve} />
                ))}
              </div>
            )}
          </aside>
        </div>
      ) : null}
    </>
  );
}
