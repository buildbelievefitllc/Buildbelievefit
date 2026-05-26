// ═══════════════════════════════════════════════════════════════════════
// Phase 6.0f · End-to-end smoke test for the Phase 1.3 Svix HMAC gate.
//
// Exercises every documented failure path of verifySvixSignature() plus
// the happy path · simulates an external payment / delivery webhook with
// a known secret + payload + timestamp, computes the expected HMAC, then
// asserts that:
//   - a correctly-signed payload PASSES,
//   - an unsigned payload is REJECTED,
//   - a tampered body is REJECTED,
//   - a stale timestamp is REJECTED,
//   - missing headers are REJECTED,
//   - the multi-signature key-rotation case PASSES on any matching v1,
//   - unknown future schemes are tolerated without crashing.
// ═══════════════════════════════════════════════════════════════════════

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import { verifySvixSignature } from '../marketing/svix-verify.js';

// Deterministic test secret · base64(randomBytes(24)) prefixed with whsec_.
// Real Resend secrets follow the same shape.
const SECRET_RAW = randomBytes(24);
const SECRET     = 'whsec_' + SECRET_RAW.toString('base64');
const ID         = 'msg_2tEsT0123456789';
const NOW_SEC    = Math.floor(Date.now() / 1000);
const RAW_BODY   = Buffer.from(
  JSON.stringify({ type: 'email.delivered', data: { email: 'athlete@example.com' } })
);

function signV1(id, ts, body, secretBuf) {
  const message = `${id}.${ts}.${body.toString('utf8')}`;
  return createHmac('sha256', secretBuf).update(message).digest('base64');
}

describe('Phase 1.3 · Svix HMAC gate · external webhook simulation', () => {
  test('valid signature PASSES', () => {
    const sig = signV1(ID, String(NOW_SEC), RAW_BODY, SECRET_RAW);
    const result = verifySvixSignature({
      id:        ID,
      timestamp: String(NOW_SEC),
      signature: `v1,${sig}`,
      rawBody:   RAW_BODY,
      secret:    SECRET,
    });
    assert.equal(result.ok, true, 'valid signature must pass');
  });

  test('missing svix-id is REJECTED', () => {
    const sig = signV1(ID, String(NOW_SEC), RAW_BODY, SECRET_RAW);
    const result = verifySvixSignature({
      id:        '',
      timestamp: String(NOW_SEC),
      signature: `v1,${sig}`,
      rawBody:   RAW_BODY,
      secret:    SECRET,
    });
    assert.equal(result.ok, false);
    assert.equal(result.error, 'missing_svix_id');
  });

  test('missing svix-timestamp is REJECTED', () => {
    const sig = signV1(ID, String(NOW_SEC), RAW_BODY, SECRET_RAW);
    const result = verifySvixSignature({
      id:        ID,
      timestamp: '',
      signature: `v1,${sig}`,
      rawBody:   RAW_BODY,
      secret:    SECRET,
    });
    assert.equal(result.ok, false);
    assert.equal(result.error, 'missing_svix_timestamp');
  });

  test('missing svix-signature is REJECTED', () => {
    const result = verifySvixSignature({
      id:        ID,
      timestamp: String(NOW_SEC),
      signature: '',
      rawBody:   RAW_BODY,
      secret:    SECRET,
    });
    assert.equal(result.ok, false);
    assert.equal(result.error, 'missing_svix_signature');
  });

  test('missing raw body is REJECTED', () => {
    const sig = signV1(ID, String(NOW_SEC), RAW_BODY, SECRET_RAW);
    const result = verifySvixSignature({
      id:        ID,
      timestamp: String(NOW_SEC),
      signature: `v1,${sig}`,
      rawBody:   null,
      secret:    SECRET,
    });
    assert.equal(result.ok, false);
    assert.equal(result.error, 'missing_raw_body');
  });

  test('tampered body is REJECTED (signature_mismatch)', () => {
    const sig = signV1(ID, String(NOW_SEC), RAW_BODY, SECRET_RAW);
    const tampered = Buffer.from(
      JSON.stringify({ type: 'email.delivered', data: { email: 'attacker@example.com' } })
    );
    const result = verifySvixSignature({
      id:        ID,
      timestamp: String(NOW_SEC),
      signature: `v1,${sig}`,
      rawBody:   tampered,
      secret:    SECRET,
    });
    assert.equal(result.ok, false);
    assert.equal(result.error, 'signature_mismatch');
  });

  test('stale timestamp (>5min old) is REJECTED', () => {
    const staleTs = NOW_SEC - 600; // 10 minutes ago
    const sig = signV1(ID, String(staleTs), RAW_BODY, SECRET_RAW);
    const result = verifySvixSignature({
      id:        ID,
      timestamp: String(staleTs),
      signature: `v1,${sig}`,
      rawBody:   RAW_BODY,
      secret:    SECRET,
    });
    assert.equal(result.ok, false);
    assert.equal(result.error, 'timestamp_out_of_tolerance');
  });

  test('future timestamp (>5min ahead) is REJECTED', () => {
    const futureTs = NOW_SEC + 600;
    const sig = signV1(ID, String(futureTs), RAW_BODY, SECRET_RAW);
    const result = verifySvixSignature({
      id:        ID,
      timestamp: String(futureTs),
      signature: `v1,${sig}`,
      rawBody:   RAW_BODY,
      secret:    SECRET,
    });
    assert.equal(result.ok, false);
    assert.equal(result.error, 'timestamp_out_of_tolerance');
  });

  test('multi-signature header · key-rotation case · PASSES on any matching v1', () => {
    const sigGood = signV1(ID, String(NOW_SEC), RAW_BODY, SECRET_RAW);
    // Second signature is from a stale rotated-out secret · should not match.
    const otherSecret = randomBytes(24);
    const sigOld  = signV1(ID, String(NOW_SEC), RAW_BODY, otherSecret);
    const result = verifySvixSignature({
      id:        ID,
      timestamp: String(NOW_SEC),
      signature: `v1,${sigOld} v1,${sigGood}`,
      rawBody:   RAW_BODY,
      secret:    SECRET,
    });
    assert.equal(result.ok, true, 'multi-sig with one valid v1 must pass');
  });

  test('unknown future scheme is TOLERATED · falls through to next entry', () => {
    const sig = signV1(ID, String(NOW_SEC), RAW_BODY, SECRET_RAW);
    const result = verifySvixSignature({
      id:        ID,
      timestamp: String(NOW_SEC),
      signature: `v2,unknownscheme v1,${sig}`,
      rawBody:   RAW_BODY,
      secret:    SECRET,
    });
    assert.equal(result.ok, true, 'unknown scheme must be skipped, valid v1 must pass');
  });

  test('empty secret returns invalid_secret_config', () => {
    const result = verifySvixSignature({
      id:        ID,
      timestamp: String(NOW_SEC),
      signature: `v1,somesig`,
      rawBody:   RAW_BODY,
      secret:    '',
    });
    assert.equal(result.ok, false);
    assert.equal(result.error, 'invalid_secret_config');
  });

  test('secret without whsec_ prefix (self-hosted Svix) still works', () => {
    const noPrefix = SECRET.replace(/^whsec_/, '');
    const sig = signV1(ID, String(NOW_SEC), RAW_BODY, SECRET_RAW);
    const result = verifySvixSignature({
      id:        ID,
      timestamp: String(NOW_SEC),
      signature: `v1,${sig}`,
      rawBody:   RAW_BODY,
      secret:    noPrefix,
    });
    assert.equal(result.ok, true);
  });
});
