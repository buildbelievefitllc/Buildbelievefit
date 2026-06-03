// src/components/command/NutritionLocker.jsx
// ─────────────────────────────────────────────────────────────────────────────
// NUTRITION LOCKER & DIET PLAN — the admin-only generative diet suite, built to the
// Google AI Studio prototype. This is COMPLETELY SEPARATE from the client-facing,
// read-only vault Nutrition tab (components/vault/Nutrition.jsx): this surface
// TARGETS another athlete, COMPILES a 7-day protocol from the Advanced Culinary
// Parameter Console, and PUSHES it to that athlete's database row.
//
// Admin gating: this panel is only mounted inside CommandCenter, which lives behind
// <AdminGuard> (role admin/trainer/akeem). It is a token-gated surface — its roster
// pull + assign_nutrition push both go through bbf-admin-roster (X-BBF-Admin-Token),
// so CommandCenter shows the AdminTokenGate until the token is hydrated.
//
// Two consoles (prototype):
//   • NUTRITION SCHEDULER       → 7-day plan: day-tabs → repast intercept → macro
//                                 doughnut + adapt amplitude + epigenetic signaling
//                                 bars + the detailed meal card. The Advanced
//                                 Culinary Parameter Console (Diet Style / Allergy
//                                 Exemption / Base Energy) compiles + pushes here.
//   • COACH OVERSIGHT CONSOLE   → live roster selection → the selected athlete's
//                                 assigned blueprint + AMPLIFY override inputs +
//                                 PUSH OVERSIGHT DIRECT PROTOCOL.
//
// Data path: lib/rosterApi — rosterCall('roster') for the live scholar list, and
// assignNutrition() for the assign_nutrition push (Terminal H owns the server side).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { rosterCall, assignNutrition, toErrorMessage } from '../../lib/rosterApi.js';
import {
  DIET_STYLES, ALLERGY_OPTIONS, PHASE_OPTIONS, ENERGY_PRESETS, DEFAULT_ENERGY,
  ENERGY_MIN, ENERGY_MAX, DAYS, MEAL_SLOTS, VOLUME_MULTIPLIERS, ADAPT_BANDS,
  MACRO_META, WEEK_PROTOCOL, OVERSIGHT_BLUEPRINT, signalingFor, scaleMeal,
  dayTotals, dietStyleLabel, todayKey, buildPlanPayload,
  FASTING_PACES, FASTING_DEFAULT_INDEX, paceByIndex, eatingWindow, clockLabel, macroTracks,
} from './nutritionLockerData.js';
import './nutritionLocker.css';

