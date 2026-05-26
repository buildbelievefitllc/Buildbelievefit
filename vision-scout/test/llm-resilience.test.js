// ═══════════════════════════════════════════════════════════════════════
// Phase 6.0f · End-to-end smoke test for the Phase 6.0e resilience layer.
// Validates the retry / backoff / fallback contract with zero-jitter mode
// for reproducibility.
// ═══════════════════════════════════════════════════════════════════════

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  withResilience,
  isRetryableFailure,
  backoffDelayMs,
  RETRY_DEFAULTS,
} from '../marketing/llm-resilience.js';

const ZERO_JITTER = {
  maxAttempts:  3,
  baseDelayMs:  1,
  maxDelayMs:   1,
  jitterRatio:  0,
  tag:          'test',
};

describe('Phase 6.0e · llm-resilience · error classification', () => {
  test('gemini_timeout is retryable', () => {
    assert.equal(isRetryableFailure({ ok: false, error: 'gemini_timeout' }), true);
  });
  test('gemini_429 is retryable', () => {
    assert.equal(isRetryableFailure({ ok: false, error: 'gemini_429' }), true);
  });
  test('gemini_503 is retryable', () => {
    assert.equal(isRetryableFailure({ ok: false, error: 'gemini_503' }), true);
  });
  test('any 5xx status is retryable (forward-compat)', () => {
    assert.equal(isRetryableFailure({ ok: false, error: 'gemini_599', status: 599 }), true);
  });
  test('gemini_400 is permanent', () => {
    assert.equal(isRetryableFailure({ ok: false, error: 'gemini_400', status: 400 }), false);
  });
  test('gemini_401 is permanent', () => {
    assert.equal(isRetryableFailure({ ok: false, error: 'gemini_401', status: 401 }), false);
  });
  test('gemini_no_text is permanent (parse / safety failure)', () => {
    assert.equal(isRetryableFailure({ ok: false, error: 'gemini_no_text' }), false);
  });
  test('successful results are NOT retryable', () => {
    assert.equal(isRetryableFailure({ ok: true, text: 'pitch' }), false);
  });
});

describe('Phase 6.0e · llm-resilience · backoff curve', () => {
  test('exponential growth · attempt 0 → baseMs, attempt 1 → 2×baseMs, etc.', () => {
    assert.equal(backoffDelayMs(0, 1000, 8000, 0), 1000);
    assert.equal(backoffDelayMs(1, 1000, 8000, 0), 2000);
    assert.equal(backoffDelayMs(2, 1000, 8000, 0), 4000);
    assert.equal(backoffDelayMs(3, 1000, 8000, 0), 8000);
  });
  test('capped at maxMs', () => {
    assert.equal(backoffDelayMs(10, 1000, 8000, 0), 8000);
  });
  test('jitter adds bounded variance', () => {
    const samples = Array.from({ length: 50 }, () => backoffDelayMs(0, 1000, 8000, 0.25));
    for (const s of samples) {
      assert.ok(s >= 1000 && s <= 1250, `sample ${s} out of [1000, 1250]`);
    }
  });
  test('RETRY_DEFAULTS is sane and frozen', () => {
    assert.equal(typeof RETRY_DEFAULTS.maxAttempts, 'number');
    assert.ok(RETRY_DEFAULTS.maxAttempts >= 1);
    assert.ok(Object.isFrozen(RETRY_DEFAULTS));
  });
});

describe('Phase 6.0e · llm-resilience · withResilience scenarios', () => {
  test('success on first try · 1 attempt · no fallback', async () => {
    let primaryCalls = 0;
    const result = await withResilience(
      async () => { primaryCalls++; return { ok: true, text: 'ok', latency_ms: 10 }; },
      async () => ({ ok: true, text: 'fallback', latency_ms: 10 }),
      ZERO_JITTER
    );
    assert.equal(primaryCalls, 1);
    assert.equal(result.ok, true);
    assert.equal(result.attempts, 1);
    assert.equal(result.fallback_used, false);
    assert.equal(result.text, 'ok');
  });

  test('one retryable failure then success · 2 attempts · no fallback', async () => {
    let calls = 0;
    const result = await withResilience(
      async () => {
        calls++;
        if (calls === 1) return { ok: false, error: 'gemini_503', status: 503, latency_ms: 5 };
        return { ok: true, text: 'recovered', latency_ms: 10 };
      },
      async () => ({ ok: true, text: 'fallback', latency_ms: 10 }),
      ZERO_JITTER
    );
    assert.equal(calls, 2);
    assert.equal(result.ok, true);
    assert.equal(result.attempts, 2);
    assert.equal(result.fallback_used, false);
    assert.equal(result.text, 'recovered');
    assert.equal(result.retry_history.length, 1);
    assert.equal(result.retry_history[0].error, 'gemini_503');
  });

  test('primary exhausts retries · fallback rescues', async () => {
    let primaryCalls = 0, fallbackCalls = 0;
    const result = await withResilience(
      async () => { primaryCalls++; return { ok: false, error: 'gemini_503', status: 503, latency_ms: 5 }; },
      async () => { fallbackCalls++; return { ok: true, text: 'fallback-rescue', latency_ms: 10, model: 'gemini-3.5-pro' }; },
      ZERO_JITTER
    );
    assert.equal(primaryCalls, 3);
    assert.equal(fallbackCalls, 1);
    assert.equal(result.ok, true);
    assert.equal(result.fallback_used, true);
    assert.equal(result.text, 'fallback-rescue');
    assert.equal(result.model, 'gemini-3.5-pro');
    assert.equal(result.retry_history.length, 3);
  });

  test('permanent error · skips retry · skips fallback (default)', async () => {
    let primaryCalls = 0, fallbackCalls = 0;
    const result = await withResilience(
      async () => { primaryCalls++; return { ok: false, error: 'gemini_400', status: 400, latency_ms: 5 }; },
      async () => { fallbackCalls++; return { ok: true, text: 'fallback', latency_ms: 10 }; },
      ZERO_JITTER
    );
    assert.equal(primaryCalls, 1, 'permanent error must NOT trigger additional primary retries');
    assert.equal(fallbackCalls, 0, 'permanent error must NOT trigger fallback by default');
    assert.equal(result.ok, false);
    assert.equal(result.error, 'gemini_400');
    assert.equal(result.fallback_used, false);
  });

  test('permanent error WITH fallbackOnPermanent=true · fallback rescues', async () => {
    let primaryCalls = 0, fallbackCalls = 0;
    const result = await withResilience(
      async () => { primaryCalls++; return { ok: false, error: 'gemini_400', status: 400, latency_ms: 5 }; },
      async () => { fallbackCalls++; return { ok: true, text: 'fb-on-perm', latency_ms: 10 }; },
      { ...ZERO_JITTER, fallbackOnPermanent: true }
    );
    assert.equal(primaryCalls, 1);
    assert.equal(fallbackCalls, 1);
    assert.equal(result.fallback_used, true);
    assert.equal(result.text, 'fb-on-perm');
  });

  test('no fallback configured · returns last failure with full history', async () => {
    let primaryCalls = 0;
    const result = await withResilience(
      async () => { primaryCalls++; return { ok: false, error: 'gemini_503', status: 503, latency_ms: 5 }; },
      null,
      { ...ZERO_JITTER, maxAttempts: 2 }
    );
    assert.equal(primaryCalls, 2);
    assert.equal(result.ok, false);
    assert.equal(result.fallback_used, false);
    assert.equal(result.retry_history.length, 2);
  });
});
