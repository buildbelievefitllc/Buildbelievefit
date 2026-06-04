// src/components/command/nutritionLockerData.js
// ─────────────────────────────────────────────────────────────────────────────
// Static catalog + pure helpers for the admin NUTRITION LOCKER (NutritionLocker.jsx).
// Kept in a plain .js module so the .jsx file exports ONLY components (satisfies
// react-refresh/only-export-components — same split as chartUtils.js ↔ charts.jsx).
//
// This is the PRELOADED, high-fidelity protocol the Locker renders instantly while
// the live generation engine (assign_nutrition, Terminal H) is provisioning — the
// "standard preloaded plans load instantly" contract shown in the prototype console.
// The COMPILE action scales these macros to the chosen energy capacity + adapt
// amplitude, so the on-screen plan genuinely re-derives from the parameters.

// ── Parameter-console option sets ───────────────────────────────────────────
// Diet Style — straightforward, utilitarian performance categories (BBF_CULINARY_
// GOVERNOR: no pretentious regional or pseudo-scientific framing). The `id` is the
// wire value folded into the assign_nutrition payload; the label is the display string.
export const DIET_STYLES = [
  { id: 'standard_balance', label: 'Standard Macro Balance' },
  { id: 'high_protein', label: 'High-Protein Builder' },
  { id: 'carb_load', label: 'Performance Carb-Load' },
  { id: 'lean_deficit', label: 'Lean Deficit' },
  { id: 'anabolic_surplus', label: 'Anabolic Mass Surplus' },
  { id: 'maintenance_recomp', label: 'Maintenance Recomp' },
];

// Allergy Restrict Exemption — compounds to filter out of the compiled matrix.
export const ALLERGY_OPTIONS = [
  'None', 'Dairy-Free', 'Nut-Free', 'Gluten-Free', 'Shellfish-Free',
  'Egg-Free', 'Soy-Free', 'Nightshade-Free', 'Histamine-Conscious',
];

// Athletic Phase Assignment — the oversight-console training-block selector.
export const PHASE_OPTIONS = [
  'Cardio Endurance Overhaul', 'Anabolic Mass Accrual', 'Shred / Cut Protocol',
  'Metabolic Recomp', 'Maintenance / Longevity', 'Peak Week Taper',
];

// Base Daily Energy Capacity is a NUMBER input (per spec) — these power a <datalist>
// so the brutalist presets from the prototype ("2200 kcal (Lean Recomp)") stay one
// tap away without losing free numeric entry.
export const ENERGY_PRESETS = [
  { kcal: 1800, label: 'Cut / Shred' },
  { kcal: 2000, label: 'Lean Maintenance' },
  { kcal: 2200, label: 'Lean Recomp' },
  { kcal: 2500, label: 'Performance Fuel' },
  { kcal: 2800, label: 'Anabolic Surplus' },
  { kcal: 3200, label: 'Mass Accrual' },
];

export const DEFAULT_ENERGY = 2200;
export const ENERGY_MIN = 1000;
export const ENERGY_MAX = 6000;

// ── Intermittent fasting pace (FULLY OPTIONAL — CEO architectural override) ────
// 16/8 is NO LONGER hardcoded or assumed. Time-restricted feeding is opt-in: the
// Locker defaults to Off, and the coach dials a pace from these discrete intervals.
// `fast` + `eat` always total 24h; the slider/selector indexes this array, and
// index 0 (Off) disables time-restricted feeding entirely.
export const FASTING_PACES = [
  { id: 'off', label: 'Off / Disabled', short: 'OFF', fast: 0, eat: 24 },
  { id: '12:12', label: '12:12 · Circadian', short: '12:12', fast: 12, eat: 12 },
  { id: '14:10', label: '14:10 · Gentle', short: '14:10', fast: 14, eat: 10 },
  { id: '16:8', label: '16:8 · Standard', short: '16:8', fast: 16, eat: 8 },
  { id: '18:6', label: '18:6 · Advanced', short: '18:6', fast: 18, eat: 6 },
  { id: '20:4', label: '20:4 · Warrior', short: '20:4', fast: 20, eat: 4 },
];
// Default to Off — fasting is opt-in, never presumed for a client.
export const FASTING_DEFAULT_INDEX = 0;

