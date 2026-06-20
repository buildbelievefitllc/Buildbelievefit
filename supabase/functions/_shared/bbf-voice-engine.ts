// supabase/functions/_shared/bbf-voice-engine.ts
// ═══════════════════════════════════════════════════════════════════════════════
// BBF LAB VOICE ENGINE — the single source of truth for the BBF Coach Akeem
// Professional Voice Clone (custom 30-min PVC). Every audio edge function routes its
// text through this so the vocal DNA + the four Dynamic Vocal States stay identical
// everywhere. (Mirrors the model-router doctrine in CLAUDE.md §4 — one file owns the
// voice physics; callers NEVER inline raw voice_settings or guess a model.)
//
// Because edge functions are single-file MCP bundles, callers may INLINE an exact
// copy of these constants/helpers (see bbf-biokinetic-briefing) — this file is the
// canonical definition they mirror, and the home for all future audio functions.
// ═══════════════════════════════════════════════════════════════════════════════

// ── PART 1 · VOCAL DNA (system context) ─────────────────────────────────────────
// Prepend to the system prompt of every Claude script-writer so the WORDS match the
// voice: African soulful, naturally rhythmic; a seasoned trainer, a father who gets
// chaotic schedules, a mentor shattering the "box mentality."
export const VOICE_DNA = [
  'You are scripting for the BBF Coach Akeem voice — an African, soulful, naturally',
  'rhythmic delivery. A seasoned professional trainer; a father who understands chaotic',
  'schedules; a mentor dedicated to shattering the "box mentality." Pitch is mid-to-deep',
  'with chest resonance, grounded and warm. Tempo is deliberate, unhurried, with a',
  'rhythmic "pocket." The vibe is authentic, raw, empathetic — real aura, never corporate.',
  'Write the way this man actually talks, so the words carry that cadence on their own.',
].join(' ');

// ── PART 2 · API PHYSICS (exact payload — never ElevenLabs defaults) ─────────────
// stability 0.35 removes the "robotic governor" so the rhythmic/soulful fluctuations
// from the 30-min training data emerge; similarity 0.85 locks to Akeem's acoustic
// cords; style 0.15 amplifies the intended emotion; speaker_boost on. NO `speed` —
// tempo is shaped by SSML <break> + punctuation (Part 3), not by time-stretch
// (which reintroduces the uncanny pitch artifact).
export const BBF_VOICE_SETTINGS = {
  stability: 0.35,
  similarity_boost: 0.85,
  style: 0.15,
  use_speaker_boost: true,
} as const;

// The clone's prosody carries most naturally on multilingual_v2. Floor Coach (active,
// in-ear) trades a little richness for turbo's low latency.
export const BBF_VOICE_MODEL = 'eleven_multilingual_v2';
export const BBF_VOICE_MODEL_LOWLATENCY = 'eleven_turbo_v2_5';

// ── PART 3 · DYNAMIC VOCAL STATES ────────────────────────────────────────────────
export type VocalState = 'floor_coach' | 'lounge_talk' | 'sanctuary' | 'architect';

// Map an app context/feature key to its vocal state.
//   floor_coach  → active training / Smart Cardio (energized, sharp, technical)
//   lounge_talk  → Smart Macro Wheel / nutrition (relaxed, conversational real-talk)
//   sanctuary    → recovery / morning mobility / prehab (deepest, slow, therapeutic)
//   architect    → onboarding / weekly briefs / forecasts / affirmation / philosophy
export function vocalStateForContext(context: string): VocalState {
  switch (String(context || '').toLowerCase()) {
    case 'program':
    case 'cardio':
    case 'floor_coach':
    case 'virtual_coach':
    case 'phantom_eye':
      return 'floor_coach';
    case 'nutrition':
    case 'lounge':
    case 'lounge_talk':
    case 'nutrition_vision':
    case 'virtual_chef':
      return 'lounge_talk';
    case 'recovery':
    case 'prehab':
    case 'mobility':
    case 'sanctuary':
      return 'sanctuary';
    case 'forecast':
    case 'affirmation':
    case 'onboarding':
    case 'weekly_brief':
    case 'philosophy':
    case 'architect':
    default:
      return 'architect';
  }
}

// The richest-prosody model unless the state is latency-critical (Floor Coach in-ear).
export function modelForState(state: VocalState): string {
  return state === 'floor_coach' ? BBF_VOICE_MODEL_LOWLATENCY : BBF_VOICE_MODEL;
}

