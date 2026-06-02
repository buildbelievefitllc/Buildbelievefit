// src/components/vault/cuisineMeals.js
// ─────────────────────────────────────────────────────────────────────────────
// UI mock catalog for the rebuilt Nutrition Locker (feature/ui-nutrition-rebuild).
//
// The Nutrition Locker now presents a Monday→Sunday, day-by-day tabbed meal plan
// switchable by CUISINE STYLE (American / Mexican / Brazilian) — replacing the
// older dietary-archetype framing. These plans are STATIC MOCK DATA used to drive
// the UI; the backend wiring that personalises a cuisine plan per athlete is a
// follow-up. Ingredients are deliberately grounded: standard, high-protein
// bodybuilding and family-style foods (ground turkey, jasmine rice, chicken,
// beef, eggs) — no boutique/unrealistic items.
//
// Shape (per-meal macros so the conic macro wheel + P/C/F/KCAL legend can render
// daily volume ratios directly):
//   { id, label, goal, days: [ { day, meals: [ { m, i, kcal, p, c, f } ] } ] }
// Daily totals are summed at render time (see dayTotals) so the data stays the
// single source of truth.

export const CUISINES = [
  { id: 'american', label: 'American' },
  { id: 'mexican', label: 'Mexican' },
  { id: 'brazilian', label: 'Brazilian' },
];

export const DAYS = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
];

