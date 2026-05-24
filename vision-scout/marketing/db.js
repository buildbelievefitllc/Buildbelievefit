// Supabase service-role client · bypasses RLS. Only the marketing
// worker layer talks to bbf_outbound_athletes; no client-side reads.
//
// LAZY INIT · client built at module load when the service-role key is
// present, rebuilt on demand at request time if the boot attempt found
// no key (the "env added after process start" failure mode). Importers
// get a LIVE binding via `export { _sb as sb }`.
//
// CREATECLIENT FAILURE CAPTURE · the createClient error message is
// recorded in _lastBuildError and surfaced via sbBuildError() so the
// /health snapshot can show it · saves the operator a Render log dive.
//
// REALTIME CONFIG FALLBACK · attempts the CEO-requested realtime
// override first; on construction failure (wrong shape for this
// supabase-js version, etc.) falls back to default options. We never
// call .channel().subscribe() so the Realtime client is constructed
// but never opens a WebSocket; the override was prophylactic, not
// load-bearing.
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ihclbceghxpuawymlvgi.supabase.co';

export const TABLE = 'bbf_outbound_athletes';

let _sb              = null;
let _builtAt         = null;
let _bootKeyPresent  = false;
let _lastBuildError  = null;
let _usedFallback    = false;

function tryCreate(opts, label) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!key) {
    _lastBuildError = 'no_service_role_key_in_env';
    return null;
  }
  try {
    return createClient(SUPABASE_URL, key, opts);
  } catch (err) {
    const msg = err?.message || String(err);
    _lastBuildError = `[${label}] ${msg}`;
    console.error(`[marketing/db] createClient ${label} threw:`, msg);
    return null;
  }
}

function buildClient() {
  _lastBuildError = null;
  _usedFallback   = false;

  // Path A · CEO-requested realtime override + ws transport.
  // The `ws` transport is REQUIRED · supabase-js@2.45+ rejects
  // construction on Node 20 without a WebSocket implementation.
  const withOverride = tryCreate({
    auth:     { persistSession: false },
    realtime: {
      transport: ws,
      config:    { broadcast: { self: false }, presence: { key: '' } },
    },
  }, 'with_realtime_override');
  if (withOverride) return withOverride;

  // Path B · fallback · transport only, no extra config.
  const fallback = tryCreate({
    auth:     { persistSession: false },
    realtime: { transport: ws },
  }, 'default_options_fallback');
  if (fallback) {
    _usedFallback = true;
    console.warn('[marketing/db] using default-options fallback · last_error:', _lastBuildError);
    return fallback;
  }

  return null;
}

// Boot-time attempt
_bootKeyPresent = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
if (_bootKeyPresent) {
  _sb = buildClient();
  if (_sb) {
    _builtAt = new Date().toISOString();
    console.log('[marketing/db] Supabase client ready · url=' + SUPABASE_URL + ' · built_at=' + _builtAt + ' · fallback=' + _usedFallback);
  } else {
    console.warn('[marketing/db] boot · all build paths failed · last_error:', _lastBuildError);
  }
} else {
  console.warn('[marketing/db] boot · SUPABASE_SERVICE_ROLE_KEY unset · will lazy-retry on first request');
}

export function getSb() {
  if (_sb) return _sb;
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    _sb = buildClient();
    if (_sb) {
      _builtAt = new Date().toISOString();
      console.log('[marketing/db] lazy re-init succeeded · built_at=' + _builtAt + ' · fallback=' + _usedFallback);
    }
  }
  return _sb;
}

export function isSbBuilt()        { return !!_sb; }
export function sbBootKeyPresent() { return _bootKeyPresent; }
export function sbBuiltAt()        { return _builtAt; }
export function sbBuildError()     { return _lastBuildError; }
export function sbUsedFallback()   { return _usedFallback; }

export function requireSb(res) {
  const client = getSb();
  if (client) return true;
  if (!res.headersSent) {
    res.status(503).json({
      ok:     false,
      error:  'supabase_unconfigured',
      detail: 'createClient() never succeeded · see diag.build_error for the underlying exception.',
      diag: {
        boot_key_present: _bootKeyPresent,
        req_key_present:  !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        sb_client_built:  !!_sb,
        used_fallback:    _usedFallback,
        build_error:      _lastBuildError,
      },
    });
  }
  return false;
}

export { _sb as sb };
