import { CRISIS_SYSTOLIC, CRISIS_DIASTOLIC } from '../lib/bp.js'

// Prominent, unmissable safety card shown when a reading is in the
// hypertensive-crisis range (systolic > 180 or diastolic > 120).
export default function CrisisAlert() {
  return (
    <div
      role="alert"
      className="rounded-3xl bg-crisis px-5 py-5 text-white shadow-2xl ring-4 ring-white/20 animate-[pulse_2s_ease-in-out_infinite]"
    >
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="text-4xl">
          ⚠️
        </span>
        <h2 className="font-display text-3xl tracking-wide">
          Reading is very high
        </h2>
      </div>
      <p className="mt-3 text-lg font-semibold leading-snug">
        This reading is above {CRISIS_SYSTOLIC}/{CRISIS_DIASTOLIC}. Please:
      </p>
      <ol className="mt-2 space-y-1.5 text-lg leading-snug">
        <li>
          1. Rest quietly and <strong>re-test in 5 minutes.</strong>
        </li>
        <li>
          2. If it is still this high, <strong>call your physician or care
          team.</strong>
        </li>
        <li>
          3. If you feel chest pain, trouble breathing, weakness, or trouble
          speaking, <strong>call 911 now.</strong>
        </li>
      </ol>
      <p className="mt-3 text-sm text-white/80">
        This app does not provide medical advice. When in doubt, contact your
        care team.
      </p>
    </div>
  )
}
