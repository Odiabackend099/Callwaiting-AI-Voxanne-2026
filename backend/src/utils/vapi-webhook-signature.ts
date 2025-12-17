import crypto from 'crypto';

export function computeVapiSignature(secret: string, timestamp: string, rawBody: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');
}

export function verifyVapiSignature(params: {
  secret: string;
  signature: string;
  timestamp: string;
  rawBody: string;
  nowMs?: number;
  maxSkewMs?: number;
}): boolean {
  const {
    secret,
    signature,
    timestamp,
    rawBody,
    nowMs = Date.now(),
    maxSkewMs = 5 * 60 * 1000
  } = params;

  if (!secret || !signature || !timestamp) return false;
  if (!isTimestampWithinSkew(nowMs, timestamp, maxSkewMs)) return false;

  const expected = computeVapiSignature(secret, timestamp, rawBody);

  // computeVapiSignature returns a hex digest. Compare as bytes, not UTF-8 strings.
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(signature, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function parseVapiTimestampToMs(timestampHeader: string): number | null {
  const tsNum = Number(timestampHeader);
  if (!Number.isFinite(tsNum)) return null;
  return tsNum > 1e12 ? tsNum : tsNum * 1000;
}

export function isTimestampWithinSkew(nowMs: number, timestampHeader: string, maxSkewMs: number): boolean {
  const tsMs = parseVapiTimestampToMs(timestampHeader);
  if (tsMs === null) return false;
  return Math.abs(nowMs - tsMs) <= maxSkewMs;
}
