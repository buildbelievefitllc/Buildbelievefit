// src/lib/supabaseClient.js
// ─────────────────────────────────────────────────────────────────────────────
// Phase 2 — Core wiring. Single shared Supabase browser client for the BBF app.
//
// STRICT env-driven config: the URL and anon/publishable key come ONLY from Vite
// environment variables (see .env.example). No hardcoded project values live in
// source. The anon key is safe to ship in the client bundle — Row Level Security
// is the real boundary, and privileged admin reads (e.g. the Client Hub roster)
// continue to go through the token-gated `bbf-admin-roster` edge function.

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail loud in any runtime that loads this without env configured.
  console.warn(
    '[supabaseClient] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — ' +
      'copy frontend/.env.example to frontend/.env and set them before data/auth calls.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export default supabase;
