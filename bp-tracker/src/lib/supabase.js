import { createClient } from '@supabase/supabase-js'

// Vite inlines VITE_* at build time. The publishable anon key is safe in the
// client bundle — RLS is the real boundary (see repo render.yaml note).
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Fail loud in dev, but do not crash the app shell in prod.
  console.error(
    '[bp-tracker] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. ' +
      'Set them in the Render dashboard (or bp-tracker/.env.local for dev).',
  )
}

export const supabase = createClient(url ?? '', anonKey ?? '', {
  auth: { persistSession: false },
})

export const SUPABASE_URL = url ?? ''
