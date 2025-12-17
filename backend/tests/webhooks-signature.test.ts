import { computeVapiSignature, isTimestampWithinSkew, verifyVapiSignature } from '../src/utils/vapi-webhook-signature';
import { describe, it, expect } from '@jest/globals';

describe('Vapi Webhook Signature', () => {
  it('computes deterministic HMAC for timestamp + raw body', () => {
    const secret = 'test_secret';
    const timestamp = '1700000000';
    const rawBody = '{"hello":"world"}';

    const sig1 = computeVapiSignature(secret, timestamp, rawBody);
    const sig2 = computeVapiSignature(secret, timestamp, rawBody);

    expect(sig1).toBe(sig2);
    expect(sig1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('timestamp skew accepts seconds and milliseconds within window', () => {
    const nowMs = 1700000000 * 1000;
    const maxSkewMs = 5 * 60 * 1000;

    // seconds epoch
    expect(isTimestampWithinSkew(nowMs, '1700000000', maxSkewMs)).toBe(true);

    // milliseconds epoch
    expect(isTimestampWithinSkew(nowMs, String(nowMs), maxSkewMs)).toBe(true);

    // too far in the past
    expect(isTimestampWithinSkew(nowMs, String(nowMs - (maxSkewMs + 1)), maxSkewMs)).toBe(false);
  });

  it('verifies signature with timing-safe compare and timestamp skew', () => {
    const secret = 'test_secret';
    const timestamp = '1700000000';
    const rawBody = '{"hello":"world"}';
    const nowMs = 1700000000 * 1000;

    const signature = computeVapiSignature(secret, timestamp, rawBody);

    expect(
      verifyVapiSignature({
        secret,
        signature,
        timestamp,
        rawBody,
        nowMs,
        maxSkewMs: 5 * 60 * 1000
      })
    ).toBe(true);

    expect(
      verifyVapiSignature({
        secret,
        signature: '0'.repeat(64),
        timestamp,
        rawBody,
        nowMs,
        maxSkewMs: 5 * 60 * 1000
      })
    ).toBe(false);

    // Reject if timestamp is outside skew
    expect(
      verifyVapiSignature({
        secret,
        signature,
        timestamp,
        rawBody,
        nowMs: nowMs + (5 * 60 * 1000 + 1),
        maxSkewMs: 5 * 60 * 1000
      })
    ).toBe(false);
  });
});
