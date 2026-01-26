/**
 * Centralized Credential Service
 *
 * THE ONLY WAY TO GET CREDENTIALS IN THE SYSTEM
 *
 * This service:
 * ✅ Handles all credential access with type safety
 * ✅ Manages decryption of stored credentials
 * ✅ Provides consistent error handling with clear messages
 * ✅ Enforces multi-tenant isolation via org_id
 * ✅ Logs all access for audit trails
 *
 * STRICT RULE: Never query org_credentials directly in other services.
 * Always use this service.
 */

import { createClient } from '@supabase/supabase-js';
import { EncryptionService } from './encryption';
import { log } from './logger';
import type { ProviderType } from '../types/supabase-db';

// Initialize Supabase client with service role (bypasses RLS)
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Service for centralized credential management
 * Prevents schema mismatches, decryption errors, and multi-tenant bugs
 */
export class CredentialService {
  /**
   * THE ONLY WAY TO GET CREDENTIALS
   *
   * Fetches credentials for an organization and provider, handles all edge cases,
   * and returns decrypted configuration.
   *
   * @param orgId - Organization UUID
   * @param provider - Provider type (google_calendar, twilio, vapi, etc.)
   * @returns Decrypted credential object
   * @throws Error with clear message if credentials unavailable
   *
   * @example
   * try {
   *   const creds = await CredentialService.get(orgId, 'google_calendar');
   *   // Use creds.accessToken, creds.refreshToken, etc.
   * } catch (error) {
   *   return { success: false, error: error.message };
   * }
   */
  static async get<T = Record<string, any>>(orgId: string, provider: ProviderType): Promise<T> {
    log.debug('CredentialService', 'Fetching credentials', { orgId, provider });

    // ===== STEP 1: Validate inputs =====
    if (!orgId || typeof orgId !== 'string') {
      throw new Error('[CredentialService] Invalid orgId - must be a non-empty string');
    }

    if (!provider) {
      throw new Error('[CredentialService] Invalid provider - must be specified');
    }

    // ===== STEP 2: Query org_credentials table =====
    // NOTE: Using .from('org_credentials') - NOT integrations or integration_settings
    const { data, error } = await supabase
      .from('org_credentials')
      .select('encrypted_config, is_active, last_verified_at, verification_error')
      .eq('org_id', orgId)
      .eq('provider', provider)  // Type-safe: TypeScript ensures valid provider value
      .maybeSingle();

    // ===== STEP 3: Handle database errors =====
    if (error) {
      log.error('CredentialService', 'Database error fetching credentials', {
        orgId,
        provider,
        dbError: error.message
      });
      throw new Error(
        `[CredentialService] Database error for ${provider}: ${error.message}`
      );
    }

    // ===== STEP 4: Handle missing credentials =====
    if (!data) {
      const userMessage = `[CredentialService] No ${provider} credentials found for organization ${orgId}. Please connect in dashboard settings.`;
      log.info('CredentialService', 'Credentials not found', { orgId, provider });
      throw new Error(userMessage);
    }

    // ===== STEP 5: Handle disabled integrations =====
    if (!data.is_active) {
      const userMessage = `[CredentialService] ${provider} integration is disabled for organization ${orgId}. Please enable in settings.`;
      log.warn('CredentialService', 'Integration disabled', {
        orgId,
        provider,
        lastError: data.verification_error
      });
      throw new Error(userMessage);
    }

    // ===== STEP 6: Handle corrupt/missing encrypted config =====
    if (!data.encrypted_config) {
      const userMessage = `[CredentialService] Corrupted credential data for ${provider}. Please reconnect in settings.`;
      log.error('CredentialService', 'Missing encrypted config', { orgId, provider });
      throw new Error(userMessage);
    }

    // ===== STEP 7: Decrypt credentials =====
    let decrypted: T;
    try {
      decrypted = EncryptionService.decryptObject<T>(data.encrypted_config);
    } catch (decryptError: any) {
      const userMessage = `[CredentialService] Failed to decrypt ${provider} credentials. Please reconnect in settings.`;
      log.error('CredentialService', 'Decryption failed', {
        orgId,
        provider,
        decryptError: decryptError.message
      });
      throw new Error(userMessage);
    }

    // ===== STEP 8: Validate decrypted data is not empty =====
    if (!decrypted || (typeof decrypted === 'object' && Object.keys(decrypted).length === 0)) {
      const userMessage = `[CredentialService] Empty credential configuration for ${provider}. Please reconnect in settings.`;
      log.error('CredentialService', 'Empty decrypted config', { orgId, provider });
      throw new Error(userMessage);
    }

    // ===== STEP 9: Success =====
    log.debug('CredentialService', 'Credentials retrieved successfully', {
      orgId,
      provider,
      configKeys: Object.keys(decrypted).join(', ')
    });

    return decrypted;
  }

