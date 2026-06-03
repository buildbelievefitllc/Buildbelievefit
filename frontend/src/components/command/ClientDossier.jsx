// src/components/command/ClientDossier.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Client Detail Dossier — the drill-in from the Client Database Hub roster, rebuilt
// to the AI Studio prototype: an athlete card (avatar · name · division · macro
// summary · coach intake log · streak) over a 5-deck nested nav:
//
//   7-Day Nutrition · 7-Day Workouts · 90-Day Analytics · Athlete Feed Chat · Update Target
//
// Data path (all via lib/rosterApi — IDENTICAL gateway + runtime admin token):
//   detail        { action:'detail', id }         → { ok, client:{…full row} }
//   analytics     { action:'analytics', id }       → { ok, readiness:[…], volume:[…] }
//   update_target { action:'update_target', id,… } → { ok, client:{ id, tdee_target,
//                                                       macro_p, macro_c, macro_f } }  ← PARTIAL
//   coach         { action:'coach', id, question } → { ok, answer, telemetry }
//
// ⚠️ All key on the `id` PK, NOT `uid` (the function 400s on missing_id).
// ⚠️ update_target returns ONLY the 5 macro fields — we MERGE them into detail
//    state so name / plans / etc. survive, and the card updates without a refetch.
//
// DATA HONESTY: the prototype's body-composition tiles (skeletal muscle, squat max,
// bodyweight series) are mock data — the roster `analytics` action returns training
// VOLUME + READINESS, so the 90-Day Analytics deck plots those (real) under the
// prototype's layout. True bodyweight/body-fat series lives behind the PIN-gated
// coach-analytics RPCs surfaced on the dedicated Analytics tab.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { rosterCall, fetchAnalytics, updateTargets, askCoCoach, toErrorMessage, TARGET_MAX, COACH_MAX } from '../../lib/rosterApi.js';
import { BarChart, LineChart } from './charts.jsx';
import { numOrNull, GOLD, GRN, PURL, GOLD_SOFT } from './chartUtils.js';
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
  // initial setState lands outside the synchronous effect body; cancel-guarded.
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

  // Fall back to the roster row while detail is in flight, so the card has context
  // immediately instead of a contextless spinner.
  const c = data ?? client;

  return (
    <div>
      <button type="button" style={styles.back} onClick={onBack}>← Back to Roster</button>

      {/* ── Athlete card — avatar · name · division · macro summary · intake log ── */}
      <AthleteCard c={c} />

      {isLoading && !data ? <Loading label="Loading dossier…" /> : null}

      {error ? (
        <div style={styles.errorBox} role="alert">
          <div style={styles.errorTitle}>Dossier fetch failed</div>
          <div style={styles.errorMsg}>{error}</div>
          <div style={styles.errorActions}>
            <button type="button" style={styles.retry} onClick={fetchDetail}>Retry</button>
            <button type="button" style={styles.retry} onClick={onBack}>Back to Roster</button>
          </div>
        </div>
      ) : null}

      {data ? (
        <DossierBody
          c={data}
          clientId={client.id}
          onPatched={applyTargetPatch}
          analytics={{ data: analytics, loading: anLoading, error: anError, onRetry: fetchAnalyticsData }}
        />
      ) : null}
    </div>
  );
}

