// ═══════════════════════════════════════════════════════════════════════════
// _shared/stitch-core.ts — the Zero-API audio-stitching brain (CARDIO blueprint §3)
// ───────────────────────────────────────────────────────────────────────────
// Pure deterministic functions: beat ranking (severity table), variant resolution
// (quantization → baked fragment keys), tone, the fixed grammar spine, and gapless
// playlist assembly. ZERO Claude, ZERO TTS — the router only SELECTS pre-baked keys.
// The brief-context composer and the stitch router share BriefPayload so both agree.
//
// GRAM STANDARD: the voice speaks the WHY (baked); the digits ride screen_facts —
// integer grams verbatim from the ledgers, never spoken approximately.
// ═══════════════════════════════════════════════════════════════════════════

export type Slot = 'S0' | 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6' | 'S7';
export type Tone = 'protective' | 'steady' | 'celebratory';

export interface BriefPayload {
  day: string;
  readiness: { state: string; score: number | null };
  cardio: {
    effective_tier: string; duration_min: number; mech_state: string; mech_ceiling_bound: boolean;
    caution_vector: boolean; hr_cap_bpm: number | null; talk_test: string | null;
    ee_kcal: number | null; rehydration_g: number | null;
  };
  workload: { spiking_vectors: Array<{ vector: string; acwr: number }> };
  prehab: { queued: Array<{ joint: string; priority: string }> };
  nutrition: { day_type: string; protein_g: number | null; carbs_g: number | null };
  recovery: { shadow_active: boolean; deep_debt: 'lower' | 'upper' | null };
  forecast: { heavy_day_soon: boolean; refeed_tomorrow: boolean; carb_window_open: boolean };
}

export interface Beat { slot: Slot; severity: number; variant_key: string; screen_fact_ids: string[]; }
export interface ScreenFact { id: string; label: string; value: string; }

// §3.3 slot order (the spine never changes) — playback order regardless of severity.
const SLOT_ORDER: Record<Slot, number> = { S0: 0, S1: 1, S2: 2, S3: 3, S4: 4, S5: 5, S6: 6, S7: 7 };
export const RULE_OF_THREE = 3;

const JOINT_TOKEN: Record<string, string> = { knee: 'KNEE', lower_back: 'LOWER_BACK', shoulder: 'SHOULDER', elbow: 'ELBOW', hamstring: 'HAMSTRING', ankle: 'ANKLE' };
function tierToken(t: string): 'ZONE2' | 'TEMPO' | 'HIIT' { return t === 'Zone 2' ? 'ZONE2' : t === 'HIIT' ? 'HIIT' : 'TEMPO'; }
function durationBucket(min: number): 'SHORT' | 'MID' | 'LONG' { return min < 20 ? 'SHORT' : min <= 35 ? 'MID' : 'LONG'; }

// ── Required slots (§3.2) ────────────────────────────────────────────────────
export function s0Variant(state: string): string {
  const map: Record<string, string> = { prime: 'S0_PRIME', standard: 'S0_STANDARD', strain: 'S0_STRAIN', breach: 'S0_BREACH' };
  return map[state] ?? 'S0_NEUTRAL';
}
export function s5Variant(effectiveTier: string, durationMinutes: number): string {
  return `S5_${tierToken(effectiveTier)}_${durationBucket(durationMinutes)}`;
}
export function s7Variant(tone: Tone): string {
  return tone === 'protective' ? 'S7_PROTECTIVE' : tone === 'celebratory' ? 'S7_CELEBRATORY' : 'S7_STEADY';
}

// The S1 cause, chosen deterministically from the strongest present signal.
function s1Cause(p: BriefPayload): string {
  const vecs = p.workload.spiking_vectors.map((v) => v.vector);
  if (vecs.includes('axial')) return 'AXIAL_SPIKE';
  if (vecs.includes('impact')) return 'IMPACT_SPIKE';
  if (p.recovery.shadow_active) return 'SHADOW_48H';
  if (p.recovery.deep_debt) return 'SYSTEMIC_DEBT';
  return 'MONOTONY';
}

// ── STEP 1 · beat ranking (deterministic severity table, §3.4) ───────────────
export function rankBeats(p: BriefPayload): Beat[] {
  const beats: Beat[] = [];
  // S1 · mechanical DANGER ceiling bound (90) — Zone-2-forced
  if (p.cardio.mech_state === 'danger' && p.cardio.mech_ceiling_bound) {
    beats.push({ slot: 'S1', severity: 90, variant_key: `S1_${s1Cause(p)}_ZONE2_FORCED`, screen_fact_ids: ['axial_spike'] });
  }
  // S2 · mandatory prehab queued (85)
  const mandatory = p.prehab.queued.find((q) => q.priority === 'mandatory');
  if (mandatory && JOINT_TOKEN[mandatory.joint]) {
    beats.push({ slot: 'S2', severity: 85, variant_key: `S2_${JOINT_TOKEN[mandatory.joint]}_MANDATORY`, screen_fact_ids: [] });
  }
  // S4 · recovery-forced nutrition day (80); other significant shifts at 55
  const dt = p.nutrition.day_type;
  if (dt === 'recovery_forced') beats.push({ slot: 'S4', severity: 80, variant_key: 'S4_RECOVERY_FORCED', screen_fact_ids: ['protein', 'carbs'] });
  else if (['refeed_eve', 'carb_load', 'post_heavy', 'taper'].includes(dt)) beats.push({ slot: 'S4', severity: 55, variant_key: `S4_${dt.toUpperCase()}`, screen_fact_ids: ['protein', 'carbs'] });
  // S3 · recovery shadow / deep debt (75)
  if (p.recovery.shadow_active) beats.push({ slot: 'S3', severity: 75, variant_key: 'S3_SHADOW_ACTIVE', screen_fact_ids: [] });
  else if (p.recovery.deep_debt) beats.push({ slot: 'S3', severity: 75, variant_key: p.recovery.deep_debt === 'lower' ? 'S3_DEEP_DEBT_LOWER' : 'S3_DEEP_DEBT_UPPER', screen_fact_ids: [] });
  // S6 · refeed / carb-load upcoming (60)
  if (p.forecast.heavy_day_soon) beats.push({ slot: 'S6', severity: 60, variant_key: 'S6_HEAVY_DAY_SOON', screen_fact_ids: [] });
  else if (p.forecast.refeed_tomorrow) beats.push({ slot: 'S6', severity: 60, variant_key: 'S6_REFEED_TOMORROW', screen_fact_ids: [] });
  else if (p.forecast.carb_window_open) beats.push({ slot: 'S6', severity: 60, variant_key: 'S6_CARB_WINDOW_OPEN', screen_fact_ids: ['carbs'] });
  // S1 · caution-zone vector, no ceiling bound (50) — Tempo-capped
  if (p.cardio.mech_state === 'caution' && p.cardio.caution_vector && !beats.some((b) => b.slot === 'S1')) {
    beats.push({ slot: 'S1', severity: 50, variant_key: `S1_${s1Cause(p)}_TEMPO_CAPPED`, screen_fact_ids: ['axial_spike'] });
  }
  return beats;
}

