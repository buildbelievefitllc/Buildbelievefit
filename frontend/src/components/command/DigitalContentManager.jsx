// src/components/command/DigitalContentManager.jsx
// ─────────────────────────────────────────────────────────────────────────────
// DIGITAL CONTENT MANAGER — Command Center panel (admin-only via the AdminGuard
// /command route + server-side session re-gate on every backend call).
//
// Two surfaces, one panel (CEO spec):
//   1. REVIEW BUCKET   — ingests the STATIC bbf_master_content_engine.json library
//      (the 30-day evergreen batch; no live LLM) and renders each post as an
//      actionable card: Series, Language, Format, Target Angle, Hook, Full Caption,
//      Studio Recipe (mode + background + cut sheet), Hashtags, and the text-only
//      Akeem voiceover script. Trilingual filter (EN/ES/PT/All). Each card:
//      [Edit Draft] (tweak script / caption / cut sheet) and [Approve & Synthesize]
//      — the ONLY external API. Outreach posts with no reel_kit schedule WITHOUT a
//      synth call ("Schedule · No VO").
//   2. DISTRIBUTION CALENDAR — month/week grid fed by the queue. Blocks are
//      series-color-coded (Mindset Engine purple, Form Fix gold, …) and DRAG-AND-DROP
//      between days fires a reschedule RPC that updates the row's scheduled_at.
//
// Brand-locked (§2): BBF Purple #6a0dad, Gold #f5c800; matte black canvas only.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import LIBRARY from '../../data/bbf_master_content_engine.json';
import {
  SERIES_META, seriesMeta, readableText,
  approveAndSynthesize, fetchContentQueue, rescheduleContentItem,
} from '../../lib/contentManagerApi.js';
import {
  APPROVAL_STATUS, APPROVAL_LABELS,
  buildAlgorithmicBrief, contentWeight, assessAlgorithmHealth,
} from '../../lib/algorithmicBriefEngine.js';
import ContentVaultGrid from './ContentVaultGrid.jsx';
import { fetchMetaTokenStatus } from '../../lib/contentVaultApi.js';
import './digitalContentManager.css';

// ── Meta distribution-token health light ──────────────────────────────────────
// Passive read of the bbf_meta_token_watchdog flag. Renders NOTHING until the
// watchdog raises CRITICAL_RENEWAL (< 7 days to expiry) — an elegant, zero-noise
// header indicator that only appears when the Dispatch-to-Meta pipeline is about to
// lose its credential. Click reveals the exact expiry date so it's never a surprise.
function MetaKeyStatus() {
  const [status, setStatus] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      // Never block the panel on a status read — a missing/failed flag just hides.
      try { const s = await fetchMetaTokenStatus(); if (alive) setStatus(s); } catch { /* passive */ }
    })();
    return () => { alive = false; };
  }, []);

  if (!status || status.state !== 'CRITICAL_RENEWAL') return null;

  const iso = status.detail?.expires_at_iso;
  const days = status.detail?.days_remaining;
  const dateLabel = iso
    ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Aug 5, 2026';
  const daysLabel = typeof days === 'number' ? ` · ~${Math.max(0, Math.round(days))}d left` : '';

  return (
    <div className="dcm-metakey" data-testid="meta-key-status">
      <button
        type="button"
        className="dcm-metakey-btn"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        data-testid="meta-key-warning"
      >
        <span className="dcm-metakey-dot" aria-hidden="true" />
        Meta Key Refresh Required
      </button>
      {open ? (
        <div className="dcm-metakey-pop" role="status">
          Meta distribution token expires <strong>{dateLabel}</strong>{daysLabel}. Re-mint the
          long-lived system-user token before then to avoid an IG&nbsp;/&nbsp;FB publish outage.
        </div>
      ) : null}
    </div>
  );
}

