// src/components/command/DigitalContentManager.jsx
// ─────────────────────────────────────────────────────────────────────────────
// DIGITAL CONTENT MANAGER — Command Center panel (admin-only via the AdminGuard
// /command route + server-side session re-gate on every backend call).
//
// Three surfaces, one panel (CEO spec):
//   1. REVIEW BUCKET   — ingests the STATIC bbf_master_content_engine.json library
//      (no live LLM) and renders each draft as an actionable card: Series, Target
//      Angle, Hook, Full Caption, Studio Recipe (visuals), and the text-only Akeem
//      voiceover script. Each card: [Edit Draft] (tweak script/caption/recipe) and
//      [Approve & Synthesize] (the ONLY external API — bakes the Akeem MP3 and
//      inserts a scheduled row into bbf_content_manager_queue).
//   2. DISTRIBUTION CALENDAR — month/week grid fed by the queue. Blocks are
//      color-coded by series and DRAG-AND-DROP between days fires a reschedule RPC
//      that updates the row's scheduled_at.
//
// Brand-locked (§2): BBF Purple #6a0dad, Gold #f5c800; matte black canvas only.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import LIBRARY from '../../data/bbf_master_content_engine.json';
import {
  SERIES_META, seriesMeta, approveAndSynthesize, fetchContentQueue, rescheduleContentItem,
} from '../../lib/contentManagerApi.js';
import './digitalContentManager.css';

