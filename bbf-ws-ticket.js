// ═══════════════════════════════════════════════════════════════
// BBF VAULT — Phase 16 Iron Vault V2 — WS ticket helper
// ═══════════════════════════════════════════════════════════════
// One-shot signed URL pattern. Frontend POSTs uid to /api/auth/ws-ticket;
// server validates trial/subscription state and mints a short-lived
// HMAC-SHA256 ticket. Frontend appends ?ticket=... to the WebSocket
// URL when opening /ws/phantom-eye. Server's upgrade handler verifies
// the ticket (HMAC + expiry + replay) before completing the handshake.
//
// No Supabase Auth, no long-lived bearer tokens. Tickets live 60 seconds
// and are single-use within their window. Secret lives in BBF_WS_TICKET_SECRET
// on Render — never reaches the client.
// ═══════════════════════════════════════════════════════════════

const crypto = require('crypto');

const TICKET_TTL_MS = 60 * 1000;

function _b64url(input) {
  return Buffer.from(input).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function _hmac(secret, msg) {
  return crypto.createHmac('sha256', secret).update(msg).digest('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function mintTicket(uid, secret) {
  if (!uid || !secret) throw new Error('mintTicket requires uid + secret');
  const exp = Date.now() + TICKET_TTL_MS;
  const nonce = crypto.randomUUID();
  const payload = _b64url(uid) + '.' + exp + '.' + nonce;
  const sig = _hmac(secret, payload);
  return { ticket: payload + '.' + sig, exp };
}

// In-memory consumed-nonce set with TTL. The proxy is single-process
// per Render instance; if BBF ever scales to multiple instances this
// becomes a race condition (replay across instances) and should move
// to Redis. For now: fine.
const _consumedNonces = new Map();

function _gcConsumedNonces(now) {
  for (const [nonce, expiresAt] of _consumedNonces) {
    if (expiresAt < now) _consumedNonces.delete(nonce);
  }
}

// Returns { ok: true, uid } on success or { ok: false, reason } on failure.
// Marks nonce consumed atomically — caller must NOT pass the same ticket twice.
function verifyTicket(token, secret) {
  if (!token || !secret) return { ok: false, reason: 'missing_token_or_secret' };
  const parts = String(token).split('.');
  if (parts.length !== 4) return { ok: false, reason: 'malformed' };
  const [uidB64, expStr, nonce, sig] = parts;
  const exp = Number(expStr);
  if (!Number.isFinite(exp)) return { ok: false, reason: 'malformed_exp' };
  const now = Date.now();
  if (exp < now) return { ok: false, reason: 'expired' };
  const expectedSig = _hmac(secret, uidB64 + '.' + expStr + '.' + nonce);
  // Constant-time compare so timing leaks don't help an attacker guess.
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: 'bad_signature' };
  }
  if (_consumedNonces.has(nonce)) return { ok: false, reason: 'replay' };
  _consumedNonces.set(nonce, exp);
  if (_consumedNonces.size > 4096) _gcConsumedNonces(now);
  let uid;
  try {
    uid = Buffer.from(uidB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  } catch (_) {
    return { ok: false, reason: 'malformed_uid' };
  }
  return { ok: true, uid };
}

module.exports = { mintTicket, verifyTicket, TICKET_TTL_MS };
