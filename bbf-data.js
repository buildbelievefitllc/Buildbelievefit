// ═══════════════════════════════════════════════════════════════════
// BBF-DATA.JS — Build Believe Fit LLC
// All static data: workout plans, meal plans, personas, prehab, vault
// Loaded before bbf-app.html script block executes
// ═══════════════════════════════════════════════════════════════════

// ─── STORAGE ──────────────────────────────────────────────────────
var K = 'bbf_v7';
function GD() {
  try { return JSON.parse(localStorage.getItem(K)) || {u:{},l:{},w:{}}; }
  catch(e) { return {u:{},l:{},w:{}}; }
}
function SD(d) { localStorage.setItem(K, JSON.stringify(d)); }

// ─── WORKOUT PLANS ────────────────────────────────────────────────
var WP = {
  ana_spring: [
    {day:'Monday',focus:'Arms & Back',exercises:[
      {name:'Biceps Curls',equipment:'Dumbbells or Cable',sets:4,reps:'10-12',notes:'Control the eccentric — slow on the way down'},
      {name:'Triceps Pushdowns',equipment:'Cable',sets:4,reps:'10-12',notes:'Pin elbows to ribs, extend fully'},
      {name:'Shoulder Press',equipment:'Dumbbells or Machine',sets:4,reps:'10-12',notes:'Keep core tight, no arching'},
      {name:'Lat Pulldown',equipment:'Machine',sets:4,reps:'10-12',notes:'Drive elbows down, lean back slightly'},
      {name:'Seated Cable Rows',equipment:'Cable',sets:4,reps:'10-12',notes:'Squeeze shoulder blades at the top'},
      {name:'Abs',equipment:'Mat or Machine',sets:3,reps:'12-15',notes:'Controlled, exhale on contraction'}
    ]},
    {day:'Tuesday',focus:'Glutes',exercises:[
      {name:'Hip Thrust',equipment:'Barbell or Machine',sets:4,reps:'12-15',notes:'2-second squeeze at the top'},
      {name:'Hip Abduction',equipment:'Machine',sets:4,reps:'12-15',notes:'Slow and controlled'},
      {name:'Back Extensions',equipment:'Machine',sets:4,reps:'12-15',notes:'Glute focus, not lower back'},
      {name:'Romanian Deadlifts',equipment:'Dumbbells',sets:3,reps:'12-15',notes:'Hinge at hips, feel the stretch'}
    ]},
    {day:'Wednesday',focus:'Chest & Arms',exercises:[
      {name:'Incline Dumbbell Press',equipment:'Dumbbells or Machine',sets:4,reps:'10-12',notes:'Elbows at 45 degrees'},
      {name:'Dumbbell Flyes',equipment:'Dumbbells or Pec Deck',sets:3,reps:'12-15',notes:'Wide arc, feel the chest stretch'},
      {name:'Overhead Triceps Extension',equipment:'Cable',sets:3,reps:'12-15',notes:'Keep elbows forward'},
      {name:'Hammer Curls',equipment:'Dumbbells',sets:3,reps:'10-12',notes:'Neutral grip, no swinging'},
      {name:'Abdominal Crunches',equipment:'Mat',sets:3,reps:'15-20',notes:'Exhale at top'}
    ]},
    {day:'Thursday',focus:'Full Leg Day',exercises:[
      {name:'Leg Press',equipment:'Machine',sets:4,reps:'10-12',notes:'Higher foot placement, no locked knees'},
      {name:'Hack Squats',equipment:'Machine',sets:4,reps:'10-12',notes:'Feet shoulder-width'},
      {name:'Hamstring Curls',equipment:'Machine',sets:3,reps:'12-15',notes:'Full ROM, squeeze at top'},
      {name:'Cable Hip Extension',equipment:'Cable',sets:3,reps:'12-15',notes:'Full glute squeeze'},
      {name:'Bulgarian Split Squats',equipment:'Dumbbells',sets:3,reps:'10-12 per leg',notes:'Chest up, knee tracks over toes'}
    ]},
    {day:'Friday',focus:'Arms & Back',exercises:[
      {name:'Chest Press',equipment:'Machine',sets:4,reps:'10-12',notes:'Full ROM'},
      {name:'Shoulder Press',equipment:'Machine',sets:3,reps:'10-12',notes:'Core tight'},
      {name:'Triceps Extension',equipment:'Machine',sets:3,reps:'10-12',notes:'Elbows fixed'},
      {name:'Lat Pulldown',equipment:'Machine',sets:3,reps:'10-12',notes:'Drive elbows down'},
      {name:'Bicep Curl',equipment:'Machine',sets:3,reps:'10-12',notes:'Slow negative'},
      {name:'Back Extension',equipment:'Machine',sets:3,reps:'15-20',notes:'Controlled'}
    ]},
    {day:'Saturday',focus:'Rest',exercises:[],isRest:true},
    {day:'Sunday',focus:'Rest',exercises:[],isRest:true}
  ],
  jacky_plan: [
    {day:'Day 1',focus:'Glute Focus',exercises:[
      {name:'Hip Thrusts',equipment:'Barbell or Machine',sets:4,reps:'12',notes:'2-second hold at top'},
      {name:'Romanian Deadlifts',equipment:'Barbell or Dumbbells',sets:4,reps:'12',notes:'Feel the hamstring stretch'},
      {name:'Bulgarian Split Squats',equipment:'Dumbbells',sets:4,reps:'12',notes:'Chest up'},
      {name:'Hip Abductions',equipment:'Machine',sets:4,reps:'12',notes:'Controlled tempo'},
      {name:'Back Extensions',equipment:'Machine',sets:4,reps:'12',notes:'Glute focus'},
      {name:'Cardio',equipment:'Treadmill',sets:1,reps:'30 min',notes:'3 mph, Level 6 incline'}
    ]},
    {day:'Day 2',focus:'Push — Chest/Shoulders/Triceps',exercises:[
      {name:'Chest Press',equipment:'Bench/Smith/Dumbbell',sets:4,reps:'12',notes:'Elbows at 45 degrees'},
      {name:'Incline Press',equipment:'Dumbbells',sets:4,reps:'12',notes:'Upper chest focus'},
      {name:'Triceps Overhead Extension',equipment:'Cable',sets:4,reps:'12',notes:'Elbows forward'},
      {name:'Triceps Pushdowns',equipment:'Cable',sets:4,reps:'12',notes:'Pin elbows'},
      {name:'Shoulder Circuit',equipment:'Dumbbells',sets:4,reps:'12',notes:'Lead with elbows'},
      {name:'Cardio',equipment:'Treadmill',sets:1,reps:'30 min',notes:'3 mph, Level 6'}
    ]},
    {day:'Day 3',focus:'Full Leg Day',exercises:[
      {name:'Squat Variations',equipment:'Barbell/Smith/Hack',sets:4,reps:'12',notes:'Below parallel'},
      {name:'Leg Extensions',equipment:'Machine',sets:4,reps:'12',notes:'Squeeze at top'},
      {name:'Reverse Kickbacks',equipment:'Cable',sets:4,reps:'12',notes:'Glute squeeze'},
      {name:'Hip Abductors',equipment:'Machine',sets:4,reps:'12',notes:'Controlled'},
      {name:'Seated Calf Raises',equipment:'Machine',sets:4,reps:'12',notes:'Full ROM'},
      {name:'Cardio',equipment:'Treadmill',sets:1,reps:'30 min',notes:'3 mph, Level 6'}
    ]},
    {day:'Day 4',focus:'Pull — Back & Biceps',exercises:[
      {name:'Lat Pulldown',equipment:'Machine',sets:4,reps:'12',notes:'Drive elbows down'},
      {name:'Seated Row',equipment:'Cable',sets:4,reps:'12',notes:'Squeeze shoulder blades'},
      {name:'MTS Pulldown',equipment:'Machine',sets:4,reps:'12',notes:'Full stretch at top'},
      {name:'Preacher Curls',equipment:'Machine',sets:4,reps:'12',notes:'No swinging'},
      {name:'Cardio',equipment:'Treadmill',sets:1,reps:'30 min',notes:'3 mph, Level 6'}
    ]},
    {day:'Day 5',focus:'Cardio & Abs',exercises:[
      {name:'Cardio',equipment:'Bike/Elliptical/Treadmill',sets:1,reps:'30 min',notes:'Low-impact preferred'},
      {name:'Abs Circuit',equipment:'Mat',sets:3,reps:'15-20',notes:'3-4 exercises, controlled'}
    ]},
    {day:'Day 6',focus:'Rest',exercises:[],isRest:true,restNote:'Active recovery. Hydration and stretching.'},
    {day:'Day 7',focus:'Rest',exercises:[],isRest:true,restNote:'Complete rest.'}
  ],
  suzanna_plan: [
    {day:'Day 1',focus:'Full Leg Day',exercises:[
      {name:'Leg Press',equipment:'Machine',sets:3,reps:'12',notes:'Start 170-175 lbs'},
      {name:'Bulgarian Split Squats',equipment:'Dumbbells',sets:3,reps:'12',notes:'Chest up — balance and depth'},
      {name:'Leg Extensions',equipment:'Machine',sets:3,reps:'12',notes:'50 lbs — squeeze quads'},
      {name:'Hamstring Curls',equipment:'Machine (Lying)',sets:3,reps:'12',notes:'60 lbs — full ROM'},
      {name:'Seated Calf Raises',equipment:'Machine',sets:3,reps:'15',notes:'30 lbs — slow on the way down'}
    ]},
    {day:'Day 2',focus:'Upper Body Push',exercises:[
      {name:'DB Chest Press',equipment:'Dumbbells',sets:3,reps:'12',notes:'Elbows at 45 degrees'},
      {name:'DB Shoulder Press',equipment:'Dumbbells',sets:3,reps:'12',notes:'Control the negative'},
      {name:'Lateral Raises',equipment:'Dumbbells',sets:3,reps:'15',notes:'Lead with elbows'},
      {name:'Tricep Pushdowns',equipment:'Cable',sets:3,reps:'12',notes:'Pin elbows to ribs'}
    ]},
    {day:'Day 3',focus:'Glute Focus',exercises:[
      {name:'Smith Machine Hip Thrusts',equipment:'Smith Machine',sets:4,reps:'12',notes:'2-second squeeze at the top'},
      {name:'DB Romanian Deadlifts',equipment:'Dumbbells',sets:3,reps:'12',notes:'Feel the hamstring stretch'},
      {name:'Cable Kickbacks',equipment:'Cable',sets:3,reps:'15',notes:'Straight leg — glute squeeze'},
      {name:'Hip Abduction Machine',equipment:'Machine',sets:3,reps:'20',notes:'Slow and controlled'},
      {name:'Glute-Bias Back Extensions',equipment:'Machine',sets:3,reps:'15',notes:'Rounded upper back'}
    ]},
    {day:'Day 4',focus:'Upper Body Pull',exercises:[
      {name:'Lat Pulldown',equipment:'Machine',sets:3,reps:'12',notes:'Drive elbows down'},
      {name:'Seated Cable Row',equipment:'Cable',sets:3,reps:'12',notes:'Squeeze shoulder blades'},
      {name:'Face Pulls',equipment:'Cable',sets:3,reps:'15',notes:'Pull toward forehead'},
      {name:'Dumbbell Bicep Curls',equipment:'Dumbbells',sets:3,reps:'12',notes:'No swinging — strict form'}
    ]},
    {day:'Day 5',focus:'Rest',exercises:[],isRest:true,restNote:'Rest or light activity. 45 min incline cardio optional.'},
    {day:'Day 6',focus:'Rest',exercises:[],isRest:true},
    {day:'Day 7',focus:'Rest',exercises:[],isRest:true}
  ],
  jordan_wayne: [
    {day:'Day 1',focus:'Upper Body Push',focus_cue:'Time Under Tension — 3-second eccentric every rep',exercises:[
      {name:'DB Flat Bench Press',equipment:'Dumbbells',sets:4,reps:'10-12',notes:'Full ROM — pause at bottom. 3-sec eccentric.'},
      {name:'Seated DB Shoulder Press',equipment:'Dumbbells',sets:4,reps:'10-12',notes:'Vertical torso — no arching.'},
      {name:'Machine Chest Flys',equipment:'Machine',sets:4,reps:'10-12',notes:'1-second squeeze at peak.'},
      {name:'Lateral Raises',equipment:'Dumbbells',sets:4,reps:'10-12',notes:'Lead with elbows.'},
      {name:'Rope Tricep Pushdowns',equipment:'Cable',sets:4,reps:'10-12',notes:'Flare rope at bottom. 3-sec return.'}
    ]},
    {day:'Day 2',focus:'Upper Body Pull',focus_cue:'Postural Health — scapular retraction every rep',exercises:[
      {name:'Lat Pulldowns',equipment:'Machine',sets:4,reps:'10-12',notes:'Drive elbows — no momentum.'},
      {name:'Seated Cable Rows',equipment:'Cable',sets:4,reps:'10-12',notes:'Full scapular retraction.'},
      {name:'Face Pulls',equipment:'Cable',sets:4,reps:'10-12',notes:'External rotation focus.'},
      {name:'Hammer Curls',equipment:'Dumbbells',sets:4,reps:'10-12',notes:'Neutral grip — no swinging.'},
      {name:'Back Extensions',equipment:'Machine',sets:4,reps:'10-12',notes:'Glute and erector focus.'}
    ]},
    {day:'Day 3',focus:'Lower Body',focus_cue:'Control descent — drive through mid-foot/heel',exercises:[
      {name:'Heavy Leg Press',equipment:'Machine',sets:4,reps:'10-12',notes:'Feet shoulder-width — no locked knees.'},
      {name:'Goblet Squats',equipment:'Dumbbell',sets:4,reps:'10-12',notes:'Chest high — depth and knee tracking.'},
      {name:'Leg Extensions',equipment:'Machine',sets:4,reps:'10-12',notes:'Superset with Leg Curls — no rest.'},
      {name:'Leg Curls',equipment:'Machine',sets:4,reps:'10-12',notes:'Slow eccentric — hips into pad.'},
      {name:'Calf Raises',equipment:'Machine',sets:4,reps:'10-12',notes:'Full stretch — 2-sec hold at peak.'}
    ]},
    {day:'Day 4',focus:'Full Body & Core',focus_cue:'Quality over Quantity — high stability',exercises:[
      {name:'Incline DB Press',equipment:'Dumbbells',sets:4,reps:'10-12',notes:'Target clavicular pec.'},
      {name:'Single Arm DB Rows',equipment:'Dumbbell',sets:4,reps:'10-12',notes:'Anti-rotation — hips square.'},
      {name:'Walking Lunges',equipment:'Dumbbells',sets:4,reps:'20 steps',notes:'Balance and knee stability.'},
      {name:'Plank',equipment:'Bodyweight',sets:3,reps:'60 sec',notes:'Hollow body — squeeze glutes.'},
      {name:'Supported Knee Raises',equipment:'Dip Bars',sets:3,reps:'12-15',notes:'Vertical compression.'}
    ]},
    {day:'Day 5',focus:'Rest',exercises:[],isRest:true,restNote:'Active recovery. Hydrate and stretch.'},
    {day:'Day 6',focus:'Rest',exercises:[],isRest:true},
    {day:'Day 7',focus:'Rest',exercises:[],isRest:true}
  ]
};

