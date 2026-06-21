// src/components/sportshub/sections.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The Sports Hub — INTERACTIVE performance tab bodies.
//
// Each section is a CONTROLLED component: it paints the lifted model from
// SportsHub and reports edits/toggles back up via callbacks, so the CEO can drive
// the real mechanics — editing a combine mark recomputes its % against the target
// threshold in real time (progressToward), and drill/film items mutate state on
// click. Styling stays in the `.sh-*` namespace (LOCKED-brand varsity register).

import { progressToward } from './hubData.js';
import { resolveAthleticVideo } from './sportsVideos.js';
import VideoSlot from '../common/VideoSlot.jsx';
import TelemetryLog from './TelemetryLog.jsx';

// Educational video per measurable. Each id/title/caption is a localized
// { en, es, pt } map (Priority Delta); VideoSlot reads the global language and
// resolves with EN fallback, so a missing localized clip never drops the embed.
// EN ids are verified clips reused from the authorized exercise VIDEO_MAP; ES/PT
// carry native-language coaching clips where sourced (else fall back to EN).
const METRIC_VIDEOS = {
  velocity: {
    id:      { en: '_DLIS8SySzs', es: 'BCWwSLLILqc', pt: 'eVZqiH0JzY4' },
    title:   { en: 'Max Velocity', es: 'Velocidad Máxima', pt: 'Velocidade Máxima' },
    caption: { en: 'Max Velocity · acceleration mechanics', es: 'Velocidad Máxima · mecánica de aceleración', pt: 'Velocidade Máxima · mecânica de aceleração' },
  },
  power: {
    id:      { en: 'S_uZP4UH6J0', es: '3NY1W_Frnhg', pt: 'HuR_YoPhJ4c' },
    title:   { en: 'Explosive Power', es: 'Potencia Explosiva', pt: 'Potência Explosiva' },
    caption: { en: 'Explosive Power · triple extension', es: 'Potencia Explosiva · triple extensión', pt: 'Potência Explosiva · tripla extensão' },
  },
  force: {
    id:      { en: 'GxsLrTzyGUU', es: 'WwHuwfuK2qM', pt: '6IgdSQzI5_I' },
    title:   { en: 'Max Force', es: 'Fuerza Máxima', pt: 'Força Máxima' },
    caption: { en: 'Max Force · maximal strength', es: 'Fuerza Máxima · fuerza absoluta', pt: 'Força Máxima · força absoluta' },
  },
};

const STATUS_META = {
  assigned: { label: 'Assigned', cls: 'is-assigned' },
  'in-review': { label: 'In Review', cls: 'is-review' },
  complete: { label: 'Reviewed', cls: 'is-complete' },
};

function fmt(n) {
  return typeof n === 'number' ? Number(n).toLocaleString() : n;
}
function formatHeight(inches) {
  const v = parseFloat(inches);
  if (!Number.isFinite(v)) return '—';
  return `${Math.floor(v / 12)}'${Math.round(v % 12)}"`;
}

// Shared card shell so every section reads as one varsity "play card".
function SectionCard({ tag, title, meta, testId, children }) {
  return (
    <section className="sh-card" data-testid={testId}>
      <header className="sh-card-head">
        <div>
          <div className="sh-card-tag">{tag}</div>
          <h2 className="sh-card-title">{title}</h2>
        </div>
        {meta ? <div className="sh-card-meta">{meta}</div> : null}
      </header>
      {children}
    </section>
  );
}

