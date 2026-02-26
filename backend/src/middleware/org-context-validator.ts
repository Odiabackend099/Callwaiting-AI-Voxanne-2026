/**
 * Organization Context Validator Middleware
 *
 * CRITICAL SAFEGUARD: Prevents the organization ID bug that caused browser test voice mismatch.
 *
 * This middleware enforces that all authenticated requests have a valid orgId from JWT.
 * Any route handler that needs org context MUST use this middleware.
 *
 * Date: 2026-02-07
 * Bug Fixed: Browser test was querying random org instead of authenticated user's org
 * Prevention: Runtime validation + TypeScript guards + automated tests
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

/**
 * Type guard: Ensures req.user has orgId before proceeding
 */
export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    orgId: string; // REQUIRED - from JWT app_metadata
    role?: 'admin' | 'agent' | 'viewer';
  };
}

/**
 * Runtime assertion: Throws if orgId is missing
 * Use this at the top of any function that needs org context
 */
export function assertOrgContext(req: Request): asserts req is AuthenticatedRequest {
  if (!req.user?.orgId) {
    const error = new Error('CRITICAL: Organization context missing from authenticated request');
    logger.error('Organization context validation failed', {
      path: req.path,
      method: req.method,
      userId: req.user?.id || 'unknown',
      userEmail: req.user?.email || 'unknown',
      hasUser: !!req.user,
      hasOrgId: !!(req.user as any)?.orgId,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Middleware: Validates org context before route handler executes
 * Use this on all routes that query organization-specific data
 */
export function requireOrgContext(req: Request, res: Response, next: NextFunction): void {
  try {
    assertOrgContext(req);

    // Log successful validation for audit trail
    logger.debug('Organization context validated', {
      orgId: req.user.orgId,
      userId: req.user.id,
      path: req.path,
      method: req.method
    });

    next();
  } catch (error) {
    logger.error('Organization context validation middleware failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      path: req.path,
      method: req.method
    });

    res.status(401).json({
      error: 'Organization context required',
      message: 'This endpoint requires a valid organization context from authentication',
      details: 'Contact support if you believe this is an error'
    });
  }
}

/**
 * Helper: Safely extract orgId with validation
 * Use this instead of accessing req.user?.orgId directly
 */
export function getOrgIdFromRequest(req: Request): string {
  assertOrgContext(req);
  return req.user.orgId;
}

/**
 * DEPRECATED: Prevents accidental use of random org queries
 * This function throws an error to prevent the bug that was just fixed
 */
export function DO_NOT_USE_getRandomOrgId(): never {
  const error = new Error(
    'CRITICAL: Attempted to query random organization ID. ' +
    'This pattern caused the browser test voice mismatch bug (2026-02-07). ' +
    'ALWAYS use req.user?.orgId or getOrgIdFromRequest(req) instead.'
  );
  logger.error('Prevented random org query attempt', {
    stack: error.stack,
    bugReference: 'https://github.com/your-repo/issues/browser-test-voice-mismatch',
    correctPattern: 'Use req.user?.orgId or getOrgIdFromRequest(req)'
  });
  throw error;
}

/**
 * Testing helper: Validates that a query includes org_id filter
 * Use in tests to ensure all queries are org-scoped
 */
export function validateOrgScopedQuery(query: any, expectedOrgId: string): boolean {
  if (!query || typeof query !== 'object') {
    return false;
  }

  // Check if query has org_id filter
  const hasOrgFilter =
    query.org_id === expectedOrgId ||
    query.orgId === expectedOrgId ||
    (query.filters && query.filters.some((f: any) =>
      (f.column === 'org_id' || f.column === 'orgId') && f.value === expectedOrgId
    ));

  if (!hasOrgFilter) {
    logger.warn('Query missing org_id filter', {
      expectedOrgId,
      query: JSON.stringify(query)
    });
  }

  return hasOrgFilter;
}

/**
 * Guard: Prevents .limit(1).single() without org filter
 * Throws error if attempting to use the broken pattern
 */
export function preventRandomOrgQuery(queryDescription: string): void {
  const correctPattern = '.eq("org_id", orgId).limit(1).single()';
  const error = new Error(
    `BLOCKED: Attempted to use .limit(1).single() pattern without org filter in ${queryDescription}. ` +
    'This returns a RANDOM organization and causes data leakage bugs. ' +
    `ALWAYS filter by org_id BEFORE using .limit(1).single(). Correct pattern: ${correctPattern}`
  );
  logger.error('Prevented dangerous query pattern', {
    queryDescription,
    stack: error.stack,
    correctPattern
  });
  throw error;
}