// ─── MEAL PLANS ───────────────────────────────────────────
var MP = {
  ana_bbf: {name:'Ana',cal:'~1,520 cal/day',goal:'Lean & Energized',days:[
    {day:'Day 1',meals:[{m:'Breakfast',i:'1/2 cup Oats, 2 oz Cottage Cheese, 1/2 cup Blueberries (~320 cal/32g P)'},{m:'Lunch',i:'4 oz Chicken, 1/2 cup Brown Rice, 1 cup Mixed Greens (~385 cal/40g P)'},{m:'Snack',i:'2 Hard-Boiled Eggs (~120 cal/25g P)'},{m:'Dinner',i:'5 oz 93% Ground Beef, 1 cup Asparagus, 1 Medium Sweet Potato (~525 cal/45g P)'},{m:'Snack 2',i:'1 cup Cottage Cheese, 1/2 cup Strawberries (~170 cal/18g P)'}]},
    {day:'Day 2',meals:[{m:'Breakfast',i:'3 Egg Whites, 2 oz Ground Turkey, Spinach, 1/4 Avocado'},{m:'Lunch',i:'Leftover Lean Beef & Sweet Potato from Day 1'},{m:'Snack',i:'1.5 cups Non-Fat Greek Yogurt'},{m:'Dinner',i:'4 oz Sirloin Steak, 1 cup Stir-Fry Veggies, 1 cup Jasmine Rice'},{m:'Snack 2',i:'Protein Bar (~150 cal/15g P)'}]},
    {day:'Day 3',meals:[{m:'Breakfast',i:'1 cup Greek Yogurt, 1/2 cup Blackberries, 1/4 cup Walnuts'},{m:'Lunch',i:'4 oz Chicken, 1/2 cup Brown Rice, 1 cup Mixed Greens'},{m:'Snack',i:'2 Hard-Boiled Eggs'},{m:'Dinner',i:'4 oz Turkey Meatballs, 1 cup Whole-Wheat Pasta, 1/2 cup Marinara'},{m:'Snack 2',i:'2 Hard-Boiled Eggs'}]},
    {day:'Day 4',meals:[{m:'Breakfast',i:'1/2 cup Oats, 2 oz Cottage Cheese, 1/2 cup Sliced Banana'},{m:'Lunch',i:'5 oz 93% Ground Beef, 1 cup Beans, 1/2 cup Tomato, 1 cup Bell Pepper'},{m:'Snack',i:'1.5 cups Greek Yogurt'},{m:'Dinner',i:'5 oz Chicken, 1 cup Sweet Potato, 1 cup Onions & Peppers Hash'},{m:'Snack 2',i:'1 oz Almonds (~23 nuts)'}]},
    {day:'Day 5',meals:[{m:'Breakfast',i:'3 Egg Whites, 2 oz Ground Turkey, 1 slice Whole-Wheat Toast'},{m:'Lunch',i:'Leftover Chicken & Sweet Potato Hash from Day 4'},{m:'Snack',i:'2 Hard-Boiled Eggs'},{m:'Dinner',i:'5 oz Ground Turkey, 1/2 cup Jasmine Rice, 1 cup Zucchini'},{m:'Snack 2',i:'1 cup Cottage Cheese, 1/2 cup Pineapple'}]},
    {day:'Day 6',meals:[{m:'Breakfast',i:'1 cup Greek Yogurt, 1/2 cup Peaches, 1/4 cup Walnuts'},{m:'Lunch',i:'4 oz Chicken, 1/2 cup Jasmine Rice, 1 cup Mixed Greens'},{m:'Snack',i:'1.5 cups Greek Yogurt'},{m:'Dinner',i:'4 oz Sirloin, 1 cup Asparagus, 1 cup Brown Rice'},{m:'Snack 2',i:'2 Hard-Boiled Eggs'}]},
    {day:'Day 7',meals:[{m:'Breakfast',i:'1/2 cup Oats, 2 oz Cottage Cheese, 1/2 cup Sliced Banana'},{m:'Lunch',i:'Leftover Steak & Brown Rice from Day 6'},{m:'Snack',i:'2 Hard-Boiled Eggs'},{m:'Dinner',i:'5 oz Turkey Patty, Whole-Wheat Bun, 1 cup Sweet Potato Wedges, Side Salad'},{m:'Snack 2',i:'Protein Bar (~150 cal/15g P)'}]}
  ]},
  jacky_bbf: {name:'Jacky',cal:'~1,800 cal/day',goal:'High-Protein Recomposition',days:[
    {day:'Day 1',meals:[{m:'Breakfast',i:'4 oz Scrambled Eggs, 1/2 cup Oatmeal, 1 cup Berries'},{m:'Lunch',i:'5 oz Grilled Chicken, 1 cup Mixed Greens, Light Vinaigrette'},{m:'Dinner',i:'6 oz Baked Salmon, 1 Medium Sweet Potato, 1/2 cup Broccoli'}]},
    {day:'Day 2',meals:[{m:'Breakfast',i:'1/2 cup Greek Yogurt, 1/4 cup Granola, 1 tbsp Honey'},{m:'Lunch',i:'5 oz Lean Beef Stir-Fry, 1 cup Brown Rice, 1/2 cup Mixed Veggies'},{m:'Dinner',i:'6 oz Chicken Skewers, 1 cup Quinoa, 1/2 cup Roasted Asparagus'}]},
    {day:'Day 3',meals:[{m:'Breakfast',i:'4 oz Turkey Sausage, 1/2 cup Cottage Cheese, 1 slice Whole-Wheat Toast'},{m:'Lunch',i:'Leftover Dinner from Day 2'},{m:'Dinner',i:'6 oz Cod Fillet, 1 cup Couscous, 1 cup Brussels Sprouts'}]},
    {day:'Day 4',meals:[{m:'Breakfast',i:'1 scoop Protein Powder, 1 cup Milk, 1 tbsp Peanut Butter (Smoothie)'},{m:'Lunch',i:'5 oz Turkey Breast Wrap, 1 Wrap, 1/4 cup Hummus'},{m:'Dinner',i:'6 oz Lean Steak, 1 Large Baked Potato, 1 cup Green Beans'}]},
    {day:'Day 5',meals:[{m:'Breakfast',i:'4 oz Scrambled Egg Whites, 1/2 Avocado, 1 slice Whole-Grain Bread'},{m:'Lunch',i:'Leftover Dinner from Day 4'},{m:'Dinner',i:'6 oz Ground Turkey Chili, 1/2 cup Rice'}]},
    {day:'Day 6',meals:[{m:'Breakfast',i:'4 oz Greek Yogurt Parfait, 1/2 cup Fruit, 1/4 cup Nuts'},{m:'Lunch',i:'5 oz Tuna Salad, Light Mayo, 2 slices Whole-Wheat Bread'},{m:'Dinner',i:'6 oz Grilled Chicken, 1 cup Pasta with Pesto, 1/2 cup Side Salad'}]},
    {day:'Day 7',meals:[{m:'All Meals',i:'Flexible — stay within your calorie and protein targets.'}]}
  ]},
  suzanna_bbf: {name:'Suzanna',cal:'~1,640 cal/day',goal:'Fat Loss — Balanced Macros (Bilingual)',days:[
    {day:'Día 1',meals:[{m:'Desayuno / Breakfast',i:'3 claras + 1 huevo, 1/2 taza avena, 1/2 taza bayas | 3 egg whites, 1 egg, 1/2 cup oats, 1/2 cup berries'},{m:'Almuerzo / Lunch',i:'5 oz pollo, 1/2 taza arroz integral, 1 taza brócoli | 5 oz chicken, 1/2 cup brown rice, 1 cup broccoli'},{m:'Merienda / Snack',i:'1 manzana, 10 almendras | 1 apple, 10 almonds'},{m:'Cena / Dinner',i:'5 oz salmón, 4 oz camote, 1 taza espárragos | 5 oz salmon, 4 oz sweet potato, 1 cup asparagus'}]},
    {day:'Día 2',meals:[{m:'Desayuno / Breakfast',i:'1 taza yogur griego 0%, 1/2 taza fresas, 1 cda chía | 1 cup 0% Greek yogurt, 1/2 cup strawberries, 1 tbsp chia'},{m:'Almuerzo / Lunch',i:'5 oz pavo molido, 1/2 taza quinoa, 1 taza ejotes | 5 oz ground turkey, 1/2 cup quinoa, 1 cup green beans'},{m:'Merienda / Snack',i:'1 plátano, 1 medida proteína | 1 banana, 1 scoop whey'},{m:'Cena / Dinner',i:'5 oz sirloin, 1/2 taza papas rojas, 1 taza calabacín | 5 oz sirloin, 1/2 cup red potatoes, 1 cup zucchini'}]},
    {day:'Día 3',meals:[{m:'Desayuno / Breakfast',i:'2 rebanadas pan integral, 1/4 aguacate, 2 huevos | 2 slices wheat toast, 1/4 avocado, 2 boiled eggs'},{m:'Almuerzo / Lunch',i:'5 oz tilapia, 1/2 taza arroz jazmín, 1 taza pimientos | 5 oz tilapia, 1/2 cup jasmine rice, 1 cup peppers'},{m:'Merienda / Snack',i:'1/2 taza requesón, 1/2 taza piña | 1/2 cup cottage cheese, 1/2 cup pineapple'},{m:'Cena / Dinner',i:'5 oz carne 93/7, 1/2 taza pasta integral, 1 taza espinacas | 5 oz 93/7 beef, 1/2 cup wheat pasta, 1 cup spinach'}]},
    {day:'Día 4',meals:[{m:'Desayuno / Breakfast',i:'Hotcakes proteína: 1 medida suero, 2 claras, 1/4 taza avena | Protein pancakes: 1 scoop whey, 2 egg whites, 1/4 cup oats'},{m:'Almuerzo / Lunch',i:'5 oz pollo, ensalada verde grande | 5 oz chicken, large green salad'},{m:'Merienda / Snack',i:'1 pera, 10 nueces | 1 pear, 10 walnuts'},{m:'Cena / Dinner',i:'5 oz lomo cerdo, 1/2 taza arroz integral, 1 taza coles Bruselas | 5 oz pork tenderloin, 1/2 cup brown rice, 1 cup brussels sprouts'}]},
    {day:'Día 5',meals:[{m:'Desayuno / Breakfast',i:'3 claras, 1 huevo revuelto con vegetales, 1 rebanada pan | 3 egg whites, 1 egg scrambled with veggies, 1 slice wheat toast'},{m:'Almuerzo / Lunch',i:'5 oz salmón, 4 oz camote, 1 taza coliflor | 5 oz salmon, 4 oz sweet potato, 1 cup cauliflower'},{m:'Merienda / Snack',i:'1 taza yogur griego, 1/2 taza bayas | 1 cup Greek yogurt, 1/2 cup berries'},{m:'Cena / Dinner',i:'5 oz pavo molido, 2 tortillas maíz, 1/4 aguacate, pico de gallo | 5 oz ground turkey, 2 corn tortillas, 1/4 avocado, pico de gallo'}]},
    {day:'Día 6',meals:[{m:'Desayuno / Breakfast',i:'1/2 taza avena, 1 medida proteína, 1 cda crema maní | 1/2 cup oats, 1 scoop whey, 1 tbsp peanut butter'},{m:'Almuerzo / Lunch',i:'5 oz sirloin, 1/2 taza quinoa, 1 taza brócoli | 5 oz sirloin, 1/2 cup quinoa, 1 cup broccoli'},{m:'Merienda / Snack',i:'2 huevos duros, 1 taza zanahorias | 2 boiled eggs, 1 cup carrots'},{m:'Cena / Dinner',i:'5 oz camarones, 1 taza vegetales, 1/2 taza arroz jazmín | 5 oz shrimp, 1 cup veggies, 1/2 cup jasmine rice'}]},
    {day:'Día 7',meals:[{m:'Desayuno / Breakfast',i:'2 huevos, 2 rebanadas tocino pavo, 1 taza fruta | 2 eggs, 2 slices turkey bacon, 1 cup mixed fruit'},{m:'Almuerzo / Lunch',i:'5 oz chili de carne | 5 oz lean beef chili'},{m:'Merienda / Snack',i:'1 medida proteína, 1 manzana | 1 scoop whey, 1 apple'},{m:'Cena / Dinner',i:'5 oz pollo, 4 oz camote, 1 taza espárragos | 5 oz chicken, 4 oz sweet potato, 1 cup asparagus'}]}
  ]},
  jordan_bbf: {name:'Jordan',cal:'~2,900 cal/day',goal:'Performance & Muscle Building',days:[
    {day:'Monday',meals:[{m:'Breakfast',i:'6 Egg Whites, 2 Whole Eggs, 1 cup Oatmeal (dry)'},{m:'Lunch',i:'8 oz Grilled Chicken, 1.5 cups Jasmine Rice, 1 cup Broccoli'},{m:'Dinner',i:'8 oz Lean Ground Turkey, 8 oz Sweet Potato, 1 cup Asparagus'}]},
    {day:'Tuesday',meals:[{m:'Breakfast',i:'2 scoops Whey, 1 cup Oats, 2 tbsp Peanut Butter (Blended)'},{m:'Lunch',i:'8 oz Tilapia, 1.5 cups Brown Rice, 1 cup Green Beans'},{m:'Dinner',i:'8 oz Sirloin Steak (lean), 1.5 cups Jasmine Rice, Mixed Salad'}]},
    {day:'Wednesday',meals:[{m:'Breakfast',i:'6 Egg Whites, 2 Whole Eggs, 2 slices Ezekiel Toast'},{m:'Lunch',i:'8 oz Ground Beef (93/7), 1.5 cups Jasmine Rice, 1 cup Zucchini'},{m:'Dinner',i:'8 oz Salmon, 8 oz Sweet Potato, 1 cup Roasted Cauliflower'}]},
    {day:'Thursday',meals:[{m:'Breakfast',i:'1.5 cups Greek Yogurt (Plain), 1 cup Berries, 1/4 cup Granola'},{m:'Lunch',i:'8 oz Grilled Chicken, 1.5 cups Brown Rice, 1 cup Spinach'},{m:'Dinner',i:'8 oz Ground Turkey, 1.5 cups Jasmine Rice, 1 cup Broccoli'}]},
    {day:'Friday',meals:[{m:'Breakfast',i:'6 Egg Whites, 2 Whole Eggs, 1 cup Oatmeal (dry)'},{m:'Lunch',i:'8 oz Salmon, 1.5 cups Jasmine Rice, 1 cup Asparagus'},{m:'Dinner',i:'8 oz Lean Ground Beef, 8 oz Sweet Potato, Mixed Greens'}]},
    {day:'Saturday',meals:[{m:'Breakfast',i:'3 Whole Eggs, 1 cup Cream of Rice, 1 cup Blueberries'},{m:'Lunch',i:'8 oz Grilled Chicken, 1.5 cups Jasmine Rice, 1 cup Broccoli'},{m:'Dinner',i:'8 oz Tilapia, 1.5 cups Brown Rice, 1 cup Green Beans'}]},
    {day:'Sunday',meals:[{m:'Breakfast',i:'6 Egg Whites, 2 Whole Eggs, 2 slices Ezekiel Toast'},{m:'Lunch',i:'8 oz Ground Turkey, 1.5 cups Jasmine Rice, 1 cup Zucchini'},{m:'Dinner',i:'8 oz Salmon, 8 oz Sweet Potato, 1 cup Asparagus'}]}
  ]},
  wayne_bbf: {name:'Wayne',cal:'~2,200 cal/day',goal:'Lean Down — Fat Loss',days:[
    {day:'Monday',meals:[{m:'Breakfast',i:'4 Egg Whites, 2 Whole Eggs, 1/2 cup Oatmeal (dry)'},{m:'Lunch',i:'6 oz Grilled Chicken, 1 cup Jasmine Rice, 1 cup Broccoli'},{m:'Dinner',i:'6 oz Lean Ground Turkey, 6 oz Sweet Potato, 1 cup Asparagus'}]},
    {day:'Tuesday',meals:[{m:'Breakfast',i:'2 scoops Whey, 1/2 cup Oats, 1 tbsp Peanut Butter (Blended)'},{m:'Lunch',i:'6 oz Tilapia, 1 cup Brown Rice, 1 cup Green Beans'},{m:'Dinner',i:'6 oz Sirloin (90/10), 1 cup Jasmine Rice, Mixed Salad'}]},
    {day:'Wednesday',meals:[{m:'Breakfast',i:'4 Egg Whites, 2 Whole Eggs, 2 slices Ezekiel Toast'},{m:'Lunch',i:'6 oz Ground Beef (93/7), 1 cup Jasmine Rice, 1 cup Zucchini'},{m:'Dinner',i:'6 oz Salmon, 6 oz Sweet Potato, 1 cup Roasted Cauliflower'}]},
    {day:'Thursday',meals:[{m:'Breakfast',i:'1 cup Greek Yogurt (Plain), 1/2 cup Berries, 2 tbsp Granola'},{m:'Lunch',i:'6 oz Grilled Chicken, 1 cup Brown Rice, 1 cup Spinach'},{m:'Dinner',i:'6 oz Ground Turkey, 1 cup Jasmine Rice, 1 cup Broccoli'}]},
    {day:'Friday',meals:[{m:'Breakfast',i:'4 Egg Whites, 2 Whole Eggs, 1/2 cup Oatmeal (dry)'},{m:'Lunch',i:'6 oz Salmon, 1 cup Jasmine Rice, 1 cup Asparagus'},{m:'Dinner',i:'6 oz Lean Ground Beef, 6 oz Sweet Potato, Mixed Greens'}]},
    {day:'Saturday',meals:[{m:'Breakfast',i:'2 Whole Eggs, 1/2 cup Cream of Rice, 1/2 cup Blueberries'},{m:'Lunch',i:'6 oz Grilled Chicken, 1 cup Jasmine Rice, 1 cup Broccoli'},{m:'Dinner',i:'6 oz Tilapia, 1 cup Brown Rice, 1 cup Green Beans'}]},
    {day:'Sunday',meals:[{m:'Breakfast',i:'4 Egg Whites, 2 Whole Eggs, 2 slices Ezekiel Toast'},{m:'Lunch',i:'6 oz Ground Turkey, 1 cup Jasmine Rice, 1 cup Zucchini'},{m:'Dinner',i:'6 oz Salmon, 6 oz Sweet Potato, 1 cup Asparagus'}]}
  ]}
};