// ── date helpers (local-time; the queue stores ISO/UTC) ──────────────────────
const pad2 = (n) => String(n).padStart(2, '0');
const isoDay = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
// datetime-local input value (YYYY-MM-DDTHH:MM) from a Date.
const toLocalInput = (d) => `${isoDay(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
// Default approval slot: tomorrow at 09:00 local.
function defaultSlot() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}
// Build a month matrix (weeks of 7 Sun→Sat Dates) covering `anchor`'s month.
function monthMatrix(anchor) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - first.getDay()); // back to Sunday
  const weeks = [];
  const cur = new Date(gridStart);
  for (let w = 0; w < 6; w++) {
    const row = [];
    for (let d = 0; d < 7; d++) { row.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
    weeks.push(row);
  }
  return weeks;
}
// Build a single week (Sun→Sat) containing `anchor`.
function weekRow(anchor) {
  const start = new Date(anchor);
  start.setDate(anchor.getDate() - anchor.getDay());
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
}
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const DRAFTS = Array.isArray(LIBRARY?.drafts) ? LIBRARY.drafts : [];

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
function DraftCard({ draft, scheduledSourceRefs, onApproved }) {
  const meta = seriesMeta(draft.series);
  const already = scheduledSourceRefs.has(draft.id);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    voiceover_script: draft.voiceover_script || '',
    caption: draft.caption || '',
    visual: draft.studio_recipe?.visual || '',
  });
  const [slot, setSlot] = useState(() => toLocalInput(defaultSlot()));
  const [state, setState] = useState({ phase: already ? 'done' : 'idle', error: null, audioUrl: null });

  const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const approve = async () => {
    setState({ phase: 'working', error: null, audioUrl: null });
    try {
      const merged = {
        ...draft,
        voiceover_script: form.voiceover_script,
        caption: form.caption,
        studio_recipe: { ...(draft.studio_recipe || {}), visual: form.visual },
      };
      const scheduledIso = new Date(slot).toISOString();
      const { audio } = await approveAndSynthesize(merged, { scheduled_at: scheduledIso });
      setState({ phase: 'done', error: null, audioUrl: audio?.url || null });
      onApproved?.();
    } catch (e) {
      setState({ phase: 'error', error: humanizeError(e?.message), audioUrl: null });
    }
  };

  const recipe = draft.studio_recipe || {};
  const working = state.phase === 'working';
  const done = state.phase === 'done';

  return (
    <article className={`dcm-card${done ? ' is-done' : ''}`} data-testid="draft-card" data-draft-id={draft.id} data-status={state.phase}>
      <header className="dcm-card-head">
        <span className="dcm-series" style={{ '--series': meta.color }}>{draft.series}</span>
        {recipe.format ? <span className="dcm-format">{recipe.format}</span> : null}
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

      <div className="dcm-field">
        <span className="dcm-label">Full Caption</span>
        {editing
          ? <textarea className="dcm-textarea" rows={4} value={form.caption} onChange={setField('caption')} data-testid={`draft-caption-${draft.id}`} />
          : <p className="dcm-caption">{form.caption}</p>}
      </div>

      <div className="dcm-field">
        <span className="dcm-label">Studio Recipe · Visuals</span>
        {editing
          ? <textarea className="dcm-textarea" rows={3} value={form.visual} onChange={setField('visual')} data-testid={`draft-visual-${draft.id}`} />
          : <p className="dcm-recipe">{form.visual}</p>}
        {recipe.asset ? <span className="dcm-asset">⛓ {recipe.asset}</span> : null}
      </div>

      <div className="dcm-field">
        <span className="dcm-label">🎙 Voiceover Script <em>(Coach Akeem)</em></span>
        {editing
          ? <textarea className="dcm-textarea dcm-textarea--script" rows={5} value={form.voiceover_script} onChange={setField('voiceover_script')} data-testid={`draft-script-${draft.id}`} />
          : <p className="dcm-script">{form.voiceover_script}</p>}
      </div>

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
            disabled={working}
            data-testid={`draft-edit-${draft.id}`}
          >
            {editing ? 'Done Editing' : 'Edit Draft'}
          </button>
          <button
            type="button"
            className="dcm-btn dcm-btn--gold"
            onClick={approve}
            disabled={working}
            data-testid={`draft-approve-${draft.id}`}
          >
            {working ? '⟳ Synthesizing…' : done ? '↻ Re-synthesize' : 'Approve & Synthesize'}
          </button>
        </div>
      </footer>
    </article>
  );
}

// ── Distribution Calendar ─────────────────────────────────────────────────────
function DistributionCalendar({ items, onReschedule }) {
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [view, setView] = useState('month'); // 'month' | 'week'
  const draggingId = useRef(null);

  // Group scheduled items by local ISO day.
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
    // Preserve the original time-of-day; move only the date to the dropped cell.
    const prev = new Date(existing.scheduled_at);
    const next = new Date(cellDate.getFullYear(), cellDate.getMonth(), cellDate.getDate(), prev.getHours(), prev.getMinutes(), 0, 0);
    if (isoDay(next) === isoDay(prev)) return; // no-op drop onto same day
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
                  return (
                    <button
                      key={it.id}
                      type="button"
                      className="dcm-cal-block"
                      style={{ '--series': c }}
                      draggable
                      onDragStart={onDragStart(it.id)}
                      data-testid={`cal-item-${it.id}`}
                      data-item-id={it.id}
                      data-series={it.series}
                      title={`${it.series} · ${it.hook || ''}`}
                    >
                      <span className="dcm-cal-block-series">{it.series}</span>
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
  const [tab, setTab] = useState('bucket'); // 'bucket' | 'calendar'
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

  // Optimistic reschedule → fire the RPC → reconcile from the returned row.
  const handleReschedule = useCallback(async (id, scheduledIso) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, scheduled_at: scheduledIso } : it)));
    try {
      const updated = await rescheduleContentItem({ id, scheduled_at: scheduledIso });
      if (updated) setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...updated } : it)));
    } catch {
      refresh(); // revert to server truth on failure
    }
  }, [refresh]);

  const scheduledSourceRefs = useMemo(
    () => new Set(items.map((it) => it.source_ref).filter(Boolean)),
    [items],
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
        <div className="dcm-tabs" role="tablist" aria-label="Content Manager surfaces">
          <button
            type="button" role="tab" aria-selected={tab === 'bucket'}
            className={`dcm-tab${tab === 'bucket' ? ' is-on' : ''}`}
            onClick={() => setTab('bucket')} data-testid="content-mgr-tab-bucket"
          >
            Review Bucket
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
        <div className="dcm-bucket" data-testid="review-bucket">
          {DRAFTS.length === 0 ? (
            <p className="dcm-empty">No drafts in bbf_master_content_engine.json.</p>
          ) : (
            DRAFTS.map((d) => (
              <DraftCard
                key={d.id}
                draft={d}
                scheduledSourceRefs={scheduledSourceRefs}
                onApproved={refresh}
              />
            ))
          )}
        </div>
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