// STEP 1 (cont.) · take the top RULE_OF_THREE by severity, one per slot, then order
// by the grammar spine (severity picks WHICH; the spine picks WHERE).
export function selectBeats(all: Beat[]): Beat[] {
  const bySlot = new Map<Slot, Beat>();
  for (const b of all) { const cur = bySlot.get(b.slot); if (!cur || b.severity > cur.severity) bySlot.set(b.slot, b); }
  return [...bySlot.values()].sort((a, b) => b.severity - a.severity).slice(0, RULE_OF_THREE).sort((a, b) => SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot]);
}

// ── STEP 3 · tone resolution (§3.3) ──────────────────────────────────────────
export function resolveTone(p: BriefPayload, conditional: Beat[]): Tone {
  const mandatory = p.prehab.queued.some((q) => q.priority === 'mandatory');
  if (p.cardio.mech_state === 'danger' || mandatory) return 'protective';
  if (p.readiness.state === 'prime' && conditional.length === 0) return 'celebratory';
  return 'steady';
}

// ── The gram-precise visual channel (§3.7) ───────────────────────────────────
export function buildScreenFacts(p: BriefPayload): ScreenFact[] {
  const facts: ScreenFact[] = [];
  const readinessVal = p.readiness.score != null ? `${p.readiness.score} · ${cap(p.readiness.state)}` : cap(p.readiness.state);
  facts.push({ id: 'readiness', label: 'Readiness', value: readinessVal });
  const spike = p.workload.spiking_vectors[0];
  if (spike) facts.push({ id: 'axial_spike', label: `${cap(spike.vector.replace(/_/g, ' '))} load`, value: `ACWR ${spike.acwr.toFixed(2)}` });
  if (p.nutrition.protein_g != null) facts.push({ id: 'protein', label: 'Protein target', value: `${grams(p.nutrition.protein_g)} g` });
  if (p.nutrition.carbs_g != null) facts.push({ id: 'carbs', label: 'Carb target', value: `${grams(p.nutrition.carbs_g)} g` });
  if (p.cardio.hr_cap_bpm != null) facts.push({ id: 'hr_cap', label: 'Heart-rate cap', value: `${p.cardio.hr_cap_bpm} bpm${p.cardio.talk_test ? ` · ${p.cardio.talk_test}` : ''}` });
  if (p.cardio.rehydration_g != null) facts.push({ id: 'hydration', label: 'Rehydration', value: `${grams(p.cardio.rehydration_g)} g water` });
  return facts;
}

// ── STEP 5 · playlist assembly (§3.6 timing) ─────────────────────────────────
export interface PlaylistItem { seq: number; slot: Slot; variant_key: string; url: string | null; sha256: string | null; duration_ms: number; gap_after_ms: number; fallback: string | null; screen_fact_ids: string[]; }
export interface StitchTiming { gap_ms: number; gap_before_s7_ms: number; }
export const DEFAULT_TIMING: StitchTiming = { gap_ms: 240, gap_before_s7_ms: 400 };

// Given the ordered resolved fragments (slot + key + url + duration), produce the
// gapless play contract with engineered breath spacing + total virtual timeline.
export function assemblePlaylist(
  resolved: Array<{ slot: Slot; variant_key: string; url: string | null; sha256: string | null; duration_ms: number; fallback: string | null; screen_fact_ids: string[] }>,
  timing: StitchTiming = DEFAULT_TIMING,
): { playlist: PlaylistItem[]; total_duration_ms: number } {
  const playlist: PlaylistItem[] = [];
  let total = 0;
  for (let i = 0; i < resolved.length; i++) {
    const item = resolved[i];
    const next = resolved[i + 1];
    const isLast = i === resolved.length - 1;
    const gap = isLast ? 0 : next?.slot === 'S7' ? timing.gap_before_s7_ms : timing.gap_ms;
    playlist.push({ seq: i, slot: item.slot, variant_key: item.variant_key, url: item.url, sha256: item.sha256, duration_ms: item.duration_ms, gap_after_ms: gap, fallback: item.fallback, screen_fact_ids: item.screen_fact_ids });
    total += item.duration_ms + gap;
  }
  return { playlist, total_duration_ms: total };
}

function cap(s: string): string { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function grams(n: number): string { return Math.round(n).toLocaleString('en-US'); } // integer grams, locale-grouped
