// src/components/command/ClientDossier.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 6 — Client Detail Dossier (the drill-in from a Roster card).
// Phase 7 — + 90-day analytics (read) and editable macro targets (mutation).
//
// Data path (all via lib/rosterApi — IDENTICAL gateway + admin auth):
//   detail        { action:'detail', id }         → { ok, client:{…full row} }
//   analytics     { action:'analytics', id }       → { ok, readiness:[…], volume:[…] }
//   update_target { action:'update_target', id,… } → { ok, client:{ id, tdee_target,
//                                                       macro_p, macro_c, macro_f } }  ← PARTIAL
//
// ⚠️ All three key on the `id` PK, NOT `uid` (the function 400s on missing_id).
// ⚠️ update_target returns ONLY the 5 macro fields — we MERGE them into detail
//    state so name / plans / etc. survive, and the tiles update without a refetch.
//
// State contract per request: { data, isLoading, error } — no silent failures, no
// infinite spinners. BACK is ALWAYS rendered so the coach is never trapped.

import { useCallback, useEffect, useState } from 'react';
import { rosterCall, fetchAnalytics, updateTargets, askCoCoach, toErrorMessage, TARGET_MAX, COACH_MAX } from '../../lib/rosterApi.js';
import CommandSurface from './CommandSurface.jsx';
import { BarChart, LineChart } from './charts.jsx';
import { numOrNull, GRN, PURL, GOLD_SOFT } from './chartUtils.js';
import './analytics.css';

export default function ClientDossier({ client, onBack }) {
  // Detail (full client row).
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Analytics (90-day readiness + training volume) — its own state machine so a
  // slow/failed analytics pull never blocks the dossier body.
  const [analytics, setAnalytics] = useState(null);
  const [anLoading, setAnLoading] = useState(false);
  const [anError, setAnError] = useState(null);

  const fetchDetail = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Drill in by the real PK (`id`), never `uid` — see contract note above.
      const body = await rosterCall('detail', { id: client.id });
      setData(body.client ?? null);
    } catch (e) {
      setError(toErrorMessage(e));
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [client.id]);

  const fetchAnalyticsData = useCallback(async () => {
    setAnLoading(true);
    setAnError(null);
    try {
      const body = await fetchAnalytics(client.id);
      setAnalytics({ readiness: body.readiness ?? [], volume: body.volume ?? [] });
    } catch (e) {
      setAnError(toErrorMessage(e));
      setAnalytics(null);
    } finally {
      setAnLoading(false);
    }
  }, [client.id]);

  // Fire detail + analytics CONCURRENTLY on mount. Deferred via microtask so the
  // initial setState lands outside the synchronous effect body (satisfies
  // react-hooks/set-state-in-effect); cancel-guarded against unmount.
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      fetchDetail();
      fetchAnalyticsData();
    });
    return () => { cancelled = true; };
  }, [fetchDetail, fetchAnalyticsData]);

  // Merge a partial update_target row into detail state — instant UI, no refetch.
  const applyTargetPatch = useCallback((patch) => {
    setData((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  // Fall back to the roster row's fields while detail is in flight, so the header
  // has context immediately instead of a contextless spinner.
  const head = data ?? client;
  const name = head.name || head.uid || 'Unnamed';
  const tier = head.subscription_tier || null;

  return (
    <div>
      <button type="button" style={styles.back} onClick={onBack}>← Back to Roster</button>

      <CommandSurface
        kicker={`Dossier · ${head.uid || head.id || 'client'}`}
        title={name}
        lede={head.email || '—'}
      >
        <div style={styles.badgeStrip}>
          <Badge label={head.role || 'client'} color={tierColor(tier)} />
          {tier ? <Badge label={tier} color={tierColor(tier)} /> : null}
          {head.metabolic_tier ? <Badge label={head.metabolic_tier} color="var(--gold-soft)" /> : null}
          {data?.current_streak ? <Badge label={`Streak · ${data.current_streak}`} color="var(--grn)" /> : null}
        </div>

        {isLoading ? <Loading label="Loading dossier…" /> : null}

        {!isLoading && error ? (
          <div style={styles.errorBox} role="alert">
            <div style={styles.errorTitle}>Dossier fetch failed</div>
            <div style={styles.errorMsg}>{error}</div>
            <div style={styles.errorActions}>
              <button type="button" style={styles.retry} onClick={fetchDetail}>Retry</button>
              <button type="button" style={styles.retry} onClick={onBack}>Back to Roster</button>
            </div>
          </div>
        ) : null}

        {!isLoading && !error && data ? (
          <DossierBody
            c={data}
            clientId={client.id}
            onPatched={applyTargetPatch}
            analytics={{ data: analytics, loading: anLoading, error: anError, onRetry: fetchAnalyticsData }}
          />
        ) : null}
      </CommandSurface>
    </div>
  );
}

// ── The full dossier once detail data has loaded — a tabbed master-detail body. ─
// Co-Coach stays persistent above the tabs (the agentic centerpiece); the three
// required surfaces — Program · Nutrition · Analytics — live behind a tab strip.
const DOSSIER_TABS = [
  { id: 'program', label: 'Program' },
  { id: 'nutrition', label: 'Nutrition' },
  { id: 'analytics', label: 'Analytics' },
];

function DossierBody({ c, clientId, onPatched, analytics }) {
  const [tab, setTab] = useState('program');

  return (
    <div style={styles.body}>
      {/* ── Co-Coach intelligence console (action: coach) — persistent centerpiece. ── */}
      <CoCoach clientId={clientId} clientName={c.name || c.uid || 'this client'} />

      {/* ── Tabbed detail: Program · Nutrition · Analytics. ── */}
      <nav style={styles.tabs} role="tablist" aria-label="Client dossier surfaces">
        {DOSSIER_TABS.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              style={{ ...styles.tab, ...(active ? styles.tabActive : null) }}
            >
              {t.label}
            </button>
          );
        })}
      </nav>

      <div key={tab}>
        {tab === 'program' && <ProgramTab c={c} />}
        {tab === 'nutrition' && <NutritionTab c={c} clientId={clientId} onPatched={onPatched} />}
        {tab === 'analytics' && <AnalyticsTab {...analytics} />}
      </div>

      <div style={styles.footer}>Last updated {fmtDate(c.updated_at) || '—'}</div>
    </div>
  );
}

