// src/components/studio/StudioTimelineVisualizer.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 3.3 — the compiled-timeline visualizer (CONTENT_STUDIO_V4 render spec).
//
// Renders ONE compiled job's timeline payload from bbf-studio-batch-compiler as a
// z-ordered Gantt: each overlay layer is a track whose bar maps its [start_ms,
// end_ms) window across the clip length, badged with its z_index. Text vs stat_badge
// layers are colour-coded; a stat badge shows its localized label + the FROZEN gram
// value exactly as the compiler formatted it (locale-grouped ' g' — never reformatted
// here, so the Gram Boundary is preserved end-to-end).
//
// @param {{ result?: import('./useStudioBatch.js').CompiledJob }} props

import { useStudioStr } from './studioStrings.js';
import './studio.css';

const TYPE_ACCENT = { text: '#6a0dad', stat_badge: '#f5c800' };
const TICKS = 4; // → 5 gridlines (0 … clip)

function pct(n) { return `${Math.max(0, Math.min(100, n))}%`; }

export default function StudioTimelineVisualizer({ result }) {
  const { ss, sourceLabels } = useStudioStr();

  if (!result) return <div className="st-tl-empty">{ss.emptyResults}</div>;

  if (result.status !== 'compiled' || !result.timeline) {
    const label = result.status === 'rejected' ? ss.statusRejected : ss.statusError;
    return (
      <div className="st-tl st-tl--bad">
        <div className="st-tl-badstatus">{label}</div>
        {result.reason ? <div className="st-tl-reason">{result.reason}</div> : null}
      </div>
    );
  }

  const tl = result.timeline;
  const clip = Math.max(1, Number(tl.clip_ms) || 1);
  // Highest z on top (compositing order) — a copy, server order is ascending.
  const layers = [...(tl.layers || [])].sort((a, b) => (b.z ?? 0) - (a.z ?? 0));
  const ladder = result.ladder || {};

  const tag = result.binding_override ? { cls: 'is-override', text: ss.overrideTag }
    : result.binding_demo ? { cls: 'is-demo', text: ss.demoTag }
      : { cls: 'is-real', text: ss.realTag };

  const typeName = (t) => (t === 'text' ? ss.typeText : t === 'stat_badge' ? ss.typeStat : ss.typeOther);

  return (
    <div className="st-tl" data-testid="studio-timeline">
      <header className="st-tl-head">
        <div className="st-tl-titlerow">
          <span className="st-tl-title">{ss.tlTitle}</span>
          <span className="st-status-chip is-ok">{ss.statusCompiled}</span>
        </div>
        <div className="st-tl-meta">
          <span className="st-meta-pill">{String(result.locale || tl.locale || '').toUpperCase()}</span>
          <span className={`st-meta-pill ${tag.cls}`}>{tag.text}</span>
          {ladder.w ? <span className="st-meta-pill">{ss.ladder}: {ladder.w}×{ladder.h}</span> : null}
          {result.lane ? <span className="st-meta-pill">{ss.laneLabel} {result.lane}</span> : null}
          <span className="st-meta-pill">{ss.clip}: {clip} {ss.msUnit}</span>
          <span className="st-meta-pill">{layers.length} {ss.layers}</span>
        </div>
      </header>

      {layers.length === 0 ? (
        <div className="st-tl-empty">{ss.noLayers}</div>
      ) : (
        <div className="st-gantt">
          {/* time ruler */}
          <div className="st-ruler" aria-hidden="true">
            <span className="st-ruler-gutter" />
            <div className="st-ruler-track">
              {Array.from({ length: TICKS + 1 }, (_, i) => (
                <span key={i} className="st-tick" style={{ left: pct((i / TICKS) * 100) }}>
                  {Math.round((clip * i) / TICKS)}
                </span>
              ))}
            </div>
          </div>

          {/* one track per layer */}
          {layers.map((l) => {
            const start = Number(l.start_ms) || 0;
            const end = Number(l.end_ms) || clip;
            const left = (start / clip) * 100;
            const width = ((end - start) / clip) * 100;
            const accent = TYPE_ACCENT[l.type] || '#8a7fa8';
            const stat = l.type === 'stat_badge';
            const primary = stat
              ? `${l.label || sourceLabels[l.binding_source] || l.binding_source || ss.typeStat}: ${l.value ?? '—'}`
              : (l.text || typeName(l.type));
            return (
              <div className="st-track" key={l.id}>
                <div className="st-track-gutter">
                  <span className="st-z-badge" style={{ borderColor: accent, color: accent }}>{ss.zLabel} {l.z}</span>
                  <span className="st-track-type" style={{ color: accent }}>{typeName(l.type)}</span>
                </div>
                <div className="st-track-lane">
                  {Array.from({ length: TICKS + 1 }, (_, i) => (
                    <span key={i} className="st-gridline" style={{ left: pct((i / TICKS) * 100) }} />
                  ))}
                  <div
                    className={`st-bar${stat ? ' is-stat' : ''}`}
                    style={{ left: pct(left), width: pct(width), background: accent }}
                    title={`z=${l.z} · ${start}–${end} ${ss.msUnit}`}
                  >
                    <span className="st-bar-label">{primary}</span>
                  </div>
                  <span className="st-bar-times" style={{ left: pct(left) }}>
                    {start}–{end} {ss.msUnit} · {ss.durLabel} {l.duration_ms ?? end - start}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
