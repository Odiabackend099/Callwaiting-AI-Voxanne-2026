/**
 * Authentication Middleware
 * Validates JWT tokens and protects founder console endpoints
 *
 * Performance Optimizations:
 * - JWT token cache with 5-minute TTL (reduces Supabase API calls)
 * - Auth latency monitoring (logs slow validations, tracks cache metrics)
 */

import { Request, Response, NextFunction } from 'express';
import { supabase } from '../services/supabase-client';
import { validateAndResolveOrgId } from '../services/org-validation';
import { LRUCache } from 'lru-cache';

/**
 * JWT Cache Entry - stores validated user data with TTL
 */
interface CachedJWT {
  userId: string;
  email: string;
  orgId: string;
  expiresAt: number; // timestamp when cache entry expires
}

/**
 * In-memory JWT cache (LRU with 10K max size to prevent OOM)
 * Key: JWT token
 * Value: cached user data with expiration
 *
 * Security: LRU eviction prevents unbounded memory growth
 * Performance: 5-minute TTL reduces Supabase API calls
 */
const MAX_JWT_CACHE_SIZE = 10000;
const JWT_CACHE_TTL = 300000; // 5 minutes in milliseconds

const jwtCache = new LRUCache<string, CachedJWT>({
  max: MAX_JWT_CACHE_SIZE,
  ttl: JWT_CACHE_TTL,
  updateAgeOnGet: false, // Don't reset TTL on cache hit
  allowStale: false,      // Don't return expired entries
});

/**
 * Cache statistics for monitoring
 */
interface CacheStats {
  hits: number;
  misses: number;
  totalRequests: number;
  avgLatencyCached: number;
  avgLatencyUncached: number;
  latencyDataCached: number[];
  latencyDataUncached: number[];
}

const cacheStats: CacheStats = {
  hits: 0,
  misses: 0,
  totalRequests: 0,
  avgLatencyCached: 0,
  avgLatencyUncached: 0,
  latencyDataCached: [],
  latencyDataUncached: []
};

/**
 * Get cached JWT or null if expired/missing
 * LRU cache automatically handles TTL expiration
 */
function getCachedJWT(token: string): CachedJWT | null {
  const cached = jwtCache.get(token);
  if (cached && cached.expiresAt > Date.now()) {
    return cached;
  }
  // Entry expired or missing
  if (cached) {
    jwtCache.delete(token);
  }
  return null;
}

/**
 * Cache JWT token with 5-minute TTL
 * LRU cache automatically evicts oldest entries when max size reached
 */
function cacheJWT(token: string, userId: string, email: string, orgId: string): void {
  const expiresAt = Date.now() + JWT_CACHE_TTL;
  jwtCache.set(token, { userId, email, orgId, expiresAt });
  if (process.env.DEBUG_AUTH) {
    console.debug(`[JWT Cache] Cached token for user ${userId}, ${jwtCache.size} entries`);
  }
}

/**
 * Log auth latency and update statistics
 */
function recordAuthLatency(latencyMs: number, cached: boolean): void {
  cacheStats.totalRequests++;

  if (cached) {
    cacheStats.latencyDataCached.push(latencyMs);
    // Keep only last 100 samples
    if (cacheStats.latencyDataCached.length > 100) {
      cacheStats.latencyDataCached.shift();
    }
    const sum = cacheStats.latencyDataCached.reduce((a, b) => a + b, 0);
    cacheStats.avgLatencyCached = Math.round(sum / cacheStats.latencyDataCached.length);
  } else {
    cacheStats.latencyDataUncached.push(latencyMs);
    // Keep only last 100 samples
    if (cacheStats.latencyDataUncached.length > 100) {
      cacheStats.latencyDataUncached.shift();
    }
    const sum = cacheStats.latencyDataUncached.reduce((a, b) => a + b, 0);
    cacheStats.avgLatencyUncached = Math.round(sum / cacheStats.latencyDataUncached.length);
  }

  // Warn if latency is high
  if (latencyMs > 100) {
    console.warn(`[Auth Latency] ${cached ? 'CACHED' : 'UNCACHED'} auth took ${latencyMs}ms`);
  }

  // Log stats periodically (every 100 requests)
  if (cacheStats.totalRequests % 100 === 0) {
    const hitRate = cacheStats.totalRequests > 0
      ? Math.round((cacheStats.hits / cacheStats.totalRequests) * 100)
      : 0;
    console.info(`[Auth Cache Stats] Hits: ${cacheStats.hits}, Misses: ${cacheStats.misses}, HitRate: ${hitRate}%, Cached: ${cacheStats.avgLatencyCached}ms, Uncached: ${cacheStats.avgLatencyUncached}ms, Size: ${jwtCache.size}`);
  }
}

