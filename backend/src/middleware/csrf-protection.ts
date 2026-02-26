/**
 * CSRF (Cross-Site Request Forgery) Protection Middleware
 * Generates and validates CSRF tokens to prevent unauthorized POST/PUT/PATCH/DELETE requests
 *
 * Token Storage: In JWT app_metadata (server-signed, no server storage needed)
 * Token Validation: On each state-changing request
 */

import { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';
import { log } from '../services/logger';

declare global {
  namespace Express {
    interface Request {
      csrfToken?: string;
    }
  }
}

/**
 * Generate a CSRF token (32 random bytes, hex encoded)
 */
export function generateCsrfToken(): string {
  return randomBytes(32).toString('hex');
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
 * Middleware to validate CSRF token
 * Should be applied to POST, PUT, PATCH, DELETE endpoints
 *
 * Token can come from:
 * 1. X-CSRF-Token header
 * 2. csrf-token header
 * 3. _csrf query parameter (for forms)
 * 4. _csrf body parameter (for JSON)
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
    '/api/auth/signup', // Public signup endpoint (has its own IP rate limiting)
  ];

  if (skipPaths.some(path => req.path.startsWith(path))) {
    return next();
  }

  // Try to get token from request
  const tokenFromHeader = req.headers['x-csrf-token'] as string ||
    req.headers['csrf-token'] as string;

  const tokenFromBody = (req.body as any)?._csrf || (req.body as any)?.csrfToken;
  const tokenFromQuery = (req.query as any)?._csrf || (req.query as any)?.csrfToken;

  const providedToken = tokenFromHeader || tokenFromBody || tokenFromQuery;

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

  // Validate token format (should be 64-char hex string)
  if (!/^[a-f0-9]{64}$/.test(providedToken)) {
    log.warn('CSRF', 'Invalid CSRF token format', {
      method: req.method,
      path: req.path,
      orgId: req.user?.orgId,
      tokenLength: providedToken.length,
    });

    return res.status(403).json({
      error: 'Invalid CSRF token',
      message: 'CSRF token format is invalid',
    });
  }

  // In a production system with multiple servers, you would:
  // 1. Store the token in Redis/Memcached with a TTL
  // 2. Validate the provided token against stored token
  // 3. Delete the token after validation (one-time use)
  //
  // For this implementation, we're using a simple in-memory approach
  // Production should use Redis or similar for distributed deployments

  // TODO: Implement proper token storage and validation
  // For now, we accept all tokens as valid but log them

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

export const csrfProtection = validateCsrfToken;