// ── American — clean bodybuilding staples ───────────────────────────────────
const AMERICAN = {
  id: 'american',
  label: 'American',
  goal: 'Lean Mass · High Protein',
  days: [
    { day: 'Monday', meals: [
      { m: 'Breakfast', i: '1 cup Oatmeal, 3 Whole Eggs, 1 cup Blueberries', kcal: 520, p: 32, c: 62, f: 16 },
      { m: 'Lunch', i: '8 oz Grilled Chicken, 1.5 cups Jasmine Rice, 1 cup Broccoli', kcal: 660, p: 62, c: 78, f: 9 },
      { m: 'Snack', i: '1 cup Greek Yogurt, 1 scoop Whey, 1 tbsp Honey', kcal: 280, p: 38, c: 24, f: 3 },
      { m: 'Dinner', i: '8 oz Lean Ground Turkey, 8 oz Sweet Potato, 1 cup Asparagus', kcal: 620, p: 54, c: 58, f: 18 },
      { m: 'Snack 2', i: '2 scoops Whey, 1 cup Milk, 1 tbsp Peanut Butter', kcal: 400, p: 50, c: 22, f: 13 },
    ] },
    { day: 'Tuesday', meals: [
      { m: 'Breakfast', i: '6 Egg Whites, 2 Whole Eggs, 2 slices Ezekiel Toast', kcal: 470, p: 38, c: 40, f: 14 },
      { m: 'Lunch', i: '8 oz Sirloin Steak, 1 cup Jasmine Rice, Mixed Greens', kcal: 690, p: 58, c: 60, f: 20 },
      { m: 'Snack', i: '1 medium Apple, 2 oz Almonds', kcal: 330, p: 8, c: 30, f: 21 },
      { m: 'Dinner', i: '8 oz Baked Cod, 8 oz Roasted Potatoes, 1 cup Green Beans', kcal: 560, p: 52, c: 56, f: 12 },
      { m: 'Snack 2', i: '1 cup Cottage Cheese, 1/2 cup Pineapple', kcal: 240, p: 28, c: 22, f: 4 },
    ] },
    { day: 'Wednesday', meals: [
      { m: 'Breakfast', i: 'Protein Pancakes (1 scoop Whey, 1 Banana, 3 Egg Whites)', kcal: 480, p: 44, c: 52, f: 9 },
      { m: 'Lunch', i: '8 oz Ground Turkey, 1.5 cups White Rice, 1 cup Spinach', kcal: 650, p: 56, c: 72, f: 14 },
      { m: 'Snack', i: '2 Hard-Boiled Eggs, 1 oz String Cheese', kcal: 250, p: 20, c: 2, f: 18 },
      { m: 'Dinner', i: '8 oz Grilled Chicken, 8 oz Sweet Potato, 1 cup Brussels Sprouts', kcal: 600, p: 60, c: 54, f: 12 },
      { m: 'Snack 2', i: '1 scoop Casein, 1 tbsp Almond Butter', kcal: 280, p: 30, c: 10, f: 13 },
    ] },
    { day: 'Thursday', meals: [
      { m: 'Breakfast', i: '3 Whole Eggs, 4 oz Turkey Sausage, 1 cup Oatmeal', kcal: 560, p: 42, c: 50, f: 22 },
      { m: 'Lunch', i: '8 oz Grilled Chicken, 2 cups Pasta, Marinara', kcal: 700, p: 60, c: 88, f: 10 },
      { m: 'Snack', i: '1 cup Greek Yogurt, 1/4 cup Granola', kcal: 290, p: 24, c: 36, f: 6 },
      { m: 'Dinner', i: '8 oz 93% Ground Beef, 1 cup Jasmine Rice, 1 cup Zucchini', kcal: 640, p: 56, c: 58, f: 20 },
      { m: 'Snack 2', i: '2 scoops Whey, 1 cup Almond Milk', kcal: 240, p: 48, c: 8, f: 4 },
    ] },
    { day: 'Friday', meals: [
      { m: 'Breakfast', i: '1 cup Oatmeal, 1 scoop Whey, 1 tbsp Peanut Butter', kcal: 500, p: 38, c: 52, f: 16 },
      { m: 'Lunch', i: '8 oz Grilled Chicken, 8 oz Baked Potato, 1 cup Broccoli', kcal: 630, p: 60, c: 66, f: 9 },
      { m: 'Snack', i: '1 Protein Bar, 1 medium Banana', kcal: 350, p: 22, c: 48, f: 9 },
      { m: 'Dinner', i: '8 oz Salmon, 1 cup Jasmine Rice, 1 cup Asparagus', kcal: 660, p: 50, c: 56, f: 24 },
      { m: 'Snack 2', i: '1 cup Cottage Cheese, 2 tbsp Mixed Nuts', kcal: 290, p: 28, c: 8, f: 16 },
    ] },
    { day: 'Saturday', meals: [
      { m: 'Breakfast', i: '4 Whole Eggs, 2 slices Whole-Grain Toast, 1/2 Avocado', kcal: 540, p: 30, c: 38, f: 30 },
      { m: 'Lunch', i: '8 oz Ground Turkey Burger, Whole-Wheat Bun, Side Salad', kcal: 620, p: 52, c: 50, f: 22 },
      { m: 'Snack', i: '1 scoop Whey, 1 cup Mixed Berries', kcal: 220, p: 26, c: 24, f: 2 },
      { m: 'Dinner', i: '10 oz Sirloin Steak, 8 oz Sweet Potato, 1 cup Green Beans', kcal: 700, p: 62, c: 52, f: 24 },
      { m: 'Snack 2', i: '1 cup Greek Yogurt, 1 tbsp Honey', kcal: 220, p: 22, c: 28, f: 2 },
    ] },
    { day: 'Sunday', meals: [
      { m: 'Breakfast', i: 'Egg-White Omelet (6 whites, Spinach, Mushrooms), 1 cup Oatmeal', kcal: 460, p: 36, c: 52, f: 8 },
      { m: 'Lunch', i: '8 oz Roast Chicken, 1.5 cups Jasmine Rice, 1 cup Carrots', kcal: 660, p: 58, c: 74, f: 12 },
      { m: 'Snack', i: '1 cup Cottage Cheese, 1/2 cup Peaches', kcal: 230, p: 26, c: 22, f: 4 },
      { m: 'Dinner', i: '8 oz Lean Pot Roast, 8 oz Mashed Potatoes, 1 cup Peas', kcal: 640, p: 54, c: 60, f: 18 },
      { m: 'Snack 2', i: '2 scoops Casein, 1 tbsp Peanut Butter', kcal: 300, p: 50, c: 10, f: 12 },
    ] },
  ],
};

