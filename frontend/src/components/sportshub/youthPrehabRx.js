// src/components/sportshub/youthPrehabRx.js
// ─────────────────────────────────────────────────────────────────────────────
// YOUTH PREHAB PRESCRIPTION — the "Netflix rule" data (CEO order): a youth athlete
// who logs joint friction in the Post-Game Check gets a HARD-CAPPED, highly
// targeted routine (MAX 3 movements) for that exact zone — never a browsable
// library. This is a deterministic, gate-free, client-side prescription (the
// server prehab engine, bbf-agentic-prehab, is tier-gated ABOVE the youth band, so
// it would 403 a youth athlete — we keep this instant + entitlement-free instead).
//
// Each movement `id` maps into the recovery video catalog (data/recoveryVideos.js)
// so every card carries a trilingual demo, exactly like youthRecoveryPrep.js. Keys
// are session_feedback.target_area values, so the Post-Game Check zone routes here
// directly. Movements are deliberately gentle + youth-safe (no loaded lumbar
// flexion for a sore back, etc.). MAX 3 per zone — never grow these past 3.

// target_area → trilingual zone label (the Post-Game Check writes these areas).
export const ZONE_LABEL = {
  knee: { en: 'Knees', es: 'Rodillas', pt: 'Joelhos' },
  shoulder: { en: 'Shoulders', es: 'Hombros', pt: 'Ombros' },
  lower_body: { en: 'Lower Back', es: 'Espalda Baja', pt: 'Lombar' },
};

export const YOUTH_PREHAB_RX = {
  knee: [
    {
      id: 'dyn_quad_002', name: 'Reverse Lunge with Reach',
      dose: { en: '2 × 8 / side', es: '2 × 8 / lado', pt: '2 × 8 / lado' },
      why: {
        en: 'Fires up the quad and hip so your knee tracks straight under load.',
        es: 'Activa el cuádriceps y la cadera para que la rodilla quede alineada bajo carga.',
        pt: 'Ativa o quadríceps e o quadril para o joelho alinhar sob carga.',
      },
    },
    {
      id: 'stat_ham_001', name: 'Seated Forward Fold',
      dose: { en: 'Hold 30s × 2', es: 'Mantén 30s × 2', pt: 'Segure 30s × 2' },
      why: {
        en: 'Loosens tight hamstrings that pull on the back of the knee.',
        es: 'Afloja los isquiotibiales tensos que tiran detrás de la rodilla.',
        pt: 'Solta os posteriores tensos que puxam atrás do joelho.',
      },
    },
    {
      id: 'roll_quad_001', name: 'Quad Roll',
      dose: { en: '30s / leg', es: '30s / pierna', pt: '30s / perna' },
      why: {
        en: 'Rolls out the quad so it stops yanking on the kneecap.',
        es: 'Libera el cuádriceps para que deje de jalar la rótula.',
        pt: 'Libera o quadríceps para parar de puxar a patela.',
      },
    },
  ],
  shoulder: [
    {
      id: 'dyn_sho_001', name: 'Arm Circles',
      dose: { en: '10 each way', es: '10 cada lado', pt: '10 cada lado' },
      why: {
        en: 'Wakes up the shoulder and pumps fresh blood into the joint.',
        es: 'Despierta el hombro y bombea sangre fresca a la articulación.',
        pt: 'Acorda o ombro e bombeia sangue novo na articulação.',
      },
    },
    {
      id: 'stat_chest_001', name: 'Wall Pec Stretch',
      dose: { en: 'Hold 30s / side', es: 'Mantén 30s / lado', pt: 'Segure 30s / lado' },
      why: {
        en: 'Opens a tight chest that rounds the shoulder forward.',
        es: 'Abre el pecho tenso que redondea el hombro hacia adelante.',
        pt: 'Abre o peito tenso que arredonda o ombro pra frente.',
      },
    },
    {
      id: 'roll_uback_001', name: 'Thoracic (Upper-Back) Roll',
      dose: { en: '30s', es: '30s', pt: '30s' },
      why: {
        en: 'Frees the upper back so the shoulder can move clean and pain-free.',
        es: 'Libera la espalda alta para que el hombro se mueva limpio y sin dolor.',
        pt: 'Libera a parte alta das costas para o ombro mover limpo e sem dor.',
      },
    },
  ],
  lower_body: [
    {
      id: 'dyn_lback_002', name: "World's Greatest Stretch",
      dose: { en: '4 / side', es: '4 / lado', pt: '4 / lado' },
      why: {
        en: 'Opens the hips and back together — the all-in-one reset.',
        es: 'Abre la cadera y la espalda juntas — el reinicio todo-en-uno.',
        pt: 'Abre o quadril e as costas juntos — o reset tudo-em-um.',
      },
    },
    {
      id: 'stat_uback_001', name: "Child's Pose Reach",
      dose: { en: 'Hold 45s', es: 'Mantén 45s', pt: 'Segure 45s' },
      why: {
        en: 'Decompresses the spine and lets a tight low back breathe.',
        es: 'Descomprime la columna y deja respirar la espalda baja tensa.',
        pt: 'Descomprime a coluna e deixa a lombar tensa respirar.',
      },
    },
    {
      id: 'roll_glute_001', name: 'Glute / Piriformis Release',
      dose: { en: '30s / side', es: '30s / lado', pt: '30s / lado' },
      why: {
        en: 'Releases tight glutes that lock up and overload the lower back.',
        es: 'Libera los glúteos tensos que bloquean y sobrecargan la espalda baja.',
        pt: 'Libera os glúteos tensos que travam e sobrecarregam a lombar.',
      },
    },
  ],
};
