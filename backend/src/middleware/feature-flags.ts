/**
 * Feature Flag Middleware
 * 
 * Express middleware to protect routes behind feature flags
 * 
 * Priority 9: Developer Operations
 * Created: 2026-01-28
 */

import { Request, Response, NextFunction } from 'express';
import { FeatureFlagService } from '../services/feature-flags';

/**
 * Middleware to check if feature is enabled for organization
 * 
 * Usage:
 * router.get('/advanced-reports',
 *   authenticateUser,
 *   requireFeature('advanced_analytics'),
 *   async (req, res) => { ... }
 * );
 */
export function requireFeature(flagKey: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Extract org_id from authenticated user
      const orgId = req.user?.org_id;

      if (!orgId) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      // Check if feature is enabled
      const isEnabled = await FeatureFlagService.isEnabled(orgId, flagKey);

      if (!isEnabled) {
        return res.status(403).json({
          error: 'Feature not available',
          message: `The feature "${flagKey}" is not enabled for your organization. Please contact support to enable this feature.`,
          feature_key: flagKey,
        });
      }

      // Feature is enabled, proceed to next middleware
      next();
    } catch (error) {
      console.error(`Feature flag middleware error for ${flagKey}:`, error);
      
      // Fail closed - deny access on error
      return res.status(500).json({
        error: 'Internal server error',
        message: 'Unable to verify feature access',
      });
    }
  };
}

/**
 * Middleware to check multiple features (requires ALL to be enabled)
 * 
 * Usage:
 * router.post('/ai-campaign',
 *   authenticateUser,
 *   requireAllFeatures(['sms_campaigns', 'ai_voice_cloning']),
 *   async (req, res) => { ... }
 * );
 */
export function requireAllFeatures(flagKeys: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.user?.org_id;

      if (!orgId) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      // Check all features
      const results = await Promise.all(
        flagKeys.map(flagKey => FeatureFlagService.isEnabled(orgId, flagKey))
      );

      const allEnabled = results.every(enabled => enabled);

      if (!allEnabled) {
        const disabledFeatures = flagKeys.filter((_, index) => !results[index]);
        
        return res.status(403).json({
          error: 'Features not available',
          message: `The following features are required but not enabled: ${disabledFeatures.join(', ')}`,
          disabled_features: disabledFeatures,
        });
      }

      next();
    } catch (error) {
      console.error('Feature flag middleware error:', error);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'Unable to verify feature access',
      });
    }
  };
}

/**
 * Middleware to check multiple features (requires ANY to be enabled)
 * 
 * Usage:
 * router.post('/send-message',
 *   authenticateUser,
 *   requireAnyFeature(['sms_campaigns', 'email_campaigns']),
 *   async (req, res) => { ... }
 * );
 */
export function requireAnyFeature(flagKeys: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.user?.org_id;

      if (!orgId) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      // Check all features
      const results = await Promise.all(
        flagKeys.map(flagKey => FeatureFlagService.isEnabled(orgId, flagKey))
      );

      const anyEnabled = results.some(enabled => enabled);

      if (!anyEnabled) {
        return res.status(403).json({
          error: 'Features not available',
          message: `At least one of the following features is required: ${flagKeys.join(', ')}`,
          required_features: flagKeys,
        });
      }

      next();
    } catch (error) {
      console.error('Feature flag middleware error:', error);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'Unable to verify feature access',
      });
    }
  };
}

/**
 * Middleware to attach enabled features to request object
 * Useful for conditional rendering in responses
 * 
 * Usage:
 * router.get('/dashboard',
 *   authenticateUser,
 *   attachEnabledFeatures,
 *   async (req, res) => {
 *     res.json({
 *       data: dashboardData,
 *       features: req.enabledFeatures // Available features
 *     });
 *   }
 * );
 */
export async function attachEnabledFeatures(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const orgId = req.user?.org_id;

    if (!orgId) {
      req.enabledFeatures = [];
      return next();
    }

    const features = await FeatureFlagService.getOrgEnabledFeatures(orgId);
    req.enabledFeatures = features;

    next();
  } catch (error) {
    console.error('Error attaching enabled features:', error);
    req.enabledFeatures = [];
    next();
  }
}

// Extend Express Request type to include enabledFeatures
declare global {
  namespace Express {
    interface Request {
      enabledFeatures?: Array<{
        flag_key: string;
        flag_name: string;
        description: string;
      }>;
    }
  }
}
