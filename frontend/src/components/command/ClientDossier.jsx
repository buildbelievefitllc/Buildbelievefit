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
// DATA HONESTY: the roster `analytics` action returns training VOLUME + READINESS
// (admin-token, frictionless), so the Analytics deck plots those (real) keyed on the
// selected athlete's id. True bodyweight/body-fat series lives behind the PIN-gated
// coach-analytics RPCs (keyed on uid) — now folded directly into this deck's Body
// Composition card (admin-PIN secured), so all of an athlete's analytics live here,
// in the Client Database Hub, instead of on a separate top-level surface.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { rosterCall, fetchAnalytics, updateTargets, askCoCoach, toErrorMessage, fetchTiers, reassignTier, setAccessStatus, TARGET_MAX, COACH_MAX } from '../../lib/rosterApi.js';
import { coachThread, coachSendMessage, adminNutritionHistory, commsErrorMessage } from '../../lib/coachMessagesApi.js';
import { hasAdminPin, setAdminPin, fetchBodyComposition } from '../../lib/coachAnalyticsApi.js';
import { BarChart, LineChart, BodyComp } from './charts.jsx';
import { numOrNull, GOLD, GRN, PURL, GOLD_SOFT } from './chartUtils.js';
import { buildSportsProtocol, normalizeSportKey } from '../../lib/sportsEngine.js';
import { buildMealPlan } from '../../lib/nutritionEngine.js';
import { getSportsProtocol, setSportsProtocol, setMealPlan } from '../../lib/protocolOverrideApi.js';
import SovereignAthlete from './SovereignAthlete.jsx';
import { useAthleteWearable } from '../../lib/wearableApi.js';
import './analytics.css';

