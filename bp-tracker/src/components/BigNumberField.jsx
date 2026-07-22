import { useRef } from 'react'

// A massive, ergonomic numeric field: giant tappable number in the middle,
// full-height − / + steppers on each side. Designed for large targets and
// one-thumb use on a Galaxy Flip.
export default function BigNumberField({
  label,
  unit = 'mmHg',
  value,
  onChange,
  clamp,
  accent = 'purple', // 'purple' (systolic) | 'gold' (diastolic)
}) {
  const inputRef = useRef(null)
  const holdTimer = useRef(null)

  const step = (delta) => onChange(clamp(Number(value || 0) + delta))

  // Press-and-hold to repeat, so reaching 150 doesn't take 50 taps.
  const startHold = (delta) => {
    step(delta)
    let speed = 260
    const tick = () => {
      step(delta)
      speed = Math.max(60, speed - 25)
      holdTimer.current = setTimeout(tick, speed)
    }
    holdTimer.current = setTimeout(tick, 380)
  }
  const stopHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current)
    holdTimer.current = null
  }

  const ring = accent === 'gold' ? 'ring-bbf-gold/70' : 'ring-bbf-purple/70'
  const glow =
    accent === 'gold'
      ? 'text-bbf-gold drop-shadow-[0_0_18px_rgba(245,200,0,0.25)]'
      : 'text-white drop-shadow-[0_0_18px_rgba(106,13,173,0.45)]'
  const btn =
    accent === 'gold'
      ? 'bg-bbf-gold/15 text-bbf-gold active:bg-bbf-gold/30'
      : 'bg-bbf-purple/25 text-white active:bg-bbf-purple/45'

  return (
    <section
      className={`rounded-3xl bg-bbf-ink/90 ring-1 ${ring} px-3 py-4 shadow-lg`}
      aria-label={label}
    >
      <div className="flex items-center justify-between px-2">
        <h2 className="font-display text-2xl tracking-wide text-white/70">
          {label}
        </h2>
        <span className="text-sm font-semibold uppercase text-white/40">
          {unit}
        </span>
      </div>

      <div className="mt-1 flex items-stretch gap-3">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onPointerDown={() => startHold(-1)}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onPointerCancel={stopHold}
          className={`flex w-20 shrink-0 items-center justify-center rounded-2xl text-5xl font-bold select-none ${btn}`}
        >
          −
        </button>

        <input
          ref={inputRef}
          type="number"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value ?? ''}
          onChange={(e) => {
            const raw = e.target.value.replace(/\D/g, '')
            onChange(raw === '' ? '' : clamp(Number(raw)))
          }}
          onFocus={(e) => e.target.select()}
          aria-label={`${label} value`}
          className={`min-w-0 flex-1 bg-transparent text-center font-display tabular-nums leading-none outline-none ${glow}`}
          style={{ fontSize: 'clamp(4.5rem, 26vw, 9rem)' }}
        />

        <button
          type="button"
          aria-label={`Increase ${label}`}
          onPointerDown={() => startHold(1)}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onPointerCancel={stopHold}
          className={`flex w-20 shrink-0 items-center justify-center rounded-2xl text-5xl font-bold select-none ${btn}`}
        >
          +
        </button>
      </div>
    </section>
  )
}