// ── Program tab — active training plan + training/medical profile. ─────────────
function ProgramTab({ c }) {
  const workoutDays = asArray(c.workout_plan);
  const workoutText = !workoutDays && typeof c.workout_plan === 'string' ? c.workout_plan.trim() : '';

  return (
    <>
      <Section title="Active Training Plan" meta={fmtDate(c.plans_generated_at)}>
        {c.workout_blacklist_hits > 0 ? (
          <div style={styles.guardNote}>
            {c.workout_blacklist_hits} contraindicated movement{c.workout_blacklist_hits === 1 ? '' : 's'} stripped by the BBF guard.
          </div>
        ) : null}
        {workoutDays ? (
          <div style={styles.plan}>
            {workoutDays.map((day, i) => (
              <WorkoutDay key={i} day={day} index={i} />
            ))}
          </div>
        ) : workoutText ? (
          <pre style={styles.pre}>{workoutText}</pre>
        ) : (
          <Empty>No active training plan on file.</Empty>
        )}
      </Section>

      <Section title="Training & Medical Profile">
        <div style={styles.kv}>
          <Field label="Metabolic Tier" value={c.metabolic_tier} />
          <Field label="Block Priority" value={c.block_priority} />
          <Field label="Baseline Status" value={c.baseline_status} color={baselineColor(c.baseline_status)} />
          <Field label="Cardiac Clearance" value={c.cardiac_clearance} color={cardiacColor(c.cardiac_clearance)} />
        </div>
      </Section>
    </>
  );
}

// ── Nutrition tab — editable macro targets + meal plan + dietary profile. ──────
function NutritionTab({ c, clientId, onPatched }) {
  const mealDays = asMealDays(c.meal_plan);
  const mealText = !mealDays && typeof c.meal_plan === 'string' ? c.meal_plan.trim() : '';
  const nutritionText = typeof c.nutrition_plan === 'string' ? c.nutrition_plan.trim() : '';

  return (
    <>
      <MacroTargets c={c} clientId={clientId} onPatched={onPatched} />

      <Section title="Nutrition Plan" meta={fmtDate(c.nutrition_plan_updated_at)}>
        {nutritionText ? <pre style={styles.pre}>{nutritionText}</pre> : null}
        {mealDays ? (
          <div style={styles.plan}>
            {mealDays.map((day, i) => (
              <div key={i} style={styles.mealDay}>
                <span style={styles.dayLabel}>{dayLabel(day, i)}</span>
                <span style={styles.rowSub}>
                  {Array.isArray(day.meals) ? `${day.meals.length} meal${day.meals.length === 1 ? '' : 's'}` : ''}
                  {day.calories ? ` · ${day.calories} kcal` : ''}
                </span>
              </div>
            ))}
          </div>
        ) : mealText ? (
          <pre style={styles.pre}>{mealText}</pre>
        ) : null}
        {!nutritionText && !mealDays && !mealText ? <Empty>No nutrition plan on file.</Empty> : null}
      </Section>

      {(c.dietary_profile || hasItems(c.allergens) || hasItems(c.food_likes) || hasItems(c.food_dislikes)) ? (
        <Section title="Dietary Profile">
          {c.dietary_profile ? <Field label="Profile" value={c.dietary_profile} /> : null}
          <Chips label="Allergens" items={c.allergens} tone="var(--red)" />
          <Chips label="Likes" items={c.food_likes} tone="var(--grn)" />
          <Chips label="Dislikes" items={c.food_dislikes} tone="var(--mut)" />
        </Section>
      ) : null}
    </>
  );
}

