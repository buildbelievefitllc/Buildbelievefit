// Two big segmented buttons. Auto-set on load, one tap to override.
const OPTIONS = [
  { key: 'morning', label: 'Morning', icon: '☀️' },
  { key: 'evening', label: 'Evening', icon: '🌙' },
]

export default function TimeOfDayToggle({ value, onChange }) {
  return (
    <div
      role="radiogroup"
      aria-label="Time of day"
      className="grid grid-cols-2 gap-3"
    >
      {OPTIONS.map((opt) => {
        const active = value === opt.key
        return (
          <button
            key={opt.key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.key)}
            className={
              'flex items-center justify-center gap-2 rounded-2xl py-4 font-display text-2xl tracking-wide transition ' +
              (active
                ? 'bg-bbf-purple text-white ring-2 ring-bbf-gold shadow-lg'
                : 'bg-bbf-ink/80 text-white/50 ring-1 ring-white/10')
            }
          >
            <span aria-hidden="true" className="text-xl">
              {opt.icon}
            </span>
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
