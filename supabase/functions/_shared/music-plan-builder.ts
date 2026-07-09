// supabase/functions/_shared/music-plan-builder.ts
// ═══════════════════════════════════════════════════════════════════════════════
// MUSIC PLAN BUILDER — deterministic (ZERO-LLM) mapper from a workout session's
// work/rest timeline onto an ElevenLabs Music v2 composition plan (/v1/music).
//
// Doctrine (blueprint §2.4):
//   · INSTRUMENTAL ALWAYS — the Akeem voice layer owns every word; the
//     negative_global_styles contract forbids vocals/lyrics.
//   · Section boundaries land EXACTLY on work/rest seams so the client's duck
//     envelope and the music's own energy curve agree without DSP trickery.
//   · Style vocabulary is a fixed curated table keyed by session category ×
//     readiness zone — no LLM anywhere in the music path (Zero-API-Bloat).
//   · API limits respected: 3s–120s per section, ≤10 min total. Longer sessions
//     get ONE looped work/rest super-cycle (loopable=true) — cost stays flat.
//
// The plan is also the CACHE KEY input: planSignature() hashes only the session
// SHAPE (never identity), so one generated bed amortizes across every athlete
// on the same session archetype.
// ═══════════════════════════════════════════════════════════════════════════════

export interface SessionBlock {
  kind: 'warmup' | 'work' | 'rest' | 'cooldown';
  duration_ms: number;
}
export type SessionCategory = 'strength' | 'hypertrophy' | 'cardio' | 'recovery';
export type ReadinessZone = 'green' | 'yellow' | 'red';

const SECTION_MIN_MS = 3_000;
const SECTION_MAX_MS = 120_000;
const TRACK_MIN_MS = 3_000;
const TRACK_MAX_MS = 600_000; // the /v1/music 10-minute ceiling

// ── Curated style table (category × zone) — the whole musical vocabulary ──────
const GLOBAL_STYLES: Record<SessionCategory, Record<ReadinessZone, string[]>> = {
  strength: {
    green:  ['cinematic hip-hop', 'driving percussion', 'warm analog bass', 'motivational', 'instrumental', '92 BPM'],
    yellow: ['cinematic hip-hop', 'steady percussion', 'warm analog bass', 'focused', 'instrumental', '88 BPM'],
    red:    ['downtempo hip-hop', 'soft percussion', 'warm pads', 'grounded', 'instrumental', '80 BPM'],
  },
  hypertrophy: {
    green:  ['electronic trap', 'punchy drums', 'deep sub bass', 'relentless energy', 'instrumental', '96 BPM'],
    yellow: ['electronic trap', 'steady drums', 'deep bass', 'controlled energy', 'instrumental', '90 BPM'],
    red:    ['lo-fi trap', 'muted drums', 'warm bass', 'measured', 'instrumental', '82 BPM'],
  },
  cardio: {
    green:  ['driving house', 'four-on-the-floor kick', 'uplifting synth stabs', 'forward momentum', 'instrumental', '124 BPM'],
    yellow: ['deep house', 'steady kick', 'warm synth chords', 'sustained pace', 'instrumental', '118 BPM'],
    red:    ['downtempo electronica', 'soft kick', 'airy pads', 'easy pace', 'instrumental', '104 BPM'],
  },
  recovery: {
    green:  ['ambient', 'warm pads', 'slow evolving textures', 'calm', 'instrumental', '70 BPM'],
    yellow: ['ambient', 'soft piano', 'slow evolving textures', 'restorative', 'instrumental', '66 BPM'],
    red:    ['ambient drone', 'deep pads', 'breath-slow textures', 'therapeutic', 'instrumental', '60 BPM'],
  },
};
// Instrumental contract — a lyric bed would fight the narration and the brand.
const NEGATIVE_GLOBAL = ['vocals', 'lyrics', 'singing', 'EDM drops', 'lo-fi hiss', 'abrupt endings'];

const LOCAL_STYLES: Record<SessionBlock['kind'], { pos: string[]; neg: string[] }> = {
  warmup:   { pos: ['sparse', 'building', 'filtered drums'],                neg: ['full drop'] },
  work:     { pos: ['full groove', 'assertive drums', 'forward energy'],    neg: [] },
  rest:     { pos: ['stripped back', 'airy', 'heartbeat kick', 'breathing room'], neg: ['dense percussion'] },
  cooldown: { pos: ['winding down', 'warm pads', 'resolving'],              neg: ['new energy'] },
};

const clampMs = (ms: number) => Math.max(SECTION_MIN_MS, Math.min(SECTION_MAX_MS, Math.round(ms)));

