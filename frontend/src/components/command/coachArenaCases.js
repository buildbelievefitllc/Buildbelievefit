// src/components/command/coachArenaCases.js
// ─────────────────────────────────────────────────────────────────────────────
// Coach Lab · Pillar 3 — The Coach's Arena, hardwired case deck.
//
// Ten pre-written client cases, same shape Claude returns from bbf-coach-arena's
// `generate` action (scenario_title / client_profile / the_ask). CoachArena draws
// from this deck by default so sparring a case costs zero API calls; the live
// `bbf-coach-arena` generate endpoint stays available as an explicit "fresh via
// AI" fallback for when the founder wants more variety than the deck covers.
//
// DROP-IN: append a record here to grow the deck — CoachArena reads it generically.

export const ARENA_CASES = [
  {
    id: 'local-1',
    scenario_title: 'The Off-Season Cutter',
    client_profile: {
      age: 15,
      background: 'Club soccer winger flagged on a preseason movement screen for poor single-leg landing control; no current injury, but coaches are nervous after two ACL injuries on the team last year.',
      training_age: 'Novice · 1 year of structured strength training',
      primary_goal: 'Build resilient landing mechanics before the season opener in 6 weeks',
      constraints: ['Two field sessions + one match per week already on the calendar', 'Only 45 minutes, twice weekly, in a shared school weight room', 'Parent wants zero soreness that could limit practice'],
      biomechanical_limitations: ['Valgus collapse on single-leg landing', 'Limited hip internal rotation on the dominant leg'],
    },
    the_ask: 'Design a 6-week off-season block that meaningfully improves landing mechanics within two 45-minute sessions a week, without compromising in-season availability.',
  },
  {
    id: 'local-2',
    scenario_title: 'The Masters Strength Comeback',
    client_profile: {
      age: 54,
      background: 'Former competitive powerlifter returning to training after 14 months off following a partial-thickness rotator cuff tear managed conservatively (no surgery).',
      training_age: 'Advanced (15+ years lifting history) · Detrained 14 months',
      primary_goal: 'Rebuild bench and overhead pressing strength without re-aggravating the shoulder',
      constraints: ['Trains alone, no spotter available', 'Available 4 days/week, 60 minutes per session', 'Surgeon cleared overhead work but flagged "go slow"'],
      biomechanical_limitations: ['Reduced active shoulder flexion past 150°', 'Scapular dyskinesis on the involved side'],
    },
    the_ask: 'Build a return-to-press progression that rebuilds load tolerance in the shoulder over 8-10 weeks without triggering a flare-up, while keeping him training-confident.',
  },
  {
    id: 'local-3',
    scenario_title: 'Return-to-Run, Postpartum',
    client_profile: {
      age: 33,
      background: '8 weeks postpartum (vaginal delivery), cleared by her OB for "light activity," reports a 2-finger-width diastasis recti and occasional stress incontinence with jumping.',
      training_age: 'Intermediate pre-pregnancy · Untrained 9 months',
      primary_goal: 'Safely rebuild a base of strength and eventually return to recreational running',
      constraints: ['Two kids under 4, unpredictable 30-45 minute windows', 'Breastfeeding — needs to manage fatigue and hydration', 'No childcare during sessions; trains at home with minimal equipment'],
      biomechanical_limitations: ['Diastasis recti (2-finger width) with incomplete linea alba tension', 'Pelvic floor under-recruitment under load'],
    },
    the_ask: 'Sequence a postpartum return-to-load progression — from breath/pelvic floor work through loaded carries — with clear criteria for when (if ever) running re-enters the picture.',
  },
  {
    id: 'local-4',
    scenario_title: 'The Desk-Bound Executive',
    client_profile: {
      age: 41,
      background: 'VP of Sales, 60-70 hour weeks, 3-4 days a month on flights; reports a chronic dull low-back ache that worsens after long drives and red-eye flights.',
      training_age: 'Beginner · Sporadic gym use, no structured programming',
      primary_goal: 'Eliminate the low-back ache and build a sustainable strength base',
      constraints: ['Travels 1 week out of every 4', 'Realistically trains 3x/week, 45 minutes', 'Hotel gyms are inconsistent — dumbbells only some weeks'],
      biomechanical_limitations: ['Anterior pelvic tilt with tight hip flexors', 'Limited thoracic extension'],
    },
    the_ask: 'Design a 3-day template (plus a hotel-room backup version) that addresses the postural drivers of his back pain while building real strength over the next quarter.',
  },
  {
    id: 'local-5',
    scenario_title: 'First 90 Days',
    client_profile: {
      age: 47,
      background: '230 lb, sedentary for over a decade, recently diagnosed prediabetic (A1c 6.2); his physician referred him for supervised exercise before considering medication.',
      training_age: 'True beginner · No training history',
      primary_goal: 'Lose body fat and improve insulin sensitivity without injury or burnout',
      constraints: ['Self-conscious in a commercial gym setting', 'Knees ache going down stairs', 'Can commit to 3 sessions/week, 30 minutes each'],
      biomechanical_limitations: ['Limited ankle dorsiflexion affecting squat depth', 'Poor tolerance for high-impact loading on the knees'],
    },
    the_ask: 'Build a first-90-days framework — exercise selection, progression, and a simple way to track wins — that gets him moving consistently without flaring his knees or scaring him off.',
  },
  {
    id: 'local-6',
    scenario_title: 'Tactical Readiness',
    client_profile: {
      age: 29,
      background: 'Career firefighter, 6 years on the job; the annual physical ability test requires a 75 lb loaded stair climb and a 165 lb dummy drag, and he barely passed last cycle.',
      training_age: 'Intermediate · Trains inconsistently around shift schedule',
      primary_goal: "Build the strength-endurance and grip capacity to comfortably pass next year's test",
      constraints: ['Rotating 24-hour shifts disrupt a fixed weekly schedule', 'Station gym has limited equipment (dumbbells, a rower, sandbags)', 'Needs to stay fresh enough to respond to calls mid-shift'],
      biomechanical_limitations: ['Grip endurance is the limiting factor on the dummy drag', 'Reduced thoracic rotation limits awkward-load carries'],
    },
    the_ask: "Design a shift-compatible strength-endurance block — loaded carries, grip work, stair-climb-specific conditioning — that peaks him for the test without leaving him gassed for emergency calls.",
  },
  {
    id: 'local-7',
    scenario_title: 'Early Specialization Burnout',
    client_profile: {
      age: 13,
      background: 'Club volleyball player training 10+ hours/week year-round on one sport since age 9; parents report new complaints of low-back stiffness after practice and a recent dip in motivation.',
      training_age: 'Sport-trained, zero formal strength training history',
      primary_goal: 'Build general athleticism and reduce overuse injury risk while keeping her engaged',
      constraints: ['Practice/games already total 10 hours/week', 'Parents want sessions capped at 2x/week, 40 minutes', 'Growth spurt in progress — coach flagged recent clumsiness'],
      biomechanical_limitations: ['Repetitive lumbar hyperextension pattern from overhead hitting', 'Limited single-leg control consistent with early-growth-spurt awkwardness'],
    },
    the_ask: 'Program a low-volume, high-value long-term athletic development block that builds robustness and re-engages her intrinsic motivation, not just more sport-specific reps.',
  },
  {
    id: 'local-8',
    scenario_title: 'Post-ACLR Return-to-Sport',
    client_profile: {
      age: 19,
      background: 'Collegiate soccer midfielder, 7 months post-ACL reconstruction (patellar tendon autograft); cleared by the surgeon for "sport-specific progression" but not yet cleared for full-contact training.',
      training_age: 'Advanced pre-injury · 7 months of structured rehab',
      primary_goal: 'Close the remaining strength and confidence gap to earn full return-to-play clearance',
      constraints: ['Team practices resume in 5 weeks', 'Limb symmetry index currently at 87% on quad strength testing', 'Access to a full weight room and a physical therapist for co-treatment'],
      biomechanical_limitations: ['Persistent quadriceps strength asymmetry (87% LSI)', 'Visible deceleration avoidance on the involved leg when cutting'],
    },
    the_ask: 'Build a 5-week return-to-sport bridge — strength, plyometric, and change-of-direction progression with objective gates — to close the LSI gap before preseason camp.',
  },
  {
    id: 'local-9',
    scenario_title: 'The Hypermobile Dancer',
    client_profile: {
      age: 21,
      background: 'Pre-professional contemporary dancer with diagnosed joint hypermobility (Beighton score 7/9); reports recurring shoulder subluxation episodes during partner lifts and chronic knee "giving way" sensations.',
      training_age: 'Intermediate (dance-trained) · No formal resistance training history',
      primary_goal: 'Build joint stability and strength capacity to reduce subluxation/instability episodes',
      constraints: ['6 days/week of dance training already in place', 'Can add only 2x/week, 40-minute strength sessions', 'Anxious about lifting heavy after past subluxation scares'],
      biomechanical_limitations: ['Generalized joint hypermobility (Beighton 7/9)', 'Poor active control at end-range shoulder and knee positions'],
    },
    the_ask: 'Design a hypermobility-informed strength progression — end-range control and tendon-loading emphasis over raw load — that reduces instability episodes without adding sessions she cannot recover from.',
  },
  {
    id: 'local-10',
    scenario_title: 'The Shift-Worker Reset',
    client_profile: {
      age: 36,
      background: 'ICU night-shift nurse (three 12-hour overnight shifts/week); reports 25 lb of weight gain over two years, poor sleep quality, and "no energy to train" on shift days.',
      training_age: 'Beginner · Trained casually years ago, currently detrained',
      primary_goal: 'Lose body fat and rebuild energy without wrecking recovery around night shifts',
      constraints: ['Circadian rhythm disrupted by rotating overnight shifts', 'Only reliably available to train on her 4 off-days', 'High cortisol/fatigue load already from shift work'],
      biomechanical_limitations: ['General deconditioning — limited work capacity for sustained effort', 'Poor movement competency in the hip-hinge pattern'],
    },
    the_ask: 'Build a 4-day training structure confined to her off-days that drives fat loss and energy without adding to an already high physiological stress load from shift work.',
  },
];
