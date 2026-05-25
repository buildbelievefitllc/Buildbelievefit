// Svix webhook signature verifier · Phase 1.3.
// Resend uses the Svix signing scheme for outbound webhooks
// (https://docs.svix.com/receiving/verifying-payloads/how-manual).
//
// SIGNATURE FORMAT
//   Header svix-signature: "v1,<base64-sig> v1,<base64-sig2> ..."
//     · space-separated list so Svix can rotate keys without breaking
//       existing deployments
//     · only the v1 scheme is defined today; future schemes are tolerated
//   Signed content:  `${svix_id}.${svix_timestamp}.${rawBody}`
//   Signature:       base64( HMAC-SHA256(secret, signedContent) )
//
// SECRET FORMAT
//   Resend hands you the secret prefixed `whsec_<base64...>`. The HMAC
//   key is the base64-decoded bytes AFTER the prefix. If the env var
//   doesn't have the prefix we treat the whole value as base64 (Svix's
//   docs hint that some self-hosted setups omit it).
//
// REPLAY DEFENSE
//   svix-timestamp is seconds-since-epoch. We reject anything more than
//   ±5 minutes out of tolerance. Resend retries can happen up to days
//   later in theory but the timestamp moves with each retry, so this
//   ceiling rejects intercept-and-replay attacks without breaking
//   legitimate retries.
//
// CONSTANT-TIME COMPARE
//   crypto.timingSafeEqual is the final compare · we length-check first
//   so a wrong-length signature doesn't throw and turn into a 500.
import crypto from 'node:crypto';

const SCHEME = 'v1';
export const DEFAULT_TOLERANCE_SEC = 300; // ±5 minutes

function parseSecret(secret) {
  if (!secret || typeof secret !== 'string') return null;
  const raw = secret.startsWith('whsec_') ? secret.slice(6) : secret;
  try {
    const buf = Buffer.from(raw, 'base64');
    if (!buf.length) return null;
    return buf;
  } catch {
    return null;
  }
}

// Returns { ok: true } on success, { ok: false, error: '<slug>' } on
// every failure mode the caller might want to surface.
export function verifySvixSignature({ id, timestamp, signature, rawBody, secret, toleranceSec = DEFAULT_TOLERANCE_SEC }) {
  if (!id || typeof id !== 'string') {
    return { ok: false, error: 'missing_svix_id' };
  }
  if (!timestamp || typeof timestamp !== 'string') {
    return { ok: false, error: 'missing_svix_timestamp' };
  }
  if (!signature || typeof signature !== 'string') {
    return { ok: false, error: 'missing_svix_signature' };
  }
  if (!rawBody || !Buffer.isBuffer(rawBody)) {
    return { ok: false, error: 'missing_raw_body' };
  }

  const tsNum = Number(timestamp);
  if (!Number.isFinite(tsNum)) {
    return { ok: false, error: 'invalid_timestamp' };
  }
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - tsNum) > toleranceSec) {
    return { ok: false, error: 'timestamp_out_of_tolerance' };
  }

  const secretBuf = parseSecret(secret);
  if (!secretBuf) {
    return { ok: false, error: 'invalid_secret_config' };
  }

  const signedContent = `${id}.${timestamp}.${rawBody.toString('utf8')}`;
  const expected = crypto
    .createHmac('sha256', secretBuf)
    .update(signedContent)
    .digest();

  // Header carries space-separated <scheme>,<base64sig> entries.
  // Compare against EVERY v1 entry · accept the first that matches.
  const entries = signature.split(' ').filter(Boolean);
  for (const entry of entries) {
    const commaIdx = entry.indexOf(',');
    if (commaIdx < 1) continue;
    const scheme = entry.slice(0, commaIdx);
    const sigB64 = entry.slice(commaIdx + 1);
    if (scheme !== SCHEME) continue; // forward-compat: ignore unknown schemes
    let candidate;
    try { candidate = Buffer.from(sigB64, 'base64'); }
    catch { continue; }
    if (candidate.length !== expected.length) continue;
    try {
      if (crypto.timingSafeEqual(candidate, expected)) {
        return { ok: true };
      }
    } catch {
      // length-mismatch defense (already filtered above) · fall through.
    }
  }
  return { ok: false, error: 'signature_mismatch' };
}

// True iff the env var looks like a usable Resend / Svix secret.
// Used at boot + /health to distinguish "secret not set" (config gap,
// 503) from "secret set but wrong" (auth failure, 401).
export function isResendWebhookSecretConfigured() {
  return parseSecret(process.env.RESEND_WEBHOOK_SECRET) !== null;
}
