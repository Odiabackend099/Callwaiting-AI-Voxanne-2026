/**
 * IntegrationDecryptor Service
 *
 * SINGLE SOURCE OF TRUTH for retrieving and decrypting BYOC credentials.
 * Implements caching, error handling, and security best practices.
 *
 * This service is designed to be the only interface between the backend
 * and encrypted credentials in the database. All credential access must
 * go through this service to ensure:
 * 1. Consistent encryption/decryption
 * 2. Performance via caching
 * 3. Audit logging of credential access
 * 4. Automatic cache invalidation on updates
 */

import { EncryptionService } from './encryption';
import { createClient } from '@supabase/supabase-js';
import { log } from './logger';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: false,
    },
  }
);

// ============================================
// Type Definitions
// ============================================

export interface VapiCredentials {
  apiKey: string;
  webhookSecret?: string;
  phoneNumberId?: string;
}

export interface TwilioCredentials {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
  whatsappNumber?: string;
  testPhoneNumber?: string;
}

export interface GoogleCalendarCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface ResendCredentials {
  apiKey: string;
}

export interface ElevenLabsCredentials {
  apiKey: string;
}

// Cache entry with TTL tracking
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// Credential verification result
export interface VerificationResult {
  success: boolean;
  lastVerified?: string;
  error?: string;
}

// ============================================
// In-Memory Cache Configuration
// ============================================

const credentialCache = new Map<string, CacheEntry<any>>();
const CACHE_TTL_MS = 30 * 1000; // 30 seconds (reduced from 5 minutes for security)
const MAX_CACHE_SIZE = 1000; // Prevent unbounded memory growth

// ============================================
// IntegrationDecryptor Class
// ============================================

export class IntegrationDecryptor {
  /**
   * Retrieve and decrypt Vapi credentials for an organization
   *
   * @param orgId - Organization ID
   * @returns VapiCredentials object with decrypted API key
   * @throws Error if credentials not found or decryption fails
   */
  static async getVapiCredentials(orgId: string): Promise<VapiCredentials> {
    return this.getCredentials<VapiCredentials>(orgId, 'vapi', (decrypted) => {
      // Handle multiple possible field names for backward compatibility
      const apiKey =
        decrypted.apiKey ||
        decrypted.vapi_api_key ||
        decrypted.vapi_secret_key;

      if (!apiKey) {
        throw new Error('Vapi API key missing in credentials');
      }

      return {
        apiKey: apiKey.trim(),
        webhookSecret:
          decrypted.webhookSecret ||
          decrypted.vapi_webhook_secret,
        phoneNumberId:
          decrypted.phoneNumberId ||
          decrypted.vapi_phone_number_id,
      };
    });
  }

  /**
   * Retrieve and decrypt Twilio credentials for an organization
   *
   * @param orgId - Organization ID
   * @returns TwilioCredentials object with decrypted credentials
   * @throws Error if credentials not found or decryption fails
   */
  static async getTwilioCredentials(orgId: string): Promise<TwilioCredentials> {
    return this.getCredentials<TwilioCredentials>(
      orgId,
      'TWILIO',
      (decrypted) => {
        // Handle multiple possible field names
        const accountSid =
          decrypted.accountSid || decrypted.twilio_account_sid;
        const authToken =
          decrypted.authToken || decrypted.twilio_auth_token;
        const phoneNumber =
          decrypted.phoneNumber || decrypted.twilio_from_number;

        if (!accountSid || !authToken || !phoneNumber) {
          throw new Error('Incomplete Twilio credentials');
        }

        return {
          accountSid: accountSid.trim(),
          authToken: authToken.trim(),
          phoneNumber: phoneNumber.trim(),
          whatsappNumber:
            decrypted.whatsappNumber ||
            decrypted.twilio_whatsapp_number,
          testPhoneNumber:
            decrypted.testPhoneNumber ||
            decrypted.test_destination_number,
        };
      }
    );
  }