// ── Athlete card header — the prototype's identity strip + inline macro tiles. ──
function AthleteCard({ c }) {
  const name = c.name || c.uid || 'Unnamed';
  const div = c.metabolic_tier || c.subscription_tier || c.role || 'Sovereign Client';
  const focusBits = [
    c.age ? `Age ${c.age}` : null,
    c.block_priority || c.baseline_status || 'Sovereign Protocol',
  ].filter(Boolean);
  const intake = c.coach_note || c.health_notes || c.notes || 'No coach intake notes on file yet — log directives from the Athlete Feed Chat.';
  const streak = Number(c.current_streak) || 0;

  return (
    <div style={styles.card}>
      <div style={styles.cardTop}>
        <span style={styles.cardAvatar}>{initials(name)}</span>
        <div style={styles.cardId}>
          <div style={styles.cardName}>{name}</div>
          <span style={styles.cardDiv}>{div}</span>
          <div style={styles.cardFocus}>{focusBits.join(' · ')}</div>
        </div>
        <div style={styles.cardMacros}>
          <MacroPill label="Calories" value={c.tdee_target} unit="kcal" accent="var(--gold-soft)" valueColor="var(--wht)" />
          <MacroPill label="Protein" value={c.macro_p} unit="g" accent="var(--yel)" valueColor="var(--yel)" />
          <MacroPill label="Carbs" value={c.macro_c} unit="g" accent="var(--purl)" valueColor="var(--purl)" />
          <MacroPill label="Fats" value={c.macro_f} unit="g" accent="var(--mut)" valueColor="var(--wht)" />
        </div>
      </div>
      <div style={styles.intakeRow}>
        <div style={styles.intakeBox}>
          <span style={styles.intakeKicker}>Coach Intake Log Checklist</span>
          <span style={styles.intakeText}>{intake}</span>
        </div>
        <span style={styles.streak}>⚡ {streak} Day{streak === 1 ? '' : 's'}</span>
      </div>
    </div>
  );
}

function MacroPill({ label, value, unit, accent, valueColor }) {
  const has = value !== null && value !== undefined && value !== '';
  return (
    <div style={{ ...styles.macroPill, borderTopColor: accent }}>
      <span style={styles.macroPillLabel}>{label}</span>
      <span style={{ ...styles.macroPillVal, color: valueColor || 'var(--wht)' }}>{has ? Number(value).toLocaleString() : '—'}</span>
      <span style={styles.macroPillUnit}>{has ? unit : ''}</span>
    </div>
  );
}

// ── The 5-deck nested nav (the prototype's right-panel navigation row). ─────────
const DECKS = [
  { id: 'nutrition', label: '7-Day Nutrition', icon: '🍽' },
  { id: 'workouts', label: '7-Day Workouts', icon: '🏋' },
  { id: 'analytics', label: '90-Day Analytics', icon: '📊' },
  { id: 'feed', label: 'Athlete Feed Chat', icon: '💬' },
  { id: 'target', label: 'Update Target', icon: '⬆' },
];

function DossierBody({ c, clientId, onPatched, analytics }) {
  const [deck, setDeck] = useState('nutrition');

  return (
    <div style={styles.body}>
      <nav style={styles.tabs} role="tablist" aria-label="Athlete dossier decks">
        {DECKS.map((d) => {
          const active = d.id === deck;
          return (
            <button
              key={d.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setDeck(d.id)}
              style={{ ...styles.tab, ...(active ? styles.tabActive : null) }}
            >
              <span aria-hidden="true" style={styles.tabIcon}>{d.icon}</span>{d.label}
            </button>
          );
        })}
      </nav>

      <div key={deck}>
        {deck === 'nutrition' && <NutritionTab c={c} />}
        {deck === 'workouts' && <ProgramTab c={c} />}
        {deck === 'analytics' && <AnalyticsDeck {...analytics} />}
        {deck === 'feed' && <FeedChat clientId={clientId} clientName={c.name || c.uid || 'this athlete'} />}
        {deck === 'target' && <ReconfiguratorDeck c={c} clientId={clientId} onPatched={onPatched} />}
      </div>

      <div style={styles.footer}>Last updated {fmtDate(c.updated_at) || '—'}</div>
    </div>
  );
}

// ── 7-Day Workouts — active training plan + training/medical profile. ──────────
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
            {workoutDays.map((day, i) => <WorkoutDay key={i} day={day} index={i} />)}
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