/**
 * Public API: Get current cache statistics
 */
export function getAuthCacheStats(): CacheStats {
  return { ...cacheStats };
}

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
            // SECURITY FIX: ALWAYS verify JWT signature (no cache bypass, even in dev)
            const result = await supabase.auth.getUser(token);
            const user = result.data?.user;
            const error = result.error;

            if (!error && user) {
              // Token is valid, resolve org
              // Only trust app_metadata.org_id (admin-set, cryptographically signed).
              // Never fall back to user_metadata which is user-writable (security risk).
              let orgId: string = (user.app_metadata?.org_id) as string || 'default';

              // SECURITY FIX: STRICT validation - NO fallback to limit(1)
              // If org_id is missing or 'default', reject with 401
              if (orgId === 'default') {
                console.log('[AuthOrDev] User missing valid org_id in JWT - rejecting in dev mode');
                res.status(401).json({ error: 'Missing org_id in JWT. User must be provisioned with organization.' });
                return;
              }

              if (orgId) {
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
 *
 * PERFORMANCE: Uses JWT cache to reduce Supabase API calls
 * Cache hit target: >80% of requests
 * Latency targets: <50ms (cached), <200ms (uncached)
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const startTime = Date.now();
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid Authorization header' });
      return;
    }

    const token = authHeader.substring(7).trim(); // Remove "Bearer " prefix and trim whitespace

    if (!token) {
      res.status(401).json({ error: 'Missing or invalid Authorization header' });
      return;
    }

    // SECURITY FIX: ALWAYS verify JWT signature with Supabase (prevents token tampering)
    // This protects against: attacker modifying JWT payload (org_id tampering)
    //
    // NOTE: Cache removed to eliminate signature bypass vulnerability
    // Previous cache logic skipped signature verification on cache hit (CVSS 9.8)
    // All tokens now verified every request to ensure cryptographic integrity

    // Verify token signature with Supabase (CRITICAL - never skip this)
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      const latency = Date.now() - startTime;
      recordAuthLatency(latency, false);
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    // Attach user info to request
    // Only trust app_metadata.org_id (admin-set, cryptographically signed).
    // Never fall back to user_metadata which is user-writable (security risk).
    let orgId: string = (user.app_metadata?.org_id) as string || 'default';

    // DEBUG: Log auth details for regression debugging
    if (orgId === 'default' || process.env.NODE_ENV === 'test') {
      console.log('[Auth Debug]', {
        email: user.email,
        app_metadata: user.app_metadata,
        user_metadata: user.user_metadata,
        resolvedOrgId: orgId
      });
    }

    // SECURITY FIX: STRICT validation - NO fallback to limit(1)
    // If org_id is missing or 'default', reject immediately
    if (orgId === 'default') {
      const latency = Date.now() - startTime;
      recordAuthLatency(latency, false);
      console.log('[requireAuth] User missing valid org_id in JWT - rejecting');
      res.status(401).json({ error: 'Missing org_id in JWT. User must be provisioned with organization.' });
      return;
    }

    // Attach verified user to request (signature validated above)
    req.user = {
      id: user.id,
      email: user.email || '',
      orgId
    };

    const latency = Date.now() - startTime;
    recordAuthLatency(latency, false);

    next();
  } catch (error: any) {
    const latency = Date.now() - startTime;
    recordAuthLatency(latency, false);
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
 * SECURITY FIX: No database fallback - if org_id missing, don't attach user
 * PERFORMANCE: Uses JWT cache to reduce Supabase API calls
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      // SECURITY FIX: ALWAYS verify JWT signature (no cache bypass)
      // This protects against token tampering attacks (CVSS 9.8)
      const result = await supabase.auth.getUser(token);
      const user = result.data?.user;
      const error = result.error;

      if (!error && user) {
        // Only trust app_metadata.org_id (admin-set, cryptographically signed).
        // Never fall back to user_metadata which is user-writable (security risk).
        let orgId: string = (user.app_metadata?.org_id) as string || 'default';

        // SECURITY FIX: Don't attach user if org_id is 'default' or missing
        // This prevents accidental cross-tenant data access via database fallback
        if (orgId && orgId !== 'default') {
          req.user = {
            id: user.id,
            email: user.email || '',
            orgId
          };
        }
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