  /**
   * Check if credentials exist WITHOUT fetching them
   * Useful for pre-flight checks before calling expensive operations
   *
   * @param orgId - Organization UUID
   * @param provider - Provider type
   * @returns true if credentials exist and are active, false otherwise
   *
   * @example
   * if (await CredentialService.exists(orgId, 'google_calendar')) {
   *   // Safe to call calendar functions
   * }
   */
  static async exists(orgId: string, provider: ProviderType): Promise<boolean> {
    try {
      log.debug('CredentialService', 'Checking if credentials exist', { orgId, provider });

      const { data } = await supabase
        .from('org_credentials')
        .select('id')
        .eq('org_id', orgId)
        .eq('provider', provider)
        .eq('is_active', true)
        .maybeSingle();

      const exists = !!data;
      log.debug('CredentialService', `Credentials exist: ${exists}`, { orgId, provider });
      return exists;
    } catch (error: any) {
      log.error('CredentialService', 'Error checking credential existence', {
        orgId,
        provider,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Get the last verification error for a credential
   * Useful for debugging why a credential fetch failed
   *
   * @param orgId - Organization UUID
   * @param provider - Provider type
   * @returns Error message if available, null otherwise
   */
  static async getLastError(orgId: string, provider: ProviderType): Promise<string | null> {
    try {
      const { data } = await supabase
        .from('org_credentials')
        .select('verification_error')
        .eq('org_id', orgId)
        .eq('provider', provider)
        .maybeSingle();

      return data?.verification_error || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Update the last verification timestamp
   * Called after successful credential usage to track integration health
   *
   * @param orgId - Organization UUID
   * @param provider - Provider type
   * @internal Only call from integration health checks
   */
  static async updateLastVerified(orgId: string, provider: ProviderType): Promise<void> {
    try {
      await supabase
        .from('org_credentials')
        .update({ last_verified_at: new Date().toISOString(), verification_error: null })
        .eq('org_id', orgId)
        .eq('provider', provider);

      log.debug('CredentialService', 'Updated last_verified_at', { orgId, provider });
    } catch (error: any) {
      log.warn('CredentialService', 'Failed to update last_verified_at', {
        orgId,
        provider,
        error: error.message
      });
    }
  }

  /**
   * Get all available providers for an organization
   * Useful for dashboard to show which integrations are configured
   *
   * @param orgId - Organization UUID
   * @returns Array of configured provider types
   */
  static async listProviders(orgId: string): Promise<ProviderType[]> {
    try {
      log.debug('CredentialService', 'Listing available providers', { orgId });

      const { data } = await supabase
        .from('org_credentials')
        .select('provider')
        .eq('org_id', orgId)
        .eq('is_active', true);

      const providers = (data || []).map(row => row.provider) as ProviderType[];
      log.debug('CredentialService', `Found ${providers.length} active integrations`, {
        orgId,
        providers
      });
      return providers;
    } catch (error: any) {
      log.error('CredentialService', 'Error listing providers', { orgId, error: error.message });
      return [];
    }
  }
}
