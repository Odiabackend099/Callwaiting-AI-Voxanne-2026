import { supabase } from './supabase-client';
import { log } from './logger';

/**
 * VapiTenantService
 * 
 * Centralized service for multi-tenant Vapi operations.
 * Handles dynamic Assistant ID lookup and caching for performance.
 */

interface AssistantCacheEntry {
    assistantId: string;
    orgId: string;
    timestamp: number;
}

export class VapiTenantService {
    private static assistantCache = new Map<string, AssistantCacheEntry>();
    private static CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    /**
     * Get Assistant ID for an organization
     * @param orgId - Organization ID
     * @returns Assistant ID or null if not configured
     */
    static async getAssistantIdForOrg(orgId: string): Promise<string | null> {
        // Check cache first
        const cached = this.assistantCache.get(`org:${orgId}`);
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
            log.debug('VapiTenantService', 'Cache hit for org', { orgId });
            return cached.assistantId;
        }

        // Fetch from database
        const { data: org, error } = await supabase
            .from('organizations')
            .select('vapi_assistant_id')
            .eq('id', orgId)
            .single();

        if (error || !org) {
            log.error('VapiTenantService', 'Failed to fetch organization', { orgId, error });
            return null;
        }

        const assistantId = org.vapi_assistant_id;

        // Cache the result
        if (assistantId) {
            this.assistantCache.set(`org:${orgId}`, {
                assistantId,
                orgId,
                timestamp: Date.now()
            });
        }

        return assistantId;
    }

    /**
     * Get Assistant ID and Org ID by inbound phone number
     * @param phoneNumber - Inbound phone number (E.164 format)
     * @returns Object with orgId and assistantId, or null if not found
     */
    static async getAssistantIdByPhone(phoneNumber: string): Promise<{ orgId: string, assistantId: string } | null> {
        // Check cache first
        const cached = this.assistantCache.get(`phone:${phoneNumber}`);
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
            log.debug('VapiTenantService', 'Cache hit for phone', { phoneNumber });
            return { orgId: cached.orgId, assistantId: cached.assistantId };
        }

        // Lookup phone number mapping
        const { data: mapping, error: mappingError } = await supabase
            .from('phone_number_mapping')
            .select('org_id')
            .eq('inbound_phone_number', phoneNumber)
            .eq('is_active', true)
            .single();

        if (mappingError || !mapping) {
            log.warn('VapiTenantService', 'Phone number not mapped to organization', { phoneNumber });
            return null;
        }

        // Fetch Assistant ID for the organization
        const assistantId = await this.getAssistantIdForOrg(mapping.org_id);

        if (!assistantId) {
            log.warn('VapiTenantService', 'Organization has no Assistant ID configured', {
                orgId: mapping.org_id,
                phoneNumber
            });
            return null;
        }

        // Cache the result
        this.assistantCache.set(`phone:${phoneNumber}`, {
            assistantId,
            orgId: mapping.org_id,
            timestamp: Date.now()
        });

        return { orgId: mapping.org_id, assistantId };
    }

    /**
     * Clear cache for an organization
     * @param orgId - Organization ID
     */
    static clearCacheForOrg(orgId: string): void {
        this.assistantCache.delete(`org:${orgId}`);

        // Also clear phone number caches for this org
        for (const [key, value] of this.assistantCache.entries()) {
            if (value.orgId === orgId) {
                this.assistantCache.delete(key);
            }
        }

        log.info('VapiTenantService', 'Cache cleared for org', { orgId });
    }

    /**
     * Clear all cache
     */
    static clearAllCache(): void {
        this.assistantCache.clear();
        log.info('VapiTenantService', 'All cache cleared');
    }
}