// ── Analytics tab — 90-day charts + summary tiles. ─────────────────────────────
function AnalyticsTab({ data, loading, error, onRetry }) {
  return (
    <Section title="90-Day Analytics">
      {loading ? <Loading label="Loading analytics…" /> : null}
      {!loading && error ? (
        <div style={styles.inlineError} role="alert">
          <span style={styles.errorMsg}>{error}</span>
          <button type="button" style={styles.retry} onClick={onRetry}>Retry</button>
        </div>
      ) : null}
      {!loading && !error && data ? <AnalyticsCharts data={data} /> : null}
    </Section>
  );
}

function AnalyticsCharts({ data }) {
  const readiness = Array.isArray(data.readiness) ? data.readiness : [];
  const volume = Array.isArray(data.volume) ? data.volume : [];
  if (!readiness.length && !volume.length) {
    return <Empty>No readiness or training data in the last 90 days.</Empty>;
  }
  const r = summarizeReadiness(readiness);
  const v = summarizeVolume(volume);
  const volumePoints = volume.map((d) => ({ date: d.date, value: Number(d.volume) || 0 }));
  const readinessSeries = [
    { key: 'score', label: 'Readiness', color: GRN, points: readiness.map((d) => ({ date: d.t, value: numOrNull(d.score) })) },
    { key: 'sleep', label: 'Sleep', color: PURL, points: readiness.map((d) => ({ date: d.t, value: numOrNull(d.sleep_quality) })) },
    { key: 'soreness', label: 'Soreness', color: GOLD_SOFT, points: readiness.map((d) => ({ date: d.t, value: numOrNull(d.soreness_level) })) },
  ];

  return (
    <div style={styles.analytics}>
      <div style={styles.tiles}>
        <Tile label="Check-ins" value={r.n} unit="logs" accent="var(--grn)" />
        <Tile label="Avg Score" value={r.avg} unit="" accent="var(--yel)" />
        <Tile label="Days Trained" value={v.days} unit="days" accent="var(--blu)" />
      </div>

      <div className="bbf-an__chart">
        <div className="bbf-an__chart-h">
          <span className="bbf-an__chart-title">Training Volume</span>
          <span className="bbf-an__chart-meta">90-day volume</span>
        </div>
        <BarChart points={volumePoints} unit="vol" />
      </div>

      <div className="bbf-an__chart">
        <div className="bbf-an__chart-h">
          <span className="bbf-an__chart-title">Readiness Trend</span>
          <span className="bbf-an__chart-meta">skips no-reading days</span>
        </div>
        <LineChart series={readinessSeries} />
      </div>

      <div style={styles.kv}>
        <Field label="7-Day Trend" value={r.trend} color={trendColor(r.trend)} />
        <Field label="Latest Sleep" value={fmtMetric(r.sleep)} />
        <Field label="Latest Soreness" value={fmtMetric(r.soreness)} />
      </div>
    </div>
  );
}