// ─── SEED DATA ────────────────────────────────────────────
(function() {
  var d = GD();
  if (!d.u.akeem)     d.u.akeem     = {name:'Akeem Brown', pin:'8137', role:'trainer', type:'Trainer',   goal:'Head Coach — Build Believe Fit',                    gw:'', plan:null};
  if (!d.u.ana_bbf)   d.u.ana_bbf   = {name:'Ana',         pin:'2026', role:'client',  type:'In-Person', goal:'Spring 2026 — Arms, Glutes & Full Body',            gw:'', plan:'ana_spring'};
  if (!d.u.jacky_bbf) d.u.jacky_bbf = {name:'Jacky',       pin:'3456', role:'client',  type:'In-Person', goal:'5-Day Comprehensive Program',                       gw:'', plan:'jacky_plan'};
  if (!d.u.suzanna_bbf) d.u.suzanna_bbf = {name:'Suzanna', pin:'5678', role:'client',  type:'In-Person', goal:'4-Day Strength — Planet Fitness (Watson & Buckeye)', gw:'', plan:'suzanna_plan'};
  if (!d.u.jordan_bbf) d.u.jordan_bbf = {name:'Jordan',    pin:'1111', role:'client',  type:'In-Person', goal:'Performance & Longevity — 4-Day with Wayne',        gw:'', plan:'jordan_wayne', partner:'wayne_bbf'};
  if (!d.u.wayne_bbf)  d.u.wayne_bbf  = {name:'Wayne',     pin:'2222', role:'client',  type:'In-Person', goal:'Performance & Longevity — 4-Day with Jordan',       gw:'', plan:'jordan_wayne', partner:'jordan_bbf'};
  ['akeem','ana_bbf','jacky_bbf','suzanna_bbf','jordan_bbf','wayne_bbf'].forEach(function(k) {
    if (!d.l[k]) d.l[k] = [];
    if (!d.w[k]) d.w[k] = {};
  });
  SD(d);
})();

// ─── STATE ────────────────────────────────────────────────
var CU = null, VC = null, EX = [], MOOD = '', TYPE = 'strength';
var WC = null, SDAY = 0, PLAN = null;

// ─── CORE UI ──────────────────────────────────────────────

function TAB(name) {
  document.querySelectorAll('.tp').forEach(function(p) { p.classList.remove('on'); });
  document.querySelectorAll('.nv').forEach(function(b) { b.classList.remove('on'); });
  var pane = document.getElementById('tp-' + name);
  if (pane) pane.classList.add('on');
  var btn = document.querySelector('.nv[data-tab="' + name + '"]');
  if (btn) btn.classList.add('on');
  if (name === 'home')      RH();
  if (name === 'workout')   RW();
  if (name === 'nutrition') RN();
  if (name === 'prehab') renderPrehab();
  if (name === 'profile') { PTAB('overview'); }
}

function TOAST(msg) {
  var t = document.getElementById('toast');
  t.innerHTML = msg;
  t.classList.add('on');
  setTimeout(function() { t.classList.remove('on'); }, 2800);
}

function today() { return new Date().toISOString().slice(0, 10); }

function FMT(dt) {
  if (!dt) return '';
  var d = new Date(dt + 'T12:00:00');
  return d.toLocaleDateString('en-US', {month:'short', day:'numeric'});
}

function TL(t) {
  return {strength:'&#x1F4AA; Strength', cardio:'&#x1F3C3; Cardio', hiit:'&#x1F525; HIIT',
          mobility:'&#x1F9D8; Mobility', rest:'&#x1F634; Rest', note:'&#x1F4CB; Note'}[t] || t;
}

function LWT(logs) {
  var w = logs.filter(function(l) { return l.wt; }).sort(function(a,b) { return b.date.localeCompare(a.date); });
  return w.length ? w[0].wt : null;
}

function STREAK(logs) {
  var dates = [];
  var seen = {};
  logs.forEach(function(l) { if (l.type !== 'note' && !seen[l.date]) { seen[l.date] = 1; dates.push(l.date); } });
  dates.sort().reverse();
  if (!dates.length) return 0;
  var s = 0, cur = new Date();
  for (var i = 0; i < dates.length; i++) {
    var dd = new Date(dates[i] + 'T12:00:00');
    if (Math.round((cur - dd) / 86400000) <= 1) { s++; cur = dd; } else break;
  }
  return s;
}

function TWKL(logs) {
  var ws = new Date(); ws.setDate(ws.getDate() - ws.getDay());
  return logs.filter(function(l) {
    if (l.type === 'note') return false;
    return new Date(l.date + 'T12:00:00') >= ws;
  }).length;
}

// ─── AUTH ─────────────────────────────────────────────────
function LOGIN() {
  var user = document.getElementById('u').value.trim().toLowerCase();
  var pin  = document.getElementById('p').value.trim();
  var msg  = document.getElementById('lmsg');
  msg.className = 'amsg';
  if (!user || !pin) { msg.textContent = 'Please enter username and PIN.'; return; }
  var d = GD();
  if (!d.u[user] || d.u[user].pin !== pin) { msg.textContent = 'Incorrect username or PIN.'; return; }
  CU = user;
  VC = (user === 'akeem') ? null : user;
  ENTER();
}

function REGISTER() {
  var name = document.getElementById('rn').value.trim();
  var user = document.getElementById('ru').value.trim().toLowerCase().replace(/\s+/g, '_');
  var pin  = document.getElementById('rp').value.trim();
  var type = document.getElementById('rt').value;
  var goal = document.getElementById('rg').value.trim();
  var msg  = document.getElementById('rmsg');
  msg.className = 'amsg';
  if (!name || !user || !pin) { msg.textContent = 'Please fill in all required fields.'; return; }
  if (!/^\d{4}$/.test(pin))  { msg.textContent = 'PIN must be exactly 4 digits.'; return; }
  var d = GD();
  if (d.u[user]) { msg.textContent = 'Username already taken. Try another.'; return; }
  d.u[user] = {name:name, pin:pin, role:'client', type:type, goal:goal, gw:'', plan:null};
  d.l[user] = []; d.w[user] = {};
  SD(d);
  msg.textContent = 'Profile created! Signing you in...';
  msg.className = 'amsg ok';
  setTimeout(function() { CU = user; VC = user; ENTER(); }, 900);
}

function ENTER() {
  SS('app');
  document.getElementById('ld').value = today();
  // Pull any data submitted from the website Pathfinder form
  try {
    var webData = JSON.parse(localStorage.getItem('bbf_pathfinder') || 'null');
    if (webData && webData.email) {
      var d = GD();
      var uid = CU;
      if (d.u[uid]) {
        if (webData.goal && !d.u[uid].goal)   d.u[uid].goal = webData.goal;
        if (webData.weight && !d.u[uid].wt_start) d.u[uid].wt_start = webData.weight;
        if (webData.schedule) {
          d.u[uid].schedule = webData.schedule;
          // Auto-derive stress mode from persona
          var pDef = PERSONAS[webData.schedule];
          if (pDef && !d.u[uid].stress_mode) d.u[uid].stress_mode = pDef.type;
        }
        if (webData.tdee_target) d.u[uid].tdee_target = webData.tdee_target;
        SD(d);
      }
      localStorage.removeItem('bbf_pathfinder'); // consume once
    }
  } catch(e) {}
  if (CU === 'akeem') {
    SETUP_TRAINER();
  } else {
    VC = CU;
    LP();
    RA();
  }
}

function LP() {
  var d = GD();
  var uid = VC || CU;
  var u = d.u[uid] || {};
  PLAN = u.plan ? WP[u.plan] : null;
}