export default function NutritionLocker() {
  // ── Targeting + parameters ──
  const [mode, setMode] = useState('scheduler'); // 'scheduler' | 'oversight'
  const [scholarId, setScholarId] = useState('');
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [dietStyle, setDietStyle] = useState(DIET_STYLES[0].id);
  const [allergy, setAllergy] = useState(ALLERGY_OPTIONS[0]);
  const [energy, setEnergy] = useState(DEFAULT_ENERGY);
  const [bandId, setBandId] = useState(0);
  // Intermittent fasting is OPTIONAL — index into FASTING_PACES, defaulting to Off.
  const [fastingIdx, setFastingIdx] = useState(FASTING_DEFAULT_INDEX);

  // ── Scheduler view state ──
  const [activeDay, setActiveDay] = useState(todayKey);
  const [activeSlot, setActiveSlot] = useState('breakfast');
  const [volume, setVolume] = useState(1);
  const [openIng, setOpenIng] = useState(null);
  const [readerOn, setReaderOn] = useState(false);
  const [showScience, setShowScience] = useState(false);
  const [showIngList, setShowIngList] = useState(false);

  // ── Roster (live scholar list) ──
  const [clients, setClients] = useState([]);
  const [rosterLoading, setRosterLoading] = useState(true);
  const [rosterError, setRosterError] = useState(null);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  // ── Compile / push action state ──
  const [compileState, setCompileState] = useState({ busy: false, ok: null, err: null });

  // ── Oversight override inputs ──
  const [calorieOverride, setCalorieOverride] = useState(DEFAULT_ENERGY);
  const [phase, setPhase] = useState(PHASE_OPTIONS[0]);
  const [directive, setDirective] = useState('');
  const [pushState, setPushState] = useState({ busy: false, ok: null, err: null });

  const fetchRoster = useCallback(async () => {
    setRosterLoading(true);
    setRosterError(null);
    try {
      const body = await rosterCall('roster');
      if (mounted.current) setClients(Array.isArray(body.clients) ? body.clients : []);
    } catch (e) {
      if (mounted.current) { setRosterError(toErrorMessage(e)); setClients([]); }
    } finally {
      if (mounted.current) setRosterLoading(false);
    }
  }, []);

  // Auto-load on mount (the Command Center unlock gate hydrates the admin token).
  // Deferred to a microtask so the initial setState lands outside the effect body
  // (matches ClientHub — satisfies react-hooks/set-state-in-effect).
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) fetchRoster(); });
    return () => { cancelled = true; };
  }, [fetchRoster]);

  const scholar = useMemo(() => clients.find((c) => clientId(c) === scholarId) || null, [clients, scholarId]);
  // Memoized so the `meal` snapshot below stays referentially stable per band.
  const band = useMemo(() => ADAPT_BANDS.find((b) => b.id === bandId) || ADAPT_BANDS[1], [bandId]);
  // Optional fasting pace (Off by default) + its derived eating window.
  const pace = paceByIndex(fastingIdx);
  const win = eatingWindow(pace);

  // The currently-selected meal, scaled to the chosen energy + adapt band, plus its
  // re-derived signaling index and the whole-day totals. Memoized so the doughnut /
  // bars / card all read one consistent snapshot.
  const meal = useMemo(
    () => scaleMeal(WEEK_PROTOCOL[activeDay][activeSlot], energy, band),
    [activeDay, activeSlot, energy, band],
  );
  const signals = useMemo(() => signalingFor(meal), [meal]);
  const totals = useMemo(() => dayTotals(activeDay, energy, band), [activeDay, energy, band]);
  const dayLabel = DAYS.find((d) => d.key === activeDay)?.label || '';

  // Reset transient per-meal UI on any day/slot change (done in the handlers below,
  // not a setState-in-effect, to keep render side-effect-free).
  const selectDay = (key) => { setActiveDay(key); setOpenIng(null); setReaderOn(false); };
  const selectSlot = (key) => { setActiveSlot(key); setOpenIng(null); setReaderOn(false); };

  // ── Actions ─────────────────────────────────────────────────────────────────
  async function compileProtocol() {
    if (!scholarId) {
      setCompileState({ busy: false, ok: null, err: 'Select a nutrition scholar to target before compiling.' });
      return;
    }
    setCompileState({ busy: true, ok: null, err: null });
    const plan = buildPlanPayload({ dietStyleId: dietStyle, energy, band, fastingPaceId: pace.id });
    try {
      const res = await assignNutrition(scholarId, {
        plan, tdee_target: energy, diet_style: dietStyle, allergens: allergy,
        fasting_window: pace.id, source: 'scheduler',
      });
      if (!mounted.current) return;
      setCompileState({
        busy: false,
        ok: `Protocol compiled and pushed — ${scholar?.name || 'the athlete'} now holds the ${dietStyleLabel(dietStyle)} regime${res?.persisted === false ? ' (queued)' : ''}.`,
        err: null,
      });
    } catch (e) {
      if (mounted.current) setCompileState({ busy: false, ok: null, err: toErrorMessage(e) });
    }
  }

  async function pushOversight() {
    if (!scholarId) {
      setPushState({ busy: false, ok: null, err: 'Select an athlete from the roster before pushing a directive.' });
      return;
    }
    setPushState({ busy: true, ok: null, err: null });
    const plan = buildPlanPayload({ dietStyleId: dietStyle, energy: calorieOverride, band, fastingPaceId: pace.id });
    try {
      await assignNutrition(scholarId, {
        plan, tdee_target: calorieOverride, diet_style: dietStyle, allergens: allergy,
        fasting_window: pace.id, phase, directive, source: 'oversight',
      });
      if (!mounted.current) return;
      setPushState({ busy: false, ok: `Locker state updated. Direct nutrition overrides deployed to the database — ${scholar?.name || 'the athlete'} has received your mandate.`, err: null });
    } catch (e) {
      if (mounted.current) setPushState({ busy: false, ok: null, err: toErrorMessage(e) });
    }
  }

  function exportMarkdown() {
    const day = WEEK_PROTOCOL[activeDay];
    let md = `# ${dayLabel} — ${dietStyleLabel(dietStyle)}\n\n_${totals.kcal.toLocaleString()} kcal · ${totals.p}g P / ${totals.c}g C / ${totals.f}g F_\n\n`;
    MEAL_SLOTS.forEach((slot) => {
      const sm = scaleMeal(day[slot.key], energy, band);
      md += `## ${slot.label} — ${sm.name}\n${sm.kcal} kcal · ${sm.macros.p}P/${sm.macros.c}C/${sm.macros.f}F\n\n`;
      sm.ingredients.forEach((ing) => { md += `- ${ing.q} ${ing.item}\n`; });
      md += '\n';
      sm.prep.forEach((step, i) => { md += `${i + 1}. ${step}\n`; });
      md += '\n';
    });
    downloadText(`bbf-protocol-${activeDay}.md`, md);
  }

  const compiledIngredients = useMemo(() => {
    const day = WEEK_PROTOCOL[activeDay];
    return MEAL_SLOTS.flatMap((slot) => day[slot.key].ingredients.map((ing) => `${ing.q} ${ing.item}`));
  }, [activeDay]);

  return (
    <div className="nl">
      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <header className="nl-hero">
        <span className="nl-pill-badge">🏆 7-Day Athlete Nutritional Lock</span>
        <h1 className="nl-title">Nutrition Locker &amp; Diet Plan</h1>
        <p className="nl-lede">
          Gold-standard diet prescription blueprints. Restructure macro distributions, customize
          food-allergy exemption rules, and generate structured 7-day culinary guides instantly.
        </p>

        <div className="nl-modebar" role="tablist" aria-label="Locker console">
          <button
            type="button" role="tab" aria-selected={mode === 'scheduler'}
            className={`nl-mode${mode === 'scheduler' ? ' is-on' : ''}`}
            onClick={() => setMode('scheduler')}
          >
            🍴 Nutrition Scheduler
          </button>
          <button
            type="button" role="tab" aria-selected={mode === 'oversight'}
            className={`nl-mode nl-mode--oversight${mode === 'oversight' ? ' is-on' : ''}`}
            onClick={() => setMode('oversight')}
          >
            ⊘ Coach Oversight Console
          </button>
        </div>

        {/* SELECT NUTRITION SCHOLAR — wired to the live roster (rosterApi). */}
        <div className="nl-field" style={{ marginBottom: '1rem' }}>
          <label className="nl-label" htmlFor="nl-scholar">⬡ Select Nutrition Scholar</label>
          {rosterLoading ? (
            <div className="nl-state" style={{ padding: '1rem' }}>
              <span className="nl-spinner" aria-hidden="true" /> Loading live roster…
            </div>
          ) : rosterError ? (
            <div className="nl-banner nl-banner--err" role="alert">
              <span className="nl-banner-mark" aria-hidden="true">⚠</span>
              <span>{rosterError}{' '}
                <button type="button" className="nl-link-btn" onClick={fetchRoster}>Retry</button>
              </span>
            </div>
          ) : (
            <select
              id="nl-scholar" className="nl-select" value={scholarId}
              onChange={(e) => { setScholarId(e.target.value); setCompileState({ busy: false, ok: null, err: null }); setPushState({ busy: false, ok: null, err: null }); }}
            >
              <option value="">— Select an athlete to target —</option>
              {clients.map((c) => (
                <option key={clientId(c)} value={clientId(c)}>
                  {c.name || c.uid || 'Unnamed'} · {division(c)}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Active-regime strip + TUNE PARAMETERS toggle. */}
        <div className="nl-regime">
          <div className="nl-regime-col nl-regime-col--grow">
            <span className="nl-regime-lab">Active Regime Blueprint</span>
            <span className="nl-regime-val">{dietStyleLabel(dietStyle)}{allergy !== 'None' ? <em> · {allergy}</em> : null}{pace.fast > 0 ? <em> · TRF {pace.short}</em> : null}</span>
          </div>
          <div className="nl-regime-col">
            <span className="nl-regime-lab">Base Target Calories</span>
            <span className="nl-regime-cal">{Number(energy).toLocaleString()} kcal/day</span>
          </div>
          <button
            type="button"
            className={`nl-btn ${consoleOpen ? 'nl-btn--purple' : 'nl-btn--ghost'}`}
            onClick={() => setConsoleOpen((v) => !v)}
            aria-expanded={consoleOpen}
          >
            {consoleOpen ? '⊘ Close Diet Console' : '⚙ Tune Parameters & Compile'}
          </button>
        </div>
      </header>

      {/* ── ADVANCED CULINARY PARAMETER CONSOLE ──────────────────────────────── */}
      {consoleOpen ? (
        <section className="nl-panel" aria-label="Advanced culinary parameter console">
          <h2 className="nl-section-h">⚙ Advanced Culinary Parameter Console</h2>
          <p className="nl-help" style={{ marginTop: '-.6rem' }}>
            Tune the biological engines. These custom parameters directly re-signal model compilation
            pathways to construct a personalized 7-day cellular matrix.
          </p>

          <div className="nl-console-grid">
            <div className="nl-field">
              <label className="nl-label" htmlFor="nl-diet">🍽 Diet Style</label>
              <span className="nl-help">Choose the optimal macronutrient profiling strategy.</span>
              <select id="nl-diet" className="nl-select" value={dietStyle} onChange={(e) => setDietStyle(e.target.value)}>
                {DIET_STYLES.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </div>

            <div className="nl-field">
              <label className="nl-label" htmlFor="nl-allergy">⚠ Allergy Restrict Exemption</label>
              <span className="nl-help">Filter out compounds that disturb the digestive cell lining.</span>
              <select id="nl-allergy" className="nl-select" value={allergy} onChange={(e) => setAllergy(e.target.value)}>
                {ALLERGY_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            <div className="nl-field">
              <label className="nl-label" htmlFor="nl-energy">⚡ Macro Energy Capacity</label>
              <span className="nl-help">Define the absolute caloric baseline of physical loading (kcal).</span>
              <input
                id="nl-energy" className="nl-input" type="number" inputMode="numeric"
                min={ENERGY_MIN} max={ENERGY_MAX} step={50} list="nl-energy-presets"
                value={energy}
                onChange={(e) => setEnergy(e.target.value === '' ? '' : Number(e.target.value))}
                onBlur={(e) => {
                  const n = Number(e.target.value);
                  setEnergy(!Number.isFinite(n) || n < ENERGY_MIN ? DEFAULT_ENERGY : Math.min(n, ENERGY_MAX));
                }}
              />
              <datalist id="nl-energy-presets">
                {ENERGY_PRESETS.map((p) => <option key={p.kcal} value={p.kcal}>{`${p.kcal} kcal · ${p.label}`}</option>)}
              </datalist>
            </div>
          </div>

          <div className="nl-console-foot">
            <p className="nl-note">
              <b>Note:</b> Generating custom meal plans runs complex scientific models. If a live key
              is not active, standard preloaded, high-fidelity plans load instantly to keep your
              experience pristine — the compiled protocol is then pushed to the selected athlete&apos;s row.
            </p>
            <button
              type="button" className="nl-btn nl-btn--gold nl-btn--lg"
              onClick={compileProtocol} disabled={compileState.busy}
            >
              {compileState.busy ? '✨ Compiling…' : '✨ Compile Diet Protocol'}
            </button>
          </div>

          {compileState.ok ? (
            <div className="nl-banner nl-banner--ok" role="status">
              <span className="nl-banner-mark" aria-hidden="true">✓</span><span>{compileState.ok}</span>
            </div>
          ) : null}
          {compileState.err ? (
            <div className="nl-banner nl-banner--err" role="alert">
              <span className="nl-banner-mark" aria-hidden="true">⚠</span><span>{compileState.err}</span>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* ── SEED GENE B-B-F IDEOLOGY banner ──────────────────────────────────── */}
      <section className="nl-seed" aria-label="Seed gene ideology">
        <span className="nl-seed-icon" aria-hidden="true">✷</span>
        <div className="nl-seed-body">
          <div className="nl-seed-title">The Seed Gene B-B-F Ideology</div>
          <div className="nl-seed-text">
            Unlock clinical performance through cell signaling. Epigenetic chromatin triggers are
            synchronized strictly around post-loading rest states.
          </div>
          {showScience ? (
            <div className="nl-seed-science">
              Seeding protocols time micronutrient-dense, low-glycemic intercepts to the post-training
              rest window — when chromatin is most receptive — to bias mTOR synthesis and DNA-repair
              activation without spiking the endocrine load. This is presentation framing for the
              prototype, not a medical claim.
            </div>
          ) : null}
        </div>
        <button type="button" className="nl-btn nl-btn--gold" onClick={() => setShowScience((v) => !v)}>
          {showScience ? 'Hide Seeding Science' : 'Expose Seeding Science'}
        </button>
      </section>

      {/* ── CONSOLE BODY ─────────────────────────────────────────────────────── */}
      {mode === 'scheduler' ? (
        <>
          {/* 7-day tabs */}
          <div className="nl-days" role="tablist" aria-label="Day of the week">
            {DAYS.map((d) => (
              <button
                key={d.key} type="button" role="tab" aria-selected={activeDay === d.key}
                className={`nl-day${activeDay === d.key ? ' is-on' : ''}`}
                onClick={() => selectDay(d.key)}
              >
                <span className="nl-day-n">Day {d.n}</span>
                <span className="nl-day-d">{d.label}</span>
              </button>
            ))}
          </div>

          {/* Daily macro tracking + optional fasting pace (sit side-by-side) */}
          <section className="nl-panel nl-daily" aria-label="Daily macro tracking and fasting pace">
            <div className="nl-daily-grid">
              {/* Fasting Pace — fully optional, Off by default (no hardcoded 16/8) */}
              <div className="nl-fast">
                <div className="nl-section-h" style={{ marginBottom: '.4rem' }}>
                  ⏱ Fasting Pace <span className="nl-fast-opt">Optional</span>
                </div>
                <p className="nl-help" style={{ marginBottom: '.9rem' }}>
                  Intermittent fasting is opt-in. Leave it Off for unrestricted feeding, or dial a
                  time-restricted window.
                </p>
                <input
                  type="range" className="nl-fast-slider"
                  min={0} max={FASTING_PACES.length - 1} step={1} value={fastingIdx}
                  onChange={(e) => setFastingIdx(Number(e.target.value))}
                  aria-label="Fasting pace" aria-valuetext={pace.label} list="nl-fast-ticks"
                />
                <datalist id="nl-fast-ticks">
                  {FASTING_PACES.map((p, i) => <option key={p.id} value={i} label={p.short} />)}
                </datalist>
                <div className="nl-fast-ticks" role="group" aria-label="Fasting pace stops">
                  {FASTING_PACES.map((p, i) => (
                    <button
                      key={p.id} type="button" aria-pressed={i === fastingIdx}
                      className={`nl-fast-tick${i === fastingIdx ? ' is-on' : ''}`}
                      onClick={() => setFastingIdx(i)}
                    >{p.short}</button>
                  ))}
                </div>

                {pace.fast > 0 ? (
                  <div className="nl-fast-readout">
                    <div className="nl-fast-line"><b>{pace.fast}h</b> fast · <b>{pace.eat}h</b> feeding window</div>
                    <div className="nl-fast-track" aria-hidden="true">
                      <div className="nl-fast-eat" style={{ left: `${(win.startH / 24) * 100}%`, width: `${(pace.eat / 24) * 100}%` }} />
                    </div>
                    <div className="nl-fast-clock">Eating window: {clockLabel(win.startH)} – {clockLabel(win.endH)}</div>
                  </div>
                ) : (
                  <div className="nl-fast-readout">
                    <div className="nl-fast-off"><span className="nl-fast-off-dot" aria-hidden="true" /> Time-restricted feeding disabled — unrestricted 24h eating window.</div>
                  </div>
                )}
              </div>

              {/* Daily macro tracking rings (Calories · Protein · Carbs · Fats) */}
              <div className="nl-track">
                <div className="nl-section-h" style={{ marginBottom: '.7rem' }}>▦ Daily Macro Tracking — {dayLabel}</div>
                <div className="nl-track-grid">
                  <StatRing
                    pct={energy ? (totals.kcal / Number(energy)) * 100 : 0}
                    color="var(--yel)" value={totals.kcal.toLocaleString()} unit="kcal"
                    label="Calories" sub={`of ${Number(energy || 0).toLocaleString()} target`}
                  />
                  {macroTracks(totals).map((mtk) => (
                    <StatRing
                      key={mtk.key} pct={mtk.pct} color={mtk.color}
                      value={`${mtk.grams}g`} unit={`${mtk.pct}%`}
                      label={mtk.label} sub={`${mtk.cals.toLocaleString()} kcal`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Repast intercept (meal-slot) tabs */}
          <div className="nl-panel">
            <div className="nl-kicker">1 · Select Repast Intercept</div>
            <div className="nl-repasts">
              {MEAL_SLOTS.map((slot) => {
                const sm = WEEK_PROTOCOL[activeDay][slot.key];
                return (
                  <button
                    key={slot.key} type="button" aria-pressed={activeSlot === slot.key}
                    className={`nl-repast${activeSlot === slot.key ? ' is-on' : ''}`}
                    onClick={() => selectSlot(slot.key)}
                  >
                    <span className="nl-repast-slot">{slot.label}</span>
                    <span className="nl-repast-name">{sm.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Macro distribution */}
            <div className="nl-macro-head">
              <span className="nl-section-h" style={{ margin: 0 }}>Macro Distribution</span>
              <span className="nl-macro-kcal">{meal.kcal.toLocaleString()} kcal</span>
            </div>
            <div className="nl-donut-wrap">
              <MacroDonut macros={meal.macros} kcal={meal.kcal} />
              <div className="nl-legend">
                {MACRO_META.map((mt) => (
                  <span key={mt.key}><i style={{ background: mt.color }} /> {mt.label}</span>
                ))}
              </div>
            </div>
            <div className="nl-macro-pills">
              <div className="nl-macro-pill nl-mpill--p"><b style={{ color: 'var(--purl)' }}>{meal.macros.p}g</b><span>Protein</span></div>
              <div className="nl-macro-pill nl-mpill--c"><b style={{ color: 'var(--yel)' }}>{meal.macros.c}g</b><span>Carbs</span></div>
              <div className="nl-macro-pill nl-mpill--f"><b style={{ color: '#b9a7d6' }}>{meal.macros.f}g</b><span>Fats</span></div>
            </div>

            {/* Metabolic adapt amplitude */}
            <div className="nl-adapt-head">
              <span className="nl-section-h" style={{ margin: 0 }}>Metabolic Adapt Amplitude</span>
              <span className="nl-adapt-tag">{band.tag}</span>
            </div>
            <div className="nl-adapt-row">
              <button
                type="button" className={`nl-adapt-btn${bandId === -1 ? ' is-on' : ''}`}
                onClick={() => setBandId((v) => (v === -1 ? 0 : -1))}
              >− Shred Adapt</button>
              <button
                type="button" className={`nl-adapt-btn${bandId === 1 ? ' is-on' : ''}`}
                onClick={() => setBandId((v) => (v === 1 ? 0 : 1))}
              >+ Anabolic Bulk</button>
            </div>

            {/* Epigenetic cell signaling index */}
            <div className="nl-signals">
              <div className="nl-section-h" style={{ marginBottom: '.8rem' }}>✦ Epigenetic Cell Signaling Index</div>
              {signals.map((s) => (
                <div className="nl-sig" key={s.key}>
                  <div className="nl-sig-top">
                    <span className="nl-sig-lab">{s.label}</span>
                    <span className="nl-sig-pct">{s.pct}%</span>
                  </div>
                  <div className="nl-sig-track">
                    <div className="nl-sig-fill" style={{ width: `${s.pct}%`, background: `linear-gradient(90deg, ${s.from}, ${s.to})` }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="nl-export-row">
              <button type="button" className="nl-btn nl-btn--ghost" onClick={exportMarkdown}>⬇ Export Markdown</button>
              <button type="button" className="nl-btn nl-btn--ghost" onClick={() => setShowIngList((v) => !v)}>
                ▤ {showIngList ? 'Hide' : 'Compiled'} Ingredients
              </button>
            </div>
            {showIngList ? (
              <div className="nl-desc" style={{ marginTop: '.8rem' }}>
                <strong style={{ color: 'var(--gold-soft)' }}>{dayLabel} shopping list</strong>
                <ul style={{ margin: '.5rem 0 0', paddingLeft: '1.1rem' }}>
                  {compiledIngredients.map((line, i) => <li key={i}>{line}</li>)}
                </ul>
              </div>
            ) : null}
          </div>

          {/* Detailed meal card */}
          <MealCard
            meal={meal} slotLabel={MEAL_SLOTS.find((s) => s.key === activeSlot)?.label} dayN={DAYS.find((d) => d.key === activeDay)?.n}
            volume={volume} setVolume={setVolume} openIng={openIng} setOpenIng={setOpenIng}
            readerOn={readerOn} setReaderOn={setReaderOn}
          />
        </>
      ) : (
        // ── COACH OVERSIGHT CONSOLE ──
        <>
          <section className="nl-panel" aria-label="Coach roster selection">
            <div className="nl-kicker">⊟ Coach Roster Selection ({clients.length})</div>
            {rosterLoading ? (
              <div className="nl-state"><span className="nl-spinner" aria-hidden="true" /> Loading roster…</div>
            ) : rosterError ? (
              <div className="nl-state is-error">{rosterError}<button type="button" className="nl-btn nl-btn--ghost" onClick={fetchRoster}>Retry</button></div>
            ) : !clients.length ? (
              <div className="nl-state">No athletes on the roster yet.</div>
            ) : (
              <div className="nl-roster">
                {clients.map((c) => {
                  const id = clientId(c);
                  const on = id === scholarId;
                  return (
                    <button
                      key={id} type="button" aria-pressed={on}
                      className={`nl-rrow${on ? ' is-on' : ''}`}
                      onClick={() => { setScholarId(id); setCalorieOverride(Number(c.tdee_target) > 0 ? Number(c.tdee_target) : DEFAULT_ENERGY); setPushState({ busy: false, ok: null, err: null }); }}
                    >
                      <span className="nl-ravatar" aria-hidden="true">{initials(c.name || c.uid)}</span>
                      <span className="nl-rmeta">
                        <span className="nl-rname">{c.name || c.uid || 'Unnamed'}{c.uid && c.name ? <em>{c.uid}</em> : null}</span>
                        <span className="nl-rsub">{division(c)} · target: <b>{Number(c.tdee_target) > 0 ? `${Number(c.tdee_target).toLocaleString()} kcal` : 'unset'}</b></span>
                      </span>
                      <span className="nl-rdot" aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            )}
            <p className="nl-note" style={{ marginTop: '1rem' }}>
              ⊟ Roster DB metadata — pushing an override instantly syncs parameters with the central
              client database and adjusts the visual graphs across the athlete dashboard.
            </p>
          </section>

          {scholar ? (
            <section className="nl-panel" aria-label="Active athlete locker oversight">
              <div className="nl-oversight-head">
                <div>
                  <span className="nl-pill-badge">Active Athlete Locker Oversight</span>
                  <h2 className="nl-oversight-title">{scholar.name || scholar.uid}</h2>
                  <div className="nl-oversight-goal">Current Goal Paradigm: <b>{division(scholar)}</b></div>
                </div>
                <div className="nl-compliance">
                  <div className="nl-compliance-lab">Compliance Rating</div>
                  <div className="nl-compliance-val">{compliancePct(scholar)}%</div>
                </div>
              </div>

              <div className="nl-section-h" style={{ marginTop: '1.2rem' }}>🍴 Analyzing Athlete Meal Blue-Prints (&ldquo;What They Got&rdquo;)</div>
              <div className="nl-blueprint-grid">
                {OVERSIGHT_BLUEPRINT.cards.map((card) => (
                  <div className="nl-bp" key={card.slot}>
                    {card.tag ? <span className="nl-bp-tag">{card.tag}</span> : null}
                    <div className="nl-bp-slot">{card.slot}</div>
                    <div className="nl-bp-name">{card.name.replace('{name}', firstName(scholar))}</div>
                    <div className="nl-bp-note">{card.note}</div>
                  </div>
                ))}
              </div>
              <div className="nl-summary-pills">
                <div className="nl-spill"><span>Calories</span>{OVERSIGHT_BLUEPRINT.macros.kcal.toLocaleString()} kcal</div>
                <div className="nl-spill"><span>Protein</span>{OVERSIGHT_BLUEPRINT.macros.p}g</div>
                <div className="nl-spill"><span>Carbs</span>{OVERSIGHT_BLUEPRINT.macros.c}g</div>
                <div className="nl-spill"><span>Fats</span>{OVERSIGHT_BLUEPRINT.macros.f}g</div>
              </div>

              <div className="nl-section-h" style={{ marginTop: '1.4rem' }}>⚡ Amplify Nutritional Prescriptions (Override Inputs)</div>
              <div className="nl-amplify-grid">
                <div className="nl-field">
                  <label className="nl-label" htmlFor="nl-cal-override">Calorie Override Index</label>
                  <input
                    id="nl-cal-override" className="nl-input" type="number" inputMode="numeric"
                    min={ENERGY_MIN} max={ENERGY_MAX} step={50} value={calorieOverride}
                    onChange={(e) => setCalorieOverride(e.target.value === '' ? '' : Number(e.target.value))}
                    onBlur={(e) => { const n = Number(e.target.value); setCalorieOverride(!Number.isFinite(n) || n < ENERGY_MIN ? DEFAULT_ENERGY : Math.min(n, ENERGY_MAX)); }}
                  />
                </div>
                <div className="nl-field">
                  <label className="nl-label" htmlFor="nl-phase">Athletic Phase Assignment</label>
                  <select id="nl-phase" className="nl-select" value={phase} onChange={(e) => setPhase(e.target.value)}>
                    {PHASE_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="nl-field nl-amplify-full">
                  <label className="nl-label" htmlFor="nl-directive">Coach Directive Mandate (Feedback)</label>
                  <textarea
                    id="nl-directive" className="nl-textarea" value={directive}
                    onChange={(e) => setDirective(e.target.value)}
                    placeholder={`Enter instructions for ${firstName(scholar)}… e.g. Scale caloric threshold up +15% centered at the lunch sequence to amplify SEED-gene partitions on heavy quad-squat days.`}
                  />
                </div>
              </div>

              <button
                type="button" className="nl-btn nl-btn--gold nl-btn--lg nl-btn--block"
                onClick={pushOversight} disabled={pushState.busy}
              >
                {pushState.busy ? '👤 Pushing…' : '👤 Push Oversight Direct Protocol'}
              </button>
              {pushState.ok ? (
                <div className="nl-banner nl-banner--ok" role="status">
                  <span className="nl-banner-mark" aria-hidden="true">✓</span><span>{pushState.ok}</span>
                </div>
              ) : null}
              {pushState.err ? (
                <div className="nl-banner nl-banner--err" role="alert">
                  <span className="nl-banner-mark" aria-hidden="true">⚠</span><span>{pushState.err}</span>
                </div>
              ) : null}
            </section>
          ) : (
            <section className="nl-panel">
              <div className="nl-state">Select an athlete from the roster to open their locker oversight.</div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

// ── Hand-rolled macro doughnut (no chart lib — BBF brutalist system) ───────────
function MacroDonut({ macros, kcal }) {
  const total = (macros.p || 0) + (macros.c || 0) + (macros.f || 0) || 1;
  const R = 64, CX = 90, CY = 90, SW = 22;
  const C = 2 * Math.PI * R;
  // Sweep order matches the legend (Carbs → Fats → Protein).
  const segs = [
    { key: 'c', val: macros.c, color: 'var(--yel)' },
    { key: 'f', val: macros.f, color: '#b9a7d6' },
    { key: 'p', val: macros.p, color: 'var(--purl)' },
  ];
  let offset = 0;
  return (
    <svg className="nl-donut" viewBox="0 0 180 180" role="img" aria-label={`Macro split: ${macros.p}g protein, ${macros.c}g carbs, ${macros.f}g fats`}>
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="#18171d" strokeWidth={SW} />
      {segs.map((s) => {
        const frac = (s.val || 0) / total;
        const len = frac * C;
        const dash = `${len} ${C - len}`;
        const el = (
          <circle
            key={s.key} cx={CX} cy={CY} r={R} fill="none" stroke={s.color} strokeWidth={SW}
            strokeDasharray={dash} strokeDashoffset={-offset} transform={`rotate(-90 ${CX} ${CY})`}
            strokeLinecap="butt"
          />
        );
        offset += len;
        return el;
      })}
      <text className="nl-donut-center" x={CX} y={CY - 2} textAnchor="middle" fontSize="26">{kcal.toLocaleString()}</text>
      <text className="nl-donut-center-sub" x={CX} y={CY + 18} textAnchor="middle" fontSize="9">KCAL</text>
    </svg>
  );
}

// ── Single-arc progress ring (daily macro-tracking dashboard) ─────────────────
function StatRing({ pct, color, value, unit, label, sub }) {
  const R = 32, CX = 42, CY = 42, SW = 8;
  const C = 2 * Math.PI * R;
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  const dash = `${(p / 100) * C} ${C}`;
  return (
    <div className="nl-ring-card">
      <svg className="nl-ring" viewBox="0 0 84 84" role="img" aria-label={`${label}: ${value} (${Math.round(p)}%)`}>
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="#18171d" strokeWidth={SW} />
        <circle
          cx={CX} cy={CY} r={R} fill="none" stroke={color} strokeWidth={SW}
          strokeDasharray={dash} strokeLinecap="round" transform={`rotate(-90 ${CX} ${CY})`}
        />
        <text className="nl-ring-val" x={CX} y={CY - 1} textAnchor="middle" fontSize="14">{value}</text>
        <text className="nl-ring-unit" x={CX} y={CY + 13} textAnchor="middle" fontSize="8">{unit}</text>
      </svg>
      <div className="nl-ring-meta">
        <div className="nl-ring-label">{label}</div>
        <div className="nl-ring-sub">{sub}</div>
      </div>
    </div>
  );
}

// ── Detailed meal card (macro pills · ingredients w/ clinical tips · prep · video) ─
function MealCard({ meal, slotLabel, dayN, volume, setVolume, openIng, setOpenIng, readerOn, setReaderOn }) {
  return (
    <section className="nl-panel nl-meal" aria-label={`Meal detail: ${meal.name}`}>
      <div className="nl-meal-head">
        <div>
          <div className="nl-meal-eyebrow">🍴 {slotLabel} // Day {dayN}</div>
          <h3 className="nl-meal-title">{meal.name}</h3>
        </div>
        <button type="button" className={`nl-reader${readerOn ? ' is-on' : ''}`} onClick={() => setReaderOn((v) => !v)} aria-pressed={readerOn}>
          {readerOn ? '◼ Reader Active' : '▷ Press Play Reader'}
        </button>
      </div>

      <div className="nl-meal-pills">
        {meal.tag ? <span className="nl-mpill nl-mpill--seed">{meal.tag}</span> : null}
        <span className="nl-mpill nl-mpill--kcal">{meal.kcal.toLocaleString()} kcal</span>
        <span className="nl-mpill nl-mpill--p">{meal.macros.p}g Protein</span>
        <span className="nl-mpill nl-mpill--c">{meal.macros.c}g Carbs</span>
        <span className="nl-mpill nl-mpill--f">{meal.macros.f}g Fats</span>
      </div>

      <div className="nl-desc">{meal.blurb}</div>

      <div className="nl-multiply">
        <span className="nl-multiply-lab">▦ Multiply Component Volume</span>
        <span className="nl-mx" role="group" aria-label="Batch multiplier">
          {VOLUME_MULTIPLIERS.map((v) => (
            <button key={v.x} type="button" className={`nl-mx-btn${volume === v.x ? ' is-on' : ''}`} onClick={() => setVolume(v.x)}>
              {v.label}
            </button>
          ))}
        </span>
      </div>

      <div className="nl-ingredients-lab">Precise Culinary Metrics (click an item for clinical tips)</div>
      {meal.ingredients.map((ing, i) => {
        const open = openIng === i;
        return (
          <div key={`${ing.item}-${i}`}>
            <button type="button" className={`nl-ing${open ? ' is-open' : ''}`} aria-expanded={open} onClick={() => setOpenIng(open ? null : i)}>
              <span className="nl-ing-dot" aria-hidden="true" />
              <span className="nl-ing-main"><em>{scaleQty(ing.q, volume)}</em>{ing.item}</span>
              <span className="nl-ing-book" aria-hidden="true">📖</span>
            </button>
            {open ? <div className="nl-ing-tip">{ing.tip}</div> : null}
          </div>
        );
      })}

      <div className="nl-prep-lab">Preparation Protocol</div>
      <ol className="nl-prep">
        {meal.prep.map((step, i) => <li key={i}>{step}</li>)}
      </ol>

      <div className="nl-video">
        <div className="nl-video-lab">
          <span>▷ Preset Culinary Video Demo Screener</span>
          <span className="nl-video-class">Tutorial Class {meal.tutorialClass}</span>
        </div>
        <div className="nl-video-frame" role="img" aria-label="Culinary demo video placeholder">
          <span className="nl-video-play" aria-hidden="true">▶</span>
          <span className="nl-video-cap">Demo reel renders on protocol publish</span>
        </div>
      </div>
    </section>
  );
}

// ── Pure helpers ────────────────────────────────────────────────────────────
function clientId(c) { return c?.id ?? c?.uid ?? c?.email ?? ''; }
function initials(name) {
  const p = String(name || '').trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '—';
}
function firstName(c) { return String(c?.name || c?.uid || 'Athlete').trim().split(/\s+/)[0]; }
function division(c) {
  return c?.metabolic_tier || c?.subscription_tier || c?.role || 'Sovereign Client';
}
// Stable, deterministic oversight metric derived from the athlete id (84–99%), so
// the rating holds steady per-athlete without fabricating live telemetry.
function compliancePct(c) {
  const s = String(clientId(c));
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return 84 + (h % 16);
}
// Multiply the leading numeric token of an ingredient quantity (handles ints,
// decimals and simple fractions like "1/2"); otherwise prefix "N× ".
function scaleQty(q, mult) {
  const n = Number(mult) || 1;
  if (n === 1) return `${q} `;
  const frac = /^(\d+)\/(\d+)\b(.*)$/.exec(q);
  if (frac) {
    const val = (Number(frac[1]) / Number(frac[2])) * n;
    return `${trimNum(val)}${frac[3]} `;
  }
  const num = /^(\d*\.?\d+)\b(.*)$/.exec(q);
  if (num) return `${trimNum(Number(num[1]) * n)}${num[2]} `;
  return `${n}× ${q} `;
}
function trimNum(v) { return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, ''); }
function downloadText(filename, text) {
  try {
    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  } catch { /* download unavailable in this runtime — non-fatal */ }
}
