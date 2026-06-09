// src/components/vault/prehabProtocol.js
// ─────────────────────────────────────────────────────────────────────────────
// Static catalog driving the Prehab Diagnostic Engine UI
// (feature/prehab-diagnostic-engine).
//
//   • PLANNER  — the three biomechanical range selectors. Each option carries a
//     clinical `status` (ok | warn) and a keyed `code` the report compiles from.
//   • PROTOCOL — the corrective movement deck for the selected region, with the
//     pill-chip metrics (sets / reps / duration) and cue directives.
//
// TRILINGUAL (Terminal India): the catalog now branches EN · ES · PT so the
// clinical copy — planner labels, diagnostic codes, protocol titles, and the
// execution cues — localizes with the active language. The structural ids
// (PLANNER[].id, option `value`, exercise `key`, `status`, `sets`) are
// LANGUAGE-INVARIANT so compileReport() resolves a selection identically in any
// language and the e2e testid hooks stay stable. EN strings are byte-for-byte
// the prior ground-truth.
//
// This is mock/static ground-truth for the UI; the per-athlete read path
// (bbf_get_client_prehab over bbf_prehab_catalog + bbf_client_prehab) is a
// backend follow-up — see e2e/tests/prehab.spec.ts (held contract).

const PREHAB_I18N = {
  en: {
    PLANNER: [
      {
        id: 'ankle',
        label: '1. Ankle Flexion Test (Toe to Wall)',
        default: 'moderate',
        options: [
          { value: 'optimal', label: 'Optimal (Knee passes 5"+ past toe)', status: 'ok',
            code: { title: 'Healthy Ankle Mobility', body: 'Talus bone glides cleanly. Range of motion supports deep athletic squats.' } },
          { value: 'moderate', label: 'Moderate (Knee touches wall 2–4")', status: 'ok',
            code: { title: 'Healthy Ankle Mobility', body: 'Talus bone glides cleanly. Range of motion supports deep athletic squats.' } },
          { value: 'restricted', label: 'Restricted (Knee cannot reach wall)', status: 'warn',
            code: { title: 'Limited Ankle Dorsiflexion', body: 'Talar glide is blocked — the knee cannot track over the toes. Add banded ankle distractions and calf soft-tissue work before loading squat depth.' } },
        ],
      },
      {
        id: 'squat',
        label: '2. Bottom Squat Pelvis Angle',
        default: 'valgus',
        options: [
          { value: 'neutral', label: 'Neutral (Pelvis stays stacked)', status: 'ok',
            code: { title: 'Stable Pelvic Control', body: 'Pelvis stays stacked under load. Deep hip flexion is well organized.' } },
          { value: 'valgus', label: 'Knees collapse inward (Poor abduction)', status: 'warn',
            code: { title: 'Glute Medius Inactivity (Knee Caves)', body: 'Adductors are pulling your femur inside. Slip an elastic loop above the knee cap and run lateral walks and Spanish squats to amass glute recruitment.' } },
          { value: 'butt_wink', label: 'Butt wink (Posterior pelvic tilt)', status: 'warn',
            code: { title: 'Lumbar Flexion Under Load (Butt Wink)', body: 'Pelvis tucks at depth, rounding the lumbar spine. Cap depth at neutral and drill 90/90 breathing for posterior tilt control.' } },
        ],
      },
      {
        id: 'overhead',
        label: '3. Overhead Bar Alignment Check',
        default: 'subacromial',
        options: [
          { value: 'clean', label: 'Clean (Bar stacks over mid-foot)', status: 'ok',
            code: { title: 'Healthy Overhead Stack', body: 'Humeral head centers cleanly. Scapular rhythm supports loaded pressing.' } },
          { value: 'subacromial', label: 'Subacromial Pinching (Humeral impingement)', status: 'warn',
            code: { title: 'Rotator Cuff Subacromial Impingement (Pinch)', body: 'Anterior humeral glide pinching. Perform the Elite Sleeper shoulder stretch and target high cable face pulls.' } },
          { value: 'rib_flare', label: 'Lumbar Compensation (Rib flare)', status: 'warn',
            code: { title: 'Thoracic Extension Compensation (Rib Flare)', body: 'Lats and lumbar are compensating for limited overhead reach. Drill bench thoracic extensions and tall-kneeling presses.' } },
        ],
      },
    ],
    REGIONS: [
      { id: 'lower_back', label: 'Lower Back' },
      { id: 'knee', label: 'Knee' },
      { id: 'shoulder', label: 'Shoulder' },
      { id: 'elbow', label: 'Elbow' },
      { id: 'wrist_hand', label: 'Wrist & Hand' },
    ],
    PROTOCOLS: {
      lower_back: {
        region: 'Lower Back',
        title: 'Spine Decompression & Pelvic Stabilization',
        quote:
          'In elite bodybuilding and powerlifting, deadlifts and squats place immense axial loads on the spine. This routine hydrates the lower lumbar intervertebral discs, co-activates deep lumbar stabilizers, and releases high-tension hip flexors that trigger anterior pelvic tilt shear stress.',
        exercises: [
          {
            key: 'mckenzie_press_up',
            name: 'McKenzie Lumbar Extension Press-ups',
            sets: 3,
            reps: '10 slow reps (5s pause at peak)',
            duration: '~4 min',
            desc: 'Keep your pelvic crest and hips completely flat on the floor. Exhale completely as you press up to fully decompress the lower back.',
            cues: [
              'Let your spine drape like a hammock',
              'Prevent shrugging your neck; push the shoulders away from chest',
              'Breathe deep into your lower belly at the top of the extension',
            ],
          },
          {
            key: 'bird_dog',
            name: 'Bird-Dog Extensions with Abdominal Bracing',
            sets: 3,
            reps: '10 reps each side (hold 2s)',
            duration: '~5 min',
            desc: 'Place a foam roller on your waist; it must remain perfectly level. Ensure no hyper-extension of the lower back.',
            cues: [
              'Drive out through the heel instead of kicking up high',
              'Brace your abs as if prepping for a heavy punch',
              'Form a straight steel rod line from your fingertips to your opposing heel',
            ],
          },
          {
            key: 'dead_bug',
            name: 'Dead Bug Anti-Extension Hold',
            sets: 3,
            reps: '8 reps each side',
            duration: '~4 min',
            desc: 'Press your lower back flat into the floor and extend the opposite arm and leg without letting the ribs flare off the deck.',
            cues: [
              'Exhale hard as the limbs reach to lock the ribcage down',
              'Move slow — no momentum from the hips',
              'Keep both shoulder blades pinned to the floor',
            ],
          },
          {
            key: 'cat_cow',
            name: 'Cat-Cow Spinal Mobilization',
            sets: 2,
            reps: '12 slow cycles',
            duration: '~3 min',
            desc: 'On all fours, flow between full spinal flexion (cat) and extension (cow) to pump fluid through every lumbar segment before loading.',
            cues: [
              'Move one vertebra at a time — top down',
              'Sync the breath: exhale to round, inhale to arch',
              'Keep the wrists stacked under the shoulders',
            ],
          },
          {
            key: 'childs_pose',
            name: "Child's Pose Decompression",
            sets: 3,
            reps: '3 × 45s hold',
            duration: '~3 min',
            desc: 'Sit the hips back toward the heels and reach the arms long to traction the lumbar spine and open the posterior chain.',
            cues: [
              'Walk the hands forward to lengthen the spine',
              'Breathe into the lower back and let the hips sink',
              'Widen the knees if the belly blocks the fold',
            ],
          },
          {
            key: 'pelvic_tilt',
            name: 'Supine Posterior Pelvic Tilt',
            sets: 3,
            reps: '12 reps (3s hold)',
            duration: '~3 min',
            desc: 'Lying on your back with knees bent, flatten the lumbar curve into the floor by gently tucking the pelvis — re-grooving deep core control.',
            cues: [
              'Drive the belt-line down into the mat',
              'Squeeze the lower abs, not the glutes',
              'Keep the ribcage quiet and breathing',
            ],
          },
          {
            key: 'knee_to_chest',
            name: 'Single Knee-to-Chest Release',
            sets: 3,
            reps: '10 reps each side (3s hold)',
            duration: '~4 min',
            desc: 'Draw one knee to the chest while the opposite leg stays long, decompressing the lumbar facets and lengthening the glute.',
            cues: [
              'Pull from behind the thigh, not over the kneecap',
              'Keep the down-leg heel pressing away',
              'Relax the shoulders flat on the floor',
            ],
          },
          {
            key: 'supine_lumbar_rotation',
            name: 'Supine Lower-Trunk Rotation',
            sets: 3,
            reps: '10 reps each side (2s hold)',
            duration: '~4 min',
            desc: 'Knees stacked and bent, let them fall side to side to mobilize lumbar rotation and unwind paraspinal tension.',
            cues: [
              'Keep both shoulder blades glued down',
              'Move only to a pain-free range',
              'Control the return — no flopping',
            ],
          },
          {
            key: 'half_kneeling_hip_flexor',
            name: 'Half-Kneeling Hip Flexor Stretch',
            sets: 3,
            reps: '3 × 30s each side',
            duration: '~4 min',
            desc: 'In a half-kneel, tuck the pelvis and shift forward to release the high-tension hip flexors that drive anterior pelvic tilt shear.',
            cues: [
              'Posterior-tilt the pelvis BEFORE you lean',
              'Squeeze the down-side glute hard',
              'Keep the ribs stacked over the hips — no arch',
            ],
          },
          {
            key: 'side_plank',
            name: 'Side Plank (Lateral Chain)',
            sets: 3,
            reps: '3 × 30s each side',
            duration: '~4 min',
            desc: 'Build the quadratus lumborum and oblique sling that braces the spine against lateral shear under load.',
            cues: [
              'Stack the hips and drive them tall',
              'Keep a straight line from ear to ankle',
              'Brace the obliques — do not sag',
            ],
          },
        ],
      },
      knee: {
        region: 'Knee',
        title: 'Patellar Tracking & Knee Stabilization',
        quote:
          'Heavy squats and split-squats drive patellofemoral compression. This block restores VMO tone, glute-medius control of the femur, and posterior-chain support so the kneecap tracks clean through depth.',
        exercises: [
          {
            key: 'tempo_goblet_squat',
            name: 'Tempo Goblet Squat (4s Descent)',
            sets: 3,
            reps: '8 reps (4s down)',
            duration: '~5 min',
            desc: 'Sit straight down between the hips with a slow eccentric, keeping the knees tracking over the second toe.',
            cues: [
              'Drive the knees out — never let them cave inward',
              'Stay tall through the sternum, ribs stacked',
            ],
          },
          {
            key: 'terminal_knee_ext',
            name: 'Terminal Knee Extension (VMO Bias)',
            sets: 3,
            reps: '15 reps (2s hold at lockout)',
            duration: '~4 min',
            desc: 'Squeeze the teardrop quad hard at full lockout to re-pattern the VMO that stabilizes the kneecap.',
            cues: [
              'Pause and contract hard at the top',
              'Slow and controlled — no swinging the load',
            ],
          },
          {
            key: 'glute_bridge',
            name: 'Glute Bridge (Posterior Support)',
            sets: 3,
            reps: '12 reps (2s squeeze)',
            duration: '~4 min',
            desc: 'Build the posterior chain that offloads the front of the knee; finish each rep with a hard glute lock-out.',
            cues: [
              'Push through the heels, not the toes',
              'Lock the glutes — do not hyperextend the lower back',
            ],
          },
          {
            key: 'spanish_squat',
            name: 'Spanish Squat (Isometric)',
            sets: 3,
            reps: '5 × 30s hold',
            duration: '~5 min',
            desc: 'Loop a heavy band behind the knees and sit back into a vertical-shin squat to load the quad tendon without compressing the patella.',
            cues: [
              'Lean back into the band, trunk tall',
              'Keep the shins vertical — sit straight down',
              'Drive the knees out, weight in the heels',
            ],
          },
          {
            key: 'wall_sit',
            name: 'Wall Sit (Quad Isometric)',
            sets: 3,
            reps: '4 × 30–45s hold',
            duration: '~5 min',
            desc: 'Hold a 90° seated position against the wall to build pain-free quad capacity and patellar-tendon tolerance.',
            cues: [
              'Thighs parallel to the floor',
              'Knees tracking over the toes, not caving',
              'Press the whole back flat into the wall',
            ],
          },
          {
            key: 'eccentric_step_down',
            name: 'Eccentric Step-Down',
            sets: 3,
            reps: '10 reps each leg (4s down)',
            duration: '~5 min',
            desc: 'Stand on a low box and lower the opposite heel under control to train the quad and clean patellar tracking eccentrically.',
            cues: [
              'Lower for a slow four-count',
              'Keep the standing knee over the toe',
              'Tap the heel softly — no crashing',
            ],
          },
          {
            key: 'lateral_band_walk',
            name: 'Lateral Band Walk',
            sets: 3,
            reps: '12 steps each direction',
            duration: '~4 min',
            desc: 'A loop above the knees, sink to a quarter-squat and step sideways to fire the glute medius that stops the knee caving in.',
            cues: [
              'Stay low — do not bob up and down',
              'Lead with the heel, toes forward',
              'Keep tension on the band the whole set',
            ],
          },
          {
            key: 'clamshell',
            name: 'Banded Clamshell',
            sets: 3,
            reps: '15 reps each side (1s hold)',
            duration: '~4 min',
            desc: 'Side-lying with knees bent, open the top knee against the band to isolate the glute medius and external rotators.',
            cues: [
              'Keep the heels glued together',
              'Do not let the hips roll back',
              'Pause and squeeze at the top',
            ],
          },
          {
            key: 'standing_calf_raise',
            name: 'Standing Calf Raise',
            sets: 3,
            reps: '15 reps (2s squeeze)',
            duration: '~4 min',
            desc: 'Strong calves absorb landing force and offload the knee; press up tall and lower under control through a full range.',
            cues: [
              'Rise onto the big-toe knuckle',
              'Pause at the top, then lower slowly',
              'Keep the knees soft, not locked',
            ],
          },
          {
            key: 'single_leg_rdl',
            name: 'Single-Leg RDL (Balance)',
            sets: 3,
            reps: '8 reps each leg',
            duration: '~5 min',
            desc: 'Hinge over one leg to build the posterior-chain control and single-leg stability that protect the knee in sport.',
            cues: [
              'Hinge at the hip — flat back',
              'Square the hips to the floor',
              'Drive through the heel to stand tall',
            ],
          },
        ],
      },
      shoulder: {
        region: 'Shoulder',
        title: 'Rotator Cuff & Scapular Decompression',
        quote:
          'Pressing volume crowds the subacromial space and drags the humeral head forward. This block restores posterior-cuff tone, scapular rhythm, and the external-rotation strength that re-centers the joint.',
        exercises: [
          {
            key: 'cable_face_pull',
            name: 'Cable Face Pull (External Rotation)',
            sets: 3,
            reps: '15 reps (1s hold)',
            duration: '~4 min',
            desc: 'Pull to the forehead and rotate the knuckles up to bias the posterior cuff and lower traps.',
            cues: [
              'Lead with the elbows, high and wide',
              'Pinch the shoulder blades — pause at the back',
            ],
          },
          {
            key: 'band_pull_apart',
            name: 'Band Pull-Apart',
            sets: 3,
            reps: '20 reps',
            duration: '~3 min',
            desc: 'Re-balance the upper back against pressing dominance; keep the reps strict and slow.',
            cues: [
              'Squeeze the blades together at full stretch',
              'Keep the ribs down — no shrug',
            ],
          },
          {
            key: 'scap_lateral_raise',
            name: 'Scapular-Plane Lateral Raise (Light)',
            sets: 3,
            reps: '15 reps',
            duration: '~3 min',
            desc: 'Raise in the scapular plane (about 30° forward) with light load to groom clean overhead mechanics.',
            cues: [
              'Lead with the elbow, thumb slightly up',
              'Stop at shoulder height — no higher under pinch',
            ],
          },
          {
            key: 'sleeper_stretch',
            name: 'Sleeper Stretch (Internal Rotation)',
            sets: 3,
            reps: '3 × 30s each side',
            duration: '~4 min',
            desc: 'Side-lying on the working arm, press the forearm down to restore internal rotation and release a tight posterior cuff.',
            cues: [
              'Pin the shoulder blade to the floor',
              'Press only to a gentle stretch — never pain',
              'Keep the elbow at 90°',
            ],
          },
          {
            key: 'side_lying_external_rotation',
            name: 'Side-Lying External Rotation',
            sets: 3,
            reps: '15 reps each side (2s lower)',
            duration: '~4 min',
            desc: 'Elbow pinned to the ribs, rotate a light dumbbell up to strengthen the infraspinatus and re-center the humeral head.',
            cues: [
              'Keep a towel roll under the elbow',
              'Lead with the back of the hand',
              'Lower slowly — control the eccentric',
            ],
          },
          {
            key: 'wall_slide',
            name: 'Scapular Wall Slide',
            sets: 3,
            reps: '12 reps (1s at top)',
            duration: '~3 min',
            desc: 'Forearms on the wall, slide up and overhead to groove clean upward scapular rotation and serratus timing.',
            cues: [
              'Keep the wrists and elbows on the wall',
              'Reach tall at the top, then set the blades',
              'Ribs down — do not arch the back',
            ],
          },
          {
            key: 'prone_ytw',
            name: 'Prone Y-T-W Raises',
            sets: 3,
            reps: '8 reps each letter',
            duration: '~5 min',
            desc: 'Face-down, lift the arms into Y, T, and W shapes to build the lower traps and posterior cuff that own scapular posture.',
            cues: [
              'Lead with the thumbs up',
              'Squeeze the blades down and back',
              'Keep the neck long — chin tucked',
            ],
          },
          {
            key: 'scapular_pushup',
            name: 'Scapular Push-Up',
            sets: 3,
            reps: '15 reps (1s hold)',
            duration: '~3 min',
            desc: 'In a plank, protract and retract the shoulder blades with straight arms to wake up the serratus anterior.',
            cues: [
              'Move only the shoulder blades — arms stay locked',
              'Push the floor away to round the upper back',
              'Keep the core braced, hips level',
            ],
          },
          {
            key: 'doorway_pec_stretch',
            name: 'Doorway Pec Stretch',
            sets: 3,
            reps: '3 × 30s hold',
            duration: '~4 min',
            desc: 'Forearms on the frame, step through to open a chest that pulls the shoulders forward and crowds the joint.',
            cues: [
              'Set the elbows at shoulder height',
              'Step through gently — feel the chest, not the shoulder',
              'Keep the ribs down and breathe',
            ],
          },
          {
            key: 'band_shoulder_dislocate',
            name: 'Band Shoulder Pass-Through',
            sets: 3,
            reps: '10 slow reps',
            duration: '~3 min',
            desc: 'With a wide grip on a band, pass the arms overhead and behind to open overhead range and oil the joint capsule.',
            cues: [
              'Go wide enough to stay pain-free',
              'Keep the elbows straight throughout',
              'Move slow — no forcing the end range',
            ],
          },
        ],
      },
      elbow: {
        region: 'Elbow',
        title: 'Tendon Resilience & Forearm Loading',
        quote:
          'Curls, pulls, and pressing tax the common flexor and extensor tendons. Heavy slow eccentrics remodel the tendon and build the forearm capacity that protects the elbow under load.',
        exercises: [
          {
            key: 'eccentric_hammer_curl',
            name: 'Eccentric Hammer Curl (4s Lower)',
            sets: 3,
            reps: '8 reps (4s down)',
            duration: '~4 min',
            desc: 'Load the brachioradialis with a heavy, slow lower to remodel the lateral elbow tendon.',
            cues: [
              'Lower under control for a full four-count',
              'Keep the elbow pinned to the ribs',
            ],
          },
          {
            key: 'triceps_pushdown_ecc',
            name: 'Triceps Pushdown (Slow Eccentric)',
            sets: 3,
            reps: '12 reps (3s up)',
            duration: '~4 min',
            desc: 'Resist the return to load the triceps tendon without sharp end-range stress.',
            cues: [
              'Fight the cable on the way back up',
              'Keep the wrists neutral, elbows quiet',
            ],
          },
          {
            key: 'bench_dip_controlled',
            name: 'Controlled Bench Dip',
            sets: 3,
            reps: '10 reps',
            duration: '~4 min',
            desc: 'Build triceps and elbow capacity through a controlled, pain-free range; never sink past comfort.',
            cues: [
              'Stop above any pinch in the joint',
              'Keep the shoulders down, away from the ears',
            ],
          },
          {
            key: 'flexbar_tyler_twist',
            name: 'FlexBar Tyler Twist (Tennis Elbow)',
            sets: 3,
            reps: '12 reps (3s release)',
            duration: '~4 min',
            desc: 'The gold-standard eccentric for lateral elbow pain — twist the bar, then slowly let the painful side untwist to remodel the extensor tendon.',
            cues: [
              'Load the twist with the healthy hand',
              'Release slowly under control',
              'Stop short of sharp pain',
            ],
          },
          {
            key: 'flexbar_reverse_twist',
            name: 'FlexBar Reverse Twist (Golfer’s Elbow)',
            sets: 3,
            reps: '12 reps (3s release)',
            duration: '~4 min',
            desc: 'The medial-side mirror — pre-twist, then let the painful flexor side untwist slowly to load the common flexor tendon.',
            cues: [
              'Set the twist with the good hand',
              'Control the slow untwist',
              'Keep the wrist movement smooth',
            ],
          },
          {
            key: 'reverse_barbell_curl',
            name: 'Reverse Curl (Extensor Bias)',
            sets: 3,
            reps: '12 reps (3s lower)',
            duration: '~4 min',
            desc: 'Pronated grip loads the brachioradialis and wrist extensors that stabilize the lateral elbow under pulling volume.',
            cues: [
              'Knuckles up, wrists firm and neutral',
              'Keep the elbows pinned to the ribs',
              'Lower slowly — no swing',
            ],
          },
          {
            key: 'db_supination_pronation',
            name: 'Forearm Supination / Pronation',
            sets: 3,
            reps: '12 reps each way (2s)',
            duration: '~4 min',
            desc: 'Forearm braced, rotate a light dumbbell palm-up to palm-down to restore rotational tendon capacity around the elbow.',
            cues: [
              'Anchor the forearm on the thigh',
              'Rotate slow and full, both directions',
              'Keep the elbow tucked and quiet',
            ],
          },
          {
            key: 'wrist_extensor_stretch',
            name: 'Wrist Extensor Stretch',
            sets: 3,
            reps: '3 × 30s each side',
            duration: '~3 min',
            desc: 'Arm straight, gently flex the wrist down with the palm facing you to lengthen the tight extensors of tennis elbow.',
            cues: [
              'Keep the elbow fully straight',
              'Pull only to a gentle stretch',
              'Drop the shoulder away from the ear',
            ],
          },
          {
            key: 'wrist_flexor_stretch',
            name: 'Wrist Flexor Stretch',
            sets: 3,
            reps: '3 × 30s each side',
            duration: '~3 min',
            desc: 'Arm straight and palm up, ease the fingers and wrist back to release the common flexor tendon of golfer’s elbow.',
            cues: [
              'Keep the elbow locked straight',
              'Spread and draw back the fingers',
              'Ease in — never bounce the stretch',
            ],
          },
          {
            key: 'eccentric_wrist_extension',
            name: 'Eccentric Wrist Extension',
            sets: 3,
            reps: '15 reps (4s lower)',
            duration: '~4 min',
            desc: 'Forearm supported, raise a light dumbbell into extension, then lower over a slow four-count to remodel the extensor tendon.',
            cues: [
              'Assist up with the free hand if needed',
              'Own the slow four-count lower',
              'Keep the forearm flat and still',
            ],
          },
        ],
      },
      wrist_hand: {
        region: 'Wrist & Hand',
        title: 'Wrist Mobility & Grip Integrity',
        quote:
          'Pressing, the front rack, and pulling all funnel load through the wrist and hand. This block builds extensor balance, weight-bearing tolerance, and grip integrity so the joint stays pain-free under the bar.',
        exercises: [
          {
            key: 'reverse_wrist_curl',
            name: 'Reverse Wrist Curl (Extensors)',
            sets: 3,
            reps: '15 reps (2s lower)',
            duration: '~3 min',
            desc: 'Strengthen the wrist extensors that balance grip-dominant training; keep the motion small and strict.',
            cues: [
              'Anchor the forearm on the thigh',
              'Lower slowly — no momentum',
            ],
          },
          {
            key: 'wrist_extension_load',
            name: 'Weight-Bearing Wrist Rocks',
            sets: 3,
            reps: '10 rocks (2s hold)',
            duration: '~3 min',
            desc: 'On hands and knees, rock gently over loaded palms to build the wrist-extension tolerance pressing demands.',
            cues: [
              'Spread the fingers and grip the floor',
              'Move only as far as stays pain-free',
            ],
          },
          {
            key: 'dead_hang',
            name: 'Dead Hang Decompression',
            sets: 3,
            reps: '3 × 30s hang',
            duration: '~4 min',
            desc: 'Hang from a bar to decompress the wrist and elbow and rebuild fail-safe grip endurance.',
            cues: [
              'Active shoulders — pull the blades down',
              'Breathe and build the hang time gradually',
            ],
          },
          {
            key: 'wrist_flexor_curl',
            name: 'Wrist Curl (Flexors)',
            sets: 3,
            reps: '15 reps (2s lower)',
            duration: '~3 min',
            desc: 'Palms up and forearm braced, curl a light dumbbell to build the wrist flexors that stabilize the bar in the rack and the pull.',
            cues: [
              'Rest the forearm on the thigh, palm up',
              'Let the weight roll to the fingers, then curl',
              'Lower slow — full pain-free range',
            ],
          },
          {
            key: 'wrist_circles',
            name: 'Wrist Circles (Mobility)',
            sets: 2,
            reps: '10 circles each direction',
            duration: '~2 min',
            desc: 'Interlace the fingers or make fists and circle the wrists to warm the joint capsule and synovial fluid before loading.',
            cues: [
              'Move through the biggest pain-free circle',
              'Go slow both directions',
              'Relax the shoulders and breathe',
            ],
          },
          {
            key: 'prayer_stretch',
            name: 'Prayer & Reverse-Prayer Stretch',
            sets: 3,
            reps: '3 × 30s each position',
            duration: '~3 min',
            desc: 'Palms together press down (flexors), then knuckles together press up (extensors) to balance forearm mobility.',
            cues: [
              'Keep the palms/knuckles glued together',
              'Lower the hands until you feel the stretch',
              'Hold steady — no bouncing',
            ],
          },
          {
            key: 'finger_extension_band',
            name: 'Banded Finger Extension',
            sets: 3,
            reps: '15 reps (1s hold)',
            duration: '~3 min',
            desc: 'Loop a band around the fingertips and open the hand to train the finger extensors that grip-heavy training neglects.',
            cues: [
              'Spread the fingers wide and slow',
              'Pause at full spread',
              'Control the return — don’t snap shut',
            ],
          },
          {
            key: 'grip_squeeze',
            name: 'Grip Squeeze (Ball / Gripper)',
            sets: 3,
            reps: '15 reps (2s squeeze)',
            duration: '~3 min',
            desc: 'Squeeze a ball or gripper to build the hand and forearm flexor capacity that keeps the wrist stable under heavy loads.',
            cues: [
              'Squeeze hard and hold the peak',
              'Open the hand fully between reps',
              'Keep the wrist straight and neutral',
            ],
          },
          {
            key: 'radial_ulnar_deviation',
            name: 'Radial / Ulnar Deviation',
            sets: 3,
            reps: '12 reps each way',
            duration: '~3 min',
            desc: 'Thumb up, tilt a light weight up (radial) and down (ulnar) to strengthen the side-to-side wrist stabilizers.',
            cues: [
              'Move only at the wrist — forearm still',
              'Keep the motion small and controlled',
              'Use a very light load',
            ],
          },
          {
            key: 'finger_tendon_glides',
            name: 'Finger Tendon Glides',
            sets: 3,
            reps: '8 full sequences',
            duration: '~3 min',
            desc: 'Cycle the fingers through straight, hook, fist, and tabletop shapes to glide the tendons and keep the hand supple.',
            cues: [
              'Move slowly through each shape',
              'Make each position crisp and full',
              'Keep the wrist neutral throughout',
            ],
          },
        ],
      },
    },
  },

  es: {
    PLANNER: [
      {
        id: 'ankle',
        label: '1. Test de Flexión de Tobillo (Dedo a la Pared)',
        default: 'moderate',
        options: [
          { value: 'optimal', label: 'Óptimo (La rodilla pasa 5"+ del dedo)', status: 'ok',
            code: { title: 'Movilidad de Tobillo Saludable', body: 'El astrágalo se desliza limpiamente. El rango de movimiento permite sentadillas atléticas profundas.' } },
          { value: 'moderate', label: 'Moderado (La rodilla toca la pared 2–4")', status: 'ok',
            code: { title: 'Movilidad de Tobillo Saludable', body: 'El astrágalo se desliza limpiamente. El rango de movimiento permite sentadillas atléticas profundas.' } },
          { value: 'restricted', label: 'Restringido (La rodilla no alcanza la pared)', status: 'warn',
            code: { title: 'Dorsiflexión de Tobillo Limitada', body: 'El deslizamiento talar está bloqueado — la rodilla no puede avanzar sobre los dedos. Añade distracciones de tobillo con banda y trabajo de tejido blando en la pantorrilla antes de cargar profundidad de sentadilla.' } },
        ],
      },
      {
        id: 'squat',
        label: '2. Ángulo de la Pelvis en el Fondo de la Sentadilla',
        default: 'valgus',
        options: [
          { value: 'neutral', label: 'Neutral (La pelvis se mantiene alineada)', status: 'ok',
            code: { title: 'Control Pélvico Estable', body: 'La pelvis se mantiene alineada bajo carga. La flexión profunda de cadera está bien organizada.' } },
          { value: 'valgus', label: 'Las rodillas colapsan hacia adentro (Mala abducción)', status: 'warn',
            code: { title: 'Inactividad del Glúteo Medio (Rodillas Hacia Adentro)', body: 'Los aductores jalan tu fémur hacia adentro. Coloca una banda elástica sobre la rótula y realiza caminatas laterales y sentadillas españolas para acumular reclutamiento del glúteo.' } },
          { value: 'butt_wink', label: 'Retroversión pélvica (Inclinación pélvica posterior)', status: 'warn',
            code: { title: 'Flexión Lumbar Bajo Carga (Retroversión)', body: 'La pelvis se mete en la profundidad, redondeando la columna lumbar. Limita la profundidad en neutral y entrena la respiración 90/90 para controlar la inclinación posterior.' } },
        ],
      },
      {
        id: 'overhead',
        label: '3. Chequeo de Alineación de la Barra sobre la Cabeza',
        default: 'subacromial',
        options: [
          { value: 'clean', label: 'Limpio (La barra se alinea sobre el medio del pie)', status: 'ok',
            code: { title: 'Alineación Saludable sobre la Cabeza', body: 'La cabeza humeral se centra limpiamente. El ritmo escapular permite el press con carga.' } },
          { value: 'subacromial', label: 'Pinzamiento Subacromial (Pinzamiento humeral)', status: 'warn',
            code: { title: 'Pinzamiento Subacromial del Manguito Rotador', body: 'Deslizamiento humeral anterior con pinzamiento. Realiza el estiramiento de hombro "Sleeper" y enfócate en face pulls altos con cable.' } },
          { value: 'rib_flare', label: 'Compensación Lumbar (Apertura costal)', status: 'warn',
            code: { title: 'Compensación de Extensión Torácica (Apertura Costal)', body: 'Los dorsales y la zona lumbar compensan el alcance limitado sobre la cabeza. Entrena extensiones torácicas en banco y press de rodillas erguido.' } },
        ],
      },
    ],
    REGIONS: [
      { id: 'lower_back', label: 'Zona Lumbar' },
      { id: 'knee', label: 'Rodilla' },
      { id: 'shoulder', label: 'Hombro' },
      { id: 'elbow', label: 'Codo' },
      { id: 'wrist_hand', label: 'Muñeca y Mano' },
    ],
    PROTOCOLS: {
      lower_back: {
        region: 'Zona Lumbar',
        title: 'Descompresión de la Columna y Estabilización Pélvica',
        quote:
          'En el culturismo y el powerlifting de élite, los pesos muertos y las sentadillas imponen cargas axiales inmensas sobre la columna. Esta rutina hidrata los discos intervertebrales lumbares bajos, coactiva los estabilizadores lumbares profundos y libera los flexores de cadera de alta tensión que provocan estrés de cizallamiento por anteversión pélvica.',
        exercises: [
          {
            key: 'mckenzie_press_up',
            name: 'Press-ups de Extensión Lumbar McKenzie',
            sets: 3,
            reps: '10 reps lentas (pausa de 5s en el pico)',
            duration: '~4 min',
            desc: 'Mantén la cresta pélvica y las caderas completamente planas en el suelo. Exhala por completo al empujar hacia arriba para descomprimir totalmente la zona lumbar.',
            cues: [
              'Deja que tu columna cuelgue como una hamaca',
              'Evita encoger el cuello; aleja los hombros del pecho',
              'Respira profundo hacia el bajo vientre en la cima de la extensión',
            ],
          },
          {
            key: 'bird_dog',
            name: 'Extensiones Bird-Dog con Tensión Abdominal',
            sets: 3,
            reps: '10 reps por lado (mantén 2s)',
            duration: '~5 min',
            desc: 'Coloca un rodillo de espuma en tu cintura; debe permanecer perfectamente nivelado. Asegúrate de no hiperextender la zona lumbar.',
            cues: [
              'Empuja hacia afuera por el talón en lugar de patear alto',
              'Tensa los abdominales como si te prepararas para un golpe fuerte',
              'Forma una línea recta de acero desde la punta de los dedos hasta el talón opuesto',
            ],
          },
          {
            key: 'dead_bug',
            name: 'Dead Bug con Sostén Anti-Extensión',
            sets: 3,
            reps: '8 reps por lado',
            duration: '~4 min',
            desc: 'Presiona la zona lumbar plana contra el suelo y extiende el brazo y la pierna opuestos sin dejar que las costillas se abran del piso.',
            cues: [
              'Exhala con fuerza al extender las extremidades para fijar la caja torácica',
              'Muévete lento — sin impulso desde las caderas',
              'Mantén ambas escápulas fijas al suelo',
            ],
          },
          {
            key: 'cat_cow',
            name: 'Movilización Espinal Gato-Vaca',
            sets: 2,
            reps: '12 ciclos lentos',
            duration: '~3 min',
            desc: 'En cuadrupedia, fluye entre la flexión espinal completa (gato) y la extensión (vaca) para bombear líquido por cada segmento lumbar antes de cargar.',
            cues: [
              'Mueve una vértebra a la vez — de arriba abajo',
              'Sincroniza la respiración: exhala al redondear, inhala al arquear',
              'Mantén las muñecas alineadas bajo los hombros',
            ],
          },
          {
            key: 'childs_pose',
            name: 'Descompresión en Postura del Niño',
            sets: 3,
            reps: '3 × 45s de sostén',
            duration: '~3 min',
            desc: 'Lleva las caderas hacia los talones y estira los brazos largos para traccionar la columna lumbar y abrir la cadena posterior.',
            cues: [
              'Camina las manos hacia adelante para alargar la columna',
              'Respira hacia la zona lumbar y deja hundir las caderas',
              'Abre las rodillas si el abdomen bloquea el pliegue',
            ],
          },
          {
            key: 'pelvic_tilt',
            name: 'Retroversión Pélvica en Supino',
            sets: 3,
            reps: '12 reps (sostén 3s)',
            duration: '~3 min',
            desc: 'Boca arriba con las rodillas flexionadas, aplana la curva lumbar contra el suelo metiendo suavemente la pelvis — reactivando el control del core profundo.',
            cues: [
              'Hunde la línea del cinturón contra la colchoneta',
              'Aprieta el bajo abdomen, no los glúteos',
              'Mantén la caja torácica quieta y respirando',
            ],
          },
          {
            key: 'knee_to_chest',
            name: 'Liberación Rodilla al Pecho (Unilateral)',
            sets: 3,
            reps: '10 reps por lado (sostén 3s)',
            duration: '~4 min',
            desc: 'Lleva una rodilla al pecho mientras la pierna opuesta permanece larga, descomprimiendo las facetas lumbares y alargando el glúteo.',
            cues: [
              'Tira desde detrás del muslo, no sobre la rótula',
              'Mantén el talón de la pierna baja empujando lejos',
              'Relaja los hombros planos en el suelo',
            ],
          },
          {
            key: 'supine_lumbar_rotation',
            name: 'Rotación Lumbar Baja en Supino',
            sets: 3,
            reps: '10 reps por lado (sostén 2s)',
            duration: '~4 min',
            desc: 'Rodillas juntas y flexionadas, déjalas caer de lado a lado para movilizar la rotación lumbar y soltar la tensión paravertebral.',
            cues: [
              'Mantén ambas escápulas pegadas al suelo',
              'Muévete solo en un rango sin dolor',
              'Controla el regreso — sin dejar caer',
            ],
          },
          {
            key: 'half_kneeling_hip_flexor',
            name: 'Estiramiento de Flexor de Cadera en Semiarrodillado',
            sets: 3,
            reps: '3 × 30s por lado',
            duration: '~4 min',
            desc: 'En semiarrodillado, mete la pelvis y desplázate hacia adelante para liberar los flexores de cadera de alta tensión que provocan el cizallamiento por anteversión pélvica.',
            cues: [
              'Retroversiona la pelvis ANTES de inclinarte',
              'Aprieta fuerte el glúteo del lado de abajo',
              'Mantén las costillas sobre las caderas — sin arquear',
            ],
          },
          {
            key: 'side_plank',
            name: 'Plancha Lateral (Cadena Lateral)',
            sets: 3,
            reps: '3 × 30s por lado',
            duration: '~4 min',
            desc: 'Construye el cuadrado lumbar y el sistema oblicuo que estabiliza la columna contra el cizallamiento lateral bajo carga.',
            cues: [
              'Alinea las caderas y elévalas alto',
              'Mantén una línea recta de la oreja al tobillo',
              'Tensa los oblicuos — no te hundas',
            ],
          },
        ],
      },
      knee: {
        region: 'Rodilla',
        title: 'Seguimiento Rotuliano y Estabilización de Rodilla',
        quote:
          'Las sentadillas y sentadillas búlgaras pesadas generan compresión patelofemoral. Este bloque restaura el tono del vasto medial (VMO), el control del fémur por el glúteo medio y el soporte de la cadena posterior para que la rótula se deslice limpia en profundidad.',
        exercises: [
          {
            key: 'tempo_goblet_squat',
            name: 'Sentadilla Goblet con Tempo (Descenso 4s)',
            sets: 3,
            reps: '8 reps (4s bajando)',
            duration: '~5 min',
            desc: 'Siéntate recto entre las caderas con un excéntrico lento, manteniendo las rodillas alineadas sobre el segundo dedo.',
            cues: [
              'Empuja las rodillas hacia afuera — nunca dejes que colapsen',
              'Mantente erguido por el esternón, costillas alineadas',
            ],
          },
          {
            key: 'terminal_knee_ext',
            name: 'Extensión Terminal de Rodilla (Énfasis VMO)',
            sets: 3,
            reps: '15 reps (2s de sostén en el bloqueo)',
            duration: '~4 min',
            desc: 'Aprieta fuerte el cuádriceps en el bloqueo completo para reactivar el VMO que estabiliza la rótula.',
            cues: [
              'Pausa y contrae fuerte arriba',
              'Lento y controlado — sin balancear la carga',
            ],
          },
          {
            key: 'glute_bridge',
            name: 'Puente de Glúteos (Soporte Posterior)',
            sets: 3,
            reps: '12 reps (2s de apriete)',
            duration: '~4 min',
            desc: 'Construye la cadena posterior que descarga la parte frontal de la rodilla; termina cada rep con un bloqueo firme de glúteos.',
            cues: [
              'Empuja por los talones, no por los dedos',
              'Bloquea los glúteos — no hiperextiendas la zona lumbar',
            ],
          },
          {
            key: 'spanish_squat',
            name: 'Sentadilla Española (Isométrica)',
            sets: 3,
            reps: '5 × 30s de sostén',
            duration: '~5 min',
            desc: 'Coloca una banda fuerte detrás de las rodillas y siéntate atrás en una sentadilla de tibia vertical para cargar el tendón del cuádriceps sin comprimir la rótula.',
            cues: [
              'Recuéstate sobre la banda, tronco erguido',
              'Mantén las tibias verticales — siéntate recto',
              'Empuja las rodillas hacia afuera, peso en los talones',
            ],
          },
          {
            key: 'wall_sit',
            name: 'Sentadilla en Pared (Isométrica de Cuádriceps)',
            sets: 3,
            reps: '4 × 30–45s de sostén',
            duration: '~5 min',
            desc: 'Mantén una posición sentada a 90° contra la pared para construir capacidad de cuádriceps sin dolor y tolerancia del tendón rotuliano.',
            cues: [
              'Muslos paralelos al suelo',
              'Rodillas alineadas sobre los dedos, sin colapsar',
              'Presiona toda la espalda plana contra la pared',
            ],
          },
          {
            key: 'eccentric_step_down',
            name: 'Descenso de Escalón Excéntrico',
            sets: 3,
            reps: '10 reps por pierna (4s bajando)',
            duration: '~5 min',
            desc: 'Párate sobre un cajón bajo y baja el talón opuesto bajo control para entrenar el cuádriceps y el seguimiento rotuliano de forma excéntrica.',
            cues: [
              'Baja en un conteo lento de cuatro',
              'Mantén la rodilla de apoyo sobre el dedo',
              'Toca el talón suave — sin golpear',
            ],
          },
          {
            key: 'lateral_band_walk',
            name: 'Caminata Lateral con Banda',
            sets: 3,
            reps: '12 pasos cada dirección',
            duration: '~4 min',
            desc: 'Con una banda sobre las rodillas, baja a un cuarto de sentadilla y da pasos laterales para activar el glúteo medio que evita que la rodilla colapse.',
            cues: [
              'Mantente bajo — sin subir y bajar',
              'Lidera con el talón, dedos al frente',
              'Mantén tensión en la banda toda la serie',
            ],
          },
          {
            key: 'clamshell',
            name: 'Almeja con Banda (Clamshell)',
            sets: 3,
            reps: '15 reps por lado (sostén 1s)',
            duration: '~4 min',
            desc: 'De lado con las rodillas flexionadas, abre la rodilla superior contra la banda para aislar el glúteo medio y los rotadores externos.',
            cues: [
              'Mantén los talones pegados',
              'No dejes que las caderas roten hacia atrás',
              'Pausa y aprieta arriba',
            ],
          },
          {
            key: 'standing_calf_raise',
            name: 'Elevación de Talones de Pie',
            sets: 3,
            reps: '15 reps (aprieta 2s)',
            duration: '~4 min',
            desc: 'Pantorrillas fuertes absorben la fuerza del aterrizaje y descargan la rodilla; sube alto y baja con control en todo el rango.',
            cues: [
              'Sube sobre el nudillo del dedo gordo',
              'Pausa arriba, luego baja lento',
              'Mantén las rodillas suaves, sin bloquear',
            ],
          },
          {
            key: 'single_leg_rdl',
            name: 'Peso Muerto Rumano a Una Pierna (Equilibrio)',
            sets: 3,
            reps: '8 reps por pierna',
            duration: '~5 min',
            desc: 'Flexiona la cadera sobre una pierna para construir el control de la cadena posterior y la estabilidad unipodal que protegen la rodilla en el deporte.',
            cues: [
              'Bisagra en la cadera — espalda plana',
              'Cuadra las caderas al suelo',
              'Empuja por el talón para erguirte',
            ],
          },
        ],
      },
      shoulder: {
        region: 'Hombro',
        title: 'Manguito Rotador y Descompresión Escapular',
        quote:
          'El volumen de press abarrota el espacio subacromial y arrastra la cabeza humeral hacia adelante. Este bloque restaura el tono del manguito posterior, el ritmo escapular y la fuerza de rotación externa que recentra la articulación.',
        exercises: [
          {
            key: 'cable_face_pull',
            name: 'Face Pull en Cable (Rotación Externa)',
            sets: 3,
            reps: '15 reps (1s de sostén)',
            duration: '~4 min',
            desc: 'Tira hacia la frente y rota los nudillos hacia arriba para enfatizar el manguito posterior y el trapecio inferior.',
            cues: [
              'Lidera con los codos, altos y abiertos',
              'Junta las escápulas — pausa atrás',
            ],
          },
          {
            key: 'band_pull_apart',
            name: 'Apertura con Banda (Pull-Apart)',
            sets: 3,
            reps: '20 reps',
            duration: '~3 min',
            desc: 'Reequilibra la espalda alta frente al dominio del press; mantén las reps estrictas y lentas.',
            cues: [
              'Junta las escápulas en el estiramiento completo',
              'Mantén las costillas abajo — sin encoger',
            ],
          },
          {
            key: 'scap_lateral_raise',
            name: 'Elevación Lateral en Plano Escapular (Ligera)',
            sets: 3,
            reps: '15 reps',
            duration: '~3 min',
            desc: 'Eleva en el plano escapular (unos 30° adelante) con carga ligera para pulir la mecánica sobre la cabeza.',
            cues: [
              'Lidera con el codo, pulgar ligeramente arriba',
              'Detente a la altura del hombro — no más bajo pinzamiento',
            ],
          },
          {
            key: 'sleeper_stretch',
            name: 'Estiramiento Sleeper (Rotación Interna)',
            sets: 3,
            reps: '3 × 30s por lado',
            duration: '~4 min',
            desc: 'De lado sobre el brazo a trabajar, presiona el antebrazo hacia abajo para restaurar la rotación interna y liberar un manguito posterior tenso.',
            cues: [
              'Fija la escápula contra el suelo',
              'Presiona solo hasta un estiramiento suave — nunca dolor',
              'Mantén el codo a 90°',
            ],
          },
          {
            key: 'side_lying_external_rotation',
            name: 'Rotación Externa de Lado',
            sets: 3,
            reps: '15 reps por lado (2s bajando)',
            duration: '~4 min',
            desc: 'Codo pegado a las costillas, rota una mancuerna ligera hacia arriba para fortalecer el infraespinoso y recentrar la cabeza humeral.',
            cues: [
              'Coloca una toalla enrollada bajo el codo',
              'Lidera con el dorso de la mano',
              'Baja lento — controla el excéntrico',
            ],
          },
          {
            key: 'wall_slide',
            name: 'Deslizamiento Escapular en Pared',
            sets: 3,
            reps: '12 reps (1s arriba)',
            duration: '~3 min',
            desc: 'Antebrazos en la pared, desliza hacia arriba y por encima de la cabeza para grabar una rotación escapular ascendente limpia y el timing del serrato.',
            cues: [
              'Mantén muñecas y codos en la pared',
              'Estírate alto arriba, luego fija las escápulas',
              'Costillas abajo — no arquees la espalda',
            ],
          },
          {
            key: 'prone_ytw',
            name: 'Elevaciones Y-T-W en Prono',
            sets: 3,
            reps: '8 reps por letra',
            duration: '~5 min',
            desc: 'Boca abajo, eleva los brazos en formas de Y, T y W para construir el trapecio inferior y el manguito posterior que dominan la postura escapular.',
            cues: [
              'Lidera con los pulgares hacia arriba',
              'Junta las escápulas abajo y atrás',
              'Mantén el cuello largo — mentón metido',
            ],
          },
          {
            key: 'scapular_pushup',
            name: 'Flexión Escapular',
            sets: 3,
            reps: '15 reps (sostén 1s)',
            duration: '~3 min',
            desc: 'En plancha, protrae y retrae las escápulas con los brazos rectos para activar el serrato anterior.',
            cues: [
              'Mueve solo las escápulas — brazos bloqueados',
              'Empuja el suelo para redondear la espalda alta',
              'Mantén el core tenso, caderas niveladas',
            ],
          },
          {
            key: 'doorway_pec_stretch',
            name: 'Estiramiento de Pectoral en Marco de Puerta',
            sets: 3,
            reps: '3 × 30s de sostén',
            duration: '~4 min',
            desc: 'Antebrazos en el marco, da un paso al frente para abrir un pecho que tira los hombros hacia adelante y abarrota la articulación.',
            cues: [
              'Coloca los codos a la altura del hombro',
              'Pasa suave — siente el pecho, no el hombro',
              'Mantén las costillas abajo y respira',
            ],
          },
          {
            key: 'band_shoulder_dislocate',
            name: 'Pasaje de Hombro con Banda',
            sets: 3,
            reps: '10 reps lentas',
            duration: '~3 min',
            desc: 'Con un agarre amplio en una banda, pasa los brazos por encima de la cabeza y por detrás para abrir el rango y lubricar la cápsula articular.',
            cues: [
              'Abre lo suficiente para no tener dolor',
              'Mantén los codos rectos en todo momento',
              'Muévete lento — sin forzar el rango final',
            ],
          },
        ],
      },
      elbow: {
        region: 'Codo',
        title: 'Resiliencia Tendinosa y Carga del Antebrazo',
        quote:
          'Curls, jalones y press cargan los tendones flexor y extensor comunes. Los excéntricos pesados y lentos remodelan el tendón y construyen la capacidad del antebrazo que protege el codo bajo carga.',
        exercises: [
          {
            key: 'eccentric_hammer_curl',
            name: 'Curl Martillo Excéntrico (Bajada 4s)',
            sets: 3,
            reps: '8 reps (4s bajando)',
            duration: '~4 min',
            desc: 'Carga el braquiorradial con una bajada pesada y lenta para remodelar el tendón lateral del codo.',
            cues: [
              'Baja bajo control durante un conteo completo de cuatro',
              'Mantén el codo pegado a las costillas',
            ],
          },
          {
            key: 'triceps_pushdown_ecc',
            name: 'Pushdown de Tríceps (Excéntrico Lento)',
            sets: 3,
            reps: '12 reps (3s subiendo)',
            duration: '~4 min',
            desc: 'Resiste el retorno para cargar el tendón del tríceps sin estrés agudo en el rango final.',
            cues: [
              'Pelea contra el cable al subir',
              'Mantén las muñecas neutras, codos quietos',
            ],
          },
          {
            key: 'bench_dip_controlled',
            name: 'Fondo en Banco Controlado',
            sets: 3,
            reps: '10 reps',
            duration: '~4 min',
            desc: 'Construye capacidad de tríceps y codo en un rango controlado y sin dolor; nunca bajes más allá de lo cómodo.',
            cues: [
              'Detente antes de cualquier pinzamiento en la articulación',
              'Mantén los hombros abajo, lejos de las orejas',
            ],
          },
          {
            key: 'flexbar_tyler_twist',
            name: 'Tyler Twist con FlexBar (Codo de Tenista)',
            sets: 3,
            reps: '12 reps (3s al liberar)',
            duration: '~4 min',
            desc: 'El excéntrico de referencia para el dolor lateral del codo — tuerce la barra y deja que el lado lesionado se destuerza lento para remodelar el tendón extensor.',
            cues: [
              'Carga la torsión con la mano sana',
              'Libera lento y bajo control',
              'Detente antes del dolor agudo',
            ],
          },
          {
            key: 'flexbar_reverse_twist',
            name: 'Tyler Twist Inverso con FlexBar (Codo de Golfista)',
            sets: 3,
            reps: '12 reps (3s al liberar)',
            duration: '~4 min',
            desc: 'El espejo del lado medial — pre-tuerce y deja que el lado flexor lesionado se destuerza lento para cargar el tendón flexor común.',
            cues: [
              'Fija la torsión con la mano buena',
              'Controla el destorcido lento',
              'Mantén el movimiento de muñeca suave',
            ],
          },
          {
            key: 'reverse_barbell_curl',
            name: 'Curl Inverso (Énfasis Extensor)',
            sets: 3,
            reps: '12 reps (3s bajando)',
            duration: '~4 min',
            desc: 'El agarre pronado carga el braquiorradial y los extensores de muñeca que estabilizan el codo lateral bajo volumen de tirón.',
            cues: [
              'Nudillos arriba, muñecas firmes y neutras',
              'Mantén los codos pegados a las costillas',
              'Baja lento — sin impulso',
            ],
          },
          {
            key: 'db_supination_pronation',
            name: 'Supinación / Pronación de Antebrazo',
            sets: 3,
            reps: '12 reps por dirección (2s)',
            duration: '~4 min',
            desc: 'Antebrazo apoyado, rota una mancuerna ligera de palma arriba a palma abajo para restaurar la capacidad rotacional del tendón alrededor del codo.',
            cues: [
              'Ancla el antebrazo sobre el muslo',
              'Rota lento y completo, ambas direcciones',
              'Mantén el codo pegado y quieto',
            ],
          },
          {
            key: 'wrist_extensor_stretch',
            name: 'Estiramiento de Extensores de Muñeca',
            sets: 3,
            reps: '3 × 30s por lado',
            duration: '~3 min',
            desc: 'Brazo recto, flexiona suavemente la muñeca hacia abajo con la palma hacia ti para alargar los extensores tensos del codo de tenista.',
            cues: [
              'Mantén el codo completamente recto',
              'Tira solo hasta un estiramiento suave',
              'Baja el hombro lejos de la oreja',
            ],
          },
          {
            key: 'wrist_flexor_stretch',
            name: 'Estiramiento de Flexores de Muñeca',
            sets: 3,
            reps: '3 × 30s por lado',
            duration: '~3 min',
            desc: 'Brazo recto y palma arriba, lleva los dedos y la muñeca hacia atrás para liberar el tendón flexor común del codo de golfista.',
            cues: [
              'Mantén el codo bloqueado y recto',
              'Abre y lleva los dedos hacia atrás',
              'Entra suave — nunca rebotes el estiramiento',
            ],
          },
          {
            key: 'eccentric_wrist_extension',
            name: 'Extensión de Muñeca Excéntrica',
            sets: 3,
            reps: '15 reps (4s bajando)',
            duration: '~4 min',
            desc: 'Antebrazo apoyado, eleva una mancuerna ligera en extensión y baja en un conteo lento de cuatro para remodelar el tendón extensor.',
            cues: [
              'Ayúdate a subir con la mano libre si hace falta',
              'Domina la bajada lenta de cuatro',
              'Mantén el antebrazo plano y quieto',
            ],
          },
        ],
      },
      wrist_hand: {
        region: 'Muñeca y Mano',
        title: 'Movilidad de Muñeca e Integridad del Agarre',
        quote:
          'El press, el front rack y los jalones canalizan la carga a través de la muñeca y la mano. Este bloque construye equilibrio de extensores, tolerancia al peso y un agarre íntegro para que la articulación se mantenga sin dolor bajo la barra.',
        exercises: [
          {
            key: 'reverse_wrist_curl',
            name: 'Curl Inverso de Muñeca (Extensores)',
            sets: 3,
            reps: '15 reps (2s bajando)',
            duration: '~3 min',
            desc: 'Fortalece los extensores de la muñeca que equilibran el entrenamiento dominado por el agarre; mantén el movimiento pequeño y estricto.',
            cues: [
              'Ancla el antebrazo sobre el muslo',
              'Baja lento — sin impulso',
            ],
          },
          {
            key: 'wrist_extension_load',
            name: 'Balanceos de Muñeca con Carga',
            sets: 3,
            reps: '10 balanceos (2s de sostén)',
            duration: '~3 min',
            desc: 'En cuadrupedia, balancéate suavemente sobre las palmas cargadas para construir la tolerancia a la extensión de muñeca que exige el press.',
            cues: [
              'Extiende los dedos y agarra el suelo',
              'Avanza solo hasta donde no haya dolor',
            ],
          },
          {
            key: 'dead_hang',
            name: 'Suspensión de Descompresión (Dead Hang)',
            sets: 3,
            reps: '3 × 30s colgado',
            duration: '~4 min',
            desc: 'Cuélgate de una barra para descomprimir la muñeca y el codo y reconstruir resistencia de agarre a prueba de fallos.',
            cues: [
              'Hombros activos — baja las escápulas',
              'Respira y aumenta el tiempo de colgado gradualmente',
            ],
          },
          {
            key: 'wrist_flexor_curl',
            name: 'Curl de Muñeca (Flexores)',
            sets: 3,
            reps: '15 reps (2s bajando)',
            duration: '~3 min',
            desc: 'Palmas arriba y antebrazo apoyado, flexiona una mancuerna ligera para construir los flexores de muñeca que estabilizan la barra en el rack y el tirón.',
            cues: [
              'Apoya el antebrazo en el muslo, palma arriba',
              'Deja rodar el peso a los dedos, luego flexiona',
              'Baja lento — rango completo sin dolor',
            ],
          },
          {
            key: 'wrist_circles',
            name: 'Círculos de Muñeca (Movilidad)',
            sets: 2,
            reps: '10 círculos cada dirección',
            duration: '~2 min',
            desc: 'Entrelaza los dedos o cierra los puños y haz círculos con las muñecas para calentar la cápsula articular y el líquido sinovial antes de cargar.',
            cues: [
              'Muévete en el círculo más grande sin dolor',
              'Ve lento en ambas direcciones',
              'Relaja los hombros y respira',
            ],
          },
          {
            key: 'prayer_stretch',
            name: 'Estiramiento de Oración y Oración Inversa',
            sets: 3,
            reps: '3 × 30s por posición',
            duration: '~3 min',
            desc: 'Palmas juntas presiona hacia abajo (flexores), luego nudillos juntos presiona hacia arriba (extensores) para equilibrar la movilidad del antebrazo.',
            cues: [
              'Mantén palmas/nudillos pegados',
              'Baja las manos hasta sentir el estiramiento',
              'Mantén firme — sin rebotes',
            ],
          },
          {
            key: 'finger_extension_band',
            name: 'Extensión de Dedos con Banda',
            sets: 3,
            reps: '15 reps (sostén 1s)',
            duration: '~3 min',
            desc: 'Coloca una banda alrededor de las yemas y abre la mano para entrenar los extensores de los dedos que el entrenamiento de agarre descuida.',
            cues: [
              'Abre los dedos amplio y lento',
              'Pausa en la apertura completa',
              'Controla el regreso — no cierres de golpe',
            ],
          },
          {
            key: 'grip_squeeze',
            name: 'Apretón de Agarre (Pelota / Gripper)',
            sets: 3,
            reps: '15 reps (aprieta 2s)',
            duration: '~3 min',
            desc: 'Aprieta una pelota o gripper para construir la capacidad flexora de la mano y el antebrazo que mantiene la muñeca estable bajo cargas pesadas.',
            cues: [
              'Aprieta fuerte y sostén el pico',
              'Abre la mano por completo entre reps',
              'Mantén la muñeca recta y neutra',
            ],
          },
          {
            key: 'radial_ulnar_deviation',
            name: 'Desviación Radial / Cubital',
            sets: 3,
            reps: '12 reps por dirección',
            duration: '~3 min',
            desc: 'Pulgar arriba, inclina un peso ligero hacia arriba (radial) y hacia abajo (cubital) para fortalecer los estabilizadores laterales de la muñeca.',
            cues: [
              'Mueve solo la muñeca — antebrazo quieto',
              'Mantén el movimiento pequeño y controlado',
              'Usa una carga muy ligera',
            ],
          },
          {
            key: 'finger_tendon_glides',
            name: 'Deslizamientos Tendinosos de Dedos',
            sets: 3,
            reps: '8 secuencias completas',
            duration: '~3 min',
            desc: 'Cicla los dedos por las formas recta, gancho, puño y mesa para deslizar los tendones y mantener la mano flexible.',
            cues: [
              'Muévete lento por cada forma',
              'Haz cada posición nítida y completa',
              'Mantén la muñeca neutra en todo momento',
            ],
          },
        ],
      },
    },
  },

  pt: {
    PLANNER: [
      {
        id: 'ankle',
        label: '1. Teste de Flexão do Tornozelo (Dedo à Parede)',
        default: 'moderate',
        options: [
          { value: 'optimal', label: 'Ótimo (O joelho passa 5"+ do dedo)', status: 'ok',
            code: { title: 'Mobilidade de Tornozelo Saudável', body: 'O tálus desliza livremente. A amplitude de movimento permite agachamentos atléticos profundos.' } },
          { value: 'moderate', label: 'Moderado (O joelho toca a parede 2–4")', status: 'ok',
            code: { title: 'Mobilidade de Tornozelo Saudável', body: 'O tálus desliza livremente. A amplitude de movimento permite agachamentos atléticos profundos.' } },
          { value: 'restricted', label: 'Restrito (O joelho não alcança a parede)', status: 'warn',
            code: { title: 'Dorsiflexão de Tornozelo Limitada', body: 'O deslizamento talar está bloqueado — o joelho não avança sobre os dedos. Adicione distrações de tornozelo com elástico e trabalho de tecidos moles da panturrilha antes de carregar a profundidade do agachamento.' } },
        ],
      },
      {
        id: 'squat',
        label: '2. Ângulo da Pelve no Fundo do Agachamento',
        default: 'valgus',
        options: [
          { value: 'neutral', label: 'Neutro (A pelve permanece alinhada)', status: 'ok',
            code: { title: 'Controle Pélvico Estável', body: 'A pelve permanece alinhada sob carga. A flexão profunda do quadril está bem organizada.' } },
          { value: 'valgus', label: 'Os joelhos colapsam para dentro (Má abdução)', status: 'warn',
            code: { title: 'Inatividade do Glúteo Médio (Joelhos Para Dentro)', body: 'Os adutores puxam seu fêmur para dentro. Coloque um elástico acima da rótula e faça caminhadas laterais e agachamentos espanhóis para acumular recrutamento do glúteo.' } },
          { value: 'butt_wink', label: 'Báscula posterior (Inclinação pélvica posterior)', status: 'warn',
            code: { title: 'Flexão Lombar Sob Carga (Báscula Posterior)', body: 'A pelve se retrai na profundidade, arredondando a coluna lombar. Limite a profundidade no neutro e treine a respiração 90/90 para controlar a báscula posterior.' } },
        ],
      },
      {
        id: 'overhead',
        label: '3. Verificação de Alinhamento da Barra acima da Cabeça',
        default: 'subacromial',
        options: [
          { value: 'clean', label: 'Limpo (A barra alinha sobre o meio do pé)', status: 'ok',
            code: { title: 'Alinhamento Saudável acima da Cabeça', body: 'A cabeça do úmero centraliza-se livremente. O ritmo escapular permite o desenvolvimento com carga.' } },
          { value: 'subacromial', label: 'Pinçamento Subacromial (Impacto umeral)', status: 'warn',
            code: { title: 'Impacto Subacromial do Manguito Rotador', body: 'Deslizamento umeral anterior com pinçamento. Faça o alongamento de ombro "Sleeper" e foque em face pulls altos no cabo.' } },
          { value: 'rib_flare', label: 'Compensação Lombar (Abertura costal)', status: 'warn',
            code: { title: 'Compensação de Extensão Torácica (Abertura Costal)', body: 'Os dorsais e a lombar compensam o alcance limitado acima da cabeça. Treine extensões torácicas no banco e desenvolvimento ajoelhado ereto.' } },
        ],
      },
    ],
    REGIONS: [
      { id: 'lower_back', label: 'Região Lombar' },
      { id: 'knee', label: 'Joelho' },
      { id: 'shoulder', label: 'Ombro' },
      { id: 'elbow', label: 'Cotovelo' },
      { id: 'wrist_hand', label: 'Punho e Mão' },
    ],
    PROTOCOLS: {
      lower_back: {
        region: 'Região Lombar',
        title: 'Descompressão da Coluna e Estabilização Pélvica',
        quote:
          'No fisiculturismo e no powerlifting de elite, levantamentos terra e agachamentos impõem cargas axiais imensas sobre a coluna. Esta rotina hidrata os discos intervertebrais lombares baixos, coativa os estabilizadores lombares profundos e libera os flexores de quadril de alta tensão que provocam estresse de cisalhamento por anteversão pélvica.',
        exercises: [
          {
            key: 'mckenzie_press_up',
            name: 'Press-ups de Extensão Lombar McKenzie',
            sets: 3,
            reps: '10 reps lentas (pausa de 5s no pico)',
            duration: '~4 min',
            desc: 'Mantenha a crista pélvica e os quadris completamente apoiados no chão. Expire completamente ao empurrar para cima para descomprimir totalmente a região lombar.',
            cues: [
              'Deixe sua coluna pender como uma rede',
              'Evite encolher o pescoço; afaste os ombros do peito',
              'Respire fundo em direção ao baixo ventre no topo da extensão',
            ],
          },
          {
            key: 'bird_dog',
            name: 'Extensões Bird-Dog com Estabilização Abdominal',
            sets: 3,
            reps: '10 reps de cada lado (segure 2s)',
            duration: '~5 min',
            desc: 'Coloque um rolo de espuma na cintura; ele deve permanecer perfeitamente nivelado. Garanta que não haja hiperextensão da região lombar.',
            cues: [
              'Empurre para fora pelo calcanhar em vez de chutar para o alto',
              'Contraia o abdômen como se preparasse para um soco forte',
              'Forme uma linha reta de aço da ponta dos dedos até o calcanhar oposto',
            ],
          },
          {
            key: 'dead_bug',
            name: 'Dead Bug com Sustentação Anti-Extensão',
            sets: 3,
            reps: '8 reps de cada lado',
            duration: '~4 min',
            desc: 'Pressione a região lombar plana contra o chão e estenda o braço e a perna opostos sem deixar as costelas abrirem do solo.',
            cues: [
              'Expire com força ao estender os membros para travar a caixa torácica',
              'Mova-se devagar — sem impulso vindo dos quadris',
              'Mantenha ambas as escápulas fixas no chão',
            ],
          },
          {
            key: 'cat_cow',
            name: 'Mobilização Espinhal Gato-Vaca',
            sets: 2,
            reps: '12 ciclos lentos',
            duration: '~3 min',
            desc: 'Em quatro apoios, flua entre a flexão espinhal completa (gato) e a extensão (vaca) para bombear líquido por cada segmento lombar antes de carregar.',
            cues: [
              'Mova uma vértebra de cada vez — de cima para baixo',
              'Sincronize a respiração: expire ao arredondar, inspire ao arquear',
              'Mantenha os punhos alinhados sob os ombros',
            ],
          },
          {
            key: 'childs_pose',
            name: 'Descompressão na Postura da Criança',
            sets: 3,
            reps: '3 × 45s de sustentação',
            duration: '~3 min',
            desc: 'Leve os quadris em direção aos calcanhares e estenda os braços longos para tracionar a coluna lombar e abrir a cadeia posterior.',
            cues: [
              'Caminhe as mãos para frente para alongar a coluna',
              'Respire em direção à lombar e deixe os quadris afundarem',
              'Abra os joelhos se o abdômen bloquear a dobra',
            ],
          },
          {
            key: 'pelvic_tilt',
            name: 'Báscula Pélvica Posterior em Supino',
            sets: 3,
            reps: '12 reps (sustente 3s)',
            duration: '~3 min',
            desc: 'Deitado de costas com os joelhos flexionados, aplane a curva lombar contra o chão retraindo suavemente a pelve — reativando o controle do core profundo.',
            cues: [
              'Pressione a linha do cinto contra o colchonete',
              'Contraia o baixo abdômen, não os glúteos',
              'Mantenha a caixa torácica quieta e respirando',
            ],
          },
          {
            key: 'knee_to_chest',
            name: 'Liberação Joelho ao Peito (Unilateral)',
            sets: 3,
            reps: '10 reps de cada lado (sustente 3s)',
            duration: '~4 min',
            desc: 'Leve um joelho ao peito enquanto a perna oposta permanece longa, descomprimindo as facetas lombares e alongando o glúteo.',
            cues: [
              'Puxe por trás da coxa, não sobre a rótula',
              'Mantenha o calcanhar da perna baixa empurrando para longe',
              'Relaxe os ombros apoiados no chão',
            ],
          },
          {
            key: 'supine_lumbar_rotation',
            name: 'Rotação Lombar Baixa em Supino',
            sets: 3,
            reps: '10 reps de cada lado (sustente 2s)',
            duration: '~4 min',
            desc: 'Joelhos juntos e flexionados, deixe-os cair de um lado para o outro para mobilizar a rotação lombar e soltar a tensão paravertebral.',
            cues: [
              'Mantenha ambas as escápulas coladas ao chão',
              'Mova-se apenas numa amplitude sem dor',
              'Controle o retorno — sem deixar cair',
            ],
          },
          {
            key: 'half_kneeling_hip_flexor',
            name: 'Alongamento de Flexor de Quadril Semi-Ajoelhado',
            sets: 3,
            reps: '3 × 30s de cada lado',
            duration: '~4 min',
            desc: 'Em semi-ajoelhado, retraia a pelve e desloque-se para frente para liberar os flexores de quadril de alta tensão que provocam o cisalhamento por anteversão pélvica.',
            cues: [
              'Faça a báscula posterior da pelve ANTES de inclinar',
              'Contraia forte o glúteo do lado de baixo',
              'Mantenha as costelas sobre os quadris — sem arquear',
            ],
          },
          {
            key: 'side_plank',
            name: 'Prancha Lateral (Cadeia Lateral)',
            sets: 3,
            reps: '3 × 30s de cada lado',
            duration: '~4 min',
            desc: 'Construa o quadrado lombar e o sistema oblíquo que estabiliza a coluna contra o cisalhamento lateral sob carga.',
            cues: [
              'Alinhe os quadris e eleve-os alto',
              'Mantenha uma linha reta da orelha ao tornozelo',
              'Contraia os oblíquos — não afunde',
            ],
          },
        ],
      },
      knee: {
        region: 'Joelho',
        title: 'Rastreamento Patelar e Estabilização do Joelho',
        quote:
          'Agachamentos e agachamentos búlgaros pesados geram compressão patelofemoral. Este bloco restaura o tônus do vasto medial (VMO), o controle do fêmur pelo glúteo médio e o suporte da cadeia posterior para que a patela deslize limpa em profundidade.',
        exercises: [
          {
            key: 'tempo_goblet_squat',
            name: 'Agachamento Goblet com Tempo (Descida 4s)',
            sets: 3,
            reps: '8 reps (4s descendo)',
            duration: '~5 min',
            desc: 'Sente-se reto entre os quadris com um excêntrico lento, mantendo os joelhos alinhados sobre o segundo dedo.',
            cues: [
              'Empurre os joelhos para fora — nunca deixe colapsarem',
              'Mantenha-se ereto pelo esterno, costelas alinhadas',
            ],
          },
          {
            key: 'terminal_knee_ext',
            name: 'Extensão Terminal do Joelho (Ênfase VMO)',
            sets: 3,
            reps: '15 reps (2s de sustentação no bloqueio)',
            duration: '~4 min',
            desc: 'Contraia forte o quadríceps no bloqueio completo para reativar o VMO que estabiliza a patela.',
            cues: [
              'Pause e contraia forte no topo',
              'Lento e controlado — sem balançar a carga',
            ],
          },
          {
            key: 'glute_bridge',
            name: 'Ponte de Glúteos (Suporte Posterior)',
            sets: 3,
            reps: '12 reps (2s de contração)',
            duration: '~4 min',
            desc: 'Construa a cadeia posterior que alivia a frente do joelho; finalize cada rep com um bloqueio firme dos glúteos.',
            cues: [
              'Empurre pelos calcanhares, não pelos dedos',
              'Bloqueie os glúteos — não hiperestenda a lombar',
            ],
          },
          {
            key: 'spanish_squat',
            name: 'Agachamento Espanhol (Isométrico)',
            sets: 3,
            reps: '5 × 30s de sustentação',
            duration: '~5 min',
            desc: 'Coloque um elástico forte atrás dos joelhos e sente-se para trás num agachamento de tíbia vertical para carregar o tendão do quadríceps sem comprimir a patela.',
            cues: [
              'Recline-se sobre o elástico, tronco ereto',
              'Mantenha as tíbias verticais — sente reto',
              'Empurre os joelhos para fora, peso nos calcanhares',
            ],
          },
          {
            key: 'wall_sit',
            name: 'Cadeirinha na Parede (Isometria de Quadríceps)',
            sets: 3,
            reps: '4 × 30–45s de sustentação',
            duration: '~5 min',
            desc: 'Mantenha uma posição sentada a 90° contra a parede para construir capacidade de quadríceps sem dor e tolerância do tendão patelar.',
            cues: [
              'Coxas paralelas ao chão',
              'Joelhos alinhados sobre os dedos, sem colapsar',
              'Pressione todas as costas planas contra a parede',
            ],
          },
          {
            key: 'eccentric_step_down',
            name: 'Descida de Degrau Excêntrica',
            sets: 3,
            reps: '10 reps por perna (4s descendo)',
            duration: '~5 min',
            desc: 'Fique sobre um caixote baixo e desça o calcanhar oposto sob controle para treinar o quadríceps e o rastreamento patelar de forma excêntrica.',
            cues: [
              'Desça numa contagem lenta de quatro',
              'Mantenha o joelho de apoio sobre o dedo',
              'Toque o calcanhar de leve — sem bater',
            ],
          },
          {
            key: 'lateral_band_walk',
            name: 'Caminhada Lateral com Faixa',
            sets: 3,
            reps: '12 passos cada direção',
            duration: '~4 min',
            desc: 'Com uma faixa acima dos joelhos, desça a um quarto de agachamento e dê passos laterais para ativar o glúteo médio que impede o joelho de colapsar.',
            cues: [
              'Mantenha-se baixo — sem subir e descer',
              'Conduza com o calcanhar, dedos à frente',
              'Mantenha tensão na faixa a série toda',
            ],
          },
          {
            key: 'clamshell',
            name: 'Concha com Faixa (Clamshell)',
            sets: 3,
            reps: '15 reps de cada lado (sustente 1s)',
            duration: '~4 min',
            desc: 'De lado com os joelhos flexionados, abra o joelho de cima contra a faixa para isolar o glúteo médio e os rotadores externos.',
            cues: [
              'Mantenha os calcanhares colados',
              'Não deixe os quadris rolarem para trás',
              'Pause e contraia no topo',
            ],
          },
          {
            key: 'standing_calf_raise',
            name: 'Elevação de Panturrilha em Pé',
            sets: 3,
            reps: '15 reps (contraia 2s)',
            duration: '~4 min',
            desc: 'Panturrilhas fortes absorvem a força da aterrissagem e aliviam o joelho; suba alto e desça com controle por toda a amplitude.',
            cues: [
              'Suba sobre a articulação do dedão',
              'Pause no topo, depois desça devagar',
              'Mantenha os joelhos suaves, sem travar',
            ],
          },
          {
            key: 'single_leg_rdl',
            name: 'Levantamento Terra Romeno Unilateral (Equilíbrio)',
            sets: 3,
            reps: '8 reps por perna',
            duration: '~5 min',
            desc: 'Flexione o quadril sobre uma perna para construir o controle da cadeia posterior e a estabilidade unipodal que protegem o joelho no esporte.',
            cues: [
              'Dobradiça no quadril — costas retas',
              'Esquadre os quadris com o chão',
              'Empurre pelo calcanhar para ficar ereto',
            ],
          },
        ],
      },
      shoulder: {
        region: 'Ombro',
        title: 'Manguito Rotador e Descompressão Escapular',
        quote:
          'O volume de desenvolvimento aperta o espaço subacromial e puxa a cabeça do úmero para frente. Este bloco restaura o tônus do manguito posterior, o ritmo escapular e a força de rotação externa que recentra a articulação.',
        exercises: [
          {
            key: 'cable_face_pull',
            name: 'Face Pull no Cabo (Rotação Externa)',
            sets: 3,
            reps: '15 reps (1s de sustentação)',
            duration: '~4 min',
            desc: 'Puxe em direção à testa e gire os nós dos dedos para cima para enfatizar o manguito posterior e o trapézio inferior.',
            cues: [
              'Conduza com os cotovelos, altos e abertos',
              'Junte as escápulas — pause atrás',
            ],
          },
          {
            key: 'band_pull_apart',
            name: 'Abertura com Elástico (Pull-Apart)',
            sets: 3,
            reps: '20 reps',
            duration: '~3 min',
            desc: 'Reequilibre a parte superior das costas contra o domínio do desenvolvimento; mantenha as reps estritas e lentas.',
            cues: [
              'Junte as escápulas no alongamento completo',
              'Mantenha as costelas baixas — sem encolher',
            ],
          },
          {
            key: 'scap_lateral_raise',
            name: 'Elevação Lateral no Plano Escapular (Leve)',
            sets: 3,
            reps: '15 reps',
            duration: '~3 min',
            desc: 'Eleve no plano escapular (cerca de 30° à frente) com carga leve para refinar a mecânica acima da cabeça.',
            cues: [
              'Conduza com o cotovelo, polegar levemente para cima',
              'Pare na altura do ombro — não mais sob pinçamento',
            ],
          },
          {
            key: 'sleeper_stretch',
            name: 'Alongamento Sleeper (Rotação Interna)',
            sets: 3,
            reps: '3 × 30s de cada lado',
            duration: '~4 min',
            desc: 'De lado sobre o braço a trabalhar, pressione o antebraço para baixo para restaurar a rotação interna e liberar um manguito posterior tenso.',
            cues: [
              'Fixe a escápula contra o chão',
              'Pressione apenas até um alongamento suave — nunca dor',
              'Mantenha o cotovelo a 90°',
            ],
          },
          {
            key: 'side_lying_external_rotation',
            name: 'Rotação Externa Deitado de Lado',
            sets: 3,
            reps: '15 reps de cada lado (2s descendo)',
            duration: '~4 min',
            desc: 'Cotovelo colado às costelas, gire um haltere leve para cima para fortalecer o infraespinhal e recentrar a cabeça do úmero.',
            cues: [
              'Coloque uma toalha enrolada sob o cotovelo',
              'Conduza com o dorso da mão',
              'Desça devagar — controle o excêntrico',
            ],
          },
          {
            key: 'wall_slide',
            name: 'Deslizamento Escapular na Parede',
            sets: 3,
            reps: '12 reps (1s no topo)',
            duration: '~3 min',
            desc: 'Antebraços na parede, deslize para cima e acima da cabeça para gravar uma rotação escapular ascendente limpa e o timing do serrátil.',
            cues: [
              'Mantenha punhos e cotovelos na parede',
              'Estenda-se alto no topo, depois fixe as escápulas',
              'Costelas baixas — não arqueie as costas',
            ],
          },
          {
            key: 'prone_ytw',
            name: 'Elevações Y-T-W em Prono',
            sets: 3,
            reps: '8 reps por letra',
            duration: '~5 min',
            desc: 'De bruços, eleve os braços nas formas de Y, T e W para construir o trapézio inferior e o manguito posterior que dominam a postura escapular.',
            cues: [
              'Conduza com os polegares para cima',
              'Junte as escápulas para baixo e para trás',
              'Mantenha o pescoço longo — queixo recolhido',
            ],
          },
          {
            key: 'scapular_pushup',
            name: 'Flexão Escapular',
            sets: 3,
            reps: '15 reps (sustente 1s)',
            duration: '~3 min',
            desc: 'Em prancha, faça protração e retração das escápulas com os braços retos para ativar o serrátil anterior.',
            cues: [
              'Mova apenas as escápulas — braços travados',
              'Empurre o chão para arredondar a parte alta das costas',
              'Mantenha o core firme, quadris nivelados',
            ],
          },
          {
            key: 'doorway_pec_stretch',
            name: 'Alongamento de Peitoral no Batente da Porta',
            sets: 3,
            reps: '3 × 30s de sustentação',
            duration: '~4 min',
            desc: 'Antebraços no batente, dê um passo à frente para abrir um peito que puxa os ombros para frente e aperta a articulação.',
            cues: [
              'Coloque os cotovelos na altura do ombro',
              'Passe suave — sinta o peito, não o ombro',
              'Mantenha as costelas baixas e respire',
            ],
          },
          {
            key: 'band_shoulder_dislocate',
            name: 'Passagem de Ombro com Elástico',
            sets: 3,
            reps: '10 reps lentas',
            duration: '~3 min',
            desc: 'Com uma pegada ampla num elástico, passe os braços acima da cabeça e por trás para abrir a amplitude e lubrificar a cápsula articular.',
            cues: [
              'Abra o suficiente para não sentir dor',
              'Mantenha os cotovelos retos o tempo todo',
              'Mova devagar — sem forçar a amplitude final',
            ],
          },
        ],
      },
      elbow: {
        region: 'Cotovelo',
        title: 'Resiliência Tendínea e Carga do Antebraço',
        quote:
          'Roscas, puxadas e desenvolvimento sobrecarregam os tendões flexor e extensor comuns. Excêntricos pesados e lentos remodelam o tendão e constroem a capacidade do antebraço que protege o cotovelo sob carga.',
        exercises: [
          {
            key: 'eccentric_hammer_curl',
            name: 'Rosca Martelo Excêntrica (Descida 4s)',
            sets: 3,
            reps: '8 reps (4s descendo)',
            duration: '~4 min',
            desc: 'Carregue o braquiorradial com uma descida pesada e lenta para remodelar o tendão lateral do cotovelo.',
            cues: [
              'Desça sob controle por uma contagem completa de quatro',
              'Mantenha o cotovelo colado às costelas',
            ],
          },
          {
            key: 'triceps_pushdown_ecc',
            name: 'Pushdown de Tríceps (Excêntrico Lento)',
            sets: 3,
            reps: '12 reps (3s subindo)',
            duration: '~4 min',
            desc: 'Resista ao retorno para carregar o tendão do tríceps sem estresse agudo na amplitude final.',
            cues: [
              'Lute contra o cabo na subida',
              'Mantenha os punhos neutros, cotovelos quietos',
            ],
          },
          {
            key: 'bench_dip_controlled',
            name: 'Mergulho no Banco Controlado',
            sets: 3,
            reps: '10 reps',
            duration: '~4 min',
            desc: 'Construa capacidade de tríceps e cotovelo numa amplitude controlada e sem dor; nunca desça além do confortável.',
            cues: [
              'Pare antes de qualquer pinçamento na articulação',
              'Mantenha os ombros baixos, longe das orelhas',
            ],
          },
          {
            key: 'flexbar_tyler_twist',
            name: 'Tyler Twist com FlexBar (Cotovelo de Tenista)',
            sets: 3,
            reps: '12 reps (3s ao liberar)',
            duration: '~4 min',
            desc: 'O excêntrico de referência para a dor lateral do cotovelo — torça a barra e deixe o lado lesionado destorcer devagar para remodelar o tendão extensor.',
            cues: [
              'Carregue a torção com a mão saudável',
              'Libere devagar e sob controle',
              'Pare antes da dor aguda',
            ],
          },
          {
            key: 'flexbar_reverse_twist',
            name: 'Tyler Twist Reverso com FlexBar (Cotovelo de Golfista)',
            sets: 3,
            reps: '12 reps (3s ao liberar)',
            duration: '~4 min',
            desc: 'O espelho do lado medial — pré-torça e deixe o lado flexor lesionado destorcer devagar para carregar o tendão flexor comum.',
            cues: [
              'Fixe a torção com a mão boa',
              'Controle o destorcer lento',
              'Mantenha o movimento do punho suave',
            ],
          },
          {
            key: 'reverse_barbell_curl',
            name: 'Rosca Inversa (Ênfase Extensora)',
            sets: 3,
            reps: '12 reps (3s descendo)',
            duration: '~4 min',
            desc: 'A pegada pronada carrega o braquiorradial e os extensores do punho que estabilizam o cotovelo lateral sob volume de puxada.',
            cues: [
              'Nós dos dedos para cima, punhos firmes e neutros',
              'Mantenha os cotovelos colados às costelas',
              'Desça devagar — sem balanço',
            ],
          },
          {
            key: 'db_supination_pronation',
            name: 'Supinação / Pronação de Antebraço',
            sets: 3,
            reps: '12 reps por direção (2s)',
            duration: '~4 min',
            desc: 'Antebraço apoiado, gire um haltere leve de palma para cima a palma para baixo para restaurar a capacidade rotacional do tendão ao redor do cotovelo.',
            cues: [
              'Apoie o antebraço sobre a coxa',
              'Gire devagar e completo, ambas as direções',
              'Mantenha o cotovelo colado e quieto',
            ],
          },
          {
            key: 'wrist_extensor_stretch',
            name: 'Alongamento dos Extensores do Punho',
            sets: 3,
            reps: '3 × 30s de cada lado',
            duration: '~3 min',
            desc: 'Braço reto, flexione suavemente o punho para baixo com a palma voltada para você para alongar os extensores tensos do cotovelo de tenista.',
            cues: [
              'Mantenha o cotovelo completamente reto',
              'Puxe apenas até um alongamento suave',
              'Abaixe o ombro para longe da orelha',
            ],
          },
          {
            key: 'wrist_flexor_stretch',
            name: 'Alongamento dos Flexores do Punho',
            sets: 3,
            reps: '3 × 30s de cada lado',
            duration: '~3 min',
            desc: 'Braço reto e palma para cima, leve os dedos e o punho para trás para liberar o tendão flexor comum do cotovelo de golfista.',
            cues: [
              'Mantenha o cotovelo travado e reto',
              'Abra e leve os dedos para trás',
              'Entre suave — nunca balance o alongamento',
            ],
          },
          {
            key: 'eccentric_wrist_extension',
            name: 'Extensão de Punho Excêntrica',
            sets: 3,
            reps: '15 reps (4s descendo)',
            duration: '~4 min',
            desc: 'Antebraço apoiado, eleve um haltere leve em extensão e desça numa contagem lenta de quatro para remodelar o tendão extensor.',
            cues: [
              'Ajude na subida com a mão livre se precisar',
              'Domine a descida lenta de quatro',
              'Mantenha o antebraço plano e quieto',
            ],
          },
        ],
      },
      wrist_hand: {
        region: 'Punho e Mão',
        title: 'Mobilidade do Punho e Integridade da Pegada',
        quote:
          'O desenvolvimento, o front rack e as puxadas canalizam carga através do punho e da mão. Este bloco constrói equilíbrio dos extensores, tolerância ao peso e uma pegada íntegra para que a articulação permaneça sem dor sob a barra.',
        exercises: [
          {
            key: 'reverse_wrist_curl',
            name: 'Rosca Inversa de Punho (Extensores)',
            sets: 3,
            reps: '15 reps (2s descendo)',
            duration: '~3 min',
            desc: 'Fortaleça os extensores do punho que equilibram o treino dominado pela pegada; mantenha o movimento pequeno e estrito.',
            cues: [
              'Apoie o antebraço sobre a coxa',
              'Desça devagar — sem impulso',
            ],
          },
          {
            key: 'wrist_extension_load',
            name: 'Balanços de Punho com Carga',
            sets: 3,
            reps: '10 balanços (2s de sustentação)',
            duration: '~3 min',
            desc: 'Em quatro apoios, balance suavemente sobre as palmas carregadas para construir a tolerância à extensão do punho que o desenvolvimento exige.',
            cues: [
              'Abra os dedos e agarre o chão',
              'Avance apenas até onde não houver dor',
            ],
          },
          {
            key: 'dead_hang',
            name: 'Suspensão de Descompressão (Dead Hang)',
            sets: 3,
            reps: '3 × 30s suspenso',
            duration: '~4 min',
            desc: 'Pendure-se numa barra para descomprimir o punho e o cotovelo e reconstruir resistência de pegada à prova de falhas.',
            cues: [
              'Ombros ativos — abaixe as escápulas',
              'Respire e aumente o tempo de suspensão gradualmente',
            ],
          },
          {
            key: 'wrist_flexor_curl',
            name: 'Rosca de Punho (Flexores)',
            sets: 3,
            reps: '15 reps (2s descendo)',
            duration: '~3 min',
            desc: 'Palmas para cima e antebraço apoiado, flexione um haltere leve para construir os flexores do punho que estabilizam a barra no rack e na puxada.',
            cues: [
              'Apoie o antebraço na coxa, palma para cima',
              'Deixe o peso rolar para os dedos, depois flexione',
              'Desça devagar — amplitude completa sem dor',
            ],
          },
          {
            key: 'wrist_circles',
            name: 'Círculos de Punho (Mobilidade)',
            sets: 2,
            reps: '10 círculos cada direção',
            duration: '~2 min',
            desc: 'Entrelace os dedos ou feche os punhos e faça círculos com os punhos para aquecer a cápsula articular e o líquido sinovial antes de carregar.',
            cues: [
              'Mova-se no maior círculo sem dor',
              'Vá devagar nas duas direções',
              'Relaxe os ombros e respire',
            ],
          },
          {
            key: 'prayer_stretch',
            name: 'Alongamento de Prece e Prece Inversa',
            sets: 3,
            reps: '3 × 30s por posição',
            duration: '~3 min',
            desc: 'Palmas juntas pressione para baixo (flexores), depois nós dos dedos juntos pressione para cima (extensores) para equilibrar a mobilidade do antebraço.',
            cues: [
              'Mantenha palmas/nós dos dedos colados',
              'Abaixe as mãos até sentir o alongamento',
              'Segure firme — sem balançar',
            ],
          },
          {
            key: 'finger_extension_band',
            name: 'Extensão dos Dedos com Elástico',
            sets: 3,
            reps: '15 reps (sustente 1s)',
            duration: '~3 min',
            desc: 'Coloque um elástico ao redor das pontas dos dedos e abra a mão para treinar os extensores dos dedos que o treino de pegada negligencia.',
            cues: [
              'Abra os dedos amplo e devagar',
              'Pause na abertura completa',
              'Controle o retorno — não feche de golpe',
            ],
          },
          {
            key: 'grip_squeeze',
            name: 'Aperto de Pegada (Bola / Hand Gripper)',
            sets: 3,
            reps: '15 reps (aperte 2s)',
            duration: '~3 min',
            desc: 'Aperte uma bola ou hand gripper para construir a capacidade flexora da mão e do antebraço que mantém o punho estável sob cargas pesadas.',
            cues: [
              'Aperte forte e segure o pico',
              'Abra a mão completamente entre as reps',
              'Mantenha o punho reto e neutro',
            ],
          },
          {
            key: 'radial_ulnar_deviation',
            name: 'Desvio Radial / Ulnar',
            sets: 3,
            reps: '12 reps por direção',
            duration: '~3 min',
            desc: 'Polegar para cima, incline um peso leve para cima (radial) e para baixo (ulnar) para fortalecer os estabilizadores laterais do punho.',
            cues: [
              'Mova apenas o punho — antebraço parado',
              'Mantenha o movimento pequeno e controlado',
              'Use uma carga bem leve',
            ],
          },
          {
            key: 'finger_tendon_glides',
            name: 'Deslizamentos Tendíneos dos Dedos',
            sets: 3,
            reps: '8 sequências completas',
            duration: '~3 min',
            desc: 'Cicle os dedos pelas formas reta, gancho, punho e mesa para deslizar os tendões e manter a mão flexível.',
            cues: [
              'Mova-se devagar por cada forma',
              'Faça cada posição nítida e completa',
              'Mantenha o punho neutro o tempo todo',
            ],
          },
        ],
      },
    },
  },
};

