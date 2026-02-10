/**
 * Organization Validation Routes
 * Validates user has access to organization
 */

import { Router, Request, Response } from 'express';
import { requireAuthOrDev } from '../middleware/auth';
import { validateAndResolveOrgId, validateUserOrgMembership } from '../services/org-validation';

const orgsRouter = Router();

/**
 * GET /api/orgs/validate/:orgId
 * Validates user has access to organization
 *
 * SECURITY: This endpoint validates that:
 * 1. User has valid JWT with org_id in app_metadata
 * 2. Organization exists in database
 * 3. User belongs to that organization
 *
 * DEBUGGING: If you get 404, it means organization doesn't exist in database.
 * This usually happens when:
 * - Database trigger on_auth_user_created didn't run when user was created
 * - Organization was manually deleted
 * - Test user was created with hardcoded UUID not in database
 * Solution: See MULTI_TENANT_ORG_FIX.md
 *
 * Returns:
 * - 200 OK if user has access to org
 * - 400 Bad Request if orgId missing or invalid format
 * - 401 Unauthorized if org_id missing from JWT
 * - 403 Forbidden if user doesn't have access to org
 * - 404 Not Found if org doesn't exist (see debugging above)
 * - 410 Gone if org has been deleted
 */
orgsRouter.get('/validate/:orgId', requireAuthOrDev, async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const userId = req.user?.id;
    const userOrgId = req.user?.orgId;

    if (!userId || !userOrgId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Missing user context or org_id in JWT'
      });
    }

    // Validate org_id format and existence
    const validatedOrgId = await validateAndResolveOrgId(orgId);

    // CRITICAL: Verify user's JWT org_id matches requested org
    // This prevents cross-org access attempts
    if (validatedOrgId !== userOrgId) {
      return res.status(403).json({
        error: 'Access denied',
        message: `You do not have access to organization ${orgId}. Your JWT org_id does not match.`,
        details: {
          jwtOrgId: userOrgId,
          requestedOrgId: orgId
        }
      });
    }

    if (process.env.NODE_ENV !== 'development') {
      const isMember = await validateUserOrgMembership(userId, validatedOrgId);

      if (!isMember) {
        return res.status(403).json({
          error: 'Membership verification failed',
          message: 'User is not a member of this organization',
          details: {
            userId,
            orgId: validatedOrgId
          }
        });
      }
    }

    // All checks passed
    return res.json({
      success: true,
      orgId: validatedOrgId,
      userId: userId,
      validated: true,
      message: 'Organization validation successful'
    });

  } catch (error: any) {
    console.error('[Org Validation] Error:', error);

    if (error.message?.includes('ORG_ID_MISSING')) {
      return res.status(400).json({
        error: 'Organization ID required',
        message: 'org_id parameter is missing or invalid',
        help: 'Ensure user has org_id in JWT app_metadata'
      });
    }

    if (error.message?.includes('ORG_ID_INVALID')) {
      return res.status(400).json({
        error: 'Invalid organization ID format',
        message: 'org_id must be a valid UUID'
      });
    }

    if (error.message?.includes('ORG_ID_NOT_FOUND')) {
      console.error('[Org Validation] Organization does not exist:', {
        orgId: req.params.orgId,
        userOrgId: req.user?.orgId,
        userId: req.user?.id
      });
      return res.status(404).json({
        status: 404,
        message: `Organization ${req.params.orgId} does not exist`,
        orgId: req.params.orgId,
        error: 'Not found',
        path: `/orgs/validate/${req.params.orgId}`,
        requestId: req.headers['x-request-id'],
        help: 'See MULTI_TENANT_ORG_FIX.md for debugging steps. Database trigger may not have created organization on user signup.'
      });
    }

    if (error.message?.includes('ORG_DELETED')) {
      return res.status(410).json({
        error: 'Organization has been deleted',
        message: 'The organization you are trying to access has been deleted'
      });
    }

    return res.status(500).json({
      error: 'Validation failed',
      message: error.message
    });
  }
});

export default orgsRouter;