  /**
   * Retrieve and decrypt Google Calendar credentials
   * Automatically handles token refresh if expired
   *
   * @param orgId - Organization ID
   * @returns GoogleCalendarCredentials with valid tokens
   * @throws Error if credentials not found or token refresh fails
   */
  static async getGoogleCalendarCredentials(
    orgId: string,
    allowExpired: boolean = false
  ): Promise<GoogleCalendarCredentials> {
    const credentials = await this.getCredentials<GoogleCalendarCredentials>(
      orgId,
      'google_calendar',
      (decrypted) => {
        if (!decrypted.accessToken || !decrypted.refreshToken) {
          throw new Error('Incomplete Google Calendar credentials');
        }

        return {
          accessToken: decrypted.access_token || decrypted.accessToken,
          refreshToken: decrypted.refresh_token || decrypted.refreshToken,
          expiresAt: decrypted.expires_at || decrypted.expiresAt,
        };
      }
    );

    // Check if token is expired
    const expiresAt = new Date(credentials.expiresAt);
    if (expiresAt < new Date() && !allowExpired) {
      log.info('IntegrationDecryptor', 'Google token expired, needs refresh', {
        orgId,
        expiresAt: credentials.expiresAt,
      });

      // Invalidate cache to force refresh on next call
      this.invalidateCache(orgId, 'google_calendar');

      throw new Error(
        'Google Calendar token expired. Please reconnect your Google account.'
      );
    }

    return credentials;
  }

  /**
   * Retrieve and decrypt Resend credentials
   *
   * @param orgId - Organization ID
   * @returns ResendCredentials with API key
   * @throws Error if credentials not found
   */
  static async getResendCredentials(orgId: string): Promise<ResendCredentials> {
    return this.getCredentials<ResendCredentials>(orgId, 'resend', (decrypted) => {
      const apiKey = decrypted.apiKey || decrypted.resend_api_key;

      if (!apiKey) {
        throw new Error('Resend API key missing in credentials');
      }

      return {
        apiKey: apiKey.trim(),
      };
    });
  }

  /**
   * Retrieve and decrypt ElevenLabs credentials
   *
   * @param orgId - Organization ID
   * @returns ElevenLabsCredentials with API key
   * @throws Error if credentials not found
   */
  static async getElevenLabsCredentials(
    orgId: string
  ): Promise<ElevenLabsCredentials> {
    return this.getCredentials<ElevenLabsCredentials>(
      orgId,
      'elevenlabs',
      (decrypted) => {
        const apiKey =
          decrypted.apiKey || decrypted.elevenlabs_api_key;

        if (!apiKey) {
          throw new Error('ElevenLabs API key missing in credentials');
        }

        return {
          apiKey: apiKey.trim(),
        };
      }
    );
  }

  /**
   * Resolve organization ID from Vapi assistant ID
   * Uses assistant_org_mapping table for O(1) lookup
   *
   * @param assistantId - Vapi assistant ID
   * @returns Organization ID or null if mapping not found
   */
  static async resolveOrgFromAssistant(
    assistantId: string
  ): Promise<string | null> {
    if (!assistantId) {
      return null;
    }

    const cacheKey = `assistant:${assistantId}`;
    const cached = credentialCache.get(cacheKey);

    // Check cache first
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      log.debug('IntegrationDecryptor', 'Cache hit for assistant mapping', {
        assistantId,
      });
      return cached.data;
    }

