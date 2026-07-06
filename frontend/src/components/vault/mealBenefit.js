// src/components/vault/mealBenefit.js
// ─────────────────────────────────────────────────────────────────────────────
// Deterministic, trilingual "why this fuels you" copy for a logged meal. ZERO AI.
//
//   Layer 1 (ALL tiers): goal / physiology-framed benefit keyed to the meal's
//     dominant macro — repair (protein), training energy (carbs), hormonal base
//     (fat), or a balanced plate.
//   Layer 2 (fitness / hybrid ONLY): an appended readiness / CNS sentence. The
//     CALLER gates this on readiness?.hasData, so a Fuel-only athlete — who has no
//     readiness score — never sees it (and never hits a null-reference).
//
// Pure function, no state, no network. Contextualizes food BY readiness; it never
// mutates a score (Tier-1 discipline).

const L1 = {
  en: {
    protein:  { title: 'Repair material', body: 'That protein is the raw material your muscles rebuild with — logged toward the repair your build depends on.' },
    carb:     { title: 'Training fuel',    body: 'Those carbs are glycogen in the tank — the energy that powers hard training and speeds recovery between sessions.' },
    fat:      { title: 'Hormonal base',    body: 'Healthy fats anchor your hormones and keep you satisfied — the steady foundation under your macros.' },
    balanced: { title: 'Balanced plate',   body: 'A balanced hit of protein, carbs, and fat — repair, energy, and hormones all moving together.' },
  },
  es: {
    protein:  { title: 'Material de reparación', body: 'Esa proteína es la materia prima con la que tus músculos se reconstruyen — sumada a la reparación de la que depende tu progreso.' },
    carb:     { title: 'Combustible de entrenamiento', body: 'Esos carbohidratos son glucógeno en el tanque — la energía que impulsa el entrenamiento duro y acelera la recuperación.' },
    fat:      { title: 'Base hormonal', body: 'Las grasas saludables sostienen tus hormonas y te mantienen saciado — la base estable bajo tus macros.' },
    balanced: { title: 'Plato equilibrado', body: 'Una dosis equilibrada de proteína, carbohidratos y grasa — reparación, energía y hormonas en marcha.' },
  },
  pt: {
    protein:  { title: 'Material de reparo', body: 'Essa proteína é a matéria-prima com que seus músculos se reconstroem — somada ao reparo de que seu progresso depende.' },
    carb:     { title: 'Combustível de treino', body: 'Esses carboidratos são glicogênio no tanque — a energia que move o treino pesado e acelera a recuperação.' },
    fat:      { title: 'Base hormonal', body: 'Gorduras boas sustentam seus hormônios e mantêm a saciedade — a base estável sob seus macros.' },
    balanced: { title: 'Prato equilibrado', body: 'Uma dose equilibrada de proteína, carboidratos e gordura — reparo, energia e hormônios juntos.' },
  },
};

const L2 = {
  en: {
    recovery:    ' Your CNS flagged a breach today — protein-forward, anti-inflammatory fuel like this is exactly what it needs to rebuild.',
    adaptive:    ' You’re under strain today — this supports the recovery your system is asking for.',
    performance: ' You’re primed today — this is the fuel behind your output.',
  },
  es: {
    recovery:    ' Tu SNC marcó una brecha hoy — un combustible rico en proteína y antiinflamatorio como este es justo lo que necesita para reconstruir.',
    adaptive:    ' Hoy estás bajo tensión — esto apoya la recuperación que tu sistema pide.',
    performance: ' Hoy estás listo — este es el combustible detrás de tu rendimiento.',
  },
  pt: {
    recovery:    ' Seu SNC sinalizou uma violação hoje — um combustível rico em proteína e anti-inflamatório como este é exatamente o que ele precisa para reconstruir.',
    adaptive:    ' Você está sob tensão hoje — isto apoia a recuperação que seu sistema pede.',
    performance: ' Você está pronto hoje — este é o combustível por trás do seu desempenho.',
  },
};

// Dominant macro by calorie share (P·4 / C·4 / F·9). "Balanced" when nothing leads.
function dominantMacro({ p = 0, c = 0, f = 0 } = {}) {
  const pc = (Number(p) || 0) * 4, cc = (Number(c) || 0) * 4, fc = (Number(f) || 0) * 9;
  const tot = pc + cc + fc;
  if (tot <= 0) return 'balanced';
  const share = { protein: pc / tot, carb: cc / tot, fat: fc / tot };
  const max = Math.max(share.protein, share.carb, share.fat);
  if (max < 0.42) return 'balanced';
  if (share.protein === max) return 'protein';
  if (share.carb === max) return 'carb';
  return 'fat';
}

// Map the readiness verdict to a fuel emphasis (mirrors Nutrition FuelProfile).
function readinessState(readiness) {
  if (!readiness) return 'performance';
  if (readiness.isBreach || readiness.mode === 'SYSTEM_BREACH') return 'recovery';
  if (readiness.mode === 'SYSTEM_STRAIN') return 'adaptive';
  return 'performance';
}

// macros: { p, c, f } grams · lang: 'en'|'es'|'pt' · readiness: useDailyReadiness().data|null
export function mealBenefit(macros, lang = 'en', readiness = null) {
  const L = L1[lang] || L1.en;
  const base = L[dominantMacro(macros)] || L.balanced;
  const withReadiness = Boolean(readiness?.hasData); // Layer-2 gate
  const l2 = withReadiness ? ((L2[lang] || L2.en)[readinessState(readiness)] || '') : '';
  return { title: base.title, body: base.body + l2, layer2: Boolean(l2) };
}
