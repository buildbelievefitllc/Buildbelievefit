// src/lib/sovereignSystemGuides.js
// ─────────────────────────────────────────────────────────────────────────────
// SOVEREIGN SYSTEM GUIDES — canonical registry for the 9:16 portrait tutorial suite
// (BBF Lab mobile). One entry per system step; each streams from Supabase Storage
// and is opened by <GuideLauncher> → <BbfMediaPortal>.
//
// Schema per entry:
//   id       – stable analytics/QA key
//   title    – on-portal heading (string; the portal also accepts an {en,es,pt} map)
//   url       – public CDN object (Watch streams the video; Listen streams its audio)
//   feature  – entitlement key that must unlock playback (TierGate); Baseline `grid`
//              = every active paid tier.
//   ready    – true once the object is LIVE in the bucket. Launchers mount a guide
//              only when ready===true, so an un-produced guide can never 404 the UI.
//
// CDN: public `videos` bucket, folder `guides`; project ref from VITE_SUPABASE_URL.
// ASSET STATUS: all 8 masters are LIVE (ffmpeg crf24/2M, 2.5–9.6MB, public HEAD → 206).
// The `intro` entry maps to the `welcome` upload (BBF_WELCOME_PAGE).

const SUPABASE_ORIGIN = import.meta.env.VITE_SUPABASE_URL || 'https://ihclbceghxpuawymlvgi.supabase.co';
const SUPABASE_CDN_BASE = `${SUPABASE_ORIGIN}/storage/v1/object/public/videos/guides`;
// Elite ElevenLabs voice-clone (Coach Akeem) walkthrough masters — compressed
// (libx264 High@4.1, CRF 28/25fps, +faststart, ~2–7 MB) and served from the public
// `videos/tutorials/` bucket. The topic-matched guide entries below now stream these.
const SUPABASE_TUTORIALS_BASE = `${SUPABASE_ORIGIN}/storage/v1/object/public/videos/tutorials`;

export const SOVEREIGN_SYSTEM_GUIDES = {
  intro: {
    id: 'bbf_intro_protocol',
    title: "Today's Protocol Overview",
    url: `${SUPABASE_TUTORIALS_BASE}/bbf_app_welcome_intro.mp4`,
    feature: 'grid',
    ready: true,
  },
  check_in: {
    id: 'bbf_data_capture',
    title: 'Step 1: Data Capture & Readiness',
    url: `${SUPABASE_TUTORIALS_BASE}/bbf_step1_loopbreak.mp4`,
    feature: 'grid',
    ready: true,
  },
  tissue_priming: {
    id: 'bbf_tissue_priming',
    title: 'Step 2: Tissue Priming & Mobilization',
    url: `${SUPABASE_CDN_BASE}/bbf_app_vault_step2_priming_916.mp4`,
    feature: 'prehab',
    ready: true,
  },
  program_execution: {
    id: 'bbf_program_execution',
    title: 'Step 3: Progressive Overload Execution',
    url: `${SUPABASE_TUTORIALS_BASE}/bbf_tour_program.mp4`,
    feature: 'grid',
    ready: true,
  },
  system_flush: {
    id: 'bbf_system_flush',
    title: 'Step 4: Smart Cardio System Flush',
    url: `${SUPABASE_TUTORIALS_BASE}/bbf_tour_cardio.mp4`,
    feature: 'smart_cardio',
    ready: true,
  },
  nutrition_locker: {
    id: 'bbf_nutrition_locker',
    title: 'Fuel Targets & Fasting Architecture',
    url: `${SUPABASE_TUTORIALS_BASE}/bbf_tour_nutrition.mp4`,
    feature: 'base_nutrition',
    ready: true,
  },
  prehab_diagnostic: {
    id: 'bbf_prehab_diagnostic',
    title: 'Autonomous Joint Symptom Diagnostic',
    url: `${SUPABASE_TUTORIALS_BASE}/bbf_tour_prehab.mp4`,
    feature: 'prehab',
    ready: true,
  },
  champion_mindset: {
    id: 'bbf_champion_mindset',
    title: 'The Sovereign Frequency & Identity',
    url: `${SUPABASE_TUTORIALS_BASE}/bbf_tour_mindset.mp4`,
    feature: 'grid',
    ready: true,
  },
  // Newly linked elite-voice masters (previously uploaded but unmapped). Standard
  // registry schema so <GuideLauncher module="masterclass_overview" /> resolves them
  // like any other key; unreferenced keys are inert (no default view mounts them).
  masterclass_overview: {
    id: 'bbf_masterclass_overview',
    title: 'Product Tour Masterclass',
    url: `${SUPABASE_TUTORIALS_BASE}/bbf_tour_masterclass.mp4`,
    feature: 'grid',
    ready: true,
  },
  behavioral_reset: {
    id: 'bbf_behavioral_reset',
    title: 'Behavioral Reset — Break the Cycle',
    url: `${SUPABASE_TUTORIALS_BASE}/bbf_step2_breakcycle.mp4`,
    feature: 'grid',
    ready: true,
  },
};

export default SOVEREIGN_SYSTEM_GUIDES;
