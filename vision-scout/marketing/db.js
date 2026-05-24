// Supabase service-role client · bypasses RLS. Only the marketing
// worker layer talks to bbf_outbound_athletes; no client-side reads.
//
// LAZY INIT · the client is built only when the service-role key is
// actually present at boot. Without it, `sb` is null, the marketing
// routes return 503 supabase_unconfigured, and the rest of the Express
// server (vision-scout /scan, /smoke-test, /health) still starts.
//
// REALTIME OVERRIDE · explicitly pass the realtime config so the
// internal Realtime client never spins up a WebSocket handshake at
// boot (suppresses Node 20 WS noise and prevents init-time crashes).
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL              = process.env.SUPABASE_URL || 'https://ihclbceghxpuawymlvgi.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const TABLE = 'bbf_outbound_athletes';

let _sb = null;
if (SUPABASE_SERVICE_ROLE_KEY) {
  try {
    _sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth:     { persistSession: false },
      realtime: { config: { broadcast: { self: false }, presence: { key: '' } } },
    });
    console.log('[marketing/db] Supabase client ready · url=' + SUPABASE_URL);
  } catch (err) {
    console.error('[marketing/db] createClient threw · marketing routes will 503:', err?.message);
    _sb = null;
  }
} else {
  console.warn('[marketing/db] SUPABASE_SERVICE_ROLE_KEY unset · marketing routes will 503 supabase_unconfigured · server still boots');
}

export const sb = _sb;

// Guard · every agent calls this before touching `sb`. Sends a 503
// with a precise reason so the operator can fix it without log-diving.
export function requireSb(res) {
  if (sb) return true;
  if (!res.headersSent) {
    res.status(503).json({
      ok:     false,
      error:  'supabase_unconfigured',
      detail: 'SUPABASE_SERVICE_ROLE_KEY was not resolved at marketing module init. Set it in Render env and redeploy.',
    });
  }
  return false;
}
