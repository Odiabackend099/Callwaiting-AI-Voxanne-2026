/**
 * TelephonyProvisioningService
 *
 * Handles smart Twilio number provisioning based on user country
 * Implements cost-optimized routing:
 * - Nigeria/Turkey users → US numbers (92% cost savings)
 * - UK users → UK numbers (local rates)
 * - US users → US numbers (local rates)
 *
 * Features:
 * - Automatic number provisioning based on carrier_forwarding_rules
 * - BYOC model (uses org's Twilio credentials)
 * - Graceful error handling
 * - Number release on org deletion/downgrade
 * - Multi-tenant isolation
 */

import { supabaseAdmin } from '../config/supabase';
import twilio from 'twilio';
import { IntegrationDecryptor } from './integration-decryptor';
import { safeCall } from './safe-call';
import { log } from './logger';

// ============================================
// Helper Functions
// ============================================

/**
 * Validate Twilio SID format
 * Twilio SIDs are 34 characters starting with 'PN' for phone numbers
 * @param sid - Twilio resource SID
 * @returns True if valid format
 */
function isValidTwilioSid(sid: string): boolean {
  return /^PN[a-f0-9]{32}$/i.test(sid);
}

/**
 * Redact phone number for logging (PII protection)
 * Shows only country code and last 4 digits
 * @param phoneNumber - E.164 format phone number
 * @returns Redacted phone number (e.g., "+1******1234")
 */
function redactPhoneNumber(phoneNumber: string): string {
  if (!phoneNumber || phoneNumber.length < 8) {
    return '****';
  }

  const countryCodeMatch = phoneNumber.match(/^\+(\d{1,3})/);
  const countryCode = countryCodeMatch ? countryCodeMatch[0] : '+***';
  const last4 = phoneNumber.slice(-4);
  const middleLength = phoneNumber.length - countryCode.length - 4;
  const redacted = '*'.repeat(Math.max(0, middleLength));

  return `${countryCode}${redacted}${last4}`;
}

// ============================================
// Type Definitions
// ============================================

export interface ProvisionNumberRequest {
  orgId: string;
  userCountry: string; // ISO 3166-1 alpha-2 (e.g., 'NG', 'TR', 'GB', 'US')
  carrierName?: string; // Optional: store user's selected carrier
}

export interface ProvisionNumberResult {
  success: boolean;
  phoneNumber?: string; // E.164 format (e.g., '+15551234567')
  provisionedCountry?: string; // 'US' or 'GB'
  error?: string;
  errorCode?: string;
}

export interface ReleaseNumberRequest {
  orgId: string;
}

export interface ReleaseNumberResult {
  success: boolean;
  releasedNumber?: string;
  error?: string;
}

// ============================================
// TelephonyProvisioningService Class
// ============================================

