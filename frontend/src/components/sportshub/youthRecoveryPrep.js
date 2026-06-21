// src/components/sportshub/youthRecoveryPrep.js
// ─────────────────────────────────────────────────────────────────────────────
// Youth baseline recovery prep — a fixed, media-rich foundational routine rendered
// through the SAME SovereignPrepPanels the adult ClientHub uses (Phase 1 Tissue
// Release · foam rolling → Phase 2 Static Elongation · stretching → Phase 3 Dynamic
// Potentiation · drills). Each item id maps to the recovery video catalog
// (data/recoveryVideos.js), so every card carries a trilingual demo. No edge fn and
// no entitlement gate — it ALWAYS populates for the youth athlete (transplant of the
// adult media UI without the adult's program-load dependency).

export const YOUTH_BASELINE_PREP = {
  foam_rolling: [
    { id: 'roll_quad_001', name: 'Quad Roll', muscle_group: 'quads', tool: 'foam_roller', prescription: { passes: '3–4', dwell: '20–30s', timing: 'Pre & post' }, emphasis_flag: false },
    { id: 'roll_ham_001', name: 'Hamstring Roll', muscle_group: 'hamstrings', tool: 'foam_roller', prescription: { passes: '3–4', dwell: '20–30s', timing: 'Pre & post' }, emphasis_flag: false },
    { id: 'roll_calf_001', name: 'Calf Roll', muscle_group: 'calves', tool: 'foam_roller', prescription: { passes: '3–4', dwell: '20–30s', timing: 'Pre & post' }, emphasis_flag: false },
    { id: 'roll_glute_001', name: 'Glute / Piriformis Release', muscle_group: 'hip_abductors', tool: 'massage_ball', prescription: { passes: '2–3', dwell: '30s', timing: 'Post' }, emphasis_flag: false },
    { id: 'roll_uback_001', name: 'Thoracic (Upper-Back) Roll', muscle_group: 'upper_back', tool: 'foam_roller', prescription: { passes: '3–4', dwell: '20s', timing: 'Pre & post' }, emphasis_flag: false },
  ],
  recovery_stretches: [
    { id: 'stat_quad_001', name: 'Standing Quad Stretch', muscle_group: 'quads', prescription: { light: 20, standard: 30, deep: 45 }, emphasis_flag: false },
    { id: 'stat_ham_001', name: 'Seated Forward Fold', muscle_group: 'hamstrings', prescription: { light: 20, standard: 30, deep: 45 }, emphasis_flag: false },
    { id: 'stat_calf_001', name: 'Wall Calf Stretch', muscle_group: 'calves', prescription: { light: 20, standard: 30, deep: 45 }, emphasis_flag: false },
    { id: 'stat_chest_001', name: 'Wall Pec Stretch', muscle_group: 'chest', prescription: { light: 20, standard: 30, deep: 45 }, emphasis_flag: false },
    { id: 'stat_uback_001', name: "Child's Pose Reach", muscle_group: 'upper_back', prescription: { light: 20, standard: 30, deep: 45 }, emphasis_flag: false },
  ],
  prep_drills: [
    { id: 'dyn_lback_002', name: "World's Greatest Stretch", muscle_group: 'lower_back', prescription: { reps: '4/side', tempo: 'Controlled' }, emphasis_flag: false },
    { id: 'dyn_ham_001', name: 'Leg Swings (Front-to-Back)', muscle_group: 'hamstrings', prescription: { reps: '10/side', tempo: 'Dynamic' }, emphasis_flag: false },
    { id: 'dyn_quad_002', name: 'Reverse Lunge with Reach', muscle_group: 'quads', prescription: { reps: '6/side', tempo: 'Controlled' }, emphasis_flag: false },
    { id: 'dyn_add_001', name: 'Cossack Squat Shifts', muscle_group: 'hip_adductors', prescription: { reps: '6/side', tempo: 'Controlled' }, emphasis_flag: false },
    { id: 'dyn_sho_001', name: 'Arm Circles', muscle_group: 'shoulders', prescription: { reps: '10 each way', tempo: 'Dynamic' }, emphasis_flag: false },
  ],
};