// ── Combine Metrics — editable marks, live % against the collegiate target ─────
export function CombineMetrics({ combine, onMetricChange }) {
  return (
    <SectionCard tag="Scouting · Live Calculator" title={combine.title} meta={combine.reference} testId="sh-section-combine">
      <div className="sh-combine">
        {combine.metrics.map((m) => (
          <div key={m.key} className="sh-combine-row">
            <div className="sh-combine-head">
              <span className="sh-combine-label">{m.label}</span>
              <span className="sh-combine-edit">
                <input
                  className="sh-metric-input"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={m.current}
                  aria-label={`${m.label} current value`}
                  data-testid={`sh-combine-input-${m.key}`}
                  onChange={(e) => onMetricChange(m.key, e.target.value)}
                />
                <span className="sh-combine-unit">{m.unit}</span>
              </span>
            </div>
            <div className="sh-track" role="progressbar" aria-valuenow={m.progress} aria-valuemin={0} aria-valuemax={100}>
              <div className="sh-track-fill" style={{ width: `${m.progress}%` }} />
            </div>
            <div className="sh-combine-foot">
              <span data-testid={`sh-combine-pct-${m.key}`}>{m.progress}% to target</span>
              <span className="sh-combine-target">Target {fmt(m.target)} {m.unit}{m.lowerIsBetter ? ' ↓' : ''}</span>
            </div>
          </div>
        ))}
      </div>
      <p className="sh-hint">Edit a mark to recompute attainment against the collegiate OL threshold in real time.</p>
      <VideoSlot videoId={METRIC_VIDEOS.velocity.id} title={METRIC_VIDEOS.velocity.title} caption={METRIC_VIDEOS.velocity.caption} />
    </SectionCard>
  );
}

// ── Explosive Power — editable force-plate inputs drive a live Power Index ─────
export function ExplosivePower({ power, onPowerChange }) {
  const peak = Math.max(...power.series.map((s) => s.value), parseFloat(power.peakPowerW) || 0);
  return (
    <SectionCard tag="Force Plate · Live VBT" title={power.title} meta={`RFD ${power.rfdTrend} · 4 wk`} testId="sh-section-power">
      <div className="sh-power-top">
        <div className="sh-gauge">
          <div className="sh-gauge-v" data-testid="sh-power-index">{power.index}</div>
          <div className="sh-gauge-l">Power Index</div>
        </div>
        <div className="sh-power-stats">
          <label className="sh-pstat">
            <span className="sh-pstat-l">Peak Power (W)</span>
            <input className="sh-metric-input is-wide" type="number" step="any" inputMode="numeric"
              value={power.peakPowerW} aria-label="Peak power watts" data-testid="sh-power-peak"
              onChange={(e) => onPowerChange('peakPowerW', e.target.value)} />
          </label>
          <label className="sh-pstat">
            <span className="sh-pstat-l">CMJ Power (W)</span>
            <input className="sh-metric-input is-wide" type="number" step="any" inputMode="numeric"
              value={power.cmjPowerW} aria-label="Countermovement jump power watts" data-testid="sh-power-cmj"
              onChange={(e) => onPowerChange('cmjPowerW', e.target.value)} />
          </label>
          <div className="sh-pstat"><span className="sh-pstat-l">Mean Velocity</span><span className="sh-pstat-v">{power.meanVelocity}<small> m/s</small></span></div>
          <div className="sh-pstat"><span className="sh-pstat-l">CMJ Height</span><span className="sh-pstat-v">{power.cmjHeightIn}<small> in</small></span></div>
        </div>
      </div>
      <div className="sh-spark" aria-label="Peak power, last four sessions">
        {power.series.map((s) => (
          <div key={s.label} className="sh-spark-col">
            <div className="sh-spark-bar" style={{ height: `${Math.round((s.value / peak) * 100)}%` }} title={`${fmt(s.value)} W`} />
            <span className="sh-spark-l">{s.label}</span>
          </div>
        ))}
      </div>
      <p className="sh-hint">Power Index = mean attainment of peak &amp; CMJ power vs target — recomputed as you log force-plate numbers.</p>
      <VideoSlot videoId={METRIC_VIDEOS.power.id} title={METRIC_VIDEOS.power.title} caption={METRIC_VIDEOS.power.caption} />
    </SectionCard>
  );
}

