// src/lib/sovereignSystemGuides.js
// ─────────────────────────────────────────────────────────────────────────────
// SOVEREIGN SYSTEM GUIDES — the canonical catalog for the 9:16 portrait tutorial
// suite (BBF Lab mobile). One entry per system step; consumed by GuideLauncher /
// BbfMediaPortal to open the dual-media portal.
//
// ARCHITECTURE NOTE (reconciled with the CDN migration): the guides stream from
// Supabase Storage (public bucket `bbf-media-vault/guides`), NOT from a local
// `/assets/videos/guides/…` path — that would re-bloat the repo and Render deploy
// the migration just eliminated. The `path` the spec supplied is preserved as the
// bucket object key (filename); the origin is prefixed here from VITE_SUPABASE_URL.
//
// ASSET STATUS: the portrait `*_916.mp4` masters have NOT yet been produced/uploaded.
// Each entry carries `ready` — flip it to true once its object exists in the bucket
// (verify with a public HEAD → 206). Launchers only mount a guide when ready===true,
// so an un-produced guide can never render a dead 404 in the UI.

const SUPABASE_ORIGIN = import.meta.env.VITE_SUPABASE_URL || 'https://ihclbceghxpuawymlvgi.supabase.co';
const GUIDES_BASE = `${SUPABASE_ORIGIN}/storage/v1/object/public/bbf-media-vault/guides`;

// Bucket object key (the filename the spec specified under /assets/videos/guides/).
const asset = (file) => `${GUIDES_BASE}/${file}`;

export const SOVEREIGN_SYSTEM_GUIDES = {
  intro: {
    id: 'bbf_intro_protocol',
    title: "Today's Protocol Overview",
    path: asset('bbf_product_tour_masterclass_916.mp4'),
    ready: false,
  },
  check_in: {
    id: 'bbf_data_capture',
    title: 'Step 1: Data Capture & Readiness',
    path: asset('bbf_app_guide_check_in_916.mp4'),
    ready: false,
  },
  tissue_priming: {
    id: 'bbf_tissue_priming',
    title: 'Step 2: Tissue Priming & Mobilization',
    path: asset('bbf_app_guide_tissue_priming_916.mp4'),
    ready: false,
  },
  program_execution: {
    id: 'bbf_program_execution',
    title: 'Step 3: Progressive Overload Execution',
    path: asset('bbf_app_guide_program_916.mp4'),
    ready: false,
  },
  system_flush: {
    id: 'bbf_system_flush',
    title: 'Step 4: Smart Cardio System Flush',
    path: asset('bbf_app_guide_system_flush_916.mp4'),
    ready: false,
  },
  nutrition_locker: {
    id: 'bbf_nutrition_locker',
    title: 'Fuel Targets & Fasting Architecture',
    path: asset('bbf_app_guide_nutrition_916.mp4'),
    ready: false,
  },
  prehab_diagnostic: {
    id: 'bbf_prehab_diagnostic',
    title: 'Autonomous Joint Symptom Diagnostic',
    path: asset('bbf_app_guide_prehab_diagnostic_916.mp4'),
    ready: false,
  },
  champion_mindset: {
    id: 'bbf_champion_mindset',
    title: 'The Sovereign Frequency & Identity',
    path: asset('bbf_app_guide_champion_mindset_916.mp4'),
    ready: false,
  },
};

export default SOVEREIGN_SYSTEM_GUIDES;
