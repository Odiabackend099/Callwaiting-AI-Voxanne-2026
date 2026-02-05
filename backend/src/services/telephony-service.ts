/**
 * Telephony Service
 *
 * Business logic for Hybrid Telephony BYOC feature.
 * Handles phone number verification and call forwarding configuration.
 */

import twilio from 'twilio';
import bcrypt from 'bcrypt';
import { supabase } from './supabase-client';
import { IntegrationDecryptor } from './integration-decryptor';
import { generateOTP } from '../utils/otp-utils';
import { generateForwardingCodes, CarrierCodeConfig } from './gsm-code-generator';
import type { TwilioClient } from '../types/telephony-types';
import { createLogger } from './logger';

const logger = createLogger('TelephonyService');

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface VerificationInitiateRequest {
  orgId: string;
  phoneNumber: string;
  friendlyName?: string;
}

export interface VerificationInitiateResponse {
  success: boolean;
  verificationId: string;
  message: string;
  expiresAt: string;
}

export interface VerificationConfirmRequest {
  orgId: string;
  verificationId?: string;
  phoneNumber?: string;
}

export interface VerifiedNumber {
  id: string;
  phoneNumber: string;
  friendlyName: string | null;
  status: string;
  verifiedAt: string;
}

export interface VerificationConfirmResponse {
  success: boolean;
  verifiedNumber: VerifiedNumber;
}

export interface ForwardingConfigRequest {
  orgId: string;
  verifiedCallerId: string;
  forwardingType: 'total_ai' | 'safety_net';
  carrier: string;
  ringTimeSeconds?: number;
}

export interface ForwardingConfigResponse {
  success: boolean;
  config: {
    id: string;
    forwardingType: string;
    carrier: string;
    twilioForwardingNumber: string;
    ringTimeSeconds: number;
    activationCode: string;
    deactivationCode: string;
    status: string;
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if Twilio has verified the caller ID with retry logic
 * Handles race condition where Twilio may not have processed verification yet
 *
 * @param twilioClient - Initialized Twilio client instance
 * @param phoneNumber - E.164 formatted phone number to check
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @returns Twilio caller ID SID if verified, null otherwise
 * @throws Never throws - catches and logs errors internally
 */
async function checkTwilioVerificationWithRetry(
  twilioClient: TwilioClient,
  phoneNumber: string,
  maxRetries = 3
): Promise<string | null> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const callerIds = await twilioClient.outgoingCallerIds.list({
        phoneNumber,
        limit: 1
      });

      if (callerIds.length > 0) {
        return callerIds[0].sid;
      }

      // Wait before retry: 2s, 4s, 8s (exponential backoff)
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000 * Math.pow(2, i)));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Twilio API error during verification check', {
        attempt: i + 1,
        error: errorMessage
      });
    }
  }

  return null;
}

// ============================================
// SERVICE CLASS
// ============================================

export class TelephonyService {
  /**
   * Initiate phone number verification via Twilio validation call
   *
   * Performs the following:
   * 1. Checks if number is already verified
   * 2. Retrieves Twilio credentials from encrypted storage
   * 3. Generates 6-digit OTP and stores hashed version
   * 4. Triggers Twilio validation call to user's phone
   * 5. Stores verification record with 10-minute expiry
   *
   * @param request - Verification request containing orgId, phoneNumber, and optional friendlyName
   * @returns Promise resolving to verification response with verificationId and expiry
   * @throws Error if number already verified, Twilio credentials missing, or validation call fails
   * @example
   * const result = await TelephonyService.initiateVerification({
   *   orgId: 'org_123',
   *   phoneNumber: '+15551234567',
   *   friendlyName: 'My Mobile'
   * });
   */
  static async initiateVerification(
    request: VerificationInitiateRequest
  ): Promise<VerificationInitiateResponse> {
    const { orgId, phoneNumber, friendlyName } = request;

    // Check if number already verified
    const { data: existingVerification, error: checkError } = await supabase
      .from('verified_caller_ids')
      .select('id, status, verified_at')
      .eq('org_id', orgId)
      .eq('phone_number', phoneNumber)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      throw new Error(`Database error: ${checkError.message}`);
    }

    if (existingVerification?.status === 'verified') {
      throw new Error('This phone number is already verified for your organization');
    }

