/**
 * Feature Flags API Routes
 * 
 * Admin and user endpoints for managing feature flags
 * 
 * Priority 9: Developer Operations
 * Created: 2026-01-28
 */

import { Router } from 'express';
import { FeatureFlagService } from '../services/feature-flags';
import { authenticateUser } from '../middleware/auth';

const router = Router();

/**
 * GET /api/feature-flags
 * Get all feature flags (admin only)
 */
router.get('/', authenticateUser, async (req, res) => {
  try {
    // TODO: Add admin role check
    const flags = await FeatureFlagService.getAllFlags();
    
    res.json({
      success: true,
      flags,
      count: flags.length,
    });
  } catch (error) {
    console.error('Error fetching feature flags:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch feature flags',
    });
  }
});

/**
 * GET /api/feature-flags/enabled
 * Get enabled features for current organization
 */
router.get('/enabled', authenticateUser, async (req, res) => {
  try {
    const orgId = req.user?.org_id;
    
    if (!orgId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    const features = await FeatureFlagService.getOrgEnabledFeatures(orgId);
    
    res.json({
      success: true,
      features,
      count: features.length,
    });
  } catch (error) {
    console.error('Error fetching enabled features:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch enabled features',
    });
  }
});

/**
 * GET /api/feature-flags/:flagKey/check
 * Check if specific feature is enabled for current organization
 */
router.get('/:flagKey/check', authenticateUser, async (req, res) => {
  try {
    const { flagKey } = req.params;
    const orgId = req.user?.org_id;
    
    if (!orgId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    const isEnabled = await FeatureFlagService.isEnabled(orgId, flagKey);
    
    res.json({
      success: true,
      flag_key: flagKey,
      enabled: isEnabled,
    });
  } catch (error) {
    console.error('Error checking feature flag:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check feature flag',
    });
  }
});

/**
 * GET /api/feature-flags/org/overrides
 * Get organization-specific overrides
 */
router.get('/org/overrides', authenticateUser, async (req, res) => {
  try {
    const orgId = req.user?.org_id;
    
    if (!orgId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    const overrides = await FeatureFlagService.getOrgOverrides(orgId);
    
    res.json({
      success: true,
      overrides,
      count: overrides.length,
    });
  } catch (error) {
    console.error('Error fetching org overrides:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch org overrides',
    });
  }
});

/**
 * POST /api/feature-flags/:flagKey/enable
 * Enable feature for current organization (admin only)
 */
router.post('/:flagKey/enable', authenticateUser, async (req, res) => {
  try {
    const { flagKey } = req.params;
    const orgId = req.user?.org_id;
    
    if (!orgId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    // TODO: Add admin role check
    await FeatureFlagService.enableForOrg(orgId, flagKey);
    
    res.json({
      success: true,
      message: `Feature "${flagKey}" enabled for organization`,
      flag_key: flagKey,
      enabled: true,
    });
  } catch (error) {
    console.error('Error enabling feature flag:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to enable feature flag',
    });
  }
});

/**
 * POST /api/feature-flags/:flagKey/disable
 * Disable feature for current organization (admin only)
 */
router.post('/:flagKey/disable', authenticateUser, async (req, res) => {
  try {
    const { flagKey } = req.params;
    const orgId = req.user?.org_id;
    
    if (!orgId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    // TODO: Add admin role check
    await FeatureFlagService.disableForOrg(orgId, flagKey);
    
    res.json({
      success: true,
      message: `Feature "${flagKey}" disabled for organization`,
      flag_key: flagKey,
      enabled: false,
    });
  } catch (error) {
    console.error('Error disabling feature flag:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disable feature flag',
    });
  }
});

/**
 * DELETE /api/feature-flags/:flagKey/override
 * Remove organization override (revert to global settings)
 */
router.delete('/:flagKey/override', authenticateUser, async (req, res) => {
  try {
    const { flagKey } = req.params;
    const orgId = req.user?.org_id;
    
    if (!orgId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    // TODO: Add admin role check
    await FeatureFlagService.removeOrgOverride(orgId, flagKey);
    
    res.json({
      success: true,
      message: `Override removed for "${flagKey}", using global settings`,
      flag_key: flagKey,
    });
  } catch (error) {
    console.error('Error removing override:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove override',
    });
  }
});

/**
 * PATCH /api/feature-flags/:flagKey
 * Update global feature flag settings (super admin only)
 */
router.patch('/:flagKey', authenticateUser, async (req, res) => {
  try {
    const { flagKey } = req.params;
    const { enabled_globally, rollout_percentage } = req.body;
    
    // TODO: Add super admin role check
    
    await FeatureFlagService.updateGlobalFlag(flagKey, {
      enabled_globally,
      rollout_percentage,
    });
    
    res.json({
      success: true,
      message: `Feature flag "${flagKey}" updated`,
      flag_key: flagKey,
      updates: { enabled_globally, rollout_percentage },
    });
  } catch (error) {
    console.error('Error updating feature flag:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update feature flag',
    });
  }
});

/**
 * POST /api/feature-flags/cache/clear
 * Clear feature flag cache (admin only)
 */
router.post('/cache/clear', authenticateUser, async (req, res) => {
  try {
    // TODO: Add admin role check
    
    FeatureFlagService.clearCache();
    
    res.json({
      success: true,
      message: 'Feature flag cache cleared',
    });
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache',
    });
  }
});

/**
 * GET /api/feature-flags/cache/stats
 * Get cache statistics (monitoring)
 */
router.get('/cache/stats', authenticateUser, async (req, res) => {
  try {
    const stats = FeatureFlagService.getCacheStats();
    
    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Error fetching cache stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cache stats',
    });
  }
});

export default router;
