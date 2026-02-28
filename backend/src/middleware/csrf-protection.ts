/**
 * CSRF (Cross-Site Request Forgery) Protection Middleware
 * Generates and validates CSRF tokens to prevent unauthorized POST/PUT/PATCH/DELETE requests.
 *
 * Token format: "{timestamp}:{HMAC-SHA256(secret, timestamp)}" — stateless, no server storage.
 * Token validation: HMAC signature + 24-hour freshness check on each state-changing request.
 */

import { Request, Response, NextFunction } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { log } from '../services/logger';

declare global {
  namespace Express {
    interface Request {
      csrfToken?: string;
    }
  }
}

/**
 * Returns the HMAC signing secret for CSRF tokens.
 * Prefers an explicit CSRF_SECRET env var; falls back to SUPABASE_SERVICE_ROLE_KEY
 * (always present at startup). Using a dedicated CSRF_SECRET is recommended for
 * production hardening but is not required.
 */
function getCsrfSecret(): string {
  return (
    process.env.CSRF_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'dev-only-insecure-do-not-use-in-production'
  );
}

/**
 * Generate a CSRF token as "{timestamp}:{HMAC-SHA256(secret, timestamp)}".
 * The timestamp makes tokens self-expiring (validated to ≤24 h old on receipt).
 * The HMAC proves the token was issued by this server — no server-side storage needed.
 */
export function generateCsrfToken(): string {
  const timestamp = Date.now().toString();
  const hmac = createHmac('sha256', getCsrfSecret()).update(timestamp).digest('hex');
  return `${timestamp}:${hmac}`;
}

/**
 * Middleware to generate and set CSRF token
 * Should be applied to all routes that need CSRF protection
 */
export function csrfTokenGenerator(req: Request, res: Response, next: NextFunction) {
  // Generate token if not already in request
  if (!req.csrfToken) {
    req.csrfToken = generateCsrfToken();
  }

  // Set token in response header for client to use
  res.setHeader('X-CSRF-Token', req.csrfToken);

  next();
}

/**
 * Middleware to validate CSRF token on POST, PUT, PATCH, DELETE endpoints.
 *
 * Token is accepted from:
 * 1. X-CSRF-Token header  (preferred — used by authedBackendFetch)
 * 2. csrf-token header
 * 3. _csrf or csrfToken body field (JSON body)
 *
 * Query params are intentionally NOT accepted (tokens in URLs leak via logs/Referer).
 */
export function validateCsrfToken(req: Request, res: Response, next: NextFunction) {
  // Only validate state-changing methods
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next();
  }

  // Skip CSRF validation for certain paths if needed (webhooks, health checks, etc)
  // This is intentionally strict - only skip what's necessary
  const skipPaths = [
    '/health',
    '/health/check',
    '/api/webhooks', // Vapi webhooks have their own signature verification
    '/api/vapi/tools', // Vapi tool endpoints (called by Vapi servers, not browsers)
    '/api/assistants/sync', // Tool sync endpoint (administrative, called by scripts)
    '/api/chat-widget', // Public chat widget endpoint (has rate limiting + input validation)
    '/api/founder-console/agent/voice-preview', // READ-only: serves static audio samples, protected by JWT
    // NOTE: /api/auth/signup is intentionally NOT listed here.
    // The frontend fetches a CSRF token before submitting signup and sends it in X-CSRF-Token.
  ];

  if (skipPaths.some(path => req.path.startsWith(path))) {
    return next();
  }

  // Accept token from header or JSON body only.
  // Query params are deliberately excluded: tokens in URLs appear in server logs,
  // Referer headers, and browser history — leaking the credential.
  const tokenFromHeader =
    (req.headers['x-csrf-token'] as string) || (req.headers['csrf-token'] as string);
  const tokenFromBody = (req.body as any)?._csrf || (req.body as any)?.csrfToken;
  const providedToken = tokenFromHeader || tokenFromBody;

  if (!providedToken) {
    log.warn('CSRF', 'Missing CSRF token', {
      method: req.method,
      path: req.path,
      orgId: req.user?.orgId,
    });
    return res.status(403).json({
      error: 'CSRF token missing',
      message: 'Request is missing required CSRF token',
    });
  }

  // Validate token structure: "{timestamp}:{64-char HMAC-SHA256 hex}"
  const colonIdx = providedToken.indexOf(':');
  if (colonIdx === -1) {
    log.warn('CSRF', 'Malformed CSRF token', { method: req.method, path: req.path });
    return res.status(403).json({ error: 'Invalid CSRF token', message: 'Malformed token' });
  }

  const timestamp = providedToken.slice(0, colonIdx);
  const providedHmac = providedToken.slice(colonIdx + 1);
  const expectedHmac = createHmac('sha256', getCsrfSecret()).update(timestamp).digest('hex');

  // Timing-safe comparison prevents HMAC oracle / timing attacks.
  // Both buffers must be the same length for timingSafeEqual; pad the provided HMAC so
  // a short input cannot short-circuit the comparison. The strict string equality check
  // afterwards catches any padding trick.
  let hmacValid = false;
  try {
    const providedBuf = Buffer.from(providedHmac.padEnd(64, '0'), 'hex');
    const expectedBuf = Buffer.from(expectedHmac, 'hex');
    hmacValid =
      providedBuf.length === expectedBuf.length &&
      timingSafeEqual(providedBuf, expectedBuf) &&
      providedHmac === expectedHmac;
  } catch {
    hmacValid = false;
  }

  if (!hmacValid) {
    log.warn('CSRF', 'Invalid CSRF token signature', {
      method: req.method,
      path: req.path,
      orgId: req.user?.orgId,
    });
    return res.status(403).json({
      error: 'Invalid CSRF token',
      message: 'Token signature invalid',
    });
  }

  // Token freshness — reject tokens older than 24 hours.
  const tokenAge = Date.now() - parseInt(timestamp, 10);
  if (isNaN(tokenAge) || tokenAge < 0 || tokenAge > 24 * 60 * 60 * 1000) {
    log.warn('CSRF', 'Expired CSRF token', {
      method: req.method,
      path: req.path,
      tokenAgeMs: tokenAge,
    });
    return res.status(403).json({
      error: 'Invalid CSRF token',
      message: 'Token expired or invalid timestamp',
    });
  }

  log.info('CSRF', 'CSRF token validated', {
    method: req.method,
    path: req.path,
    orgId: req.user?.orgId,
  });

  next();
}

/**
 * Middleware to generate token for safe endpoints
 * Returns token in response that frontend can use for subsequent requests
 */
export function csrfTokenEndpoint(req: Request, res: Response) {
  const token = generateCsrfToken();

  res.json({
    csrfToken: token,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
  });
}

/**
 * @deprecated Prefer importing `validateCsrfToken` directly.
 * This alias exists for backward compatibility with existing tests and imports.
 */
export const csrfProtection = validateCsrfToken;
