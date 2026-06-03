// src/components/sportshub/sections.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The Sports Hub — dashboard section bodies (scaffold).
//
// The four youth/lineman surfaces the CEO scoped: Combine Metrics, Explosive
// Power Output, Lineman-Specific Drill Progress, and Positional Film Study. Each
// is a pure presentational component painting the buildHubModel() shape — no
// network, no state. Styling is the `.sh-*` namespace (sportsHub.css), kept
// strictly LOCKED-brand (purple/gold, matte-black canvas) but in a varsity
// "scoreboard" register that reads visibly younger than the adult Sovereign Vault.

const STATUS_META = {
  assigned: { label: 'Assigned', cls: 'is-assigned' },
  'in-review': { label: 'In Review', cls: 'is-review' },
  complete: { label: 'Watched', cls: 'is-complete' },
};

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

function fmt(n) {
  return typeof n === 'number' ? Number(n).toLocaleString() : n;
}

export function CombineMetrics({ combine, size }) {
  return (
    <SectionCard
      tag="Scouting · Verified"
      title={combine.title}
      meta={combine.reference}
      testId="sh-section-combine"
    >
      <div className="sh-sizebar">
        <div className="sh-sizecell"><span className="sh-sizecell-l">Height</span><span className="sh-sizecell-v">{size.height}</span></div>
        <div className="sh-sizecell"><span className="sh-sizecell-l">Weight</span><span className="sh-sizecell-v">{size.weight}<small> {size.weightUnit}</small></span></div>
        <div className="sh-sizecell"><span className="sh-sizecell-l">Wingspan</span><span className="sh-sizecell-v">{size.wingspan}</span></div>
        <div className="sh-sizecell"><span className="sh-sizecell-l">BF Trend</span><span className="sh-sizecell-v is-grn">{size.bodyfatTrend}</span></div>
      </div>

      <div className="sh-combine">
        {combine.metrics.map((m) => (
          <div key={m.key} className="sh-combine-row">
            <div className="sh-combine-head">
              <span className="sh-combine-label">{m.label}</span>
              <span className="sh-combine-read">
                <b>{fmt(m.current)}</b><span className="sh-combine-unit"> {m.unit}</span>
              </span>
            </div>
            <div className="sh-track" role="progressbar" aria-valuenow={m.progress} aria-valuemin={0} aria-valuemax={100}>
              <div className="sh-track-fill" style={{ width: `${m.progress}%` }} />
            </div>
            <div className="sh-combine-foot">
              <span>{m.progress}% to target</span>
              <span className="sh-combine-target">Target {fmt(m.target)} {m.unit}{m.lowerIsBetter ? ' ↓' : ''}</span>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

export function ExplosivePower({ power }) {
  const peak = Math.max(...power.series.map((s) => s.value));
  return (
    <SectionCard
      tag="Force Plate · VBT"
      title={power.title}
      meta={`RFD ${power.rfdTrend} · 4 wk`}
      testId="sh-section-power"
    >
      <div className="sh-power-top">
        <div className="sh-gauge">
          <div className="sh-gauge-v">{power.index}</div>
          <div className="sh-gauge-l">Power Index</div>
        </div>
        <div className="sh-power-stats">
          <div className="sh-pstat"><span className="sh-pstat-l">Peak Power</span><span className="sh-pstat-v">{fmt(power.peakPowerW)}<small> W</small></span></div>
          <div className="sh-pstat"><span className="sh-pstat-l">Mean Velocity</span><span className="sh-pstat-v">{power.meanVelocity}<small> m/s</small></span></div>
          <div className="sh-pstat"><span className="sh-pstat-l">CMJ Height</span><span className="sh-pstat-v">{power.cmjHeightIn}<small> in</small></span></div>
          <div className="sh-pstat"><span className="sh-pstat-l">CMJ Power</span><span className="sh-pstat-v">{fmt(power.cmjPowerW)}<small> W</small></span></div>
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
    </SectionCard>
  );
}

export function DrillProgress({ drills }) {
  return (
    <SectionCard
      tag="Trench Work · Position-Specific"
      title={drills.title}
      meta={`${drills.items.length} active drills`}
      testId="sh-section-drills"
    >
      <div className="sh-drills">
        {drills.items.map((d) => (
          <div key={d.name} className={`sh-drill${d.progress >= 75 ? ' is-hot' : ''}`}>
            <div className="sh-drill-top">
              <span className="sh-drill-name">{d.name}</span>
              <span className="sh-drill-pct">{d.progress}%</span>
            </div>
            <div className="sh-drill-desc">{d.detail}</div>
            <div className="sh-track">
              <div className="sh-track-fill" style={{ width: `${d.progress}%` }} />
            </div>
            <div className="sh-drill-reps">{d.reps}</div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

export function FilmStudy({ film }) {
  const watched = film.clips.filter((c) => c.status === 'complete').length;
  return (
    <SectionCard
      tag="Film Room · Assigned by Coach"
      title={film.title}
      meta={`${watched} / ${film.clips.length} watched`}
      testId="sh-section-film"
    >
      <div className="sh-film">
        {film.clips.map((c) => {
          const s = STATUS_META[c.status] || STATUS_META.assigned;
          return (
            <div key={c.title} className="sh-clip">
              <div className="sh-clip-play" aria-hidden="true">▶</div>
              <div className="sh-clip-body">
                <div className="sh-clip-title">{c.title}</div>
                <div className="sh-clip-meta">{c.concept} · {c.duration}{c.notes ? ` · ${c.notes} coach note${c.notes > 1 ? 's' : ''}` : ''}</div>
              </div>
              <span className={`sh-clip-status ${s.cls}`}>{s.label}</span>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
