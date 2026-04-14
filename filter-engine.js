// ═══════════════════════════════════════════════════════════════
// FILTER-ENGINE.JS — BBF Smart Kitchen & Position Router
// Built on the 175 LB Blueprint. Data-driven, Athlete-tested.
// ═══════════════════════════════════════════════════════════════

// ─── FAMILY INTAKE PROCESSOR ───────────────────────────────
function processIntake(formData) {
  // formData = { members: [ { name, sport, position, dislikes:[], allergies:[] } ] }
  var results = { workouts: {}, meals: [] };
  var allDislikes = [];
  var allAllergens = [];

  formData.members.forEach(function(m) {
    // Collect household-wide exclusions
    if (m.dislikes) allDislikes = allDislikes.concat(m.dislikes);
    if (m.allergies) allAllergens = allAllergens.concat(m.allergies);

    // Route to position-specific workouts
    if (m.sport && m.position && WORKOUT_CATALOG[m.sport]) {
      var drills = WORKOUT_CATALOG[m.sport][m.position] || [];
      results.workouts[m.name] = {
        sport: m.sport,
        position: m.position,
        drills: drills
      };
    }
  });

  // Deduplicate exclusions
  allDislikes = arrayUnique(allDislikes.map(function(d) { return d.toLowerCase(); }));
  allAllergens = arrayUnique(allAllergens.map(function(a) { return a.toLowerCase(); }));

  // Filter meals
  results.meals = filterMeals(allDislikes, allAllergens);
  results.exclusions = { dislikes: allDislikes, allergens: allAllergens };
  return results;
}

// ─── MEAL FILTER ───────────────────────────────────────────
function filterMeals(dislikes, allergens) {
  if (typeof MEAL_VAULT === 'undefined') return [];
  return MEAL_VAULT.filter(function(meal) {
    // Exclude meals with disliked ingredients
    for (var i = 0; i < meal.tags.length; i++) {
      if (dislikes.indexOf(meal.tags[i].toLowerCase()) > -1) return false;
    }
    // Exclude meals with allergens
    for (var j = 0; j < meal.allergens.length; j++) {
      if (allergens.indexOf(meal.allergens[j].toLowerCase()) > -1) return false;
    }
    return true;
  });
}

// ─── DAILY BLUEPRINT GENERATOR ─────────────────────────────
function generateDailyBlueprint(intake, protocol, lang) {
  // protocol: 'parent' (16/8 maintenance/loss) or 'athlete' (performance)
  // lang: 'en', 'es', 'pt'
  var L = lang || 'en';
  var data = processIntake(intake);
  var blueprint = {
    seal: '175 LB Blueprint Verified. Data-driven, Athlete-tested.',
    status: 'Laboratory Generated — Pending Founder Audit',
    members: {}
  };

  // Build per-member workout plans
  for (var name in data.workouts) {
    var w = data.workouts[name];
    blueprint.members[name] = {
      sport: w.sport,
      position: w.position,
      drills: w.drills.map(function(d) {
        return {
          name: d.name[L] || d.name.en,
          sets: d.sets,
          focus: d.focus[L] || d.focus.en,
          equipment: d.equipment
        };
      })
    };
  }

  // Build household meal plan
  blueprint.meals = data.meals.map(function(m) {
    return {
      name: m.name[L] || m.name.en,
      type: m.type,
      protocol: m.protocol,
      tags: m.tags,
      allergens: m.allergens
    };
  });

  blueprint.exclusions = data.exclusions;
  return blueprint;
}

// ─── UTILITY ───────────────────────────────────────────────
function arrayUnique(arr) {
  var seen = {};
  return arr.filter(function(item) {
    if (seen[item]) return false;
    seen[item] = true;
    return true;
  });
}
