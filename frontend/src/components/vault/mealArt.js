// src/components/vault/mealArt.js
// ─────────────────────────────────────────────────────────────────────────────
// Premium meal-art routing — the Nutrition Locker's visual asset layer.
//
// EXPLICIT RESOLUTION: every artwork below is statically imported, so Vite
// fingerprints it into the build graph and the <img src> is a verified, hashed
// asset URL — a path that cannot 404 in production (a broken path fails the
// BUILD, not the athlete's screen). resolveMealArt() therefore ALWAYS returns a
// real image: archetype-matched art, or the composed-plate fallback.
//
// ARCHETYPE INFERENCE (deterministic, trilingual): a meal's ingredient line is
// matched against EN/ES/PT food vocabulary (the tri-cuisine catalog mixes
// languages — "Frango Grelhado", "Pollo Asado", "Picanha"). First match wins;
// the order below is most-specific → most-generic.

import shakeArt from '../../assets/meals/shake.svg';
import eggsArt from '../../assets/meals/eggs.svg';
import oatsArt from '../../assets/meals/oats.svg';
import wrapArt from '../../assets/meals/wrap.svg';
import fishArt from '../../assets/meals/fish.svg';
import chickenArt from '../../assets/meals/chicken.svg';
import beefArt from '../../assets/meals/beef.svg';
import dairyArt from '../../assets/meals/dairy.svg';
import fruitArt from '../../assets/meals/fruit.svg';
import bowlArt from '../../assets/meals/bowl.svg';
import plateArt from '../../assets/meals/plate.svg';

// Ordered archetype rules — EN + ES + PT food vocabulary per pattern.
const ART_RULES = [
  { id: 'shake', art: shakeArt, re: /\bwhey\b|\bcasein\b|protein bar|protein shake|\bscoops?\b/i },
  { id: 'wrap', art: wrapArt, re: /taco|burrito|tortilla|chilaquiles|fajita|quesadilla|wrap/i },
  { id: 'oats', art: oatsArt, re: /oat|pancake|granola(?!.*yogurt)|tapioca|toast|p[aã]o|cereal|misto quente/i },
  { id: 'eggs', art: eggsArt, re: /\beggs?\b|egg white|omelet|huevo|machaca|scramble/i },
  { id: 'fish', art: fishArt, re: /salmon|cod|tilapia|shrimp|fish|pescado|peixe|camar[aã]o/i },
  { id: 'chicken', art: chickenArt, re: /chicken|pollo|frango|galinhada|turkey|peru/i },
  { id: 'beef', art: beefArt, re: /steak|sirloin|beef|carne|picanha|barbacoa|carnitas|pork|res\b|bife|feijoada|pot roast|strogonoff/i },
  { id: 'dairy', art: dairyArt, re: /yogurt|cottage|queso|queijo|cheese|milk(?!.*whey)/i },
  { id: 'fruit', art: fruitArt, re: /apple|banana|mango|berr|pineapple|papaya|guava|melon|orange|peach|fruit|almond|nuts/i },
  { id: 'bowl', art: bowlArt, re: /rice|beans|feij[aã]o|arroz|bowl|caldo|pasta|potato/i },
];

// Infer the archetype id for a meal (slot label + ingredient line). Exported for
// the invariant test — every id maps to a statically imported asset.
export function mealArchetype(meal) {
  const text = `${meal?.m || ''} ${meal?.i || ''}`;
  for (const rule of ART_RULES) {
    if (rule.re.test(text)) return rule.id;
  }
  return 'plate';
}

// Resolve a meal to its premium artwork URL. NEVER returns a dead path: an
// unmatched meal renders the composed-plate art, not a broken image.
export function resolveMealArt(meal) {
  const id = mealArchetype(meal);
  const rule = ART_RULES.find((r) => r.id === id);
  return rule ? rule.art : plateArt;
}

// The full id → URL map (consumed by the readiness fuel-profile hero).
export const MEAL_ART = {
  shake: shakeArt, wrap: wrapArt, oats: oatsArt, eggs: eggsArt, fish: fishArt,
  chicken: chickenArt, beef: beefArt, dairy: dairyArt, fruit: fruitArt,
  bowl: bowlArt, plate: plateArt,
};