// ── Week + meal-slot scaffolding ─────────────────────────────────────────────
export const DAYS = [
  { key: 'mon', label: 'Monday', n: 1 },
  { key: 'tue', label: 'Tuesday', n: 2 },
  { key: 'wed', label: 'Wednesday', n: 3 },
  { key: 'thu', label: 'Thursday', n: 4 },
  { key: 'fri', label: 'Friday', n: 5 },
  { key: 'sat', label: 'Saturday', n: 6 },
  { key: 'sun', label: 'Sunday', n: 7 },
];

export const MEAL_SLOTS = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'snack', label: 'Snack' },
];

// Volume multipliers for the "MULTIPLY COMPONENT VOLUME" toggle on a meal card.
export const VOLUME_MULTIPLIERS = [
  { x: 1, label: '1x Athlete' },
  { x: 2, label: '2x Partner' },
  { x: 3, label: '3x Batch Prep' },
];

// Metabolic Adapt Amplitude band — re-skews the compiled macro split. NOMINAL is
// the prototype's default; SHRED leans the split lower-carb, ANABOLIC pushes it up.
export const ADAPT_BANDS = [
  { id: -1, key: 'shred', label: 'Shred Adapt', tag: 'Shred', kcal: 0.88, carb: 0.78, prot: 1.12 },
  { id: 0, key: 'nominal', label: 'Nominal', tag: 'Nominal', kcal: 1, carb: 1, prot: 1 },
  { id: 1, key: 'bulk', label: 'Anabolic Bulk', tag: 'Anabolic', kcal: 1.14, carb: 1.2, prot: 1.06 },
];

// PERFORMANCE SIGNAL bars. `base` is the anchor %; the live value is re-derived per
// meal from its macro profile so the index shifts as you scan the week (see
// signalingFor()). The two-stop gradient is the per-bar fill.
export const EPIGENETIC_SIGNALS = [
  { key: 'mtor', label: 'Muscle-Building Drive', base: 68, from: 'var(--pur)', to: 'var(--yel)' },
  { key: 'satiety', label: 'Fullness & Satiety', base: 55, from: 'var(--pur)', to: 'var(--grn)' },
  { key: 'endocrine', label: 'Hormone Support', base: 50, from: 'var(--purd)', to: 'var(--gold-soft)' },
  { key: 'dna', label: 'Recovery & Repair', base: 65, from: 'var(--purl)', to: 'var(--blu)' },
];

// Macro accent colors for the doughnut + legend + pills (prototype: Carbs gold,
// Protein purple, Fats muted lavender). Order matches the prototype legend.
export const MACRO_META = [
  { key: 'c', label: 'Carbs', color: 'var(--yel)' },
  { key: 'f', label: 'Fats', color: '#b9a7d6' },
  { key: 'p', label: 'Protein', color: 'var(--purl)' },
];

// ── The preloaded 7-day protocol (budget meal-prep regime) ────────────────────
// Simple, accessible, grocery-store fuel rotating American / Mexican / Brazilian
// cuisines (BBF_CULINARY_GOVERNOR). Shape per meal: { name, tag, kcal, macros:{p,c,f},
// blurb, ingredients:[{q,item,tip}], prep:[step…], tutorialClass }. `tag` (e.g.
// 'HIGH PROTEIN') paints the gold meal badge.
const m = (name, kcal, p, c, f, blurb, ingredients, prep, tag = null, tutorialClass) => ({
  name, kcal, macros: { p, c, f }, blurb, ingredients, prep, tag,
  tutorialClass: tutorialClass || `#${400 + Math.floor(kcal % 90)}`,
});

