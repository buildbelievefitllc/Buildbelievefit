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

// LAST-RESORT fallbacks (App Store 2.1): `createClient(undefined, undefined)`
// throws at module load, and because this module is imported by a root provider
// that throw boots the Capacitor WebView to a blank screen before first paint.
// These publishable values mirror the committed `.env.production` (safe in the
// bundle BY DESIGN — RLS is the real boundary) so a build that somehow ran
// without env config still boots instead of bricking. Env always wins when set.
const FALLBACK_SUPABASE_URL = 'https://ihclbceghxpuawymlvgi.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImloY2xiY2VnaHhwdWF3eW1sdmdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyOTk1MDIsImV4cCI6MjA5MTg3NTUwMn0.0f7d1aqtygMR__QiyYYUB87yrFLaSRihVQdiFaIhsP0';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || FALLBACK_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY;

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  // Fail loud in any runtime that loads this without env configured.
  console.warn(
    '[supabaseClient] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — ' +
      'running on the committed publishable fallbacks. Copy frontend/.env.example ' +
      'to frontend/.env and set them to silence this.'
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