// ── 7-Day Nutrition — meal plan + dietary profile (macros live in Update Target). ─
function NutritionTab({ c }) {
  const mealDays = asMealDays(c.meal_plan);
  const mealText = !mealDays && typeof c.meal_plan === 'string' ? c.meal_plan.trim() : '';
  const nutritionText = typeof c.nutrition_plan === 'string' ? c.nutrition_plan.trim() : '';

  return (
    <>
      <Section title="7-Day Meal Plan" meta={fmtDate(c.nutrition_plan_updated_at)}>
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

// ── 90-Day Analytics — Historical Analytics Interval + metric tiles + trend. ────
const WINDOWS = [30, 60, 90];

function AnalyticsDeck({ data, loading, error, onRetry }) {
  const [windowDays, setWindowDays] = useState(90);

  const view = useMemo(() => {
    if (!data) return null;
    const vol = sliceByWindow(data.volume, 'date', windowDays);
    const rdy = sliceByWindow(data.readiness, 't', windowDays);
    const output = vol.reduce((a, x) => a + (Number(x.volume) || 0), 0);
    const sessions = vol.filter((x) => (Number(x.volume) || 0) > 0).length;
    const peak = vol.reduce((m, x) => Math.max(m, Number(x.volume) || 0), 0);
    const scores = rdy.map((r) => Number(r.score) || 0).filter((n) => n > 0);
    const avgReadiness = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    return { vol, rdy, output, sessions, peak, avgReadiness };
  }, [data, windowDays]);

  if (loading) return <Loading label="Loading analytics…" />;
  if (error) {
    return (
      <div style={styles.inlineError} role="alert">
        <span style={styles.errorMsg}>{error}</span>
        <button type="button" style={styles.retry} onClick={onRetry}>Retry</button>
      </div>
    );
  }
  if (!view) return <Empty>No analytics available.</Empty>;

  const empty = !view.vol.length && !view.rdy.length;
  const trendSeries = [{
    key: 'output', label: 'Training Output', color: GOLD,
    points: view.vol.map((d) => ({ date: d.date, value: Number(d.volume) || 0 })),
  }];
  const readinessSeries = [
    { key: 'score', label: 'Readiness', color: GRN, points: view.rdy.map((d) => ({ date: d.t, value: numOrNull(d.score) })) },
    { key: 'sleep', label: 'Sleep', color: PURL, points: view.rdy.map((d) => ({ date: d.t, value: numOrNull(d.sleep_quality) })) },
    { key: 'soreness', label: 'Soreness', color: GOLD_SOFT, points: view.rdy.map((d) => ({ date: d.t, value: numOrNull(d.soreness_level) })) },
  ];

  return (
    <div style={styles.analytics}>
      {/* Interval selector */}
      <div style={styles.intervalHead}>
        <div>
          <div style={styles.intervalKicker}>📡 Telemetric Data Tracker</div>
          <div style={styles.intervalTitle}>Historical Analytics Interval</div>
          <div style={styles.intervalSub}>Select an active timeline to adjust the charts to 30, 60, or 90 days.</div>
        </div>
        <div style={styles.windows} role="group" aria-label="Analytics window">
          {WINDOWS.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWindowDays(w)}
              style={{ ...styles.win, ...(w === windowDays ? styles.winActive : null) }}
            >
              {w} Days
            </button>
          ))}
        </div>
      </div>

      {empty ? (
        <Empty>No training or readiness data in the last {windowDays} days.</Empty>
      ) : (
        <>
          {/* Metric tiles (real roster analytics) */}
          <div style={styles.metricRow}>
            <Metric label="Total Output" value={view.output} sub={`${windowDays}-day volume`} accent="var(--yel)" />
            <Metric label="Sessions Logged" value={view.sessions} sub="days trained" accent="var(--grn)" />
            <Metric label="Peak Output" value={view.peak} sub="best single day" accent="var(--purl)" />
            <Metric label="Avg Readiness" value={view.avgReadiness} sub="score / day" accent="var(--blu)" />
          </div>

          {/* Progression trend (real training output over the window) */}
          <div className="bbf-an__chart">
            <div className="bbf-an__chart-h">
              <span className="bbf-an__chart-title">Progression Trend</span>
              <span className="bbf-an__chart-meta">training output · selected timeline</span>
            </div>
            <LineChart series={trendSeries} />
          </div>

          <div className="bbf-an__chart">
            <div className="bbf-an__chart-h">
              <span className="bbf-an__chart-title">Training Volume</span>
              <span className="bbf-an__chart-meta">{windowDays}-day volume</span>
            </div>
            <BarChart points={view.vol.map((d) => ({ date: d.date, value: Number(d.volume) || 0 }))} unit="vol" />
          </div>

          <div className="bbf-an__chart">
            <div className="bbf-an__chart-h">
              <span className="bbf-an__chart-title">Readiness Trend</span>
              <span className="bbf-an__chart-meta">skips no-reading days</span>
            </div>
            <LineChart series={readinessSeries} />
          </div>

          <div style={styles.analyticsNote}>
            Body-composition metrics (bodyweight, body-fat %) are available on the dedicated
            Analytics tab (PIN-gated).
          </div>
        </>
      )}
    </div>
  );
}

