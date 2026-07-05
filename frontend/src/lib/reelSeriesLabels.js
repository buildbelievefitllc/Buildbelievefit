// src/lib/reelSeriesLabels.js
// Pretty label for a reelData.series tag id — shared between the on-canvas eyebrow
// chip (ReelPreviewEngine) and the auto-caption builder (StudioLayout), so the two
// can't drift to showing different text for the same series.
export const SERIES_LABELS = {
  'form-fix': 'FORM FIX',
  'recovery-protocol': 'RECOVERY PROTOCOL',
  mindset: 'MINDSET PROTOCOL',
  metabolic: 'METABOLIC WINDOW',
  '12hour': '12-HOUR SURVIVAL',
  sovereign: 'SOVEREIGN SUNDAY',
  fuel: 'FUEL FILES',
  lab: 'THE LAB',
};

export function seriesLabel(id) {
  return SERIES_LABELS[id] || id;
}