function SETUP_TRAINER() {
  var d = GD();
  var clients = Object.entries(d.u).filter(function(e) { return e[1].role === 'client'; });
  document.getElementById('trswitch').style.display = 'block';
  document.getElementById('tnfwrap').style.display = 'block';
  var roadmap = document.getElementById('founder-roadmap-wrap');
  if (roadmap) roadmap.style.display = 'block';
  var chips = document.getElementById('cchips');
  chips.innerHTML = '';
  if (!clients.length) {
    chips.innerHTML = '<span style="color:var(--mut);font-size:.8rem">No clients yet</span>';
    VC = null; RA(); return;
  }
  clients.forEach(function(e, i) {
    var k = e[0], u = e[1];
    var c = document.createElement('button');
    c.className = 'cp' + (i === 0 ? ' on' : '');
    c.textContent = u.name;
    c.onclick = function() {
      document.querySelectorAll('.cp').forEach(function(x) { x.classList.remove('on'); });
      c.classList.add('on');
      VC = k; LP(); RA(); RW();
    };
    chips.appendChild(c);
  });
  VC = clients[0][0];
  LP(); RA();
}

function RA() {
  RT(); RH(); RP(); RW();
  var uid = VC || CU;
  renderPersonaBadge(uid);
  var d = GD(); var u = d.u[uid] || {};
  var stressType = u.stress_mode || getPersona(uid).type;
  updateStressToggleUI(stressType);
}

// ─── TOPBAR ───────────────────────────────────────────────
function RT() {
  var d = GD();
  var uid = VC || CU;
  var u = d.u[uid] || {};
  document.getElementById('tbu').textContent = CU === 'akeem' ? 'Trainer' : (u.name || uid || '').split(' ')[0];
  document.getElementById('tbav').textContent = ((u.name || uid || '?')[0]).toUpperCase();
}

// ─── HOME ─────────────────────────────────────────────────
function RH() {
  var d = GD();
  var uid = VC || CU;
  var u = d.u[uid] || {};
  var logs = d.l[uid] || [];
  document.getElementById('hname').textContent = (u.name || uid || '').split(' ')[0] || '—';
  document.getElementById('hmeta').textContent = (u.goal || '').substring(0, 50);
  document.getElementById('hstreak').textContent = STREAK(logs);
  document.getElementById('qtot').textContent = logs.filter(function(l) { return l.type !== 'note'; }).length;
  document.getElementById('qwk').textContent = TWKL(logs);
  var lw = LWT(logs);
  document.getElementById('qwt').textContent = lw ? lw + ' lbs' : '—';
  if (PLAN) {
    var di = new Date().getDay() % PLAN.length;
    document.getElementById('qfoc').textContent = (PLAN[di] && PLAN[di].focus || '—').split(' ')[0];
  } else {
    document.getElementById('qfoc').textContent = '—';
  }
  var notes = logs.filter(function(l) { return l.type === 'note'; }).slice(-2).reverse();
  var cnw = document.getElementById('cnwrap');
  if (notes.length) {
    cnw.style.display = 'block';
    document.getElementById('cnlist').innerHTML = notes.map(function(n) {
      return '<div class="cn2"><div class="cnh"><span>&#x1F4CB;</span><span class="cnl">Coach Note</span><span class="cnd">' + FMT(n.date) + '</span></div><div class="cnt">' + n.notes + '</div></div>';
    }).join('');
  } else { cnw.style.display = 'none'; }
  var recent = logs.filter(function(l) { return l.type !== 'note'; }).slice(-5).reverse();
  var rl = document.getElementById('rlist');
  if (!recent.length) {
    rl.innerHTML = '<div class="emp"><div class="ei">&#x1F3CB;</div><div class="et">No sessions yet — get after it!</div></div>';
    return;
  }
  rl.innerHTML = recent.map(function(l) {
    return '<div class="ri"><div><div class="rd">' + FMT(l.date) + '</div><div class="rt2">' + TL(l.type) + '</div></div><div class="rv">' + (l.dur ? l.dur + 'm' : '') + '</div></div>';
  }).join('');
}

// ─── WORKOUT ──────────────────────────────────────────────
function RW() {
  var nav = document.getElementById('dnav');
  var con = document.getElementById('wcon');
  if (!PLAN) {
    nav.innerHTML = '';
    con.innerHTML = '<div class="rdc"><div class="rdi">&#x1F4CB;</div><div class="rdt">No Program</div><div class="rds">Akeem will assign your workout plan.</div></div>';
    return;
  }
  nav.innerHTML = PLAN.map(function(day, i) {
    return '<button class="dbn' + (i === SDAY ? ' on' : '') + '" onclick="SELDAY(' + i + ')">' + day.day + '</button>';
  }).join('');
  RDW();
}

function SELDAY(i) {
  SDAY = i;
  document.querySelectorAll('.dbn').forEach(function(b, idx) { b.classList.toggle('on', idx === i); });
  RDW();
}

function RDW() {
  var con = document.getElementById('wcon');
  if (!PLAN) return;
  var day = PLAN[SDAY];
  var d = GD();
  var uid = VC || CU;
  var wl = d.w[uid] || {};
  var dk = today() + '_d' + SDAY;
  var saved = wl[dk] || {};
  var partner = d.u[uid] && d.u[uid].partner ? d.u[uid].partner : null;
  if (day.isRest) {
    con.innerHTML = '<div class="dh"><div class="dl">' + day.day + '</div><div class="dn2">Rest Day</div></div>' +
      '<div class="rdc"><div class="rdi">&#x1F634;</div><div class="rdt">Rest & Recover</div><div class="rds">' + (day.restNote || 'Active recovery, stretch, hydrate.') + '</div></div>';
    return;
  }
  var h = '<div class="dh"><div class="dl">' + day.day + '</div><div class="dn2">' + day.focus + '</div>' +
    '<div class="df2">' + day.exercises.length + ' exercises' + (day.focus_cue ? ' &nbsp;&#x2022;&nbsp; &#x1F3AF; ' + day.focus_cue : '') + '</div></div>';
  day.exercises.forEach(function(ex, ei) {
    var ek = 'ex_' + ei;
    var sv = saved[ek] || [];
    var ns = (ex.reps.indexOf('min') > -1 || ex.reps.indexOf('sec') > -1) ? 1 : ex.sets;
    h += '<div class="eb"><div class="eh" onclick="TEX(this)"><div><div class="en">' + ex.name + '</div>' +
      '<div class="em">' + ex.equipment + ' &middot; ' + ex.sets + ' sets &times; ' + ex.reps + '</div></div>' +
      '<div class="ec">&#9662;</div></div><div class="ebody">';
    if (ex.notes) h += '<div class="enote">&#x1F4A1; ' + ex.notes + '</div>';
    if (partner) {
      var pd = d.w[partner] || {};
      var pdk2 = pd[dk] || {};
      var psv = pdk2[ek] || [];
      var mn = (d.u[uid] && d.u[uid].name || uid).split(' ')[0];
      var pn = (d.u[partner] && d.u[partner].name || partner).split(' ')[0];
      h += '<div style="display:grid;grid-template-columns:28px 1fr 1fr .3fr 1fr 1fr;gap:.4rem;margin-top:.8rem">' +
        '<div></div><div style="grid-column:2/4;text-align:center;font-weight:900;font-size:.85rem;color:var(--yel);border-bottom:2px solid var(--yel);padding-bottom:.2rem">' + mn + '</div>' +
        '<div></div><div style="grid-column:5/7;text-align:center;font-weight:900;font-size:.85rem;color:#8b1abf;border-bottom:2px solid #8b1abf;padding-bottom:.2rem">' + pn + '</div></div>';
      h += '<div style="display:grid;grid-template-columns:28px 1fr 1fr .3fr 1fr 1fr;gap:.4rem;margin-top:.3rem">' +
        '<div class="slb">Set</div><div class="slb">Reps</div><div class="slb">Wt</div><div></div><div class="slb">Reps</div><div class="slb">Wt</div></div>';
      for (var s = 0; s < ns; s++) {
        var sv1 = sv[s] || {};
        var psv1 = psv[s] || {};
        h += '<div style="display:grid;grid-template-columns:28px 1fr 1fr .3fr 1fr 1fr;gap:.4rem;margin-top:.4rem;align-items:center">' +
          '<div class="snum">' + (s+1) + '</div>' +
          '<input class="sinp' + (sv1.r ? ' done' : '') + '" type="number" placeholder="reps" inputmode="numeric" value="' + (sv1.r||'') + '" data-uid="' + uid + '" data-dk="' + dk + '" data-ek="' + ek + '" data-s="' + s + '" data-f="r"/>' +
          '<input class="sinp' + (sv1.w ? ' done' : '') + '" type="number" placeholder="lbs" inputmode="decimal" value="' + (sv1.w||'') + '" data-uid="' + uid + '" data-dk="' + dk + '" data-ek="' + ek + '" data-s="' + s + '" data-f="w"/>' +
          '<div style="text-align:center;color:#333">|</div>' +
          '<input class="sinp' + (psv1.r ? ' done' : '') + '" type="number" placeholder="reps" inputmode="numeric" value="' + (psv1.r||'') + '" data-uid="' + partner + '" data-dk="' + dk + '" data-ek="' + ek + '" data-s="' + s + '" data-f="r" style="border-color:' + (psv1.r ? '#8b1abf' : '') + '"/>' +
          '<input class="sinp' + (psv1.w ? ' done' : '') + '" type="number" placeholder="lbs" inputmode="decimal" value="' + (psv1.w||'') + '" data-uid="' + partner + '" data-dk="' + dk + '" data-ek="' + ek + '" data-s="' + s + '" data-f="w" style="border-color:' + (psv1.w ? '#8b1abf' : '') + '"/>' +
          '</div>';
      }
    } else {
      h += '<div class="slbs"><div class="slb">Set</div><div class="slb">Target</div><div class="slb">Reps Done</div><div class="slb">Weight (lbs)</div></div>';
      for (var s = 0; s < ns; s++) {
        var sv1 = sv[s] || {};
        h += '<div class="srow2"><div class="snum">' + (s+1) + '</div><div class="stgt">' + ex.reps + '</div>' +
          '<input class="sinp' + (sv1.r ? ' done' : '') + '" type="number" placeholder="reps" inputmode="numeric" value="' + (sv1.r||'') + '" data-uid="' + uid + '" data-dk="' + dk + '" data-ek="' + ek + '" data-s="' + s + '" data-f="r"/>' +
          '<input class="sinp' + (sv1.w ? ' done' : '') + '" type="number" placeholder="lbs" inputmode="decimal" value="' + (sv1.w||'') + '" data-uid="' + uid + '" data-dk="' + dk + '" data-ek="' + ek + '" data-s="' + s + '" data-f="w"/></div>';
      }
    }
    h += '</div></div>';
  });
  h += '<button class="dbtn" data-dk="' + dk + '">&#x2713; Mark Session Complete</button>';
  con.innerHTML = h;
  con.querySelectorAll('.eh').forEach(function(hdr) {
    hdr.onclick = function() { TEX(hdr); };
  });
  con.querySelectorAll('.sinp').forEach(function(inp) {
    inp.onchange = function() { SVS(inp); };
    inp.onblur   = function() { SVS(inp); };
  });
  var dbtn = con.querySelector('.dbtn');
  if (dbtn) dbtn.onclick = function() { CWO(day, dk); };
}

function TEX(hdr) {
  var b = hdr.nextElementSibling;
  var c = hdr.querySelector('.ec');
  b.classList.toggle('on');
  c.classList.toggle('on');
}

function SVS(inp) {
  var v = inp.value; if (!v) return;
  var d = GD();
  var uid = inp.dataset.uid;
  var dk  = inp.dataset.dk;
  var ek  = inp.dataset.ek;
  var s   = parseInt(inp.dataset.s);
  var f   = inp.dataset.f;
  if (!d.w[uid]) d.w[uid] = {};
  if (!d.w[uid][dk]) d.w[uid][dk] = {};
  if (!d.w[uid][dk][ek]) d.w[uid][dk][ek] = [];
  while (d.w[uid][dk][ek].length <= s) d.w[uid][dk][ek].push({});
  d.w[uid][dk][ek][s][f] = v;
  SD(d);
  inp.classList.add('done');
  saveSetToSession(inp.dataset.dk, inp.dataset.ek, parseInt(inp.dataset.s), inp.dataset.f, v);
  queueSync({uid:uid, dk:inp.dataset.dk, ek:inp.dataset.ek, s:parseInt(inp.dataset.s), f:inp.dataset.f, v:v});
}

function CWO(day, dk) {
  var uid = VC || CU; var d = GD();
  if (!d.l[uid]) d.l[uid] = [];
  d.l[uid].push({date:today(), type:'strength', notes:'Completed: ' + day.focus, loggedAt:new Date().toISOString(), loggedBy:CU});
  SD(d);
  try { if(dk) sessionStorage.removeItem('bbf_wo_' + dk); } catch(e) {}
  var wlogs = (d.l[uid]||[]).filter(function(l){return l.type!=='note';});
  var seen = {}; var dates2 = [];
  wlogs.forEach(function(l){if(!seen[l.date]){seen[l.date]=1;dates2.push(l.date);}});
  dates2.sort().reverse(); var stk=0; var cur2=new Date();
  for(var i=0;i<dates2.length;i++){var dd2=new Date(dates2[i]+'T12:00:00');if(Math.round((cur2-dd2)/86400000)<=1){stk++;cur2=dd2;}else break;}
  showVictory('CRUSHED IT!', day.focus + ' Complete', day.exercises.length + ' exercises • Great work!');
  setTimeout(function(){ checkStreakMilestone(stk); checkProgressiveOverload(); }, 600);
  RH();
}