// ── Size & Mass — anthropometrics; weight tracks live toward a lineman frame ───
export function SizeMass({ size, onSizeChange }) {
  const weightPct = progressToward(size.weightLbs, size.weightTarget, false);
  return (
    <SectionCard tag="Anthropometrics" title={size.title} meta={size.reference} testId="sh-section-size">
      <div className="sh-sizebar">
        <label className="sh-sizecell">
          <span className="sh-sizecell-l">Weight (lbs)</span>
          <input className="sh-metric-input" type="number" step="any" inputMode="numeric"
            value={size.weightLbs} aria-label="Body weight pounds" data-testid="sh-size-weight"
            onChange={(e) => onSizeChange('weightLbs', e.target.value)} />
        </label>
        <label className="sh-sizecell">
          <span className="sh-sizecell-l">Height (in)</span>
          <input className="sh-metric-input" type="number" step="any" inputMode="numeric"
            value={size.heightIn} aria-label="Height inches"
            onChange={(e) => onSizeChange('heightIn', e.target.value)} />
          <span className="sh-sizecell-s">{formatHeight(size.heightIn)}</span>
        </label>
        <label className="sh-sizecell">
          <span className="sh-sizecell-l">Wingspan (in)</span>
          <input className="sh-metric-input" type="number" step="any" inputMode="numeric"
            value={size.wingspanIn} aria-label="Wingspan inches"
            onChange={(e) => onSizeChange('wingspanIn', e.target.value)} />
        </label>
        <div className="sh-sizecell"><span className="sh-sizecell-l">BF Trend</span><span className="sh-sizecell-v is-grn">{size.bodyfatTrend}</span></div>
      </div>

      <div className="sh-combine-row sh-size-goal">
        <div className="sh-combine-head">
          <span className="sh-combine-label">Mass Goal</span>
          <span className="sh-combine-read"><b>{fmt(parseFloat(size.weightLbs) || 0)}</b><span className="sh-combine-unit"> / {size.weightTarget} lbs</span></span>
        </div>
        <div className="sh-track" role="progressbar" aria-valuenow={weightPct} aria-valuemin={0} aria-valuemax={100}>
          <div className="sh-track-fill" style={{ width: `${weightPct}%` }} />
        </div>
        <div className="sh-combine-foot">
          <span data-testid="sh-size-pct">{weightPct}% to frame target</span>
          <span className="sh-combine-target">Collegiate OL ≈ {size.weightTarget} lbs</span>
        </div>
      </div>
      <VideoSlot videoId={METRIC_VIDEOS.force.id} title={METRIC_VIDEOS.force.title} caption={METRIC_VIDEOS.force.caption} />
    </SectionCard>
  );
}

