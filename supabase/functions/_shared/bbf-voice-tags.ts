// supabase/functions/_shared/bbf-voice-tags.ts
// ═══════════════════════════════════════════════════════════════════════════════
// BBF VOICE-TAG RENDERING ENGINE — model-aware emotional markup for the Akeem clone.
//
// Audio tags ([laughs], [whispers], [excited], …) are an eleven_v3 RENDERING
// feature — flash/turbo/multilingual models read an unknown bracket aloud as text.
// This module is the ONLY place tag policy lives (mirrors the bbf-voice-engine
// doctrine: one file owns the physics, callers never guess):
//
//   · script-writers are told the allowed vocabulary (voiceTagDirective),
//   · sanitizeVoiceTags strips anything OFF the curated allow-list,
//   · renderForModel guarantees a tag never leaks into a model that would
//     read it aloud — while PRESERVING the delivery parameters the tag encodes
//     (emphasis CAPITALS survive; a stripped [whispers] leaves its ellipsis
//     cadence; a stripped [excited] keeps its short-declarative punch).
//
// Zero imports so it inlines cleanly into single-file edge-deploy bundles.
// ═══════════════════════════════════════════════════════════════════════════════

// Curated, brand-audited allow-list. Anything outside this set is stripped even
// on v3 — an un-audited tag must never reach the athlete's ears.
export const BBF_VOICE_TAGS = [
  'laughs', 'whispers', 'excited', 'sighs', 'exhales', 'curious', 'mischievously',
] as const;
export type VoiceTag = typeof BBF_VOICE_TAGS[number];

const TAG_RE = /\[([a-z][a-z ]{0,24})\]/gi;
const ALLOWED = new Set<string>(BBF_VOICE_TAGS);

// True only for the model families that actually PERFORM audio tags.
export function tagsSupported(modelId: string): boolean {
  return /^eleven_v3/i.test(String(modelId || '').trim());
}

// Strip tags NOT on the allow-list (keeps allowed ones verbatim).
export function sanitizeVoiceTags(text: string): string {
  return String(text ?? '').replace(TAG_RE, (full, name) =>
    ALLOWED.has(String(name).trim().toLowerCase()) ? full : '',
  ).replace(/[ \t]{2,}/g, ' ').trim();
}

// Remove ALL tags for models that would read them aloud, translating each tag
// into the punctuation-level delivery it encodes so the intended cadence
// survives synthesis on flash/turbo/multilingual (which respond to punctuation,
// not brackets — cf. BBF_VOICE_SETTINGS stability 0.35 in bbf-voice-engine.ts):
//   [whispers]/[sighs]/[exhales] → a lingering ellipsis pause
//   everything else              → removed clean (CAPITALS emphasis already
//                                   rides the text itself and is kept as-is)
const PAUSE_TAGS = new Set(['whispers', 'sighs', 'exhales']);
export function stripVoiceTags(text: string): string {
  return String(text ?? '').replace(TAG_RE, (_full, name) =>
    PAUSE_TAGS.has(String(name).trim().toLowerCase()) ? '... ' : '',
  ).replace(/[ \t]{2,}/g, ' ').trim();
}

// THE single entry point callers use before synthesis.
export function renderForModel(text: string, modelId: string): string {
  return tagsSupported(modelId) ? sanitizeVoiceTags(text) : stripVoiceTags(text);
}

// System-prompt block for Claude script-writers — slots beside the vocal-state
// directives from bbf-voice-engine.ts.
export function voiceTagDirective(): string {
  return [
    '# EMOTIONAL MARKUP (voice-tag vocabulary)',
    `You may use ONLY these bracketed delivery tags, sparingly (0-2 per segment): ${BBF_VOICE_TAGS.map((t) => `[${t}]`).join(' ')}.`,
    'Use CAPITALS to isolate at most one or two POWER words per segment for emphasis.',
    'Never invent other bracketed tags. Tags are stage directions — they are not spoken.',
  ].join('\n');
}