// ── Exercise override (Audio Matrix · Part 1) ────────────────────────────────────
// The 30-min training matrix recorded its most commanding "heavy-lift" cues on barbell
// back squat — a movement now RETIRED from the active library. Map that high-intensity
// vocal profile onto the LATERAL PULL-DOWN + corresponding upper-body pulling/pressing
// mechanics so the clone still delivers those cues with full heavy-lift authority.
const HEAVY_LIFT_RE = /(pull[\s-]?down|lat\s*pull|pull[\s-]?up|chin[\s-]?up|seated\s*row|bent[\s-]?over\s*row|overhead\s*press|shoulder\s*press|bench\s*press)/i;
export function isHeavyLiftMovement(exerciseName: string): boolean {
  return HEAVY_LIFT_RE.test(String(exerciseName || ''));
}
export function heavyLiftDirective(): string {
  return [
    '# HEAVY-LIFT OVERRIDE',
    'This movement inherits the commanding, authoritative HEAVY-LIFT vocal profile (the one',
    'originally trained on the retired barbell back squat). Deliver the cue with maximum',
    'grounded intensity and command — treat it like a heavy, decisive top-set call.',
  ].join('\n');
}

// System-prompt block telling the Claude script-writer how to FORMAT the text for the
// state (so stability 0.35 reacts to the punctuation/SSML the way we want).
export function vocalStateDirective(state: VocalState): string {
  switch (state) {
    case 'floor_coach':
      return [
        '# VOCAL STATE: THE FLOOR COACH (active training)',
        'Energized, sharp, technical. Short, punchy sentences. Hit the consonants hard.',
        'Drive the rep. No long meandering clauses — keep it tight and immediate.',
        'No exclamation marks (they spike volume artificially); land the energy through',
        'short declaratives and hard stops (periods).',
      ].join('\n');
    case 'lounge_talk':
      return [
        '# VOCAL STATE: THE LOUNGE TALK (nutrition / real talk)',
        'Relaxed, conversational, "real talk." Use natural contractions (you\'re, it\'s,',
        "we're, that's). Speak like you're sitting across the table, unhurried and warm.",
        'No exclamation marks; let the warmth come from the conversational rhythm.',
      ].join('\n');
    case 'sanctuary':
      return [
        '# VOCAL STATE: THE SANCTUARY (recovery / mobility)',
        'Deepest pitch, extremely slow, therapeutic — you are lowering their cortisol.',
        'You MUST inject heavy explicit pauses so the delivery lingers and drives down',
        'cortisol. Place an SSML break tag between major thoughts: `<break time="2.0s"/>` for',
        'a normal pause, up to `<break time="3.0s"/>` for the biggest transitions. Use 3–6',
        'breaks total across the cue. Short, calm sentences between the breaks. No exclamation marks.',
      ].join('\n');
    case 'architect':
    default:
      return [
        '# VOCAL STATE: THE ARCHITECT (weekly briefs / onboarding / philosophy)',
        'Resonant storytelling cadence, building in intensity, passionate. STRICTLY enforce the',
        'exclamation-guard: NO exclamation marks — they spike volume artificially. Achieve emphasis',
        'EXCLUSIVELY by isolating power words with ellipses (...) and commas to slow the tempo.',
        'Example: "You have to bring that... Mamba mentality." Let the cadence build; end on a',
        'grounded, deliberate line.',
      ].join('\n');
  }
}

// Post-process a finished script for its state before synthesis. Enforces the rules
// that must hold regardless of what the writer produced:
//   • Architect / Floor / Lounge  → strip exclamation marks (volume-spike guard).
//   • Sanctuary                    → guarantee <break> pauses exist (inject at sentence
//                                     boundaries if the writer omitted them); cap break
//                                     length at 2.5s; never strip the breaks.
// Always normalizes stray whitespace WITHOUT collapsing the <break/> tags.
export function formatForState(text: string, state: VocalState): string {
  let out = String(text ?? '').trim();
  if (!out) return out;

  if (state === 'sanctuary') {
    // Clamp any oversized break the writer invented (>3.0s → 3.0s; ElevenLabs caps ~3s).
    out = out.replace(/<break\s+time="(\d+(?:\.\d+)?)s"\s*\/>/gi, (_m, s) => {
      const t = Math.min(3.0, Math.max(0.3, Number(s) || 2.0));
      return `<break time="${t}s"/>`;
    });
    // If the writer produced NO breaks, inject a 2.0s pause after each sentence-ending
    // punctuation so the cue still breathes and lingers.
    if (!/<break\s/i.test(out)) {
      out = out.replace(/([.?])\s+(?=[A-Z0-9"'¿¡])/g, '$1 <break time="2.0s"/> ');
    }
    out = out.replace(/[ \t]{2,}/g, ' ');
    return out;
  }

  // Floor / Lounge / Architect: exclamation marks spike volume — convert to a period.
  out = out.replace(/!+/g, '.');
  out = out.replace(/[ \t]{2,}/g, ' ');
  return out;
}