export const WEEK_PROTOCOL = {
  // ── Monday · American ───────────────────────────────────────────────────────
  mon: {
    breakfast: m(
      'Turkey & Egg Breakfast Scramble', 575, 45, 65, 15,
      'Simple high-protein American breakfast — lean ground turkey and eggs over sweet potato to start the day.',
      [
        { q: '6 oz', item: 'Lean Ground Turkey', tip: 'Brown it first, then push aside to cook the eggs.' },
        { q: '3 whole', item: 'Eggs', tip: 'Soft-scramble them right in with the turkey.' },
        { q: '1 cup', item: 'Diced Sweet Potato', tip: 'Microwave 4 min first to speed up the cook.' },
        { q: '1 handful', item: 'Spinach', tip: 'Stir in at the end until just wilted.' },
      ],
      ['Brown the turkey in a non-stick pan, 5-6 min.', 'Push aside and soft-scramble the eggs.', 'Fold in sweet potato and spinach, plate hot.'],
      null, '#415',
    ),
    lunch: m(
      'Grilled Chicken & Rice Bowl', 690, 48, 58, 26,
      'Classic American meal-prep bowl — grilled chicken over jasmine rice with steamed broccoli.',
      [
        { q: '7 oz', item: 'Chicken Breast', tip: 'Grill to 165F internal, then rest before slicing.' },
        { q: '3/4 cup', item: 'Jasmine Rice', tip: 'Cook a big batch on prep day.' },
        { q: '1 cup', item: 'Broccoli', tip: 'Steam 4 min until bright green.' },
      ],
      ['Season and grill the chicken to 165F.', 'Steam the broccoli.', 'Build the bowl rice-first, slice chicken on top.'],
      null, '#421',
    ),
    dinner: m(
      'Lean Beef & Potato Skillet', 760, 62, 44, 32,
      'Hearty American skillet — lean ground beef with potatoes and green beans.',
      [
        { q: '8 oz', item: '93% Lean Ground Beef', tip: 'Drain any excess fat after browning.' },
        { q: '2 cups', item: 'Diced Potatoes', tip: 'Parboil 5 min so they crisp fast.' },
        { q: '1 cup', item: 'Green Beans', tip: 'Add in the last few minutes to keep the snap.' },
      ],
      ['Brown the beef, then set aside.', 'Crisp the potatoes in the same pan.', 'Add beef and green beans, toss and serve.'],
      null, '#438',
    ),
    snack: m(
      'Greek Yogurt & Berry Protein Cup', 295, 28, 30, 8,
      'Quick high-protein snack — Greek yogurt with a scoop of whey and blueberries.',
      [
        { q: '1 cup', item: 'Non-Fat Greek Yogurt', tip: 'Plain — you control the sugar.' },
        { q: '1 scoop', item: 'Whey Protein', tip: 'Stir in until smooth.' },
        { q: '1/2 cup', item: 'Blueberries', tip: 'Frozen works and costs less.' },
      ],
      ['Stir the whey into the yogurt.', 'Top with blueberries and serve cold.'],
      null, '#404',
    ),
  },
  // ── Tuesday · Mexican ───────────────────────────────────────────────────────
  tue: {
    breakfast: m(
      'Egg & Black Bean Breakfast Tacos', 540, 40, 60, 16,
      'Budget Mexican breakfast — scrambled eggs and black beans in warm corn tortillas.',
      [
        { q: '3 whole', item: 'Eggs', tip: 'Scramble soft so they stay tender.' },
        { q: '1/2 cup', item: 'Black Beans', tip: 'Canned and rinsed — fast and cheap.' },
        { q: '3', item: 'Corn Tortillas', tip: 'Warm in a dry pan to make them flexible.' },
        { q: '2 tbsp', item: 'Salsa', tip: 'Jarred salsa is a free flavor win.' },
      ],
      ['Scramble the eggs.', 'Warm the beans and tortillas.', 'Fill the tortillas with egg and beans, top with salsa.'],
      null, '#410',
    ),
    lunch: m(
      'Chicken Burrito Bowl', 660, 50, 52, 24,
      'High-protein Mexican burrito bowl — chicken, rice, black beans, and peppers.',
      [
        { q: '7 oz', item: 'Chicken Breast', tip: 'Season with cumin and chili powder.' },
        { q: '3/4 cup', item: 'White Rice', tip: 'Squeeze lime over it for cilantro-lime rice.' },
        { q: '1/2 cup', item: 'Black Beans', tip: 'Warm with a pinch of cumin.' },
        { q: '1 cup', item: 'Peppers & Onions', tip: 'Saute until just charred.' },
      ],
      ['Grill and slice the chicken.', 'Saute the peppers and onions.', 'Layer rice, beans, peppers, then chicken.'],
      'HIGH PROTEIN', '#447',
    ),
    dinner: m(
      'Ground Turkey Taco Skillet', 720, 58, 40, 34,
      'One-pan Mexican dinner — seasoned ground turkey with rice, peppers, and onions.',
      [
        { q: '8 oz', item: 'Lean Ground Turkey', tip: 'Season with a taco spice blend.' },
        { q: '3/4 cup', item: 'Rice', tip: 'Stir it right into the skillet.' },
        { q: '1 cup', item: 'Peppers & Onions', tip: 'The base of any good taco filling.' },
      ],
      ['Brown the turkey with taco seasoning.', 'Add peppers and onions, soften.', 'Fold in the cooked rice and serve.'],
      null, '#452',
    ),
    snack: m(
      'Cottage Cheese & Pineapple Cup', 240, 22, 18, 9,
      'Simple high-protein snack — cottage cheese with pineapple.',
      [
        { q: '1 cup', item: 'Low-Fat Cottage Cheese', tip: 'A cheap, slow-digesting protein.' },
        { q: '1/2 cup', item: 'Pineapple', tip: 'Canned in juice works fine.' },
      ],
      ['Spoon cottage cheese into a cup.', 'Top with pineapple.'],
      null, '#406',
    ),
  },
  // ── Wednesday · Brazilian ───────────────────────────────────────────────────
  wed: {
    breakfast: m(
      'Brazilian Eggs, Rice & Beans', 575, 45, 65, 15,
      'Everyday Brazilian breakfast — eggs over rice and black beans with a side of banana.',
      [
        { q: '3 whole', item: 'Eggs', tip: 'Fry or scramble, your call.' },
        { q: '3/4 cup', item: 'White Rice', tip: 'Leftover rice from prep day is perfect.' },
        { q: '1/2 cup', item: 'Black Beans', tip: 'Simmer with garlic for real feijao flavor.' },
        { q: '1', item: 'Banana', tip: 'A cheap, fast carb on the side.' },
      ],
      ['Warm the rice and beans.', 'Fry the eggs.', 'Plate eggs over rice and beans, banana on the side.'],
      null, '#415',
    ),
    lunch: m(
      'Frango com Arroz e Feijao', 600, 42, 50, 22,
      'Brazilian staple lunch — grilled chicken with rice and black beans.',
      [
        { q: '6 oz', item: 'Chicken Breast', tip: 'Season simply with salt, garlic, and lime.' },
        { q: '3/4 cup', item: 'White Rice', tip: 'The foundation of the plate.' },
        { q: '1/2 cup', item: 'Black Beans', tip: 'Budget protein that stretches the meal.' },
      ],
      ['Grill the chicken and slice.', 'Warm the rice and beans.', 'Plate it all together, family-style.'],
      null, '#430',
    ),
    dinner: m(
      'Brazilian Beef & Rice with Collard Greens', 740, 60, 46, 28,
      'Simple Brazilian dinner — lean beef over rice with sauteed collard greens.',
      [
        { q: '8 oz', item: 'Lean Ground Beef', tip: 'Brown well for the best flavor.' },
        { q: '3/4 cup', item: 'White Rice', tip: 'Cooks while the beef browns.' },
        { q: '2 cups', item: 'Collard Greens', tip: 'Slice thin and saute with garlic — classic couve.' },
      ],
      ['Brown the beef with garlic and onion.', 'Saute the sliced collards quickly over high heat.', 'Plate the beef and greens over rice.'],
      null, '#444',
    ),
    snack: m(
      'Banana & Peanut Butter Oats', 310, 16, 28, 18,
      'Portable snack — oats with banana and peanut butter.',
      [
        { q: '1/2 cup', item: 'Rolled Oats', tip: 'No-cook overnight oats save time.' },
        { q: '1', item: 'Banana', tip: 'Mash half of it in for natural sweetness.' },
        { q: '1 tbsp', item: 'Peanut Butter', tip: 'A cheap source of calories and healthy fat.' },
      ],
      ['Stir oats, mashed banana, and peanut butter together.', 'Eat right away or chill overnight.'],
      null, '#408',
    ),
  },
  // ── Thursday · American ─────────────────────────────────────────────────────
  thu: {
    breakfast: m(
      'Beef & Egg Breakfast Skillet', 560, 44, 54, 20,
      'Hearty American breakfast — lean ground beef and eggs with potatoes.',
      [
        { q: '4 oz', item: '93% Lean Ground Beef', tip: 'Brown it first for the base.' },
        { q: '3 whole', item: 'Eggs', tip: 'Scramble them into the beef.' },
        { q: '1 cup', item: 'Diced Potatoes', tip: 'Parboil to crisp them faster.' },
      ],
      ['Crisp the potatoes in the pan.', 'Brown the beef alongside.', 'Scramble in the eggs and serve.'],
      null, '#412',
    ),
    lunch: m(
      'Tuna & Rice Power Bowl', 580, 46, 36, 28,
      'Cheap, fast protein bowl — canned tuna over rice with mixed vegetables.',
      [
        { q: '2 cans', item: 'Canned Tuna', tip: 'In water; drain well. One of the cheapest proteins there is.' },
        { q: '3/4 cup', item: 'Rice', tip: 'Leftover rice keeps this a 5-minute lunch.' },
        { q: '1 cup', item: 'Mixed Vegetables', tip: 'Frozen steam-bag veg is fine.' },
      ],
      ['Flake the tuna over the rice.', 'Steam the vegetables.', 'Combine and season to taste.'],
      null, '#427',
    ),
    dinner: m(
      'Grilled Chicken & Sweet Potato Plate', 700, 56, 42, 30,
      'Clean American dinner — grilled chicken with roasted sweet potato and green beans.',
      [
        { q: '8 oz', item: 'Chicken Breast', tip: 'Grill to 165F and rest before slicing.' },
        { q: '1', item: 'Sweet Potato', tip: 'Roast or microwave until soft.' },
        { q: '1 cup', item: 'Green Beans', tip: 'Quick saute with a little salt.' },
      ],
      ['Grill the chicken.', 'Roast or microwave the sweet potato.', 'Saute the green beans and plate.'],
      null, '#449',
    ),
    snack: m(
      'Whey & Peanut Butter Shake', 280, 24, 16, 14,
      'Fast recovery shake — whey, milk, and peanut butter blended.',
      [
        { q: '1 scoop', item: 'Whey Protein', tip: 'Vanilla or chocolate both work.' },
        { q: '1 cup', item: 'Milk', tip: 'Adds protein and carbs cheaply.' },
        { q: '1 tbsp', item: 'Peanut Butter', tip: 'Blend in for richness.' },
      ],
      ['Blend everything with ice until smooth.', 'Drink right away.'],
      null, '#405',
    ),
  },
  // ── Friday · Mexican ────────────────────────────────────────────────────────
  fri: {
    breakfast: m(
      'Egg & Avocado Breakfast Burrito', 590, 38, 56, 24,
      'Filling Mexican breakfast — scrambled eggs, beans, and avocado in a flour tortilla.',
      [
        { q: '3 whole', item: 'Eggs', tip: 'Soft-scramble for the best texture.' },
        { q: '1', item: 'Flour Tortilla', tip: 'Warm it so it folds without cracking.' },
        { q: '1/2 cup', item: 'Pinto Beans', tip: 'Mash them slightly to hold the burrito together.' },
        { q: '1/2', item: 'Avocado', tip: 'A budget-friendly healthy fat.' },
      ],
      ['Scramble the eggs.', 'Warm the tortilla and beans.', 'Fill, add avocado, and roll.'],
      null, '#414',
    ),
    lunch: m(
      'Beef & Bean Burrito Bowl', 640, 52, 30, 34,
      'High-protein Mexican bowl — seasoned lean beef with beans and rice.',
      [
        { q: '6 oz', item: 'Lean Ground Beef', tip: 'Brown with taco seasoning.' },
        { q: '1/2 cup', item: 'Pinto Beans', tip: 'Warm with a little of the beef.' },
        { q: '1/2 cup', item: 'Rice', tip: 'Lime and salt make it pop.' },
      ],
      ['Brown the beef with seasoning.', 'Warm the beans and rice.', 'Layer it all in a bowl.'],
      null, '#433',
    ),
    dinner: m(
      'Chicken Fajita Rice Plate', 780, 54, 38, 42,
      'Mexican fajita dinner — chicken with peppers and onions over rice.',
      [
        { q: '8 oz', item: 'Chicken Breast', tip: 'Slice thin so it cooks fast.' },
        { q: '1.5 cups', item: 'Peppers & Onions', tip: 'High heat for that fajita char.' },
        { q: '3/4 cup', item: 'Rice', tip: 'Serve underneath to catch the juices.' },
      ],
      ['Sear the sliced chicken.', 'Add the peppers and onions, char quickly.', 'Pile it over the rice.'],
      null, '#455',
    ),
    snack: m(
      'Greek Yogurt & Honey Cup', 260, 20, 26, 8,
      'Simple snack — Greek yogurt with honey and banana.',
      [
        { q: '3/4 cup', item: 'Greek Yogurt', tip: 'Plain, non-fat keeps it lean.' },
        { q: '1 tbsp', item: 'Honey', tip: 'A small drizzle is plenty.' },
        { q: '1/2', item: 'Banana', tip: 'Slice it on top.' },
      ],
      ['Spoon yogurt into a cup.', 'Drizzle honey and add banana.'],
      null, '#403',
    ),
  },
  // ── Saturday · Brazilian ────────────────────────────────────────────────────
  sat: {
    breakfast: m(
      'Turkey Sausage & Eggs with Rice', 600, 46, 50, 22,
      'Hearty Brazilian-style breakfast — turkey sausage and eggs with a side of rice.',
      [
        { q: '5 oz', item: 'Turkey Sausage', tip: 'A leaner swap for pork sausage.' },
        { q: '3 whole', item: 'Eggs', tip: 'Fry or scramble to taste.' },
        { q: '3/4 cup', item: 'White Rice', tip: 'Leftover rice reheats perfectly.' },
      ],
      ['Brown the sausage.', 'Cook the eggs alongside.', 'Serve with warm rice.'],
      null, '#416',
    ),
    lunch: m(
      'Canja — Brazilian Chicken & Rice Soup', 560, 44, 44, 18,
      'Comforting Brazilian chicken-and-rice soup — simple, cheap, and filling.',
      [
        { q: '6 oz', item: 'Chicken Breast', tip: 'Shred it into the broth.' },
        { q: '3/4 cup', item: 'Rice', tip: 'Cook it right in the soup.' },
        { q: '1 cup', item: 'Carrots & Celery', tip: 'The cheap aromatic base.' },
      ],
      ['Simmer the chicken in broth, then shred.', 'Add rice, carrots, and celery.', 'Cook until the rice is tender.'],
      null, '#429',
    ),
    dinner: m(
      'Bife com Arroz — Brazilian Steak & Rice', 760, 62, 50, 28,
      'Weekend Brazilian plate — grilled sirloin with rice and black beans.',
      [
        { q: '8 oz', item: 'Top Sirloin', tip: 'An affordable steak cut — slice thin against the grain.' },
        { q: '3/4 cup', item: 'White Rice', tip: 'The classic base.' },
        { q: '1/2 cup', item: 'Black Beans', tip: 'Feijao rounds out the plate.' },
      ],
      ['Grill the sirloin to medium, rest, and slice.', 'Warm the rice and beans.', 'Plate together with a simple side salad.'],
      null, '#458',
    ),
    snack: m(
      'Banana Oat Energy Bites', 320, 12, 24, 22,
      'No-bake snack — oats, banana, and peanut butter rolled into bites.',
      [
        { q: '1 cup', item: 'Rolled Oats', tip: 'The base of the bite.' },
        { q: '1', item: 'Banana', tip: 'Mash it to bind everything.' },
        { q: '2 tbsp', item: 'Peanut Butter', tip: 'Holds the bites together.' },
      ],
      ['Mash the banana with the peanut butter.', 'Fold in the oats, roll into bites, and chill.'],
      null, '#407',
    ),
  },
  // ── Sunday · American ───────────────────────────────────────────────────────
  sun: {
    breakfast: m(
      'Steak & Eggs with Potatoes', 620, 50, 48, 24,
      'Classic American rest-day breakfast — lean sirloin with eggs and potatoes.',
      [
        { q: '6 oz', item: 'Top Sirloin', tip: 'A lean, affordable cut for steak and eggs.' },
        { q: '3 whole', item: 'Eggs', tip: 'Baste them in the pan drippings.' },
        { q: '1 cup', item: 'Diced Potatoes', tip: 'Crisp them while the steak rests.' },
      ],
      ['Sear the sirloin to medium, rest.', 'Crisp the potatoes.', 'Fry the eggs and plate with the sliced steak.'],
      null, '#418',
    ),
    lunch: m(
      'Chicken & Rice Meal-Prep Bowl', 700, 52, 50, 30,
      'The workhorse American prep bowl — chicken thigh over rice with vegetables.',
      [
        { q: '8 oz', item: 'Chicken Thigh', tip: 'Cheaper than breast and stays juicy.' },
        { q: '1 cup', item: 'Rice', tip: 'Batch-cook it for the week.' },
        { q: '1 cup', item: 'Mixed Vegetables', tip: 'Frozen veg keeps cost and waste down.' },
      ],
      ['Season and roast the chicken thighs.', 'Cook the rice.', 'Portion rice, veg, and chicken into containers.'],
      null, '#435',
    ),
    dinner: m(
      'Baked Tilapia & Rice Plate', 660, 50, 34, 34,
      'Light, cheap American fish dinner — baked tilapia with rice and broccoli.',
      [
        { q: '8 oz', item: 'Tilapia', tip: 'An inexpensive, mild white fish.' },
        { q: '3/4 cup', item: 'Rice', tip: 'A neutral base for the fish.' },
        { q: '1.5 cups', item: 'Broccoli', tip: 'Roast it alongside the fish.' },
      ],
      ['Season and bake the tilapia at 400F, 12 min.', 'Roast the broccoli.', 'Serve over the rice.'],
      null, '#451',
    ),
    snack: m(
      'Cottage Cheese & Berries', 230, 18, 24, 4,
      'Light high-protein close — cottage cheese with berries.',
      [
        { q: '3/4 cup', item: 'Low-Fat Cottage Cheese', tip: 'Slow protein before bed.' },
        { q: '1/2 cup', item: 'Mixed Berries', tip: 'Frozen and thawed works great.' },
      ],
      ['Spoon cottage cheese into a bowl.', 'Top with the berries.'],
      null, '#402',
    ),
  },
};

