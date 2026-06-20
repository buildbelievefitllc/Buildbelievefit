// src/components/vault/coachNarrative.js
// ─────────────────────────────────────────────────────────────────────────────
// Pure composers that turn a section's cue data into a single spoken SOURCE string
// for the voice coach (bbf-biokinetic-briefing renders it naturally in-locale).
// Kept dumb on purpose: join the authored guidance; the server handles phrasing +
// translation + verbalizing ratings ("6/10" → "six out of ten").

// Recovery / any { breathing, form, intensity } cue object.
export function cueToText(cue) {
  if (!cue || typeof cue !== 'object') return '';
  return [cue.breathing, cue.form, cue.intensity]
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .join(' ');
}

// Prehab matrix drill { name, focus, reason, duration }.
export function drillToText(drill) {
  if (!drill || typeof drill !== 'object') return '';
  const parts = [drill.name, drill.focus, drill.reason]
    .map((s) => String(s || '').trim())
    .filter(Boolean);
  return parts.join('. ');
}
