// Supabase service-role client · bypasses RLS. Only the marketing
// worker layer talks to bbf_outbound_athletes; no client-side reads.
//
// LAZY INIT · the client is built at module load when the service-role
// key is present, and rebuilt on demand at request time if the boot
// attempt found no key (the "env added after process start" failure
// mode). Once built, the cached client is reused forever (until next
// restart). Importers get a LIVE binding via `export { _sb as sb }`
// so a post-boot rebuild is visible without re-importing.
//
// REALTIME OVERRIDE · explicitly pass the realtime config so the
// internal Realtime client never spins up a WebSocket handshake at
// boot (suppresses Node 20 WS noise and prevents init-time crashes).
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ihclbceghxpuawymlvgi.supabase.co';

export const TABLE = 'bbf_outbound_athletes';

let _sb       = null;
let _builtAt  = null;          // when the client was first built
let _bootKeyPresent = false;   // snapshot of env state at module load · for /health diagnostics

function buildClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!key) return null;
  try {
    const c = createClient(SUPABASE_URL, key, {
      auth:     { persistSession: false },
      realtime: { config: { broadcast: { self: false }, presence: { key: '' } } },
    });
    return c;
  } catch (err) {
    console.error('[marketing/db] createClient threw:', err?.message);
    return null;
  }
}

// Boot-time attempt
_bootKeyPresent = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
if (_bootKeyPresent) {
  _sb = buildClient();
  if (_sb) {
    _builtAt = new Date().toISOString();
    console.log('[marketing/db] Supabase client ready · url=' + SUPABASE_URL + ' · built_at=' + _builtAt);
  } else {
    console.warn('[marketing/db] boot · key present but createClient failed · will retry on first request');
  }
} else {
  console.warn('[marketing/db] boot · SUPABASE_SERVICE_ROLE_KEY unset · will lazy-retry on first request');
}

// getSb · returns the cached client OR attempts a fresh build from
// current process.env. Recovers from "env added after boot" without
// requiring a process restart.
export function getSb() {
  if (_sb) return _sb;
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    _sb = buildClient();
    if (_sb) {
      _builtAt = new Date().toISOString();
      console.log('[marketing/db] lazy re-init succeeded · built_at=' + _builtAt);
    } else {
      console.warn('[marketing/db] lazy re-init failed · createClient returned null');
    }
  }
  return _sb;
}

// Diagnostic accessors · powered by /health to surface the boot-time
// vs request-time env mismatch (the "key set true but client null"
// footgun that bit us once).
export function isSbBuilt()      { return !!_sb; }
export function sbBootKeyPresent() { return _bootKeyPresent; }
export function sbBuiltAt()      { return _builtAt; }

// Guard · every agent calls this before touching the live binding.
// Triggers a lazy re-init attempt as a side effect. 503s with a
// precise reason so the operator can fix it without log-diving.
export function requireSb(res) {
  const client = getSb();
  if (client) return true;
  if (!res.headersSent) {
    res.status(503).json({
      ok:     false,
      error:  'supabase_unconfigured',
      detail: 'SUPABASE_SERVICE_ROLE_KEY missing at boot AND at request-time retry. Set in Render env and restart the service.',
      diag: {
        boot_key_present: _bootKeyPresent,
        req_key_present:  !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        sb_client_built:  !!_sb,
      },
    });
  }
  return false;
}

// Live binding · importers see post-init updates without re-importing.
export { _sb as sb };