    // Get Twilio credentials
    const twilioCredentials = await IntegrationDecryptor.getTwilioCredentials(orgId);
    if (!twilioCredentials) {
      throw new Error('Twilio credentials not configured. Please set up Twilio integration first.');
    }

    // Generate verification code
    const verificationCode = generateOTP(6);
    const codeHash = await bcrypt.hash(verificationCode, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Initiate Twilio validation call
    const twilioClient = twilio(twilioCredentials.accountSid, twilioCredentials.authToken);

    let validationRequest;
    try {
      validationRequest = await twilioClient.validationRequests.create({
        phoneNumber,
        friendlyName: friendlyName || `Voxanne Verified: ${phoneNumber}`
      });
    } catch (twilioError) {
      const errorMessage = twilioError instanceof Error ? twilioError.message : 'Unknown Twilio error';

      // Provide helpful guidance for common Twilio errors
      if (errorMessage.includes('trial') || errorMessage.includes('not supported on trial account')) {
        throw new Error(
          `Twilio trial account limitation: ${errorMessage}\n\n` +
          `To use caller ID verification, upgrade your Twilio account at https://console.twilio.com/billing/upgrade`
        );
      }

      throw new Error(`Twilio validation failed: ${errorMessage}`);
    }

    // Store verification record
    const { data: verification, error: insertError } = await supabase
      .from('verified_caller_ids')
      .upsert({
        org_id: orgId,
        phone_number: phoneNumber,
        friendly_name: friendlyName || null,
        twilio_call_sid: validationRequest.callSid,
        status: 'pending',
        verification_code_hash: codeHash,
        verification_code_expires_at: expiresAt.toISOString(),
        verification_attempts: 0,
        updated_at: new Date().toISOString()
      }, { onConflict: 'org_id,phone_number' })
      .select()
      .single();

    if (insertError) {
      throw new Error('Failed to store verification record');
    }

    return {
      success: true,
      verificationId: verification.id,
      message: `Verification call in progress. Answer and enter the code when prompted.`,
      expiresAt: expiresAt.toISOString()
    };
  }

  /**
   * Confirm verification by checking Twilio outgoing caller IDs
   * Uses retry logic to handle Twilio processing delay
   *
   * Performs the following:
   * 1. Fetches pending verification record
   * 2. Checks expiration (10-minute window)
   * 3. Queries Twilio API with retry logic (3 attempts with exponential backoff)
   * 4. Updates verification status to 'verified' if successful
   * 5. Tracks attempts (max 5) before marking as failed
   *
   * @param request - Confirmation request containing orgId and either verificationId or phoneNumber
   * @returns Promise resolving to verified number details
   * @throws Error if verification not found, expired, max attempts exceeded (5), or not yet complete
   * @throws Error with attemptsRemaining property when verification incomplete
   * @example
   * const result = await TelephonyService.confirmVerification({
   *   orgId: 'org_123',
   *   verificationId: 'ver_456'
   * });
   */
  static async confirmVerification(
    request: VerificationConfirmRequest
  ): Promise<VerificationConfirmResponse> {
    const { orgId, verificationId, phoneNumber } = request;

    // Fetch pending verification
    let query = supabase
      .from('verified_caller_ids')
      .select('*')
      .eq('org_id', orgId)
      .eq('status', 'pending');

    if (verificationId) {
      query = query.eq('id', verificationId);
    } else if (phoneNumber) {
      query = query.eq('phone_number', phoneNumber);
    } else {
      throw new Error('verificationId or phoneNumber is required');
    }

    const { data: verification, error: fetchError } = await query.maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw new Error('Database error');
    }

    if (!verification) {
      throw new Error('No pending verification found');
    }

    // Check expiration
    if (new Date(verification.verification_code_expires_at) < new Date()) {
      await supabase
        .from('verified_caller_ids')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('id', verification.id);

      throw new Error('Verification code has expired. Please initiate a new verification.');
    }

    // Get Twilio credentials
    const twilioCredentials = await IntegrationDecryptor.getTwilioCredentials(orgId);
    if (!twilioCredentials) {
      throw new Error('Twilio credentials not found');
    }

    const twilioClient = twilio(twilioCredentials.accountSid, twilioCredentials.authToken);

