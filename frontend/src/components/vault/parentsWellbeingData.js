// src/components/vault/parentsWellbeingData.js
// ─────────────────────────────────────────────────────────────────────────────
// "Parents' Well-Being" — a private educational health module inside Champion
// Mindset, shown ONLY to the founder's parents (gated by isParent() in
// personalTouches.js, wired in ChampionMindset.jsx). It reuses the EXACT champion
// film-card + §10 deck the rest of Champion Mindset uses (zero drift), so each
// video renders as a tap-to-play card with a warm focus note and two takeaways.
//
// Curated for awareness, not prescription:
//   • Mom — cancer remission: clinical nutrition + movement after treatment.
//   • Dad — type-2 diabetes + high blood pressure: blood-sugar and cardiovascular
//     lifestyle education.
// Sources are named in each note so they read as the authoritative material they
// are (American Cancer Society, Fred Hutch, university + clinical channels).
//
// Records match the ChampionFilmCard shape: { id, category, title, youtubeId,
// objective, dictums[], lockIn? }. Content is English (the videos are English),
// shown the same in every language; only the deck tab LABEL localizes.

export const PARENTS_WELLBEING = [
  // ── For Mom — remission, nutrition & movement ──────────────────────────────
  {
    id: 'pw_mom_1',
    category: 'For Mom · Remission Nutrition',
    title: 'Nutrition & Physical Activity Guidelines for Cancer Survivors',
    youtubeId: 'PVIcOw6TO-M',
    objective:
      'Mom — this one’s for you. The American Cancer Society lays out the nutrition and movement guidelines built specifically for survivors in remission: how to eat and move to protect the vitality you fought so hard to keep.',
    dictums: [
      'Good food and steady movement are part of staying well — at any age.',
      'Small, consistent habits protect the progress you’ve already won.',
    ],
    lockIn: 'Save to today’s focus',
  },
  {
    id: 'pw_mom_2',
    category: 'For Mom · After Treatment',
    title: 'Movement and Nutrition After Cancer Treatment',
    youtubeId: 'n88DB55YoNE',
    objective:
      'From the Fred Hutchinson Cancer Center: oncology specialists on how gentle, structured movement and targeted nutrition help the body repair and stay strong after treatment. No pressure — just informed, caring choices.',
    dictums: [
      'Rebuilding is a process — your body is still doing quiet, important work.',
      'Movement you enjoy is movement that lasts.',
    ],
    lockIn: 'Save to today’s focus',
  },
  {
    id: 'pw_mom_3',
    category: 'For Mom · Whole-Food Fuel',
    title: 'Healthy Eating with Cancer',
    youtubeId: '5tybR4jeTu0',
    objective:
      'A clear guide to choosing nutrient-dense whole foods that calm inflammation and feed cellular health during remission. The everyday "why" behind the good stuff already on your plate, Mom.',
    dictums: [
      'Color on the plate is medicine you can taste.',
      'Whole foods first — they carry the most for the least.',
    ],
    lockIn: 'Save to today’s focus',
  },
  {
    id: 'pw_mom_4',
    category: 'For Mom · Strength & Immunity',
    title: 'The Science of Exercise for Cancer',
    youtubeId: 'vaFxN_cDuV0',
    objective:
      'Dr. Kerry Courneya walks through the clinical research on how resistance training supports the immune system and long-term recovery. Proof, Mom, that the strength work is doing more than you can see.',
    dictums: [
      'Strength training is one of the most protective things you can do.',
      'A little resistance, done often, compounds into real resilience.',
    ],
    lockIn: 'Save to today’s focus',
  },
  {
    id: 'pw_mom_5',
    category: 'For Mom · Meal Timing',
    title: 'Intermittent Fasting & Feeling Better After Cancer',
    youtubeId: 'z7rfs_ej2KM',
    objective:
      'From the University of California: how simple, gentle meal-timing strategies can steady blood glucose, support healthy cholesterol, and lift everyday stamina. Only ever a tool, Mom — never a rule.',
    dictums: [
      'When you eat can matter as much as what you eat.',
      'Gentle and sustainable beats strict and short-lived.',
    ],
    lockIn: 'Save to today’s focus',
  },

  // ── For Dad — diabetes, blood pressure & metabolic health ──────────────────
  {
    id: 'pw_dad_1',
    category: 'For Dad · Blood Pressure',
    title: 'Tackling High Blood Pressure',
    youtubeId: 'cIJYjLV5gTo',
    objective:
      'Dad — this set is for you. The National Diabetes Program explains how steadying blood sugar and easing back on saturated fat helps blood flow more freely, which naturally takes pressure off your heart.',
    dictums: [
      'Steady blood sugar and steady blood pressure travel together.',
      'Every small swap adds up to an easier day for your heart.',
    ],
    lockIn: 'Save to today’s focus',
  },
  {
    id: 'pw_dad_2',
    category: 'For Dad · Insulin & Pressure',
    title: 'How Fasting Naturally Lowers High Blood Pressure',
    youtubeId: 'ogNBtf3APFM',
    objective:
      'A clear breakdown of the link between insulin and blood pressure — and how lowering insulin levels can ease sodium retention and arterial pressure. Knowledge to put you in the driver’s seat, Dad.',
    dictums: [
      'Lower insulin, lower pressure — they’re connected.',
      'Understanding the "why" makes the habit stick.',
    ],
    lockIn: 'Save to today’s focus',
  },
  {
    id: 'pw_dad_3',
    category: 'For Dad · Everyday Wins',
    title: 'Lower Blood Pressure Naturally: Doctor Explains',
    youtubeId: 'xmi9qghwQEY',
    objective:
      'A physician on the compounding power of small, sustainable choices — like leaning into potassium-rich, low-sodium foods — to bring blood pressure down over time. Simple moves, Dad, done daily.',
    dictums: [
      'Potassium-rich, low-sodium foods quietly do a lot of good.',
      'Consistency beats intensity — every single time.',
    ],
    lockIn: 'Save to today’s focus',
  },
  {
    id: 'pw_dad_4',
    category: 'For Dad · Sodium Smarts',
    title: 'Tips to Reduce High Blood Pressure (Diabetes)',
    youtubeId: 'b0pI7dZwJmI',
    objective:
      'Practical, do-it-today methods: spotting hidden sodium in processed foods, reading labels, and swapping in herbs for salt — to protect both your blood sugar and your heart, Dad.',
    dictums: [
      'Most sodium hides in packaged food — the label tells the truth.',
      'Herbs and spices beat the salt shaker, every time.',
    ],
    lockIn: 'Save to today’s focus',
  },
  {
    id: 'pw_dad_5',
    category: 'For Dad · Lifestyle Medicine',
    title: 'Treating Diabetes, Hypertension & Obesity with Lifestyle',
    youtubeId: 'tvzCaMyJ6o0',
    objective:
      'Dr. Steven Fox (Erlanger Health) on managing type-2 diabetes, blood pressure, and cholesterol together — through everyday movement and low-glycemic eating. The whole picture, Dad, in one place.',
    dictums: [
      'The same good habits help diabetes, pressure, and weight at once.',
      'Movement plus low-glycemic eating is a powerful pair.',
    ],
    lockIn: 'Save to today’s focus',
  },
];

// The deck bucket (the numbered §10 tab). Appended LAST in ChampionMindset so it
// reads as the final numbered module ("…05 Parents' Well-Being"). Label localizes;
// the video roster is shared. ids reference the records above.
const BUCKET_LABEL = {
  en: 'Parents’ Well-Being',
  es: 'Bienestar de los Padres',
  pt: 'Bem-Estar dos Pais',
};
export function parentsBucket(lang) {
  return {
    key: 'parents-wellbeing',
    label: BUCKET_LABEL[lang] || BUCKET_LABEL.en,
    ids: PARENTS_WELLBEING.map((c) => c.id),
  };
}
