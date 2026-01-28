/**
 * Simple in-memory cache for MVP performance
 * No external dependencies (Redis not required for MVP)
 * Thread-safe with TTL support
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class InMemoryCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private hits: number = 0;
  private misses: number = 0;

  constructor() {
    // Cleanup expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Get value from cache
   * @param key Cache key
   * @returns Cached value or null if expired/missing
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    this.hits++;
    return entry.value as T;
  }

  /**
   * Set value in cache
   * @param key Cache key
   * @param value Value to cache
   * @param ttlSeconds Time to live in seconds (default: 5 minutes)
   */
  set<T>(key: string, value: T, ttlSeconds: number = 300): void {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.cache.set(key, { value, expiresAt });
  }

  /**
   * Delete cache entry
   * @param key Cache key
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get cache performance statistics
   * @returns Cache stats including hit/miss rates
   */
  getStats(): { size: number; hits: number; misses: number; hitRate: number } {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? Math.round((this.hits / total) * 10000) / 100 : 0 // Percentage with 2 decimal places
    };
  }

  /**
   * Reset cache statistics (useful for testing)
   */
  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`[Cache] Cleaned up ${removed} expired entries`);
    }
  }

  /**
   * Destroy cache and cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }
}

// Singleton instance
const cache = new InMemoryCache();

/**
 * Get cached value
 */
export function getCached<T>(key: string): T | null {
  return cache.get<T>(key);
}

/**
 * Set cached value
 */
export function setCached<T>(key: string, value: T, ttlSeconds?: number): void {
  cache.set<T>(key, value, ttlSeconds);
}

/**
 * Delete cached value
 */
export function deleteCached(key: string): void {
  cache.delete(key);
}

/**
 * Clear all cache
 */
export function clearCache(): void {
  cache.clear();
}

/**
 * Get cache statistics including performance metrics
 * @returns Cache stats with hit/miss rates
 */
export function getCacheStats(): { size: number; hits: number; misses: number; hitRate: number } {
  return cache.getStats();
}

export default cache;

// ============================================================================
// HIGH-VALUE CACHE FUNCTIONS (Priority 6 Implementation)
// ============================================================================

import { supabase } from './supabase-client';

/**
 * Get cached service pricing for an organization
 * Eliminates 50+ DB queries per hour for frequently accessed pricing data
 * @param orgId Organization ID
 * @returns Array of services or empty array
 */
export async function getCachedServicePricing(orgId: string) {
  const cacheKey = `services:${orgId}`;
  const cached = getCached<any[]>(cacheKey);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('services')
    .select('id, name, price, keywords, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Cache for 1 hour (services rarely change)
  setCached(cacheKey, data || [], 3600);
  return data || [];
}

/**
 * Invalidate service pricing cache when services are modified
 * Call this after create/update/delete operations
 * @param orgId Organization ID
 */
export function invalidateServiceCache(orgId: string): void {
  deleteCached(`services:${orgId}`);
}

/**
 * Get cached inbound agent configuration
 * Eliminates DB query on every incoming call
 * @param orgId Organization ID
 * @returns Inbound agent config or null
 */
export async function getCachedInboundConfig(orgId: string) {
  const cacheKey = `inbound-config:${orgId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('inbound_agent_config')
    .select('id, twilio_phone_number, vapi_assistant_id')
    .eq('org_id', orgId)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows returned (not an error, just no config yet)
    throw error;
  }

  // Cache for 5 minutes (configs change infrequently but need to be fresh)
  setCached(cacheKey, data || null, 300);
  return data || null;
}

/**
 * Invalidate inbound config cache when configuration is modified
 * @param orgId Organization ID
 */
export function invalidateInboundConfigCache(orgId: string): void {
  deleteCached(`inbound-config:${orgId}`);
}

/**
 * Get cached organization settings
 * Eliminates repeated queries for integration settings
 * @param orgId Organization ID
 * @returns Organization settings or null
 */
export async function getCachedOrgSettings(orgId: string) {
  const cacheKey = `org-settings:${orgId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('integration_settings')
    .select('*')
    .eq('org_id', orgId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  // Cache for 10 minutes (settings change infrequently)
  setCached(cacheKey, data || null, 600);
  return data || null;
}

/**
 * Invalidate organization settings cache when settings are modified
 * @param orgId Organization ID
 */
export function invalidateOrgSettingsCache(orgId: string): void {
  deleteCached(`org-settings:${orgId}`);
}

/**
 * Get cached agent list for organization
 * Eliminates 50+ DB queries per hour for agent dropdowns
 * @param orgId Organization ID
 * @returns Array of agents or empty array
 */
export async function getCachedAgentList(orgId: string) {
  const cacheKey = `agents:${orgId}`;
  const cached = getCached<any[]>(cacheKey);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('user_org_roles')
    .select('user_id, role, created_at')
    .eq('org_id', orgId)
    .eq('role', 'agent')
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Cache for 10 minutes (agent list changes infrequently)
  setCached(cacheKey, data || [], 600);
  return data || [];
}

/**
 * Invalidate agent list cache when agents are added/removed
 * @param orgId Organization ID
 */
export function invalidateAgentCache(orgId: string): void {
  deleteCached(`agents:${orgId}`);
}

/**
 * Get cached phone number mapping
 * Eliminates frequent queries for call routing
 * @param vapiPhoneId Vapi phone ID
 * @returns Phone mapping or null
 */
export async function getCachedPhoneMapping(vapiPhoneId: string) {
  const cacheKey = `phone-mapping:${vapiPhoneId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('phone_number_mapping')
    .select('*')
    .eq('vapi_phone_id', vapiPhoneId)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows returned (not an error, just no mapping yet)
    throw error;
  }

  // Cache for 30 minutes (phone mappings rarely change)
  setCached(cacheKey, data || null, 1800);
  return data || null;
}

/**
 * Invalidate phone mapping cache when mappings are modified
 * @param vapiPhoneId Vapi phone ID
 */
export function invalidatePhoneMappingCache(vapiPhoneId: string): void {
  deleteCached(`phone-mapping:${vapiPhoneId}`);
}

/**
 * Get cached contact statistics for dashboard
 * Eliminates repeated full table scans for contact counts
 * @param orgId Organization ID
 * @returns Contact stats object
 */
export async function getCachedContactStats(orgId: string) {
  const cacheKey = `contact-stats:${orgId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  // Use database aggregation instead of JavaScript filtering (more efficient)
  const [total, hot, warm, cold] = await Promise.all([
    supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
    supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('lead_status', 'hot'),
    supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('lead_status', 'warm'),
    supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('lead_status', 'cold')
  ]);

  const stats = {
    total_leads: total.count || 0,
    hot_leads: hot.count || 0,
    warm_leads: warm.count || 0,
    cold_leads: cold.count || 0
  };

  // Cache for 5 minutes
  setCached(cacheKey, stats, 300);
  return stats;
}

/**
 * Invalidate contact stats cache when contacts are modified
 * @param orgId Organization ID
 */
export function invalidateContactStatsCache(orgId: string): void {
  deleteCached(`contact-stats:${orgId}`);
}
