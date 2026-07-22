// Blood-pressure domain helpers — pure functions, no UI, easy to reason about.

// Hypertensive crisis threshold (ACC/AHA). At or above this, medical guidance
// is to re-check and seek care — the app surfaces a prominent alert.
export const CRISIS_SYSTOLIC = 180
export const CRISIS_DIASTOLIC = 120

export function isCrisis(systolic, diastolic) {
  return Number(systolic) > CRISIS_SYSTOLIC || Number(diastolic) > CRISIS_DIASTOLIC
}

// Auto-detect the reading window from the local clock. Before 12:00 → morning,
// otherwise → evening. The user can always override with the toggle.
export function detectTimeOfDay(date = new Date()) {
  return date.getHours() < 12 ? 'morning' : 'evening'
}

// ACC/AHA category for gentle, non-alarming context under the numbers.
// Returns { label, tone } where tone ∈ normal | elevated | stage1 | stage2 | crisis.
export function classify(systolic, diastolic) {
  const s = Number(systolic)
  const d = Number(diastolic)
  if (!s || !d) return { label: '', tone: 'normal' }
  if (s > CRISIS_SYSTOLIC || d > CRISIS_DIASTOLIC)
    return { label: 'Very high', tone: 'crisis' }
  if (s >= 140 || d >= 90) return { label: 'High (Stage 2)', tone: 'stage2' }
  if (s >= 130 || d >= 80) return { label: 'High (Stage 1)', tone: 'stage1' }
  if (s >= 120) return { label: 'Elevated', tone: 'elevated' }
  return { label: 'In range', tone: 'normal' }
}

// Clamp a value into a sane, physiologically-plausible input range.
export function clampSystolic(v) {
  return Math.max(60, Math.min(260, Math.round(v)))
}
export function clampDiastolic(v) {
  return Math.max(40, Math.min(180, Math.round(v)))
}

export function formatDateTime(iso) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}