// ── Co-Coach — interactive Gemini Q&A about this client (action: coach). ───────
// FULLY ISOLATED { response, isLoading, error } state so it never interferes with
// the dossier/analytics data. The edge function reads `question` and returns the
// text in `answer` (+ the live telemetry it reasoned over) — mapping handled in
// rosterApi.askCoCoach. AI text is rendered as plain pre-wrapped text (no markdown
// lib, no innerHTML) so line breaks survive and there is no XSS surface.
function CoCoach({ clientId, clientName }) {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState(null);
  const [telemetry, setTelemetry] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  async function dispatch(e) {
    e.preventDefault();
    if (isLoading) return; // hard guard against double-dispatch
    if (!query.trim()) { setError('Enter a question for the Co-Coach.'); return; }
    setIsLoading(true);
    setError(null);
    try {
      const body = await askCoCoach(clientId, query);
      setResponse(body.answer ?? '');     // ← `answer`, NOT `response`
      setTelemetry(body.telemetry ?? null);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }

  const blocked = isLoading || !query.trim();

  return (
    <div style={styles.coachPanel}>
      <div style={styles.coachHead}>
        <span style={styles.coachKicker}>Co-Coach · Intelligence</span>
        <span style={styles.coachOnline}>● Online</span>
      </div>

      <form onSubmit={dispatch}>
        <textarea
          style={styles.coachTextarea}
          rows={3}
          maxLength={COACH_MAX}
          placeholder={`Analyze ${clientName}'s readiness trends and recommend a macro adjustment…`}
          value={query}
          disabled={isLoading}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div style={styles.coachActions}>
          <button type="submit" style={{ ...styles.dispatchBtn, opacity: blocked ? 0.55 : 1 }} disabled={blocked}>
            {isLoading ? 'Dispatching…' : 'Dispatch to Co-Coach'}
          </button>
          <span style={styles.coachCounter}>{query.length}/{COACH_MAX}</span>
        </div>
      </form>

      {isLoading ? (
        <div style={styles.coachLoading} role="status" aria-live="polite">
          <span style={styles.spinnerDot} />
          {`Co-Coach is analyzing 90 days of ${clientName}'s telemetry…`}
        </div>
      ) : null}

      {!isLoading && error ? <div style={styles.saveError} role="alert">{error}</div> : null}

      {!isLoading && !error && response ? (
        <div style={styles.coachAnswer}>
          <div style={styles.coachAnswerText}>{response}</div>
          {telemetry ? (
            <div style={styles.coachFoot}>
              {`Reasoned over ${telemetry?.readiness?.checkins_90d ?? 0} readiness check-ins · ${telemetry?.training?.days_logged_90d ?? 0} training days (90d)`}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ── Macro targets — read-only tiles that flip to an editable form. ─────────────
function MacroTargets({ c, clientId, onPatched }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  function startEdit() {
    setDraft({
      tdee_target: c.tdee_target ?? '',
      macro_p: c.macro_p ?? '',
      macro_c: c.macro_c ?? '',
      macro_f: c.macro_f ?? '',
    });
    setSaveError(null);
    setEditing(true);
  }
  function cancel() { setEditing(false); setSaveError(null); }
  const setField = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  async function save(e) {
    e.preventDefault();
    if (saving) return; // hard guard against double-submit
    setSaving(true);
    setSaveError(null);
    try {
      const body = await updateTargets(clientId, draft);
      onPatched(body.client ?? {}); // merge PARTIAL row into detail state → instant tiles
      setEditing(false);
    } catch (err) {
      setSaveError(toErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <Section
        title="Macro Targets"
        action={<button type="button" style={styles.editBtn} onClick={startEdit}>Edit Macros</button>}
      >
        <div style={styles.tiles}>
          <Tile label="Calories" value={c.tdee_target} unit="kcal" accent="var(--yel)" />
          <Tile label="Protein" value={c.macro_p} unit="g" accent="var(--grn)" />
          <Tile label="Carbs" value={c.macro_c} unit="g" accent="var(--blu)" />
          <Tile label="Fat" value={c.macro_f} unit="g" accent="var(--orn)" />
        </div>
      </Section>
    );
  }

  return (
    <Section title="Macro Targets">
      <form onSubmit={save}>
        <div style={styles.tiles}>
          <MacroInput label="Calories" unit="kcal" accent="var(--yel)" value={draft.tdee_target} onChange={(v) => setField('tdee_target', v)} disabled={saving} />
          <MacroInput label="Protein" unit="g" accent="var(--grn)" value={draft.macro_p} onChange={(v) => setField('macro_p', v)} disabled={saving} />
          <MacroInput label="Carbs" unit="g" accent="var(--blu)" value={draft.macro_c} onChange={(v) => setField('macro_c', v)} disabled={saving} />
          <MacroInput label="Fat" unit="g" accent="var(--orn)" value={draft.macro_f} onChange={(v) => setField('macro_f', v)} disabled={saving} />
        </div>
        <div style={styles.saveRow}>
          <button type="submit" style={{ ...styles.saveBtn, opacity: saving ? 0.6 : 1 }} disabled={saving}>
            {saving ? 'Saving…' : 'Update Macros'}
          </button>
          <button type="button" style={styles.cancelBtn} onClick={cancel} disabled={saving}>Cancel</button>
        </div>
        {saveError ? <div style={styles.saveError} role="alert">{saveError}</div> : null}
      </form>
    </Section>
  );
}

function MacroInput({ label, unit, accent, value, onChange, disabled }) {
  return (
    <label style={{ ...styles.tile, borderTopColor: accent, cursor: 'text' }}>
      <span style={styles.tileLabel}>{label}</span>
      <input
        style={styles.macroInput}
        type="number"
        min="0"
        max={TARGET_MAX}
        step="1"
        inputMode="numeric"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
      <span style={styles.tileUnit}>{unit}</span>
    </label>
  );
}

// ── One workout day from the structured plan. ─────────────────────────────────
function WorkoutDay({ day, index }) {
  const exercises = Array.isArray(day?.exercises) ? day.exercises : [];
  return (
    <div style={styles.workoutDay}>
      <div style={styles.dayHead}>{dayLabel(day, index)}</div>
      {exercises.length ? (
        <ul style={styles.exList}>
          {exercises.map((ex, i) => (
            <li key={i} style={styles.exItem}>
              <span style={styles.exName}>{ex?.name || 'Exercise'}</span>
              {exMeta(ex) ? <span style={styles.exMeta}>{exMeta(ex)}</span> : null}
            </li>
          ))}
        </ul>
      ) : (
        <span style={styles.rowSub}>Rest / no exercises listed.</span>
      )}
    </div>
  );
}

// ── Small presentational pieces ────────────────────────────────────────────────
function Section({ title, meta, action, children }) {
  return (
    <section style={styles.section}>
      <div style={styles.sectionHead}>
        <span style={styles.sectionTitle}>{title}</span>
        {action || (meta ? <span style={styles.sectionMeta}>{meta}</span> : null)}
      </div>
      {children}
    </section>
  );
}
function Tile({ label, value, unit, accent }) {
  const has = value !== null && value !== undefined && value !== '';
  return (
    <div style={{ ...styles.tile, borderTopColor: accent }}>
      <span style={styles.tileLabel}>{label}</span>
      <span style={styles.tileValue}>{has ? Number(value).toLocaleString() : '—'}</span>
      <span style={styles.tileUnit}>{has ? unit : ''}</span>
    </div>
  );
}
function Field({ label, value, color }) {
  return (
    <div style={styles.field}>
      <span style={styles.fieldLabel}>{label}</span>
      <span style={{ ...styles.fieldValue, color: color || 'var(--wht)' }}>{value || '—'}</span>
    </div>
  );
}
function Chips({ label, items, tone }) {
  if (!hasItems(items)) return null;
  return (
    <div style={styles.chipsRow}>
      <span style={styles.fieldLabel}>{label}</span>
      <span style={styles.chips}>
        {items.map((it, i) => (
          <span key={i} style={{ ...styles.chip, borderColor: tone, color: tone }}>{String(it)}</span>
        ))}
      </span>
    </div>
  );
}
function Badge({ label, color }) {
  return <span style={{ ...styles.badge, color, borderColor: color }}>{label}</span>;
}
function Loading({ label }) {
  return (
    <div style={styles.loading} role="status" aria-live="polite">
      <span style={styles.spinnerDot} />
      {label || 'Loading…'}
    </div>
  );
}
function Empty({ children }) {
  return <div style={styles.empty}>{children}</div>;
}

// ── Pure helpers ────────────────────────────────────────────────────────────────
function asArray(v) {
  if (Array.isArray(v)) return v.length ? v : null;
  if (typeof v === 'string' && v.trim()) {
    try { const p = JSON.parse(v); return Array.isArray(p) && p.length ? p : null; } catch { return null; }
  }
  return null;
}
function asMealDays(v) {
  let o = v;
  if (typeof v === 'string' && v.trim()) { try { o = JSON.parse(v); } catch { return null; } }
  if (o && Array.isArray(o.days) && o.days.length) return o.days;
  return null;
}
function hasItems(v) { return Array.isArray(v) && v.length > 0; }
function dayLabel(day, i) {
  return day?.day || day?.title || day?.focus || day?.name || day?.label || `Day ${i + 1}`;
}
function exMeta(ex) {
  const bits = [];
  if (ex?.sets && ex?.reps) bits.push(`${ex.sets}×${ex.reps}`);
  else if (ex?.reps) bits.push(`${ex.reps} reps`);
  if (ex?.rpe) bits.push(`RPE ${ex.rpe}`);
  if (ex?.tempo) bits.push(`tempo ${ex.tempo}`);
  if (ex?.rest) bits.push(`rest ${ex.rest}`);
  return bits.join(' · ');
}
function fmtDate(v) {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
function fmtMetric(v) {
  return v === null || v === undefined || v === '' ? '—' : String(v);
}
// Mirrors the backend's own readiness summary (fetchTelemetry in index.ts) so the
// dossier and the Co-Coach reason on the same numbers and thresholds.
function summarizeReadiness(readiness) {
  const scores = readiness.map((r) => Number(r.score) || 0).filter((n) => n > 0);
  const n = scores.length;
  const avg = n ? Math.round(scores.reduce((a, b) => a + b, 0) / n) : null;
  const last = n ? scores[n - 1] : null;
  const last7 = scores.slice(-7);
  const prev7 = scores.slice(-14, -7);
  const a7 = last7.length ? last7.reduce((a, b) => a + b, 0) / last7.length : null;
  const p7 = prev7.length ? prev7.reduce((a, b) => a + b, 0) / prev7.length : null;
  const trend = (a7 != null && p7 != null)
    ? (a7 > p7 + 1 ? 'improving' : a7 < p7 - 1 ? 'declining' : 'flat')
    : 'insufficient data';
  const latest = readiness.length ? readiness[readiness.length - 1] : null;
  return { n, avg, last, trend, sleep: latest?.sleep_quality, soreness: latest?.soreness_level };
}
function summarizeVolume(volume) {
  const days = volume.length;
  const last = days ? volume[days - 1].volume : null;
  const total = volume.reduce((a, x) => a + (Number(x.volume) || 0), 0);
  const avg = days ? Math.round(total / days) : null;
  return { days, last, avg };
}
function tierColor(tier) {
  const map = { platinum: 'var(--yel)', essentials: 'var(--grn)', sovereign: 'var(--purl)' };
  return map[String(tier || '').toLowerCase()] || 'var(--mut)';
}
function baselineColor(s) {
  const v = String(s || '').toLowerCase();
  if (v === 'valid') return 'var(--grn)';
  if (v === 'building') return 'var(--gold-soft)';
  return 'var(--mut)';
}
function cardiacColor(s) {
  const v = String(s || '').toLowerCase();
  if (v === 'provider_cleared') return 'var(--grn)';
  if (v === 'restricted') return 'var(--orn)';
  if (v === 'contraindicated') return 'var(--red)';
  return 'var(--mut)';
}
function trendColor(t) {
  if (t === 'improving') return 'var(--grn)';
  if (t === 'declining') return 'var(--red)';
  if (t === 'flat') return 'var(--gold-soft)';
  return 'var(--mut)';
}

const styles = {
  back: {
    fontFamily: 'var(--hb)', fontSize: '.78rem', letterSpacing: '2px', textTransform: 'uppercase',
    color: 'var(--gold-soft)', background: 'none', border: '1px solid rgba(245,200,0,.35)',
    borderRadius: 8, padding: '.55rem 1rem', cursor: 'pointer', marginBottom: '1.25rem',
  },
  badgeStrip: { display: 'flex', flexWrap: 'wrap', gap: '.5rem', marginBottom: '.5rem' },
  badge: {
    fontFamily: 'var(--hb)', fontSize: '.68rem', letterSpacing: '1.5px', textTransform: 'uppercase',
    border: '1px solid var(--mut)', borderRadius: 6, padding: '.28rem .6rem', whiteSpace: 'nowrap',
  },

  body: { display: 'flex', flexDirection: 'column', gap: '1.6rem', marginTop: '1.4rem' },
  tabs: {
    display: 'flex', gap: '.3rem', borderBottom: '1px solid var(--line)',
    overflowX: 'auto', flexWrap: 'nowrap', WebkitOverflowScrolling: 'touch',
  },
  tab: {
    flex: '0 0 auto', whiteSpace: 'nowrap', fontFamily: 'var(--hb)', fontSize: '.8rem',
    letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(249,245,255,.55)',
    background: 'none', border: 'none', borderBottom: '3px solid transparent',
    padding: '.6rem .9rem', marginBottom: '-1px', cursor: 'pointer',
  },
  tabActive: { color: 'var(--wht)', borderBottomColor: 'var(--yel)' },
  section: { borderTop: '1px solid var(--line)', paddingTop: '1.1rem' },
  sectionHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '.9rem', gap: '1rem' },
  sectionTitle: { fontFamily: 'var(--hb)', fontSize: '.92rem', letterSpacing: '2.5px', textTransform: 'uppercase', color: 'var(--wht)' },
  sectionMeta: { fontFamily: 'var(--bd)', fontSize: '.78rem', fontWeight: 700, color: 'var(--mut)' },

  tiles: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '.7rem' },
  tile: {
    background: 'var(--gry)', border: '1px solid var(--line)', borderTop: '3px solid var(--mut)',
    borderRadius: 12, padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
  },
  tileLabel: { fontFamily: 'var(--hb)', fontSize: '.66rem', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--mut)' },
  tileValue: { fontFamily: 'var(--display)', fontSize: '2rem', lineHeight: 1.1, color: 'var(--wht)', margin: '.25rem 0 0' },
  tileUnit: { fontFamily: 'var(--bd)', fontSize: '.78rem', fontWeight: 700, color: 'var(--mut)' },
  macroInput: {
    width: '100%', margin: '.2rem 0', padding: '.3rem .1rem', background: 'transparent',
    border: 'none', borderBottom: '2px solid var(--line)', color: 'var(--wht)',
    fontFamily: 'var(--display)', fontSize: '1.8rem', lineHeight: 1.1, outline: 'none',
  },

  editBtn: {
    fontFamily: 'var(--hb)', fontSize: '.7rem', letterSpacing: '2px', textTransform: 'uppercase',
    color: 'var(--gold-soft)', background: 'none', border: '1px solid rgba(245,200,0,.35)',
    borderRadius: 8, padding: '.4rem .8rem', cursor: 'pointer', whiteSpace: 'nowrap',
  },
  saveRow: { display: 'flex', alignItems: 'center', gap: '.7rem', marginTop: '1rem' },
  saveBtn: {
    fontFamily: 'var(--hb)', fontSize: '.82rem', letterSpacing: '2px', textTransform: 'uppercase',
    color: '#090909', background: 'var(--yel)', border: '1px solid var(--yel)', borderRadius: 8,
    padding: '.6rem 1.4rem', cursor: 'pointer',
  },
  cancelBtn: {
    fontFamily: 'var(--hb)', fontSize: '.82rem', letterSpacing: '2px', textTransform: 'uppercase',
    color: 'var(--mut)', background: 'none', border: '1px solid var(--line)', borderRadius: 8,
    padding: '.6rem 1.2rem', cursor: 'pointer',
  },
  saveError: {
    fontFamily: 'var(--bd)', fontSize: '.92rem', fontWeight: 700, color: 'var(--red)',
    marginTop: '.7rem', border: '1px solid var(--red)', borderRadius: 8, padding: '.5rem .75rem',
  },

  // ── Co-Coach console — a distinct, gold-accented agentic panel. ──
  coachPanel: { border: '1px solid rgba(245,200,0,.4)', borderRadius: 14, padding: '1.2rem 1.3rem', background: 'rgba(245,200,0,.04)' },
  coachHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '.8rem' },
  coachKicker: { fontFamily: 'var(--hb)', fontSize: '.82rem', letterSpacing: '2.5px', textTransform: 'uppercase', color: 'var(--gold-soft)' },
  coachOnline: { fontFamily: 'var(--hb)', fontSize: '.64rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--grn)' },
  coachTextarea: {
    width: '100%', boxSizing: 'border-box', resize: 'vertical', minHeight: 64,
    background: '#050505', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--wht)',
    fontFamily: 'var(--bd)', fontSize: '1rem', fontWeight: 600, padding: '.7rem .9rem', outline: 'none',
  },
  coachActions: { display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '.7rem' },
  dispatchBtn: {
    fontFamily: 'var(--hb)', fontSize: '.82rem', letterSpacing: '2px', textTransform: 'uppercase',
    color: '#090909', background: 'var(--yel)', border: '1px solid var(--yel)', borderRadius: 8,
    padding: '.6rem 1.4rem', cursor: 'pointer',
  },
  coachCounter: { fontFamily: 'var(--bd)', fontSize: '.75rem', fontWeight: 700, color: 'var(--mut)' },
  coachLoading: {
    display: 'flex', alignItems: 'center', gap: '.6rem', marginTop: '1rem', padding: '.8rem 1rem',
    border: '1px solid rgba(245,200,0,.3)', borderRadius: 10, color: 'var(--gold-soft)',
    fontFamily: 'var(--hb)', fontSize: '.82rem', letterSpacing: '1.5px', textTransform: 'uppercase',
  },
  coachAnswer: { marginTop: '1rem', borderTop: '1px solid var(--line)', paddingTop: '1rem' },
  coachAnswerText: { fontFamily: 'var(--bd)', fontSize: '1rem', fontWeight: 500, lineHeight: 1.6, color: 'var(--wht)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
  coachFoot: { fontFamily: 'var(--bd)', fontSize: '.76rem', fontWeight: 700, color: 'var(--mut)', marginTop: '.8rem', letterSpacing: '.3px' },

  analytics: { display: 'flex', flexDirection: 'column', gap: '.7rem' },
  inlineError: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', border: '1px solid var(--red)', borderRadius: 10, padding: '.7rem 1rem' },

  kv: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '.7rem' },
  field: { display: 'flex', flexDirection: 'column', gap: '.2rem' },
  fieldLabel: { fontFamily: 'var(--hb)', fontSize: '.64rem', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--mut)' },
  fieldValue: { fontFamily: 'var(--bd)', fontSize: '1rem', fontWeight: 700, color: 'var(--wht)', textTransform: 'capitalize' },

  chipsRow: { display: 'flex', flexDirection: 'column', gap: '.35rem', marginTop: '.7rem' },
  chips: { display: 'flex', flexWrap: 'wrap', gap: '.4rem' },
  chip: {
    fontFamily: 'var(--bd)', fontSize: '.8rem', fontWeight: 700, letterSpacing: '.3px',
    border: '1px solid var(--mut)', borderRadius: 6, padding: '.2rem .5rem',
  },

  guardNote: {
    fontFamily: 'var(--bd)', fontSize: '.85rem', fontWeight: 700, color: 'var(--orn)',
    border: '1px solid var(--orn)', borderRadius: 8, padding: '.5rem .75rem', marginBottom: '.8rem',
  },
  plan: { display: 'flex', flexDirection: 'column', gap: '.7rem' },
  workoutDay: { background: 'var(--gry)', border: '1px solid var(--line)', borderRadius: 12, padding: '.9rem 1.1rem' },
  dayHead: { fontFamily: 'var(--hb)', fontSize: '.82rem', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--gold-soft)', marginBottom: '.6rem' },
  exList: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '.4rem' },
  exItem: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '1rem' },
  exName: { fontFamily: 'var(--bd)', fontSize: '.95rem', fontWeight: 700, color: 'var(--wht)' },
  exMeta: { fontFamily: 'var(--bd)', fontSize: '.82rem', fontWeight: 700, color: 'var(--mut)', whiteSpace: 'nowrap' },

  mealDay: {
    display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '1rem',
    background: 'var(--gry)', border: '1px solid var(--line)', borderRadius: 10, padding: '.6rem .9rem',
  },
  dayLabel: { fontFamily: 'var(--hb)', fontSize: '.8rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--wht)' },

  pre: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '.82rem', lineHeight: 1.5,
    color: 'var(--wht)', background: 'var(--gry)', border: '1px solid var(--line)', borderRadius: 10,
    padding: '.9rem 1.1rem', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
    maxHeight: 320, overflow: 'auto',
  },
  rowSub: { fontFamily: 'var(--bd)', fontSize: '.82rem', fontWeight: 700, color: 'var(--mut)' },
  empty: { fontFamily: 'var(--bd)', fontSize: '.92rem', fontWeight: 600, color: 'var(--mut)', padding: '.4rem 0' },
  footer: { fontFamily: 'var(--bd)', fontSize: '.78rem', fontWeight: 700, color: 'var(--mut)', borderTop: '1px solid var(--line)', paddingTop: '.9rem' },

  loading: { display: 'flex', alignItems: 'center', gap: '.6rem', padding: '1.5rem .2rem', color: 'var(--mut)', fontFamily: 'var(--bd)', letterSpacing: '.5px' },
  spinnerDot: { width: 10, height: 10, borderRadius: '50%', background: 'var(--yel)', boxShadow: '0 0 12px rgba(245,200,0,.6)' },

  errorBox: { border: '1px solid var(--red)', borderRadius: 12, padding: '1rem 1.2rem', background: 'rgba(239,68,68,.06)', marginTop: '1rem' },
  errorTitle: { fontFamily: 'var(--hb)', fontSize: '.8rem', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--red)', marginBottom: '.35rem' },
  errorMsg: { fontFamily: 'var(--bd)', fontSize: '.95rem', color: 'var(--red)', wordBreak: 'break-word' },
  errorActions: { display: 'flex', gap: '.6rem', marginTop: '.8rem' },
  retry: {
    fontFamily: 'var(--hb)', fontSize: '.72rem', letterSpacing: '2px', textTransform: 'uppercase',
    color: 'var(--red)', background: 'none', border: '1px solid var(--red)', borderRadius: 8, padding: '.45rem .9rem', cursor: 'pointer', whiteSpace: 'nowrap',
  },
};
