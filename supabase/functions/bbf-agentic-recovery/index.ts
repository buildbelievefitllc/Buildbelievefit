// bbf-agentic-recovery — Dynamic Recovery Matrix (stretching + foam rolling)
// ─────────────────────────────────────────────────────────────────────────────
// DETERMINISTIC · NO Anthropic call · NO model-router (§4 N/A — no Claude call).
// Recovery is maintenance work, not pain intervention (cf. bbf-agentic-prehab,
// which IS the friction→drill diagnostic). This function serves the BBF_RECOVERY
// library deterministically:
//   • recovery_stretches ← static holds, emphasis on YESTERDAY's trained groups
//   • prep_drills        ← dynamic mobility, emphasis on TODAY's focus groups
//   • foam_rolling       ← full soft-tissue protocol (no filter, no emphasis)
//
// AUTH: BBF standard — deploy with verify_jwt = false. The Supabase gateway
// routes the call on the public anon key (attached automatically by
// supabase.functions.invoke); the REAL identity boundary is the 24h vault session
// bearer (`vault_token`, body or X-BBF-Vault-Token header) resolved SERVER-SIDE
// through the shared entitlement gate (_bbf_uid_from_vault_token). The
// caller-supplied user_id is NEVER trusted for identity — we mirror it back from
// the resolved session. (BBF does not use Supabase GoTrue user JWTs; auth is a
// custom username+PIN → vault_token, same as bbf-agentic-cardio / -prehab.)
// Recovery is foundational maintenance, so we resolve identity only (any valid
// vault session) rather than tier-gate it.
//
// LIBRARY SOURCE: the full 53-entry library is EMBEDDED below as
// BBF_RECOVERY_LIBRARY (build brief: "embed this into the edge function as a
// constant"). The request MAY override it via `recovery_library` (build prompt
// input schema); when absent we use the embedded copy so the client never has to
// ship ~30KB of static data on every call.
//
// Response shape:
//   { recovery_stretches[], prep_drills[], foam_rolling[],
//     meta: { user_id, generated_at, context: 'pre_workout' } }
//
// FAILURE POSTURE: 400 malformed input · 401 no/invalid session · 403 locked ·
// 405 wrong method · 500 unexpected. Telemetry (bbf_agent_runs) is best-effort.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { resolveEntitlement } from '../_shared/entitlement-gate.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-bbf-admin-token, x-bbf-vault-token',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

