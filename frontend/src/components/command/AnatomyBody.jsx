// src/components/command/AnatomyBody.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Coach Lab · Anatomy Arena — the REGIONAL ZOOM canvas.
//
// Renders one training-split lane (push / pull / legs) on its own tuned viewBox
// so the muscles fill the frame. Every muscle is a <g role="button"> wrapping one
// or two distinct, non-overlapping vector <path>s — the silhouette behind is
// pointer-events:none, so a tap registers on EXACTLY the muscle path clicked
// (no bounding-box bleed between neighbors).
//
// State (BBF signature palette, driven by CSS):
//   • idle            — deep gray fill.
//   • hover / focus   — gold outline hint.
//   • is-correct      — the player nailed it → snaps to BBF Purple.
//   • is-reveal       — the answer after a miss/timeout → flashes BBF Gold.
//   • is-wrong        — the muscle the player tapped by mistake → red.
// On reveal the correct muscle also gets a crisp Barlow Condensed on-body label.

export default function AnatomyBody({ lane, onPick, disabled, reveal }) {
  if (!lane) return null;
  return (
    <svg viewBox={lane.viewBox} className="kl-anat-svg" role="group" aria-label={`${lane.id} muscle map`}>
      <g className="kl-anat-body" aria-hidden="true">
        {lane.head ? <circle cx={lane.head.cx} cy={lane.head.cy} r={lane.head.r} /> : null}
        {lane.silhouette.map((d, i) => <path key={i} d={d} />)}
      </g>

      {lane.muscles.map((m) => {
        let state = '';
        if (reveal) {
          if (m.id === reveal.correctId) state = reveal.pickedId === reveal.correctId ? ' is-correct' : ' is-reveal';
          else if (m.id === reveal.pickedId) state = ' is-wrong';
          else state = ' is-dim';
        }
        return (
          <g
            key={m.id}
            className={`kl-anat-region${state}`}
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-label={m.name}
            data-testid={`kl-anat-${m.id}`}
            onClick={() => { if (!disabled) onPick(m.id); }}
            onKeyDown={(e) => {
              if (disabled) return;
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(m.id); }
            }}
          >
            {m.paths.map((d, i) => <path key={i} className="kl-anat-path" d={d} />)}
            {reveal && m.id === reveal.correctId ? (
              <text className="kl-anat-lbl" x={m.l[0]} y={m.l[1]} textAnchor="middle">{m.name.toUpperCase()}</text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
