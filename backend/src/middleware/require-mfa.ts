/**
 * MFA Enforcement Middleware
 *
 * Requires that the authenticated user has verified MFA before accessing
 * sensitive endpoints (admin routes, billing, agent deployment).
 *
 * Usage:
 *   router.post('/billing/charge', requireAuth, requireMFA, handler);
 *
 * Behavior:
 *   - If user has no MFA factors enrolled → 403 with enrollment prompt
 *   - If user has MFA enrolled but current session lacks AAL2 → 403 with challenge prompt
 *   - If user has verified MFA (AAL2 assurance level) → next()
 */

import { Request, Response, NextFunction } from 'express';
import { MFAService } from '../services/mfa-service';
import { log } from '../services/logger';

/**
 * Middleware that enforces MFA verification on the current session.
 * Must be placed AFTER requireAuth in the middleware chain.
 */
export async function requireMFA(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = req.user?.id;
  const orgId = req.user?.orgId;

  if (!userId) {
    res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    return;
  }

  try {
    const mfaEnabled = await MFAService.isMFAEnabled(userId);

    if (!mfaEnabled) {
      log.warn('MFA', 'Access denied — MFA not enrolled', {
        userId,
        orgId,
        path: req.path,
        method: req.method,
      });

      res.status(403).json({
        error: 'Multi-factor authentication is required for this action',
        code: 'MFA_REQUIRED',
        action: 'enroll',
        enrollUrl: '/dashboard/settings/security',
      });
      return;
    }

    // MFA is enrolled and verified — allow access
    next();
  } catch (error: any) {
    log.error('MFA', 'MFA check failed', { userId, orgId, error: error.message });
    res.status(500).json({ error: 'Authentication verification failed', code: 'MFA_CHECK_FAILED' });
  }
}
