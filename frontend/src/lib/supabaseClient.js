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

// Edge-function base + anon key for privileged, token-gated calls (e.g. the
// Client Hub roster via bbf-admin-roster). The anon/publishable key is REQUIRED
// by the Supabase gateway to route ANY request to a function — even one with
// verify_jwt:false — so it must ride along on every call; the real authorization
// is the X-BBF-Admin-Token the caller adds on top. Centralised here so components
// never hardcode project URLs or keys.
export const SUPABASE_ANON_KEY = supabaseAnonKey;
export const FUNCTIONS_BASE = `${(supabaseUrl || '').replace(/\/$/, '')}/functions/v1`;

export default supabase;
