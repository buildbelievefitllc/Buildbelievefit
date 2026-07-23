// Blood-pressure guidance content. General AHA-style lifestyle education —
// NOT a diagnosis or a substitute for her care team. Kept as plain data so the
// UI stays dumb and the wording is easy to review/adjust.

// Semantic status colors per reading category (separate from the BBF brand
// accent — these encode severity, not identity).
export const TONE_HEX = {
  normal: '#34d399', // emerald
  elevated: '#fbbf24', // amber
  stage1: '#fb923c', // orange
  stage2: '#f87171', // red
  crisis: '#fca5a5', // light red
}

// One reassuring, plain-language sentence per category.
export const CATEGORY_BANNER = {
  normal:
    'Wonderful — your reading is in the healthy range. Keep up the good habits that got you here.',
  elevated:
    'Just a touch above ideal. Small daily choices now can bring this back down before it climbs.',
  stage1:
    'This is High (Stage 1) — nothing to panic about. This is exactly where everyday habits make the biggest difference.',
  stage2:
    'This is High (Stage 2). Keep logging faithfully and please share these numbers with your doctor soon.',
  crisis:
    'This reading is very high. If you feel unwell — chest pain, breathlessness, weakness — call your doctor or emergency services now.',
}

// Reusable focus tips (text + the reason it works).
const T = {
  salt: {
    text: 'Ease off the salt today.',
    why: 'Less sodium means less water to push around — often the fastest lever you have.',
  },
  veg: {
    text: 'Add an extra serving of vegetables or fruit.',
    why: 'Their potassium gently relaxes your blood vessels.',
  },
  walk: {
    text: 'Fit in a 20–30 minute walk.',
    why: 'Regular movement can lower the top number by 5–8 points.',
  },
  breathe: {
    text: 'Take five slow breaths before you re-check.',
    why: 'Calm breathing eases the nervous system that pushes pressure up.',
  },
  measure: {
    text: 'Sit quietly 5 minutes before measuring.',
    why: 'Rushing can add 10+ points and hide your real number.',
  },
  keep: {
    text: 'Keep doing exactly what you’re doing.',
    why: 'Consistency is what holds a good number steady.',
  },
  call: {
    text: 'Re-check in a few minutes, then call your doctor.',
    why: 'Two high readings in a row are worth a prompt conversation.',
  },
  log: {
    text: 'Log it and note how you feel.',
    why: 'Your trend tells the doctor far more than any single number.',
  },
}

// The 3 focus tips shown for the current reading, by category.
export function focusTips(tone) {
  const map = {
    normal: [T.keep, T.measure, T.walk],
    elevated: [T.salt, T.walk, T.breathe],
    stage1: [T.salt, T.walk, T.breathe],
    stage2: [T.salt, T.walk, T.log],
    crisis: [T.breathe, T.call, T.log],
  }
  return map[tone] || map.normal
}

// The full "Tips & Guidance" library.
export const GUIDANCE_SECTIONS = [
  {
    icon: '🥗',
    title: 'Diet & Salt (DASH)',
    items: [
      {
        text: 'Keep salt under 1,500 mg a day.',
        why: 'Less sodium means your body holds less water, so your heart doesn’t have to push as hard.',
      },
      {
        text: 'Fill half your plate with vegetables and fruit.',
        why: 'They’re rich in potassium, which gently relaxes the walls of your blood vessels.',
      },
      {
        text: 'Watch the hidden salt in bread, soup, and deli meats.',
        why: 'Most of our salt comes from packaged food, not the shaker on the table.',
      },
    ],
  },
  {
    icon: '🚶',
    title: 'Exercise & Movement',
    items: [
      {
        text: 'A 30-minute brisk walk most days works wonders.',
        why: 'Regular movement can lower the top number by 5–8 points — as much as some medicines.',
      },
      {
        text: 'Break it up if you need to — three 10-minute walks count.',
        why: 'Your blood vessels respond to the daily total, not one long session.',
      },
      {
        text: 'Add gentle strength work twice a week.',
        why: 'Stronger muscles help your whole circulation run more efficiently.',
      },
    ],
  },
  {
    icon: '😴',
    title: 'Stress & Sleep',
    items: [
      {
        text: 'Try 5 slow breaths whenever you feel tense.',
        why: 'Slow breathing calms the nervous system that drives pressure up in the moment.',
      },
      {
        text: 'Aim for 7–8 hours of sleep.',
        why: 'Blood pressure is meant to dip at night; short sleep keeps it running high.',
      },
      {
        text: 'Protect a little quiet time each day.',
        why: 'Ongoing stress hormones keep the vessels tight over weeks and months.',
      },
    ],
  },
  {
    icon: '🩺',
    title: 'How to Measure Correctly',
    items: [
      {
        text: 'Sit quietly for 5 minutes first — feet flat, back supported.',
        why: 'Rushing or crossed legs can add 10+ points and hide your true number.',
      },
      {
        text: 'Rest your arm on a table at heart height.',
        why: 'An arm left dangling reads falsely high.',
      },
      {
        text: 'Measure at the same times daily, before coffee or medicine.',
        why: 'Consistency is what makes your trend trustworthy for the doctor.',
      },
    ],
  },
  {
    icon: '📈',
    title: 'Understanding the Numbers',
    items: [
      {
        text: 'The top number (systolic) is the push when your heart beats.',
        why: 'It’s the number doctors watch most closely as we get older.',
      },
      {
        text: 'The bottom number (diastolic) is the rest between beats.',
        why: 'It tells how relaxed your vessels are at their baseline.',
      },
      {
        text: 'One high reading isn’t a diagnosis — the trend is.',
        why: 'Pressure naturally rises and falls all through the day.',
      },
    ],
  },
  {
    icon: '⚠️',
    title: 'When to Call the Doctor',
    danger: true,
    items: [
      {
        text: 'Call promptly if readings stay at or above 180/120.',
        why: 'That range can strain the heart. With chest pain, trouble breathing, or weakness, call emergency services.',
      },
      {
        text: 'Check in if your numbers creep up over a week or two.',
        why: 'A rising trend is much easier to fix when it’s caught early.',
      },
      {
        text: 'Bring your log to every appointment.',
        why: 'Home readings tell the real story better than a single clinic visit.',
      },
    ],
  },
]
