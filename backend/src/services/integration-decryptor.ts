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
import { CredentialService } from './credential-service';
import { VapiClient } from './vapi-client';
import { createClient } from '@supabase/supabase-js';
import { log } from './logger';
import type { ProviderType } from '../types/supabase-db';

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
      'twilio',
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

    // Check if token is expired (with 5-minute buffer for proactive refresh)
    const expiresAt = new Date(credentials.expiresAt);
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);

    if (expiresAt < fiveMinutesFromNow && !allowExpired) {
      log.info('IntegrationDecryptor', 'Google token expired or expiring soon, attempting refresh', {
        orgId,
        expiresAt: credentials.expiresAt,
        bufferMinutes: 5,
      });

      try {
        // ===== SELF-HEALING: REFRESH TOKEN PROTOCOL =====
        const { google } = require('googleapis');
        const oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET
        );

        oauth2Client.setCredentials({
          refresh_token: credentials.refreshToken,
        });

        // Request new access token
        log.debug('IntegrationDecryptor', 'Requesting new access token from Google', {
          orgId,
        });

        const { credentials: newCreds } = await oauth2Client.refreshAccessToken();

        if (!newCreds.access_token) {
          throw new Error('Failed to refresh token: No access_token returned');
        }

        // Calculate expiration (default 1 hour if not provided)
        const expiryMs = newCreds.expiry_date || (Date.now() + 3600000);
        const newExpiresAt = new Date(expiryMs).toISOString();

        // Build updated credentials object
        const updatedCreds = {
          accessToken: newCreds.access_token,
          access_token: newCreds.access_token, // Support both field names
          refreshToken: credentials.refreshToken, // Keep same refresh token
          refresh_token: credentials.refreshToken,
          expiresAt: newExpiresAt,
          expires_at: newExpiresAt,
        };

        log.info('IntegrationDecryptor', '🔄 Google token refreshed successfully', {
          orgId,
          newExpiresAt,
        });

        // ===== PERSIST: Update database with new token =====
        await this.storeCredentials(orgId, 'google_calendar', updatedCreds);

        // Update connected status to true
        await supabase
          .from('integrations')
          .update({
            connected: true,
            last_checked_at: new Date().toISOString(),
          })
          .eq('org_id', orgId)
          .eq('provider', 'google_calendar');

        log.info('IntegrationDecryptor', '✅ Google Calendar credentials persisted and marked connected', {
          orgId,
        });

        // Return refreshed credentials
        return {
          accessToken: updatedCreds.accessToken,
          refreshToken: updatedCreds.refreshToken,
          expiresAt: updatedCreds.expiresAt,
        };
      } catch (error: any) {
        log.error('IntegrationDecryptor', '❌ Failed to refresh Google token', {
          orgId,
          error: error?.message,
          code: error?.code,
        });

        // Invalidate cache on refresh failure
        this.invalidateCache(orgId, 'google_calendar');

        // Update connected status to false
        await supabase
          .from('integrations')
          .update({
            connected: false,
            last_checked_at: new Date().toISOString(),
          })
          .eq('org_id', orgId)
          .eq('provider', 'google_calendar');

        throw new Error(
          `Google Calendar token refresh failed: ${error?.message || 'Unknown error'}. Please reconnect your Google account in settings.`
        );
      }
    }

    log.debug('IntegrationDecryptor', '✅ Google token valid (no refresh needed)', {
      orgId,
      expiresAt: credentials.expiresAt,
    });

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
   * Generic credential retrieval with caching and transformation
   * Delegates credential fetch/decryption to CredentialService (centralized)
   * Keeps caching and transformation logic here for performance
   *
   * This architecture ensures:
   * ✅ Single source of truth for credential access (CredentialService)
   * ✅ Performance via caching in IntegrationDecryptor
   * ✅ Provider-specific transformation logic encapsulated here
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
      // ===== DELEGATION TO CENTRALIZED SERVICE =====
      // This is the KEY CHANGE: Instead of direct DB queries,
      // we delegate to CredentialService which handles:
      // - Database queries
      // - Decryption (even legacy format handling if needed)
      // - Error handling with clear messages
      // - Audit logging
      const decrypted = await CredentialService.get(orgId, provider as ProviderType);

      // ===== LOCAL TRANSFORMATION & CACHING =====
      // Transform to provider-specific shape
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

      // Update cache with transformed result
      credentialCache.set(cacheKey, {
        data: transformed,
        timestamp: Date.now(),
      });

      log.info('IntegrationDecryptor', 'Credentials retrieved and cached', {
        orgId,
        provider,
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

  /**
   * Validate Google Calendar credentials health
   *
   * Tests if credentials are valid by making a lightweight API call.
   * Used to detect expired OAuth tokens before attempting operations.
   *
   * @param orgId - Organization ID
   * @returns Health status with error details if unhealthy
   */
  static async validateGoogleCalendarHealth(
    orgId: string
  ): Promise<{ healthy: boolean; error?: string }> {
    try {
      const creds = await this.getGoogleCalendarCredentials(orgId);

      if (!creds) {
        return { healthy: false, error: 'No credentials found' };
      }

      // Test API call - minimal resource request
      const { google } = require('googleapis');
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
      );

      oauth2Client.setCredentials({
        access_token: creds.accessToken,
        refresh_token: creds.refreshToken,
      });

      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      // Lightweight test: List calendars (minimal quota usage)
      await calendar.calendarList.list({ maxResults: 1 });

      log.info('IntegrationDecryptor', 'Google Calendar health check passed', { orgId });
      return { healthy: true };

    } catch (error: any) {
      log.error('IntegrationDecryptor', 'Google Calendar health check failed', {
        orgId,
        error: error?.message,
        code: error?.code,
      });

      // Detect specific error types
      if (error.code === 401) {
        return {
          healthy: false,
          error: 'OAuth token expired - please reconnect Google Calendar in settings',
        };
      }

      if (error.code === 403) {
        return {
          healthy: false,
          error: 'Insufficient permissions - please re-authorize Google Calendar',
        };
      }

      return {
        healthy: false,
        error: error?.message || 'Unknown error checking calendar health',
      };
    }
  }

  /**
   * Validate Twilio credentials health
   *
   * Tests if credentials are valid by fetching account info.
   *
   * @param orgId - Organization ID
   * @returns Health status with error details if unhealthy
   */
  static async validateTwilioHealth(
    orgId: string
  ): Promise<{ healthy: boolean; error?: string }> {
    try {
      const creds = await this.getTwilioCredentials(orgId);

      if (!creds) {
        return { healthy: false, error: 'No credentials found' };
      }

      // Test API call
      const twilio = require('twilio');
      const client = twilio(creds.accountSid, creds.authToken);

      // Lightweight test: Fetch account info
      await client.api.accounts(creds.accountSid).fetch();

      log.info('IntegrationDecryptor', 'Twilio health check passed', { orgId });
      return { healthy: true };

    } catch (error: any) {
      log.error('IntegrationDecryptor', 'Twilio health check failed', {
        orgId,
        error: error?.message,
        code: error?.code,
      });

      if (error.status === 401) {
        return {
          healthy: false,
          error: 'Twilio credentials invalid - please update in settings',
        };
      }

      return {
        healthy: false,
        error: error?.message || 'Unknown error checking Twilio health',
      };
    }
  }

  // ============================================
  // Single-Slot Telephony: saveTwilioCredential + syncVapiCredential
  // ============================================

  /**
   * Save Twilio credentials with strict UPSERT + mutual exclusion + Vapi sync.
   *
   * This is the SINGLE GATE for all Twilio credential writes.
   * 1 Organization = 1 Twilio Connection. New saves overwrite the old.
   *
   * @param orgId - Organization ID
   * @param creds - Twilio credentials to save
   * @param creds.accountSid - Twilio Account SID
   * @param creds.authToken - Twilio Auth Token
   * @param creds.phoneNumber - Phone number in E.164 format
   * @param creds.source - 'byoc' or 'managed'
   */
  static async saveTwilioCredential(
    orgId: string,
    creds: {
      accountSid: string;
      authToken: string;
      phoneNumber: string;
      source: 'byoc' | 'managed';
    }
  ): Promise<{ vapiCredentialId: string | null }> {
    const { accountSid, authToken, phoneNumber, source } = creds;

    log.info('IntegrationDecryptor', 'saveTwilioCredential: starting', {
      orgId,
      source,
      sidLast4: accountSid.slice(-4),
      phoneLast4: phoneNumber.slice(-4),
    });

    // 1. Encrypt credentials
    const encryptedConfig = EncryptionService.encryptObject({
      accountSid,
      authToken,
      phoneNumber,
    });

    // 2. UPSERT into org_credentials (single-slot — UNIQUE on org_id,provider)
    const { error: upsertError } = await supabase
      .from('org_credentials')
      .upsert(
        {
          org_id: orgId,
          provider: 'twilio' as const,
          is_active: true,
          encrypted_config: encryptedConfig,
          metadata: { accountSid, phoneNumber },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'org_id,provider' }
      );

    if (upsertError) {
      log.error('IntegrationDecryptor', 'saveTwilioCredential: DB upsert failed', {
        orgId,
        error: upsertError.message,
      });
      throw new Error(`Failed to save Twilio credentials: ${upsertError.message}`);
    }

    // 3. Mutual exclusion: deactivate the opposite mode
    if (source === 'managed') {
      // Deactivate BYOC integrations entry
      await supabase
        .from('integrations')
        .update({ config: { status: 'replaced_by_managed' }, updated_at: new Date().toISOString() })
        .eq('org_id', orgId)
        .eq('provider', 'twilio');
    } else {
      // Deactivate managed phone numbers + subaccounts
      await supabase
        .from('managed_phone_numbers')
        .update({ status: 'released', released_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('org_id', orgId)
        .eq('status', 'active');

      await supabase
        .from('twilio_subaccounts')
        .update({ status: 'closed', closed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('org_id', orgId)
        .eq('status', 'active');
    }

    // 4. Update organizations.telephony_mode
    await supabase
      .from('organizations')
      .update({
        telephony_mode: source,
      })
      .eq('id', orgId);

    // 5. Sync credential to Vapi
    const vapiCredentialId = await this.syncVapiCredential(orgId, accountSid, authToken);

    // 6. Store vapi_credential_id on organizations
    if (vapiCredentialId) {
      await supabase
        .from('organizations')
        .update({ vapi_credential_id: vapiCredentialId })
        .eq('id', orgId);
    }

    log.info('IntegrationDecryptor', 'saveTwilioCredential: complete', {
      orgId,
      source,
      vapiCredentialId,
    });

    return { vapiCredentialId };
  }

  /**
   * Sync Twilio credentials to Vapi (create or update).
   *
   * - If org already has a vapi_credential_id → update it
   * - If not (or if stale 404) → create a new one
   *
   * Returns the Vapi credential ID or null on failure.
   */
  private static async syncVapiCredential(
    orgId: string,
    accountSid: string,
    authToken: string
  ): Promise<string | null> {
    const vapiKey = process.env.VAPI_PRIVATE_KEY;
    if (!vapiKey) {
      log.warn('IntegrationDecryptor', 'syncVapiCredential: no VAPI_PRIVATE_KEY, skipping', { orgId });
      return null;
    }

    try {
      const vapiClient = new VapiClient(vapiKey);

      // Check if org already has a credential ID
      const { data: orgRow } = await supabase
        .from('organizations')
        .select('vapi_credential_id')
        .eq('id', orgId)
        .single();

      const existingCredId = orgRow?.vapi_credential_id;

      if (existingCredId) {
        // Try to update existing credential
        try {
          await vapiClient.updateCredential(existingCredId, accountSid, authToken);
          log.info('IntegrationDecryptor', 'syncVapiCredential: updated existing', {
            orgId,
            credentialId: existingCredId,
          });
          return existingCredId;
        } catch (updateErr: any) {
          // If 404, the credential was deleted externally — create a new one
          const is404 = updateErr?.response?.status === 404 || updateErr?.message?.includes('404');
          if (!is404) throw updateErr;

          log.warn('IntegrationDecryptor', 'syncVapiCredential: stale credential (404), creating new', {
            orgId,
            staleCredentialId: existingCredId,
          });
        }
      }

      // Create new credential
      const result = await vapiClient.createCredential(accountSid, authToken, `org-${orgId}`);
      const newCredId = result?.id;

      if (!newCredId) {
        log.error('IntegrationDecryptor', 'syncVapiCredential: Vapi returned no ID', { orgId });
        return null;
      }

      log.info('IntegrationDecryptor', 'syncVapiCredential: created new', {
        orgId,
        credentialId: newCredId,
      });
      return newCredId;
    } catch (err: any) {
      log.error('IntegrationDecryptor', 'syncVapiCredential: failed', {
        orgId,
        error: err?.message,
      });
      // Non-fatal: DB save already succeeded, caller can retry later
      return null;
    }
  }

  /**
   * Get effective Twilio credentials for an organization,
   * checking telephony_mode to decide between BYOC and managed.
   *
   * - If mode is 'byoc' (or unset): delegates to existing getTwilioCredentials()
   * - If mode is 'managed': decrypts subaccount credentials from twilio_subaccounts
   *   and returns the primary managed phone number
   *
   * Returns the same TwilioCredentials interface so callers don't need to change.
   *
   * @ai-invariant Existing getTwilioCredentials() is NOT modified.
   */
  static async getEffectiveTwilioCredentials(orgId: string): Promise<TwilioCredentials> {
    // Step 1: Check telephony_mode
    const { data: org } = await supabase
      .from('organizations')
      .select('telephony_mode')
      .eq('id', orgId)
      .single();

    const mode = org?.telephony_mode || 'byoc';

    // Step 2: If BYOC, delegate to existing method (unchanged)
    if (mode !== 'managed') {
      return this.getTwilioCredentials(orgId);
    }

    // Step 3: Managed mode — get subaccount credentials
    const { data: subData, error: subError } = await supabase
      .from('twilio_subaccounts')
      .select('twilio_account_sid, twilio_auth_token_encrypted')
      .eq('org_id', orgId)
      .eq('status', 'active')
      .maybeSingle();

    if (subError || !subData) {
      throw new Error(`No active managed subaccount for org ${orgId}`);
    }

    // Step 4: Get primary managed phone number
    const { data: numberData } = await supabase
      .from('managed_phone_numbers')
      .select('phone_number')
      .eq('org_id', orgId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (!numberData) {
      throw new Error(`No active managed phone number for org ${orgId}`);
    }

    // Step 5: Decrypt and return
    const authToken = EncryptionService.decrypt(subData.twilio_auth_token_encrypted);

    return {
      accountSid: subData.twilio_account_sid,
      authToken,
      phoneNumber: numberData.phone_number,
    };
  }
}

export default IntegrationDecryptor;
