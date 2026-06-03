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
// Diet Style — evocative regional regimes (prototype: "Mexico: Baja Coastal
// Seafood…", "US Pacific Northwest Hunter-Gatherer…"). The `id` is the wire value
// folded into the assign_nutrition payload; the label is the display string.
export const DIET_STYLES = [
  { id: 'baja_seafood', label: 'Mexico: Baja Coastal Seafood Lean-Bulk' },
  { id: 'pnw_hunter', label: 'US Pacific Northwest Hunter-Gatherer' },
  { id: 'med_sovereign', label: 'Mediterranean Sovereign Longevity' },
  { id: 'andes_endurance', label: 'Andes High-Altitude Endurance Load' },
  { id: 'nordic_cold', label: 'Nordic Cold-Adaptation Protocol' },
  { id: 'apex_carnivore', label: 'Apex Carnivore Metabolic Reset' },
  { id: 'paddy_glycogen', label: 'Pan-Asian Rice-Paddy Glycogen Load' },
  { id: 'savanna_lean', label: 'East-African Savanna Lean-Run' },
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

// EPIGENETIC CELL SIGNALING INDEX bars. `base` is the anchor %; the live value is
// re-derived per meal from its macro profile so the index shifts as you scan the
// week (see signalingFor()). The two-stop gradient is the prototype's per-bar fill.
export const EPIGENETIC_SIGNALS = [
  { key: 'mtor', label: 'mTOR Hypertrophy Synthesis', base: 68, from: 'var(--pur)', to: 'var(--yel)' },
  { key: 'satiety', label: 'Strategic Satiety Receptor Load', base: 55, from: 'var(--pur)', to: 'var(--grn)' },
  { key: 'endocrine', label: 'Endocrine Optimization Index', base: 50, from: 'var(--purd)', to: 'var(--gold-soft)' },
  { key: 'dna', label: 'Intra-Cellular DNA Repair Activation', base: 65, from: 'var(--purl)', to: 'var(--blu)' },
];

// Macro accent colors for the doughnut + legend + pills (prototype: Carbs gold,
// Protein purple, Fats muted lavender). Order matches the prototype legend.
export const MACRO_META = [
  { key: 'c', label: 'Carbs', color: 'var(--yel)' },
  { key: 'f', label: 'Fats', color: '#b9a7d6' },
  { key: 'p', label: 'Protein', color: 'var(--purl)' },
];

// ── The preloaded 7-day protocol (ancestral / hunter-gatherer regime) ─────────
// Shape per meal: { name, tag, kcal, macros:{p,c,f}, blurb, ingredients:[{q,item,tip}],
// prep:[step…], tutorialClass }. `tag` (e.g. 'SEED GENE') paints the gold meal badge.
const m = (name, kcal, p, c, f, blurb, ingredients, prep, tag = null, tutorialClass) => ({
  name, kcal, macros: { p, c, f }, blurb, ingredients, prep, tag,
  tutorialClass: tutorialClass || `#${400 + Math.floor(kcal % 90)}`,
});

export const WEEK_PROTOCOL = {
  mon: {
    breakfast: m(
      "Hunter's Morning Bison Scramble", 575, 45, 65, 15,
      'High-retinol ancestral open with pasture eggs and grass-fed bison for dense morning amino loading and steady cognitive clarity.',
      [
        { q: '6 oz', item: 'Ground Bison', tip: 'Sear hot and fast — bison is leaner than beef, so it overcooks in seconds.' },
        { q: '3 whole', item: 'Pasture-Raised Eggs', tip: 'Yolks carry the choline; never discard them on a hypertrophy block.' },
        { q: '1 cup', item: 'Cubed Sweet Potato', tip: 'Pre-roast in batches — the resistant starch feeds gut flora.' },
        { q: '1 handful', item: 'Wilted Kale', tip: 'Fold in off-heat to preserve heat-sensitive vitamin K.' },
      ],
      ['Render bison in a hot cast-iron skillet, 3–4 min.', 'Push to the side; soft-scramble the eggs in the rendered fat.', 'Fold in roasted sweet potato and kale, plate immediately.'],
      null, '#415',
    ),
    lunch: m(
      'Coastal Cedar-Plank Salmon Bowl', 690, 48, 58, 26,
      'Omega-dense midday intercept — wild salmon over fermented rice to synchronize anti-inflammatory signaling.',
      [
        { q: '7 oz', item: 'Wild Sockeye Salmon', tip: 'Skin-on, skin-down first — it crisps into a protective crust.' },
        { q: '3/4 cup', item: 'Fermented Jasmine Rice', tip: 'Day-old rice resists glucose spikes better than fresh.' },
        { q: '1 cup', item: 'Charred Broccolini', tip: 'Char develops sulforaphane precursors.' },
      ],
      ['Roast salmon on a soaked cedar plank at 400°F, 12 min.', 'Char broccolini in a dry pan.', 'Build the bowl rice-first, flake salmon on top.'],
      null, '#421',
    ),
    dinner: m(
      'Slow-Braised Elk Osso Buco', 760, 62, 44, 32,
      'Collagen-rich evening anabolic anchor — connective-tissue braise for joint-matrix repair during sleep.',
      [
        { q: '10 oz', item: 'Elk Shank', tip: 'Low and slow only — shank is pure connective tissue.' },
        { q: '2 cups', item: 'Bone Broth', tip: 'Reduce by a third to concentrate glycine.' },
        { q: '1 cup', item: 'Root Vegetable Medley', tip: 'Add in the final hour so they hold shape.' },
      ],
      ['Sear shank on all sides, deglaze with broth.', 'Braise covered at 300°F for 3 hours.', 'Add roots for the final 60 minutes; rest before plating.'],
      null, '#438',
    ),
    snack: m(
      'Collagen Berry Cryo-Smoothie', 295, 28, 30, 8,
      'Post-loading recovery whip — hydrolyzed collagen plus dark berries for connective repair and polyphenol cover.',
      [
        { q: '2 scoops', item: 'Hydrolyzed Collagen', tip: 'Pairs with vitamin C for synthesis — keep the berries.' },
        { q: '1 cup', item: 'Wild Blueberries', tip: 'Smaller wild berries pack more anthocyanin per gram.' },
        { q: '1/2 cup', item: 'Coconut Kefir', tip: 'Live cultures aid the satiety-receptor load.' },
      ],
      ['Blend frozen berries and kefir until smooth.', 'Add collagen last, pulse to combine without foaming.'],
      null, '#404',
    ),
  },
  tue: {
    breakfast: m(
      'Smoked Trout & Sweet Potato Hash', 540, 40, 60, 16,
      'Cold-smoked omega open with a slow-burning tuber base for sustained morning training fuel.',
      [
        { q: '5 oz', item: 'Cold-Smoked Trout', tip: 'Flake at the end so it does not turn rubbery.' },
        { q: '1.5 cups', item: 'Diced Sweet Potato', tip: 'Parboil 4 min before crisping for the perfect interior.' },
        { q: '2 whole', item: 'Soft-Poached Eggs', tip: 'The runny yolk is the sauce.' },
      ],
      ['Crisp sweet potato in ghee until golden.', 'Fold in flaked trout off-heat.', 'Crown with poached eggs.'],
      null, '#410',
    ),
    lunch: m(
      'Seed Gene Epigenetic Block', 660, 50, 52, 24,
      'Anti-inflammatory protein with raw complex seed-oil carriers and deliberately low-glycemic timing to bias chromatin signaling.',
      [
        { q: '7 oz', item: 'Pasture Chicken Thigh', tip: 'Thigh out-performs breast on iron and zinc.' },
        { q: '3 tbsp', item: 'Raw Pumpkin-Seed Oil', tip: 'Never heat it — the signaling lipids are heat-fragile.' },
        { q: '2 cups', item: 'Bitter Greens', tip: 'Bitterness primes bile flow for the seed-oil carriers.' },
      ],
      ['Grill chicken thigh to 165°F internal.', 'Dress greens raw with the seed oil.', 'Slice chicken over the dressed greens; do not cook the oil.'],
      'SEED GENE', '#447',
    ),
    dinner: m(
      'Wild Boar Chops & Charred Fennel', 720, 58, 40, 34,
      'Lean game protein with anise-forward fennel to support the evening endocrine optimization window.',
      [
        { q: '2', item: 'Wild Boar Chops', tip: 'Rest 8 minutes — game meat reabsorbs juices slowly.' },
        { q: '1 bulb', item: 'Charred Fennel', tip: 'Char concentrates the natural sweetness.' },
        { q: '1 tbsp', item: 'Tallow', tip: 'Stable at high heat, unlike seed oils.' },
      ],
      ['Sear chops in tallow, 4 min per side.', 'Char fennel wedges in the same pan.', 'Rest the chops, then plate with fennel.'],
      null, '#452',
    ),
    snack: m(
      'Raw Cacao Bone-Broth Cortado', 240, 22, 18, 9,
      'Savory-bitter recovery sip — glycine-rich broth with raw cacao for a magnesium and theobromine nudge.',
      [
        { q: '1 cup', item: 'Reduced Bone Broth', tip: 'Glycine here calms the nervous system pre-sleep.' },
        { q: '1 tbsp', item: 'Raw Cacao', tip: 'Raw retains far more magnesium than dutched.' },
      ],
      ['Warm broth gently — do not boil.', 'Whisk in cacao until frothy.'],
      null, '#406',
    ),
  },
  wed: {
    breakfast: m(
      'Grass-Fed Beef Liver and Onions', 575, 45, 65, 15,
      'A classic ancestral breakfast providing the highest concentration of retinol and B-vitamins for cognitive clarity.',
      [
        { q: '6 oz', item: 'Beef Liver', tip: 'Soak in lemon water 30 min to mellow the iron bite.' },
        { q: '1 large', item: 'White Onion', tip: 'Caramelize slowly to balance the liver minerality.' },
        { q: '1 cup', item: 'Boiled Potatoes', tip: 'A cooled potato gains resistant starch.' },
        { q: '1 tsp', item: 'Ghee', tip: 'High smoke point — protects the fat-soluble vitamins.' },
      ],
      ['Caramelize onions low and slow in ghee.', 'Sear liver 90 seconds per side — no more.', 'Plate over boiled potatoes, blanket with onions.'],
      null, '#415',
    ),
    lunch: m(
      'Oyster & Seaweed Mineral Bowl', 600, 42, 50, 22,
      'Zinc-saturated midday reset — raw and lightly poached oysters over iodine-dense seaweed.',
      [
        { q: '8', item: 'Pacific Oysters', tip: 'The most zinc-dense food on the planet — key for testosterone.' },
        { q: '1 cup', item: 'Wakame Seaweed', tip: 'Rinse to control the sodium load.' },
        { q: '3/4 cup', item: 'Black Rice', tip: 'Anthocyanin-rich — the dark pigment is the medicine.' },
      ],
      ['Poach half the oysters 60 seconds; keep half raw.', 'Hydrate wakame in cold water.', 'Layer rice, seaweed, then oysters.'],
      null, '#430',
    ),
    dinner: m(
      'Venison Tenderloin Over Squash', 740, 60, 46, 28,
      'Ultra-lean game tenderloin with roasted squash for a clean evening glycogen top-off.',
      [
        { q: '8 oz', item: 'Venison Tenderloin', tip: 'Pull at 130°F — venison goes to leather past medium-rare.' },
        { q: '2 cups', item: 'Roasted Kabocha', tip: 'Skin is edible and fiber-dense.' },
        { q: '1 tbsp', item: 'Juniper-Berry Rub', tip: 'Juniper cuts the gaminess beautifully.' },
      ],
      ['Rub tenderloin, sear hard, finish in a 375°F oven.', 'Roast kabocha wedges until caramelized.', 'Rest venison 10 min, slice against the grain.'],
      null, '#444',
    ),
    snack: m(
      'Sprouted Pumpkin-Seed Trail Cluster', 310, 16, 28, 18,
      'Crunchy mineral cluster — sprouted seeds and cacao nibs for a portable magnesium and zinc hit.',
      [
        { q: '1/3 cup', item: 'Sprouted Pumpkin Seeds', tip: 'Sprouting neutralizes phytic acid for better absorption.' },
        { q: '2 tbsp', item: 'Cacao Nibs', tip: 'Unsweetened — the bitterness blunts appetite.' },
        { q: '1 tbsp', item: 'Raw Honey', tip: 'Just enough to bind the cluster.' },
      ],
      ['Warm honey, toss seeds and nibs to coat.', 'Press flat and chill until set, then break into clusters.'],
      null, '#408',
    ),
  },
  thu: {
    breakfast: m(
      'Pemmican Power Skillet', 560, 44, 54, 20,
      'The original performance fuel — rendered tallow and dried meat reworked into a hot, dense morning skillet.',
      [
        { q: '4 oz', item: 'Bison Pemmican', tip: 'Crumble it — it melts into the skillet as the binder.' },
        { q: '2 whole', item: 'Duck Eggs', tip: 'Larger yolks, richer fat-soluble vitamin profile.' },
        { q: '1 cup', item: 'Shredded Cassava', tip: 'A clean, grain-free starch base.' },
      ],
      ['Crisp shredded cassava in the rendered pemmican fat.', 'Fold in crumbled pemmican.', 'Nestle in duck eggs, cover until set.'],
      null, '#412',
    ),
    lunch: m(
      'Sardine & Caper Power Salad', 580, 46, 36, 28,
      'Calcium-and-omega bomb — whole sardines deliver the bones, the brine drives the satiety load.',
      [
        { q: '2 tins', item: 'Wild Sardines', tip: 'Eat the soft bones — that is the calcium.' },
        { q: '2 tbsp', item: 'Capers', tip: 'The brine is a potent satiety signal.' },
        { q: '3 cups', item: 'Arugula', tip: 'Peppery greens prime digestion.' },
      ],
      ['Flake sardines over arugula.', 'Scatter capers, dress with olive oil and lemon.'],
      null, '#427',
    ),
    dinner: m(
      'Lamb Heart & Root Skewers', 700, 56, 42, 30,
      'Organ-meat skewers — CoQ10-dense heart for mitochondrial density and evening cardiac support.',
      [
        { q: '8 oz', item: 'Lamb Heart', tip: 'Heart is lean muscle, not offal-flavored — grill it like steak.' },
        { q: '1 cup', item: 'Cubed Beetroot', tip: 'Nitrates support the nightly endothelial reset.' },
        { q: '1 tbsp', item: 'Chimichurri', tip: 'Fresh herbs add polyphenol cover.' },
      ],
      ['Thread heart and beet onto skewers.', 'Grill over high heat to medium-rare.', 'Finish with a spoon of chimichurri.'],
      null, '#449',
    ),
    snack: m(
      'Greek-Style Tallow Whip', 280, 24, 16, 14,
      'Dense protein isolate whipped ice-cream style with a tallow base for a satisfying recovery dessert.',
      [
        { q: '1 scoop', item: 'Grass-Fed Whey Isolate', tip: 'Isolate is near lactose-free for sensitive guts.' },
        { q: '1 tbsp', item: 'Whipped Tallow', tip: 'Whips to a surprisingly light, airy texture.' },
        { q: '1/2 cup', item: 'Frozen Cherries', tip: 'Tart cherries aid sleep via natural melatonin.' },
      ],
      ['Whip tallow until airy.', 'Fold in whey and cherries, freeze 20 min.'],
      null, '#405',
    ),
  },
  fri: {
    breakfast: m(
      'Wild Salmon Roe & Avocado Toast', 590, 38, 56, 24,
      'Phospholipid-rich roe over sourdough — omega-3 and choline for an end-of-week cognitive surge.',
      [
        { q: '3 tbsp', item: 'Wild Salmon Roe', tip: 'The membrane carries phospholipid-bound DHA.' },
        { q: '1 slice', item: 'Sourdough', tip: 'Long ferment lowers the glycemic hit.' },
        { q: '1/2', item: 'Avocado', tip: 'The fat carries the fat-soluble vitamins.' },
      ],
      ['Toast sourdough, smash avocado over it.', 'Spoon roe across the top, finish with sea salt.'],
      null, '#414',
    ),
    lunch: m(
      'Bison Tartare Power Plate', 640, 52, 30, 34,
      'Raw lean bison preserves heat-fragile enzymes — the cleanest expression of ancestral protein.',
      [
        { q: '6 oz', item: 'Sushi-Grade Bison', tip: 'Hand-chop, never grind, for the right texture.' },
        { q: '1 whole', item: 'Quail Egg Yolk', tip: 'The yolk emulsifies the tartare.' },
        { q: '1 tbsp', item: 'Cold-Pressed Olive Oil', tip: 'Adds monounsaturated fat without heat damage.' },
      ],
      ['Hand-chop bison fine, season aggressively.', 'Fold in olive oil, crown with the quail yolk.'],
      null, '#433',
    ),
    dinner: m(
      'Duck Confit Over Cauliflower', 780, 54, 38, 42,
      'Slow-confit duck leg — a rich, fat-forward close to a hard training week.',
      [
        { q: '1', item: 'Duck Leg', tip: 'Confit in its own fat for fall-off-the-bone texture.' },
        { q: '2 cups', item: 'Roasted Cauliflower', tip: 'Roast until deeply browned for nuttiness.' },
        { q: '1 tbsp', item: 'Duck Fat', tip: 'Reuse the confit fat to roast the cauliflower.' },
      ],
      ['Confit duck leg low (250°F) until tender.', 'Crisp the skin under a broiler.', 'Roast cauliflower in the rendered duck fat.'],
      null, '#455',
    ),
    snack: m(
      'Fermented Honey Yogurt Cup', 260, 20, 26, 8,
      'Probiotic close — live-culture yogurt with fermented honey for gut-flora and satiety support.',
      [
        { q: '3/4 cup', item: 'Sheep-Milk Yogurt', tip: 'Often tolerated where cow dairy is not.' },
        { q: '1 tbsp', item: 'Fermented Honey', tip: 'The ferment adds wild probiotics.' },
        { q: '1 tbsp', item: 'Bee Pollen', tip: 'A trace-nutrient and amino dense topper.' },
      ],
      ['Spoon yogurt, swirl in fermented honey.', 'Top with bee pollen.'],
      null, '#403',
    ),
  },
  sat: {
    breakfast: m(
      'Elk Breakfast Sausage & Eggs', 600, 46, 50, 22,
      'House-ground elk sausage with pasture eggs — a hearty, slow-morning recovery plate.',
      [
        { q: '5 oz', item: 'Ground Elk', tip: 'Season with sage and fennel for a true breakfast-sausage profile.' },
        { q: '3 whole', item: 'Pasture Eggs', tip: 'Cook to your preference — the protein lands either way.' },
        { q: '1 cup', item: 'Hash-Browned Parsnip', tip: 'A sweeter, lower-glycemic potato swap.' },
      ],
      ['Form elk into patties, season, and sear.', 'Hash-brown parsnip in the rendered fat.', 'Fry eggs to finish the plate.'],
      null, '#416',
    ),
    lunch: m(
      'Mussels in Saffron Bone Broth', 560, 44, 44, 18,
      'Iron-and-iodine shellfish steam — mussels poached in a golden, mineral-dense broth.',
      [
        { q: '1.5 lb', item: 'Fresh Mussels', tip: 'Discard any that stay open before cooking.' },
        { q: '2 cups', item: 'Saffron Bone Broth', tip: 'Saffron adds crocin, a potent antioxidant.' },
        { q: '1', item: 'Grilled Sourdough', tip: 'For sopping the broth — eat every drop.' },
      ],
      ['Bring saffron broth to a simmer.', 'Add mussels, cover, steam until they open.', 'Serve with grilled sourdough.'],
      null, '#429',
    ),
    dinner: m(
      'Tomahawk Ribeye & Bone Marrow', 880, 64, 22, 56,
      'The weekend anabolic centerpiece — dry-aged ribeye with roasted marrow for maximal fat-soluble loading.',
      [
        { q: '14 oz', item: 'Dry-Aged Ribeye', tip: 'Reverse-sear for an edge-to-edge medium-rare.' },
        { q: '2', item: 'Marrow Bones', tip: 'Roast cut-side up until the marrow loosens.' },
        { q: '1 cup', item: 'Grilled Asparagus', tip: 'A clean green to cut the richness.' },
      ],
      ['Reverse-sear ribeye: low oven, then a blazing pan.', 'Roast marrow bones at 425°F, 15 min.', 'Grill asparagus, plate everything family-style.'],
      null, '#458',
    ),
    snack: m(
      'Dark Chocolate Brazil-Nut Bark', 320, 12, 24, 22,
      'Selenium-loaded bark — two Brazil nuts cover the daily requirement; 90% chocolate keeps sugar negligible.',
      [
        { q: '2 oz', item: '90% Dark Chocolate', tip: 'The higher the cacao, the lower the sugar.' },
        { q: '4', item: 'Brazil Nuts', tip: 'Two nuts is a full day of selenium — do not overdo it.' },
        { q: '1 pinch', item: 'Flaky Sea Salt', tip: 'Salt sharpens the chocolate.' },
      ],
      ['Melt chocolate gently, fold in chopped Brazil nuts.', 'Spread thin, salt, and chill until snappable.'],
      null, '#407',
    ),
  },
  sun: {
    breakfast: m(
      'Sunday Sovereign Steak & Eggs', 620, 50, 48, 24,
      'The flagship recovery breakfast — a clean sirloin with eggs to anchor the rest-day rebuild.',
      [
        { q: '6 oz', item: 'Top Sirloin', tip: 'A leaner cut for a rest-day calorie profile.' },
        { q: '3 whole', item: 'Pasture Eggs', tip: 'Basted in the steak drippings for flavor.' },
        { q: '1 cup', item: 'Sautéed Mushrooms', tip: 'Mushrooms add ergothioneine, a longevity antioxidant.' },
      ],
      ['Sear sirloin to medium-rare, rest.', 'Baste eggs in the drippings.', 'Sauté mushrooms, plate alongside the sliced steak.'],
      null, '#418',
    ),
    lunch: m(
      'Slow-Roast Lamb Shoulder Bowl', 700, 52, 50, 30,
      'A communal rest-day roast — falling-apart lamb over herbed cauliflower rice.',
      [
        { q: '8 oz', item: 'Pulled Lamb Shoulder', tip: 'Hours-long roast renders the connective tissue to silk.' },
        { q: '1.5 cups', item: 'Herbed Cauliflower Rice', tip: 'A low-carb base that soaks up the jus.' },
        { q: '2 tbsp', item: 'Mint Gremolata', tip: 'Mint cuts the lamb fat brilliantly.' },
      ],
      ['Slow-roast lamb shoulder until it shreds.', 'Pulse cauliflower into rice, sauté with herbs.', 'Pile lamb over the rice, finish with gremolata.'],
      null, '#435',
    ),
    dinner: m(
      'Whole Roasted Branzino', 660, 50, 34, 34,
      'A light, clean close to the week — whole-roasted fish for easy, complete protein before the next block.',
      [
        { q: '1 whole', item: 'Branzino', tip: 'Roasting on the bone keeps the flesh moist.' },
        { q: '1', item: 'Charred Lemon', tip: 'Charring sweetens and softens the acid.' },
        { q: '2 cups', item: 'Braised Greens', tip: 'A mineral-dense, low-calorie side.' },
      ],
      ['Stuff branzino with lemon and herbs, roast at 425°F.', 'Braise greens in broth.', 'Serve the whole fish over the greens.'],
      null, '#451',
    ),
    snack: m(
      'Tart Cherry & Gelatin Recovery Gummies', 230, 18, 24, 4,
      'Sleep-priming gummies — tart-cherry melatonin and gelatin glycine to set up the next training week.',
      [
        { q: '1 cup', item: 'Tart Cherry Juice', tip: 'A natural source of sleep-supporting melatonin.' },
        { q: '3 tbsp', item: 'Grass-Fed Gelatin', tip: 'Glycine here supports overnight tissue repair.' },
        { q: '1 tbsp', item: 'Raw Honey', tip: 'Just enough to round the tartness.' },
      ],
      ['Warm juice, bloom and dissolve gelatin.', 'Pour into molds, chill until set.'],
      null, '#402',
    ),
  },
};

// Oversight-console blueprint preview ("WHAT THEY GOT" — the 4 cards in the
// prototype). A generic, on-brand snapshot of the athlete's currently-assigned
// regime; the name is personalized at render time.
export const OVERSIGHT_BLUEPRINT = {
  cards: [
    { slot: 'Breakfast Repast', name: "{name}'s Energy Scramble", note: 'Pasture whole eggs, mineral oil, custom greens.' },
    { slot: 'Lunch Diet Sequence', name: 'SEED Gene Epigenetic Block', note: 'Anti-inflammatory proteins, raw complex seed-oil carriers, low-glycemic timing.', tag: 'SEED GENE' },
    { slot: 'Dinner Repast', name: 'Succulent Seared Protein Basin', note: 'High-density amino cutlets with steamed asparagus.' },
    { slot: 'Recovery Snack', name: 'Micellar Amino Satiety Whip', note: 'Dense protein isolates whipped ice-cream style.' },
  ],
  macros: { kcal: 2200, p: 175, c: 310, f: 75 },
};

// ── Pure helpers ──────────────────────────────────────────────────────────────

const clampPct = (v) => Math.max(2, Math.min(100, Math.round(v)));

// Re-derive the EPIGENETIC signaling bars for a meal: each bar's base anchor nudged
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
