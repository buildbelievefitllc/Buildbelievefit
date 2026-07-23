import { createClient } from '@supabase/supabase-js'

// Vite inlines VITE_* at build time. The publishable anon key is safe in the
// client bundle — RLS is the real boundary (see repo render.yaml note).
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const hasSupabaseConfig = Boolean(url && anonKey)

if (!hasSupabaseConfig) {
  console.error(
    '[bp-tracker] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. ' +
      'Set them in the Render dashboard (Environment) and redeploy — Vite bakes ' +
      'these in at BUILD time, so a rebuild is required after setting them.',
  )
}

// Construct the client ONLY when both values exist. createClient throws
// "supabaseKey is required" on an empty key, which would crash the whole app
// to a blank screen. When config is missing we export null and App renders a
// friendly setup notice instead of dying.
export const supabase = hasSupabaseConfig
  ? createClient(url, anonKey, { auth: { persistSession: false } })
  : null

export const SUPABASE_URL = url ?? ''
