// ═══════════════════════════════════════════════════════════════════════════
// _shared/studio-core.ts — Content Studio V4 timeline compiler (deterministic)
// ───────────────────────────────────────────────────────────────────────────
// Pure functions for bbf-studio-batch-compiler: TRILINGUAL text resolution, gram
// stat-binding resolution + formatting, and timeline assembly. Zero I/O.
//
// TRILINGUAL LAW: overlay text is NEVER a hardcoded literal — every string resolves
// from the layer's own content[locale] object by the target locale (en/es/pt).
// GRAM STANDARD (§0.1): stat badges render the BIGINT ledger value as a locale-grouped
// INTEGER + ' g' (en "143,335 g" · es/pt "143.335 g"); the ' g' unit is fixed, /kg
// is forbidden anywhere in the overlay formatter.
// ═══════════════════════════════════════════════════════════════════════════

export type Locale = 'en' | 'es' | 'pt';
export interface TextContent { en?: string; es?: string; pt?: string; [k: string]: string | undefined; }
export interface OverlayLayer {
  id: string; type: string; z?: number; visible?: boolean; locked?: boolean;
  content?: TextContent; label?: TextContent;
  binding?: { source: string; format?: string };
  [k: string]: unknown;
}
export interface OverlayState {
  canvas_basis?: { w: number; h: number }; locale?: string;
  layers?: OverlayLayer[]; global_grade?: Record<string, unknown>; preset_id?: string | null;
}

export function normLoc(v: unknown): Locale {
  const t = String(v ?? '').trim().toLowerCase();
  if (t === 'es' || t.startsWith('es')) return 'es';
  if (t === 'pt' || t.startsWith('pt') || t.includes('bras') || t.includes('braz') || t === 'br') return 'pt';
  return 'en';
}

// Intl grouping locale per target (thousands separator only — the unit stays ' g').
const INTL_BY_LOCALE: Record<Locale, string> = { en: 'en-US', es: 'es-ES', pt: 'pt-BR' };

// Resolve a per-locale text object → the target-locale string. NEVER a hardcoded
// literal: falls back to the layer's OWN en content (data), then '' — no English in code.
export function resolveText(content: TextContent | undefined, locale: Locale): string {
  if (!content) return '';
  return content[locale] ?? content.en ?? content.es ?? content.pt ?? '';
}

// §0.1 — integer grams, locale-grouped, fixed ' g' unit. Anything not int_grams passes
// through as a locale-grouped integer without the unit.
export function formatBinding(value: number | null, format: string | undefined, locale: Locale): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const grouped = Math.round(value).toLocaleString(INTL_BY_LOCALE[locale]);
  return format === 'int_grams' ? `${grouped} g` : grouped;
}

export interface ResolvedLayer {
  id: string; type: string; z: number; visible: boolean; locked: boolean;
  text: string | null;                 // resolved localized text (text layers)
  label: string | null;                // resolved localized label (stat_badge)
  value: string | null;                // formatted gram value (stat_badge)
  binding_source: string | null;
  style: Record<string, unknown>;      // pos/font/fill/stroke/… passed through verbatim
}
export interface CompiledTimeline {
  locale: Locale; canvas_basis: { w: number; h: number };
  layers: ResolvedLayer[]; global_grade: Record<string, unknown>;
  binding_snapshot: Record<string, number | null>; binding_demo: boolean;
}

const STYLE_KEYS = new Set(['pos', 'max_width_frac', 'font', 'size_px', 'letter_spacing_px', 'line_height', 'weight', 'transform', 'auto_fit', 'fill', 'stroke', 'shadow', 'plate', 'color_overlay_scope', 'style_ref', 'anchor']);

// Assemble the render timeline: z-ordered layers with localized text + frozen gram
// bindings. bindingValues is resolved by the caller (real athlete ledgers for a
// Directed job, or demo values for social — the privacy boundary is enforced there).
export function assembleTimeline(
  overlay: OverlayState, locale: Locale,
  bindingValues: Record<string, number | null>, bindingDemo: boolean,
): CompiledTimeline {
  const layers = [...(overlay.layers ?? [])]
    .filter((l) => l.visible !== false)
    .sort((a, b) => (a.z ?? 0) - (b.z ?? 0))
    .map((l): ResolvedLayer => {
      const style: Record<string, unknown> = {};
      for (const k of Object.keys(l)) if (STYLE_KEYS.has(k)) style[k] = l[k];
      const isText = l.type === 'text';
      const isStat = l.type === 'stat_badge';
      const src = isStat && l.binding ? l.binding.source : null;
      return {
        id: l.id, type: l.type, z: l.z ?? 0, visible: l.visible !== false, locked: l.locked === true,
        text: isText ? resolveText(l.content, locale) : null,
        label: isStat ? resolveText(l.label, locale) : null,
        value: isStat && src ? formatBinding(bindingValues[src] ?? null, l.binding?.format, locale) : null,
        binding_source: src,
        style,
      };
    });
  return {
    locale, canvas_basis: overlay.canvas_basis ?? { w: 1080, h: 1920 },
    layers, global_grade: overlay.global_grade ?? {},
    binding_snapshot: bindingValues, binding_demo: bindingDemo,
  };
}

// Merge preset overlay with per-job overrides (override layers replace preset layers
// by id; other override keys shallow-override). Pure — no mutation of inputs.
export function mergeOverlay(preset: OverlayState | null, override: OverlayState | null): OverlayState {
  if (!preset) return override ?? {};
  if (!override) return preset;
  const byId = new Map<string, OverlayLayer>();
  for (const l of (preset.layers ?? [])) byId.set(l.id, l);
  for (const l of (override.layers ?? [])) byId.set(l.id, { ...(byId.get(l.id) ?? {}), ...l });
  return { ...preset, ...override, layers: [...byId.values()] };
}

// Resolution ladder from deviceClass via studio_ladder_v1 (fallback matches the seed).
export interface LadderCfg { high: LadderRung; mid: LadderRung; low: LadderRung; }
export interface LadderRung { w: number; h: number; bitrate_bps: number; [k: string]: unknown; }
export const LADDER_FALLBACK: LadderCfg = {
  high: { w: 1080, h: 1920, bitrate_bps: 8000000 },
  mid: { w: 1080, h: 1920, bitrate_bps: 6000000 },
  low: { w: 720, h: 1280, bitrate_bps: 3500000 },
};
export function resolveLadder(deviceClass: string | null | undefined, cfg: LadderCfg): LadderRung {
  const dc = String(deviceClass ?? '').toLowerCase();
  if (dc === 'low') return cfg.low;
  if (dc === 'high') return cfg.high;
  return cfg.mid; // default/mid
}
