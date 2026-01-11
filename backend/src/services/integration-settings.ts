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
     */
    static async getVapiCredentials(orgId: string): Promise<VapiCredentials> {
        // Vapi might be configured per-org or global fallback
        // For now, check per-org
        const keys = await getApiKey('vapi', orgId);

        if (keys && keys.apiKey) {
            return {
                apiKey: keys.apiKey,
                assistantId: keys.assistantId,
                phoneNumberId: keys.phoneNumberId
            };
        }

        // Fallback to global env keys (if allowed/configured)
        // This supports the transition period or "platform" defaults
        if (process.env.VAPI_API_KEY) {
            return {
                apiKey: process.env.VAPI_API_KEY,
                assistantId: process.env.VAPI_ASSISTANT_ID!,
                phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID
            };
        }

        throw new Error(`Vapi configuration not found for org ${orgId} and no global default.`);
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