export default function ClientDossier({ client, onBack, onRosterRefresh }) {
  // Detail (full client row).
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Analytics (90-day readiness + training volume) — its own state machine so a
  // slow/failed analytics pull never blocks the dossier body.
  const [analytics, setAnalytics] = useState(null);
  const [anLoading, setAnLoading] = useState(false);
  const [anError, setAnError] = useState(null);

  // Staged Native Sports Engine protocol — lifted to the top level so BOTH the Athlete
  // Profile header and the Manual Override deck read ONE source (no double-fetch), and a
  // phase override refreshes the header in lockstep. A populated protocol ⇒ this client is
  // an athlete and the dossier renders the Athlete Profile variant. Its own state machine:
  // a slow/failed protocol read just falls back to the standard (general-fitness) layout.
  const [proto, setProto] = useState(null);
  const [protoLoading, setProtoLoading] = useState(false);
  const [protoError, setProtoError] = useState(null);
  const [protoKey, setProtoKey] = useState(0);
  const reloadProto = useCallback(() => setProtoKey((k) => k + 1), []);

  // Active operational deck — LIFTED out of DossierBody so the Sovereign header's
  // quick-action menu can flip straight to a deck (e.g. Manual Override) from above.
  // null = layout default (Override for athletes, Nutrition otherwise).
  const [pickedDeck, setPickedDeck] = useState(null);
  const opsRef = useRef(null);
  const quickAction = useCallback((deckId) => {
    setPickedDeck(deckId);
    // Scroll after the deck switch paints so the target rect is final.
    requestAnimationFrame(() => opsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, []);

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

  // Read the staged sports_protocol (admin-gated RPC). Non-fatal: a read failure (or no
  // admin session) just leaves proto null → the dossier renders the standard layout.
  const fetchProto = useCallback(async () => {
    setProtoLoading(true);
    setProtoError(null);
    try {
      const d = await getSportsProtocol(client.id);
      setProto(d || null);
    } catch (e) {
      setProtoError(toErrorMessage(e));
      setProto(null);
    } finally {
      setProtoLoading(false);
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

  // Protocol read on its own effect so reloadProto() (after a phase override) refetches it
  // WITHOUT re-pulling detail/analytics. protoKey is the reload trigger (mirrors the
  // reloadKey pattern in BodyCompositionCard / the former OverrideDeck fetch).
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) fetchProto(); });
    return () => { cancelled = true; };
  }, [fetchProto, protoKey]);

  // Merge a partial update_target row into detail state — instant UI, no refetch.
  const applyTargetPatch = useCallback((patch) => {
    setData((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  // Fall back to the roster row while detail is in flight, so the card has context
  // immediately instead of a contextless spinner.
  const c = data ?? client;

  // A populated sports_protocol ⇒ youth/athlete client → render the Athlete Profile variant.
  const isAthlete = !!proto;

  // Live wearable readiness for the athlete dossier — refetches on the
  // bbf:wearable-updated event the Dev Tools "Simulate CNS Breach" dispatches.
  const wearable = useAthleteWearable(isAthlete ? (data?.uid || client.uid) : '');

  return (
    <div>
      <button type="button" style={styles.back} onClick={onBack}>← Back to Roster</button>

      {/* Athlete → Sovereign Tier dossier (prototype layout); else the standard identity card. */}
      {isAthlete ? <SovereignAthlete c={c} proto={proto} onQuickAction={quickAction} wearable={wearable.data} /> : <AthleteCard c={c} proto={proto} />}

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
        <div ref={opsRef}>
          {isAthlete ? (
            <div style={styles.opsDivider}>
              <span style={styles.opsKicker}>Operational Decks · Live Controls</span>
              <span style={styles.opsHint}>Manual Override (Referee) · plans · analytics · feed</span>
            </div>
          ) : null}
          <DossierBody
            c={data}
            clientId={client.id}
            clientUid={data.uid || client.uid}
            accountStatus={client.account_status}
            onRosterRefresh={onRosterRefresh}
            onPatched={applyTargetPatch}
            analytics={{ data: analytics, loading: anLoading, error: anError, onRetry: fetchAnalyticsData }}
            isAthlete={isAthlete}
            proto={proto}
            protoLoading={protoLoading}
            protoError={protoError}
            onProtoReload={reloadProto}
            picked={pickedDeck}
            onPick={setPickedDeck}
          />
        </div>
      ) : null}
    </div>
  );
}

// ── Athlete card header — identity strip + inline macro tiles. For an athlete (a staged
//    sports_protocol) it shifts to the Athlete Profile variant: a gold "Athlete Portal"
//    division badge, the sport on the focus line, and a prominent Sport/Phase deck. ──────
function AthleteCard({ c, proto }) {
  const isAthlete = !!proto;
  const name = c.name || c.uid || 'Unnamed';
  const div = isAthlete
    ? 'Athlete Portal'
    : (c.metabolic_tier || c.subscription_tier || c.role || 'Sovereign Client');
  const focusBits = [
    c.age ? `Age ${c.age}` : null,
    isAthlete
      ? (proto.sport || 'Native Sports Engine')
      : (c.block_priority || c.baseline_status || 'Sovereign Protocol'),
  ].filter(Boolean);
  const intake = c.coach_note || c.health_notes || c.notes || 'No coach intake notes on file yet — log directives from the Athlete Feed Chat.';
  const streak = Number(c.current_streak) || 0;

  return (
    <div style={{ ...styles.card, ...(isAthlete ? styles.cardAthlete : null) }}>
      <div style={styles.cardTop}>
        <span style={styles.cardAvatar}>{initials(name)}</span>
        <div style={styles.cardId}>
          <div style={styles.cardName}>{name}</div>
          <span style={{ ...styles.cardDiv, ...(isAthlete ? styles.cardDivAthlete : null) }}>{div}</span>
          <div style={styles.cardFocus}>{focusBits.join(' · ')}</div>
        </div>
        <div style={styles.cardMacros}>
          <MacroPill label="Calories" value={c.tdee_target} unit="kcal" accent="var(--gold-soft)" valueColor="var(--wht)" />
          <MacroPill label="Protein" value={c.macro_p} unit="g" accent="var(--yel)" valueColor="var(--yel)" />
          <MacroPill label="Carbs" value={c.macro_c} unit="g" accent="var(--purl)" valueColor="var(--purl)" />
          <MacroPill label="Fats" value={c.macro_f} unit="g" accent="var(--mut)" valueColor="var(--wht)" />
        </div>
      </div>

      {isAthlete ? <AthleteProtocolStrip proto={proto} /> : null}

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

// ── Athlete Profile deck — surfaces the staged sport + current phase up front, the
//    headline distinction from a standard general-fitness dossier. ────────────────────
function AthleteProtocolStrip({ proto }) {
  const phaseNum = parseInt(proto.phase_number, 10);
  const hasPhase = phaseNum >= 1 && phaseNum <= 3;
  return (
    <div style={styles.athleteStrip}>
      <span style={styles.athleteKicker}>⚡ Native Sports Engine · Athlete Profile</span>
      <div style={styles.athleteTiles}>
        <div style={styles.athleteTile}>
          <span style={styles.athleteTileLabel}>Sport</span>
          <span style={styles.athleteTileVal}>{proto.sport || '—'}</span>
        </div>
        <div style={styles.athleteTile}>
          <span style={styles.athleteTileLabel}>Current Phase</span>
          <span style={styles.athleteTileVal}>{proto.current_phase || (hasPhase ? `Phase ${phaseNum}` : '—')}</span>
          {hasPhase ? <span style={styles.athleteTileMeta}>Phase {phaseNum} of 3 · adjust in Manual Override</span> : null}
        </div>
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

// ── The 6-deck nested nav (the prototype's right-panel navigation row). ─────────
const DECKS = [
  { id: 'nutrition', label: '7-Day Nutrition', icon: '🍽' },
  { id: 'workouts', label: '7-Day Workouts', icon: '🏋' },
  { id: 'analytics', label: '30/60/90 Analytics', icon: '📊' },
  { id: 'feed', label: 'Athlete Feed Chat', icon: '💬' },
  { id: 'target', label: 'Update Target', icon: '⬆' },
  { id: 'override', label: 'Manual Override', icon: '⚡' },
  { id: 'access', label: 'Account Access', icon: '🔐' },
];
// Athlete Profile: same six decks, but Manual Override (the Sport/Phase control) leads and
// is the default — the headline surface for an athlete instead of the standard nutrition view.
const ATHLETE_DECK_ORDER = ['override', 'workouts', 'nutrition', 'analytics', 'feed', 'target', 'access'];
const ATHLETE_DECKS = ATHLETE_DECK_ORDER.map((id) => DECKS.find((d) => d.id === id));

function DossierBody({ c, clientId, clientUid, accountStatus, onRosterRefresh, onPatched, analytics, isAthlete, proto, protoLoading, protoError, onProtoReload, picked, onPick }) {
  // `picked` (lifted to ClientDossier — the Sovereign header's quick-action menu writes
  // it too) = the explicit choice; until one is made, the active deck tracks the layout
  // default (Override for athletes, Nutrition otherwise) so resolving athlete-ness after
  // mount upgrades the default without yanking a tab out from under the user.
  const decks = isAthlete ? ATHLETE_DECKS : DECKS;
  const deck = picked ?? (isAthlete ? 'override' : 'nutrition');

  return (
    <div style={styles.body}>
      <nav style={styles.tabs} role="tablist" aria-label="Athlete dossier decks">
        {decks.map((d) => {
          const active = d.id === deck;
          const flagged = isAthlete && d.id === 'override'; // highlight the headline athlete deck
          return (
            <button
              key={d.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onPick(d.id)}
              style={{ ...styles.tab, ...(flagged ? styles.tabAthlete : null), ...(active ? styles.tabActive : null) }}
            >
              <span aria-hidden="true" style={styles.tabIcon}>{d.icon}</span>{d.label}
            </button>
          );
        })}
      </nav>

      <div key={deck}>
        {deck === 'nutrition' && <NutritionTab c={c} clientId={clientId} />}
        {deck === 'workouts' && <ProgramTab c={c} />}
        {deck === 'analytics' && <AnalyticsDeck {...analytics} uid={clientUid} />}
        {deck === 'feed' && <FeedChat clientId={clientId} clientName={c.name || c.uid || 'this athlete'} />}
        {deck === 'target' && <ReconfiguratorDeck c={c} clientId={clientId} onPatched={onPatched} />}
        {deck === 'override' && (
          <OverrideDeck c={c} clientId={clientId} proto={proto} protoLoading={protoLoading} protoError={protoError} onReload={onProtoReload} />
        )}
        {deck === 'access' && (
          <AccountAccessDeck c={c} clientUid={clientUid} accountStatus={accountStatus} onChanged={onRosterRefresh} />
        )}
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

// ── 7-Day Committed Fueling History — REAL logged adherence rows from
//    nutrition_daily_sync (the athlete's "Complete & Sync Protocol" ritual),
//    read via the admin-gated bbf_admin_nutrition_history RPC. Not the plan —
//    what was actually logged. ─────────────────────────────────────────────────
const FH_ROW = { display: 'grid', gridTemplateColumns: '86px 1fr auto auto', alignItems: 'center', gap: '.7rem', padding: '.45rem .6rem', border: '1px solid var(--line)', borderRadius: 10, background: 'rgba(5,5,5,.45)' };
const FH_DAY = { fontFamily: 'var(--hb)', fontSize: '.7rem', letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--gold-soft)' };
const FH_BAR_TRACK = { position: 'relative', height: 8, borderRadius: 999, background: 'rgba(249,245,255,.08)', overflow: 'hidden' };
const FH_META = { fontFamily: 'var(--bd)', fontSize: '.8rem', fontWeight: 700, color: 'var(--wht)', whiteSpace: 'nowrap' };
const FH_SUB = { fontFamily: 'var(--hb)', fontSize: '.58rem', letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--mut)', whiteSpace: 'nowrap' };

function FuelHistoryStrip({ clientId }) {
  const [rows, setRows] = useState(null);
  const [state, setState] = useState({ loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(async () => {
      if (cancelled) return;
      try {
        const days = await adminNutritionHistory(clientId, 7);
        if (!cancelled) { setRows(days); setState({ loading: false, error: null }); }
      } catch (e) {
        if (!cancelled) setState({ loading: false, error: commsErrorMessage(e) });
      }
    });
    return () => { cancelled = true; };
  }, [clientId]);

  return (
    <Section title="7-Day Committed Fueling History" meta="logged adherence · not the plan">
      {state.loading ? <Loading label="Reading fueling ledger…" /> : state.error ? (
        <div style={styles.inlineError} role="alert"><span style={styles.errorMsg}>{state.error}</span></div>
      ) : !rows?.length ? (
        <Empty>No committed fueling syncs in the last 7 days — the athlete hasn’t run “Complete &amp; Sync Protocol” yet.</Empty>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.45rem' }} data-testid="fuel-history">
          {rows.map((r) => {
            const pct = Math.max(0, Math.min(140, Number(r.kcal_pct) || 0));
            const onTarget = pct >= 85 && pct <= 110;
            const barColor = onTarget ? 'var(--grn)' : pct > 110 ? 'var(--red)' : 'var(--yel)';
            const dayLbl = (() => { try { return new Date(`${r.day}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); } catch { return r.day; } })();
            return (
              <div key={r.day} style={FH_ROW}>
                <span style={FH_DAY}>{dayLbl}</span>
                <span style={FH_BAR_TRACK} aria-hidden="true">
                  <span style={{ position: 'absolute', inset: 0, width: `${Math.min(100, (pct / 140) * 100)}%`, background: barColor, borderRadius: 999 }} />
                </span>
                <span style={FH_META}>{(Number(r.consumed_kcal) || 0).toLocaleString()} / {r.target_kcal ? Number(r.target_kcal).toLocaleString() : '—'} kcal · {pct}%</span>
                <span style={FH_SUB}>{r.consumed_protein_g || 0}g P · {r.meals_logged || 0} meal{(r.meals_logged || 0) === 1 ? '' : 's'}</span>
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}

// ── 7-Day Nutrition — meal plan + dietary profile (macros live in Update Target). ─
function NutritionTab({ c, clientId }) {
  const mealDays = asMealDays(c.meal_plan);
  const mealText = !mealDays && typeof c.meal_plan === 'string' ? c.meal_plan.trim() : '';
  const nutritionText = typeof c.nutrition_plan === 'string' ? c.nutrition_plan.trim() : '';
  const fastingWindow = mealPlanFastingWindow(c.meal_plan);

  return (
    <>
      <Section title="7-Day Meal Plan" meta={fmtDate(c.nutrition_plan_updated_at)}>
        {fastingWindow ? (
          <div style={styles.kv}>
            <Field label="Fasting Window" value={fastingWindow === 'none' ? 'None (continuous feeding)' : fastingWindow} color="var(--gold-soft)" />
          </div>
        ) : null}
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

      {/* Real logged 7-day adherence (mandate: history, not placeholders). */}
      <FuelHistoryStrip clientId={clientId} />

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

function AnalyticsDeck({ data, loading, error, onRetry, uid }) {
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

        </>
      )}

      {/* Body composition — the one analytics surface the backend gates behind the
          coach Admin PIN (sensitive health data). Folded in here so removing the
          standalone Analytics tab loses nothing; keyed on the selected athlete's uid
          and rendered independently of the volume/readiness window above. */}
      <BodyCompositionCard uid={uid} />
    </div>
  );
}

// ── Body Composition (folded in from the former standalone Analytics tab) ───────
// The bbf_coach_body_composition RPC is PIN-gated server-side, so this is the one
// dossier surface that may prompt for the coach Admin PIN. The PIN is held in module
// memory for the session (coachAnalyticsApi), so it's typed at most once. The main
// volume/readiness analytics above need no PIN — only this sensitive series does.
function BodyCompositionCard({ uid }) {
  const [authed, setAuthed] = useState(hasAdminPin());
  const [pinInput, setPinInput] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Fetch when authed + uid (and on retry/unlock). setState only fires in the
  // promise callbacks / a microtask — never synchronously in the effect body
  // (mirrors the set-state-in-effect-clean pattern used across this codebase).
  useEffect(() => {
    if (!authed || !uid) return undefined;
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) setLoading(true); });
    fetchBodyComposition(uid)
      .then((d) => { if (!cancelled) { setData(d); setError(null); } })
      .catch((e) => {
        if (cancelled) return;
        if (e.code === 'unauthorized') {
          setAuthed(false);
          setError('Admin PIN rejected — re-enter to view body composition.');
        } else if (e.code === 'no_pin') {
          setAuthed(false);
        } else {
          setError(e.message || 'Body composition unavailable.');
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [authed, uid, reloadKey]);

  function unlock(e) {
    e.preventDefault();
    const pin = pinInput.trim();
    if (!pin) return;
    setAdminPin(pin);
    setPinInput('');
    setError(null);
    setAuthed(true);
    setReloadKey((k) => k + 1);
  }

  return (
    <div className="bbf-an__chart">
      <div className="bbf-an__chart-h">
        <span className="bbf-an__chart-title">Body Composition</span>
        <span className="bbf-an__chart-meta">body-fat % · admin-PIN secured</span>
      </div>
      {!uid ? (
        <div className="bbf-an__empty">No synced athlete uid for body-composition lookup.</div>
      ) : !authed ? (
        <>
          <form className="bbf-an__gate-row" onSubmit={unlock}>
            <input
              className="bbf-input" type="password" inputMode="numeric" autoComplete="off"
              spellCheck={false} placeholder="Admin PIN to unlock body composition"
              value={pinInput} onChange={(ev) => setPinInput(ev.target.value.replace(/\D/g, ''))}
            />
            <button className="bbf-btn" type="submit" style={{ width: 'auto', whiteSpace: 'nowrap', padding: '0 1.1rem' }}>Unlock</button>
          </form>
          {error ? <div style={{ ...styles.errorMsg, marginTop: '.5rem' }}>{error}</div> : null}
          <div className="bbf-an__gate-note">
            Body composition is sensitive health data — secured behind the coach Admin PIN. Entered once, held for this session only.
          </div>
        </>
      ) : loading ? (
        <Loading label="Loading body composition…" />
      ) : error ? (
        <div style={styles.inlineError} role="alert">
          <span style={styles.errorMsg}>{error}</span>
          <button type="button" style={styles.retry} onClick={() => setReloadKey((k) => k + 1)}>Retry</button>
        </div>
      ) : (
        <BodyComp data={data} />
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

// Thread bubble chrome — coach = gold-keyed right, athlete = purple-keyed left.
const MSG_WRAP = { display: 'flex', flexDirection: 'column', gap: '.5rem', maxHeight: 340, overflowY: 'auto', padding: '.75rem', border: '1px solid var(--line)', borderRadius: 12, background: 'rgba(5,5,5,.5)', marginBottom: '.8rem' };
const MSG_ROW = { display: 'flex', flexDirection: 'column', maxWidth: '78%' };
const MSG_BUBBLE = { fontFamily: 'var(--bd)', fontSize: '.92rem', fontWeight: 600, lineHeight: 1.45, whiteSpace: 'pre-wrap', borderRadius: 12, padding: '.55rem .8rem' };
const MSG_COACH = { alignSelf: 'flex-end', alignItems: 'flex-end' };
const MSG_COACH_BUBBLE = { color: '#0e0a16', background: 'linear-gradient(90deg, var(--yel), #ffd83a)', borderBottomRightRadius: 4 };
const MSG_ATHLETE_BUBBLE = { color: 'var(--wht)', background: 'rgba(106,13,173,.3)', border: '1px solid rgba(139,26,191,.5)', borderBottomLeftRadius: 4 };
const MSG_META = { fontFamily: 'var(--hb)', fontSize: '.56rem', letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--mut)', marginTop: '.2rem' };
const MSG_PENDING = { opacity: .65 };

function fmtMsgTime(iso) {
  try { return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch { return ''; }
}

// Athlete Feed Chat — the LIVE messaging bridge (bbf_coach_messages) + the
// Gemini Co-Coach intelligence console. "Send to Athlete" persists a real row
// (optimistic bubble; the athlete's app raises an unread flag on next pull);
// "Co-Coach Intel" keeps the original AI dispatch, cues and telemetry intact.
function FeedChat({ clientId, clientName }) {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState(null);
  const [telemetry, setTelemetry] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Live thread state (real comms table).
  const [thread, setThread] = useState([]);
  const [threadState, setThreadState] = useState({ loading: true, error: null });
  const [sending, setSending] = useState(false);
  const threadEndRef = useRef(null);

  const loadThread = useCallback(async () => {
    setThreadState((s) => ({ ...s, loading: true }));
    try {
      const messages = await coachThread(clientId);
      setThread(messages);
      setThreadState({ loading: false, error: null });
    } catch (e) {
      setThreadState({ loading: false, error: commsErrorMessage(e) });
    }
  }, [clientId]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) loadThread(); });
    return () => { cancelled = true; };
  }, [loadThread]);

  // Keep the newest message in view as the thread grows.
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ block: 'end' });
  }, [thread.length]);

  // DIRECT SEND — persist to the athlete's inbox (optimistic bubble, server confirm).
  async function sendToAthlete() {
    const body = query.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    const tempId = `tmp-${Date.now()}`;
    const optimistic = { id: tempId, sender: 'coach', body, created_at: new Date().toISOString(), pending: true };
    setThread((t) => [...t, optimistic]);
    setQuery('');
    try {
      const saved = await coachSendMessage(clientId, body);
      setThread((t) => t.map((m) => (m.id === tempId ? saved : m)));
    } catch (e) {
      setThread((t) => t.filter((m) => m.id !== tempId)); // roll back the optimistic bubble
      setQuery(body);                                     // restore the draft — nothing lost
      setError(commsErrorMessage(e));
    } finally {
      setSending(false);
    }
  }

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

  const busy = isLoading || sending;
  const blocked = busy || !query.trim();

  return (
    <div style={styles.coachPanel}>
      <div style={styles.coachHead}>
        <span style={styles.coachKicker}>Athlete Feed Chat · Live Bridge + Co-Coach</span>
        <span style={styles.coachOnline}>● Online</span>
      </div>

      {/* ── Live thread (real bbf_coach_messages rows) ── */}
      {threadState.loading && !thread.length ? (
        <Loading label="Loading the feed…" />
      ) : threadState.error ? (
        <div style={styles.inlineError} role="alert">
          <span style={styles.errorMsg}>{threadState.error}</span>
          <button type="button" style={styles.retry} onClick={loadThread}>Retry</button>
        </div>
      ) : (
        <div style={MSG_WRAP} data-testid="feed-thread" aria-label={`Message thread with ${clientName}`}>
          {thread.length === 0 ? (
            <span style={{ ...MSG_META, alignSelf: 'center', padding: '.6rem 0' }}>
              No messages yet — open the channel with a directive below.
            </span>
          ) : thread.map((m) => {
            const coach = m.sender === 'coach';
            return (
              <div key={m.id} style={{ ...MSG_ROW, ...(coach ? MSG_COACH : null), ...(m.pending ? MSG_PENDING : null) }}>
                <span style={{ ...MSG_BUBBLE, ...(coach ? MSG_COACH_BUBBLE : MSG_ATHLETE_BUBBLE) }}>{m.body}</span>
                <span style={MSG_META}>
                  {coach ? 'Coach' : clientName} · {m.pending ? 'sending…' : fmtMsgTime(m.created_at)}
                  {coach && !m.pending ? (m.read_by_athlete_at ? ' · ✓ read' : ' · ● delivered') : ''}
                </span>
              </div>
            );
          })}
          <span ref={threadEndRef} />
        </div>
      )}

      {/* Fast broadcast action cues — pre-load engineered directives. */}
      <div style={styles.cueRow}>
        {BROADCAST_CUES.map((cue) => (
          <button
            key={cue.label}
            type="button"
            style={styles.cue}
            disabled={busy}
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
          disabled={busy}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div style={styles.coachActions}>
          {/* THE LIVE SEND — persists to the athlete's inbox + raises their unread flag. */}
          <button
            type="button"
            style={{ ...styles.dispatchBtn, opacity: blocked ? 0.55 : 1 }}
            disabled={blocked}
            onClick={sendToAthlete}
            data-testid="feed-send-athlete"
          >
            {sending ? 'Transmitting…' : '📤 Send to Athlete'}
          </button>
          {/* The original AI console — unchanged wiring (askCoCoach). */}
          <button
            type="submit"
            style={{ ...styles.dispatchBtn, background: 'rgba(106,13,173,.3)', color: 'var(--wht)', border: '1px solid rgba(139,26,191,.6)', opacity: blocked ? 0.55 : 1 }}
            disabled={blocked}
            data-testid="feed-cocoach"
          >
            {isLoading ? 'Reasoning…' : '✨ Co-Coach Intel'}
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

      {!busy && error ? <div style={styles.saveError} role="alert">{error}</div> : null}

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

// ── Manual Override — the Commander's hand on the Autonomous Referee. Reads the
//    staged sports_protocol and force-writes a new phase (buildSportsProtocol) or a
//    recalculated diet (buildMealPlan) — the SAME deterministic engines the frontend
//    + the Referee run — via the admin-gated override RPCs. ────────────────────────
const OVR_SPORTS = [['general', 'General'], ['basketball', 'Basketball'], ['football', 'Football'], ['soccer', 'Soccer'], ['track', 'Track & Field'], ['baseball', 'Baseball / Softball']];
const OVR_PHASES = [[1, 'Phase 1 — Foundation'], [2, 'Phase 2 — Development'], [3, 'Phase 3 — Peak']];
const OVR_DIETS = [['Omnivore', 'Omnivore'], ['Vegetarian', 'Vegetarian'], ['Vegan', 'Vegan']];
const OVR_FASTS = [['none', 'None'], ['12/12', '12 / 12'], ['14/10', '14 / 10'], ['16/8', '16 / 8']];
const OVR_SELECT = { width: '100%', boxSizing: 'border-box', background: '#050505', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--wht)', fontFamily: 'var(--bd)', fontSize: '.95rem', fontWeight: 700, padding: '.5rem .7rem', outline: 'none', marginTop: '.25rem' };

function OverrideDeck({ c, clientId, proto, protoLoading, protoError, onReload }) {
  const [sport, setSport] = useState('general');
  const [phase, setPhase] = useState(2);
  const [phaseState, setPhaseState] = useState({ busy: false, ok: null, err: null });

  const [tdee, setTdee] = useState(c.tdee_target ?? '');
  const [diet, setDiet] = useState(c.dietary_profile || 'Omnivore');
  const [fasting, setFasting] = useState('none');
  const [nutState, setNutState] = useState({ busy: false, ok: null, err: null });

  // Seed the dropdowns from the staged protocol (lifted into ClientDossier; shared with the
  // Athlete Profile header) — default the phase selector to the NEXT phase. setState is
  // deferred to a microtask (never synchronous in the effect body), mirroring this file.
  useEffect(() => {
    if (!proto) return undefined;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      if (proto.sport) setSport(normalizeSportKey(proto.sport));
      const n = parseInt(proto.phase_number, 10);
      if (n >= 1 && n <= 3) setPhase(Math.min(n + 1, 3));
    });
    return () => { cancelled = true; };
  }, [proto]);

  async function applyPhase() {
    setPhaseState({ busy: true, ok: null, err: null });
    try {
      const age = Number(proto?.source_age ?? c.age) || undefined;
      const experience = proto?.experience || 'intermediate';
      const protocol = buildSportsProtocol({ sport, age, experience, targetPhase: phase });
      await setSportsProtocol(clientId, protocol);
      setPhaseState({ busy: false, ok: `Forced ${protocol.current_phase}.`, err: null });
      onReload?.(); // refetch the lifted protocol → header + this deck update in lockstep
    } catch (e) { setPhaseState({ busy: false, ok: null, err: e.message }); }
  }

  async function recalcDiet() {
    setNutState({ busy: true, ok: null, err: null });
    try {
      const t = Number(tdee) || 0;
      if (t <= 0 || t > TARGET_MAX) { setNutState({ busy: false, ok: null, err: `Enter a TDEE between 1 and ${TARGET_MAX.toLocaleString()}.` }); return; }
      const plan = buildMealPlan({ tdee: t, dietary_profile: diet, fasting_window: fasting });
      if (!plan) { setNutState({ busy: false, ok: null, err: 'No plan could be built (meal database empty?).' }); return; }
      await setMealPlan(clientId, plan);
      setNutState({ busy: false, ok: `Recalculated — ${diet}${fasting !== 'none' ? ` · ${fasting}` : ''} @ ${t.toLocaleString()} kcal pushed.`, err: null });
    } catch (e) { setNutState({ busy: false, ok: null, err: e.message }); }
  }

  return (
    <>
      <Section title="⚡ Autonomous Referee — Current Protocol" meta={proto ? `Phase ${proto.phase_number || '—'} / 3` : null}>
        {protoLoading ? <Loading label="Reading staged protocol…" /> : protoError ? (
          <div style={styles.inlineError} role="alert">
            <span style={styles.errorMsg}>{protoError}</span>
            <button type="button" style={styles.retry} onClick={() => onReload?.()}>Retry</button>
          </div>
        ) : proto ? (
          <div style={styles.kv}>
            <Field label="Sport" value={proto.sport} />
            <Field label="Current Phase" value={proto.current_phase} color="var(--gold-soft)" />
            <Field label="Progression Criteria" value={proto.progression_criteria} />
          </div>
        ) : <Empty>No sports protocol staged for this athlete yet — set one below.</Empty>}
      </Section>

      <Section title="Phase Override">
        <div style={styles.macroGrid}>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Sport</span>
            <select style={OVR_SELECT} value={sport} disabled={phaseState.busy} onChange={(e) => setSport(e.target.value)}>
              {OVR_SPORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Target Phase</span>
            <select style={OVR_SELECT} value={phase} disabled={phaseState.busy} onChange={(e) => setPhase(Number(e.target.value))}>
              {OVR_PHASES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        </div>
        <div style={styles.saveRow}>
          <button type="button" style={{ ...styles.saveBtn, opacity: phaseState.busy ? 0.6 : 1 }} disabled={phaseState.busy} onClick={applyPhase}>
            {phaseState.busy ? 'Forcing Phase…' : 'Force Phase'}
          </button>
          {phaseState.ok ? <span style={styles.savedFlag}>✓ {phaseState.ok}</span> : null}
        </div>
        {phaseState.err ? <div style={styles.saveError} role="alert">{phaseState.err}</div> : null}
      </Section>

      <Section title="Nutrition Override">
        <div style={styles.macroGrid}>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>TDEE (kcal)</span>
            <input style={OVR_SELECT} type="number" min="0" max={TARGET_MAX} step="1" inputMode="numeric"
              value={tdee} disabled={nutState.busy} onChange={(e) => setTdee(e.target.value)} />
          </label>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Dietary Profile</span>
            <select style={OVR_SELECT} value={diet} disabled={nutState.busy} onChange={(e) => setDiet(e.target.value)}>
              {OVR_DIETS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Fasting Window</span>
            <select style={OVR_SELECT} value={fasting} disabled={nutState.busy} onChange={(e) => setFasting(e.target.value)}>
              {OVR_FASTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        </div>
        <div style={styles.saveRow}>
          <button type="button" style={{ ...styles.saveBtn, opacity: nutState.busy ? 0.6 : 1 }} disabled={nutState.busy} onClick={recalcDiet}>
            {nutState.busy ? 'Recalculating…' : 'Recalculate Diet'}
          </button>
          {nutState.ok ? <span style={styles.savedFlag}>✓ {nutState.ok}</span> : null}
        </div>
        {nutState.err ? <div style={styles.saveError} role="alert">{nutState.err}</div> : null}
      </Section>
    </>
  );
}

// ── Account Access — the relocated God-Mode controls (tier override + the account
//    kill switch), moved out of the now-hidden Access Control panel into the per-athlete
//    dossier. SAME wiring (bbf-admin-roster set_tier / set_status via rosterApi), self-
//    contained state, and a master-roster refresh on change so the row badge stays live. ──
const AA_CATEGORY_LABEL = {
  fitness: 'Fitness', nutrition: 'Fuel · Nutrition', youth: 'Youth Athlete',
  hybrid_6wk: 'Hybrid · 6-Week', hybrid_8wk: 'Hybrid · 8-Week', hybrid_12wk: 'Hybrid · 12-Week',
};
function aaFormatPrice(t) {
  const dollars = (Number(t?.price_cents) || 0) / 100;
  const amount = `$${dollars.toFixed(dollars % 1 === 0 ? 0 : 2)}`;
  return t?.billing_type === 'recurring' ? `${amount}/mo` : amount;
}
const AA_NOTE = { fontFamily: 'var(--bd)', fontSize: '.9rem', color: 'var(--mut)', lineHeight: 1.5, margin: '0 0 .8rem' };

function AccountAccessDeck({ c, clientUid, accountStatus, onChanged }) {
  const uid = String(clientUid || '').toLowerCase();
  const isAkeem = uid === 'akeem';

  const [tiers, setTiers] = useState([]);
  const [tier, setTier] = useState(c.subscription_tier || '');
  const [tierBusy, setTierBusy] = useState(false);
  const [tierMsg, setTierMsg] = useState(null); // { kind:'ok'|'err', text }

  const [status, setStatus] = useState(accountStatus || 'active');
  const [confirm, setConfirm] = useState('');
  const [lockBusy, setLockBusy] = useState(false);
  const [lockMsg, setLockMsg] = useState(null); // { kind:'lock'|'ok'|'err', text }

  // Tier matrix for the dropdown — non-fatal; deferred out of the sync effect body
  // (mirrors this file's set-state-in-effect-clean pattern).
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      fetchTiers()
        .then((body) => { if (!cancelled) setTiers(Array.isArray(body.tiers) ? body.tiers : []); })
        .catch(() => { /* dropdown degrades to the current tier only */ });
    });
    return () => { cancelled = true; };
  }, []);

  const grouped = useMemo(() => {
    const g = {};
    for (const t of tiers) { (g[t.category] = g[t.category] || []).push(t); }
    return g;
  }, [tiers]);
  const tierLabel = useMemo(() => {
    const m = new Map(tiers.map((t) => [t.slug, t.display_name]));
    return (slug) => m.get(slug) || (slug ? String(slug).replace(/_/g, ' ').toUpperCase() : '—');
  }, [tiers]);
  const currentKnown = tiers.some((t) => t.slug === c.subscription_tier);
  const tierUnchanged = tier === (c.subscription_tier || '');
  const isLocked = status === 'locked';
  const confirmMatches = confirm.trim().toLowerCase() === uid;
  const canLock = !isAkeem && !lockBusy && (isLocked || confirmMatches);

  async function onReassign() {
    if (tierBusy || isAkeem || tierUnchanged) return;
    setTierBusy(true); setTierMsg(null);
    try {
      await reassignTier(uid, tier);
      setTierMsg({ kind: 'ok', text: `Tier set to ${tierLabel(tier)}.` });
      onChanged?.();
    } catch (e) {
      setTierMsg({ kind: 'err', text: toErrorMessage(e) });
    } finally { setTierBusy(false); }
  }

  async function onToggleLock() {
    if (!canLock) return;
    const next = isLocked ? 'unlocked' : 'locked';
    setLockBusy(true); setLockMsg(null);
    try {
      const res = await setAccessStatus(uid, next);
      setStatus(next === 'locked' ? 'locked' : 'active');
      setConfirm('');
      setLockMsg(next === 'locked'
        ? { kind: 'lock', text: `Account LOCKED. ${res.sessions_revoked || 0} live session(s) revoked — the athlete is ejected to the login screen.` }
        : { kind: 'ok', text: 'Account unlocked. The athlete can sign in again.' });
      onChanged?.();
    } catch (e) {
      setLockMsg({ kind: 'err', text: toErrorMessage(e) });
    } finally { setLockBusy(false); }
  }

  return (
    <>
      <Section title="◆ Tier Override" meta={isAkeem ? 'Founder · locked to Sovereign' : null}>
        <p style={AA_NOTE}>Manual comp, upgrade, or downgrade — applied directly, bypassing Stripe.</p>
        <div style={styles.macroGrid}>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Subscription Tier</span>
            <select style={OVR_SELECT} value={tier} disabled={isAkeem || tierBusy} onChange={(e) => setTier(e.target.value)}>
              {!currentKnown && c.subscription_tier ? <option value={c.subscription_tier}>{tierLabel(c.subscription_tier)} (current)</option> : null}
              {!c.subscription_tier ? <option value="">— unassigned —</option> : null}
              {Object.keys(grouped).map((cat) => (
                <optgroup key={cat} label={AA_CATEGORY_LABEL[cat] || cat}>
                  {grouped[cat].map((t) => <option key={t.slug} value={t.slug}>{t.display_name} — {aaFormatPrice(t)}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
        </div>
        <div style={styles.saveRow}>
          <button type="button" style={{ ...styles.saveBtn, opacity: (isAkeem || tierBusy || tierUnchanged) ? 0.55 : 1 }} disabled={isAkeem || tierBusy || tierUnchanged} onClick={onReassign}>
            {tierBusy ? 'Saving…' : 'Reassign Tier'}
          </button>
          {tierMsg?.kind === 'ok' ? <span style={styles.savedFlag}>✓ {tierMsg.text}</span> : null}
        </div>
        {tierMsg?.kind === 'err' ? <div style={styles.saveError} role="alert">{tierMsg.text}</div> : null}
      </Section>

      <Section title="⚠ Account Kill Switch">
        {isAkeem ? (
          <p style={AA_NOTE}>The founder account cannot be locked — the kill switch is disabled for this user.</p>
        ) : isLocked ? (
          <>
            <p style={AA_NOTE}>This account is <strong style={{ color: 'var(--red)' }}>LOCKED</strong>. The athlete cannot sign in or reach the Vault. Unlocking restores access immediately.</p>
            <div style={styles.saveRow}>
              <button type="button" style={{ ...styles.saveBtn, background: 'var(--grn)', color: '#06140b', opacity: lockBusy ? 0.6 : 1 }} disabled={lockBusy} onClick={onToggleLock}>
                {lockBusy ? 'Unlocking…' : '⊞ Unlock Account'}
              </button>
            </div>
          </>
        ) : (
          <>
            <p style={AA_NOTE}>
              Locking <strong>instantly revokes this athlete’s live session</strong>, throws them to the public login, and blocks re-entry until you unlock. To arm, type their handle{' '}
              <code style={{ color: 'var(--yel)', fontWeight: 700 }}>@{uid}</code>.
            </p>
            <div style={styles.macroGrid}>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Confirm handle to arm</span>
                <input style={OVR_SELECT} type="text" autoCapitalize="none" spellCheck={false} placeholder={`type @${uid}`} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </label>
            </div>
            <div style={styles.saveRow}>
              <button type="button" style={{ ...styles.saveBtn, background: 'var(--red)', color: '#fff', opacity: canLock ? 1 : 0.5 }} disabled={!canLock} onClick={onToggleLock}>
                {lockBusy ? 'Locking…' : '⛔ Lock Account'}
              </button>
            </div>
          </>
        )}
        {lockMsg ? (
          <div role="alert" style={{ marginTop: '.6rem', fontFamily: 'var(--bd)', fontWeight: 700, fontSize: '.9rem', color: lockMsg.kind === 'ok' ? 'var(--grn)' : 'var(--red)' }}>
            {lockMsg.text}
          </div>
        ) : null}
      </Section>
    </>
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
// Pull the fasting_window from a meal_plan payload (the native nutritionEngine stamps it).
function mealPlanFastingWindow(v) {
  let o = v;
  if (typeof v === 'string' && v.trim()) { try { o = JSON.parse(v); } catch { return null; } }
  return (o && typeof o === 'object' && o.fasting_window) ? String(o.fasting_window) : null;
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

  // ── Athlete Profile variant ──
  cardAthlete: { background: 'rgba(106,13,173,.16)', borderColor: 'rgba(245,200,0,.4)' },
  cardDivAthlete: { color: '#090909', background: 'var(--yel)', borderColor: 'var(--yel)' },
  athleteStrip: {
    marginTop: '1rem', border: '1px solid rgba(245,200,0,.3)', borderRadius: 12,
    padding: '.8rem .9rem', background: 'rgba(106,13,173,.22)',
  },
  athleteKicker: {
    display: 'block', fontFamily: 'var(--hb)', fontSize: '.6rem', letterSpacing: '2px',
    textTransform: 'uppercase', color: 'var(--gold-soft)', marginBottom: '.6rem',
  },
  athleteTiles: { display: 'flex', flexWrap: 'wrap', gap: '.6rem' },
  athleteTile: {
    flex: '1 1 150px', minWidth: 0, background: 'rgba(0,0,0,.28)', border: '1px solid var(--line)',
    borderRadius: 10, padding: '.6rem .8rem', display: 'flex', flexDirection: 'column', gap: '.15rem',
  },
  athleteTileLabel: { fontFamily: 'var(--hb)', fontSize: '.58rem', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--gold-deep)' },
  athleteTileVal: { fontFamily: 'var(--display)', fontSize: '1.45rem', letterSpacing: '.5px', lineHeight: 1.1, color: 'var(--wht)', textTransform: 'capitalize' },
  athleteTileMeta: { fontFamily: 'var(--bd)', fontSize: '.72rem', fontWeight: 700, color: 'var(--mut)' },

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
  tabAthlete: { color: 'var(--gold-soft)' }, // leads the athlete deck — gold even when inactive
  tabIcon: { fontSize: '.9rem' },

  // Divider before the operational decks on the Sovereign athlete view.
  opsDivider: { display: 'flex', flexDirection: 'column', gap: '.15rem', borderTop: '1px solid var(--line)', paddingTop: '1rem', marginBottom: '.4rem' },
  opsKicker: { fontFamily: 'var(--hb)', fontSize: '.7rem', letterSpacing: '2.5px', textTransform: 'uppercase', color: 'var(--gold-soft)' },
  opsHint: { fontFamily: 'var(--bd)', fontSize: '.78rem', fontWeight: 600, color: 'var(--mut)' },

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