// ─── NUTRITION ────────────────────────────────────────────
function RN() {
  var con = document.getElementById('ncon');
  var uid = VC || CU;
  var plan = MP[uid];
  if (!plan) {
    con.innerHTML = '<div class="emp"><div class="ei">&#x1F957;</div><div class="et">No meal plan assigned yet</div>' +
      '<div style="font-size:.8rem;color:var(--mut);margin-top:.5rem">Contact Akeem to get your plan set up.</div></div>';
    return;
  }
  var todayIdx = new Date().getDay();
  todayIdx = todayIdx === 0 ? 6 : todayIdx - 1;
  if (todayIdx >= plan.days.length) todayIdx = 0;
  var h = '<div class="dh"><div class="dl">' + plan.name + "'s Plan</div>" +
    '<div class="dn2" style="font-size:1.3rem">' + plan.cal + '</div>' +
    '<div class="df2">&#x1F3AF; ' + plan.goal + '</div></div>';
  h += '<div class="dnav" id="nnav">' + plan.days.map(function(day, i) {
    return '<button class="dbn' + (i === todayIdx ? ' on' : '') + '" onclick="SNDAY(' + i + ')">' + day.day + '</button>';
  }).join('') + '</div>';
  h += '<div id="ndaycon">' + RNDAY(plan, todayIdx) + '</div>';
  con.innerHTML = h;
}

function RNDAY(plan, idx) {
  var day = plan.days[idx];
  return day.meals.map(function(m) {
    var isSnack = m.m.toLowerCase().indexOf('snack') > -1 || m.m.toLowerCase().indexOf('merienda') > -1;
    return '<div class="nutr-card' + (isSnack ? ' nutr-snack' : '') + '">' +
      '<div class="nutr-ml">' + m.m + '</div>' +
      '<div class="nutr-mi">' + m.i + '</div></div>';
  }).join('');
}

function SNDAY(i) {
  var uid = VC || CU;
  var plan = MP[uid];
  if (!plan) return;
  document.querySelectorAll('#nnav .dbn').forEach(function(b, idx) { b.classList.toggle('on', idx === i); });
  var dc = document.getElementById('ndaycon');
  if (dc) dc.innerHTML = RNDAY(plan, i);
}

// ─── LOG ──────────────────────────────────────────────────
function SAVELOG() {
  var uid = VC || CU;
  var date = document.getElementById('ld').value;
  if (!date) { TOAST('Please select a date'); return; }
  var d = GD();
  if (!d.l[uid]) d.l[uid] = [];
  d.l[uid].push({
    date:date, type:TYPE,
    dur:document.getElementById('ldur').value || '',
    intensity:document.getElementById('lint').value || '',
    wt:document.getElementById('lwt').value || '',
    bf:document.getElementById('lbf').value || '',
    notes:document.getElementById('lnotes').value.trim(),
    mood:MOOD, exercises:EX.slice(),
    loggedAt:new Date().toISOString(), loggedBy:CU
  });
  SD(d);
  EX = []; MOOD = '';
  ['lnotes','ldur','lint','lwt','lbf'].forEach(function(id) { document.getElementById(id).value = ''; });
  document.getElementById('exl').innerHTML = '';
  TOAST('Session logged! &#x1F4AA;');
  RH();
  TAB('home');
}

function ADDEX() {
  var inp = document.getElementById('exi');
  var v = inp.value.trim();
  if (!v) return;
  EX.push(v); inp.value = ''; REL();
}

function REL() {
  document.getElementById('exl').innerHTML = EX.map(function(e, i) {
    return '<div class="exi"><span>' + e + '</span><button class="exd" data-i="' + i + '">&#x2715;</button></div>';
  }).join('');
  document.querySelectorAll('.exd').forEach(function(b) {
    b.onclick = function() { EX.splice(parseInt(b.dataset.i), 1); REL(); };
  });
}

function SAVENOTE() {
  var uid = VC;
  if (!uid) { TOAST('Select a client first'); return; }
  var text = document.getElementById('tnote').value.trim();
  if (!text) { TOAST('Enter a note first'); return; }
  var d = GD();
  if (!d.l[uid]) d.l[uid] = [];
  d.l[uid].push({date:today(), type:'note', notes:text, loggedBy:'akeem', loggedAt:new Date().toISOString()});
  SD(d);
  document.getElementById('tnote').value = '';
  TOAST('Coach note saved &#x2713;');
  RH();
}

// ─── PROFILE ──────────────────────────────────────────────
function RP() {
  var d = GD();
  var uid = VC || CU;
  var u = d.u[uid] || {};
  var logs = d.l[uid] || [];
  document.getElementById('pav').textContent = ((u.name || uid || '?')[0]).toUpperCase();
  document.getElementById('pname').textContent = u.name || uid;
  document.getElementById('pmeta').textContent = (u.type || '') + (u.role === 'trainer' ? ' · Head Coach' : '');
  document.getElementById('pgoal').innerHTML = '<strong>Goal:</strong> ' + (u.goal || 'Not set') + (u.gw ? ' · Target: ' + u.gw + ' lbs' : '');
  document.getElementById('gsub').textContent = u.goal || 'Tap to set';
  var wl = logs.filter(function(l) { return l.wt; }).map(function(l) { return {d:l.date, v:parseFloat(l.wt)}; }).sort(function(a,b) { return a.d.localeCompare(b.d); });
  if (wl.length) {
    var f = wl[0].v, la = wl[wl.length-1].v, diff = (la - f).toFixed(1);
    document.getElementById('wsc').textContent = la + ' lbs';
    document.getElementById('wss').textContent = f + ' lbs';
    var cel = document.getElementById('wsch');
    cel.textContent = (diff > 0 ? '+' : '') + diff + ' lbs';
    cel.style.color = diff < 0 ? 'var(--grn)' : diff > 0 ? 'var(--red)' : 'var(--yel)';
  } else {
    ['wsc','wss','wsch'].forEach(function(id) { document.getElementById(id).textContent = '—'; });
  }
  RCHART(wl);
}

function RCHART(wl) {
  var canvas = document.getElementById('wChart');
  if (WC) { WC.destroy(); WC = null; }
  if (wl.length < 2) { canvas.style.display = 'none'; return; }
  canvas.style.display = 'block';
  if (typeof Chart === 'undefined') return;
  WC = new Chart(canvas, {
    type:'line',
    data:{
      labels:wl.map(function(l) { return FMT(l.d); }),
      datasets:[{data:wl.map(function(l) { return l.v; }), borderColor:'#6a0dad', backgroundColor:'rgba(106,13,173,.1)', pointBackgroundColor:'#f5c800', pointRadius:4, tension:.35, fill:true, borderWidth:2}]
    },
    options:{responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{x:{ticks:{color:'#444',font:{size:9}},grid:{color:'#111'}},y:{ticks:{color:'#444',font:{size:9}},grid:{color:'#111'}}}}
  });
}

function OPENGOAL() {
  var d = GD(); var uid = VC || CU; var u = d.u[uid] || {};
  document.getElementById('gg').value = u.goal || '';
  document.getElementById('ggw').value = u.gw || '';
  document.getElementById('gmodal').classList.add('on');
}

function CLOSEGOAL() { document.getElementById('gmodal').classList.remove('on'); }

function SAVEGOAL() {
  var uid = VC || CU; var d = GD();
  d.u[uid].goal = document.getElementById('gg').value.trim();
  d.u[uid].gw   = document.getElementById('ggw').value.trim();
  SD(d); CLOSEGOAL(); TOAST('Goal updated &#x2713;'); RA();
}

function LOGOUT() {
  CU = null; VC = null; EX = []; MOOD = ''; TYPE = 'strength'; PLAN = null; SDAY = 0;
  if (WC) { WC.destroy(); WC = null; }
  document.getElementById('trswitch').style.display = 'none';
  document.getElementById('tnfwrap').style.display = 'none';
  document.getElementById('u').value = '';
  document.getElementById('p').value = '';
  document.getElementById('lmsg').textContent = '';
  TAB('home');
  SS('auth');
}

// ─── WIRE UP ALL BUTTONS (after DOM is ready) ─────────────

// ─── PERSONA PROTOCOL BADGE ───────────────────────────────────────
var PROTOCOLS = {
  '9to5':            { icon:'&#x1F4BC;', label:"WORKING MAN'S PROTOCOL ACTIVE", color:'#22c55e' },
  'standard':        { icon:'&#x1F4CB;', label:'STANDARD PROTOCOL ACTIVE',   color:'#f5c800' },
  'shifts':          { icon:'&#x26A1;',  label:'INDUSTRIAL ATHLETE ACTIVE',   color:'#f5c800' },
  '12hr':            { icon:'&#x26A1;',  label:'INDUSTRIAL ATHLETE ACTIVE',   color:'#f5c800' },
  'overnight':       { icon:'&#x1F319;', label:'SHIFT SPECIALIST ACTIVE',     color:'#8b1abf' },
  'executive':       { icon:'&#x1F454;', label:'EXECUTIVE PROTOCOL ACTIVE',   color:'#f5c800' },
  'medical':         { icon:'&#x1FA7A;', label:'HEALTHCARE PROTOCOL ACTIVE',  color:'#3b82f6' },
  'first-responder': { icon:'&#x1F6A8;', label:'TACTICAL ATHLETE ACTIVE',     color:'#ef4444' },
  'parent':          { icon:'&#x1F46A;', label:'FAMILY WARRIOR PROTOCOL',     color:'#22c55e' }
};

function renderProtocolBadge(uid) {
  var d = GD(); var u = d.u[uid] || {};
  var sch = u.schedule || (CLIENT_META[uid] && CLIENT_META[uid].schedule) || 'standard';
  var proto = PROTOCOLS[sch] || PROTOCOLS['standard'];
  var badge = document.getElementById('protocol-badge');
  var icon  = document.getElementById('protocol-icon');
  var lbl   = document.getElementById('protocol-label');
  if (!badge) return;
  badge.style.display   = 'flex';
  badge.style.borderColor = proto.color + '44';
  badge.style.background  = proto.color + '11';
  if (icon) icon.innerHTML = proto.icon;
  if (lbl)  { lbl.textContent = proto.label; lbl.style.color = proto.color; }
}

// ─── VIDEO VAULT ──────────────────────────────────────────────────
var VAULT_MODULES = [
  {
    id: 1,
    title: 'The Industrial Athlete Foundation',
    desc: 'Who this program is built for and why standard fitness advice fails high-demand workers.',
    duration: '18 min',
    locked: false,
    tag: 'Mindset',
    tag_icon: '&#x1F9E0;',
    bg: 'linear-gradient(135deg,#1e0338,#4a0880)',
    src: ''  // Drop your DJI Osmo MP4 URL here
  },
  {
    id: 2,
    title: 'Progressive Overload for Real Life',
    desc: 'How to build strength progressively when recovery is compressed by shift work and life demands.',
    duration: '24 min',
    locked: false,
    tag: 'Strength',
    tag_icon: '&#x1F3CB;',
    bg: 'linear-gradient(135deg,#0d0118,#6a0dad)',
    src: ''
  },
  {
    id: 3,
    title: 'Nutrition in the Dead Zones',
    desc: 'Fueling strategy for 12-hour shifts, overnight rotations, and no-kitchen environments.',
    duration: '21 min',
    locked: false,
    tag: 'Nutrition',
    tag_icon: '&#x1F957;',
    bg: 'linear-gradient(135deg,#0a1600,#1a4000)',
    src: ''
  },
  {
    id: 4,
    title: 'OT-Backed Joint Longevity Protocol',
    desc: 'The prehab science behind protecting hips, spine, shoulders, and ankles for a 30-year career.',
    duration: '28 min',
    locked: true,
    tag: 'Recovery',
    tag_icon: '&#x1F9B4;',
    bg: 'linear-gradient(135deg,#001020,#003060)',
    src: ''
  },
  {
    id: 5,
    title: 'Sleep Architecture for Shift Workers',
    desc: 'Circadian rhythm manipulation, sleep stacking, and the hormonal environment for muscle growth.',
    duration: '19 min',
    locked: true,
    tag: 'Recovery',
    tag_icon: '&#x1F634;',
    bg: 'linear-gradient(135deg,#0d0118,#2d0050)',
    src: ''
  },
  {
    id: 6,
    title: 'The 8-Week Transformation Blueprint',
    desc: 'Week-by-week periodization mapped to your real schedule. The full system in one module.',
    duration: '35 min',
    locked: true,
    tag: 'Blueprint',
    tag_icon: '&#x1F3AF;',
    bg: 'linear-gradient(135deg,#1a0e00,#4a2800)',
    src: ''
  }
];

var vaultProgress = 0;

function switchVaultTab(tab) {
  var progPane   = document.getElementById('vault-program-pane');
  var vaultPane  = document.getElementById('vault-masterclass-pane');
  var vtabProg   = document.getElementById('vtab-prog');
  var vtabVault  = document.getElementById('vtab-vault');
  var dnav       = document.getElementById('dnav');
  var overload   = document.getElementById('overload-banner');
  if (tab === 'vault') {
    if (progPane)  progPane.style.display  = 'none';
    if (vaultPane) vaultPane.style.display = 'block';
    if (vtabProg)  vtabProg.classList.remove('on');
    if (vtabVault) vtabVault.classList.add('on');
    renderVaultGrid();
  } else {
    if (progPane)  progPane.style.display  = 'block';
    if (vaultPane) vaultPane.style.display = 'none';
    if (vtabProg)  vtabProg.classList.add('on');
    if (vtabVault) vtabVault.classList.remove('on');
  }
}

