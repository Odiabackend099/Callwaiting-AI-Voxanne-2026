/**
 * Feature Flags Service
 * 
 * Provides centralized feature flag management with:
 * - Organization-specific overrides
 * - Gradual rollout (percentage-based)
 * - Caching for performance
 * - Audit logging
 * 
 * Priority 9: Developer Operations
 * Created: 2026-01-28
 */

import { supabase } from '../config/supabase';

export interface FeatureFlag {
  flag_key: string;
  flag_name: string;
  description: string;
  enabled_globally: boolean;
  rollout_percentage: number;
}

export interface OrgFeatureFlag {
  org_id: string;
  flag_key: string;
  enabled: boolean;
}

export interface EnabledFeature {
  flag_key: string;
  flag_name: string;
  description: string;
}

// In-memory cache for feature flags (TTL: 5 minutes)
const featureFlagCache = new Map<string, { value: boolean; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export class FeatureFlagService {
  /**
   * Check if feature is enabled for organization
   * Uses caching to minimize database queries
   */
  static async isEnabled(orgId: string, flagKey: string): Promise<boolean> {
    const cacheKey = `${orgId}:${flagKey}`;
    const cached = featureFlagCache.get(cacheKey);

    // Return cached value if still valid
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.value;
    }

    try {
      const { data, error } = await supabase.rpc('is_feature_enabled', {
        p_org_id: orgId,
        p_flag_key: flagKey,
      });

      if (error) {
        console.error(`Feature flag check failed for ${flagKey}:`, error);
        return false; // Fail closed - disable feature on error
      }

      const isEnabled = data === true;

      // Cache the result
      featureFlagCache.set(cacheKey, {
        value: isEnabled,
        timestamp: Date.now(),
      });

      return isEnabled;
    } catch (error) {
      console.error(`Feature flag check exception for ${flagKey}:`, error);
      return false; // Fail closed
    }
  }

  /**
   * Get all enabled features for organization
   */
  static async getOrgEnabledFeatures(orgId: string): Promise<EnabledFeature[]> {
    try {
      const { data, error } = await supabase.rpc('get_org_enabled_features', {
        p_org_id: orgId,
      });

      if (error) {
        console.error('Failed to fetch enabled features:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Exception fetching enabled features:', error);
      return [];
    }
  }

  /**
   * Get all feature flags (admin use)
   */
  static async getAllFlags(): Promise<FeatureFlag[]> {
    try {
      const { data, error } = await supabase
        .from('feature_flags')
        .select('*')
        .order('flag_name');

      if (error) {
        console.error('Failed to fetch feature flags:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Exception fetching feature flags:', error);
      return [];
    }
  }

  /**
   * Enable feature for specific organization (override)
   */
  static async enableForOrg(orgId: string, flagKey: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('org_feature_flags')
        .upsert({
          org_id: orgId,
          flag_key: flagKey,
          enabled: true,
          updated_at: new Date().toISOString(),
        });

      if (error) {
        throw new Error(`Failed to enable feature ${flagKey}: ${error.message}`);
      }

      // Invalidate cache
      featureFlagCache.delete(`${orgId}:${flagKey}`);
    } catch (error) {
      console.error(`Failed to enable feature ${flagKey} for org ${orgId}:`, error);
      throw error;
    }
  }

  /**
   * Disable feature for specific organization (override)
   */
  static async disableForOrg(orgId: string, flagKey: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('org_feature_flags')
        .upsert({
          org_id: orgId,
          flag_key: flagKey,
          enabled: false,
          updated_at: new Date().toISOString(),
        });

      if (error) {
        throw new Error(`Failed to disable feature ${flagKey}: ${error.message}`);
      }

      // Invalidate cache
      featureFlagCache.delete(`${orgId}:${flagKey}`);
    } catch (error) {
      console.error(`Failed to disable feature ${flagKey} for org ${orgId}:`, error);
      throw error;
    }
  }

  /**
   * Remove organization override (revert to global settings)
   */
  static async removeOrgOverride(orgId: string, flagKey: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('org_feature_flags')
        .delete()
        .match({ org_id: orgId, flag_key: flagKey });

      if (error) {
        throw new Error(`Failed to remove override for ${flagKey}: ${error.message}`);
      }

      // Invalidate cache
      featureFlagCache.delete(`${orgId}:${flagKey}`);
    } catch (error) {
      console.error(`Failed to remove override for ${flagKey}:`, error);
      throw error;
    }
  }

  /**
   * Update global feature flag settings (admin use)
   */
  static async updateGlobalFlag(
    flagKey: string,
    updates: {
      enabled_globally?: boolean;
      rollout_percentage?: number;
    }
  ): Promise<void> {
    try {
      const { error } = await supabase.rpc('update_feature_flag', {
        p_flag_key: flagKey,
        p_enabled_globally: updates.enabled_globally ?? null,
        p_rollout_percentage: updates.rollout_percentage ?? null,
      });

      if (error) {
        throw new Error(`Failed to update feature flag ${flagKey}: ${error.message}`);
      }

      // Clear entire cache since global settings changed
      featureFlagCache.clear();
    } catch (error) {
      console.error(`Failed to update feature flag ${flagKey}:`, error);
      throw error;
    }
  }

  /**
   * Get organization-specific overrides
   */
  static async getOrgOverrides(orgId: string): Promise<OrgFeatureFlag[]> {
    try {
      const { data, error } = await supabase
        .from('org_feature_flags')
        .select('*')
        .eq('org_id', orgId);

      if (error) {
        console.error('Failed to fetch org overrides:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Exception fetching org overrides:', error);
      return [];
    }
  }

  /**
   * Clear feature flag cache (use after bulk updates)
   */
  static clearCache(): void {
    featureFlagCache.clear();
  }

  /**
   * Get cache statistics (monitoring)
   */
  static getCacheStats(): {
    size: number;
    entries: Array<{ key: string; age: number }>;
  } {
    const entries = Array.from(featureFlagCache.entries()).map(([key, value]) => ({
      key,
      age: Date.now() - value.timestamp,
    }));

    return {
      size: featureFlagCache.size,
      entries,
    };
  }
}
