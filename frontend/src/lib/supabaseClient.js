// src/lib/supabaseClient.js
// ─────────────────────────────────────────────────────────────────────────────
// Single shared Supabase browser client for the BBF React app.
//
// Config comes from Vite env vars (see .env.example). The PUBLISHABLE/anon key
// is safe to ship in the client bundle — Row Level Security is the real boundary.
// Privileged reads (e.g. the admin Client Hub) continue to go through the
// token-gated `bbf-admin-roster` edge function, NEVER via the anon key directly.
//
// Phase 1 (scaffolding) note: this module only constructs the client. No data
// access is wired yet — that arrives with the page/component port in later phases.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://ihclbceghxpuawymlvgi.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_ANON_KEY) {
  // Surfaced loudly in dev; in prod the build pipeline must inject the key.
  console.warn(
    '[supabaseClient] VITE_SUPABASE_ANON_KEY is empty — set it in frontend/.env before data calls.'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});

export default supabase;
