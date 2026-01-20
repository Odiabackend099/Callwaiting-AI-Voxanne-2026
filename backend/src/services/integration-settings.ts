import { config } from '../config/index';
import { getApiKey } from './secrets-manager';
import { supabase } from './supabase-client';

export interface TwilioCredentials {
    accountSid: string;
    authToken: string;
    phoneNumber: string;
    whatsappNumber?: string;
}

export interface GoogleCredentials {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
}

export interface VapiCredentials {
    apiKey: string;
    assistantId: string;
    phoneNumberId?: string;
}

/**
 * Service to fetch and validate integration settings for a specific organization.
 * Wraps the low-level SecretsManager to provide typed, validated credentials.
 */
export class IntegrationSettingsService {

    /**
     * Get Twilio credentials for an organization
     * Throws error if not found or incomplete
     */
    static async getTwilioCredentials(orgId: string): Promise<TwilioCredentials> {
        const keys = await getApiKey('twilio', orgId);

        if (!keys) {
            throw new Error(`Twilio integration not configured for org ${orgId}`);
        }

        if (!keys.accountSid || !keys.authToken || !keys.phoneNumber) {
            throw new Error(`Incomplete Twilio configuration for org ${orgId}`);
        }

        return {
            accountSid: keys.accountSid,
            authToken: keys.authToken,
            phoneNumber: keys.phoneNumber,
            whatsappNumber: keys.whatsappNumber
        };
    }

    /**
     * Get Google OAuth credentials for an organization
     */
    static async getGoogleCredentials(orgId: string): Promise<GoogleCredentials> {
        const keys = await getApiKey('google', orgId);

        if (!keys) {
            throw new Error(`Google integration not configured for org ${orgId}`);
        }

        if (!keys.clientId || !keys.clientSecret) {
            throw new Error(`Incomplete Google configuration for org ${orgId}`);
        }

        return {
            clientId: keys.clientId,
            clientSecret: keys.clientSecret,
            redirectUri: keys.redirectUri || process.env.GOOGLE_REDIRECT_URI || ''
        };
    }

    /**
     * Get Vapi credentials for an organization
     * MULTI-TENANT: Fetches Assistant ID from organizations table
     *
     * Fallback Chain:
     * 1. Org-specific Vapi integration (if custom key configured)
     * 2. Organization record with Vapi Assistant ID + platform key
     * 3. Platform-level Vapi key (as last resort for bootstrapping)
     *
     * This ensures the system can work even if org record is incomplete.
     */
    static async getVapiCredentials(orgId: string): Promise<VapiCredentials> {
        // Step 1: Check for org-specific Vapi integration in integrations table
        const keys = await getApiKey('vapi', orgId);

        if (keys && keys.apiKey) {
            return {
                apiKey: keys.apiKey,
                assistantId: keys.assistantId,
                phoneNumberId: keys.phoneNumberId
            };
        }

        // Step 2: Fetch Assistant ID from organizations table (BYOA architecture)
        const { data: org, error: orgError } = await supabase
            .from('organizations')
            .select('vapi_assistant_id, vapi_phone_number_id')
            .eq('id', orgId)
            .single();

        // Step 3: Use platform-level Vapi Private Key (always available)
        const platformKey = config.VAPI_PRIVATE_KEY;
        
        if (!platformKey) {
            throw new Error(`Platform Vapi Private Key not configured. Set VAPI_PRIVATE_KEY in environment variables.`);
        }

        // If org not found, return platform key with placeholder assistantId
        // This allows the system to work during org creation
        if (orgError || !org) {
            console.warn(`[IntegrationSettingsService] Org ${orgId} not found; using platform key with temporary assistant ID`);
            return {
                apiKey: platformKey,
                assistantId: '', // Will be populated during agent creation
                phoneNumberId: undefined
            };
        }

        // If org found but no assistant ID, return platform key
        // Assistant ID will be populated during ensureAssistant()
        if (!org.vapi_assistant_id) {
            return {
                apiKey: platformKey,
                assistantId: '', // Will be populated during agent creation
                phoneNumberId: org.vapi_phone_number_id || undefined
            };
        }

        // Normal case: org has assistant ID
        return {
            apiKey: platformKey,
            assistantId: org.vapi_assistant_id,
            phoneNumberId: org.vapi_phone_number_id || undefined
        };
    }

    /**
     * Resolve Org ID from Vapi Assistant ID
     * Uses a cache (TODO) or DB lookup
     */
    static async resolveOrgIdFromAssistantId(assistantId: string): Promise<string | null> {
        // 1. Try to find an org that has this assistantId in its 'vapi' integration settings
        // Note: This query is inefficient without a specific index or cache. 
        // Ideally, we store assistant_id -> org_id mapping in a dedicated lookup table or cache.

        // For now, simpler approach: Check agent configuration map if it exists
        // Or assume the webhook metadata contains orgId (best practice)

        // Attempt DB lookup in integration_settings (slow scan, but correct)
        // We need to look inside the encrypted/JSON blob, which is hard.

        // BETTER APPROACH: The Vapi Webhook payload usually includes metadata we attached.
        // If not, we rely on a specific lookup table.

        // Let's defer to the "Phase 3" plan for a robust lookup.
        // However, if we need it *now*, we might return null to force caller to check metadata.
        return null;
    }
}