    try {
      // Query assistant_org_mapping table
      const { data, error } = await supabase
        .from('assistant_org_mapping')
        .select('org_id')
        .eq('vapi_assistant_id', assistantId)
        .maybeSingle();

      if (error) {
        log.error('IntegrationDecryptor', 'Database error resolving org from assistant', {
          assistantId,
          error: error.message,
        });
        return null;
      }

      if (!data) {
        log.warn('IntegrationDecryptor', 'No org mapping found for assistant', {
          assistantId,
        });
        return null;
      }

      const orgId = data.org_id;

      // Update cache
      credentialCache.set(cacheKey, {
        data: orgId,
        timestamp: Date.now(),
      });

      // Update last_used_at for debugging
      const { error: updateError } = await supabase
        .from('assistant_org_mapping')
        .update({ last_used_at: new Date().toISOString() })
        .eq('vapi_assistant_id', assistantId);

      if (updateError) {
        // Non-critical error - don't throw
        log.warn('IntegrationDecryptor', 'Failed to update assistant last_used_at', {
          assistantId,
          error: updateError.message,
        });
      } else {
        log.debug('IntegrationDecryptor', 'Updated assistant last_used_at', {
          assistantId,
        });
      }

      return orgId;
    } catch (error: any) {
      log.error('IntegrationDecryptor', 'Error resolving org from assistant', {
        assistantId,
        error: error?.message,
      });
      return null;
    }
  }

  /**
   * Register a mapping between Vapi assistant ID and organization
   * Called after creating or updating a Vapi assistant
   *
   * @param assistantId - Vapi assistant ID
   * @param orgId - Organization ID
   * @param role - Assistant role (inbound/outbound)
   * @param assistantName - Optional assistant name for debugging
   * @throws Error if registration fails
   */
  static async registerAssistantMapping(
    assistantId: string,
    orgId: string,
    role: 'inbound' | 'outbound',
    assistantName?: string
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('assistant_org_mapping')
        .upsert(
          {
            vapi_assistant_id: assistantId,
            org_id: orgId,
            assistant_role: role,
            assistant_name: assistantName || `${role}-assistant`,
            last_used_at: new Date().toISOString(),
          },
          { onConflict: 'vapi_assistant_id' }
        );

      if (error) {
        throw error;
      }

      // Invalidate cache
      const cacheKey = `assistant:${assistantId}`;
      credentialCache.delete(cacheKey);

      log.info('IntegrationDecryptor', 'Assistant mapping registered', {
        assistantId,
        orgId,
        role,
        assistantName,
      });
    } catch (error: any) {
      log.error('IntegrationDecryptor', 'Failed to register assistant mapping', {
        assistantId,
        orgId,
        role,
        error: error?.message,
      });
      throw error;
    }
  }

  /**
   * Store encrypted credentials in org_credentials table
   * Automatically encrypts data usicng EncryptionService
   * Upserts to maintain single credential per org+provider
   *
   * @param orgId - Organization ID
   * @param provider - Provider name (vapi, twilio, google_calendar, etc.)
   * @param credentials - Credentials object to store
   * @throws Error if storage fails
   */
  static async storeCredentials(
    orgId: string,
    provider: string,
    credentials: Record<string, any>
  ): Promise<void> {
    try {
      // Encrypt the credentials
      const encryptedConfig = EncryptionService.encryptObject(credentials);

      // Prepare metadata - include email if provided
      const metadata: Record<string, any> = {};
      if (credentials.email) {
        metadata.email = credentials.email;
      }

      log.debug('IntegrationDecryptor', 'Preparing to upsert credentials', {
        orgId,
        provider,
        hasMetadata: Object.keys(metadata).length > 0,
        metadataKeys: Object.keys(metadata)
      });

      const { data, error } = await supabase
        .from('integrations')
        .upsert(
          {
            org_id: orgId,
            provider,
            encrypted_config: encryptedConfig,
            config: {
              status: 'active',
              last_verified_at: new Date().toISOString(),
              metadata: Object.keys(metadata).length > 0 ? metadata : null
            },
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'org_id,provider' }
        )
        .select();

      if (error) {
        // Handle schema cache errors - table exists but REST API can't find it
        if (error.code === 'PGRST205' || error.message?.includes('Could not find the table')) {
          log.warn('IntegrationDecryptor', 'Schema cache issue, retrying with exponential backoff', {
            orgId,
            provider,
            error: error?.message,
            code: error?.code
          });

          // Retry up to 3 times with exponential backoff (2s, 4s, 8s)
          let lastError = error;
          for (let attempt = 1; attempt <= 3; attempt++) {
            const delayMs = 2000 * Math.pow(2, attempt - 1);
            log.debug('IntegrationDecryptor', `Schema cache retry attempt ${attempt}/3`, {
              orgId,
              delayMs
            });

            await new Promise(resolve => setTimeout(resolve, delayMs));

            const { data: retryData, error: retryError } = await supabase
              .from('integrations')
              .upsert(
                {
                  org_id: orgId,
                  provider,
                  encrypted_config: encryptedConfig,
                  is_active: true,
                  last_verified_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  metadata: Object.keys(metadata).length > 0 ? metadata : null,
                },
                { onConflict: 'org_id,provider' }
              )
              .select();

            if (!retryError) {
              log.info('IntegrationDecryptor', 'Schema cache retry succeeded', {
                orgId,
                provider,
                attempt
              });
              return; // Success!
            }

            lastError = retryError;
            log.warn('IntegrationDecryptor', `Schema cache retry ${attempt} failed`, {
              orgId,
              attempt,
              error: retryError?.message,
              code: retryError?.code
            });
          }

          // All retries exhausted
          log.error('IntegrationDecryptor', 'All schema cache retries failed', {
            orgId,
            provider,
            error: lastError?.message,
            code: lastError?.code
          });
          throw lastError;
        }

        log.error('IntegrationDecryptor', 'Supabase upsert error', {
          orgId,
          provider,
          error: error?.message,
          code: error?.code,
          details: error?.details
        });
        throw error;
      }

      log.info('IntegrationDecryptor', 'Credentials stored successfully', {
        orgId,
        provider,
        timestamp: new Date().toISOString(),
        rowsAffected: data?.length || 0,
        hasMetadata: Object.keys(metadata).length > 0
      });

      // Invalidate cache after successful storage
      this.invalidateCache(orgId, provider);
    } catch (error: any) {
      log.error('IntegrationDecryptor', 'Failed to store credentials', {
        orgId,
        provider,
        error: error?.message,
        errorCode: error?.code,
        stack: error?.stack
      });
      throw error;
    }
  }

  /**
   * Verify credentials by attempting connection to provider
   * Updates verification status in database
   *
   * @param orgId - Organization ID
   * @param provider - Provider name
   * @returns true if credentials are valid, false otherwise
   */
  static async verifyCredentials(
    orgId: string,
    provider: string
  ): Promise<VerificationResult> {
    try {
      let isValid = false;

      switch (provider) {
        case 'vapi':
          const vapiCreds = await this.getVapiCredentials(orgId);
          const { VapiClient } = await import('./vapi-client');
          const vapi = new VapiClient(vapiCreds.apiKey);
          isValid = await vapi.validateConnection();
          break;

        case 'twilio':
          const twilioCreds = await this.getTwilioCredentials(orgId);
          const twilio = require('twilio');
          const client = twilio(twilioCreds.accountSid, twilioCreds.authToken);
          await client.api.accounts(twilioCreds.accountSid).fetch();
          isValid = true;
          break;

        case 'google_calendar':
          // Attempt to get client (will fail if token expired)
          await this.getGoogleCalendarCredentials(orgId);
          isValid = true;
          break;

        case 'resend':
          const resendCreds = await this.getResendCredentials(orgId);
          // Simple validation - just check key format
          isValid = resendCreds.apiKey.length > 0;
          break;

        case 'elevenlabs':
          const elevenCreds = await this.getElevenLabsCredentials(orgId);
          isValid = elevenCreds.apiKey.length > 0;
          break;

        default:
          log.warn('IntegrationDecryptor', 'Unknown provider for verification', {
            provider,
          });
          return { success: false, error: 'Unknown provider' };
      }

      // Update verification status in database
      const { error } = await supabase
        .from('integrations')
        .update({
          verification_error: isValid ? null : 'Verification failed',
          last_verified_at: new Date().toISOString(),
        })
        .eq('org_id', orgId)
        .eq('provider', provider);

      if (error) {
        log.warn('IntegrationDecryptor', 'Failed to update verification status', {
          orgId,
          provider,
          error: error.message,
        });
      }

      if (isValid) {
        log.info('IntegrationDecryptor', 'Credentials verified', {
          orgId,
          provider,
        });
      } else {
        log.warn('IntegrationDecryptor', 'Credentials verification failed', {
          orgId,
          provider,
        });
      }

      return {
        success: isValid,
        lastVerified: new Date().toISOString(),
      };
    } catch (error: any) {
      log.error('IntegrationDecryptor', 'Credential verification error', {
        orgId,
        provider,
        error: error?.message,
      });

      // Update database with error
      await supabase
        .from('integrations')
        .update({
          verification_error: error?.message || 'Verification error',
          last_verified_at: new Date().toISOString(),
        })
        .eq('org_id', orgId)
        .eq('provider', provider);

      if (error) {
        log.warn('IntegrationDecryptor', 'Failed to update error status', {
          error: error.message,
        });
      }

      return {
        success: false,
        error: error?.message || 'Verification failed',
      };
    }
  }

  /**
   * Invalidate cache for specific org+provider or entire org
   *
   * @param orgId - Organization ID
   * @param provider - Optional provider name. If omitted, clears all cache for org
   */
  static invalidateCache(orgId: string, provider?: string): void {
    if (provider) {
      const cacheKey = `${orgId}:${provider}`;
      credentialCache.delete(cacheKey);
      log.debug('IntegrationDecryptor', 'Cache invalidated', { orgId, provider });
    } else {
      // Invalidate all entries for this org
      const keysToDelete: string[] = [];
      for (const key of credentialCache.keys()) {
        if (key.startsWith(`${orgId}:`)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach((k) => credentialCache.delete(k));
      log.debug('IntegrationDecryptor', 'All org cache invalidated', {
        orgId,
        count: keysToDelete.length,
      });
    }
  }

  /**
   * Get cache statistics for monitoring
   * @returns Cache statistics object
   */
  static getCacheStats() {
    return {
      size: credentialCache.size,
      maxSize: MAX_CACHE_SIZE,
      ttlMs: CACHE_TTL_MS,
      usage: ((credentialCache.size / MAX_CACHE_SIZE) * 100).toFixed(2) + '%',
    };
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  /**
   * Generic credential retrieval with caching and decryption
   * This is the core method that all provider-specific methods use
   *
   * @private
   */
  private static async getCredentials<T>(
    orgId: string,
    provider: string,
    transformer: (decrypted: any) => T
  ): Promise<T> {
    const cacheKey = `${orgId}:${provider}`;

    // Check cache first
    const cached = credentialCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      log.debug('IntegrationDecryptor', 'Cache hit', { orgId, provider });
      return cached.data as T;
    }

    try {
      // Query integrations table
      const { data, error } = await supabase
        .from('integrations')
        .select('encrypted_config, config, last_verified_at')
        .eq('org_id', orgId)
        .eq('provider', provider)
        .maybeSingle();

      if (error) {
        throw new Error(
          `Database error retrieving ${provider} credentials: ${error.message}`
        );
      }

      if (!data) {
        throw new Error(
          `${provider} credentials not found for org ${orgId}. Please configure ${provider} in integration settings.`
        );
      }

      // Decrypt the configuration
      let decrypted: any;

      if (typeof data.encrypted_config === 'string') {
        // New format: encrypted string "iv:authTag:content"
        try {
          decrypted = EncryptionService.decryptObject(
            data.encrypted_config
          );
        } catch (decryptError: any) {
          log.error('IntegrationDecryptor', 'Decryption failed', {
            orgId,
            provider,
            error: decryptError?.message,
          });
          throw new Error(`Failed to decrypt ${provider} credentials`);
        }
      } else {
        // Legacy format: plain JSONB (for backward compatibility during migration)
        log.warn('IntegrationDecryptor', 'Found unencrypted credentials (legacy)', {
          orgId,
          provider,
        });
        decrypted = data.encrypted_config;
      }

      // Transform to expected shape
      const transformed = transformer(decrypted);

      // Manage cache size with LRU eviction
      if (credentialCache.size >= MAX_CACHE_SIZE) {
        const oldestKey = credentialCache.keys().next().value;
        if (oldestKey) {
          credentialCache.delete(oldestKey);
          log.debug('IntegrationDecryptor', 'Cache entry evicted (LRU)', {
            evictedKey: oldestKey,
          });
        }
      }

      // Update cache
      credentialCache.set(cacheKey, {
        data: transformed,
        timestamp: Date.now(),
      });

      log.info('IntegrationDecryptor', 'Credentials retrieved', {
        orgId,
        provider,
        lastVerified: (data as any).last_verified_at,
        cacheSize: credentialCache.size,
      });

      return transformed;
    } catch (error: any) {
      log.error('IntegrationDecryptor', 'Failed to retrieve credentials', {
        orgId,
        provider,
        error: error?.message,
      });
      throw error;
    }
  }
}

export default IntegrationDecryptor;
