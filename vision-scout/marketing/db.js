// Supabase service-role client · bypasses RLS. Only the marketing
// worker layer talks to bbf_outbound_athletes; no client-side reads.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL              = process.env.SUPABASE_URL || 'https://ihclbceghxpuawymlvgi.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[marketing/db] WARN · SUPABASE_SERVICE_ROLE_KEY unset · marketing routes will 500');
}

export const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || 'missing', {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const TABLE = 'bbf_outbound_athletes';
