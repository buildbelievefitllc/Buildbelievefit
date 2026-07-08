// src/lib/algorithmicBriefEngine.js
// ─────────────────────────────────────────────────────────────────────────────
// ALGORITHMIC DISTRIBUTION ENGINE — the deterministic CMO brain behind the
// Digital Content Manager's Platform Calibration Matrix and the Distribution
// Calendar's Algorithm Health read-out.
//
// DOCTRINE (matches the panel's charter): zero live-LLM spend. Every brief is
// COMPILED client-side from metadata the static library already carries
// (series · format · hook · target_angle · hashtags · cut_sheet). The AI
// formulates the strategy; the Sovereign approves it (Step-In-Approval) — the
// only external call remains the operator-triggered ElevenLabs synthesis.
//
// Exports:
//   buildAlgorithmicBrief(draft) → {
//     algorithmic_target,          // the specific viewer pocket
//     pacing_strategy,             // audio/visual cut speed
//     platform_specifics: {        // nested per-platform execution rules
//       tiktok:    { optimized, hook_3s, pacing_cues, subculture_tags },
//       instagram: { optimized, framing, caption_structure, broll_cues },
//       youtube:   { optimized, seo_title, search_keywords },
//     },
//   }
//   contentWeight(series)          → 'heavy' | 'reset' | 'neutral'
//   assessAlgorithmHealth(items)   → calendar sequencing verdict + warnings
//
// APPROVAL GATEWAY states (Green Light workflow):
//   'draft' → 'algorithmic_review' → 'approved'
export const APPROVAL_STATUS = {
  DRAFT: 'draft',
  REVIEW: 'algorithmic_review',
  APPROVED: 'approved',
};
export const APPROVAL_LABELS = {
  draft: 'Draft',
  algorithmic_review: 'Algorithmic Review',
  approved: 'Approved',
};

// ── Series → viewer pocket + retention weight ────────────────────────────────
// weight: 'heavy' = clinical/biomechanical density (taxes viewer retention when
// stacked); 'reset' = mindset/lifestyle content that re-opens retention;
// 'neutral' = everything else.
const SERIES_PROFILE = {
  'Mindset Engine': {
    weight: 'reset',
    target: 'Discipline-driven professionals & founders (25–45) in the self-optimization pocket',
    tags: ['#mindset', '#discipline', '#selfmastery'],
    keywords: ['discipline over motivation', 'mental toughness training', 'high performer mindset'],
  },
  'Form Fix': {
    weight: 'heavy',
    target: 'Injury-conscious intermediate lifters auditing their movement standards',
    tags: ['#biomechanics', '#liftingtechnique', '#formcheck'],
    keywords: ['proper lifting form', 'exercise technique breakdown', 'avoid lifting injury'],
  },
  'Prehab Architect': {
    weight: 'heavy',
    target: 'Desk-bound professionals & masters athletes managing joint friction',
    tags: ['#prehab', '#jointhealth', '#mobilitytraining'],
    keywords: ['prehab exercises', 'joint pain prevention', 'shoulder stability work'],
  },
  'Recovery Mode': {
    weight: 'reset',
    target: 'Overreached athletes in the CNS-recovery & parasympathetic pocket',
    tags: ['#recovery', '#cnsrecovery', '#deload'],
    keywords: ['workout recovery science', 'cns fatigue signs', 'deload week benefits'],
  },
  'Fuel Files': {
    weight: 'neutral',
    target: 'Macro-tracking body-recomposition crowd (structured eaters, 25–45)',
    tags: ['#macros', '#nutritionscience', '#mealprep'],
    keywords: ['macro tracking for muscle', 'performance nutrition basics', 'meal prep high protein'],
  },
};
const FALLBACK_PROFILE = {
  weight: 'neutral',
  target: 'General human-optimization audience (BBF universal pocket)',
  tags: ['#buildbelievefit'],
  keywords: ['fitness systems over motivation'],
};
const seriesProfile = (series) => SERIES_PROFILE[series] || FALLBACK_PROFILE;
export const contentWeight = (series) => seriesProfile(series).weight;

// ── Format → pacing physics (audio/visual cut speed) ─────────────────────────
const PACING_BY_FORMAT = {
  'reel cover': 'Fast · 1.5–2.5s cuts, beat-synced transitions, motion-first',
  phone: 'Medium · 3–4s cuts, handheld authenticity, jump-cut on emphasis',
  spotlight: 'Cinematic · 4–6s slow-burn holds, high-contrast lighting',
  'cta card': 'Static hold · kinetic typography over a locked frame',
  'morning cns check': 'Medium · 3–4s cuts, dawn-lit calibration sequence',
};
function pacingFor(draft) {
  const key = String(draft.format || draft.mode || '').trim().toLowerCase();
  return PACING_BY_FORMAT[key]
    || (contentWeight(draft.series) === 'reset'
      ? 'Measured · 3–5s cuts, breathing room between statements'
      : 'Fast · 2–3s cuts, cut on action, no dead frames');
}

