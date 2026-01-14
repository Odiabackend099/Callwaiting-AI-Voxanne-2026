/**
 * Authentication Middleware
 * Validates JWT tokens and protects founder console endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { supabase } from '../services/supabase-client';

// Extend Express Request to include user info, org, and requestId
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        orgId: string;
        role?: 'admin' | 'agent' | 'viewer';
      };
      org?: {
        id: string;
        name?: string;
      };
      org_id?: string;
      requestId?: string;
    }
  }
}

/**
 * Require auth in production, but allow a dev-mode bypass so local dashboard usage
 * doesn't require manual token copy/paste.
 *
 * CRITICAL SECURITY FIX: Default to PRODUCTION mode (NODE_ENV required to be explicitly set to 'development')
 * In dev mode only (NODE_ENV=development), if no Authorization header is provided,
 * attach a synthetic user and proceed.
 */
export async function requireAuthOrDev(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Allow CORS preflight without auth
    if (req.method === 'OPTIONS') {
      next();
      return;
    }

    const authHeader = req.headers.authorization;

    // Determine if we're in dev mode (must be EXPLICITLY set, defaults to production)
    const isProduction = process.env.NODE_ENV !== 'development';

    // If caller provided a token, try to validate it.
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      // Treat common "empty" token values as missing (prevents Bearer undefined/null)
      if (token && token !== 'undefined' && token !== 'null') {
        // In dev mode, try token auth but fall back to dev user on failure
        if (!isProduction) {
          // Development mode: Attempt token validation, but don't block on failure
          try {
            const { data: { user }, error } = await supabase.auth.getUser(token);
            if (!error && user) {
              // Token is valid, resolve org
              // CRITICAL SSOT FIX: Prioritize app_metadata.org_id (admin-set, immutable)
              // Fallback to user_metadata.org_id for backward compatibility during migration
              let orgId: string = (user.app_metadata?.org_id || user.user_metadata?.org_id) as string || 'default';
              if (orgId === 'default') {
                const { data: org } = await supabase
                  .from('organizations')
                  .select('id')
                  .limit(1)
                  .single();
                if (org?.id) orgId = org.id;
              }
              if (orgId !== 'default') {
                req.user = { id: user.id, email: user.email || '', orgId };
                req.org_id = orgId;
                next();
                return;
              }
            }
            // Token invalid or org not resolved - fall through to dev fallback below
            console.log('[AuthOrDev] Token auth failed in dev mode, falling back to dev user');
          } catch (e) {
            console.log('[AuthOrDev] Token validation error in dev mode, falling back to dev user');
          }
        } else {
          // Production: strict token validation (no fallback)
          await requireAuth(req, res, next);
          return;
        }
      }
    }

    // No token provided or token validation failed
    if (isProduction) {
      // PRODUCTION MODE: Always reject unauthenticated requests
      res.status(401).json({ error: 'Missing or invalid Authorization header' });
      return;
    }

    // DEVELOPMENT MODE ONLY: Use hardcoded default org ID (matches KB uploads)
    // This fallback is ONLY active when NODE_ENV=development is explicitly set
    const defaultOrgId = 'a0000000-0000-0000-0000-000000000001';

    req.user = {
      id: process.env.DEV_USER_ID || 'dev-user',
      email: process.env.DEV_USER_EMAIL || 'dev@local',
      orgId: defaultOrgId
    };

    next();
  } catch (error: any) {
    console.error('[AuthOrDev Middleware] Error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

/**
 * Verify JWT token from Authorization header
 * Expected format: "Bearer <token>"
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid Authorization header' });
      return;
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    // Attach user info to request
    // CRITICAL SSOT FIX: Prioritize app_metadata.org_id (admin-set, immutable)
    // Fallback to user_metadata.org_id for backward compatibility during migration
    let orgId: string = (user.app_metadata?.org_id || user.user_metadata?.org_id) as string || 'default';
    if (orgId === 'default') {
      try {
        const { data: org } = await supabase
          .from('organizations')
          .select('id')
          .limit(1)
          .single();
        if (org?.id) orgId = org.id;
      } catch {
        // Fallback: keep 'default' (will be rejected by downstream routes that require a real org)
      }
    }

    if (orgId === 'default') {
      res.status(401).json({ error: 'Organization not resolved for user' });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email || '',
      orgId
    };

    next();
  } catch (error: any) {
    console.error('[Auth Middleware] Error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

/**
 * Verify user owns the organization
 * Useful for multi-tenant setups
 */
export async function verifyOrgAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // For now, allow access to default org
    // In production, verify user has access to requested org
    const requestedOrgId = req.query.org_id as string || 'default';

    if (requestedOrgId !== 'default' && requestedOrgId !== req.user.orgId) {
      res.status(403).json({ error: 'Access denied to this organization' });
      return;
    }

    next();
  } catch (error: any) {
    console.error('[Org Access Middleware] Error:', error);
    res.status(500).json({ error: 'Authorization failed' });
  }
}

/**
 * Optional auth - attaches user if token provided, but doesn't require it
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: { user }, error } = await supabase.auth.getUser(token);

      if (!error && user) {
        // CRITICAL SSOT FIX: Prioritize app_metadata.org_id (admin-set, immutable)
        // Fallback to user_metadata.org_id for backward compatibility during migration
        let orgId: string = (user.app_metadata?.org_id || user.user_metadata?.org_id) as string || 'default';
        if (orgId === 'default') {
          try {
            const { data: org } = await supabase
              .from('organizations')
              .select('id')
              .limit(1)
              .single();
            if (org?.id) orgId = org.id;
          } catch {
            // ignore
          }
        }

        req.user = {
          id: user.id,
          email: user.email || '',
          orgId
        };
      }
    }

    next();
  } catch (error: any) {
    console.error('[Optional Auth Middleware] Error:', error);
    next(); // Don't block on error for optional auth
  }
}

/**
 * Require specific role (admin, agent, or viewer)
 * Must be used after requireAuth or requireAuthOrDev
 */
export function requireRole(...allowedRoles: ('admin' | 'agent' | 'viewer')[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      // Fetch user role from user_org_roles
      const { data: userRole, error } = await supabase
        .from('user_org_roles')
        .select('role')
        .eq('user_id', req.user.id)
        .eq('org_id', req.user.orgId)
        .single();

      if (error || !userRole) {
        res.status(403).json({ error: 'User role not found' });
        return;
      }

      if (!allowedRoles.includes(userRole.role as any)) {
        res.status(403).json({
          error: `Access denied. Required role: ${allowedRoles.join(' or ')}`
        });
        return;
      }

      // Attach role to request
      req.user.role = userRole.role as any;
      next();
    } catch (error: any) {
      console.error('[Role Middleware] Error:', error);
      res.status(500).json({ error: 'Authorization failed' });
    }
  };
}