// Oversight-console blueprint preview ("WHAT THEY GOT" — the 4 cards in the
// prototype). A generic, on-brand snapshot of the athlete's currently-assigned
// regime; the name is personalized at render time.
export const OVERSIGHT_BLUEPRINT = {
  cards: [
    { slot: 'Breakfast', name: "{name}'s Protein Scramble", note: 'Eggs, lean ground turkey, potatoes, and spinach.' },
    { slot: 'Lunch', name: 'Chicken & Rice Power Bowl', note: 'Grilled chicken, rice, black beans, and vegetables.', tag: 'HIGH PROTEIN' },
    { slot: 'Dinner', name: 'Lean Beef & Potato Skillet', note: 'Lean ground beef, potatoes, and green beans.' },
    { slot: 'Recovery Snack', name: 'Greek Yogurt Protein Cup', note: 'Greek yogurt, whey, and berries.' },
  ],
  macros: { kcal: 2200, p: 175, c: 310, f: 75 },
};

// ── Pure helpers ──────────────────────────────────────────────────────────────

const clampPct = (v) => Math.max(2, Math.min(100, Math.round(v)));

// Re-derive the performance signal bars for a meal: each bar's base anchor nudged
// by the meal's macro emphasis, so scanning the week visibly moves the index.
export function signalingFor(meal) {
  const { p = 0, c = 0, f = 0 } = meal?.macros || {};
  const tot = p + c + f || 1;
  const pShare = p / tot, cShare = c / tot, fShare = f / tot;
  return EPIGENETIC_SIGNALS.map((s) => {
    let v = s.base;
    if (s.key === 'mtor') v = s.base + (pShare - 0.35) * 60; // protein drives synthesis
    if (s.key === 'satiety') v = s.base + (fShare - 0.25) * 70; // fat drives satiety
    if (s.key === 'endocrine') v = s.base + (fShare - 0.28) * 45; // fat supports hormones
    if (s.key === 'dna') v = s.base + (cShare - 0.4) * 30 + (pShare - 0.3) * 20;
    return { ...s, pct: clampPct(v) };
  });
}