// ─────────────────────────────────────────────────────────────────────────────
// EMBEDDED RECOVERY LIBRARY — DYNAMIC RECOVERY MATRIX v1.0.0
// Mirror of frontend bbf-recovery-data.js (BBF_RECOVERY_LIBRARY). 53 entries:
// 26 static holds · 18 dynamic drills · 9 foam-rolling sequences.
// ─────────────────────────────────────────────────────────────────────────────
const BBF_RECOVERY_LIBRARY = {
  meta: {
    version: '1.0.0',
    engine: 'DYNAMIC RECOVERY MATRIX',
    duration_variants: { light: 30, standard: 60, deep: 90 },
    muscle_groups: [
      'calves', 'quads', 'hamstrings', 'hip_adductors', 'hip_abductors',
      'shoulders', 'chest', 'neck', 'upper_back', 'lower_back', 'groin',
    ],
    contexts: ['recovery', 'post_workout', 'prep', 'pre_workout', 'daily'],
  },

  static: [
    // ---------- CALVES ----------
    {
      id: 'stat_calf_001', name: 'Wall Calf Stretch (Gastrocnemius)',
      muscle_group: 'calves', secondary: [], position: 'standing',
      duration: { light: 30, standard: 60, deep: 90 },
      cues: {
        breathing: 'Inhale to set, exhale as you press the heel down and sink in.',
        form: 'Hands on wall, back leg straight, heel glued to floor, hips square forward.',
        intensity: 'Walk the back foot further out for more — stretch should feel like a firm 6/10, never sharp.',
      },
      context: ['recovery', 'post_workout'],
    },
    {
      id: 'stat_calf_002', name: 'Bent-Knee Calf Stretch (Soleus)',
      muscle_group: 'calves', secondary: [], position: 'standing',
      duration: { light: 30, standard: 60, deep: 90 },
      cues: {
        breathing: 'Slow nasal breathing, exhale to settle deeper each cycle.',
        form: 'Same wall setup but soften the back knee — drops the stretch into the lower calf.',
        intensity: 'Keep heel down. Bend deeper for more soleus, ease off if the Achilles complains.',
      },
      context: ['recovery', 'post_workout'],
    },
    {
      id: 'stat_calf_003', name: 'Step-Drop Calf Hang',
      muscle_group: 'calves', secondary: [], position: 'standing',
      duration: { light: 30, standard: 60, deep: 90 },
      cues: {
        breathing: 'Exhale and let gravity lower the heel below the step line.',
        form: 'Ball of foot on a step edge, heel drops below, hold rail for balance.',
        intensity: 'Bodyweight does the work — shift more weight onto the working leg to deepen.',
      },
      context: ['recovery', 'post_workout'],
    },

    // ---------- QUADS ----------
    {
      id: 'stat_quad_001', name: 'Standing Quad Stretch',
      muscle_group: 'quads', secondary: ['hip_flexors'], position: 'standing',
      duration: { light: 30, standard: 60, deep: 90 },
      cues: {
        breathing: 'Exhale as you draw the heel toward the glute.',
        form: 'Knees stay glued together, tuck the pelvis under, pull ankle (not toes).',
        intensity: 'Posterior pelvic tilt is the dial — tuck harder for more front-thigh stretch.',
      },
      context: ['recovery', 'post_workout'],
    },
    {
      id: 'stat_quad_002', name: 'Couch Stretch (Wall-Assisted)',
      muscle_group: 'quads', secondary: ['hip_flexors'], position: 'kneeling',
      duration: { light: 30, standard: 60, deep: 90 },
      cues: {
        breathing: 'Long exhales — this one needs you to relax into it.',
        form: 'Back shin up the wall, front foot planted, ribs down, squeeze the back glute.',
        intensity: 'Walk the front foot forward and lift the torso tall to crank it up. Deep stretch — earn it gradually.',
      },
      context: ['recovery', 'post_workout'],
    },
    {
      id: 'stat_quad_003', name: 'Side-Lying Quad Stretch',
      muscle_group: 'quads', secondary: [], position: 'lying',
      duration: { light: 30, standard: 60, deep: 90 },
      cues: {
        breathing: 'Relaxed belly breathing, no bracing.',
        form: 'Lie on your side, grab the top ankle, draw heel to glute, keep knees stacked.',
        intensity: 'Lowest-effort quad stretch — good for end-of-day or heavy DOMS. Gentle pull only.',
      },
      context: ['recovery', 'post_workout', 'daily'],
    },

    // ---------- HAMSTRINGS ----------
    {
      id: 'stat_ham_001', name: 'Seated Forward Fold',
      muscle_group: 'hamstrings', secondary: ['lower_back'], position: 'seated',
      duration: { light: 30, standard: 60, deep: 90 },
      cues: {
        breathing: 'Exhale and hinge — fold a little further on each out-breath.',
        form: 'Hinge from the hips, lead with the chest, soft knees if the low back rounds.',
        intensity: "Don't chase your toes — chase a flat back. Micro-bend the knees to keep tension in the muscle, not the spine.",
      },
      context: ['recovery', 'post_workout'],
    },
    {
      id: 'stat_ham_002', name: 'Supine Strap Hamstring Stretch',
      muscle_group: 'hamstrings', secondary: [], position: 'lying',
      duration: { light: 30, standard: 60, deep: 90 },
      cues: {
        breathing: 'Steady exhale as you draw the leg toward you.',
        form: 'On your back, strap/towel around the foot, leg straight, opposite leg flat or bent.',
        intensity: 'Pull the leg closer for more. Safest deep-hold option — spine stays neutral on the floor.',
      },
      context: ['recovery', 'post_workout', 'daily'],
    },
    {
      id: 'stat_ham_003', name: 'Single-Leg Toe-Touch (Staggered)',
      muscle_group: 'hamstrings', secondary: ['calves'], position: 'standing',
      duration: { light: 30, standard: 60, deep: 90 },
      cues: {
        breathing: 'Exhale to hinge deeper over the front leg.',
        form: 'Front heel planted, toes up, hinge over the straight front leg, back knee soft.',
        intensity: 'Flex the toe toward you to pull the calf in too. Keep the back flat over rounding.',
      },
      context: ['recovery', 'post_workout'],
    },

    // ---------- HIP ADDUCTORS ----------
    {
      id: 'stat_add_001', name: 'Butterfly Stretch',
      muscle_group: 'hip_adductors', secondary: ['groin'], position: 'seated',
      duration: { light: 30, standard: 60, deep: 90 },
      cues: {
        breathing: 'Exhale and let the knees drift toward the floor — never force.',
        form: 'Soles together, sit tall, hinge forward from the hips to deepen.',
        intensity: 'Light press on the inner thighs adds load. Heels closer to body = more intense.',
      },
      context: ['recovery', 'post_workout', 'daily'],
    },
    {
      id: 'stat_add_002', name: 'Side-Lunge Adductor Hold',
      muscle_group: 'hip_adductors', secondary: ['groin'], position: 'standing',
      duration: { light: 30, standard: 60, deep: 90 },
      cues: {
        breathing: 'Exhale as you shift hips toward the bent knee.',
        form: 'Wide stance, bend one knee, keep the opposite leg straight with foot flat.',
        intensity: 'Sink the hips lower and toward the bent side to crank the straight-leg inner thigh.',
      },
      context: ['recovery', 'post_workout'],
    },

    // ---------- HIP ABDUCTORS ----------
    {
      id: 'stat_abd_001', name: 'Figure-4 Glute/Abductor Stretch',
      muscle_group: 'hip_abductors', secondary: [], position: 'lying',
      duration: { light: 30, standard: 60, deep: 90 },
      cues: {
        breathing: 'Exhale and draw the thigh toward your chest.',
        form: 'On your back, ankle crossed over opposite knee, pull the bottom thigh in.',
        intensity: 'The closer you draw it in, the deeper the outer-hip/glute stretch. Keep both hips down.',
      },
      context: ['recovery', 'post_workout', 'daily'],
    },
    {
      id: 'stat_abd_002', name: 'Standing Cross-Body IT/Abductor Stretch',
      muscle_group: 'hip_abductors', secondary: ['lower_back'], position: 'standing',
      duration: { light: 30, standard: 60, deep: 90 },
      cues: {
        breathing: 'Exhale and lean the hip out to the side.',
        form: 'Cross one foot behind the other, push the back hip outward, reach overhead toward the planted side.',
        intensity: 'Push the hip further out for the IT band/outer hip. Gentle lateral lean, no spinal crunch.',
      },
      context: ['recovery', 'post_workout'],
    },

    // ---------- SHOULDERS ----------
    {
      id: 'stat_sho_001', name: 'Cross-Body Shoulder Stretch',
      muscle_group: 'shoulders', secondary: ['upper_back'], position: 'standing',
      duration: { light: 30, standard: 60, deep: 90 },
      cues: {
        breathing: 'Exhale as you draw the arm across.',
        form: 'Arm straight across chest at shoulder height, press it in with the opposite forearm.',
        intensity: 'Keep the shoulder down, not shrugged. Press firmer for the rear delt.',
      },
      context: ['recovery', 'post_workout'],
    },
    {
      id: 'stat_sho_002', name: 'Doorway Pec/Front-Delt Stretch',
      muscle_group: 'shoulders', secondary: ['chest'], position: 'standing',
      duration: { light: 30, standard: 60, deep: 90 },
      cues: {
        breathing: 'Exhale and lean through the doorway.',
        form: 'Forearm on the frame at 90°, step through and rotate the chest away.',
        intensity: 'Raise or lower the elbow to hit different fibers. Lean further for more — stop before the joint pinches.',
      },
      context: ['recovery', 'post_workout'],
    },
    {
      id: 'stat_sho_003', name: 'Overhead Triceps/Lat Reach',
      muscle_group: 'shoulders', secondary: ['upper_back'], position: 'standing',
      duration: { light: 30, standard: 60, deep: 90 },
      cues: {
        breathing: 'Exhale and reach the hand further down the spine.',
        form: 'Bent elbow overhead, opposite hand pulls it back gently, ribs stay down.',
        intensity: 'Side-bend slightly away to bring the lat in. Light overpressure only.',
      },
      context: ['recovery', 'post_workout'],
    },

    // ---------- CHEST ----------
    {
      id: 'stat_chest_001', name: 'Wall Pec Stretch',
      muscle_group: 'chest', secondary: ['shoulders'], position: 'standing',
      duration: { light: 30, standard: 60, deep: 90 },
      cues: {
        breathing: 'Exhale and rotate the torso open.',
        form: 'Palm/forearm flat on wall, arm at shoulder height, turn body away.',
        intensity: 'Higher arm = upper chest, lower arm = lower chest. Rotate further to deepen.',
      },
      context: ['recovery', 'post_workout'],
    },
    {
      id: 'stat_chest_002', name: 'Floor Snow-Angel (Supine Pec Opener)',
      muscle_group: 'chest', secondary: ['shoulders'], position: 'lying',
      duration: { light: 30, standard: 60, deep: 90 },
      cues: {
        breathing: 'Long relaxed exhales — let the chest open under bodyweight.',
        form: 'Lie back over a rolled towel along the spine, arms out in a T or cactus.',
        intensity: 'Gravity sets the depth. Move arms overhead slowly for a bigger opener.',
      },
      context: ['recovery', 'post_workout', 'daily'],
    },

    // ---------- NECK ----------
    {
      id: 'stat_neck_001', name: 'Lateral Neck Stretch',
      muscle_group: 'neck', secondary: [], position: 'seated',
      duration: { light: 30, standard: 60, deep: 90 },
      cues: {
        breathing: 'Slow nasal breathing, shoulders relaxed down.',
        form: "Tilt ear toward shoulder, let the opposite hand rest the head's weight in.",
        intensity: 'Use the hand\'s weight ONLY — never yank. Anchor the opposite shoulder down for more.',
      },
      context: ['recovery', 'daily'],
    },
    {
      id: 'stat_neck_002', name: 'Levator/Upper-Trap Stretch',
      muscle_group: 'neck', secondary: ['upper_back'], position: 'seated',
      duration: { light: 30, standard: 60, deep: 90 },
      cues: {
        breathing: 'Exhale as you guide the chin toward the armpit.',
        form: 'Rotate chin 45° toward the armpit, gentle hand guidance, opposite shoulder pinned down.',
        intensity: 'Very light pressure. This one releases tech-neck/shift tension — go slow.',
      },
      context: ['recovery', 'daily'],
    },

    // ---------- UPPER BACK ----------
    {
      id: 'stat_uback_001', name: "Child's Pose Reach",
      muscle_group: 'upper_back', secondary: ['shoulders', 'lower_back'], position: 'kneeling',
      duration: { light: 30, standard: 60, deep: 90 },
      cues: {
        breathing: 'Breathe into the back ribs — feel them expand.',
        form: 'Hips to heels, arms reach long, forehead down, let the chest melt.',
        intensity: 'Walk hands to one side for an oblique/lat bias. Pure decompression hold.',
      },
      context: ['recovery', 'post_workout', 'daily'],
    },
    {
      id: 'stat_uback_002', name: 'Thread-the-Needle',
      muscle_group: 'upper_back', secondary: ['shoulders'], position: 'kneeling',
      duration: { light: 30, standard: 60, deep: 90 },
      cues: {
        breathing: 'Exhale as you thread the arm under and rotate.',
        form: 'From all-fours, slide one arm under the body, shoulder and temple to floor.',
        intensity: 'Reach the threaded arm further for more thoracic rotation. Keep the hips stacked.',
      },
      context: ['recovery', 'post_workout'],
    },

    // ---------- LOWER BACK ----------
    {
      id: 'stat_lback_001', name: 'Supine Knees-to-Chest',
      muscle_group: 'lower_back', secondary: ['hamstrings'], position: 'lying',
      duration: { light: 30, standard: 60, deep: 90 },
      cues: {
        breathing: 'Exhale and hug the knees a touch closer each cycle.',
        form: 'On your back, draw both knees in, hands behind the thighs, tailbone heavy.',
        intensity: 'Gentle rock side to side for a self-massage. Decompression first, stretch second.',
      },
      context: ['recovery', 'post_workout', 'daily'],
    },
    {
      id: 'stat_lback_002', name: 'Supine Spinal Twist',
      muscle_group: 'lower_back', secondary: ['hip_abductors'], position: 'lying',
      duration: { light: 30, standard: 60, deep: 90 },
      cues: {
        breathing: 'Exhale and let the knees drop with gravity.',
        form: 'Knees bent and dropped to one side, shoulders pinned flat, gaze opposite.',
        intensity: 'Let gravity own the depth. Stack the knees higher toward the chest to shift the stretch up the spine.',
      },
      context: ['recovery', 'post_workout', 'daily'],
    },

    // ---------- GROIN ----------
    {
      id: 'stat_groin_001', name: 'Frog Stretch',
      muscle_group: 'groin', secondary: ['hip_adductors'], position: 'kneeling',
      duration: { light: 30, standard: 60, deep: 90 },
      cues: {
        breathing: 'Long exhales — rock back only as the tissue allows.',
        form: 'Knees wide on a padded surface, shins parallel, rock the hips back slowly.',
        intensity: 'Rock back further to deepen. Deep, intense stretch — back off at the first sharp signal.',
      },
      context: ['recovery', 'post_workout'],
    },
    {
      id: 'stat_groin_002', name: 'Seated Wide-Leg Fold',
      muscle_group: 'groin', secondary: ['hamstrings', 'hip_adductors'], position: 'seated',
      duration: { light: 30, standard: 60, deep: 90 },
      cues: {
        breathing: 'Exhale and hinge forward from the hips, not the waist.',
        form: 'Legs wide, toes up, sit tall on the sit-bones, walk the hands forward.',
        intensity: 'Widen the legs and hinge further for more. Keep the back long, not rounded.',
      },
      context: ['recovery', 'post_workout'],
    },
  ],

  dynamic: [
    // ---------- CALVES ----------
    {
      id: 'dyn_calf_001', name: 'Ankle Rocks (Knee-Over-Toe)',
      muscle_group: 'calves', secondary: [], position: 'standing',
      prescription: { reps: '10–12 per side', tempo: 'controlled, 2s out / 2s back' },
      cues: {
        breathing: 'Exhale on each forward rock.',
        form: 'Stagger stance, drive the front knee forward over the toes, heel stays down.',
        intensity: 'Increase range each rep. Preps ankle dorsiflexion for squats/lunges.',
      },
      context: ['prep', 'pre_workout'],
    },
    {
      id: 'dyn_calf_002', name: 'Walking Heel-to-Toe Rolls',
      muscle_group: 'calves', secondary: ['hamstrings'], position: 'standing',
      prescription: { reps: '20 steps', tempo: 'smooth, deliberate' },
      cues: {
        breathing: "Natural rhythm, don't hold breath.",
        form: 'Roll through heel-to-toe each step, rise onto the ball of the foot at the top.',
        intensity: 'Add a pause on the toe for more calf activation.',
      },
      context: ['prep', 'pre_workout'],
    },

    // ---------- QUADS ----------
    {
      id: 'dyn_quad_001', name: 'Walking Quad Pull',
      muscle_group: 'quads', secondary: ['hip_flexors'], position: 'standing',
      prescription: { reps: '8–10 per side', tempo: '1s pull / step through' },
      cues: {
        breathing: 'Exhale on each heel pull.',
        form: 'Pull heel to glute, add a small toe-raise on the standing leg, then step through.',
        intensity: 'Add a slight forward reach with the opposite arm to fire the hip too.',
      },
      context: ['prep', 'pre_workout'],
    },
    {
      id: 'dyn_quad_002', name: 'Reverse Lunge with Reach',
      muscle_group: 'quads', secondary: ['hip_flexors', 'groin'], position: 'standing',
      prescription: { reps: '8 per side', tempo: 'controlled descent' },
      cues: {
        breathing: 'Inhale down, exhale up.',
        form: 'Step back into a lunge, reach the same-side arm overhead, open the front of the hip.',
        intensity: 'Sink deeper and reach further to load the quad/hip flexor before leg day.',
      },
      context: ['prep', 'pre_workout'],
    },

    // ---------- HAMSTRINGS ----------
    {
      id: 'dyn_ham_001', name: 'Leg Swings (Front-to-Back)',
      muscle_group: 'hamstrings', secondary: ['hip_flexors'], position: 'standing',
      prescription: { reps: '12–15 per side', tempo: 'free, building range' },
      cues: {
        breathing: 'Exhale on the forward swing.',
        form: 'Hold support, swing one leg front to back, keep the torso tall and stable.',
        intensity: "Start small, build the arc each rep. Don't force the top — let momentum open it.",
      },
      context: ['prep', 'pre_workout'],
    },
    {
      id: 'dyn_ham_002', name: 'Toy-Soldier Walks (Straight-Leg Kicks)',
      muscle_group: 'hamstrings', secondary: ['calves'], position: 'standing',
      prescription: { reps: '10 per side', tempo: 'marching, controlled kick' },
      cues: {
        breathing: 'Exhale on each kick.',
        form: 'Kick a straight leg up to meet the opposite hand, flat back, no rounding.',
        intensity: 'Only kick as high as the back stays flat. Range comes with reps.',
      },
      context: ['prep', 'pre_workout'],
    },

    // ---------- HIP ADDUCTORS / GROIN ----------
    {
      id: 'dyn_add_001', name: 'Cossack Squat Shifts',
      muscle_group: 'hip_adductors', secondary: ['groin', 'quads'], position: 'standing',
      prescription: { reps: '6–8 per side', tempo: 'slow shift across' },
      cues: {
        breathing: 'Inhale to shift, exhale at the bottom.',
        form: 'Wide stance, shift hips over one bent knee, opposite leg straight with toes up.',
        intensity: 'Sink lower as the groin opens. Heel down on the bent side.',
      },
      context: ['prep', 'pre_workout'],
    },
    {
      id: 'dyn_add_002', name: 'Lateral Leg Swings',
      muscle_group: 'hip_adductors', secondary: ['hip_abductors', 'groin'], position: 'standing',
      prescription: { reps: '12 per side', tempo: 'free, building range' },
      cues: {
        breathing: 'Exhale on the cross-body swing.',
        form: 'Hold support, swing one leg side to side across the body, hips square.',
        intensity: 'Build the arc gradually — this primes both inner and outer hip.',
      },
      context: ['prep', 'pre_workout'],
    },

    // ---------- HIP ABDUCTORS ----------
    {
      id: 'dyn_abd_001', name: 'Hip CARs (Controlled Circles)',
      muscle_group: 'hip_abductors', secondary: ['hip_adductors'], position: 'standing',
      prescription: { reps: '5 per direction / side', tempo: 'slow, maximal control' },
      cues: {
        breathing: 'Steady breathing throughout, never rushed.',
        form: 'Knee up, trace the biggest controlled circle the hip allows, torso braced.',
        intensity: 'Move slow and own every degree. The bigger the circle, the more prep.',
      },
      context: ['prep', 'pre_workout'],
    },
    {
      id: 'dyn_abd_002', name: 'Lateral Band/Bodyweight Walks',
      muscle_group: 'hip_abductors', secondary: [], position: 'standing',
      prescription: { reps: '10 steps per direction', tempo: 'controlled, tension-held' },
      cues: {
        breathing: 'Exhale on each step out.',
        form: "Soft knees, athletic stance, step sideways keeping tension, don't let knees cave.",
        intensity: 'Lower the stance or add a band for more glute-med activation.',
      },
      context: ['prep', 'pre_workout'],
    },

    // ---------- SHOULDERS ----------
    {
      id: 'dyn_sho_001', name: 'Arm Circles (Small to Large)',
      muscle_group: 'shoulders', secondary: ['chest'], position: 'standing',
      prescription: { reps: '10 each direction', tempo: 'building diameter' },
      cues: {
        breathing: 'Natural rhythm, ribs stay down.',
        form: 'Arms out, start with small circles, grow them as the joint warms.',
        intensity: 'Build size gradually — never start big and cold.',
      },
      context: ['prep', 'pre_workout'],
    },
    {
      id: 'dyn_sho_002', name: 'Band/Towel Pass-Throughs',
      muscle_group: 'shoulders', secondary: ['chest', 'upper_back'], position: 'standing',
      prescription: { reps: '8–10', tempo: 'slow over-and-back' },
      cues: {
        breathing: 'Exhale as the arms pass overhead.',
        form: 'Wide grip on a band/towel, sweep it over the head and behind, arms straight.',
        intensity: 'Narrow the grip slightly as mobility opens — only as far as it stays smooth.',
      },
      context: ['prep', 'pre_workout'],
    },

    // ---------- CHEST ----------
    {
      id: 'dyn_chest_001', name: 'Open-Book Rotations',
      muscle_group: 'chest', secondary: ['upper_back', 'shoulders'], position: 'lying',
      prescription: { reps: '8 per side', tempo: 'slow, follow the hand' },
      cues: {
        breathing: 'Exhale as the chest opens to the ceiling.',
        form: 'Side-lying, knees bent, top arm sweeps open across the body, eyes track the hand.',
        intensity: 'Let the chest rotate further each rep — keep the knees down.',
      },
      context: ['prep', 'pre_workout'],
    },

    // ---------- NECK ----------
    {
      id: 'dyn_neck_001', name: 'Neck Yes/No/Maybe Mobility',
      muscle_group: 'neck', secondary: [], position: 'seated',
      prescription: { reps: '5 each plane', tempo: 'slow, gentle range' },
      cues: {
        breathing: 'Easy breathing, shoulders relaxed.',
        form: 'Nod yes, turn no, tilt maybe — small, smooth, pain-free arcs.',
        intensity: 'Stay inside a comfortable range. This is a wake-up, not a stretch.',
      },
      context: ['prep', 'pre_workout', 'daily'],
    },

    // ---------- UPPER BACK ----------
    {
      id: 'dyn_uback_001', name: 'Cat-Cow Flow',
      muscle_group: 'upper_back', secondary: ['lower_back'], position: 'kneeling',
      prescription: { reps: '8–10 cycles', tempo: 'breath-paced' },
      cues: {
        breathing: 'Inhale to arch (cow), exhale to round (cat).',
        form: 'All fours, move one vertebra at a time, lead with the breath.',
        intensity: 'Segment the spine slowly — quality of motion over speed.',
      },
      context: ['prep', 'pre_workout', 'daily'],
    },
    {
      id: 'dyn_uback_002', name: 'Quadruped Thoracic Rotation',
      muscle_group: 'upper_back', secondary: ['shoulders'], position: 'kneeling',
      prescription: { reps: '8 per side', tempo: 'slow, full rotation' },
      cues: {
        breathing: 'Exhale as you rotate open.',
        form: 'Hand behind head, rotate the elbow up toward the ceiling, hips locked still.',
        intensity: 'Rotate further each rep — the movement comes from the mid-back, not the low back.',
      },
      context: ['prep', 'pre_workout'],
    },

    // ---------- LOWER BACK ----------
    {
      id: 'dyn_lback_001', name: 'Standing Pelvic Tilts',
      muscle_group: 'lower_back', secondary: [], position: 'standing',
      prescription: { reps: '10–12', tempo: 'slow tuck and release' },
      cues: {
        breathing: 'Exhale on the tuck, inhale to neutral.',
        form: 'Hands on hips, tilt the pelvis under then release, ribs stay stacked.',
        intensity: 'Small, controlled range. Wakes up the lumbo-pelvic connection before loading.',
      },
      context: ['prep', 'pre_workout', 'daily'],
    },
    {
      id: 'dyn_lback_002', name: "World's Greatest Stretch",
      muscle_group: 'lower_back', secondary: ['hip_flexors', 'upper_back', 'hamstrings'], position: 'standing',
      prescription: { reps: '5 per side', tempo: 'slow, multi-segment' },
      cues: {
        breathing: 'Exhale on each rotation.',
        form: 'Lunge, drop the back knee, hand inside the front foot, rotate the top arm to the ceiling.',
        intensity: 'Full-body opener — move through it slowly. Add a hamstring sweep at the end for more.',
      },
      context: ['prep', 'pre_workout'],
    },
  ],

  foam_rolling: [
    {
      id: 'roll_calf_001', name: 'Calf Roll',
      muscle_group: 'calves', tool: 'foam_roller',
      prescription: { passes: '8–10 slow passes', dwell: '20–30s on knots', timing: 'pre or post' },
      cues: {
        breathing: 'Exhale into tender spots, never hold the breath.',
        form: 'Roller under the calf, stack the opposite leg on top for pressure, roll ankle to knee.',
        intensity: 'Cross the legs to add load. Pause and breathe on hot spots — pain target ≤7/10.',
      },
    },
    {
      id: 'roll_quad_001', name: 'Quad Roll',
      muscle_group: 'quads', tool: 'foam_roller',
      prescription: { passes: '8–10 slow passes', dwell: '20–30s on knots', timing: 'pre or post' },
      cues: {
        breathing: 'Slow exhales over tight spots.',
        form: 'Prone on forearms, roller under the thigh, roll hip to just above the knee.',
        intensity: 'Rotate slightly in/out to hit all three quad heads. One leg at a time for more pressure.',
      },
    },
    {
      id: 'roll_ham_001', name: 'Hamstring Roll',
      muscle_group: 'hamstrings', tool: 'foam_roller',
      prescription: { passes: '8–10 slow passes', dwell: '20–30s on knots', timing: 'pre or post' },
      cues: {
        breathing: 'Exhale and relax the leg into the roller.',
        form: 'Seated, roller under the thigh, hands behind for support, roll glute to knee.',
        intensity: 'Stack the opposite leg on top to crank pressure. Let the muscle relax — tension fights the release.',
      },
    },
    {
      id: 'roll_add_001', name: 'Inner-Thigh / Adductor Roll',
      muscle_group: 'hip_adductors', tool: 'foam_roller',
      prescription: { passes: '6–8 slow passes', dwell: '20–30s on knots', timing: 'pre or post' },
      cues: {
        breathing: 'Long exhales — this is a tender area, go easy.',
        form: 'Prone, roller angled under the inner thigh, leg bent out to the side, roll groin to knee.',
        intensity: 'Sensitive zone — start light. Shift weight gradually for more.',
      },
    },
    {
      id: 'roll_itb_001', name: 'Outer-Hip / IT Band & Glute-Med Roll',
      muscle_group: 'hip_abductors', tool: 'foam_roller',
      prescription: { passes: '6–8 slow passes', dwell: '20–30s on knots', timing: 'pre or post' },
      cues: {
        breathing: 'Breathe through it — this one bites.',
        form: 'Side-lying on the roller at the outer hip, support with the top foot and forearm.',
        intensity: 'Target the glute-med and upper IT band, not the bony parts. Regulate pressure with the top foot.',
      },
    },
    {
      id: 'roll_glute_001', name: 'Glute / Piriformis Ball Release',
      muscle_group: 'hip_abductors', tool: 'lacrosse_ball',
      prescription: { passes: 'small circles', dwell: '30–45s on knots', timing: 'pre or post' },
      cues: {
        breathing: 'Exhale and sink into the spot.',
        form: 'Seated on a ball, cross the ankle over the opposite knee, hunt the tender glute spot.',
        intensity: 'Settle and breathe rather than rolling fast. Lean in for more.',
      },
    },
    {
      id: 'roll_uback_001', name: 'Upper-Back / Thoracic Roll',
      muscle_group: 'upper_back', tool: 'foam_roller',
      prescription: { passes: '8–10 slow passes + extensions', dwell: 'hold extensions 3–5 breaths', timing: 'pre or post' },
      cues: {
        breathing: 'Inhale to extend back over the roller, exhale to return.',
        form: 'Roller across the mid-back, hands behind the head, gently extend over it segment by segment.',
        intensity: 'Keep it ABOVE the low back — ribcage only. Add small extensions for mobility.',
      },
    },
    {
      id: 'roll_lback_001', name: 'Lower-Back QL Ball Release',
      muscle_group: 'lower_back', tool: 'lacrosse_ball',
      prescription: { passes: 'small circles', dwell: '30s on knots', timing: 'post preferred' },
      cues: {
        breathing: 'Slow exhales into the tension.',
        form: 'Ball on the muscle BESIDE the spine (the QL), never directly on the spine itself.',
        intensity: 'Gentle — the low back gets released indirectly. Never roll the lumbar spine bones.',
      },
    },
    {
      id: 'roll_chest_001', name: 'Pec / Chest Ball Release',
      muscle_group: 'chest', tool: 'lacrosse_ball',
      prescription: { passes: 'small circles', dwell: '30s on knots', timing: 'pre or post' },
      cues: {
        breathing: 'Exhale and let the chest soften into the wall.',
        form: 'Ball between the chest and a wall, just below the collarbone/shoulder, hunt the tender spot.',
        intensity: 'Lean in to dial pressure. Avoid the front of the shoulder joint itself.',
      },
    },
  ],
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface Cues { breathing: string; form: string; intensity: string }

interface StaticEntry {
  id: string; name: string; muscle_group: string; secondary?: string[];
  position?: string; duration: Record<string, number>; cues: Cues; context: string[];
}
interface DynamicEntry {
  id: string; name: string; muscle_group: string; secondary?: string[];
  position?: string; prescription: Record<string, string>; cues: Cues; context: string[];
}
interface FoamEntry {
  id: string; name: string; muscle_group: string; tool: string;
  prescription: Record<string, string>; cues: Cues;
}
interface RecoveryLibrary { static: StaticEntry[]; dynamic: DynamicEntry[]; foam_rolling: FoamEntry[] }

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const norm = (s: unknown): string => String(s ?? '').trim().toLowerCase();

// Build a normalized lookup set from a request-provided muscle-group array.
function toGroupSet(arr: unknown): Set<string> {
  const set = new Set<string>();
  if (Array.isArray(arr)) for (const g of arr) { const n = norm(g); if (n) set.add(n); }
  return set;
}

// Validate a candidate library has the three required, well-shaped arrays.
function isUsableLibrary(lib: unknown): lib is RecoveryLibrary {
  if (!lib || typeof lib !== 'object') return false;
  const l = lib as Record<string, unknown>;
  return Array.isArray(l.static) && Array.isArray(l.dynamic) && Array.isArray(l.foam_rolling);
}

// Emphasis-first stable ordering: flagged entries keep their relative order, then
// the rest keep theirs. (Array.prototype.sort is stable in V8/Deno.)
function emphasisFirst<T extends { emphasis_flag: boolean }>(rows: T[]): T[] {
  return rows.slice().sort((a, b) => Number(b.emphasis_flag) - Number(a.emphasis_flag));
}

function mapStatic(entries: StaticEntry[], emphasisGroups: Set<string>) {
  const rows = entries.map((e) => ({
    id: e.id,
    name: e.name,
    muscle_group: e.muscle_group,
    // Static holds carry `duration` in the library; the Recovery contract exposes
    // it as `prescription` (light/standard/deep seconds).
    prescription: e.duration,
    cues: e.cues,
    context: e.context,
    emphasis_flag: emphasisGroups.has(norm(e.muscle_group)),
  }));
  return emphasisFirst(rows);
}

function mapDynamic(entries: DynamicEntry[], emphasisGroups: Set<string>) {
  const rows = entries.map((e) => ({
    id: e.id,
    name: e.name,
    muscle_group: e.muscle_group,
    prescription: e.prescription,
    cues: e.cues,
    context: e.context,
    emphasis_flag: emphasisGroups.has(norm(e.muscle_group)),
  }));
  return emphasisFirst(rows);
}

function mapFoam(entries: FoamEntry[]) {
  // No filter, no emphasis — full soft-tissue protocol, original order.
  return entries.map((e) => ({
    id: e.id,
    name: e.name,
    muscle_group: e.muscle_group,
    tool: e.tool,
    prescription: e.prescription,
    cues: e.cues,
  }));
}

// Best-effort run log to bbf_agent_runs. NEVER throws, NEVER blocks. We log the
// request *shape* (counts + group lists) but NOT the full library (size).
async function logRun(
  supabaseUrl: string | undefined,
  serviceKey: string | undefined,
  row: { ok: boolean; durationMs: number; error?: string | null; summary: Record<string, unknown> },
): Promise<void> {
  if (!supabaseUrl || !serviceKey) return;
  try {
    const now = Date.now();
    await fetch(`${supabaseUrl}/rest/v1/bbf_agent_runs`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        agent: 'bbf-agentic-recovery',
        source: 'edge',
        started_at: new Date(now - row.durationMs).toISOString(),
        finished_at: new Date(now).toISOString(),
        duration_ms: Math.round(row.durationMs),
        ok: row.ok,
        error: row.error ?? null,
        summary: row.summary,
      }),
    });
  } catch (e) {
    console.warn(`[bbf-agentic-recovery] run-log failed (non-fatal): ${(e as Error).message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const t0 = Date.now();
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
  const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || SUPABASE_ANON_KEY;

  // ── Parse body ──
  let payload: any;
  try { payload = await req.json(); } catch (_) { return jsonResponse({ error: 'invalid_json' }, 400); }
  if (!payload || typeof payload !== 'object') return jsonResponse({ error: 'invalid_json' }, 400);

  const { user_id, yesterday_muscle_groups, today_muscle_groups, recovery_library } = payload;

  // ── Validate input shape (400) ── (user_id is optional/advisory — identity is
  // resolved from the vault session below, never trusted from the body.)
  if (user_id !== undefined && typeof user_id !== 'string') {
    return jsonResponse({ error: 'invalid_input', detail: 'user_id, when present, must be a string.' }, 400);
  }
  if (yesterday_muscle_groups !== undefined && !Array.isArray(yesterday_muscle_groups)) {
    return jsonResponse({ error: 'invalid_input', detail: 'yesterday_muscle_groups must be an array.' }, 400);
  }
  if (today_muscle_groups !== undefined && !Array.isArray(today_muscle_groups)) {
    return jsonResponse({ error: 'invalid_input', detail: 'today_muscle_groups must be an array.' }, 400);
  }

  // ── Authenticate the caller via the vault session (401 / 403) ──
  // Identity is server-authoritative: resolved from the vault bearer token, never
  // from the body. Recovery is foundational, so identity-only — no feature gate.
  const vaultToken = payload?.vault_token ?? req.headers.get('x-bbf-vault-token');
  const gate = await resolveEntitlement({
    supabaseUrl: SUPABASE_URL, serviceKey: SUPABASE_SERVICE_KEY, vaultToken,
  });
  if ('status' in gate) {
    return jsonResponse({ error: gate.error, detail: gate.detail }, gate.status);
  }
  // Server-authoritative identity for the response meta + audit.
  const resolvedUser = gate.uid || gate.user_id;

  try {
    // ── Select the library: request override (build prompt) or embedded (brief) ──
    const lib: RecoveryLibrary = isUsableLibrary(recovery_library)
      ? (recovery_library as RecoveryLibrary)
      : (BBF_RECOVERY_LIBRARY as unknown as RecoveryLibrary);

    const yesterdaySet = toGroupSet(yesterday_muscle_groups);
    const todaySet = toGroupSet(today_muscle_groups);

    const recovery_stretches = mapStatic(lib.static, yesterdaySet);   // emphasis: yesterday
    const prep_drills = mapDynamic(lib.dynamic, todaySet);            // emphasis: today
    const foam_rolling = mapFoam(lib.foam_rolling);                   // full protocol

    const body = {
      recovery_stretches,
      prep_drills,
      foam_rolling,
      meta: {
        user_id: resolvedUser,
        generated_at: new Date().toISOString(),
        context: 'pre_workout',
      },
    };

    // Best-effort audit (no library payload, only counts/shape).
    await logRun(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      ok: true,
      durationMs: Date.now() - t0,
      summary: {
        user_id: resolvedUser,
        yesterday_muscle_groups: Array.from(yesterdaySet),
        today_muscle_groups: Array.from(todaySet),
        library_source: isUsableLibrary(recovery_library) ? 'request' : 'embedded',
        counts: {
          recovery_stretches: recovery_stretches.length,
          prep_drills: prep_drills.length,
          foam_rolling: foam_rolling.length,
          stretch_emphasis: recovery_stretches.filter((r) => r.emphasis_flag).length,
          drill_emphasis: prep_drills.filter((r) => r.emphasis_flag).length,
        },
        context: 'pre_workout',
      },
    });

    console.log(
      `[bbf-agentic-recovery] uid=${resolvedUser} y=[${Array.from(yesterdaySet).join(',')}] ` +
      `t=[${Array.from(todaySet).join(',')}] src=${isUsableLibrary(recovery_library) ? 'request' : 'embedded'} ` +
      `stretches=${recovery_stretches.length} drills=${prep_drills.length} foam=${foam_rolling.length}`,
    );

    return jsonResponse(body, 200);
  } catch (e) {
    const msg = (e as Error).message;
    console.error(`[bbf-agentic-recovery] unexpected: ${msg}`);
    await logRun(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      ok: false, durationMs: Date.now() - t0, error: msg, summary: { user_id: resolvedUser, context: 'pre_workout' },
    });
    return jsonResponse({ error: 'internal_error', detail: 'Recovery matrix could not be generated.' }, 500);
  }
});
