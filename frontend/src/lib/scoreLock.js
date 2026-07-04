// src/lib/scoreLock.js
// ─────────────────────────────────────────────────────────────────────────────
// SCORE LOCK — client mirror of the bbf-sovereign-briefing engine's
// lockScoreDigits (the 77-vs-80 fix, layer 2). One rule: today's readiness score
// is the ONLY 0–100 figure a briefing script may voice. Any other standalone
// digit-form integer on the 0–100 scale is rewritten to the true score; calendar
// counters ("Day 34", "día 34", "30 days/días/dias") are exempt. Keep this in
// exact lockstep with the Deno implementation in
// supabase/functions/bbf-sovereign-briefing/index.ts.

export function lockScoreDigits(script, score) {
  const s = Math.round(Number(score));
  if (!Number.isFinite(s)) return String(script || '');
  return String(script || '').replace(
    /(\b(?:day|d[ií]a)\s+)?(\b(?:out\s+of|de|sobre|em)\s+)?\b(\d{1,3})\b(\s*(?:days?|d[ií]as?))?(\s*(?:%|percent|por\s+ciento|por\s+cento))?/gi,
    (full, dayBefore, denomBefore, digits, dayAfter, pctAfter) => {
      if (dayBefore || dayAfter) return full;                 // calendar context — leave it
      if (pctAfter) return full;                              // effort %, not a score
      const n = Number(digits);
      if (denomBefore && n === 100) return full;              // the scale itself ("out of 100" / "de 100")
      if (!Number.isFinite(n) || n < 0 || n > 100) return full;
      if (n === s) return full;
      return full.replace(digits, String(s));
    },
  );
}