// Scale a meal's kcal + macros to the chosen energy capacity and adapt band. The
// base protocol is anchored at DEFAULT_ENERGY; we scale proportionally, then apply
// the band's per-macro skew. This is what makes COMPILE genuinely re-derive the plan.
export function scaleMeal(meal, energy, band) {
  const b = ADAPT_BANDS.find((x) => x.id === (band?.id ?? band)) || ADAPT_BANDS[1];
  const ratio = (Number(energy) || DEFAULT_ENERGY) / DEFAULT_ENERGY;
  const p = Math.round(meal.macros.p * ratio * b.prot);
  const c = Math.round(meal.macros.c * ratio * b.carb);
  const f = Math.round(meal.macros.f * ratio);
  const kcal = Math.round(meal.kcal * ratio * b.kcal);
  return { ...meal, kcal, macros: { p, c, f } };
}

// Whole-day kcal/macros (sum of the four scaled slots) — used for the day summary.
export function dayTotals(dayKey, energy, band) {
  const day = WEEK_PROTOCOL[dayKey];
  if (!day) return { kcal: 0, p: 0, c: 0, f: 0 };
  return MEAL_SLOTS.reduce((acc, slot) => {
    const sm = scaleMeal(day[slot.key], energy, band);
    return { kcal: acc.kcal + sm.kcal, p: acc.p + sm.macros.p, c: acc.c + sm.macros.c, f: acc.f + sm.macros.f };
  }, { kcal: 0, p: 0, c: 0, f: 0 });
}

