// Dev-only stub · production deploy serves the real /env.js from the
// repo root via the .github/workflows/pages.yml rsync staging step.
// Vite dev server (`npm run dev`) treats vault/public/* as if at /, so
// this file is what /env.js resolves to during `npm run dev`.
//
// To exercise live data locally, paste the canonical publishable values
// (these are sb_publishable_* · ARCHITECTURE.md §6.3 confirms they are
// the intended browser surface and have zero service-role privilege).
window.ENV_SUPABASE_URL = 'https://ihclbceghxpuawymlvgi.supabase.co';
window.ENV_SUPABASE_KEY = '';
