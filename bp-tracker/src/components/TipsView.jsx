import { classify } from '../lib/bp.js'
import { GUIDANCE_SECTIONS, CATEGORY_BANNER, TONE_HEX } from '../lib/tips.js'

// Full "Tips & Guidance" screen. A calm, scrollable library of steady habits,
// opened from the insight card. Shows her latest reading in context up top.
export default function TipsView({ systolic, diastolic, onBack }) {
  const { tone, label } = classify(systolic, diastolic)
  const hex = TONE_HEX[tone] ?? TONE_HEX.normal

  return (
    <div className="mx-auto max-w-md safe-pad px-4">
      <button
        type="button"
        onClick={onBack}
        className="mt-1 mb-4 inline-flex items-center gap-2 font-display tracking-wide text-white/55"
      >
        ← Back to reading
      </button>

      <h1 className="font-display text-4xl leading-none tracking-wide text-bbf-gold">
        Tips &amp; Guidance
      </h1>
      <p className="mt-2 leading-snug text-white/50">
        Small, steady habits that keep your pressure where you want it — and the
        reason each one works.
      </p>

      {/* Latest reading in context */}
      <div
        className="mt-5 rounded-2xl px-5 py-4"
        style={{ border: `1.5px solid ${hex}`, background: `${hex}14` }}
      >
        <p
          className="font-display text-sm tracking-wide"
          style={{ color: hex }}
        >
          YOUR LATEST: {systolic}/{diastolic} · {label}
        </p>
        <p className="mt-1 leading-snug text-white/85">{CATEGORY_BANNER[tone]}</p>
      </div>

      {/* Guidance sections */}
      <div className="mt-5 flex flex-col gap-4">
        {GUIDANCE_SECTIONS.map((section) => (
          <section
            key={section.title}
            className="rounded-2xl px-5 py-5"
            style={
              section.danger
                ? { border: '1.5px solid #f87171', background: 'rgba(248,113,113,0.06)' }
                : { border: '1px solid rgba(255,255,255,0.08)', background: '#120f16' }
            }
          >
            <div className="flex items-center gap-2.5">
              <span className="text-2xl" aria-hidden="true">
                {section.icon}
              </span>
              <h2
                className="font-display text-xl tracking-wide"
                style={section.danger ? { color: '#fca5a5' } : undefined}
              >
                {section.title}
              </h2>
            </div>
            <div className="mt-3 flex flex-col gap-3">
              {section.items.map((it, i) => (
                <div key={i}>
                  <p className="font-semibold leading-snug text-white">{it.text}</p>
                  <p className="mt-0.5 text-sm leading-snug text-white/50">
                    {it.why}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-6 mb-4 text-center text-xs leading-relaxed text-white/30">
        General guidance based on AHA recommendations — not a substitute for your
        doctor’s advice.
      </p>
    </div>
  )
}
