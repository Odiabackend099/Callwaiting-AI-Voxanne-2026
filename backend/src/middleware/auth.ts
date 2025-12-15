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
      };
      org?: {
        id: string;
        name?: string;
      };
      requestId?: string;
    }
  }
}

/**
 * Require auth in production, but allow a dev-mode bypass so local dashboard usage
 * doesn't require manual token copy/paste.
 *
 * In dev mode (NODE_ENV=development), if no Authorization header is provided,
 * attach a synthetic user and proceed.
 */
export async function requireAuthOrDev(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    // If caller provided a token, try to validate it.
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      // Treat common "empty" token values as missing (prevents Bearer undefined/null)
      if (token && token !== 'undefined' && token !== 'null') {
        // In dev mode, try token auth but fall back to dev user on failure
        const isDev = (process.env.NODE_ENV || 'development') === 'development';
        if (isDev) {
          // Attempt token validation, but don't block on failure in dev
          try {
            const { data: { user }, error } = await supabase.auth.getUser(token);
            if (!error && user) {
              // Token is valid, resolve org
              let orgId: string = user.user_metadata?.org_id || 'default';
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
          // Production: strict token validation
          await requireAuth(req, res, next);
          return;
        }
      }
    }

    // No token provided.
    const isDev = (process.env.NODE_ENV || 'development') === 'development';
    if (!isDev) {
      res.status(401).json({ error: 'Missing or invalid Authorization header' });
      return;
    }

    // In dev mode, fetch the actual org ID from database
    let orgId = process.env.DEFAULT_ORG_ID || 'default';
    try {
      const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .limit(1)
        .single();
      if (org?.id) {
        orgId = org.id;
      }
    } catch {
      // Fallback to default if org fetch fails
    }

    // If we still can't find a real org, we can't let 'default' propagate
    // to queries that expect a UUID, or it causes 500s.
    if (orgId === 'default') {
      console.error('[AuthOrDev] Failed to resolve a valid Org ID in dev mode.');
      res.status(500).json({ error: 'Dev Configuration Error: No organizations found in DB. Please create an organization first.' });
      return;
    }

    req.user = {
      id: process.env.DEV_USER_ID || 'dev-user',
      email: process.env.DEV_USER_EMAIL || 'dev@local',
      orgId
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
    let orgId: string = user.user_metadata?.org_id || 'default';
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
        let orgId: string = user.user_metadata?.org_id || 'default';
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