// ── Mexican — high-protein, bean-forward family plates ──────────────────────
const MEXICAN = {
  id: 'mexican',
  label: 'Mexican',
  goal: 'Lean Mass · High Protein',
  days: [
    { day: 'Monday', meals: [
      { m: 'Breakfast', i: 'Egg & Black Bean Scramble (3 Eggs, 1/2 cup Black Beans), 2 Corn Tortillas', kcal: 510, p: 32, c: 52, f: 18 },
      { m: 'Lunch', i: '8 oz Chicken Fajitas, 1 cup Cilantro-Lime Rice, 1/2 cup Pinto Beans', kcal: 680, p: 60, c: 74, f: 14 },
      { m: 'Snack', i: '1 cup Greek Yogurt, 1 tbsp Honey, Cinnamon', kcal: 240, p: 24, c: 28, f: 3 },
      { m: 'Dinner', i: '8 oz Lean Ground Beef Bowl, 1 cup Brown Rice, Salsa, 1/4 Avocado', kcal: 660, p: 56, c: 58, f: 22 },
      { m: 'Snack 2', i: '2 scoops Whey, 1 cup Milk', kcal: 300, p: 50, c: 18, f: 5 },
    ] },
    { day: 'Tuesday', meals: [
      { m: 'Breakfast', i: 'Huevos Rancheros (3 Eggs, 2 Corn Tortillas, Salsa Roja)', kcal: 470, p: 28, c: 44, f: 18 },
      { m: 'Lunch', i: '8 oz Carne Asada, 1.5 cups White Rice, 1/2 cup Black Beans', kcal: 700, p: 58, c: 70, f: 20 },
      { m: 'Snack', i: '1 medium Mango, 1 scoop Whey', kcal: 280, p: 26, c: 40, f: 2 },
      { m: 'Dinner', i: 'Grilled Shrimp Tacos (8 oz Shrimp, 3 Corn Tortillas, Cabbage Slaw)', kcal: 560, p: 50, c: 56, f: 14 },
      { m: 'Snack 2', i: '1 cup Cottage Cheese, 1/2 cup Pineapple', kcal: 240, p: 28, c: 22, f: 4 },
    ] },
    { day: 'Wednesday', meals: [
      { m: 'Breakfast', i: 'Protein Oats with Cinnamon, 1 scoop Whey, 1 Banana', kcal: 480, p: 40, c: 56, f: 9 },
      { m: 'Lunch', i: '8 oz Pollo Asado, 1 cup Cilantro-Lime Rice, 1 cup Grilled Peppers', kcal: 650, p: 60, c: 64, f: 14 },
      { m: 'Snack', i: '2 Hard-Boiled Eggs, 1 oz Queso Fresco', kcal: 250, p: 20, c: 2, f: 18 },
      { m: 'Dinner', i: '8 oz Ground Turkey Picadillo, 1 cup Brown Rice, 1/2 cup Black Beans', kcal: 640, p: 56, c: 62, f: 16 },
      { m: 'Snack 2', i: '1 scoop Casein, 1 tbsp Almond Butter', kcal: 280, p: 30, c: 10, f: 13 },
    ] },
    { day: 'Thursday', meals: [
      { m: 'Breakfast', i: 'Breakfast Burrito (4 Egg Whites, 2 Eggs, Black Beans, Whole-Wheat Tortilla)', kcal: 540, p: 40, c: 50, f: 18 },
      { m: 'Lunch', i: '8 oz Grilled Chicken Burrito Bowl, 1.5 cups Rice, Pico de Gallo', kcal: 700, p: 60, c: 80, f: 12 },
      { m: 'Snack', i: '1 cup Greek Yogurt, 1/4 cup Granola', kcal: 290, p: 24, c: 36, f: 6 },
      { m: 'Dinner', i: '8 oz Lean Beef Barbacoa, 1 cup White Rice, 1 cup Sauteed Zucchini', kcal: 640, p: 56, c: 56, f: 22 },
      { m: 'Snack 2', i: '2 scoops Whey, 1 cup Almond Milk', kcal: 240, p: 48, c: 8, f: 4 },
    ] },
    { day: 'Friday', meals: [
      { m: 'Breakfast', i: 'Egg-White Scramble with Salsa, 1 cup Oatmeal', kcal: 460, p: 36, c: 52, f: 8 },
      { m: 'Lunch', i: '8 oz Chicken Tinga, 1 cup Cilantro-Lime Rice, 1/2 cup Pinto Beans', kcal: 660, p: 60, c: 66, f: 12 },
      { m: 'Snack', i: '1 Protein Bar, 1 medium Orange', kcal: 330, p: 22, c: 44, f: 9 },
      { m: 'Dinner', i: 'Grilled Fish Tacos (8 oz Tilapia, 3 Corn Tortillas, Slaw)', kcal: 580, p: 52, c: 56, f: 14 },
      { m: 'Snack 2', i: '1 cup Cottage Cheese, 2 tbsp Mixed Nuts', kcal: 290, p: 28, c: 8, f: 16 },
    ] },
    { day: 'Saturday', meals: [
      { m: 'Breakfast', i: 'Chilaquiles Verdes with 3 Eggs, Black Beans', kcal: 560, p: 30, c: 52, f: 26 },
      { m: 'Lunch', i: '8 oz Carnitas (lean), 1.5 cups Rice, 1/2 cup Black Beans, Salsa', kcal: 700, p: 56, c: 70, f: 20 },
      { m: 'Snack', i: '1 scoop Whey, 1 cup Mango Chunks', kcal: 250, p: 26, c: 32, f: 2 },
      { m: 'Dinner', i: '10 oz Carne Asada, 1 cup Rice, Grilled Nopales, 1/4 Avocado', kcal: 700, p: 62, c: 54, f: 26 },
      { m: 'Snack 2', i: '1 cup Greek Yogurt, 1 tbsp Honey', kcal: 220, p: 22, c: 28, f: 2 },
    ] },
    { day: 'Sunday', meals: [
      { m: 'Breakfast', i: 'Machaca con Huevo (3 Eggs, 3 oz Shredded Beef), 2 Corn Tortillas', kcal: 500, p: 40, c: 32, f: 22 },
      { m: 'Lunch', i: '8 oz Pollo Asado, 1.5 cups Rice, 1 cup Calabacitas', kcal: 660, p: 58, c: 68, f: 14 },
      { m: 'Snack', i: '1 cup Cottage Cheese, 1/2 cup Papaya', kcal: 230, p: 26, c: 22, f: 4 },
      { m: 'Dinner', i: 'Caldo de Res (8 oz Lean Beef, Vegetables), 1 cup Rice', kcal: 620, p: 54, c: 58, f: 16 },
      { m: 'Snack 2', i: '2 scoops Casein, 1 tbsp Peanut Butter', kcal: 300, p: 50, c: 10, f: 12 },
    ] },
  ],
};