// ── helpers ───────────────────────────────────────────────────────────────────
const firstSentence = (text) => {
  const t = String(text || '').trim();
  if (!t) return '';
  const m = t.match(/^[^.!?]{10,140}[.!?]/);
  return (m ? m[0] : t.slice(0, 140)).trim();
};
const words = (text) => String(text || '').toLowerCase().match(/[a-zà-ú0-9-]{4,}/gi) || [];
const uniq = (arr) => [...new Set(arr)];
const parseTags = (hashtags) => String(hashtags || '').match(/#[\w]+/g) || [];

// SEO title: hook first (it is already a thesis), clamped to YouTube's ~70-char
// display budget, with the series as a bracketed classifier when room allows.
function seoTitle(draft) {
  const hook = String(draft.hook || draft.target_angle || '').replace(/[.!]+$/, '').trim();
  const base = hook || `${draft.series} · BBF Lab`;
  const tagged = `${base} | ${draft.series}`;
  const title = tagged.length <= 70 ? tagged : base;
  return title.length <= 70 ? title : `${title.slice(0, 67).trimEnd()}…`;
}

// High-intent search keywords: series seed list + distinctive nouns lifted from
// the target angle / hook (deterministic, order-stable).
function searchKeywords(draft) {
  const seed = seriesProfile(draft.series).keywords;
  const mined = uniq(words(`${draft.target_angle} ${draft.hook}`))
    .filter((w) => !['your', 'with', 'this', 'that', 'from', 'into', 'over'].includes(w))
    .slice(0, 3);
  return uniq([...seed, ...mined]).slice(0, 6);
}

// ── THE PLATFORM CALIBRATION MATRIX ──────────────────────────────────────────
// One deterministic brief per draft. Pure function of the draft's own metadata —
// the same input always compiles the same strategy (auditable, no spend).
export function buildAlgorithmicBrief(draft) {
  const profile = seriesProfile(draft.series);
  const pacing = pacingFor(draft);
  const visual = firstSentence(draft.cut_sheet) || firstSentence(draft.hook);
  const libTags = parseTags(draft.hashtags);

  return {
    algorithmic_target: profile.target,
    pacing_strategy: pacing,
    platform_specifics: {
      tiktok: {
        optimized: 'Discovery',
        hook_3s: visual
          ? `Open on: ${visual}`
          : `Open on the boldest claim — "${firstSentence(draft.hook) || draft.series}"`,
        pacing_cues: pacing,
        subculture_tags: uniq([...profile.tags, ...libTags.slice(0, 3)]).slice(0, 6),
      },
      instagram: {
        optimized: 'Saves',
        framing: draft.background
          ? `Frame within the ${draft.background} palette — negative space top-third for the hook overlay`
          : 'Matte-black canvas, purple/gold accent lighting, subject center-weighted',
        caption_structure: 'Hook line → clinical context (2–3 sentences) → directive → "Your schedule is the context." signature',
        broll_cues: firstSentence(draft.cut_sheet) || 'Slow push-in on the working set; cutaway to the BBF Lab HUD',
      },
      youtube: {
        optimized: 'Search',
        seo_title: seoTitle(draft),
        search_keywords: searchKeywords(draft),
      },
    },
  };
}

// ── ALGORITHMIC SEQUENCING — calendar health ─────────────────────────────────
// Reads the scheduled queue in chronological order and audits retention pacing:
// a run of ≥4 consecutive 'heavy' (clinical/biomechanics) posts is a strain
// signal — the engine prescribes inserting a Mindset Engine / Recovery Mode
// reset post after the run's midpoint.
//
// Returns:
//   { status: 'optimal'|'watch'|'strain', mix: {heavy,reset,neutral},
//     longestHeavyRun, warnings: [{ startsAt, endsAt, count, message }] }
export function assessAlgorithmHealth(items) {
  const scheduled = (items || [])
    .filter((it) => it && it.scheduled_at)
    .slice()
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));

  const mix = { heavy: 0, reset: 0, neutral: 0 };
  const warnings = [];
  let run = [];
  let longestHeavyRun = 0;

  const flushRun = () => {
    longestHeavyRun = Math.max(longestHeavyRun, run.length);
    if (run.length >= 4) {
      const startsAt = run[0].scheduled_at;
      const endsAt = run[run.length - 1].scheduled_at;
      const fmt = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      warnings.push({
        startsAt,
        endsAt,
        count: run.length,
        message: `Retention strain: ${run.length} heavy clinical posts back-to-back (${fmt(startsAt)} → ${fmt(endsAt)}). Insert a Mindset Engine or Recovery Mode post inside this window to reset viewer retention.`,
      });
    }
    run = [];
  };

  for (const it of scheduled) {
    const w = contentWeight(it.series);
    mix[w] += 1;
    if (w === 'heavy') run.push(it);
    else flushRun();
  }
  flushRun();

  const status = warnings.length ? 'strain' : longestHeavyRun === 3 ? 'watch' : 'optimal';
  return { status, mix, longestHeavyRun, warnings };
}
