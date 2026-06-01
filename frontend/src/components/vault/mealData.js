// src/components/vault/mealData.js
// ───────────────────────────────────────────────────
// Phase 21.4 — Authorized Meal-Plan Catalog (the "Original Five" fueling plans).
//
// VERBATIM PORT of the canonical `MP` object in the legacy monolith (bbf-data.js).
// Mirrors programData.js (the WP workout port): the React migration carried the
// workout catalog but dropped the meal catalog, which is why jacky_bbf et al.
// rendered blank nutrition. Shape is identical to the AI meal_plan JSON the DB
// stores, so the same parser/renderer handles both:
//   { name, cal, goal, days:[ { day, meals:[ { m, i } ] } ] }
//
// This is the assigned-plan FALLBACK keyed by login slug — a real coach-authored
// plan, used only when the database has no generated meal_plan for the user.
// Do NOT hand-author here; regenerate from the founder-audited MP when it changes.

export const MEAL_CATALOG = {
  "ana_bbf": {
    "name": "Ana",
    "cal": "~1,520 cal/day",
    "goal": "Lean & Energized",
    "days": [
      {
        "day": "Day 1",
        "meals": [
          {
            "m": "Breakfast",
            "i": "1/2 cup Oats, 2 oz Cottage Cheese, 1/2 cup Blueberries (~240 cal/13g P)"
          },
          {
            "m": "Lunch",
            "i": "4 oz Chicken, 1/2 cup Brown Rice, 1 cup Mixed Greens (~355 cal/39g P)"
          },
          {
            "m": "Snack",
            "i": "2 Hard-Boiled Eggs (~150 cal/13g P)"
          },
          {
            "m": "Dinner",
            "i": "5 oz 93% Ground Beef, 1 cup Asparagus, 1 Medium Sweet Potato (~425 cal/34g P)"
          },
          {
            "m": "Snack 2",
            "i": "1 cup Cottage Cheese, 1/2 cup Strawberries (~215 cal/25g P)"
          }
        ]
      },
      {
        "day": "Day 2",
        "meals": [
          {
            "m": "Breakfast",
            "i": "3 Egg Whites, 2 oz Ground Turkey, Spinach, 1/4 Avocado (~265 cal/26g P)"
          },
          {
            "m": "Lunch",
            "i": "Leftover Lean Beef & Sweet Potato from Day 1 (~415 cal/36g P)"
          },
          {
            "m": "Snack",
            "i": "1.5 cups Non-Fat Greek Yogurt (~205 cal/33g P)"
          },
          {
            "m": "Dinner",
            "i": "4 oz Sirloin Steak, 1 cup Stir-Fry Veggies, 1 cup Jasmine Rice (~470 cal/30g P)"
          },
          {
            "m": "Snack 2",
            "i": "Protein Bar (~190 cal/16g P)"
          }
        ]
      },
      {
        "day": "Day 3",
        "meals": [
          {
            "m": "Breakfast",
            "i": "1 cup Greek Yogurt, 1/2 cup Blackberries, 1/4 cup Walnuts (~360 cal/27g P)"
          },
          {
            "m": "Lunch",
            "i": "4 oz Chicken, 1/2 cup Brown Rice, 1 cup Mixed Greens (~355 cal/39g P)"
          },
          {
            "m": "Snack",
            "i": "2 Hard-Boiled Eggs (~150 cal/13g P)"
          },
          {
            "m": "Dinner",
            "i": "4 oz Turkey Meatballs, 1 cup Whole-Wheat Pasta, 1/2 cup Marinara (~480 cal/35g P)"
          },
          {
            "m": "Snack 2",
            "i": "2 Hard-Boiled Eggs (~150 cal/13g P)"
          }
        ]
      },
      {
        "day": "Day 4",
        "meals": [
          {
            "m": "Breakfast",
            "i": "1/2 cup Oats, 2 oz Cottage Cheese, 1/2 cup Sliced Banana (~270 cal/13g P)"
          },
          {
            "m": "Lunch",
            "i": "5 oz 93% Ground Beef, 1 cup Beans, 1/2 cup Tomato, 1 cup Bell Pepper (~555 cal/47g P)"
          },
          {
            "m": "Snack",
            "i": "1.5 cups Greek Yogurt (~205 cal/33g P)"
          },
          {
            "m": "Dinner",
            "i": "5 oz Chicken, 1 cup Sweet Potato, 1 cup Onions & Peppers Hash (~500 cal/50g P)"
          },
          {
            "m": "Snack 2",
            "i": "1 oz Almonds (~165 cal/6g P)"
          }
        ]
      },
      {
        "day": "Day 5",
        "meals": [
          {
            "m": "Breakfast",
            "i": "3 Egg Whites, 2 oz Ground Turkey, 1 slice Whole-Wheat Toast (~240 cal/28g P)"
          },
          {
            "m": "Lunch",
            "i": "Leftover Chicken & Sweet Potato Hash from Day 4 (~475 cal/50g P)"
          },
          {
            "m": "Snack",
            "i": "2 Hard-Boiled Eggs (~150 cal/13g P)"
          },
          {
            "m": "Dinner",
            "i": "5 oz Ground Turkey, 1/2 cup Jasmine Rice, 1 cup Zucchini (~400 cal/37g P)"
          },
          {
            "m": "Snack 2",
            "i": "1 cup Cottage Cheese, 1/2 cup Pineapple (~215 cal/25g P)"
          }
        ]
      },
      {
        "day": "Day 6",
        "meals": [
          {
            "m": "Breakfast",
            "i": "1 cup Greek Yogurt, 1/2 cup Peaches, 1/4 cup Walnuts (~360 cal/27g P)"
          },
          {
            "m": "Lunch",
            "i": "4 oz Chicken, 1/2 cup Jasmine Rice, 1 cup Mixed Greens (~350 cal/38g P)"
          },
          {
            "m": "Snack",
            "i": "1.5 cups Greek Yogurt (~205 cal/33g P)"
          },
          {
            "m": "Dinner",
            "i": "4 oz Sirloin, 1 cup Asparagus, 1 cup Brown Rice (~480 cal/31g P)"
          },
          {
            "m": "Snack 2",
            "i": "2 Hard-Boiled Eggs (~150 cal/13g P)"
          }
        ]
      },
      {
        "day": "Day 7",
        "meals": [
          {
            "m": "Breakfast",
            "i": "1/2 cup Oats, 2 oz Cottage Cheese, 1/2 cup Sliced Banana (~270 cal/13g P)"
          },
          {
            "m": "Lunch",
            "i": "Leftover Steak & Brown Rice from Day 6 (~470 cal/40g P)"
          },
          {
            "m": "Snack",
            "i": "2 Hard-Boiled Eggs (~150 cal/13g P)"
          },
          {
            "m": "Dinner",
            "i": "5 oz Turkey Patty, Whole-Wheat Bun, 1 cup Sweet Potato Wedges, Side Salad (~595 cal/43g P)"
          },
          {
            "m": "Snack 2",
            "i": "Protein Bar (~190 cal/16g P)"
          }
        ]
      }
    ]
  },
  "jacky_bbf": {
    "name": "Jacky",
    "cal": "~1,800 cal/day",
    "goal": "High-Protein Recomposition",
    "days": [
      {
        "day": "Day 1",
        "meals": [
          {
            "m": "Breakfast",
            "i": "4 oz Scrambled Eggs, 1/2 cup Oatmeal, 1 cup Berries (~390 cal/20g P)"
          },
          {
            "m": "Lunch",
            "i": "5 oz Grilled Chicken, 1 cup Mixed Greens, Light Vinaigrette (~340 cal/45g P)"
          },
          {
            "m": "Dinner",
            "i": "6 oz Baked Salmon, 1 Medium Sweet Potato, 1/2 cup Broccoli (~490 cal/43g P)"
          },
          {
            "m": "Snack",
            "i": "1 cup Greek Yogurt, 1/4 cup Granola, 1/2 cup Berries (~290 cal/26g P)"
          },
          {
            "m": "Snack 2",
            "i": "1 scoop Whey Protein, 1 cup Milk (shake) (~240 cal/32g P)"
          }
        ]
      },
      {
        "day": "Day 2",
        "meals": [
          {
            "m": "Breakfast",
            "i": "1/2 cup Greek Yogurt, 1/4 cup Granola, 1 tbsp Honey (~250 cal/14g P)"
          },
          {
            "m": "Lunch",
            "i": "5 oz Lean Beef Stir-Fry, 1 cup Brown Rice, 1/2 cup Mixed Veggies (~520 cal/36g P)"
          },
          {
            "m": "Dinner",
            "i": "6 oz Chicken Skewers, 1 cup Quinoa, 1/2 cup Roasted Asparagus (~550 cal/57g P)"
          },
          {
            "m": "Snack",
            "i": "1 cup Greek Yogurt, 1/4 cup Granola, 1/2 cup Berries (~290 cal/26g P)"
          },
          {
            "m": "Snack 2",
            "i": "1 scoop Whey Protein, 1 cup Milk (shake) (~240 cal/32g P)"
          }
        ]
      },
      {
        "day": "Day 3",
        "meals": [
          {
            "m": "Breakfast",
            "i": "4 oz Turkey Sausage, 1/2 cup Cottage Cheese, 1 slice Whole-Wheat Toast (~380 cal/42g P)"
          },
          {
            "m": "Lunch",
            "i": "Leftover Dinner from Day 2 (~550 cal/57g P)"
          },
          {
            "m": "Dinner",
            "i": "6 oz Cod Fillet, 1 cup Couscous, 1 cup Brussels Sprouts (~445 cal/52g P)"
          },
          {
            "m": "Snack",
            "i": "1 cup Greek Yogurt, 1/4 cup Granola, 1/2 cup Berries (~290 cal/26g P)"
          },
          {
            "m": "Snack 2",
            "i": "1 scoop Whey Protein, 1 cup Milk (shake) (~240 cal/32g P)"
          }
        ]
      },
      {
        "day": "Day 4",
        "meals": [
          {
            "m": "Breakfast",
            "i": "1 scoop Protein Powder, 1 cup Milk, 1 tbsp Peanut Butter (Smoothie) (~335 cal/36g P)"
          },
          {
            "m": "Lunch",
            "i": "5 oz Turkey Breast Wrap, 1 Wrap, 1/4 cup Hummus (~490 cal/43g P)"
          },
          {
            "m": "Dinner",
            "i": "6 oz Lean Steak, 1 Large Baked Potato, 1 cup Green Beans (~660 cal/45g P)"
          },
          {
            "m": "Snack",
            "i": "1 cup Greek Yogurt, 1/4 cup Granola, 1/2 cup Berries (~290 cal/26g P)"
          },
          {
            "m": "Snack 2",
            "i": "1 scoop Whey Protein, 1 cup Milk (shake) (~240 cal/32g P)"
          }
        ]
      },
      {
        "day": "Day 5",
        "meals": [
          {
            "m": "Breakfast",
            "i": "4 oz Scrambled Egg Whites, 1/2 Avocado, 1 slice Whole-Grain Bread (~300 cal/19g P)"
          },
          {
            "m": "Lunch",
            "i": "Leftover Dinner from Day 4 (~660 cal/45g P)"
          },
          {
            "m": "Dinner",
            "i": "6 oz Ground Turkey Chili, 1/2 cup Rice (~415 cal/41g P)"
          },
          {
            "m": "Snack",
            "i": "1 cup Greek Yogurt, 1/4 cup Granola, 1/2 cup Berries (~290 cal/26g P)"
          },
          {
            "m": "Snack 2",
            "i": "1 scoop Whey Protein, 1 cup Milk (shake) (~240 cal/32g P)"
          }
        ]
      },
      {
        "day": "Day 6",
        "meals": [
          {
            "m": "Breakfast",
            "i": "4 oz Greek Yogurt Parfait, 1/2 cup Fruit, 1/4 cup Nuts (~375 cal/19g P)"
          },
          {
            "m": "Lunch",
            "i": "5 oz Tuna Salad, Light Mayo, 2 slices Whole-Wheat Bread (~400 cal/45g P)"
          },
          {
            "m": "Dinner",
            "i": "6 oz Grilled Chicken, 1 cup Pasta with Pesto, 1/2 cup Side Salad (~530 cal/59g P)"
          },
          {
            "m": "Snack",
            "i": "1 cup Greek Yogurt, 1/4 cup Granola, 1/2 cup Berries (~290 cal/26g P)"
          },
          {
            "m": "Snack 2",
            "i": "1 scoop Whey Protein, 1 cup Milk (shake) (~240 cal/32g P)"
          }
        ]
      },
      {
        "day": "Day 7",
        "meals": [
          {
            "m": "All Meals",
            "i": "Flexible day — balance lean protein and clean carbs to hit your daily targets. (~1800 cal/140g P)"
          }
        ]
      }
    ]
  },
  "jacque_bbf": {
    "name": "Jacquelyn",
    "cal": "~1,652 cal/day",
    "goal": "Postpartum Recomp — High Protein / Clean Carbs · MEDICAL ALERT: STRICTLY NO COCONUT (olive or avocado oil only) · Weigh meat AFTER cooking · Measure rice/beans AFTER cooking",
    "days": [
      {
        "day": "Day 1",
        "meals": [
          {
            "m": "Breakfast",
            "i": "4 oz cooked lean ground turkey, 1 cup sautéed bell peppers & onions (olive or avocado oil — NO coconut), 1 cup berries (~340 cal/30g P)"
          },
          {
            "m": "Lunch",
            "i": "5 oz cooked lean ground beef, 1/2 cup brown rice (cooked), 1/2 cup black beans (cooked), 1 cup green beans (~535 cal/42g P)"
          },
          {
            "m": "Snack",
            "i": "1 cup Greek yogurt, 1 medium apple, dash of cinnamon (~230 cal/23g P)"
          },
          {
            "m": "Dinner",
            "i": "5 oz cooked chicken breast, 3/4 cup jasmine rice (cooked), 1.5 cups roasted broccoli with 1 tbsp olive oil (~600 cal/46g P)"
          }
        ]
      },
      {
        "day": "Day 2",
        "meals": [
          {
            "m": "Breakfast",
            "i": "3 whole eggs + 3 egg whites, 1/2 cup rolled oats, 1/2 cup sliced banana (~495 cal/35g P)"
          },
          {
            "m": "Lunch",
            "i": "5 oz cooked lean ground turkey, 1/2 cup white rice (cooked), 1/2 cup pinto beans (cooked), 1 cup shredded lettuce & tomatoes (~535 cal/45g P)"
          },
          {
            "m": "Snack",
            "i": "1 cup low-fat cottage cheese, 1 cup pineapple chunks (~250 cal/25g P)"
          },
          {
            "m": "Dinner",
            "i": "5 oz cooked sirloin steak, 3/4 cup brown rice (cooked), 1.5 cups asparagus with 1 tsp olive oil (~505 cal/34g P)"
          }
        ]
      },
      {
        "day": "Day 3",
        "meals": [
          {
            "m": "Breakfast",
            "i": "4 oz chicken sausage (verify label — coconut-free), 1 cup spinach, 1 cup melon (~315 cal/37g P)"
          },
          {
            "m": "Lunch",
            "i": "5 oz ground chicken, 1/2 cup quinoa or brown rice (cooked), 1/2 cup black beans (cooked), 1 cup mixed zucchini & squash (~540 cal/55g P)"
          },
          {
            "m": "Snack",
            "i": "2 hard-boiled eggs, 1 cup grapes (~220 cal/14g P)"
          },
          {
            "m": "Dinner",
            "i": "5 oz cooked white fish, 3/4 cup jasmine rice (cooked), 1.5 cups steamed cauliflower & carrots (~425 cal/44g P)"
          }
        ]
      },
      {
        "day": "Day 4",
        "meals": [
          {
            "m": "Breakfast",
            "i": "4 oz cooked lean ground turkey, 1 cup sautéed bell peppers & onions (olive or avocado oil — NO coconut), 1 cup berries (~340 cal/30g P)"
          },
          {
            "m": "Lunch",
            "i": "5 oz cooked lean ground beef, 1/2 cup brown rice (cooked), 1/2 cup black beans (cooked), 1 cup green beans (~535 cal/42g P)"
          },
          {
            "m": "Snack",
            "i": "1 cup Greek yogurt, 1 medium apple, dash of cinnamon (~230 cal/23g P)"
          },
          {
            "m": "Dinner",
            "i": "5 oz cooked chicken breast, 3/4 cup jasmine rice (cooked), 1.5 cups roasted broccoli with 1 tbsp olive oil (~600 cal/46g P)"
          }
        ]
      },
      {
        "day": "Day 5",
        "meals": [
          {
            "m": "Breakfast",
            "i": "3 whole eggs + 3 egg whites, 1/2 cup rolled oats, 1/2 cup sliced banana (~495 cal/35g P)"
          },
          {
            "m": "Lunch",
            "i": "5 oz cooked lean ground turkey, 1/2 cup white rice (cooked), 1/2 cup pinto beans (cooked), 1 cup shredded lettuce & tomatoes (~535 cal/45g P)"
          },
          {
            "m": "Snack",
            "i": "1 cup low-fat cottage cheese, 1 cup pineapple chunks (~250 cal/25g P)"
          },
          {
            "m": "Dinner",
            "i": "5 oz cooked sirloin steak, 3/4 cup brown rice (cooked), 1.5 cups asparagus with 1 tsp olive oil (~505 cal/34g P)"
          }
        ]
      },
      {
        "day": "Day 6",
        "meals": [
          {
            "m": "Breakfast",
            "i": "4 oz chicken sausage (verify label — coconut-free), 1 cup spinach, 1 cup melon (~315 cal/37g P)"
          },
          {
            "m": "Lunch",
            "i": "5 oz ground chicken, 1/2 cup quinoa or brown rice (cooked), 1/2 cup black beans (cooked), 1 cup mixed zucchini & squash (~540 cal/55g P)"
          },
          {
            "m": "Snack",
            "i": "2 hard-boiled eggs, 1 cup grapes (~220 cal/14g P)"
          },
          {
            "m": "Dinner",
            "i": "5 oz cooked white fish, 3/4 cup jasmine rice (cooked), 1.5 cups steamed cauliflower & carrots (~425 cal/44g P)"
          }
        ]
      },
      {
        "day": "Day 7",
        "meals": [
          {
            "m": "Breakfast",
            "i": "3 whole eggs, 1 cup oats, 1/2 cup berries (~560 cal/29g P)"
          },
          {
            "m": "Lunch",
            "i": "5 oz cooked lean ground beef, 1/2 cup rice (cooked), 1/2 cup beans (cooked), 1 cup veggies (~530 cal/41g P)"
          },
          {
            "m": "Snack",
            "i": "1 cup Greek yogurt, 1 apple (~230 cal/23g P)"
          },
          {
            "m": "Dinner",
            "i": "5 oz cooked chicken breast, 3/4 cup rice (cooked), 1.5 cups mixed greens (~470 cal/49g P)"
          }
        ]
      }
    ]
  },
  "jordan_bbf": {
    "name": "Jordan",
    "cal": "~2,900 cal/day",
    "goal": "Performance & Muscle Building",
    "days": [
      {
        "day": "Monday",
        "meals": [
          {
            "m": "Breakfast",
            "i": "6 Egg Whites, 2 Whole Eggs, 1 cup Oatmeal (dry) (~560 cal/44g P)"
          },
          {
            "m": "Lunch",
            "i": "8 oz Grilled Chicken, 1.5 cups Jasmine Rice, 1 cup Broccoli (~765 cal/76g P)"
          },
          {
            "m": "Dinner",
            "i": "8 oz Lean Ground Turkey, 8 oz Sweet Potato, 1 cup Asparagus (~660 cal/58g P)"
          },
          {
            "m": "Snack",
            "i": "2 scoops Whey Protein, 1 cup Milk, 1 medium Banana (shake) (~465 cal/57g P)"
          },
          {
            "m": "Snack 2",
            "i": "1 medium Apple, 1 Protein Bar, 1 oz Almonds (~450 cal/22g P)"
          }
        ]
      },
      {
        "day": "Tuesday",
        "meals": [
          {
            "m": "Breakfast",
            "i": "2 scoops Whey, 1 cup Oats, 2 tbsp Peanut Butter (Blended) (~730 cal/66g P)"
          },
          {
            "m": "Lunch",
            "i": "8 oz Tilapia, 1.5 cups Brown Rice, 1 cup Green Beans (~670 cal/68g P)"
          },
          {
            "m": "Dinner",
            "i": "8 oz Sirloin Steak (lean), 1.5 cups Jasmine Rice, Mixed Salad (~790 cal/55g P)"
          },
          {
            "m": "Snack",
            "i": "2 scoops Whey Protein, 1 cup Milk, 1 medium Banana (shake) (~465 cal/57g P)"
          },
          {
            "m": "Snack 2",
            "i": "1 medium Apple, 1 Protein Bar, 1 oz Almonds (~450 cal/22g P)"
          }
        ]
      },
      {
        "day": "Wednesday",
        "meals": [
          {
            "m": "Breakfast",
            "i": "6 Egg Whites, 2 Whole Eggs, 2 slices Ezekiel Toast (~420 cal/42g P)"
          },
          {
            "m": "Lunch",
            "i": "8 oz Ground Beef (93/7), 1.5 cups Jasmine Rice, 1 cup Zucchini (~800 cal/56g P)"
          },
          {
            "m": "Dinner",
            "i": "8 oz Salmon, 8 oz Sweet Potato, 1 cup Roasted Cauliflower (~725 cal/59g P)"
          },
          {
            "m": "Snack",
            "i": "2 scoops Whey Protein, 1 cup Milk, 1 medium Banana (shake) (~465 cal/57g P)"
          },
          {
            "m": "Snack 2",
            "i": "1 medium Apple, 1 Protein Bar, 1 oz Almonds (~450 cal/22g P)"
          }
        ]
      },
      {
        "day": "Thursday",
        "meals": [
          {
            "m": "Breakfast",
            "i": "1.5 cups Greek Yogurt (Plain), 1 cup Berries, 1/4 cup Granola (~395 cal/37g P)"
          },
          {
            "m": "Lunch",
            "i": "8 oz Grilled Chicken, 1.5 cups Brown Rice, 1 cup Spinach (~780 cal/78g P)"
          },
          {
            "m": "Dinner",
            "i": "8 oz Ground Turkey, 1.5 cups Jasmine Rice, 1 cup Broccoli (~765 cal/60g P)"
          },
          {
            "m": "Snack",
            "i": "2 scoops Whey Protein, 1 cup Milk, 1 medium Banana (shake) (~465 cal/57g P)"
          },
          {
            "m": "Snack 2",
            "i": "1 medium Apple, 1 Protein Bar, 1 oz Almonds (~450 cal/22g P)"
          }
        ]
      },
      {
        "day": "Friday",
        "meals": [
          {
            "m": "Breakfast",
            "i": "6 Egg Whites, 2 Whole Eggs, 1 cup Oatmeal (dry) (~560 cal/44g P)"
          },
          {
            "m": "Lunch",
            "i": "8 oz Salmon, 1.5 cups Jasmine Rice, 1 cup Asparagus (~830 cal/61g P)"
          },
          {
            "m": "Dinner",
            "i": "8 oz Lean Ground Beef, 8 oz Sweet Potato, Mixed Greens (~680 cal/53g P)"
          },
          {
            "m": "Snack",
            "i": "2 scoops Whey Protein, 1 cup Milk, 1 medium Banana (shake) (~465 cal/57g P)"
          },
          {
            "m": "Snack 2",
            "i": "1 medium Apple, 1 Protein Bar, 1 oz Almonds (~450 cal/22g P)"
          }
        ]
      },
      {
        "day": "Saturday",
        "meals": [
          {
            "m": "Breakfast",
            "i": "3 Whole Eggs, 1 cup Cream of Rice, 1 cup Blueberries (~425 cal/22g P)"
          },
          {
            "m": "Lunch",
            "i": "8 oz Grilled Chicken, 1.5 cups Jasmine Rice, 1 cup Broccoli (~765 cal/76g P)"
          },
          {
            "m": "Dinner",
            "i": "8 oz Tilapia, 1.5 cups Brown Rice, 1 cup Green Beans (~670 cal/68g P)"
          },
          {
            "m": "Snack",
            "i": "2 scoops Whey Protein, 1 cup Milk, 1 medium Banana (shake) (~465 cal/57g P)"
          },
          {
            "m": "Snack 2",
            "i": "1 medium Apple, 1 Protein Bar, 1 oz Almonds (~450 cal/22g P)"
          }
        ]
      },
      {
        "day": "Sunday",
        "meals": [
          {
            "m": "Breakfast",
            "i": "6 Egg Whites, 2 Whole Eggs, 2 slices Ezekiel Toast (~420 cal/42g P)"
          },
          {
            "m": "Lunch",
            "i": "8 oz Ground Turkey, 1.5 cups Jasmine Rice, 1 cup Zucchini (~765 cal/60g P)"
          },
          {
            "m": "Dinner",
            "i": "8 oz Salmon, 8 oz Sweet Potato, 1 cup Asparagus (~725 cal/59g P)"
          },
          {
            "m": "Snack",
            "i": "2 scoops Whey Protein, 1 cup Milk, 1 medium Banana (shake) (~465 cal/57g P)"
          },
          {
            "m": "Snack 2",
            "i": "1 medium Apple, 1 Protein Bar, 1 oz Almonds (~450 cal/22g P)"
          }
        ]
      }
    ]
  },
  "wayne_bbf": {
    "name": "Wayne",
    "cal": "~2,200 cal/day",
    "goal": "Lean Down — Fat Loss",
    "days": [
      {
        "day": "Monday",
        "meals": [
          {
            "m": "Breakfast",
            "i": "4 Egg Whites, 2 Whole Eggs, 1/2 cup Oatmeal (dry) (~370 cal/32g P)"
          },
          {
            "m": "Lunch",
            "i": "6 oz Grilled Chicken, 1 cup Jasmine Rice, 1 cup Broccoli (~555 cal/57g P)"
          },
          {
            "m": "Dinner",
            "i": "6 oz Lean Ground Turkey, 6 oz Sweet Potato, 1 cup Asparagus (~505 cal/44g P)"
          },
          {
            "m": "Snack",
            "i": "1 scoop Whey Protein, 1 cup Milk, 1 medium Banana (shake) (~345 cal/33g P)"
          },
          {
            "m": "Snack 2",
            "i": "1 cup Greek Yogurt, 1/2 cup Berries, 1 oz Almonds (~335 cal/29g P)"
          }
        ]
      },
      {
        "day": "Tuesday",
        "meals": [
          {
            "m": "Breakfast",
            "i": "2 scoops Whey, 1/2 cup Oats, 1 tbsp Peanut Butter (Blended) (~485 cal/57g P)"
          },
          {
            "m": "Lunch",
            "i": "6 oz Tilapia, 1 cup Brown Rice, 1 cup Green Beans (~485 cal/51g P)"
          },
          {
            "m": "Dinner",
            "i": "6 oz Sirloin (90/10), 1 cup Jasmine Rice, Mixed Salad (~570 cal/41g P)"
          },
          {
            "m": "Snack",
            "i": "1 scoop Whey Protein, 1 cup Milk, 1 medium Banana (shake) (~345 cal/33g P)"
          },
          {
            "m": "Snack 2",
            "i": "1 cup Greek Yogurt, 1/2 cup Berries, 1 oz Almonds (~335 cal/29g P)"
          }
        ]
      },
      {
        "day": "Wednesday",
        "meals": [
          {
            "m": "Breakfast",
            "i": "4 Egg Whites, 2 Whole Eggs, 2 slices Ezekiel Toast (~380 cal/35g P)"
          },
          {
            "m": "Lunch",
            "i": "6 oz Ground Beef (93/7), 1 cup Jasmine Rice, 1 cup Zucchini (~580 cal/42g P)"
          },
          {
            "m": "Dinner",
            "i": "6 oz Salmon, 6 oz Sweet Potato, 1 cup Roasted Cauliflower (~550 cal/45g P)"
          },
          {
            "m": "Snack",
            "i": "1 scoop Whey Protein, 1 cup Milk, 1 medium Banana (shake) (~345 cal/33g P)"
          },
          {
            "m": "Snack 2",
            "i": "1 cup Greek Yogurt, 1/2 cup Berries, 1 oz Almonds (~335 cal/29g P)"
          }
        ]
      },
      {
        "day": "Thursday",
        "meals": [
          {
            "m": "Breakfast",
            "i": "1 cup Greek Yogurt (Plain), 1/2 cup Berries, 2 tbsp Granola (~230 cal/25g P)"
          },
          {
            "m": "Lunch",
            "i": "6 oz Grilled Chicken, 1 cup Brown Rice, 1 cup Spinach (~565 cal/58g P)"
          },
          {
            "m": "Dinner",
            "i": "6 oz Ground Turkey, 1 cup Jasmine Rice, 1 cup Broccoli (~555 cal/45g P)"
          },
          {
            "m": "Snack",
            "i": "1 scoop Whey Protein, 1 cup Milk, 1 medium Banana (shake) (~345 cal/33g P)"
          },
          {
            "m": "Snack 2",
            "i": "1 cup Greek Yogurt, 1/2 cup Berries, 1 oz Almonds (~335 cal/29g P)"
          }
        ]
      },
      {
        "day": "Friday",
        "meals": [
          {
            "m": "Breakfast",
            "i": "4 Egg Whites, 2 Whole Eggs, 1/2 cup Oatmeal (dry) (~370 cal/32g P)"
          },
          {
            "m": "Lunch",
            "i": "6 oz Salmon, 1 cup Jasmine Rice, 1 cup Asparagus (~605 cal/46g P)"
          },
          {
            "m": "Dinner",
            "i": "6 oz Lean Ground Beef, 6 oz Sweet Potato, Mixed Greens (~515 cal/40g P)"
          },
          {
            "m": "Snack",
            "i": "1 scoop Whey Protein, 1 cup Milk, 1 medium Banana (shake) (~345 cal/33g P)"
          },
          {
            "m": "Snack 2",
            "i": "1 cup Greek Yogurt, 1/2 cup Berries, 1 oz Almonds (~335 cal/29g P)"
          }
        ]
      },
      {
        "day": "Saturday",
        "meals": [
          {
            "m": "Breakfast",
            "i": "2 Whole Eggs, 1/2 cup Cream of Rice, 1/2 cup Blueberries (~250 cal/14g P)"
          },
          {
            "m": "Lunch",
            "i": "6 oz Grilled Chicken, 1 cup Jasmine Rice, 1 cup Broccoli (~555 cal/57g P)"
          },
          {
            "m": "Dinner",
            "i": "6 oz Tilapia, 1 cup Brown Rice, 1 cup Green Beans (~485 cal/51g P)"
          },
          {
            "m": "Snack",
            "i": "1 scoop Whey Protein, 1 cup Milk, 1 medium Banana (shake) (~345 cal/33g P)"
          },
          {
            "m": "Snack 2",
            "i": "1 cup Greek Yogurt, 1/2 cup Berries, 1 oz Almonds (~335 cal/29g P)"
          }
        ]
      },
      {
        "day": "Sunday",
        "meals": [
          {
            "m": "Breakfast",
            "i": "4 Egg Whites, 2 Whole Eggs, 2 slices Ezekiel Toast (~380 cal/35g P)"
          },
          {
            "m": "Lunch",
            "i": "6 oz Ground Turkey, 1 cup Jasmine Rice, 1 cup Zucchini (~555 cal/45g P)"
          },
          {
            "m": "Dinner",
            "i": "6 oz Salmon, 6 oz Sweet Potato, 1 cup Asparagus (~550 cal/45g P)"
          },
          {
            "m": "Snack",
            "i": "1 scoop Whey Protein, 1 cup Milk, 1 medium Banana (shake) (~345 cal/33g P)"
          },
          {
            "m": "Snack 2",
            "i": "1 cup Greek Yogurt, 1/2 cup Berries, 1 oz Almonds (~335 cal/29g P)"
          }
        ]
      }
    ]
  }
};

// Resolve a coach-authored meal plan for a login slug, or null when unmapped.
export function getMealPlan(uid) {
  const slug = String(uid || "").trim().toLowerCase();
  return MEAL_CATALOG[slug] || null;
}
