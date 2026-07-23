import { classify } from '../lib/bp.js'
import { focusTips, CATEGORY_BANNER, TONE_HEX } from '../lib/tips.js'

// Contextual "For today's reading" card — banner + 3 focus tips tuned to the
// current category. Accent is the semantic status color for the reading.
export default function InsightCard({ systolic, diastolic, onSeeAll }) {
  const { tone } = classify(systolic, diastolic)
  const hex = TONE_HEX[tone] ?? TONE_HEX.normal
  const tips = focusTips(tone)

  return (
    <section
      className="rounded-2xl px-5 py-5"
      style={{ border: `1.5px solid ${hex}`, background: `${hex}14` }}
      aria-label="Guidance for today's reading"
    >
      <div className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ background: hex, boxShadow: `0 0 10px ${hex}` }}
          aria-hidden="true"
        />
        <span
          className="font-display text-sm tracking-wide"
          style={{ color: hex }}
        >
          FOR TODAY’S READING
        </span>
      </div>

      <p className="mt-2 leading-snug text-white/85">{CATEGORY_BANNER[tone]}</p>

      <ul className="mt-3 divide-y divide-white/10">
        {tips.map((t, i) => (
          <li key={i} className="py-3">
            <p className="font-semibold leading-snug text-white">{t.text}</p>
            <p className="mt-0.5 text-sm leading-snug text-white/50">{t.why}</p>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onSeeAll}
        className="mt-1 w-full py-1 text-center font-display text-lg tracking-wide text-bbf-gold"
      >
        See all tips &amp; guidance →
      </button>
    </section>
  )
}