// ── Brazilian — arroz e feijão foundation, lean grilled proteins ────────────
const BRAZILIAN = {
  id: 'brazilian',
  label: 'Brazilian',
  goal: 'Lean Mass · High Protein',
  days: [
    { day: 'Monday', meals: [
      { m: 'Café da Manhã', i: '3 Whole Eggs, 2 slices Pão Integral, 1 Banana', kcal: 500, p: 28, c: 56, f: 18 },
      { m: 'Almoço', i: '8 oz Grilled Chicken, 1 cup Rice, 1/2 cup Black Beans (Feijão)', kcal: 670, p: 60, c: 72, f: 12 },
      { m: 'Lanche', i: '1 cup Greek Yogurt, 1 tbsp Honey, Granola', kcal: 280, p: 24, c: 34, f: 5 },
      { m: 'Jantar', i: '8 oz Picanha (lean), 1 cup Rice, 1/2 cup Beans, Couve (Collards)', kcal: 680, p: 56, c: 60, f: 22 },
      { m: 'Ceia', i: '2 scoops Whey, 1 cup Milk', kcal: 300, p: 50, c: 18, f: 5 },
    ] },
    { day: 'Tuesday', meals: [
      { m: 'Café da Manhã', i: 'Tapioca with 3 Egg Whites & Lean Turkey, 1 cup Papaya', kcal: 470, p: 34, c: 50, f: 10 },
      { m: 'Almoço', i: '8 oz Grilled Tilapia, 1 cup Rice, 1/2 cup Beans, Tomato Salad', kcal: 650, p: 56, c: 66, f: 14 },
      { m: 'Lanche', i: '1 scoop Whey, 1 medium Mango', kcal: 280, p: 26, c: 40, f: 2 },
      { m: 'Jantar', i: '8 oz Lean Ground Beef, 1 cup Rice, 1/2 cup Beans, Farofa (light)', kcal: 680, p: 54, c: 64, f: 22 },
      { m: 'Ceia', i: '1 cup Cottage Cheese, 1/2 cup Pineapple', kcal: 240, p: 28, c: 22, f: 4 },
    ] },
    { day: 'Wednesday', meals: [
      { m: 'Café da Manhã', i: 'Protein Oats (1 scoop Whey, 1 Banana, Cinnamon)', kcal: 480, p: 40, c: 56, f: 9 },
      { m: 'Almoço', i: '8 oz Frango Grelhado, 1 cup Rice, 1/2 cup Beans, Steamed Broccoli', kcal: 660, p: 60, c: 68, f: 12 },
      { m: 'Lanche', i: '2 Hard-Boiled Eggs, 1 oz Queijo Minas', kcal: 250, p: 20, c: 2, f: 18 },
      { m: 'Jantar', i: '8 oz Lean Pork Loin, 8 oz Sweet Potato, Couve', kcal: 620, p: 56, c: 50, f: 20 },
      { m: 'Ceia', i: '1 scoop Casein, 1 tbsp Peanut Butter', kcal: 280, p: 30, c: 10, f: 13 },
    ] },
    { day: 'Thursday', meals: [
      { m: 'Café da Manhã', i: '4 Egg Whites, 2 Whole Eggs, 2 slices Pão Integral', kcal: 470, p: 38, c: 40, f: 14 },
      { m: 'Almoço', i: '8 oz Grilled Chicken, 1.5 cups Rice, 1/2 cup Beans, Salad', kcal: 700, p: 60, c: 80, f: 12 },
      { m: 'Lanche', i: '1 cup Greek Yogurt, 1/4 cup Granola', kcal: 290, p: 24, c: 36, f: 6 },
      { m: 'Jantar', i: '8 oz Lean Beef Strogonoff (light), 1 cup Rice, Side Salad', kcal: 660, p: 56, c: 58, f: 22 },
      { m: 'Ceia', i: '2 scoops Whey, 1 cup Almond Milk', kcal: 240, p: 48, c: 8, f: 4 },
    ] },
    { day: 'Friday', meals: [
      { m: 'Café da Manhã', i: 'Tapioca with Scrambled Eggs (3), 1 cup Melon', kcal: 460, p: 30, c: 52, f: 12 },
      { m: 'Almoço', i: '8 oz Frango Grelhado, 1 cup Rice, 1/2 cup Beans, Couve', kcal: 660, p: 60, c: 66, f: 12 },
      { m: 'Lanche', i: '1 Protein Bar, 1 medium Banana', kcal: 350, p: 22, c: 48, f: 9 },
      { m: 'Jantar', i: '8 oz Grilled Salmon, 1 cup Rice, 1/2 cup Beans, Asparagus', kcal: 680, p: 52, c: 58, f: 24 },
      { m: 'Ceia', i: '1 cup Cottage Cheese, 2 tbsp Mixed Nuts', kcal: 290, p: 28, c: 8, f: 16 },
    ] },
    { day: 'Saturday', meals: [
      { m: 'Café da Manhã', i: 'Misto Quente (Whole-Wheat, Lean Turkey, Light Cheese), 2 Eggs', kcal: 540, p: 38, c: 44, f: 22 },
      { m: 'Almoço', i: 'Feijoada Leve (Lean Pork & Beef, Black Beans), 1 cup Rice, Couve', kcal: 720, p: 58, c: 68, f: 22 },
      { m: 'Lanche', i: '1 scoop Whey, 1 cup Mixed Fruit', kcal: 250, p: 26, c: 30, f: 2 },
      { m: 'Jantar', i: '10 oz Picanha (lean), 1 cup Rice, 1/2 cup Beans, Vinagrete', kcal: 720, p: 62, c: 58, f: 26 },
      { m: 'Ceia', i: '1 cup Greek Yogurt, 1 tbsp Honey', kcal: 220, p: 22, c: 28, f: 2 },
    ] },
    { day: 'Sunday', meals: [
      { m: 'Café da Manhã', i: '3 Whole Eggs, 1 cup Oatmeal, 1 cup Papaya', kcal: 480, p: 30, c: 54, f: 14 },
      { m: 'Almoço', i: '8 oz Galinhada (Chicken & Rice), 1/2 cup Beans, Salad', kcal: 670, p: 58, c: 72, f: 12 },
      { m: 'Lanche', i: '1 cup Cottage Cheese, 1/2 cup Guava', kcal: 230, p: 26, c: 22, f: 4 },
      { m: 'Jantar', i: '8 oz Grilled Chicken, 8 oz Sweet Potato, Couve', kcal: 600, p: 60, c: 54, f: 12 },
      { m: 'Ceia', i: '2 scoops Casein, 1 tbsp Peanut Butter', kcal: 300, p: 50, c: 10, f: 12 },
    ] },
  ],
};

export const CUISINE_PLANS = {
  american: AMERICAN,
  mexican: MEXICAN,
  brazilian: BRAZILIAN,
};

// Sum a day's per-meal macros into the daily target totals the wheel/legend use.
export function dayTotals(day) {
  return (day?.meals || []).reduce(
    (acc, m) => ({
      kcal: acc.kcal + (m.kcal || 0),
      p: acc.p + (m.p || 0),
      c: acc.c + (m.c || 0),
      f: acc.f + (m.f || 0),
    }),
    { kcal: 0, p: 0, c: 0, f: 0 },
  );
}

// Today's weekday → index into DAYS (Mon=0 … Sun=6). Defaults the active tab.
export function todayIndex() {
  const js = new Date().getDay(); // 0=Sun … 6=Sat
  return (js + 6) % 7;            // → 0=Mon … 6=Sun
}