// ── Day Protocol — the active day's workload + that day's drills + film. The
//    actionable items (drills / film) are distributed across the 7-day week
//    (hubData.buildWeek); every item is a tap-to-track checkoff. `view` pins the
//    render to ONE domain so the Sports Hub can host Exercises (weight room) and
//    Drills (field work + film) as SEPARATE tabs: 'exercises' | 'drills' | 'all'. ──
export function DayProtocol({ day, phase, telemetry, onToggleExercise, onToggleDrill, onCycleStatus, view = 'all' }) {
  const logs = telemetry?.logs || {};
  const showExercises = view === 'all' || view === 'exercises';
  const showDrills = view === 'all' || view === 'drills';
  if (day.rest) {
    return (
      <section className="sh-card sh-restcard" data-testid="sh-day-rest">
        <div className="sh-day-kicker">{day.label}</div>
        <div className="sh-rest-icon" aria-hidden="true">😴</div>
        <h2 className="sh-rest-title">{day.focus}</h2>
        <p className="sh-rest-sub">{day.restNote}</p>
      </section>
    );
  }

  const exDone = day.exercises.filter((e) => e.done).length;
  const drillDone = day.drills.filter((d) => d.done).length;
  const watched = day.film.filter((c) => c.status === 'complete').length;
  const phaseLabel = phase === 'inseason' ? 'In-Season' : 'Off-Season';

  return (
    <>
      {/* Workout — the day's off/in-season workload, tap an exercise to mark it done. */}
      {showExercises ? (
      <SectionCard tag={`${phaseLabel} · Workload`} title={day.focus} meta={`${exDone} / ${day.exercises.length} done`} testId="sh-day-workout">
        <div className="sh-exlist">
          {day.exercises.map((e, i) => {
            const vid = resolveAthleticVideo(e.name); // exact verified clip or null (no fallback)
            const logKey = `ex:${day.label}:${e.name}`;
            return (
              <div className="sh-ex-row" key={e.name}>
                <button
                  type="button"
                  className={`sh-ex${e.done ? ' is-done' : ''}`}
                  aria-pressed={e.done}
                  aria-label={`Mark ${e.name} ${e.done ? 'incomplete' : 'complete'}`}
                  data-testid={`sh-ex-${i}`}
                  onClick={() => onToggleExercise(i)}
                >
                  <span className={`sh-ex-check${e.done ? ' is-on' : ''}`} aria-hidden="true">{e.done ? '✓' : ''}</span>
                  <span className="sh-ex-name">{e.name}</span>
                  <span className="sh-ex-scheme" data-testid={`sh-ex-scheme-${i}`}>{phase === 'inseason' ? e.in : e.off}</span>
                </button>
                {vid ? <VideoSlot videoId={vid} title={e.name} caption={phase === 'inseason' ? e.in : e.off} /> : null}
                {/* Telemetry logbook — persists weight/RPE; logging also marks the row done. */}
                <TelemetryLog
                  saved={logs[logKey] || null}
                  onLog={(entry) => {
                    telemetry?.logSet(logKey, entry, { exerciseName: e.name, source: 'ex', day: day.label });
                    if (!e.done) onToggleExercise(i);
                  }}
                />
              </div>
            );
          })}
        </div>
      </SectionCard>
      ) : null}

      {/* Today's drills (position-specific, distributed across the week). */}
      {showDrills && day.drills.length ? (
        <SectionCard tag="Position-Specific" title="Today’s Drills" meta={`${drillDone} / ${day.drills.length}`} testId="sh-day-drills">
          <div className="sh-drills">
            {day.drills.map((d, i) => {
              const vid = resolveAthleticVideo(d.name); // exact verified clip or null (no fallback)
              const logKey = `dr:${day.label}:${d.name}`;
              return (
                <div key={d.name} className={`sh-drill${d.done ? ' is-hot is-done' : ''}`}>
                  <button
                    type="button"
                    className={`sh-drill-check${d.done ? ' is-on' : ''}`}
                    aria-pressed={d.done}
                    aria-label={`Mark ${d.name} ${d.done ? 'incomplete' : 'complete'}`}
                    data-testid={`sh-drill-toggle-${i}`}
                    onClick={() => onToggleDrill(i)}
                  >
                    {d.done ? '✓' : ''}
                  </button>
                  <div className="sh-drill-body">
                    <div className="sh-drill-top">
                      <span className="sh-drill-name">{d.name}</span>
                      <span className="sh-drill-pct">{d.done ? 'MET' : d.reps}</span>
                    </div>
                    <div className="sh-drill-desc">{d.detail}</div>
                    {vid ? <VideoSlot videoId={vid} title={d.name} caption={d.detail} /> : null}
                    {/* Telemetry logbook — weight optional for drills (blank = BW). */}
                    <TelemetryLog
                      saved={logs[logKey] || null}
                      onLog={(entry) => {
                        telemetry?.logSet(logKey, entry, { exerciseName: d.name, source: 'dr', day: day.label });
                        if (!d.done) onToggleDrill(i);
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      ) : null}

      {/* Today's film study (tap a card to advance assigned → in-review → reviewed). */}
      {showDrills && day.film.length ? (
        <SectionCard tag="Film Room · Tap to Update" title="Film Study" meta={`${watched} / ${day.film.length} reviewed`} testId="sh-day-film">
          <div className="sh-film">
            {day.film.map((c, i) => {
              const s = STATUS_META[c.status] || STATUS_META.assigned;
              return (
                <button
                  key={c.title}
                  type="button"
                  className="sh-clip"
                  data-testid={`sh-film-card-${i}`}
                  aria-label={`${c.title} — status ${s.label}. Tap to advance status.`}
                  onClick={() => onCycleStatus(i)}
                >
                  <span className="sh-clip-play" aria-hidden="true">▶</span>
                  <span className="sh-clip-body">
                    <span className="sh-clip-title">{c.title}</span>
                    <span className="sh-clip-meta">{c.concept} · {c.duration}</span>
                  </span>
                  <span className={`sh-clip-status ${s.cls}`}>{s.label}</span>
                </button>
              );
            })}
          </div>
        </SectionCard>
      ) : null}
    </>
  );
}