// ── Athlete Feed Chat — Co-Coach intelligence + broadcast action cues. ─────────
// Powered by the real Gemini Co-Coach (action: coach). The cues pre-load engineered
// directives into the composer; Dispatch sends them. AI text renders as plain
// pre-wrapped text (no markdown lib / innerHTML) so there is no XSS surface.
const BROADCAST_CUES = [
  { label: 'Refeed Carbs', text: 'Broadcast a refeed-carbs directive: stage a structured carbohydrate refeed for the next 24h and explain the rationale relative to current training phase.' },
  { label: 'Spine Decompression', text: 'Broadcast a spine-decompression protocol for tonight (recovery focus) and flag any load adjustments for tomorrow.' },
  { label: 'Hydration Boost', text: 'Broadcast a hydration-boost directive with electrolyte targets tuned to recent sweat/output load.' },
  { label: 'Sleep / CNS Reset', text: 'Broadcast a sleep / CNS-reset protocol to protect recovery before the next high-velocity session.' },
];

function FeedChat({ clientId, clientName }) {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState(null);
  const [telemetry, setTelemetry] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  async function dispatch(e) {
    e.preventDefault();
    if (isLoading) return; // hard guard against double-dispatch
    if (!query.trim()) { setError('Compose or pick a directive to broadcast.'); return; }
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
        <span style={styles.coachKicker}>Athlete Feed Chat · Co-Coach</span>
        <span style={styles.coachOnline}>● Online</span>
      </div>

      {/* Fast broadcast action cues — pre-load engineered directives. */}
      <div style={styles.cueRow}>
        {BROADCAST_CUES.map((cue) => (
          <button
            key={cue.label}
            type="button"
            style={styles.cue}
            disabled={isLoading}
            onClick={() => { setQuery(cue.text); setError(null); }}
          >
            ⚡ {cue.label}
          </button>
        ))}
      </div>

      <form onSubmit={dispatch}>
        <textarea
          style={styles.coachTextarea}
          rows={3}
          maxLength={COACH_MAX}
          placeholder={`Message ${clientName} or broadcast a performance directive…`}
          value={query}
          disabled={isLoading}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div style={styles.coachActions}>
          <button type="submit" style={{ ...styles.dispatchBtn, opacity: blocked ? 0.55 : 1 }} disabled={blocked}>
            {isLoading ? 'Transmitting…' : 'Direct Send'}
          </button>
          <span style={styles.coachCounter}>{query.length}/{COACH_MAX}</span>
        </div>
      </form>

      {isLoading ? (
        <div style={styles.coachLoading} role="status" aria-live="polite">
          <span style={styles.spinnerDot} />
          {`Drafting a context-aware response from ${clientName}'s telemetry…`}
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

// ── Update Target — the Coach Reconfigurator Deck (writes via update_target). ──
function ReconfiguratorDeck({ c, clientId, onPatched }) {
  const [draft, setDraft] = useState({
    tdee_target: c.tdee_target ?? '',
    macro_p: c.macro_p ?? '',
    macro_c: c.macro_c ?? '',
    macro_f: c.macro_f ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saved, setSaved] = useState(false);

  const setField = (k, v) => { setDraft((d) => ({ ...d, [k]: v })); setSaved(false); };

  // Live macro distribution from the draft (real math: kcal from 4/4/9).
  const dist = useMemo(() => {
    const kcal = Number(draft.tdee_target) || 0;
    const p = Number(draft.macro_p) || 0;
    const cc = Number(draft.macro_c) || 0;
    const f = Number(draft.macro_f) || 0;
    if (!kcal) return null;
    return {
      p: Math.round((p * 4) / kcal * 100),
      c: Math.round((cc * 4) / kcal * 100),
      f: Math.round((f * 9) / kcal * 100),
    };
  }, [draft]);

  const category = c.metabolic_tier || c.subscription_tier || 'Sovereign';

  async function save(e) {
    e.preventDefault();
    if (saving) return; // hard guard against double-submit
    setSaving(true);
    setSaveError(null);
    try {
      const body = await updateTargets(clientId, draft);
      onPatched(body.client ?? {}); // merge PARTIAL row into detail state → instant card
      setSaved(true);
    } catch (err) {
      setSaveError(toErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section title="⚙ Coach Reconfigurator Deck">
      <div style={styles.reconfig}>
        <form style={styles.reconfigForm} onSubmit={save}>
          <label style={styles.reconfigLabel} htmlFor="rc-kcal">Adjust Caloric Goal Intake (kcal)</label>
          <input
            id="rc-kcal"
            style={styles.reconfigInput}
            type="number" min="0" max={TARGET_MAX} step="1" inputMode="numeric"
            value={draft.tdee_target}
            disabled={saving}
            onChange={(e) => setField('tdee_target', e.target.value)}
          />
          <div style={styles.reconfigNote}>
            Protein, carbs, and fats adapt to match performance. Current split:&nbsp;
            {dist ? `Protein ${dist.p}% · Carbs ${dist.c}% · Fats ${dist.f}%` : 'set a calorie target to compute the split'}.
          </div>

          <div style={styles.macroGrid}>
            <MacroInput label="Protein" unit="g" accent="var(--yel)" value={draft.macro_p} onChange={(v) => setField('macro_p', v)} disabled={saving} />
            <MacroInput label="Carbs" unit="g" accent="var(--purl)" value={draft.macro_c} onChange={(v) => setField('macro_c', v)} disabled={saving} />
            <MacroInput label="Fats" unit="g" accent="var(--mut)" value={draft.macro_f} onChange={(v) => setField('macro_f', v)} disabled={saving} />
          </div>

          <div style={styles.saveRow}>
            <button type="submit" style={{ ...styles.saveBtn, opacity: saving ? 0.6 : 1 }} disabled={saving}>
              {saving ? 'Pushing to Profile…' : 'Push Target to Athlete'}
            </button>
            {saved ? <span style={styles.savedFlag}>✓ Pushed to profile</span> : null}
          </div>
          {saveError ? <div style={styles.saveError} role="alert">{saveError}</div> : null}
        </form>

        <aside style={styles.reconfigAside}>
          <span style={styles.asideBadge}>Automatic Coefficient Rule</span>
          <div style={styles.asideTitle}>Balanced Athletic Distribution</div>
          <p style={styles.asideText}>
            This client is categorized as <strong style={{ color: 'var(--gold-soft)' }}>{category}</strong>.
            Adjusting these parameters recalibrates all 7-day nutrition plans to stay within
            strict compliance thresholds.
          </p>
          <div style={styles.asideShield}>🛡 Basal metabolic compliance held to gold-level peer standard.</div>
        </aside>
      </div>
    </Section>
  );
}

function MacroInput({ label, unit, accent, value, onChange, disabled }) {
  return (
    <label style={{ ...styles.tile, borderTopColor: accent, cursor: 'text' }}>
      <span style={styles.tileLabel}>{label}</span>
      <input
        style={styles.macroInput}
        type="number" min="0" max={TARGET_MAX} step="1" inputMode="numeric"
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
function Metric({ label, value, sub, accent }) {
  const has = value !== null && value !== undefined && value !== '';
  return (
    <div style={{ ...styles.metric, borderTopColor: accent }}>
      <span style={styles.metricLabel}>{label}</span>
      <span style={styles.metricVal}>{has ? Number(value).toLocaleString() : '—'}</span>
      <span style={styles.metricSub}>{sub}</span>
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
function initials(name) {
  const p = String(name || '').trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '—';
}
// Slice a dated series to the last `windowDays`. Date-based when timestamps parse;
// falls back to a last-N slice (assumes ~1 row/day) so a window always narrows.
function sliceByWindow(rows, dateKey, windowDays) {
  if (!Array.isArray(rows) || !rows.length) return [];
  const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
  const allDated = rows.every((r) => !Number.isNaN(Date.parse(r?.[dateKey])));
  if (allDated) return rows.filter((r) => Date.parse(r[dateKey]) >= cutoff);
  return rows.slice(-windowDays);
}
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

const styles = {
  back: {
    fontFamily: 'var(--hb)', fontSize: '.78rem', letterSpacing: '2px', textTransform: 'uppercase',
    color: 'var(--gold-soft)', background: 'none', border: '1px solid rgba(245,200,0,.35)',
    borderRadius: 8, padding: '.55rem 1rem', cursor: 'pointer', marginBottom: '1.25rem',
  },

  // ── Athlete card ──
  card: {
    background: 'rgba(106,13,173,.10)', border: '1px solid rgba(245,200,0,.22)',
    borderRadius: 16, padding: '1.2rem 1.3rem', marginBottom: '1.4rem',
  },
  cardTop: { display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' },
  cardAvatar: {
    width: 56, height: 56, flexShrink: 0, borderRadius: 12, border: '2px solid var(--gold-soft)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050505',
    fontFamily: 'var(--hb)', fontSize: '1.1rem', letterSpacing: '1px', color: 'var(--wht)',
  },
  cardId: { display: 'flex', flexDirection: 'column', gap: '.2rem', minWidth: 0, flex: 1 },
  cardName: { fontFamily: 'var(--display)', fontSize: '1.7rem', letterSpacing: '1px', color: 'var(--wht)', lineHeight: 1.05 },
  cardDiv: {
    alignSelf: 'flex-start', fontFamily: 'var(--hb)', fontSize: '.62rem', letterSpacing: '1.5px',
    textTransform: 'uppercase', color: 'var(--gold-soft)', border: '1px solid rgba(245,200,0,.4)',
    borderRadius: 6, padding: '.18rem .5rem',
  },
  cardFocus: { fontFamily: 'var(--bd)', fontSize: '.82rem', fontWeight: 700, color: 'var(--mut)', textTransform: 'uppercase', letterSpacing: '.5px' },
  cardMacros: { display: 'flex', gap: '.5rem', flexWrap: 'wrap' },
  macroPill: {
    background: 'var(--gry)', border: '1px solid var(--line)', borderTop: '3px solid var(--mut)',
    borderRadius: 10, padding: '.5rem .7rem', minWidth: 66, display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
  },
  macroPillLabel: { fontFamily: 'var(--hb)', fontSize: '.56rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--mut)' },
  macroPillVal: { fontFamily: 'var(--display)', fontSize: '1.25rem', lineHeight: 1.1, color: 'var(--wht)' },
  macroPillUnit: { fontFamily: 'var(--bd)', fontSize: '.68rem', fontWeight: 700, color: 'var(--mut)' },

  intakeRow: { display: 'flex', alignItems: 'stretch', gap: '.8rem', marginTop: '1rem' },
  intakeBox: { flex: 1, minWidth: 0, border: '1px solid var(--line)', borderRadius: 10, padding: '.7rem .9rem', background: 'rgba(0,0,0,.25)' },
  intakeKicker: { display: 'block', fontFamily: 'var(--hb)', fontSize: '.6rem', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--gold-deep)', marginBottom: '.3rem' },
  intakeText: { fontFamily: 'var(--bd)', fontSize: '.88rem', fontWeight: 600, fontStyle: 'italic', color: 'var(--wht)', lineHeight: 1.45 },
  streak: {
    flexShrink: 0, alignSelf: 'center', fontFamily: 'var(--hb)', fontSize: '.82rem', letterSpacing: '1px',
    color: '#090909', background: 'var(--yel)', borderRadius: 8, padding: '.5rem .8rem', whiteSpace: 'nowrap',
  },

  body: { display: 'flex', flexDirection: 'column', gap: '1.6rem' },
  tabs: {
    display: 'flex', gap: '.3rem', borderBottom: '1px solid var(--line)',
    overflowX: 'auto', flexWrap: 'nowrap', WebkitOverflowScrolling: 'touch',
  },
  tab: {
    flex: '0 0 auto', whiteSpace: 'nowrap', fontFamily: 'var(--hb)', fontSize: '.78rem',
    letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(249,245,255,.55)',
    background: 'none', border: 'none', borderBottom: '3px solid transparent',
    padding: '.6rem .85rem', marginBottom: '-1px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '.4rem',
  },
  tabActive: { color: 'var(--wht)', borderBottomColor: 'var(--yel)' },
  tabIcon: { fontSize: '.9rem' },

  section: { borderTop: '1px solid var(--line)', paddingTop: '1.1rem' },
  sectionHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '.9rem', gap: '1rem' },
  sectionTitle: { fontFamily: 'var(--hb)', fontSize: '.92rem', letterSpacing: '2.5px', textTransform: 'uppercase', color: 'var(--wht)' },
  sectionMeta: { fontFamily: 'var(--bd)', fontSize: '.78rem', fontWeight: 700, color: 'var(--mut)' },

  // ── Analytics deck ──
  analytics: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  intervalHead: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' },
  intervalKicker: { fontFamily: 'var(--hb)', fontSize: '.6rem', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--gold-deep)' },
  intervalTitle: { fontFamily: 'var(--display)', fontSize: '1.3rem', letterSpacing: '.5px', color: 'var(--wht)', margin: '.2rem 0' },
  intervalSub: { fontFamily: 'var(--bd)', fontSize: '.82rem', fontWeight: 600, color: 'var(--mut)', maxWidth: '46ch' },
  windows: { display: 'flex', gap: '.3rem', flexShrink: 0 },
  win: {
    fontFamily: 'var(--hb)', fontSize: '.72rem', letterSpacing: '1.5px', textTransform: 'uppercase',
    color: 'var(--mut)', background: 'var(--gry)', border: '1px solid var(--line)', borderRadius: 8,
    padding: '.45rem .7rem', cursor: 'pointer', whiteSpace: 'nowrap',
  },
  winActive: { color: '#090909', background: 'var(--yel)', borderColor: 'var(--yel)' },

  metricRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '.7rem' },
  metric: {
    background: 'var(--gry)', border: '1px solid var(--line)', borderTop: '3px solid var(--mut)',
    borderRadius: 12, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '.1rem',
  },
  metricLabel: { fontFamily: 'var(--hb)', fontSize: '.62rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--mut)' },
  metricVal: { fontFamily: 'var(--display)', fontSize: '1.9rem', lineHeight: 1.1, color: 'var(--wht)' },
  metricSub: { fontFamily: 'var(--bd)', fontSize: '.72rem', fontWeight: 700, color: 'var(--mut)' },
  analyticsNote: { fontFamily: 'var(--bd)', fontSize: '.78rem', fontWeight: 600, color: 'var(--mut)', fontStyle: 'italic' },

  // ── Reconfigurator deck ──
  reconfig: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.2rem', alignItems: 'start' },
  reconfigForm: { display: 'flex', flexDirection: 'column' },
  reconfigLabel: { fontFamily: 'var(--hb)', fontSize: '.66rem', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--mut)', marginBottom: '.4rem' },
  reconfigInput: {
    width: '100%', boxSizing: 'border-box', background: '#050505', border: '1px solid var(--line)',
    borderRadius: 10, color: 'var(--wht)', fontFamily: 'var(--display)', fontSize: '1.8rem',
    padding: '.5rem .8rem', outline: 'none',
  },
  reconfigNote: { fontFamily: 'var(--bd)', fontSize: '.8rem', fontWeight: 600, color: 'var(--mut)', margin: '.6rem 0 1rem', lineHeight: 1.4 },
  macroGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '.6rem' },
  reconfigAside: { background: 'rgba(106,13,173,.12)', border: '1px solid var(--line)', borderRadius: 12, padding: '1rem 1.1rem', alignSelf: 'start' },
  asideBadge: { display: 'inline-block', fontFamily: 'var(--hb)', fontSize: '.58rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--gold-soft)', border: '1px solid rgba(245,200,0,.35)', borderRadius: 6, padding: '.2rem .5rem', marginBottom: '.6rem' },
  asideTitle: { fontFamily: 'var(--hb)', fontSize: '.95rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--wht)', marginBottom: '.5rem' },
  asideText: { fontFamily: 'var(--bd)', fontSize: '.86rem', fontWeight: 600, lineHeight: 1.5, color: 'var(--mut)', margin: 0 },
  asideShield: { fontFamily: 'var(--bd)', fontSize: '.76rem', fontWeight: 700, color: 'var(--grn)', marginTop: '.8rem' },

  tile: {
    background: 'var(--gry)', border: '1px solid var(--line)', borderTop: '3px solid var(--mut)',
    borderRadius: 12, padding: '.8rem', display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
  },
  tileLabel: { fontFamily: 'var(--hb)', fontSize: '.62rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--mut)' },
  tileUnit: { fontFamily: 'var(--bd)', fontSize: '.72rem', fontWeight: 700, color: 'var(--mut)' },
  macroInput: {
    width: '100%', margin: '.15rem 0', padding: '.2rem .1rem', background: 'transparent',
    border: 'none', borderBottom: '2px solid var(--line)', color: 'var(--wht)',
    fontFamily: 'var(--display)', fontSize: '1.5rem', lineHeight: 1.1, outline: 'none',
  },

  saveRow: { display: 'flex', alignItems: 'center', gap: '.8rem', marginTop: '1.1rem' },
  saveBtn: {
    fontFamily: 'var(--hb)', fontSize: '.82rem', letterSpacing: '2px', textTransform: 'uppercase',
    color: '#090909', background: 'var(--yel)', border: '1px solid var(--yel)', borderRadius: 8,
    padding: '.65rem 1.4rem', cursor: 'pointer',
  },
  savedFlag: { fontFamily: 'var(--hb)', fontSize: '.72rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--grn)' },
  saveError: {
    fontFamily: 'var(--bd)', fontSize: '.92rem', fontWeight: 700, color: 'var(--red)',
    marginTop: '.7rem', border: '1px solid var(--red)', borderRadius: 8, padding: '.5rem .75rem',
  },

  // ── Feed chat (Co-Coach) ──
  coachPanel: { border: '1px solid rgba(245,200,0,.4)', borderRadius: 14, padding: '1.2rem 1.3rem', background: 'rgba(245,200,0,.04)' },
  coachHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '.8rem' },
  coachKicker: { fontFamily: 'var(--hb)', fontSize: '.82rem', letterSpacing: '2.5px', textTransform: 'uppercase', color: 'var(--gold-soft)' },
  coachOnline: { fontFamily: 'var(--hb)', fontSize: '.64rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--grn)' },
  cueRow: { display: 'flex', flexWrap: 'wrap', gap: '.45rem', marginBottom: '.8rem' },
  cue: {
    fontFamily: 'var(--hb)', fontSize: '.66rem', letterSpacing: '1px', textTransform: 'uppercase',
    color: 'var(--gold-soft)', background: 'rgba(106,13,173,.2)', border: '1px solid rgba(245,200,0,.3)',
    borderRadius: 999, padding: '.4rem .8rem', cursor: 'pointer',
  },
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
