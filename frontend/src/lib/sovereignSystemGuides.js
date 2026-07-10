// src/lib/sovereignSystemGuides.js
// ─────────────────────────────────────────────────────────────────────────────
// SOVEREIGN SYSTEM GUIDES — canonical catalog for the 9:16 portrait tutorial suite
// (BBF Lab mobile). One entry per system step; each streams from Supabase Storage.
//
// CDN: the public `videos` bucket (created + confirmed public), folder `guides`. The
// project ref is derived from VITE_SUPABASE_URL so it tracks the active project across
// environments, falling back to the canonical BBF project origin.
//
// ASSET STATUS: the `bbf_app_vault_*_916.mp4` portrait masters are NOT yet produced /
// uploaded — the bucket + folder exist, the objects do not. These entries are forward
// config (not yet wired to a live launcher), so no dead 404 can reach the UI. Once a
// master is produced, compress <50MB and upload to videos/guides/<filename>, then wire
// its launcher.

const SUPABASE_ORIGIN = import.meta.env.VITE_SUPABASE_URL || 'https://ihclbceghxpuawymlvgi.supabase.co';
const SUPABASE_CDN_BASE = `${SUPABASE_ORIGIN}/storage/v1/object/public/videos/guides`;

export const SOVEREIGN_SYSTEM_GUIDES = {
  intro: {
    id: 'bbf_intro_protocol',
    title: "Today's Protocol Overview",
    url: `${SUPABASE_CDN_BASE}/bbf_app_vault_intro_916.mp4`,
  },
  check_in: {
    id: 'bbf_data_capture',
    title: 'Step 1: Data Capture & Readiness',
    url: `${SUPABASE_CDN_BASE}/bbf_app_vault_step1_checkin_916.mp4`,
  },
  tissue_priming: {
    id: 'bbf_tissue_priming',
    title: 'Step 2: Tissue Priming & Mobilization',
    url: `${SUPABASE_CDN_BASE}/bbf_app_vault_step2_priming_916.mp4`,
  },
  program_execution: {
    id: 'bbf_program_execution',
    title: 'Step 3: Progressive Overload Execution',
    url: `${SUPABASE_CDN_BASE}/bbf_app_vault_step3_program_916.mp4`,
  },
  system_flush: {
    id: 'bbf_system_flush',
    title: 'Step 4: Smart Cardio System Flush',
    url: `${SUPABASE_CDN_BASE}/bbf_app_vault_step4_flush_916.mp4`,
  },
  nutrition_locker: {
    id: 'bbf_nutrition_locker',
    title: 'Fuel Targets & Fasting Architecture',
    url: `${SUPABASE_CDN_BASE}/bbf_app_vault_nutrition_916.mp4`,
  },
  prehab_diagnostic: {
    id: 'bbf_prehab_diagnostic',
    title: 'Autonomous Joint Symptom Diagnostic',
    url: `${SUPABASE_CDN_BASE}/bbf_app_vault_prehab_916.mp4`,
  },
  champion_mindset: {
    id: 'bbf_champion_mindset',
    title: 'The Sovereign Frequency & Identity',
    url: `${SUPABASE_CDN_BASE}/bbf_app_vault_mindset_916.mp4`,
  },
};

export default SOVEREIGN_SYSTEM_GUIDES;