// Resolve a fasting pace by slider/selector index (clamped) — the single source of
// truth so the slider, the tick buttons and the readout never disagree.
export function paceByIndex(i) {
  const n = Math.max(0, Math.min(FASTING_PACES.length - 1, Math.round(Number(i)) || 0));
  return FASTING_PACES[n];
}

// The eating window for a pace, anchored to an 8pm (20:00) dinner cutoff so the
// athlete gets a real clock to act on. Off ⇒ the whole day is open (never crosses
// midnight for any supported pace, so start/end stay same-day and simple).
export function eatingWindow(pace) {
  if (!pace || pace.fast <= 0) return { open: true, startH: 0, endH: 24 };
  const endH = 20;
  const startH = (endH - pace.eat + 24) % 24;
  return { open: false, startH, endH };
}

// 12-hour clock label for an integer hour (0–24) — e.g. 12 → "12:00 PM".
export function clockLabel(h) {
  const hr = ((h % 24) + 24) % 24;
  const ampm = hr < 12 ? 'AM' : 'PM';
  const display = hr % 12 === 0 ? 12 : hr % 12;
  return `${display}:00 ${ampm}`;
}

// Per-macro caloric contribution + share of the day, for the macro-tracking rings
// (Protein/Carbs = 4 kcal/g, Fat = 9 kcal/g). Pure — derives from day totals.
export function macroTracks(totals) {
  const kcal = totals?.kcal || 0;
  const parts = [
    { key: 'p', label: 'Protein', grams: totals?.p || 0, perG: 4, color: 'var(--purl)' },
    { key: 'c', label: 'Carbs', grams: totals?.c || 0, perG: 4, color: 'var(--yel)' },
    { key: 'f', label: 'Fats', grams: totals?.f || 0, perG: 9, color: '#b9a7d6' },
  ];
  return parts.map((p) => {
    const cals = p.grams * p.perG;
    return { ...p, cals, pct: kcal ? Math.round((cals / kcal) * 100) : 0 };
  });
}

