// src/components/command/ActionInbox.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The Agentic Command Center ACTION INBOX — now DOMAIN-AWARE. One floating desk,
// three faces driven by the active Command Center domain:
//
//   • coaching / system → the autonomous sentinel loop (sentinels → bbf-agent-brain
//     → coach_action_inbox): athlete risk cards with an editable outreach draft and
//     the [⚡ NUDGE] / [❌ DISMISS] triggers (+ one-tap program-override apply).
//   • content → agentic marketing intelligence: Platform Growth insights (FB/IG/
//     TikTok) + Content Strategy (hashtag clusters, audio/BGM pairing, hook angles).
//     Triggers: [✏️ Draft in Studio V4] · [📥 Send to Review Bucket] · [❌ Dismiss].
//   • knowledge → the Founder Assistant: a readiness-driven recovery itinerary
//     (links straight into Coach's Cave films when readiness < 85%), a daily ES/PT
//     Language Lab rep, and a Coach Lab prehab briefing. Triggers: [🎬 Launch Coach's
//     Cave Session] · [🎧 Open Language Lab] · [🔬 Open Coach Lab] · [❌ Dismiss].
//
// Mounted ONCE at the Command Center level (inside RosterProvider) so it survives
// tab swaps and reads the live readiness + roster. Sentinel data path: lib/inboxApi
// (admin-gated); content/knowledge decks are client-curated (commandInboxData) with
// session-local dismiss. Styles are scoped under `.ainbox-` (ActionInbox.css).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchActionInbox, resolveInboxAction, fetchInboxScorecard } from '../../lib/inboxApi.js';
import { approveCatalogBatch } from '../../lib/sportsCatalogApi.js';
import { useReadiness } from '../../context/ReadinessContext.jsx';
import { useRoster } from './RosterProvider.jsx';
import { CONTENT_INSIGHTS, buildKnowledgeDeck } from './commandInboxData.js';
import './ActionInbox.css';

const POLL_MS = 120000; // background count refresh — light, non-blocking

// Which face the drawer wears for a given Command Center domain.
function modeForDomain(domain) {
  if (domain === 'content') return 'content';
  if (domain === 'knowledge') return 'knowledge';
  return 'sentinel'; // coaching + system
}
const TITLE_BY_MODE = {
  sentinel: 'Action Inbox',
  content: 'Content Intelligence',
  knowledge: 'Founder Assistant',
};

const RISK_META = {
  ACWR_SPIKE:        { glyph: '🔴', label: 'ACWR Spike',       tone: 'spike'   },
  STAGNANCY_ALERT:   { glyph: '🟡', label: 'Stagnant',         tone: 'stag'    },
  AUTONOMIC_OVERUSE: { glyph: '🟣', label: 'Autonomic Crisis', tone: 'auto'    },
  ONBOARDING_PLAN:   { glyph: '🔷', label: 'New Client',       tone: 'onboard' },
  PHASE_PROMOTION:   { glyph: '🏆', label: 'Phase Promotion',  tone: 'onboard' },
  CATALOG_BAKE:      { glyph: '📐', label: 'Block Catalog',    tone: 'onboard' },
};

