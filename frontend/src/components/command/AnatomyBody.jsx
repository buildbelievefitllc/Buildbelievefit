// src/components/command/AnatomyBody.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Coach Lab · Kinesiology Lab — THE ANATOMY ARENA mannequin.
//
// A stylized front/back human figure on a 220×460 canvas. Each muscle group in
// `muscles` renders as one or two symmetric ellipses grouped into a tappable
// <g role="button"> target. The parent Arena drives the game; this component is
// pure presentation + hit-testing:
//   • disabled  — freeze taps during the reveal beat.
//   • reveal    — { pickedId, correctId }: paint the correct region gold-green
//                 and a wrong pick red so the miss is a teaching moment.
//   • onPick(id)— fires on click / Enter / Space for the tapped muscle.
//
// The silhouette is intentionally simple geometry (head circle, torso path,
// capsule limbs) so it reads as a body without shipping a heavy illustration.

function Silhouette({ view }) {
  // Same outline front & back; a faint centerline hints which side you're seeing.
  return (
    <g className="kl-anat-body" aria-hidden="true">
      <circle cx="110" cy="36" r="19" />
      <rect x="100" y="52" width="20" height="46" rx="8" />
      {/* torso: shoulders → waist → hips */}
      <path d="M66,96 L154,96 L148,150 L142,198 L148,240 Q110,256 72,240 L78,198 L72,150 Z" />
      {/* arms */}
      <rect x="48" y="104" width="18" height="140" rx="9" transform="rotate(4 57 174)" />
      <rect x="154" y="104" width="18" height="140" rx="9" transform="rotate(-4 163 174)" />
      {/* pelvis block bridging torso → legs */}
      <rect x="72" y="228" width="76" height="38" rx="15" />
      {/* legs */}
      <rect x="76" y="240" width="26" height="196" rx="13" transform="rotate(1.5 89 338)" />
      <rect x="118" y="240" width="26" height="196" rx="13" transform="rotate(-1.5 131 338)" />
      {/* orientation cue */}
      {view === 'front'
        ? <line x1="110" y1="100" x2="110" y2="236" className="kl-anat-mid" />
        : <line x1="110" y1="98" x2="110" y2="240" className="kl-anat-spine" />}
    </g>
  );
}

export default function AnatomyBody({ view, muscles, onPick, disabled, reveal }) {
  return (
    <svg
      viewBox="0 0 220 460"
      className="kl-anat-svg"
      role="group"
      aria-label={view === 'front' ? 'Front of the body' : 'Back of the body'}
    >
      <Silhouette view={view} />
      {muscles.map((m) => {
        let state = '';
        if (reveal) {
          if (m.id === reveal.correctId) state = ' is-correct';
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
            {m.shapes.map((s, i) => (
              <ellipse
                key={i}
                cx={s.cx}
                cy={s.cy}
                rx={s.rx}
                ry={s.ry}
                transform={s.rot ? `rotate(${s.rot} ${s.cx} ${s.cy})` : undefined}
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
}