// Resolve a diet-style id → its display label (falls back to the raw id).
export function dietStyleLabel(id) {
  return DIET_STYLES.find((d) => d.id === id)?.label || id || '—';
}

// Today's day key (Mon-indexed), so the Locker opens on the current weekday.
export function todayKey() {
  const js = new Date().getDay(); // 0 = Sun … 6 = Sat
  return DAYS[(js + 6) % 7].key;
}

// Build the full assign_nutrition plan payload from the current scheduler state —
// the scaled 7-day protocol in the { name, cal, goal, days:[{day, meals:[{m,i}]}] }
// shape the roster/meal renderer already understands (mealData.js), plus the macro
// targets so the server can persist them on the athlete row in one write.
export function buildPlanPayload({ dietStyleId, energy, band, fastingPaceId = 'off' }) {
  const days = DAYS.map((d) => ({
    day: d.label,
    meals: MEAL_SLOTS.map((slot) => {
      const meal = scaleMeal(WEEK_PROTOCOL[d.key][slot.key], energy, band);
      const macros = `~${meal.kcal} cal/${meal.macros.p}g P`;
      const items = meal.ingredients.map((ing) => `${ing.q} ${ing.item}`).join(', ');
      return { m: `${slot.label} — ${meal.name}`, i: `${items} (${macros})` };
    }),
  }));
  const tot = DAYS.reduce((a, d) => a + dayTotals(d.key, energy, band).kcal, 0);
  // Optional time-restricted-feeding directive — 'off' (default) carries 0 fast
  // hours so a consuming surface never assumes 16/8 (the CEO override).
  const pace = FASTING_PACES.find((p) => p.id === fastingPaceId) || FASTING_PACES[0];
  return {
    name: dietStyleLabel(dietStyleId),
    cal: `~${Math.round(tot / 7).toLocaleString()} cal/day`,
    goal: dietStyleLabel(dietStyleId),
    fasting: pace.id,
    fasting_hours: pace.fast,
    days,
  };
}