// Split one block into API-legal sections (each 3s–120s), boundaries preserved.
function sectionsForBlock(block: SessionBlock, idx: number): Array<Record<string, unknown>> {
  const { pos, neg } = LOCAL_STYLES[block.kind];
  const total = Math.max(SECTION_MIN_MS, Math.round(block.duration_ms));
  const parts = Math.max(1, Math.ceil(total / SECTION_MAX_MS));
  const per = Math.round(total / parts);
  const out: Array<Record<string, unknown>> = [];
  for (let p = 0; p < parts; p += 1) {
    out.push({
      section_name: `${block.kind}_${idx}${parts > 1 ? `_${p + 1}` : ''}`,
      duration_ms: clampMs(p === parts - 1 ? total - per * (parts - 1) : per),
      positive_local_styles: pos,
      negative_local_styles: neg,
      lines: [], // instrumental — no lyric lines, ever
    });
  }
  return out;
}

export interface MusicPlan {
  music_length_ms: number;
  composition_plan: {
    positive_global_styles: string[];
    negative_global_styles: string[];
    sections: Array<Record<string, unknown>>;
  };
  loopable: boolean; // true → client loops the bed with a crossfade (session > 10 min)
}

// Build the /v1/music payload for a session timeline. Sessions over the API's
// 10-minute ceiling collapse to ONE representative work/rest super-cycle
// (warmup + the longest work/rest pair) marked loopable.
export function buildMusicPlan(
  blocks: SessionBlock[],
  category: SessionCategory,
  zone: ReadinessZone,
): MusicPlan {
  const safe = (Array.isArray(blocks) ? blocks : []).filter((b) => b && b.duration_ms > 0);
  const total = safe.reduce((a, b) => a + b.duration_ms, 0);
  let planBlocks = safe;
  let loopable = false;

  if (!safe.length) {
    planBlocks = [{ kind: 'work', duration_ms: 60_000 }];
  } else if (total > TRACK_MAX_MS) {
    // Super-cycle: the longest work block + its following rest, looped client-side.
    let workIdx = -1;
    safe.forEach((b, i) => {
      if (b.kind === 'work' && (workIdx < 0 || b.duration_ms > safe[workIdx].duration_ms)) workIdx = i;
    });
    const work = workIdx >= 0 ? safe[workIdx] : { kind: 'work' as const, duration_ms: 90_000 };
    const rest = (workIdx >= 0 && safe[workIdx + 1]?.kind === 'rest')
      ? safe[workIdx + 1] : { kind: 'rest' as const, duration_ms: 60_000 };
    planBlocks = [
      { kind: 'warmup', duration_ms: 30_000 },
      { kind: 'work', duration_ms: Math.min(work.duration_ms, SECTION_MAX_MS) },
      { kind: 'rest', duration_ms: Math.min(rest.duration_ms, SECTION_MAX_MS) },
      { kind: 'work', duration_ms: Math.min(work.duration_ms, SECTION_MAX_MS) },
      { kind: 'rest', duration_ms: Math.min(rest.duration_ms, SECTION_MAX_MS) },
    ];
    loopable = true;
  }

  const sections = planBlocks.flatMap((b, i) => sectionsForBlock(b, i + 1));
  const length = Math.max(TRACK_MIN_MS, Math.min(TRACK_MAX_MS,
    sections.reduce((a, s) => a + Number(s.duration_ms), 0)));

  return {
    music_length_ms: length,
    composition_plan: {
      positive_global_styles: GLOBAL_STYLES[category]?.[zone] ?? GLOBAL_STYLES.strength.yellow,
      negative_global_styles: NEGATIVE_GLOBAL,
      sections,
    },
    loopable,
  };
}

// Cache key over the session SHAPE only (block kinds + 5s-quantized durations +
// category + zone) — NEVER identity, so beds amortize across the whole roster.
export function planShapeString(
  blocks: SessionBlock[],
  category: SessionCategory,
  zone: ReadinessZone,
): string {
  const shape = (Array.isArray(blocks) ? blocks : [])
    .map((b) => `${b.kind}:${Math.round(b.duration_ms / 5_000) * 5}`)
    .join('|');
  return `v1|${category}|${zone}|${shape}`;
}

// Readiness score (0-100) → musical energy zone.
export function readinessZone(score: number | null | undefined): ReadinessZone {
  const n = Number(score);
  if (!Number.isFinite(n)) return 'yellow';
  if (n >= 70) return 'green';
  if (n >= 45) return 'yellow';
  return 'red';
}