// Active-language catalog. Falls back to EN for any unknown code. Each language
// block carries PLANNER, REGIONS (the friction-area selector), and PROTOCOLS
// (the corrective deck per region id).
export function getPrehabCatalog(lang) {
  return PREHAB_I18N[lang] || PREHAB_I18N.en;
}

// Back-compat named exports (EN ground-truth). The live UI uses getPrehabCatalog(lang).
export const PLANNER = PREHAB_I18N.en.PLANNER;
export const PROTOCOLS = PREHAB_I18N.en.PROTOCOLS;

// Friction-area selector glyphs (language-invariant).
export const REGION_ICONS = {
  lower_back: '🦴',
  knee: '🦵',
  shoulder: '💪',
  elbow: '🦾',
  wrist_hand: '✋',
};

// Per-exercise form-demo video ids. Each value is EITHER a flat YouTube id
// string (EN-for-all — the structural fallback) OR a localized { en, es, pt }
// object; Prehab's VideoSlot resolves it to the active language via pickLang,
// falling back es/pt → en so a card never goes blank. EN ids are curated
// physical-therapy tutorials (a couple reuse the authorized VIDEO_MAP where the
// prehab movement IS the same lift); ES/PT carry native-language clips where
// sourced. Prehab.jsx falls back to resolveVideoId(name) for any key absent here.
export const EX_VIDEO = {
  // ── Lower Back ──────────────────────────────────────────────────────────
  mckenzie_press_up: 'gLT-WLH84B4',         // prone spinal extension (Back Extension)
  bird_dog: 'ZdAHe9_HeEw',
  dead_bug: { en: 'bxn9FBrt4-A', es: 'OUVY99ez0k0', pt: 'uQfzuKBMJeE' }, // Dead Bug (EN/ES/PT)
  cat_cow: { en: '1Y0YjXS9sKI', es: '8DN9X_KDrrY', pt: 'awP2E7wpSxk' },  // Cat-Cow (EN/ES/PT)
  childs_pose: { en: '-dZXkwzSzF4', es: 'wzQqaCiYCqs', pt: 'M3U9NCaEcJ0' }, // Child's Pose (EN/ES/PT)
  pelvic_tilt: 'Q59R9p4rzxw',               // Supine Posterior Pelvic Tilt (MedBridge)
  knee_to_chest: 'Yd9wY25koVk',             // Single Knee to Chest (AskDoctorJo)
  supine_lumbar_rotation: 'fHRXXGxUxX8',    // Supine Lower Trunk Rotation (MedBridge)
  half_kneeling_hip_flexor: 'mzPvzMivukw',  // Half-Kneeling Hip Flexor Stretch (HSS)
  side_plank: 'Ujf5ELfqI7o',                // Side Plank (VIDEO_MAP)
  // ── Knee ────────────────────────────────────────────────────────────────
  tempo_goblet_squat: 'BR4tlEE_A98',
  terminal_knee_ext: 'tTbJBUKnWU8',         // Leg Extension (VMO bias)
  glute_bridge: { en: '8bbE64NuDTU', es: 'bcuxKS2qRGY', pt: '6jS6aH-78w4' }, // Glute Bridge (EN/ES/PT)
  spanish_squat: { en: 'hgFxm5KIF7M', es: 'mu61P4cs_lc', pt: '9tY-oSNRY50' }, // Spanish Squat (EN E3 Rehab · ES · PT)
  wall_sit: { en: 'JQ2JBphtUk8', es: 'mGTJtgmYgRw', pt: 'NBaJzEt63XI' }, // Wall Sit (EN/ES/PT)
  eccentric_step_down: 'Ig_Qo-GKjRc',       // Eccentric Step-Down for knee pain
  lateral_band_walk: 'y_bqFDQZSHQ',         // Lateral Band Walk tutorial
  clamshell: 'O2KPabIoPPk',                 // Clamshell in side-lying (AskDoctorJo)
  standing_calf_raise: 'SVtg-1loH4c',       // Standing Calf Raise (VIDEO_MAP)
  single_leg_rdl: 'J1ojvq3ftqM',            // Single-Leg RDL tutorial
  // ── Shoulder ────────────────────────────────────────────────────────────
  cable_face_pull: { en: 'ljgqer1ZpXg', es: 'UaZPhyztYNU', pt: 'kYMTJAx_dTM' }, // Face Pull (EN/ES/PT)
  band_pull_apart: 'smSSXITNpCI',
  scap_lateral_raise: '4hTUCDUQaNA',        // Dumbbell Lateral Raise
  sleeper_stretch: { en: '9BN8bRVq3Xo', es: 'J2eJzztUSrQ', pt: 'b3dYmaRVSus' }, // Sleeper Stretch (EN AskDoctorJo · ES · PT)
  side_lying_external_rotation: '3XLT7kpMzcM', // DB Side-Lying External Rotation
  wall_slide: 'UB_n4DxOTCo',                // Scapular Wall Slides
  prone_ytw: 'CFt3WjCBbpc',                 // Prone W/T/Y Scapular Retraction
  scapular_pushup: 'LeMk15TN0No',           // Scapular Push-Ups
  doorway_pec_stretch: 'M850sCj9LHQ',       // Doorway Pec Stretch (MedBridge)
  band_shoulder_dislocate: '7p-Ma0eksaY',   // Band Shoulder Dislocates / pass-through
  // ── Elbow ───────────────────────────────────────────────────────────────
  eccentric_hammer_curl: { en: 'TwD-YGVP4Bk', es: 'RHdacbwKbTo', pt: '1-xCKLVxqqg' }, // Hammer Curl (EN/ES/PT)
  triceps_pushdown_ecc: '_w-HpW70nSQ',      // Cable Triceps Pushdown
  bench_dip_controlled: '0326dy_-CzM',      // Bench Dip
  flexbar_tyler_twist: 'DUfLc4n3ygg',       // Tyler Twist (tennis elbow)
  flexbar_reverse_twist: 'STHalShxKMw',     // Reverse Tyler Twist (golfer's elbow)
  reverse_barbell_curl: 'pXx38ZWRYjo',      // Reverse Curl (extensor bias)
  db_supination_pronation: 'nZHS1gWMc6I',   // Forearm Supination/Pronation
  wrist_extensor_stretch: 'Ayhu7TzNGSQ',    // Forearm Extensor Stretch
  wrist_flexor_stretch: 'i-JV2PsFzWA',      // Wrist Flexor Stretch (AskDoctorJo)
  eccentric_wrist_extension: '0-VJoF6Y4dU', // Eccentric Wrist Extension (tennis elbow)
  // ── Wrist & Hand ────────────────────────────────────────────────────────
  reverse_wrist_curl: 'SfENsl5klVA',        // Reverse Wrist Curl (extensors)
  wrist_extension_load: 'mwlp75MS6Rg',      // weight-bearing through the wrists (Front Plank)
  dead_hang: 'rmdn5X_KLkY',                 // bar hang / grip (Pull-Up)
  wrist_flexor_curl: 'dA9_h9r8YBw',         // Palms-Up Dumbbell Wrist Curl
  wrist_circles: { en: 'IJvS9bYl_cs', es: 'CQ71AY1w8Ls', pt: 'S1BqYYaZz3Y' }, // Wrist Circles (EN/ES/PT)
  prayer_stretch: 'XnJu70SLsJk',            // Prayer Stretch (AskDoctorJo)
  finger_extension_band: 'jbs0-Z8FpDw',     // Rubber-band Finger Extension
  grip_squeeze: '8h0tSMxLNG4',              // Hand/Wrist Ball Squeeze (AskDoctorJo)
  radial_ulnar_deviation: 'pwodoGsoIpM',    // Radial/Ulnar Deviation (AskDoctorJo)
  finger_tendon_glides: 'grbacaaEwjg',      // Finger Tendon Glides (AskDoctorJo)
};

// Compile the diagnostic report lines from the three selections, in `lang`. The
// `selections` map keys on the language-invariant PLANNER ids + option values,
// so a selection resolves identically across languages — only the rendered
// title/body localize.
export function compileReport(selections, lang) {
  const planner = (PREHAB_I18N[lang] || PREHAB_I18N.en).PLANNER;
  return planner.map((q) => {
    const opt = q.options.find((o) => o.value === selections[q.id]) || q.options[0];
    return { status: opt.status, title: opt.code.title, body: opt.code.body };
  });
}