    // Check if Twilio has verified the number (with retry logic)
    const callerIdSid = await checkTwilioVerificationWithRetry(
      twilioClient,
      verification.phone_number,
      3 // Retry up to 3 times with exponential backoff
    );

    if (!callerIdSid) {
      // Increment attempt counter
      const newAttempts = (verification.verification_attempts || 0) + 1;
      await supabase
        .from('verified_caller_ids')
        .update({
          verification_attempts: newAttempts,
          updated_at: new Date().toISOString()
        })
        .eq('id', verification.id);

      if (newAttempts >= 5) {
        await supabase
          .from('verified_caller_ids')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('id', verification.id);

        throw new Error('Maximum verification attempts exceeded. Please initiate a new verification.');
      }

      const verificationError = new Error('Verification not yet complete. Please enter the code on the phone call.') as Error & { attemptsRemaining: number };
      verificationError.attemptsRemaining = 5 - newAttempts;
      throw verificationError;
    }

    // Success! Update verification record
    const { data: updatedVerification, error: updateError } = await supabase
      .from('verified_caller_ids')
      .update({
        status: 'verified',
        twilio_caller_id_sid: callerIdSid,
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', verification.id)
      .select()
      .single();

    if (updateError) {
      throw new Error('Failed to confirm verification');
    }

    return {
      success: true,
      verifiedNumber: {
        id: updatedVerification.id,
        phoneNumber: updatedVerification.phone_number,
        friendlyName: updatedVerification.friendly_name,
        status: 'verified',
        verifiedAt: updatedVerification.verified_at
      }
    };
  }

  /**
   * Create forwarding configuration and generate GSM codes
   *
   * Performs the following:
   * 1. Verifies caller ID belongs to org and is verified
   * 2. Retrieves org's Twilio forwarding number
   * 3. Generates carrier-specific GSM codes (activation/deactivation)
   * 4. Creates/updates forwarding config in database
   * 5. Returns config with GSM codes for user to dial
   *
   * GSM codes vary by carrier:
   * - T-Mobile: **21* (total) or **61* (safety net)
   * - AT&T: *21* (total) or *004* (safety net)
   * - Verizon: *72 (total) or *71 (safety net)
   *
   * @param request - Config request containing orgId, verifiedCallerId, forwardingType, carrier, and optional ringTimeSeconds
   * @returns Promise resolving to config with activation/deactivation codes
   * @throws Error if caller ID not found, not verified, or Twilio number not configured
   * @example
   * const result = await TelephonyService.createForwardingConfig({
   *   orgId: 'org_123',
   *   verifiedCallerId: 'cal_456',
   *   forwardingType: 'safety_net',
   *   carrier: 'tmobile',
   *   ringTimeSeconds: 25
   * });
   */
  static async createForwardingConfig(
    request: ForwardingConfigRequest
  ): Promise<ForwardingConfigResponse> {
    const { orgId, verifiedCallerId, forwardingType, carrier, ringTimeSeconds } = request;

    const validRingTime = ringTimeSeconds ? Math.min(60, Math.max(5, ringTimeSeconds)) : 25;

    // Verify the caller ID belongs to this org and is verified
    const { data: verifiedNumber, error: verifyError } = await supabase
      .from('verified_caller_ids')
      .select('id, phone_number, status')
      .eq('id', verifiedCallerId)
      .eq('org_id', orgId)
      .maybeSingle();

    if (verifyError || !verifiedNumber) {
      throw new Error('Verified caller ID not found');
    }

    if (verifiedNumber.status !== 'verified') {
      throw new Error('Caller ID is not yet verified. Complete verification first.');
    }

    // Get org's Twilio number (forwarding destination)
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('config')
      .eq('org_id', orgId)
      .eq('provider', 'twilio_inbound')
      .maybeSingle();

    if (integrationError || !integration?.config?.phoneNumber) {
      throw new Error('Twilio inbound number not configured. Set up inbound telephony first.');
    }

    const twilioForwardingNumber = integration.config.phoneNumber;

    // Generate GSM codes
    const codeConfig: CarrierCodeConfig = {
      carrier: carrier as any,
      forwardingType,
      destinationNumber: twilioForwardingNumber,
      ringTimeSeconds: forwardingType === 'safety_net' ? validRingTime : undefined
    };

    const codes = generateForwardingCodes(codeConfig);

    // Create/update forwarding config
    const { data: config, error: upsertError } = await supabase
      .from('hybrid_forwarding_configs')
      .upsert({
        org_id: orgId,
        verified_caller_id: verifiedCallerId,
        sim_phone_number: verifiedNumber.phone_number,
        forwarding_type: forwardingType,
        carrier,
        twilio_forwarding_number: twilioForwardingNumber,
        ring_time_seconds: validRingTime,
        generated_activation_code: codes.activation,
        generated_deactivation_code: codes.deactivation,
        status: 'pending_setup',
        user_confirmed_setup: false,
        updated_at: new Date().toISOString()
      }, { onConflict: 'org_id,sim_phone_number' })
      .select()
      .single();

    if (upsertError) {
      throw new Error('Failed to create forwarding config');
    }

    return {
      success: true,
      config: {
        id: config.id,
        forwardingType: config.forwarding_type,
        carrier: config.carrier,
        twilioForwardingNumber: config.twilio_forwarding_number,
        ringTimeSeconds: config.ring_time_seconds,
        activationCode: codes.activation,
        deactivationCode: codes.deactivation,
        status: config.status
      }
    };
  }

  /**
   * Confirm user has dialed the GSM activation code
   *
   * Updates forwarding config status to 'active' after user confirms
   * they've successfully dialed the GSM code on their phone.
   *
   * @param orgId - Organization ID
   * @param configId - Forwarding configuration ID
   * @returns Promise resolving to success indicator
   * @throws Error if config not found or update fails
   */
  static async confirmSetup(orgId: string, configId: string): Promise<{ success: boolean }> {
    const { data: config, error: fetchError } = await supabase
      .from('hybrid_forwarding_configs')
      .select('id, status')
      .eq('id', configId)
      .eq('org_id', orgId)
      .maybeSingle();

    if (fetchError || !config) {
      throw new Error('Forwarding config not found');
    }

    const { error: updateError } = await supabase
      .from('hybrid_forwarding_configs')
      .update({
        status: 'active',
        user_confirmed_setup: true,
        confirmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', configId)
      .eq('org_id', orgId);

    if (updateError) {
      throw new Error('Failed to confirm configuration');
    }

    return { success: true };
  }

  /**
   * Delete a verified caller ID and remove from Twilio
   *
   * Performs the following:
   * 1. Verifies ownership (orgId match)
   * 2. Attempts to remove from Twilio (non-fatal if fails)
   * 3. Deletes from database (cascades to forwarding configs)
   *
   * @param orgId - Organization ID
   * @param numberId - Verified caller ID to delete
   * @returns Promise resolving to success indicator
   * @throws Error if number not found or database deletion fails
   * @note Twilio removal failure is logged but non-fatal
   */
  static async deleteVerifiedNumber(orgId: string, numberId: string): Promise<{ success: boolean }> {
    // Verify ownership
    const { data: verification, error: fetchError } = await supabase
      .from('verified_caller_ids')
      .select('id, phone_number, twilio_caller_id_sid')
      .eq('id', numberId)
      .eq('org_id', orgId)
      .maybeSingle();

    if (fetchError || !verification) {
      throw new Error('Verified number not found');
    }

    // Remove from Twilio if we have the SID
    if (verification.twilio_caller_id_sid) {
      try {
        const twilioCredentials = await IntegrationDecryptor.getTwilioCredentials(orgId);
        if (twilioCredentials) {
          const twilioClient = twilio(twilioCredentials.accountSid, twilioCredentials.authToken);
          await twilioClient.outgoingCallerIds(verification.twilio_caller_id_sid).remove();
        }
      } catch (twilioError) {
        const errorMessage = twilioError instanceof Error ? twilioError.message : 'Unknown error';
        logger.warn('Failed to remove from Twilio (non-fatal)', { error: errorMessage });
      }
    }

    // Delete from database (will cascade delete forwarding config)
    const { error: deleteError } = await supabase
      .from('verified_caller_ids')
      .delete()
      .eq('id', numberId)
      .eq('org_id', orgId);

    if (deleteError) {
      throw new Error('Failed to delete verified number');
    }

    return { success: true };
  }
}
