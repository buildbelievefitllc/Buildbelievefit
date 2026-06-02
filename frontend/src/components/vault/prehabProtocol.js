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
// This is mock/static ground-truth for the UI; the per-athlete read path
// (bbf_get_client_prehab over bbf_prehab_catalog + bbf_client_prehab) is a
// backend follow-up — see e2e/tests/prehab.spec.ts (held contract).

export const PLANNER = [
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
];

export const PROTOCOL = {
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
  ],
};

// Compile the diagnostic report lines from the three selections.
export function compileReport(selections) {
  return PLANNER.map((q) => {
    const opt = q.options.find((o) => o.value === selections[q.id]) || q.options[0];
    return { status: opt.status, title: opt.code.title, body: opt.code.body };
  });
}
