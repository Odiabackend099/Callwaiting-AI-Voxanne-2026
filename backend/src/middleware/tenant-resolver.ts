/**
 * Tenant Resolver Middleware
 *
 * RESILIENCE LAYER: Automatically resolves missing org_id in user sessions
 *
 * Problem: Existing users' JWTs may not have org_id if they signed up before
 * the database trigger was deployed. New users might have stale browser cache.
 *
 * Solution: This middleware checks for org_id and fetches it from the database
 * as a fallback, ensuring every authenticated request has a valid org_id.
 *
 * 2026 Standard: Zero-Trust Onboarding - assume client state may be dirty,
 * fix it server-side automatically.
 */

import { Request, Response, NextFunction } from 'express';
import { supabase } from '../services/supabase-client';
import { log } from '../services/logger';

/**
 * Augment Express Request with org_id resolution
 */
declare global {
  namespace Express {
    interface Request {
      orgId?: string;
      resolvedOrgId?: string; // Explicitly marked as resolved from fallback
    }
  }
}

/**
 * Tenant Resolver Middleware
 * Ensures every authenticated request has an org_id
 */
export async function tenantResolver(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Skip if no user is authenticated
    if (!req.user || !req.user.id) {
      return next();
    }

    // Check if org_id already exists in JWT
    let orgId = req.user?.orgId || (req.user as any)?.app_metadata?.org_id;

    if (orgId) {
      // User has org_id in JWT - great!
      req.orgId = orgId;
      log.debug('TenantResolver', 'org_id found in JWT', { userId: req.user.id, orgId });
      return next();
    }

    // ⚠️ org_id missing from JWT - attempt fallback resolution
    log.warn('TenantResolver', 'org_id missing from JWT, attempting fallback', {
      userId: req.user.id,
      email: req.user.email
    });

    // Query database for this user's profile to get their org_id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', req.user.id)
      .maybeSingle();

    if (profileError) {
      log.error('TenantResolver', 'Failed to query profile table', {
        userId: req.user.id,
        error: profileError.message
      });
      return next(); // Continue without org_id, let route handle it
    }

    if (!profile || !profile.org_id) {
      log.warn('TenantResolver', 'No org_id found in database for user', {
        userId: req.user.id,
        email: req.user.email
      });
      return next(); // Continue without org_id, let route handle it
    }

    // ✅ Found org_id in database!
    orgId = profile.org_id;
    req.orgId = orgId;
    req.resolvedOrgId = orgId; // Mark as resolved from fallback

    log.info('TenantResolver', 'Resolved org_id from database', {
      userId: req.user.id,
      orgId,
      method: 'database_fallback'
    });

    return next();
  } catch (error) {
    log.error('TenantResolver', 'Middleware error', {
      error: error instanceof Error ? error.message : String(error)
    });
    // Don't block the request on middleware error
    return next();
  }
}

/**
 * Require org_id middleware (with automatic resolution)
 * Use this on routes that MUST have an org_id
 */
export function requireOrgId(req: Request, res: Response, next: NextFunction): void {
  const orgId = req.orgId || (req.user as any)?.app_metadata?.org_id;

  if (!orgId) {
    log.warn('TenantResolver', 'Request missing org_id - user may need to re-authenticate', {
      userId: req.user?.id,
      email: req.user?.email
    });

    res.status(401).json({
      error: 'Missing organization context',
      message: 'User session is missing organization information. Please log out and log back in.',
      hint: 'This usually happens after a major system update. A quick re-login will fix it.',
      requiresReauth: true
    });
    return;
  }

  next();
}

/**
 * Assert org_id exists (for internal use in route handlers)
 */
export function getOrgIdOrThrow(req: Request, context: string = 'route'): string {
  const orgId = req.orgId || (req.user as any)?.app_metadata?.org_id;

  if (!orgId) {
    const error = new Error(`Missing org_id in ${context}`);
    log.error('TenantResolver', error.message, {
      userId: req.user?.id,
      context
    });
    throw error;
  }

  return orgId;
}