export class TelephonyProvisioningService {
  /**
   * Provision a Twilio number for an organization based on their country
   * Uses smart routing from carrier_forwarding_rules table
   *
   * @param request - Provisioning request with orgId and userCountry
   * @returns Result with provisioned phone number or error
   */
  static async provisionForwardingNumber(
    request: ProvisionNumberRequest
  ): Promise<ProvisionNumberResult> {
    const { orgId, userCountry, carrierName } = request;

    try {
      log.info('TelephonyProvisioning', 'Starting number provisioning', {
        orgId,
        userCountry,
        carrierName,
      });

      // Step 1: Lookup smart routing rule from carrier_forwarding_rules
      const { data: routingRule, error: routingError } = await supabaseAdmin
        .from('carrier_forwarding_rules')
        .select('recommended_twilio_country, country_name')
        .eq('country_code', userCountry)
        .eq('is_active', true)
        .single();

      if (routingError || !routingRule) {
        log.error('TelephonyProvisioning', 'Country not supported', {
          userCountry,
          error: routingError,
        });
        return {
          success: false,
          error: `Country ${userCountry} not supported for telephony provisioning`,
          errorCode: 'COUNTRY_NOT_SUPPORTED',
        };
      }

      const provisionCountry = routingRule.recommended_twilio_country; // 'US' or 'GB'

      log.info('TelephonyProvisioning', 'Smart routing determined', {
        userCountry,
        countryName: routingRule.country_name,
        provisionCountry,
      });

      // Step 2: Get Twilio client with org's BYOC credentials
      let twilioClient: any;
      try {
        const credentials = await IntegrationDecryptor.getTwilioCredentials(orgId);
        twilioClient = twilio(credentials.accountSid, credentials.authToken);
      } catch (credError: any) {
        // SECURITY: No fallback to platform credentials (Fortress Protocol)
        // Organizations must provide their own Twilio BYOC credentials
        log.error('TelephonyProvisioning', 'No Twilio credentials available', {
          orgId,
          error: credError.message,
        });
        return {
          success: false,
          error: 'No Twilio credentials available. Please connect your Twilio account in Settings > Integrations.',
          errorCode: 'NO_CREDENTIALS',
        };
      }

      // Step 3: Search for available Twilio numbers in recommended country
      // Use safeCall for circuit breaker pattern
      const searchResult = await safeCall<any>(
        () =>
          twilioClient
            .availablePhoneNumbers(provisionCountry)
            .local.list({
              voiceEnabled: true,
              limit: 5,
            }),
        'twilio',
        {
          fallbackValue: [],
          metadata: { operation: 'search-numbers', country: provisionCountry },
        }
      );

      if (!searchResult || searchResult.length === 0) {
        log.error('TelephonyProvisioning', 'No available numbers', {
          orgId,
          provisionCountry,
        });
        return {
          success: false,
          error: `No available Twilio numbers in ${provisionCountry}. Try again later or contact support.`,
          errorCode: 'NO_NUMBERS_AVAILABLE',
        };
      }

      const selectedNumber = searchResult[0].phoneNumber;

      log.info('TelephonyProvisioning', 'Available number found', {
        orgId,
        selectedNumber: redactPhoneNumber(selectedNumber),
        totalAvailable: searchResult.length,
      });

      // Step 4: Purchase the number with webhook configuration
      const backendUrl = process.env.BACKEND_URL || 'https://api.voxanne.ai';
      const webhookUrl = `${backendUrl}/api/vapi/webhook`;

      const purchaseResult = await safeCall<any>(
        () =>
          twilioClient.incomingPhoneNumbers.create({
            phoneNumber: selectedNumber,
            voiceUrl: webhookUrl,
            voiceMethod: 'POST',
            friendlyName: `Voxanne AI - Org ${orgId.substring(0, 8)}`,
            smsUrl: `${backendUrl}/api/webhooks/sms`,
            smsMethod: 'POST',
          }),
        'twilio',
        {
          fallbackValue: null,
          metadata: { operation: 'purchase-number', number: selectedNumber },
        }
      );

      if (!purchaseResult) {
        log.error('TelephonyProvisioning', 'Failed to purchase number', {
          orgId,
          selectedNumber,
        });
        return {
          success: false,
          error: 'Failed to purchase Twilio number. Please try again or contact support.',
          errorCode: 'PURCHASE_FAILED',
        };
      }

      const purchasedNumber = purchaseResult.phoneNumber;

      log.info('TelephonyProvisioning', 'Number purchased successfully', {
        orgId,
        purchasedNumber: redactPhoneNumber(purchasedNumber),
        sid: purchaseResult.sid,
      });

      // Step 5: Store in organizations table (with automatic rollback on failure)
      const { error: updateError } = await supabaseAdmin
        .from('organizations')
        .update({
          telephony_country: userCountry,
          assigned_twilio_number: purchasedNumber,
          forwarding_carrier: carrierName || null,
        })
        .eq('id', orgId);

      if (updateError) {
        log.error('TelephonyProvisioning', 'DB update failed - rolling back Twilio purchase', {
          orgId,
          purchasedNumber: redactPhoneNumber(purchasedNumber),
          error: updateError,
        });

        // CRITICAL: Rollback the Twilio purchase to prevent orphaned numbers
        try {
          await twilioClient.incomingPhoneNumbers(purchaseResult.sid).remove();
          log.info('TelephonyProvisioning', 'Rollback successful - number released', {
            orgId,
            purchasedNumber: redactPhoneNumber(purchasedNumber),
            sid: purchaseResult.sid,
          });
        } catch (rollbackError: any) {
          log.error('TelephonyProvisioning', 'CRITICAL: Rollback failed - orphaned number', {
            orgId,
            purchasedNumber: redactPhoneNumber(purchasedNumber),
            sid: purchaseResult.sid,
            rollbackError: rollbackError.message,
          });
          // TODO: Send Slack alert for manual cleanup
          // await sendSlackAlert('🚨 Orphaned Twilio Number', {
          //   orgId,
          //   number: purchasedNumber,
          //   sid: purchaseResult.sid
          // });
        }

        return {
          success: false,
          error: 'Failed to save number configuration. Please try again.',
          errorCode: 'DB_UPDATE_FAILED',
        };
      }

      log.info('TelephonyProvisioning', 'Provisioning complete', {
        orgId,
        userCountry,
        provisionedNumber: redactPhoneNumber(purchasedNumber),
        provisionedCountry: provisionCountry,
      });

      return {
        success: true,
        phoneNumber: purchasedNumber,
        provisionedCountry: provisionCountry,
      };
    } catch (error: any) {
      log.error('TelephonyProvisioning', 'Unexpected error', {
        orgId,
        userCountry,
        error: error.message,
        stack: error.stack,
      });
      return {
        success: false,
        error: 'An unexpected error occurred during provisioning. Please try again.',
        errorCode: 'UNKNOWN_ERROR',
      };
    }
  }