function renderVaultGrid() {
  var grid = document.getElementById('vault-grid');
  if (!grid) return;
  var uid = VC || CU;
  var d = GD(); var u = d.u[uid] || {};
  var watched = u.vault_watched || [];
  var completed = watched.length;
  vaultProgress = VAULT_MODULES.length > 0 ? Math.round((completed / VAULT_MODULES.length) * 100) : 0;
  var fill = document.getElementById('vault-fill');
  var pct  = document.getElementById('vault-pct');
  if (fill) fill.style.width = vaultProgress + '%';
  if (pct)  pct.textContent = vaultProgress + '% Complete';

  grid.innerHTML = VAULT_MODULES.map(function(m) {
    var isWatched  = watched.indexOf(m.id) > -1;
    var stateClass = m.locked ? 'locked' : 'unlocked';
    var playHtml   = m.locked
      ? '<div class="module-lock">&#x1F512;</div>'
      : '<div class="module-play"><div class="module-play-icon"></div></div>';
    var watchedBadge = isWatched
      ? '<div style="position:absolute;top:.5rem;right:.6rem;z-index:3;background:rgba(34,197,94,.85);border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:.7rem">&#x2713;</div>'
      : '';
    return '<div class="module-card ' + stateClass + '" onclick="openModule(' + m.id + ')">' +
      '<div class="module-thumb" style="background:' + m.bg + '">' +
        '<div class="module-num">MODULE ' + m.id + '</div>' +
        playHtml +
        watchedBadge +
        '<div class="module-dur">' + m.duration + '</div>' +
      '</div>' +
      '<div class="module-info">' +
        '<div class="module-title">' + m.title + '</div>' +
        '<div class="module-desc">' + m.desc + '</div>' +
        '<div class="module-tag">' + m.tag_icon + ' ' + m.tag + '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

function openModule(id) {
  var m = VAULT_MODULES.find(function(x){ return x.id === id; });
  if (!m) return;
  if (m.locked) {
    TOAST('&#x1F512; Unlock with the 8-Week Elite Challenge');
    return;
  }
  var wrap  = document.getElementById('video-player-wrap');
  var video = document.getElementById('vault-video');
  var ph    = document.getElementById('video-ph-txt');
  var phContainer = document.querySelector('.video-player-ph');
  if (!wrap) return;
  wrap.classList.add('on');
  wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (m.src) {
    if (video) { video.src = m.src; video.style.display = 'block'; }
    if (phContainer) phContainer.style.display = 'none';
  } else {
    // Placeholder state
    if (video) video.style.display = 'none';
    if (phContainer) phContainer.style.display = 'block';
    if (ph) ph.textContent = m.title + ' — Upload your DJI footage to activate';
  }
  // Mark as watched
  var uid = VC || CU;
  var d = GD(); var u = d.u[uid] || {};
  if (!u.vault_watched) u.vault_watched = [];
  if (u.vault_watched.indexOf(id) === -1) {
    u.vault_watched.push(id);
    d.u[uid] = u; SD(d);
    renderVaultGrid();
  }
}

function closeVideoPlayer() {
  var wrap  = document.getElementById('video-player-wrap');
  var video = document.getElementById('vault-video');
  if (wrap)  wrap.classList.remove('on');
  if (video) { video.pause(); video.src = ''; }
}

// ─── LANGUAGE STATE ───────────────────────────────────────────────

// ─── MEAL PLANS ───────────────────────────────────────────────────
var MP = {
  ana_bbf: {name:'Ana',cal:'~1,520 cal/day',goal:'Lean & Energized',days:[
    {day:'Day 1',meals:[{m:'Breakfast',i:'1/2 cup Oats, 2 oz Cottage Cheese, 1/2 cup Blueberries (~320 cal/32g P)'},{m:'Lunch',i:'4 oz Chicken, 1/2 cup Brown Rice, 1 cup Mixed Greens (~385 cal/40g P)'},{m:'Snack',i:'2 Hard-Boiled Eggs (~120 cal/25g P)'},{m:'Dinner',i:'5 oz 93% Ground Beef, 1 cup Asparagus, 1 Medium Sweet Potato (~525 cal/45g P)'},{m:'Snack 2',i:'1 cup Cottage Cheese, 1/2 cup Strawberries (~170 cal/18g P)'}]},
    {day:'Day 2',meals:[{m:'Breakfast',i:'3 Egg Whites, 2 oz Ground Turkey, Spinach, 1/4 Avocado'},{m:'Lunch',i:'Leftover Lean Beef & Sweet Potato from Day 1'},{m:'Snack',i:'1.5 cups Non-Fat Greek Yogurt'},{m:'Dinner',i:'4 oz Sirloin Steak, 1 cup Stir-Fry Veggies, 1 cup Jasmine Rice'},{m:'Snack 2',i:'Protein Bar (~150 cal/15g P)'}]},
    {day:'Day 3',meals:[{m:'Breakfast',i:'1 cup Greek Yogurt, 1/2 cup Blackberries, 1/4 cup Walnuts'},{m:'Lunch',i:'4 oz Chicken, 1/2 cup Brown Rice, 1 cup Mixed Greens'},{m:'Snack',i:'2 Hard-Boiled Eggs'},{m:'Dinner',i:'4 oz Turkey Meatballs, 1 cup Whole-Wheat Pasta, 1/2 cup Marinara'},{m:'Snack 2',i:'2 Hard-Boiled Eggs'}]},
    {day:'Day 4',meals:[{m:'Breakfast',i:'1/2 cup Oats, 2 oz Cottage Cheese, 1/2 cup Sliced Banana'},{m:'Lunch',i:'5 oz 93% Ground Beef, 1 cup Beans, 1/2 cup Tomato, 1 cup Bell Pepper'},{m:'Snack',i:'1.5 cups Greek Yogurt'},{m:'Dinner',i:'5 oz Chicken, 1 cup Sweet Potato, 1 cup Onions & Peppers Hash'},{m:'Snack 2',i:'1 oz Almonds (~23 nuts)'}]},
    {day:'Day 5',meals:[{m:'Breakfast',i:'3 Egg Whites, 2 oz Ground Turkey, 1 slice Whole-Wheat Toast'},{m:'Lunch',i:'Leftover Chicken & Sweet Potato Hash from Day 4'},{m:'Snack',i:'2 Hard-Boiled Eggs'},{m:'Dinner',i:'5 oz Ground Turkey, 1/2 cup Jasmine Rice, 1 cup Zucchini'},{m:'Snack 2',i:'1 cup Cottage Cheese, 1/2 cup Pineapple'}]},
    {day:'Day 6',meals:[{m:'Breakfast',i:'1 cup Greek Yogurt, 1/2 cup Peaches, 1/4 cup Walnuts'},{m:'Lunch',i:'4 oz Chicken, 1/2 cup Jasmine Rice, 1 cup Mixed Greens'},{m:'Snack',i:'1.5 cups Greek Yogurt'},{m:'Dinner',i:'4 oz Sirloin, 1 cup Asparagus, 1 cup Brown Rice'},{m:'Snack 2',i:'2 Hard-Boiled Eggs'}]},
    {day:'Day 7',meals:[{m:'Breakfast',i:'1/2 cup Oats, 2 oz Cottage Cheese, 1/2 cup Sliced Banana'},{m:'Lunch',i:'Leftover Steak & Brown Rice from Day 6'},{m:'Snack',i:'2 Hard-Boiled Eggs'},{m:'Dinner',i:'5 oz Turkey Patty, Whole-Wheat Bun, 1 cup Sweet Potato Wedges, Side Salad'},{m:'Snack 2',i:'Protein Bar (~150 cal/15g P)'}]}
  ]},
  jacky_bbf: {name:'Jacky',cal:'~1,800 cal/day',goal:'High-Protein Recomposition',days:[
    {day:'Day 1',meals:[{m:'Breakfast',i:'4 oz Scrambled Eggs, 1/2 cup Oatmeal, 1 cup Berries'},{m:'Lunch',i:'5 oz Grilled Chicken, 1 cup Mixed Greens, Light Vinaigrette'},{m:'Dinner',i:'6 oz Baked Salmon, 1 Medium Sweet Potato, 1/2 cup Broccoli'}]},
    {day:'Day 2',meals:[{m:'Breakfast',i:'1/2 cup Greek Yogurt, 1/4 cup Granola, 1 tbsp Honey'},{m:'Lunch',i:'5 oz Lean Beef Stir-Fry, 1 cup Brown Rice, 1/2 cup Mixed Veggies'},{m:'Dinner',i:'6 oz Chicken Skewers, 1 cup Quinoa, 1/2 cup Roasted Asparagus'}]},
    {day:'Day 3',meals:[{m:'Breakfast',i:'4 oz Turkey Sausage, 1/2 cup Cottage Cheese, 1 slice Whole-Wheat Toast'},{m:'Lunch',i:'Leftover Dinner from Day 2'},{m:'Dinner',i:'6 oz Cod Fillet, 1 cup Couscous, 1 cup Brussels Sprouts'}]},
    {day:'Day 4',meals:[{m:'Breakfast',i:'1 scoop Protein Powder, 1 cup Milk, 1 tbsp Peanut Butter (Smoothie)'},{m:'Lunch',i:'5 oz Turkey Breast Wrap, 1 Wrap, 1/4 cup Hummus'},{m:'Dinner',i:'6 oz Lean Steak, 1 Large Baked Potato, 1 cup Green Beans'}]},
    {day:'Day 5',meals:[{m:'Breakfast',i:'4 oz Scrambled Egg Whites, 1/2 Avocado, 1 slice Whole-Grain Bread'},{m:'Lunch',i:'Leftover Dinner from Day 4'},{m:'Dinner',i:'6 oz Ground Turkey Chili, 1/2 cup Rice'}]},
    {day:'Day 6',meals:[{m:'Breakfast',i:'4 oz Greek Yogurt Parfait, 1/2 cup Fruit, 1/4 cup Nuts'},{m:'Lunch',i:'5 oz Tuna Salad, Light Mayo, 2 slices Whole-Wheat Bread'},{m:'Dinner',i:'6 oz Grilled Chicken, 1 cup Pasta with Pesto, 1/2 cup Side Salad'}]},
    {day:'Day 7',meals:[{m:'All Meals',i:'Flexible — stay within your calorie and protein targets.'}]}
  ]},
  suzanna_bbf: {name:'Suzanna',cal:'~1,640 cal/day',goal:'Fat Loss — Balanced Macros (Bilingual)',days:[
    {day:'Día 1',meals:[{m:'Desayuno / Breakfast',i:'3 claras + 1 huevo, 1/2 taza avena, 1/2 taza bayas | 3 egg whites, 1 egg, 1/2 cup oats, 1/2 cup berries'},{m:'Almuerzo / Lunch',i:'5 oz pollo, 1/2 taza arroz integral, 1 taza brócoli | 5 oz chicken, 1/2 cup brown rice, 1 cup broccoli'},{m:'Merienda / Snack',i:'1 manzana, 10 almendras | 1 apple, 10 almonds'},{m:'Cena / Dinner',i:'5 oz salmón, 4 oz camote, 1 taza espárragos | 5 oz salmon, 4 oz sweet potato, 1 cup asparagus'}]},
    {day:'Día 2',meals:[{m:'Desayuno / Breakfast',i:'1 taza yogur griego 0%, 1/2 taza fresas, 1 cda chía | 1 cup 0% Greek yogurt, 1/2 cup strawberries, 1 tbsp chia'},{m:'Almuerzo / Lunch',i:'5 oz pavo molido, 1/2 taza quinoa, 1 taza ejotes | 5 oz ground turkey, 1/2 cup quinoa, 1 cup green beans'},{m:'Merienda / Snack',i:'1 plátano, 1 medida proteína | 1 banana, 1 scoop whey'},{m:'Cena / Dinner',i:'5 oz sirloin, 1/2 taza papas rojas, 1 taza calabacín | 5 oz sirloin, 1/2 cup red potatoes, 1 cup zucchini'}]},
    {day:'Día 3',meals:[{m:'Desayuno / Breakfast',i:'2 rebanadas pan integral, 1/4 aguacate, 2 huevos | 2 slices wheat toast, 1/4 avocado, 2 boiled eggs'},{m:'Almuerzo / Lunch',i:'5 oz tilapia, 1/2 taza arroz jazmín, 1 taza pimientos | 5 oz tilapia, 1/2 cup jasmine rice, 1 cup peppers'},{m:'Merienda / Snack',i:'1/2 taza requesón, 1/2 taza piña | 1/2 cup cottage cheese, 1/2 cup pineapple'},{m:'Cena / Dinner',i:'5 oz carne 93/7, 1/2 taza pasta integral, 1 taza espinacas | 5 oz 93/7 beef, 1/2 cup wheat pasta, 1 cup spinach'}]},
    {day:'Día 4',meals:[{m:'Desayuno / Breakfast',i:'Hotcakes proteína: 1 medida suero, 2 claras, 1/4 taza avena | Protein pancakes: 1 scoop whey, 2 egg whites, 1/4 cup oats'},{m:'Almuerzo / Lunch',i:'5 oz pollo, ensalada verde grande | 5 oz chicken, large green salad'},{m:'Merienda / Snack',i:'1 pera, 10 nueces | 1 pear, 10 walnuts'},{m:'Cena / Dinner',i:'5 oz lomo cerdo, 1/2 taza arroz integral, 1 taza coles Bruselas | 5 oz pork tenderloin, 1/2 cup brown rice, 1 cup brussels sprouts'}]},
    {day:'Día 5',meals:[{m:'Desayuno / Breakfast',i:'3 claras, 1 huevo revuelto con vegetales, 1 rebanada pan | 3 egg whites, 1 egg scrambled with veggies, 1 slice wheat toast'},{m:'Almuerzo / Lunch',i:'5 oz salmón, 4 oz camote, 1 taza coliflor | 5 oz salmon, 4 oz sweet potato, 1 cup cauliflower'},{m:'Merienda / Snack',i:'1 taza yogur griego, 1/2 taza bayas | 1 cup Greek yogurt, 1/2 cup berries'},{m:'Cena / Dinner',i:'5 oz pavo molido, 2 tortillas maíz, 1/4 aguacate, pico de gallo | 5 oz ground turkey, 2 corn tortillas, 1/4 avocado, pico de gallo'}]},
    {day:'Día 6',meals:[{m:'Desayuno / Breakfast',i:'1/2 taza avena, 1 medida proteína, 1 cda crema maní | 1/2 cup oats, 1 scoop whey, 1 tbsp peanut butter'},{m:'Almuerzo / Lunch',i:'5 oz sirloin, 1/2 taza quinoa, 1 taza brócoli | 5 oz sirloin, 1/2 cup quinoa, 1 cup broccoli'},{m:'Merienda / Snack',i:'2 huevos duros, 1 taza zanahorias | 2 boiled eggs, 1 cup carrots'},{m:'Cena / Dinner',i:'5 oz camarones, 1 taza vegetales, 1/2 taza arroz jazmín | 5 oz shrimp, 1 cup veggies, 1/2 cup jasmine rice'}]},
    {day:'Día 7',meals:[{m:'Desayuno / Breakfast',i:'2 huevos, 2 rebanadas tocino pavo, 1 taza fruta | 2 eggs, 2 slices turkey bacon, 1 cup mixed fruit'},{m:'Almuerzo / Lunch',i:'5 oz chili de carne | 5 oz lean beef chili'},{m:'Merienda / Snack',i:'1 medida proteína, 1 manzana | 1 scoop whey, 1 apple'},{m:'Cena / Dinner',i:'5 oz pollo, 4 oz camote, 1 taza espárragos | 5 oz chicken, 4 oz sweet potato, 1 cup asparagus'}]}
  ]},
  jordan_bbf: {name:'Jordan',cal:'~2,900 cal/day',goal:'Performance & Muscle Building',days:[
    {day:'Monday',meals:[{m:'Breakfast',i:'6 Egg Whites, 2 Whole Eggs, 1 cup Oatmeal (dry)'},{m:'Lunch',i:'8 oz Grilled Chicken, 1.5 cups Jasmine Rice, 1 cup Broccoli'},{m:'Dinner',i:'8 oz Lean Ground Turkey, 8 oz Sweet Potato, 1 cup Asparagus'}]},
    {day:'Tuesday',meals:[{m:'Breakfast',i:'2 scoops Whey, 1 cup Oats, 2 tbsp Peanut Butter (Blended)'},{m:'Lunch',i:'8 oz Tilapia, 1.5 cups Brown Rice, 1 cup Green Beans'},{m:'Dinner',i:'8 oz Sirloin Steak (lean), 1.5 cups Jasmine Rice, Mixed Salad'}]},
    {day:'Wednesday',meals:[{m:'Breakfast',i:'6 Egg Whites, 2 Whole Eggs, 2 slices Ezekiel Toast'},{m:'Lunch',i:'8 oz Ground Beef (93/7), 1.5 cups Jasmine Rice, 1 cup Zucchini'},{m:'Dinner',i:'8 oz Salmon, 8 oz Sweet Potato, 1 cup Roasted Cauliflower'}]},
    {day:'Thursday',meals:[{m:'Breakfast',i:'1.5 cups Greek Yogurt (Plain), 1 cup Berries, 1/4 cup Granola'},{m:'Lunch',i:'8 oz Grilled Chicken, 1.5 cups Brown Rice, 1 cup Spinach'},{m:'Dinner',i:'8 oz Ground Turkey, 1.5 cups Jasmine Rice, 1 cup Broccoli'}]},
    {day:'Friday',meals:[{m:'Breakfast',i:'6 Egg Whites, 2 Whole Eggs, 1 cup Oatmeal (dry)'},{m:'Lunch',i:'8 oz Salmon, 1.5 cups Jasmine Rice, 1 cup Asparagus'},{m:'Dinner',i:'8 oz Lean Ground Beef, 8 oz Sweet Potato, Mixed Greens'}]},
    {day:'Saturday',meals:[{m:'Breakfast',i:'3 Whole Eggs, 1 cup Cream of Rice, 1 cup Blueberries'},{m:'Lunch',i:'8 oz Grilled Chicken, 1.5 cups Jasmine Rice, 1 cup Broccoli'},{m:'Dinner',i:'8 oz Tilapia, 1.5 cups Brown Rice, 1 cup Green Beans'}]},
    {day:'Sunday',meals:[{m:'Breakfast',i:'6 Egg Whites, 2 Whole Eggs, 2 slices Ezekiel Toast'},{m:'Lunch',i:'8 oz Ground Turkey, 1.5 cups Jasmine Rice, 1 cup Zucchini'},{m:'Dinner',i:'8 oz Salmon, 8 oz Sweet Potato, 1 cup Asparagus'}]}
  ]},
  wayne_bbf: {name:'Wayne',cal:'~2,200 cal/day',goal:'Lean Down — Fat Loss',days:[
    {day:'Monday',meals:[{m:'Breakfast',i:'4 Egg Whites, 2 Whole Eggs, 1/2 cup Oatmeal (dry)'},{m:'Lunch',i:'6 oz Grilled Chicken, 1 cup Jasmine Rice, 1 cup Broccoli'},{m:'Dinner',i:'6 oz Lean Ground Turkey, 6 oz Sweet Potato, 1 cup Asparagus'}]},
    {day:'Tuesday',meals:[{m:'Breakfast',i:'2 scoops Whey, 1/2 cup Oats, 1 tbsp Peanut Butter (Blended)'},{m:'Lunch',i:'6 oz Tilapia, 1 cup Brown Rice, 1 cup Green Beans'},{m:'Dinner',i:'6 oz Sirloin (90/10), 1 cup Jasmine Rice, Mixed Salad'}]},
    {day:'Wednesday',meals:[{m:'Breakfast',i:'4 Egg Whites, 2 Whole Eggs, 2 slices Ezekiel Toast'},{m:'Lunch',i:'6 oz Ground Beef (93/7), 1 cup Jasmine Rice, 1 cup Zucchini'},{m:'Dinner',i:'6 oz Salmon, 6 oz Sweet Potato, 1 cup Roasted Cauliflower'}]},
    {day:'Thursday',meals:[{m:'Breakfast',i:'1 cup Greek Yogurt (Plain), 1/2 cup Berries, 2 tbsp Granola'},{m:'Lunch',i:'6 oz Grilled Chicken, 1 cup Brown Rice, 1 cup Spinach'},{m:'Dinner',i:'6 oz Ground Turkey, 1 cup Jasmine Rice, 1 cup Broccoli'}]},
    {day:'Friday',meals:[{m:'Breakfast',i:'4 Egg Whites, 2 Whole Eggs, 1/2 cup Oatmeal (dry)'},{m:'Lunch',i:'6 oz Salmon, 1 cup Jasmine Rice, 1 cup Asparagus'},{m:'Dinner',i:'6 oz Lean Ground Beef, 6 oz Sweet Potato, Mixed Greens'}]},
    {day:'Saturday',meals:[{m:'Breakfast',i:'2 Whole Eggs, 1/2 cup Cream of Rice, 1/2 cup Blueberries'},{m:'Lunch',i:'6 oz Grilled Chicken, 1 cup Jasmine Rice, 1 cup Broccoli'},{m:'Dinner',i:'6 oz Tilapia, 1 cup Brown Rice, 1 cup Green Beans'}]},
    {day:'Sunday',meals:[{m:'Breakfast',i:'4 Egg Whites, 2 Whole Eggs, 2 slices Ezekiel Toast'},{m:'Lunch',i:'6 oz Ground Turkey, 1 cup Jasmine Rice, 1 cup Zucchini'},{m:'Dinner',i:'6 oz Salmon, 6 oz Sweet Potato, 1 cup Asparagus'}]}
  ]}
};


// ─── PREHAB DATA ─────────────────────────────────────────────────
var DAILY_EN = '&#x1F305; Morning (3 min): Cat-cow x10, glute bridge x15, ankle circles x10 each.<br>&#x1F3CB; Pre-Workout (2 min): Wall slides x10, 90/90 hip x30s each side.<br>&#x1F634; Post-Shift (5 min): Childs pose 60s, prayer stretch 30s, single-leg balance 30s each.<br>&#x26A1; Weekly: Add band external rotation on upper-body days. Non-negotiable.';

var DAILY_ES = '&#x1F305; Mañana (3 min): Gato-vaca x10, puente de glúteos x15, círculos de tobillo x10 cada uno.<br>&#x1F3CB; Pre-Entrenamiento (2 min): Deslizamientos en pared x10, 90/90 cadera x30s cada lado.<br>&#x1F634; Post-Turno (5 min): Postura del niño 60s, estiramiento de rezo 30s, equilibrio en una pierna 30s cada uno.<br>&#x26A1; Semanal: Rotación externa con banda en días de tren superior. Obligatorio.';

var PREHAB = [
  {
    icon: '&#x1F9B5;',
    en_title: 'Lumbar Spine Decompression',
    es_title: 'Descompresión Lumbar',
    en_focus: 'Low back relief after prolonged standing',
    es_focus: 'Alivio lumbar después de estar parado',
    cues: [
      {
        en_lbl: 'Cat-Cow Mobilization',
        es_lbl: 'Movilización Gato-Vaca',
        en_txt: 'On hands and knees: inhale, drop belly, lift chest (Cow). Exhale, round spine toward ceiling (Cat). Move slow — this is not a stretch race. 10 controlled reps, feel each vertebra move.',
        es_txt: 'En cuatro puntos: inhala, baja el vientre, levanta el pecho (Vaca). Exhala, redondea la columna (Gato). Movimiento lento — 10 repeticiones controladas.'
      },
      {
        en_lbl: 'Childs Pose Hold',
        es_lbl: 'Postura del Niño',
        en_txt: 'Kneel, sit back on heels, extend arms forward. Hold 30-60 seconds. Breathe into your lower back — feel the expansion. This decompresses L4-L5 where 12-hour standing loads accumulate.',
        es_txt: 'Arrodíllate, siéntate sobre los talones, extiende los brazos. Mantén 30-60 segundos. Respira hacia la espalda baja.'
      }
    ],
    sets: ['2 sets', '10 reps', '30-60s hold']
  },
  {
    icon: '&#x1F9B4;',
    en_title: 'Shoulder & Rotator Cuff Health',
    es_title: 'Salud del Hombro y Manguito Rotador',
    en_focus: 'Overhead reach restoration for production line athletes',
    es_focus: 'Restauración de alcance para atletas de línea de producción',
    cues: [
      {
        en_lbl: 'Wall Slides',
        es_lbl: 'Deslizamientos en Pared',
        en_txt: 'Stand with back flat against wall. Press forearms and wrists to the wall. Slide arms overhead slowly — keep contact the whole way. If you lose contact, that is your mobility limit. Work to that point, not through it.',
        es_txt: 'Espalda plana contra la pared. Presiona antebrazos y muñecas. Desliza brazos hacia arriba lentamente — mantén contacto. Trabaja hasta tu límite, no más allá.'
      },
      {
        en_lbl: 'Band External Rotation',
        es_lbl: 'Rotación Externa con Banda',
        en_txt: 'Elbow at 90°, pinned to your side. Rotate forearm outward against resistance. This trains the infraspinatus — your rotator cuff's workhorse. Critical for anyone pressing heavy overhead or reaching across a production line.',
        es_txt: 'Codo a 90°, pegado al costado. Rota el antebrazo hacia afuera. Entrena el infraespinoso — esencial para quien levanta o alcanza sobre la línea de producción.'
      }
    ],
    sets: ['3 sets', '15 reps', 'Light resistance']
  },
  {
    icon: '&#x1F9CE;',
    en_title: 'Hip Flexor & Glute Activation',
    es_title: 'Flexor de Cadera y Activación de Glúteos',
    en_focus: 'Counter sitting and prolonged standing — shift worker priority',
    es_focus: 'Contrarrestar estar sentado y parado — prioridad para trabajadores por turnos',
    cues: [
      {
        en_lbl: '90/90 Hip Stretch',
        es_lbl: 'Estiramiento 90/90 de Cadera',
        en_txt: 'Sit on floor with front and back leg at 90° angles. Lean forward over front shin — keep chest tall. Hold 45-60 seconds per side. This targets the hip capsule directly. Most valuable stretch you can do after a 12-hour shift.',
        es_txt: 'Siéntate con ambas piernas a 90°. Inclínate sobre la espinilla delantera — pecho erguido. Mantén 45-60 segundos por lado. El estiramiento más valioso después de un turno de 12 horas.'
      },
      {
        en_lbl: 'Glute Bridge Activation',
        es_lbl: 'Activación del Puente de Glúteos',
        en_txt: 'Lie on back, feet flat, hip-width apart. Drive through heels — squeeze glutes hard at the top. If you feel this in your hamstrings instead of glutes, your glutes are inhibited. Pause 2 seconds at top to force the connection.',
        es_txt: 'Acostado boca arriba, pies planos. Empuja con los talones — aprieta glúteos arriba. Pausa 2 segundos en la cima. Si sientes los isquiotibiales en vez de los glúteos, activa más fuerte.'
      }
    ],
    sets: ['3 sets', '12-15 reps', '2s hold']
  },
  {
    icon: '&#x1F9B6;',
    en_title: 'Ankle & Knee Stability',
    es_title: 'Estabilidad de Tobillo y Rodilla',
    en_focus: 'Concrete floor fatigue recovery — lineman & factory floor athletes',
    es_focus: 'Recuperación de fatiga por piso de concreto — atletas de fábrica',
    cues: [
      {
        en_lbl: 'Single Leg Balance Progression',
        es_lbl: 'Progresión de Equilibrio en Una Pierna',
        en_txt: 'Stand on one foot. Eyes open 30s → eyes closed 30s → on foam/unstable surface 30s. Concrete floors destroy proprioception over time. This rebuilds the joint's awareness system. Do this daily — takes 90 seconds total.',
        es_txt: 'Párate en un pie. Ojos abiertos 30s → ojos cerrados 30s → en superficie inestable 30s. Los pisos de concreto destruyen la propiocepción. Esto reconstruye el sistema articular.'
      },
      {
        en_lbl: 'Calf Raise with Pause',
        es_lbl: 'Elevación de Talones con Pausa',
        en_txt: 'Full range: lower heel below step level, rise all the way to toes, pause 2 seconds. This loads the soleus — the forgotten muscle that protects your Achilles and knees during prolonged standing. Non-negotiable for 12-hour shift workers.',
        es_txt: 'Rango completo: baja el talón, sube hasta las puntas, pausa 2 segundos. Carga el sóleo — protege el tendón de Aquiles y rodillas. Obligatorio para turnos de 12 horas.'
      }
    ],
    sets: ['2 sets', '30s each', '15 reps']
  },
  {
    icon: '&#x1F91F;',
    en_title: 'Wrist & Grip Recovery',
    es_title: 'Recuperación de Muñeca y Agarre',
    en_focus: 'Repetitive grip strain relief — production line & heavy lifting',
    es_focus: 'Alivio de tensión repetitiva — línea de producción y levantamiento pesado',
    cues: [
      {
        en_lbl: 'Prayer Stretch & Reverse Prayer',
        es_lbl: 'Estiramiento de Rezo y Rezo Inverso',
        en_txt: 'Prayer: palms together, fingers up, push down to feel forearm stretch. Reverse Prayer: backs of hands together, fingers down. Hold 20-30s each. Do this between every working set if your grip tires during rows or deadlifts.',
        es_txt: 'Rezo: palmas juntas, dedos arriba, empuja hacia abajo. Rezo inverso: dorsos de manos juntos, dedos abajo. Mantén 20-30s cada uno. Hazlo entre series si el agarre falla.'
      },
      {
        en_lbl: 'Finger Extension with Band',
        es_lbl: 'Extensión de Dedos con Banda',
        en_txt: 'Wrap a light rubber band around your fingers. Open hand against resistance — spread fingers wide. 20 reps. This trains the extensors that get zero work from gripping. Prevents tendinitis and keeps your grip strong through hour 11 of your shift.',
        es_txt: 'Enrolla una banda elástica en los dedos. Abre la mano contra resistencia — extiende los dedos. 20 repeticiones. Previene tendinitis y mantiene el agarre fuerte hasta la hora 11 del turno.'
      }
    ],
    sets: ['2 sets', '20 reps', '20-30s holds']
  }
];


// ─── PERSONA PROTOCOLS ────────────────────────────────────────────
var PROTOCOLS = {
  '9to5':            { icon:'&#x1F4BC;', label:"WORKING MAN'S PROTOCOL ACTIVE", color:'#22c55e' },
  'standard':        { icon:'&#x1F4CB;', label:'STANDARD PROTOCOL ACTIVE',   color:'#f5c800' },
  'shifts':          { icon:'&#x26A1;',  label:'INDUSTRIAL ATHLETE ACTIVE',   color:'#f5c800' },
  '12hr':            { icon:'&#x26A1;',  label:'INDUSTRIAL ATHLETE ACTIVE',   color:'#f5c800' },
  'overnight':       { icon:'&#x1F319;', label:'SHIFT SPECIALIST ACTIVE',     color:'#8b1abf' },
  'executive':       { icon:'&#x1F454;', label:'EXECUTIVE PROTOCOL ACTIVE',   color:'#f5c800' },
  'medical':         { icon:'&#x1FA7A;', label:'HEALTHCARE PROTOCOL ACTIVE',  color:'#3b82f6' },
  'first-responder': { icon:'&#x1F6A8;', label:'TACTICAL ATHLETE ACTIVE',     color:'#ef4444' },
  'parent':          { icon:'&#x1F46A;', label:'FAMILY WARRIOR PROTOCOL',     color:'#22c55e' }
};

var PERSONAS = {
  '9to5':            { label:'9-to-5 / Everyday Athlete', icon:'&#x1F4BC;', type:'desk', tag:'Working Man Protocol' },
  'standard':       { label:'Standard Schedule',     icon:'&#x1F4CB;', type:'desk',    tag:'General Population' },
  'shifts':         { label:'8-Hour Shift Worker',   icon:'&#x1F3ED;', type:'standing', tag:'Industrial Athlete' },
  '12hr':           { label:'12-Hour Shift Worker',  icon:'&#x26A1;',  type:'standing', tag:'Industrial Athlete' },
  'overnight':      { label:'Overnight / Rotating',  icon:'&#x1F319;', type:'standing', tag:'Shift Specialist' },
  'executive':      { label:'Executive / Corporate', icon:'&#x1F454;', type:'desk',    tag:'Corporate Athlete' },
  'medical':        { label:'Medical / Healthcare',  icon:'&#x1FA7A;', type:'mixed',   tag:'Healthcare Professional' },
  'first-responder':{ label:'First Responder',       icon:'&#x1F6A8;', type:'standing', tag:'First Responder' },
  'parent':         { label:'Full-Time Parent',      icon:'&#x1F46A;', type:'mixed',   tag:'Full-Time Parent' }
};

var RECOVERY_CUES = {
  '9to5': {
    label: 'Time-Efficient Recovery — Working Man Protocol',
    cues: [
      { title:'High-Density Micro-Sessions', desc:'45-60 min is your window. No fluff. Compound lifts first, isolation second. Supersets and circuit pairings compress volume into your available time without sacrificing stimulus.' },
      { title:'Commute Recovery Stacking', desc:'Use your commute intentionally. Isometric holds at red lights (glute squeeze, core brace). This builds baseline tension capacity that reinforces gym work.' },
      { title:'Desk Posture Reset — Every 90 Min', desc:'Set a timer. Stand, reach overhead, hip hinge forward, hold 15 seconds. This counters anterior pelvic tilt and upper cross syndrome that 8 hours of sitting builds daily.' },
      { title:'Weekend Priority Protocol', desc:'Your Mon-Fri energy is constrained. Treat Saturday morning as your premium training window — high volume, full recovery, maximum output. Protect this session at all costs.' },
      { title:'Sleep as Training Infrastructure', desc:'7 hours minimum. Growth hormone peaks in deep sleep. If you shortcut sleep, you shortcut results — no supplement fixes a 5-hour night. Non-negotiable.' }
    ]
  },
  desk: {
    label: 'Desk / Sitting Protocol',
    cues: [
      { title:'Hip Flexor Priority', desc:'Sitting compresses hip flexors for hours. 90/90 stretch and couch stretch daily — non-negotiable before any lower body session.' },
      { title:'Thoracic Mobility', desc:'Desk posture loads your mid-back into flexion all day. Cat-cow + thoracic rotations before upper body work to restore extension.' },
      { title:'Neck & Trap Release', desc:'Screen time builds chronic upper trap tension. Chin tucks and neck tilts — 30 seconds each direction, every 2 hours if possible.' },
      { title:'Eye & CNS Recovery', desc:'Cognitive fatigue from screen work is real. Prioritize 7-9 hours sleep. Blue light blocking after 8PM protects recovery quality.' },
      { title:'Stress & Cortisol Management', desc:'Executive cortisol is chronically elevated. Train at moderate intensity 4-5x/week. Avoid daily max-effort sessions — they compound stress, not reduce it.' }
    ]
  },
  standing: {
    label: 'Standing / Shift Protocol',
    cues: [
      { title:'Lumbar Decompression', desc:'Concrete floors load your spine for hours. Childs pose 60s + cat-cow 10 reps post-shift before anything else. This is maintenance, not a warmup.' },
      { title:'Ankle & Knee Recovery', desc:'Prolonged standing destroys proprioception. Single-leg balance daily (eyes closed 30s each) rebuilds joint awareness that concrete strips away.' },
      { title:'Glute Activation', desc:'Standing work inhibits glutes over time. Glute bridge with 2-second pause before lower body sessions — ensures glutes fire, not compensating muscles.' },
      { title:'Sleep Cycle Protection', desc:'Rotating shifts wreck circadian rhythm. Use blackout curtains, sleep masks, white noise. 6 hours consolidated > 8 hours broken.' },
      { title:'Nutrition Timing Around Shifts', desc:'Eat your largest carb meal within 90 minutes post-shift. Your body needs glycogen replenishment. Skipping this delays recovery by 24+ hours.' }
    ]
  },
  mixed: {
    label: 'Mixed Load Protocol',
    cues: [
      { title:'Variable Recovery Demands', desc:'Your load changes daily — some days sitting, some standing, some both. Track your fatigue type: mental vs. physical. Train the opposite of what work demands.' },
      { title:'Grip & Wrist Health', desc:'High-tactile professions (medical, parent) create grip fatigue. Prayer stretch + finger extensions daily. Prevents tendinitis that limits your training.' },
      { title:'Compassion Fatigue & Training', desc:'Caregiving professions carry emotional load that mirrors physical fatigue neurologically. On high-stress days, reduce intensity 30%. Training should restore, not deplete.' },
      { title:'Core Stability Priority', desc:'Mixed posture demands destabilize the spine over time. Plank, dead bug, and bird dog — 3x per week minimum. Protects your back regardless of work type.' },
      { title:'Deload Recognition', desc:'When your motivation crashes AND performance drops together — that is overreaching, not laziness. Take a deload week before it becomes forced rest.' }
    ]
  }
};


// ─── VIDEO VAULT MODULES ──────────────────────────────────────────
var VAULT_MODULES = [
  {
    id: 1,
    title: 'The Industrial Athlete Foundation',
    desc: 'Who this program is built for and why standard fitness advice fails high-demand workers.',
    duration: '18 min',
    locked: false,
    tag: 'Mindset',
    tag_icon: '&#x1F9E0;',
    bg: 'linear-gradient(135deg,#1e0338,#4a0880)',
    src: ''  // Drop your DJI Osmo MP4 URL here
  },
  {
    id: 2,
    title: 'Progressive Overload for Real Life',
    desc: 'How to build strength progressively when recovery is compressed by shift work and life demands.',
    duration: '24 min',
    locked: false,
    tag: 'Strength',
    tag_icon: '&#x1F3CB;',
    bg: 'linear-gradient(135deg,#0d0118,#6a0dad)',
    src: ''
  },
  {
    id: 3,
    title: 'Nutrition in the Dead Zones',
    desc: 'Fueling strategy for 12-hour shifts, overnight rotations, and no-kitchen environments.',
    duration: '21 min',
    locked: false,
    tag: 'Nutrition',
    tag_icon: '&#x1F957;',
    bg: 'linear-gradient(135deg,#0a1600,#1a4000)',
    src: ''
  },
  {
    id: 4,
    title: 'OT-Backed Joint Longevity Protocol',
    desc: 'The prehab science behind protecting hips, spine, shoulders, and ankles for a 30-year career.',
    duration: '28 min',
    locked: true,
    tag: 'Recovery',
    tag_icon: '&#x1F9B4;',
    bg: 'linear-gradient(135deg,#001020,#003060)',
    src: ''
  },
  {
    id: 5,
    title: 'Sleep Architecture for Shift Workers',
    desc: 'Circadian rhythm manipulation, sleep stacking, and the hormonal environment for muscle growth.',
    duration: '19 min',
    locked: true,
    tag: 'Recovery',
    tag_icon: '&#x1F634;',
    bg: 'linear-gradient(135deg,#0d0118,#2d0050)',
    src: ''
  },
  {
    id: 6,
    title: 'The 8-Week Transformation Blueprint',
    desc: 'Week-by-week periodization mapped to your real schedule. The full system in one module.',
    duration: '35 min',
    locked: true,
    tag: 'Blueprint',
    tag_icon: '&#x1F3AF;',
    bg: 'linear-gradient(135deg,#1a0e00,#4a2800)',
    src: ''
  }
];


// ─── SEED CLIENT ACCOUNTS ─────────────────────────────────────────
(function() {
  var d = GD();
  if (!d.u.akeem)     d.u.akeem     = {name:'Akeem Brown', pin:'8137', role:'trainer', type:'Trainer',   goal:'Head Coach — Build Believe Fit',                    gw:'', plan:null};
  if (!d.u.ana_bbf)   d.u.ana_bbf   = {name:'Ana',         pin:'2026', role:'client',  type:'In-Person', goal:'Spring 2026 — Arms, Glutes & Full Body',            gw:'', plan:'ana_spring'};
  if (!d.u.jacky_bbf) d.u.jacky_bbf = {name:'Jacky',       pin:'3456', role:'client',  type:'In-Person', goal:'5-Day Comprehensive Program',                       gw:'', plan:'jacky_plan'};
  if (!d.u.suzanna_bbf) d.u.suzanna_bbf = {name:'Suzanna', pin:'5678', role:'client',  type:'In-Person', goal:'4-Day Strength — Planet Fitness (Watson & Buckeye)', gw:'', plan:'suzanna_plan'};
  if (!d.u.jordan_bbf) d.u.jordan_bbf = {name:'Jordan',    pin:'1111', role:'client',  type:'In-Person', goal:'Performance & Longevity — 4-Day with Wayne',        gw:'', plan:'jordan_wayne', partner:'wayne_bbf'};
  if (!d.u.wayne_bbf)  d.u.wayne_bbf  = {name:'Wayne',     pin:'2222', role:'client',  type:'In-Person', goal:'Performance & Longevity — 4-Day with Jordan',       gw:'', plan:'jordan_wayne', partner:'jordan_bbf'};
  ['akeem','ana_bbf','jacky_bbf','suzanna_bbf','jordan_bbf','wayne_bbf'].forEach(function(k) {
    if (!d.l[k]) d.l[k] = [];
    if (!d.w[k]) d.w[k] = {};
  });
  SD(d);
})();