// ── date helpers (local-time; the queue stores ISO/UTC) ──────────────────────
const pad2 = (n) => String(n).padStart(2, '0');
const isoDay = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const toLocalInput = (d) => `${isoDay(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
function defaultSlot() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}
function monthMatrix(anchor) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - first.getDay());
  const weeks = [];
  const cur = new Date(gridStart);
  for (let w = 0; w < 6; w++) {
    const row = [];
    for (let d = 0; d < 7; d++) { row.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
    weeks.push(row);
  }
  return weeks;
}
function weekRow(anchor) {
  const start = new Date(anchor);
  start.setDate(anchor.getDate() - anchor.getDay());
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
}
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// ── ingest + normalize the static library (posts schema; drafts as a fallback) ──
const RAW_POSTS = Array.isArray(LIBRARY?.posts) ? LIBRARY.posts
  : Array.isArray(LIBRARY?.drafts) ? LIBRARY.drafts : [];
function normalizePost(p) {
  const recipe = p.studio_recipe || {};
  return {
    id: p.id,
    language: String(p.language || 'EN').toUpperCase(),
    format: p.format || recipe.mode || '',
    series: p.series,
    target_angle: p.target_angle || '',
    hook: p.hook || '',
    caption: p.caption || '',
    hashtags: p.hashtags || '',
    recommended_post_time: p.recommended_post_time || '',
    mode: recipe.mode || p.format || '',
    background: recipe.background || '',
    voiceover_script: p.reel_kit?.voiceover_script || p.voiceover_script || '',
    cut_sheet: p.reel_kit?.cut_sheet || '',
    has_vo: !!(p.reel_kit && p.reel_kit.voiceover_script),
    // Optional pre-baked static asset. When a post EXPLICITLY declares one, the
    // approve flow short-circuits ElevenLabs (see approveAndSynthesize). Absent =
    // normal live synth. Explicit-only by design: a static file never mis-binds.
    static_audio_url: p.static_audio_url || p.reel_kit?.static_audio_url || '',
  };
}
const DRAFTS = RAW_POSTS.map(normalizePost);

// ── Series color legend ───────────────────────────────────────────────────────
function SeriesLegend() {
  return (
    <div className="dcm-legend" data-testid="content-mgr-legend">
      {Object.entries(SERIES_META).map(([name, meta]) => (
        <span key={name} className="dcm-legend-item">
          <span className="dcm-legend-dot" style={{ background: meta.color }} aria-hidden="true" />
          {name}
        </span>
      ))}
    </div>
  );
}

// ── Review Bucket · one draft card ────────────────────────────────────────────
// C-02 (Repositioning): in-card disclosure — the verbose verification blocks
// (Full Caption / Cut Sheet / Voiceover Script) collapse behind their labeled
// headers so the review bucket reads as a scannable wall. Editing force-opens
// every section so the textareas are always reachable. Zero deletion — the
// full content lives one tap away.
function CardSection({ label, forceOpen = false, children }) {
  const [open, setOpen] = useState(false);
  const shown = open || forceOpen;
  return (
    <div className="dcm-field dcm-sec">
      <button type="button" className="dcm-sec-head" aria-expanded={shown} onClick={() => setOpen((v) => !v)}>
        <span className="dcm-label">{label}</span>
        <span className="dcm-sec-chev" aria-hidden="true">{shown ? '▴' : '▾'}</span>
      </button>
      {shown ? children : null}
    </div>
  );
}

// ── THE PLATFORM CALIBRATION MATRIX ──────────────────────────────────────────
// Structured algorithmic brief rendered before approval (Step-In-Approval): the
// engine formulates per-platform execution rules; the Sovereign green-lights
// them. Tight 3-up grid, clinical chips, zero visual bloat.
function PlatformMatrix({ brief, draftId }) {
  const { tiktok, instagram, youtube } = brief.platform_specifics;
  return (
    <div className="dcm-matrix" data-testid={`draft-matrix-${draftId}`}>
      <div className="dcm-matrix-strip">
        <span className="dcm-matrix-kv"><span className="dcm-label">Algorithmic Target</span><span className="dcm-matrix-v">{brief.algorithmic_target}</span></span>
        <span className="dcm-matrix-kv"><span className="dcm-label">Pacing Strategy</span><span className="dcm-matrix-v">{brief.pacing_strategy}</span></span>
      </div>
      <div className="dcm-matrix-grid">
        <div className="dcm-platform" data-platform="tiktok">
          <div className="dcm-platform-head">
            <span className="dcm-platform-name">TikTok</span>
            <span className="dcm-platform-opt">Optimized · {tiktok.optimized}</span>
          </div>
          <div className="dcm-platform-row"><span className="dcm-platform-k">3-Second Hook</span><p className="dcm-platform-v">{tiktok.hook_3s}</p></div>
          <div className="dcm-platform-row"><span className="dcm-platform-k">Pacing Cues</span><p className="dcm-platform-v">{tiktok.pacing_cues}</p></div>
          <div className="dcm-platform-row">
            <span className="dcm-platform-k">Sub-Culture Tags</span>
            <div className="dcm-recipe-chips">{tiktok.subculture_tags.map((t) => <span key={t} className="dcm-chip">{t}</span>)}</div>
          </div>
        </div>
        <div className="dcm-platform" data-platform="instagram">
          <div className="dcm-platform-head">
            <span className="dcm-platform-name">Instagram</span>
            <span className="dcm-platform-opt">Optimized · {instagram.optimized}</span>
          </div>
          <div className="dcm-platform-row"><span className="dcm-platform-k">Aesthetic Framing</span><p className="dcm-platform-v">{instagram.framing}</p></div>
          <div className="dcm-platform-row"><span className="dcm-platform-k">Caption Structure</span><p className="dcm-platform-v">{instagram.caption_structure}</p></div>
          <div className="dcm-platform-row"><span className="dcm-platform-k">B-Roll Cues</span><p className="dcm-platform-v">{instagram.broll_cues}</p></div>
        </div>
        <div className="dcm-platform" data-platform="youtube">
          <div className="dcm-platform-head">
            <span className="dcm-platform-name">YouTube Shorts</span>
            <span className="dcm-platform-opt">Optimized · {youtube.optimized}</span>
          </div>
          <div className="dcm-platform-row"><span className="dcm-platform-k">SEO Title</span><p className="dcm-platform-v">{youtube.seo_title}</p></div>
          <div className="dcm-platform-row">
            <span className="dcm-platform-k">Search Keywords</span>
            <div className="dcm-recipe-chips">{youtube.search_keywords.map((k) => <span key={k} className="dcm-chip">{k}</span>)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DraftCard({ draft, scheduledSourceRefs, onApproved }) {
  const meta = seriesMeta(draft.series);
  const already = scheduledSourceRefs.has(draft.id);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    voiceover_script: draft.voiceover_script || '',
    caption: draft.caption || '',
    cut_sheet: draft.cut_sheet || '',
  });
  const [slot, setSlot] = useState(() => toLocalInput(defaultSlot()));
  const [state, setState] = useState({ phase: already ? 'done' : 'idle', error: null, audioUrl: null, bypassed: false });

  // ── APPROVAL GATEWAY (Green Light workflow) ──────────────────────────────
  // draft → algorithmic_review → approved. Staging compiles the Platform
  // Calibration Matrix for Sovereign review; Approve Strategy locks the copy
  // (editing freezes) and green-lights deployment. Already-scheduled rows
  // rehydrate as approved. Deployment (the untouched ElevenLabs / queue
  // trigger below) requires the green light — the Step-In-Approval gate.
  const [approvalStatus, setApprovalStatus] = useState(already ? APPROVAL_STATUS.APPROVED : APPROVAL_STATUS.DRAFT);
  // The brief compiles from the LIVE form copy, so an edit made during review
  // re-flows into the strategy the Sovereign is approving.
  const brief = useMemo(
    () => buildAlgorithmicBrief({ ...draft, caption: form.caption, cut_sheet: form.cut_sheet }),
    [draft, form.caption, form.cut_sheet],
  );
  const inReview = approvalStatus === APPROVAL_STATUS.REVIEW;
  const strategyApproved = approvalStatus === APPROVAL_STATUS.APPROVED;

  const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const approve = async () => {
    setState({ phase: 'working', error: null, audioUrl: null, bypassed: false });
    try {
      const merged = {
        id: draft.id,
        series: draft.series,
        target_angle: draft.target_angle,
        hook: draft.hook,
        caption: form.caption,
        voiceover_script: form.voiceover_script,
        cut_sheet: form.cut_sheet,
        language: draft.language,
        format: draft.format,
        hashtags: draft.hashtags,
        recommended_post_time: draft.recommended_post_time,
        studio_recipe: { mode: draft.mode, background: draft.background },
        // Asset-protection short-circuit inputs: the explicit pre-baked path (if any)
        // and whether the operator edited the script. An edit forces a fresh synth so
        // the audio always matches the shipped copy; an unedited script with a static
        // asset skips ElevenLabs entirely.
        static_audio_url: draft.static_audio_url || '',
        script_dirty: form.voiceover_script.trim() !== String(draft.voiceover_script || '').trim(),
        // Algorithmic Distribution Engine metadata — rides the approve payload
        // so the queue row carries the green-lit strategy (additive; the
        // backend ignores fields it doesn't persist).
        approval_status: APPROVAL_STATUS.APPROVED,
        algorithmic_target: brief.algorithmic_target,
        pacing_strategy: brief.pacing_strategy,
        platform_specifics: brief.platform_specifics,
      };
      const scheduledIso = new Date(slot).toISOString();
      const { audio } = await approveAndSynthesize(merged, { scheduled_at: scheduledIso });
      setState({ phase: 'done', error: null, audioUrl: audio?.url || null, bypassed: !!audio?.static });
      onApproved?.();
    } catch (e) {
      setState({ phase: 'error', error: humanizeError(e?.message), audioUrl: null, bypassed: false });
    }
  };

  const working = state.phase === 'working';
  const done = state.phase === 'done';
  const approveLabel = working
    ? (draft.has_vo ? '⟳ Synthesizing…' : '⟳ Scheduling…')
    : done ? '↻ Re-run'
      : draft.has_vo ? 'Approve & Synthesize' : 'Schedule · No VO';

  return (
    <article className={`dcm-card${done ? ' is-done' : ''}`} data-testid="draft-card" data-draft-id={draft.id} data-status={state.phase} data-approval={approvalStatus} data-lang={draft.language}>
      <header className="dcm-card-head">
        <span className="dcm-series" style={{ background: meta.color, color: readableText(meta.color) }}>{draft.series}</span>
        <span className="dcm-lang">{draft.language}</span>
        {draft.format ? <span className="dcm-format">{draft.format}</span> : null}
        {draft.recommended_post_time ? <span className="dcm-slot-band">🕑 {draft.recommended_post_time}</span> : null}
        <span className={`dcm-approval dcm-approval--${approvalStatus}`} data-testid={`draft-approval-${draft.id}`}>
          {strategyApproved ? '◆ ' : ''}{APPROVAL_LABELS[approvalStatus]}
        </span>
        {done ? <span className="dcm-scheduled-badge">✓ Scheduled</span> : null}
      </header>

      {draft.target_angle ? (
        <div className="dcm-field">
          <span className="dcm-label">Target Angle</span>
          <p className="dcm-angle">{draft.target_angle}</p>
        </div>
      ) : null}

      <div className="dcm-field">
        <span className="dcm-label">Hook</span>
        <p className="dcm-hook">{draft.hook}</p>
      </div>

      <CardSection label="Full Caption" forceOpen={editing}>
        {editing
          ? <textarea className="dcm-textarea" rows={5} value={form.caption} onChange={setField('caption')} data-testid={`draft-caption-${draft.id}`} />
          : <p className="dcm-caption">{form.caption}</p>}
      </CardSection>

      {draft.hashtags ? (
        <div className="dcm-field">
          <span className="dcm-label">Hashtags</span>
          <p className="dcm-hashtags">{draft.hashtags}</p>
        </div>
      ) : null}

      <div className="dcm-field">
        <span className="dcm-label">Studio Recipe</span>
        <div className="dcm-recipe-chips">
          {draft.mode ? <span className="dcm-chip">Mode · {draft.mode}</span> : null}
          {draft.background ? <span className="dcm-chip">{draft.background}</span> : null}
        </div>
      </div>

      <CardSection label="Cut Sheet · Visuals" forceOpen={editing}>
        {editing
          ? <textarea className="dcm-textarea" rows={3} value={form.cut_sheet} onChange={setField('cut_sheet')} data-testid={`draft-cutsheet-${draft.id}`} />
          : <p className="dcm-recipe">{form.cut_sheet || '—'}</p>}
      </CardSection>

      <CardSection label={<>🎙 Voiceover Script <em>(Coach Akeem)</em></>} forceOpen={editing}>
        {draft.has_vo ? (
          editing
            ? <textarea className="dcm-textarea dcm-textarea--script" rows={5} value={form.voiceover_script} onChange={setField('voiceover_script')} data-testid={`draft-script-${draft.id}`} />
            : <p className="dcm-script">{form.voiceover_script}</p>
        ) : (
          <p className="dcm-novo">No reel kit — outreach post. Schedules as text/visual only (no synthesis).</p>
        )}
      </CardSection>

      {/* Platform Calibration Matrix — compiled on staging, reviewed before the
          green light. Hidden in Draft (no bloat); persistent once approved so
          the execution rules stay in view at deployment. */}
      {(inReview || strategyApproved) ? <PlatformMatrix brief={brief} draftId={draft.id} /> : null}

      {state.bypassed ? (
        <p
          className="dcm-bypass"
          data-testid={`draft-bypass-${draft.id}`}
          style={{
            margin: '.45rem 0 0',
            fontFamily: "var(--bd, 'Barlow Condensed'), sans-serif",
            fontSize: '.78rem',
            letterSpacing: '.5px',
            color: 'var(--gold-soft, #f5cf60)',
          }}
        >
          ⚡ READY · pre-baked asset served · 0 ElevenLabs credits spent
        </p>
      ) : null}
      {state.audioUrl ? (
        <audio className="dcm-audio" src={state.audioUrl} controls data-testid={`draft-audio-${draft.id}`} />
      ) : null}
      {state.error ? <p className="dcm-error" role="alert">⚠ {state.error}</p> : null}

      <footer className="dcm-card-foot">
        <label className="dcm-slot">
          <span className="dcm-slot-lbl">Schedule</span>
          <input
            type="datetime-local"
            className="dcm-slot-input"
            value={slot}
            onChange={(e) => setSlot(e.target.value)}
            data-testid={`draft-schedule-${draft.id}`}
            disabled={working}
          />
        </label>
        <div className="dcm-actions">
          <button
            type="button"
            className="dcm-btn dcm-btn--ghost"
            onClick={() => setEditing((v) => !v)}
            disabled={working || strategyApproved}
            title={strategyApproved ? 'Strategy approved — copy is locked for deployment' : undefined}
            data-testid={`draft-edit-${draft.id}`}
          >
            {strategyApproved ? '🔒 Locked' : editing ? 'Done Editing' : 'Edit Draft'}
          </button>
          {/* Green Light workflow: Draft → stage the review; Review → approve the
              strategy; Approved → the existing deployment trigger unlocks. */}
          {approvalStatus === APPROVAL_STATUS.DRAFT ? (
            <button
              type="button"
              className="dcm-btn dcm-btn--review"
              onClick={() => { setEditing(false); setApprovalStatus(APPROVAL_STATUS.REVIEW); }}
              disabled={working}
              data-testid={`draft-stage-${draft.id}`}
            >
              ⚡ Stage Algorithmic Review
            </button>
          ) : null}
          {inReview ? (
            <>
              <button
                type="button"
                className="dcm-btn dcm-btn--ghost"
                onClick={() => setApprovalStatus(APPROVAL_STATUS.DRAFT)}
                disabled={working}
                data-testid={`draft-unstage-${draft.id}`}
              >
                ← Back to Draft
              </button>
              <button
                type="button"
                className="dcm-btn dcm-btn--approve"
                onClick={() => { setEditing(false); setApprovalStatus(APPROVAL_STATUS.APPROVED); }}
                disabled={working}
                data-testid={`draft-greenlight-${draft.id}`}
              >
                ◆ Approve Strategy
              </button>
            </>
          ) : null}
          <button
            type="button"
            className="dcm-btn dcm-btn--gold"
            onClick={approve}
            disabled={working || !strategyApproved}
            title={strategyApproved ? undefined : 'Approve the algorithmic strategy to unlock deployment'}
            data-testid={`draft-approve-${draft.id}`}
          >
            {approveLabel}
          </button>
        </div>
      </footer>
    </article>
  );
}

// ── Algorithm Health — sequencing read-out above the calendar grid ───────────
// The engine audits the scheduled queue chronologically: content mix (heavy /
// reset / neutral) + the longest run of consecutive clinical posts. A run ≥ 4
// surfaces the clinical strain warning with the prescribed reset insertion.
// Recomputes live as blocks are dragged — rescheduling IS the treatment.
function AlgorithmHealthBar({ items }) {
  const health = useMemo(() => assessAlgorithmHealth(items), [items]);
  const LABEL = { optimal: 'Optimal Pacing', watch: 'Watch · Heavy Density Rising', strain: 'Retention Strain' };
  return (
    <div className="dcm-health" data-testid="algorithm-health" data-health={health.status}>
      <div className="dcm-health-bar">
        <span className={`dcm-health-dot is-${health.status}`} aria-hidden="true" />
        <span className="dcm-health-title">Algorithm Health</span>
        <span className="dcm-health-status">{LABEL[health.status]}</span>
        <span className="dcm-health-mix">
          <span className="dcm-health-k">Heavy</span> {health.mix.heavy}
          <span className="dcm-health-sep">·</span>
          <span className="dcm-health-k">Reset</span> {health.mix.reset}
          <span className="dcm-health-sep">·</span>
          <span className="dcm-health-k">Neutral</span> {health.mix.neutral}
          <span className="dcm-health-sep">·</span>
          <span className="dcm-health-k">Max Heavy Run</span> {health.longestHeavyRun}
        </span>
      </div>
      {health.warnings.map((w) => (
        <p key={w.startsAt} className="dcm-health-warn" role="alert" data-testid="algorithm-health-warning">
          ⚠ {w.message}
        </p>
      ))}
    </div>
  );
}

// ── Distribution Calendar ─────────────────────────────────────────────────────
function DistributionCalendar({ items, onReschedule }) {
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [view, setView] = useState('month');
  const draggingId = useRef(null);

  const byDay = useMemo(() => {
    const map = new Map();
    for (const it of items) {
      if (!it?.scheduled_at) continue;
      const key = isoDay(new Date(it.scheduled_at));
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(it);
    }
    return map;
  }, [items]);

  const weeks = view === 'month' ? monthMatrix(anchor) : [weekRow(anchor)];
  const step = (dir) => setAnchor((a) => {
    const d = new Date(a);
    if (view === 'month') d.setMonth(d.getMonth() + dir); else d.setDate(d.getDate() + dir * 7);
    return d;
  });

  const onDragStart = (id) => (e) => {
    draggingId.current = id;
    try { e.dataTransfer.setData('text/plain', id); e.dataTransfer.effectAllowed = 'move'; } catch { /* jsdom */ }
  };
  const onDragOver = (e) => { e.preventDefault(); try { e.dataTransfer.dropEffect = 'move'; } catch { /* noop */ } };
  const onDrop = (cellDate) => (e) => {
    e.preventDefault();
    const id = draggingId.current || (() => { try { return e.dataTransfer.getData('text/plain'); } catch { return ''; } })();
    draggingId.current = null;
    if (!id) return;
    const existing = items.find((x) => x.id === id);
    if (!existing) return;
    const prev = new Date(existing.scheduled_at);
    const next = new Date(cellDate.getFullYear(), cellDate.getMonth(), cellDate.getDate(), prev.getHours(), prev.getMinutes(), 0, 0);
    if (isoDay(next) === isoDay(prev)) return;
    onReschedule(id, next.toISOString());
  };

  const title = view === 'month'
    ? `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`
    : `Week of ${MONTHS[weeks[0][0].getMonth()]} ${weeks[0][0].getDate()}`;
  const todayIso = isoDay(new Date());

  return (
    <div className="dcm-cal" data-testid="content-calendar" data-view={view}>
      <div className="dcm-cal-bar">
        <div className="dcm-cal-nav">
          <button type="button" className="dcm-btn dcm-btn--ghost" onClick={() => step(-1)} data-testid="cal-prev" aria-label="Previous">‹</button>
          <span className="dcm-cal-title" data-testid="cal-title">{title}</span>
          <button type="button" className="dcm-btn dcm-btn--ghost" onClick={() => step(1)} data-testid="cal-next" aria-label="Next">›</button>
        </div>
        <div className="dcm-cal-views">
          <button type="button" className={`dcm-viewbtn${view === 'month' ? ' is-on' : ''}`} onClick={() => setView('month')} data-testid="cal-view-month">Month</button>
          <button type="button" className={`dcm-viewbtn${view === 'week' ? ' is-on' : ''}`} onClick={() => setView('week')} data-testid="cal-view-week">Week</button>
        </div>
      </div>

      <AlgorithmHealthBar items={items} />

      <SeriesLegend />

      <div className="dcm-cal-grid">
        {WEEKDAYS.map((w) => <div key={w} className="dcm-cal-dow">{w}</div>)}
        {weeks.flat().map((day) => {
          const key = isoDay(day);
          const inMonth = view === 'week' || day.getMonth() === anchor.getMonth();
          const dayItems = byDay.get(key) || [];
          return (
            <div
              key={key}
              className={`dcm-cal-cell${inMonth ? '' : ' is-muted'}${key === todayIso ? ' is-today' : ''}`}
              data-testid={`cal-day-${key}`}
              data-iso={key}
              onDragOver={onDragOver}
              onDrop={onDrop(day)}
            >
              <span className="dcm-cal-daynum">{day.getDate()}</span>
              <div className="dcm-cal-items">
                {dayItems.map((it) => {
                  const c = seriesMeta(it.series).color;
                  const weight = contentWeight(it.series);
                  return (
                    <button
                      key={it.id}
                      type="button"
                      className={`dcm-cal-block is-w-${weight}`}
                      style={{ '--series': c }}
                      draggable
                      onDragStart={onDragStart(it.id)}
                      data-testid={`cal-item-${it.id}`}
                      data-item-id={it.id}
                      data-series={it.series}
                      data-weight={weight}
                      title={`${it.series} · ${it.hook || ''} · retention weight: ${weight}`}
                    >
                      <span className="dcm-cal-block-top">
                        <span className="dcm-cal-block-series">{it.series}</span>
                        {it.language ? <span className="dcm-cal-block-lang">{it.language}</span> : null}
                      </span>
                      <span className="dcm-cal-block-hook">{it.hook || it.target_angle || '—'}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── error humanizer ───────────────────────────────────────────────────────────
function humanizeError(slug) {
  const map = {
    no_admin_session: 'No admin session — sign in to the Command Center.',
    not_admin: 'This surface is restricted to the administrative tier.',
    empty_script: 'The voiceover script is empty — add text before synthesizing.',
    tts_unconfigured: 'The voice engine is not configured on the server.',
    tts_failed: 'ElevenLabs could not synthesize this clip. Try again.',
  };
  return map[slug] || `Something went wrong (${slug || 'unknown'}).`;
}

// ── Panel ─────────────────────────────────────────────────────────────────────
export default function DigitalContentManager() {
  const [tab, setTab] = useState('bucket'); // 'bucket' | 'vault' | 'calendar'
  const [lang, setLang] = useState('EN');    // 'EN' | 'ES' | 'PT' | 'ALL'
  const [items, setItems] = useState([]);
  const [queueState, setQueueState] = useState({ loading: true, error: null });

  const refresh = useCallback(async () => {
    setQueueState((s) => ({ ...s, loading: true }));
    try {
      const rows = await fetchContentQueue();
      setItems(rows);
      setQueueState({ loading: false, error: null });
    } catch (e) {
      setQueueState({ loading: false, error: humanizeError(e?.message) });
    }
  }, []);

  // Initial load — inline async fetch (setState lands after the await, never
  // synchronously in the effect body). Event-driven refetches use `refresh` above.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const rows = await fetchContentQueue();
        if (alive) setItems(rows);
        if (alive) setQueueState({ loading: false, error: null });
      } catch (e) {
        if (alive) setQueueState({ loading: false, error: humanizeError(e?.message) });
      }
    })();
    return () => { alive = false; };
  }, []);

  const handleReschedule = useCallback(async (id, scheduledIso) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, scheduled_at: scheduledIso } : it)));
    try {
      const updated = await rescheduleContentItem({ id, scheduled_at: scheduledIso });
      if (updated) setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...updated } : it)));
    } catch {
      refresh();
    }
  }, [refresh]);

  const scheduledSourceRefs = useMemo(
    () => new Set(items.map((it) => it.source_ref).filter(Boolean)),
    [items],
  );

  const visibleDrafts = useMemo(
    () => (lang === 'ALL' ? DRAFTS : DRAFTS.filter((d) => d.language === lang)),
    [lang],
  );

  return (
    <section className="dcm" data-testid="content-manager">
      <header className="dcm-head">
        <div>
          <h2 className="dcm-title">Digital Content Manager</h2>
          <p className="dcm-sub">
            Static pre-baked library · zero live-LLM spend. The Executive Trigger
            (Approve &amp; Synthesize) is the only external call.
          </p>
        </div>
        <MetaKeyStatus />
        <div className="dcm-tabs" role="tablist" aria-label="Content Manager surfaces">
          <button
            type="button" role="tab" aria-selected={tab === 'bucket'}
            className={`dcm-tab${tab === 'bucket' ? ' is-on' : ''}`}
            onClick={() => setTab('bucket')} data-testid="content-mgr-tab-bucket"
          >
            Review Bucket
          </button>
          <button
            type="button" role="tab" aria-selected={tab === 'vault'}
            className={`dcm-tab${tab === 'vault' ? ' is-on' : ''}`}
            onClick={() => setTab('vault')} data-testid="content-mgr-tab-vault"
          >
            Marketing Vault
          </button>
          <button
            type="button" role="tab" aria-selected={tab === 'calendar'}
            className={`dcm-tab${tab === 'calendar' ? ' is-on' : ''}`}
            onClick={() => { setTab('calendar'); refresh(); }} data-testid="content-mgr-tab-calendar"
          >
            Distribution Calendar
          </button>
        </div>
      </header>

      {tab === 'bucket' ? (
        <>
          <div className="dcm-langbar" role="tablist" aria-label="Language filter">
            {['EN', 'ES', 'PT', 'ALL'].map((L) => (
              <button
                key={L}
                type="button"
                role="tab"
                aria-selected={lang === L}
                className={`dcm-langchip${lang === L ? ' is-on' : ''}`}
                onClick={() => setLang(L)}
                data-testid={`content-mgr-lang-${L.toLowerCase()}`}
              >
                {L === 'ALL' ? `All (${DRAFTS.length})` : `${L} (${DRAFTS.filter((d) => d.language === L).length})`}
              </button>
            ))}
          </div>
          <div className="dcm-bucket" data-testid="review-bucket">
            {visibleDrafts.length === 0 ? (
              <p className="dcm-empty">No drafts for this language in bbf_master_content_engine.json.</p>
            ) : (
              visibleDrafts.map((d) => (
                <DraftCard
                  key={d.id}
                  draft={d}
                  scheduledSourceRefs={scheduledSourceRefs}
                  onApproved={refresh}
                />
              ))
            )}
          </div>
        </>
      ) : tab === 'vault' ? (
        <ContentVaultGrid />
      ) : (
        <div className="dcm-calendar-wrap">
          {queueState.error ? <p className="dcm-error" role="alert">⚠ {queueState.error}</p> : null}
          {queueState.loading && items.length === 0 ? (
            <p className="dcm-empty">Loading the distribution queue…</p>
          ) : (
            <DistributionCalendar items={items} onReschedule={handleReschedule} />
          )}
        </div>
      )}
    </section>
  );
}