// ── Accountability ledger (mirrors bbf-agent-brain) ───────────────────────────
// Safety-critical cards age into OVERDUE fast and CANNOT be dismissed without a
// logged reason — the escape hatch grows teeth. SLA + criticality mirror the brain.
const CRITICAL_TYPES = new Set(['ACWR_SPIKE', 'AUTONOMIC_OVERUSE']);
const DISMISS_REASONS = ['False positive', 'Handled offline', 'Deferring'];
function slaHoursFor(type) { return CRITICAL_TYPES.has(type) ? 24 : 72; }
function ageHoursOf(createdAt) {
  const t = Date.parse(createdAt || '');
  return Number.isFinite(t) ? (Date.now() - t) / 3600000 : 0;
}
function fmtAge(h) {
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m`;
  if (h < 48) return `${Math.round(h)}h`;
  return `${Math.round(h / 24)}d`;
}

function riskLine(action) {
  const n = Number(action.risk_score);
  if (!Number.isFinite(n)) return null;
  if (action.type === 'ACWR_SPIKE' || action.type === 'AUTONOMIC_OVERUSE') return `Ratio ${n.toFixed(2)}`;
  if (action.type === 'STAGNANCY_ALERT') return `${Math.round(n)}h silent`;
  return null;
}

function firstNameOf(action) {
  const raw = String(action?.athlete?.name || action?.athlete?.uid || 'Athlete').trim();
  return raw.split(/\s+/)[0] || 'Athlete';
}

// ── Closed-loop panels (sentinel) ─────────────────────────────────────────────
function ModificationPanel({ mod }) {
  const pct = (v) => `${Math.round(Number(v) * 100)}%`;
  return (
    <div className="ainbox-glass ainbox-glass--mod" data-testid="ainbox-mod">
      <div className="ainbox-glass-label">Proposed Program Override</div>
      <div className="ainbox-mod-grid">
        <span className="ainbox-mod-stat"><em>{pct(mod.intensity_multiplier)}</em> intensity</span>
        <span className="ainbox-mod-stat"><em>{pct(mod.volume_multiplier)}</em> volume</span>
        <span className="ainbox-mod-stat"><em>{mod.target_days}</em> day{Number(mod.target_days) === 1 ? '' : 's'}</span>
      </div>
      <p className="ainbox-glass-body">{mod.modification_reason}</p>
    </div>
  );
}

function BlueprintPanel({ blueprint }) {
  const weeks = Array.isArray(blueprint?.weeks) ? blueprint.weeks : [];
  return (
    <div className="ainbox-glass ainbox-glass--bp" data-testid="ainbox-blueprint">
      <div className="ainbox-glass-label">4-Week Baseline Blueprint</div>
      {blueprint?.overview ? <p className="ainbox-glass-body">{blueprint.overview}</p> : null}
      {weeks.map((w) => (
        <div key={w.week} className="ainbox-bp-week">
          <div className="ainbox-bp-focus">W{w.week} · {w.focus}</div>
          <ul className="ainbox-bp-days">
            {(Array.isArray(w.days) ? w.days : []).map((d, i) => (
              <li key={i}><strong>{d.day}:</strong> {d.session}</li>
            ))}
          </ul>
        </div>
      ))}
      {blueprint?.progression_pacing ? (
        <p className="ainbox-glass-body ainbox-bp-pacing"><strong>Progression:</strong> {blueprint.progression_pacing}</p>
      ) : null}
    </div>
  );
}

// ── One sentinel triage card ──────────────────────────────────────────────────
function ActionCard({ action, onResolve, onApply }) {
  const [text, setText] = useState(String(action.draft_message || ''));
  const [busy, setBusy] = useState(false);
  const [askReason, setAskReason] = useState(false); // critical dismiss → reason gate
  const meta = RISK_META[action.type] || { glyph: '⚠️', label: action.type, tone: 'stag' };
  const risk = riskLine(action);
  const name = String(action?.athlete?.name || action?.athlete?.uid || 'Athlete');
  const isBlueprint = action.type === 'ONBOARDING_PLAN';
  const isPromotion = action.type === 'PHASE_PROMOTION';
  const mod = !isBlueprint && !isPromotion && action.proposed_plan_modification
    && action.proposed_plan_modification.volume_multiplier != null
    ? action.proposed_plan_modification : null;
  const blueprint = isBlueprint ? action.proposed_plan_modification?.blueprint : null;
  // SP-0 dry-run Referee: the promotion payload the one-tap applier executes.
  const promo = isPromotion ? action.proposed_plan_modification?.promotion : null;
  // SP-1 catalog bake batch awaiting founder activation.
  const bake = action.type === 'CATALOG_BAKE' ? action.proposed_plan_modification?.catalog_bake : null;

  // Accountability derivations.
  const isCritical = CRITICAL_TYPES.has(action.type);
  const isFollowup = !!action.is_followup;
  const ageH = ageHoursOf(action.created_at);
  const overdue = ageH > slaHoursFor(action.type);

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

  const nudge = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    await copyText(text);
    window.location.href = `sms:?body=${encodeURIComponent(text)}`;
    onResolve(action, 'APPROVED');
  }, [busy, text, copyText, onResolve, action]);

  // Dismiss with an optional accountability reason. Safety-critical cards can't be
  // one-tapped away — the button opens the reason gate instead (see onDismissClick).
  const dismiss = useCallback((reason = null) => {
    if (busy) return;
    setBusy(true);
    onResolve(action, 'DISMISSED', reason);
  }, [busy, onResolve, action]);
  // CEO order: EVERY dismissal logs a reason now — no card leaves the desk
  // unaccounted for (a ghosted athlete can't be silently waved off either).
  const onDismissClick = useCallback(() => {
    if (busy) return;
    setAskReason(true);
  }, [busy]);

  const applyAndNudge = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    await copyText(text);
    onApply(action);
    window.location.href = `sms:?body=${encodeURIComponent(text)}`;
  }, [busy, text, copyText, onApply, action]);

  // Phase promotions apply server-side only — no SMS jump; the athlete hears
  // about it through the in-app narrative rails, not a raw text blast.
  const applyOnly = useCallback(() => {
    if (busy) return;
    setBusy(true);
    onApply(action);
  }, [busy, onApply, action]);

  // Catalog bakes activate through the bake fn (which also closes this card
  // server-side) — not through the brain's per-athlete applier RPCs.
  const activateBatch = useCallback(async () => {
    if (busy || !bake?.batch_id) return;
    setBusy(true);
    try {
      await approveCatalogBatch(bake.batch_id);
      onResolve(action, 'APPROVED', 'catalog batch activated');
    } catch {
      setBusy(false);
    }
  }, [busy, bake, onResolve, action]);

  return (
    <article className={`ainbox-card ainbox-card--${meta.tone}`} data-testid={`ainbox-card-${action.id}`}>
      <header className="ainbox-card-head">
        <span className="ainbox-card-name">{name}</span>
        <span className={`ainbox-risk ainbox-risk--${meta.tone}`}>
          {meta.glyph} {meta.label}{risk ? ` · ${risk}` : ''}
        </span>
      </header>

      <div className="ainbox-ledger-row">
        {overdue
          ? <span className="ainbox-tag ainbox-tag--overdue" data-testid="ainbox-overdue">⏰ OVERDUE · {fmtAge(ageH)}</span>
          : <span className="ainbox-tag ainbox-tag--age">open {fmtAge(ageH)}</span>}
        {isFollowup ? <span className="ainbox-tag ainbox-tag--followup" data-testid="ainbox-followup">🔁 FOLLOW-UP</span> : null}
      </div>

      <div className="ainbox-glass">
        <div className="ainbox-glass-label">Insight</div>
        <p className="ainbox-glass-body">{action.insight_summary}</p>
      </div>
      <div className="ainbox-glass ainbox-glass--action">
        <div className="ainbox-glass-label">Proposed Action</div>
        <p className="ainbox-glass-body">{action.proposed_action}</p>
      </div>

      {mod ? <ModificationPanel mod={mod} /> : null}
      {isBlueprint && blueprint ? <BlueprintPanel blueprint={blueprint} /> : null}
      {bake ? (
        <div className="ainbox-glass" data-testid="ainbox-catalog-bake">
          <div className="ainbox-glass-label">Periodization Bake · Draft Blocks</div>
          <p className="ainbox-glass-body">
            {bake.baked} block{bake.baked === 1 ? '' : 's'} validated · {bake.failed || 0} rejected by the Immutable-Laws firewall.
            Activation serves these weeks to matching athletes; until then the generic template holds.
          </p>
        </div>
      ) : null}
      {promo ? (
        <div className="ainbox-glass" data-testid="ainbox-promotion">
          <div className="ainbox-glass-label">Referee Verdict · Dry-Run</div>
          <p className="ainbox-glass-body">
            {String(promo.sport || 'general').toUpperCase()} · Phase {promo.from_phase} → {promo.to_phase}
            {promo.telemetry ? (
              ` · weeks ${promo.telemetry.mesocycle_week ?? '—'}` +
              ` · RPE ${promo.telemetry.rpe_avg_last_3 ?? '—'}` +
              ` · friction ${promo.telemetry.friction_avg_last_3 ?? '—'}`
            ) : ''}
            {promo.is_youth ? ' · YOUTH — guardian consent verified' : ''}
          </p>
        </div>
      ) : null}

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

      {mod || isBlueprint || promo || bake ? (
        <button
          type="button"
          className="ainbox-btn ainbox-btn--deploy"
          onClick={bake ? activateBatch : promo ? applyOnly : applyAndNudge}
          disabled={busy}
          data-testid="ainbox-apply"
        >
          {bake ? '⚡ ACTIVATE BLOCK CATALOG' : promo ? '⚡ APPROVE PHASE PROMOTION' : isBlueprint ? '⚡ DEPLOY BASELINE PLAN' : '⚡ APPLY PROGRAM OVERRIDE'}
        </button>
      ) : null}

      {askReason ? (
        <div className="ainbox-reason" data-testid="ainbox-reason">
          <div className="ainbox-reason-label">{isCritical ? 'Log a reason — this is a safety-critical card:' : 'Log a reason for dismissing:'}</div>
          <div className="ainbox-reason-chips">
            {DISMISS_REASONS.map((r) => (
              <button key={r} type="button" className="ainbox-chip ainbox-chip--btn" onClick={() => dismiss(r)} disabled={busy} data-testid={`ainbox-reason-${r.split(' ')[0].toLowerCase()}`}>
                {r}
              </button>
            ))}
            <button type="button" className="ainbox-chip ainbox-chip--cancel" onClick={() => setAskReason(false)} disabled={busy}>← back</button>
          </div>
        </div>
      ) : null}

      <div className="ainbox-card-actions">
        <button type="button" className="ainbox-btn ainbox-btn--nudge" onClick={nudge} disabled={busy} data-testid="ainbox-nudge">
          ⚡ NUDGE / SEND SMS
        </button>
        <button type="button" className="ainbox-btn ainbox-btn--dismiss" onClick={onDismissClick} disabled={busy} data-testid="ainbox-dismiss">
          ❌ DISMISS
        </button>
      </div>
    </article>
  );
}

// ── The weekly accountability scorecard (Founder Assistant mirror) ────────────
function ScorecardCard({ s }) {
  const resolved = (Number(s.handled) || 0) + (Number(s.dismissed) || 0);
  return (
    <article className="ainbox-card ainbox-card--scorecard" data-testid="ainbox-scorecard">
      <header className="ainbox-card-head">
        <span className="ainbox-card-tag">📊 Coach Scorecard · last {s.window_days}d</span>
      </header>
      <div className="ainbox-score-grid">
        <div className="ainbox-score"><em>{s.surfaced ?? 0}</em><span>surfaced</span></div>
        <div className="ainbox-score"><em>{s.handled ?? 0}</em><span>handled</span></div>
        <div className="ainbox-score"><em>{s.dismissed ?? 0}</em><span>dismissed</span></div>
        <div className={`ainbox-score${(s.aged_out ?? 0) > 0 ? ' ainbox-score--warn' : ''}`}><em>{s.aged_out ?? 0}</em><span>aged out</span></div>
      </div>
      <div className="ainbox-glass">
        <p className="ainbox-glass-body">
          {resolved > 0 && s.median_response_hours != null
            ? `Median response ${s.median_response_hours}h.`
            : 'No resolutions logged in this window.'}
          {s.pending_total ? ` ${s.pending_total} open right now.` : ''}
          {s.followups_handled ? ` ${s.followups_handled} follow-up${s.followups_handled === 1 ? '' : 's'} closed.` : ''}
        </p>
        {s.oldest_unaddressed ? (
          <p className="ainbox-glass-body ainbox-score-oldest">
            ⏳ Oldest unaddressed: <strong>{s.oldest_unaddressed.name}</strong> — {fmtAge(s.oldest_unaddressed.hours)} open.
          </p>
        ) : null}
      </div>
    </article>
  );
}

// ── Chips row (hashtags / hook angles / focus tags) ───────────────────────────
function Chips({ items }) {
  if (!Array.isArray(items) || !items.length) return null;
  return (
    <div className="ainbox-chips">
      {items.map((c, i) => <span key={i} className="ainbox-chip">{c}</span>)}
    </div>
  );
}

// ── One CONTENT intelligence card ─────────────────────────────────────────────
function ContentCard({ card, onDraft, onReview, onDismiss }) {
  const [note, setNote] = useState(null);
  return (
    <article className={`ainbox-card ainbox-card--${card.tone}`} data-testid={`ainbox-content-${card.id}`}>
      <header className="ainbox-card-head">
        <span className="ainbox-card-tag">{card.tag}</span>
      </header>
      <div className="ainbox-card-name ainbox-card-name--sm">{card.title}</div>

      <div className="ainbox-glass">
        <div className="ainbox-glass-label">Insight</div>
        <p className="ainbox-glass-body">{card.insight}</p>
      </div>
      {card.detail ? (
        <div className="ainbox-glass ainbox-glass--action">
          <div className="ainbox-glass-label">Recommendation</div>
          <p className="ainbox-glass-body">{card.detail}</p>
        </div>
      ) : null}
      <Chips items={card.chips} />

      {note ? <div className="ainbox-note" role="status">{note}</div> : null}

      <div className="ainbox-card-actions ainbox-card-actions--trio">
        <button type="button" className="ainbox-btn ainbox-btn--nudge" onClick={() => onDraft(card)} data-testid="ainbox-draft-studio">
          ✏️ Draft in Studio V4
        </button>
        <button type="button" className="ainbox-btn ainbox-btn--secondary" onClick={() => { onReview(card); setNote('✓ Saved to the Review Bucket.'); }} data-testid="ainbox-review">
          📥 Review Bucket
        </button>
        <button type="button" className="ainbox-btn ainbox-btn--dismiss" onClick={() => onDismiss(card.id)} data-testid="ainbox-content-dismiss">
          ❌
        </button>
      </div>
    </article>
  );
}

// ── One KNOWLEDGE founder-assistant card ──────────────────────────────────────
function KnowledgeCard({ card, onLaunchCave, onOpenLanguage, onOpenCoachLab, onDismiss }) {
  return (
    <article className={`ainbox-card ainbox-card--${card.tone}`} data-testid={`ainbox-knowledge-${card.id}`}>
      <header className="ainbox-card-head">
        <span className="ainbox-card-tag">{card.tag}</span>
      </header>
      <div className="ainbox-card-name ainbox-card-name--sm">{card.title}</div>

      <div className="ainbox-glass">
        <div className="ainbox-glass-label">Insight</div>
        <p className="ainbox-glass-body">{card.insight}</p>
      </div>
      {card.detail ? (
        <div className="ainbox-glass ainbox-glass--action">
          <div className="ainbox-glass-label">{card.variant === 'readiness' ? 'Recovery Itinerary' : 'Note'}</div>
          <p className="ainbox-glass-body">{card.detail}</p>
        </div>
      ) : null}

      {/* Readiness card → the curated Coach's Cave itinerary (each film launches
          the Cave straight to that clip). */}
      {card.variant === 'readiness' && Array.isArray(card.films) ? (
        <div className="ainbox-itinerary">
          {card.films.map((f) => (
            <button
              key={f.id}
              type="button"
              className="ainbox-film"
              onClick={() => onLaunchCave(f)}
              data-testid={`ainbox-film-${f.id}`}
            >
              <span className="ainbox-film-play" aria-hidden="true">▶</span>
              <span className="ainbox-film-title">{f.title}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="ainbox-card-actions ainbox-card-actions--trio">
        {card.variant === 'readiness' ? (
          <button type="button" className="ainbox-btn ainbox-btn--nudge" onClick={() => onLaunchCave(card.films[0])} data-testid="ainbox-launch-cave">
            🎬 Launch Coach’s Cave
          </button>
        ) : null}
        {card.variant === 'language' ? (
          <button type="button" className="ainbox-btn ainbox-btn--nudge" onClick={onOpenLanguage} data-testid="ainbox-open-language">
            🎧 Open Language Lab
          </button>
        ) : null}
        {card.variant === 'coachlab' ? (
          <button type="button" className="ainbox-btn ainbox-btn--nudge" onClick={onOpenCoachLab} data-testid="ainbox-open-coachlab">
            🔬 Open Coach Lab
          </button>
        ) : null}
        <button type="button" className="ainbox-btn ainbox-btn--dismiss" onClick={() => onDismiss(card.id)} data-testid="ainbox-knowledge-dismiss">
          ❌ Dismiss
        </button>
      </div>
    </article>
  );
}

// ── The floating badge + slide-in panel ───────────────────────────────────────
export default function ActionInbox({ domain = 'coaching' }) {
  const mode = modeForDomain(domain);
  const navigate = useNavigate();

  // Sentinel (coaching/system) server state.
  const [actions, setActions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const alive = useRef(true);

  // The weekly accountability scorecard (knowledge domain mirror).
  const [scorecard, setScorecard] = useState(null);

  // Content/knowledge: session-local dismiss (one Set spans both decks — card ids
  // are unique across decks, and the desk persists across tab swaps).
  const [dismissed, setDismissed] = useState(() => new Set());
  const dismissCard = useCallback((id) => {
    setDismissed((prev) => { const n = new Set(prev); n.add(id); return n; });
  }, []);

  // Live founder signals for the KNOWLEDGE deck.
  const readiness = useReadiness();
  const roster = useRoster();
  const knowledgeDeck = useMemo(
    () => buildKnowledgeDeck({
      readinessScore: readiness?.readinessScore ?? null,
      band: readiness?.band ?? 'idle',
      rosterCount: Array.isArray(roster?.roster) ? roster.roster.length : 0,
    }),
    [readiness?.readinessScore, readiness?.band, roster?.roster],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchActionInbox();
      if (alive.current) { setActions(rows); setError(null); }
    } catch {
      if (alive.current) setError('Inbox fetch failed');
    } finally {
      if (alive.current) setLoading(false);
    }
  }, []);

  // Sentinel poll — only while a sentinel domain is active (content/knowledge are
  // client-curated and never hit the agent-brain endpoint).
  useEffect(() => {
    if (mode !== 'sentinel') return undefined;
    alive.current = true;
    queueMicrotask(() => { if (alive.current) refresh(); });
    const t = setInterval(refresh, POLL_MS);
    return () => { alive.current = false; clearInterval(t); };
  }, [mode, refresh]);

  // Scorecard — fetched when the KNOWLEDGE domain is active (setState deferred to a
  // microtask + post-await, clear of the house set-state-in-effect rule).
  useEffect(() => {
    if (mode !== 'knowledge') return undefined;
    let live = true;
    queueMicrotask(async () => {
      const s = await fetchInboxScorecard(7);
      if (live) setScorecard(s);
    });
    return () => { live = false; };
  }, [mode]);

  // ESC-to-close + body scroll lock while the panel is open.
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

  // Sentinel optimistic resolve/apply. A dismiss reason (critical cards) rides along
  // to the brain for the accountability ledger.
  const onResolve = useCallback(async (action, status, reason = null) => {
    setActions((prev) => prev.filter((a) => a.id !== action.id));
    try {
      await resolveInboxAction(action.id, status, { reason });
    } catch {
      setActions((prev) => (prev.some((a) => a.id === action.id) ? prev : [action, ...prev]));
    }
  }, []);
  const onApply = useCallback(async (action) => {
    setActions((prev) => prev.filter((a) => a.id !== action.id));
    try {
      await resolveInboxAction(action.id, 'APPROVED', { applyOverride: true });
    } catch {
      setActions((prev) => (prev.some((a) => a.id === action.id) ? prev : [action, ...prev]));
    }
  }, []);

  // ── Content triggers ──
  const draftInStudio = useCallback((card) => {
    // Hand a draft seed to Studio V4 (harmless if unread) and jump there.
    try {
      localStorage.setItem('bbf.studio.seed', JSON.stringify({
        from: 'content-inbox', title: card.title, angle: card.detail || card.insight, chips: card.chips || [],
      }));
    } catch { /* private mode — the navigation still works */ }
    setOpen(false);
    navigate('/command/studio-v4');
  }, [navigate]);

  const sendToReview = useCallback((card) => {
    // Append to a session-durable local review bucket, then retire the card.
    try {
      const key = 'bbf.content.review.v1';
      const bucket = JSON.parse(localStorage.getItem(key) || '[]');
      bucket.unshift({ id: card.id, tag: card.tag, title: card.title, insight: card.insight });
      localStorage.setItem(key, JSON.stringify(bucket.slice(0, 50)));
    } catch { /* non-fatal — the card still leaves the deck */ }
    dismissCard(card.id);
  }, [dismissCard]);

  // ── Knowledge triggers ──
  const launchCave = useCallback((film) => {
    // The Cave reads this jump hint on mount (deck + film id) — see CoachCave.jsx.
    try {
      if (film?.deck && film?.id) localStorage.setItem('bbf.cave.jump', JSON.stringify({ deck: film.deck, id: film.id }));
    } catch { /* proceed — the Cave still opens to its default deck */ }
    setOpen(false);
    navigate('/command/coach-cave');
  }, [navigate]);
  const openLanguageLab = useCallback(() => { setOpen(false); navigate('/command/language-lab'); }, [navigate]);
  const openCoachLab = useCallback(() => { setOpen(false); navigate('/command/coach-lab'); }, [navigate]);

  // Sentinel list, OVERDUE-first (aged safety-critical cards can't hide at the
  // bottom — accountability sorts them to the top).
  const sortedActions = useMemo(() => {
    return actions
      .map((a) => ({ a, over: ageHoursOf(a.created_at) > slaHoursFor(a.type), age: ageHoursOf(a.created_at) }))
      .sort((x, y) => (Number(y.over) - Number(x.over)) || (y.age - x.age))
      .map((w) => w.a);
  }, [actions]);
  const overdueCount = useMemo(
    () => (mode === 'sentinel' ? actions.filter((a) => ageHoursOf(a.created_at) > slaHoursFor(a.type)).length : 0),
    [mode, actions],
  );

  // Visible decks (post-dismiss).
  const contentCards = useMemo(() => CONTENT_INSIGHTS.filter((c) => !dismissed.has(c.id)), [dismissed]);
  const knowledgeCards = useMemo(() => knowledgeDeck.filter((c) => !dismissed.has(c.id)), [knowledgeDeck, dismissed]);

  const count = mode === 'sentinel' ? actions.length
    : mode === 'content' ? contentCards.length
    : knowledgeCards.length + (scorecard ? 1 : 0);

  const title = TITLE_BY_MODE[mode];

  return (
    <>
      {count > 0 ? (
        <button
          type="button"
          className={`ainbox-fab ainbox-fab--${mode}${overdueCount > 0 ? ' ainbox-fab--overdue' : ''}`}
          onClick={() => setOpen(true)}
          aria-label={`Open ${title} — ${count} item${count === 1 ? '' : 's'}${overdueCount > 0 ? `, ${overdueCount} overdue` : ''}`}
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
                <h3 id="ainbox-title" className="ainbox-title">{title}</h3>
              </div>
              <div className="ainbox-head-tools">
                {mode === 'sentinel' ? (
                  <button type="button" className="ainbox-refresh" onClick={refresh} disabled={loading} aria-label="Refresh inbox">↻</button>
                ) : null}
                <button type="button" className="ainbox-x" onClick={() => setOpen(false)} aria-label="Close">✕</button>
              </div>
            </header>

            {error && mode === 'sentinel' ? <div className="ainbox-error" role="alert">{error}</div> : null}

            {mode === 'sentinel' ? (
              count === 0 ? (
                <div className="ainbox-empty"><span aria-hidden="true">◎</span> Inbox zero — no pending agent actions.</div>
              ) : (
                <div className="ainbox-list">
                  {sortedActions.map((a) => <ActionCard key={a.id} action={a} onResolve={onResolve} onApply={onApply} />)}
                </div>
              )
            ) : mode === 'content' ? (
              count === 0 ? (
                <div className="ainbox-empty"><span aria-hidden="true">◎</span> All content insights triaged.</div>
              ) : (
                <div className="ainbox-list">
                  {contentCards.map((c) => (
                    <ContentCard key={c.id} card={c} onDraft={draftInStudio} onReview={sendToReview} onDismiss={dismissCard} />
                  ))}
                </div>
              )
            ) : (
              count === 0 ? (
                <div className="ainbox-empty"><span aria-hidden="true">◎</span> Founder assistant clear.</div>
              ) : (
                <div className="ainbox-list">
                  {scorecard ? <ScorecardCard s={scorecard} /> : null}
                  {knowledgeCards.map((c) => (
                    <KnowledgeCard
                      key={c.id}
                      card={c}
                      onLaunchCave={launchCave}
                      onOpenLanguage={openLanguageLab}
                      onOpenCoachLab={openCoachLab}
                      onDismiss={dismissCard}
                    />
                  ))}
                </div>
              )
            )}
          </aside>
        </div>
      ) : null}
    </>
  );
}