  /**
   * Release Twilio number when org downgrades or deletes account
   *
   * @param request - Release request with orgId
   * @returns Result with success status
   */
  static async releaseForwardingNumber(
    request: ReleaseNumberRequest
  ): Promise<ReleaseNumberResult> {
    const { orgId } = request;

    try {
      log.info('TelephonyProvisioning', 'Starting number release', { orgId });

      // Step 1: Get assigned number from organizations table
      const { data: org, error: orgError } = await supabaseAdmin
        .from('organizations')
        .select('assigned_twilio_number')
        .eq('id', orgId)
        .single();

      if (orgError || !org?.assigned_twilio_number) {
        log.info('TelephonyProvisioning', 'No number to release', {
          orgId,
          error: orgError,
        });
        return {
          success: true, // Not an error - just nothing to release
        };
      }

      const numberToRelease = org.assigned_twilio_number;

      // Step 2: Get Twilio client
      let twilioClient: any;
      try {
        const credentials = await IntegrationDecryptor.getTwilioCredentials(orgId);
        twilioClient = twilio(credentials.accountSid, credentials.authToken);
      } catch (credError: any) {
        // SECURITY: No fallback to platform credentials (Fortress Protocol)
        log.error('TelephonyProvisioning', 'No Twilio credentials for release', {
          orgId,
          error: credError.message,
        });
        return {
          success: false,
          error: 'No Twilio credentials available to release number. Please connect your Twilio account.',
        };
      }

      // Step 3: Find the number resource SID
      const numbersResult = await safeCall<any[]>(
        () =>
          twilioClient.incomingPhoneNumbers.list({
            phoneNumber: numberToRelease,
          }),
        'twilio',
        {
          fallbackValue: [],
          metadata: { operation: 'list-numbers', number: numberToRelease },
        }
      );

      if (!numbersResult || numbersResult.length === 0) {
        log.warn('TelephonyProvisioning', 'Number not found in Twilio', {
          orgId,
          numberToRelease: redactPhoneNumber(numberToRelease),
        });
        // Clear from database anyway
        await supabaseAdmin
          .from('organizations')
          .update({ assigned_twilio_number: null })
          .eq('id', orgId);

        return {
          success: true,
          releasedNumber: numberToRelease,
        };
      }

      const numberSid = numbersResult[0].sid;

      // Validate Twilio SID format before deletion (prevents invalid API calls)
      if (!isValidTwilioSid(numberSid)) {
        log.error('TelephonyProvisioning', 'Invalid Twilio SID format', {
          orgId,
          numberToRelease: redactPhoneNumber(numberToRelease),
          sid: numberSid,
        });
        return {
          success: false,
          error: 'Invalid Twilio resource identifier. Please contact support.',
        };
      }

      // Step 4: Release the number
      const releaseResult = await safeCall<any>(
        () => twilioClient.incomingPhoneNumbers(numberSid).remove(),
        'twilio',
        {
          fallbackValue: null,
          metadata: { operation: 'release-number', sid: numberSid },
        }
      );

      if (!releaseResult) {
        log.error('TelephonyProvisioning', 'Failed to release number', {
          orgId,
          numberSid,
        });
        return {
          success: false,
          error: 'Failed to release Twilio number. Please contact support.',
        };
      }

      log.info('TelephonyProvisioning', 'Number released successfully', {
        orgId,
        releasedNumber: redactPhoneNumber(numberToRelease),
        sid: numberSid,
      });

      // Step 5: Clear from database
      const { error: clearError } = await supabaseAdmin
        .from('organizations')
        .update({ assigned_twilio_number: null })
        .eq('id', orgId);

      if (clearError) {
        log.error('TelephonyProvisioning', 'Failed to clear number from DB', {
          orgId,
          error: clearError,
        });
      }

      return {
        success: true,
        releasedNumber: numberToRelease,
      };
    } catch (error: any) {
      log.error('TelephonyProvisioning', 'Unexpected error during release', {
        orgId,
        error: error.message,
        stack: error.stack,
      });
      return {
        success: false,
        error: 'An unexpected error occurred during number release.',
      };
    }
  }

  /**
   * Get provisioning status for an organization
   *
   * @param orgId - Organization ID
   * @returns Current telephony provisioning details
   */
  static async getProvisioningStatus(orgId: string) {
    const { data, error } = await supabaseAdmin
      .from('organizations')
      .select('telephony_country, assigned_twilio_number, forwarding_carrier')
      .eq('id', orgId)
      .single();

    if (error) {
      log.error('TelephonyProvisioning', 'Failed to get provisioning status', {
        orgId,
        error,
      });
      return null;
    }

    return {
      country: data.telephony_country,
      assignedNumber: data.assigned_twilio_number,
      carrier: data.forwarding_carrier,
      isProvisioned: !!data.assigned_twilio_number,
    };
  }
}
