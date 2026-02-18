/**
 * Verified Caller ID API Routes
 *
 * ============================================================================
 * 🔐 CRITICAL ARCHITECTURE PRINCIPLE
 * ============================================================================
 *
 * ORGANIZATION CREDENTIALS ARE THE SINGLE SOURCE OF TRUTH
 *
 * This module handles verified caller IDs for multiple organizations with
 * different Twilio account types:
 *
 * 1. BYOC (Bring Your Own Carrier)
 *    - Organization provides their own Twilio account credentials
 *    - Credentials stored in org_credentials table
 *    - User has full control of their Twilio account
 *
 * 2. MANAGED TELEPHONY
 *    - Platform allocates Twilio numbers to organization
 *    - Organization credentials stored in org_credentials table
 *    - User accesses via this API
 *
 * Both scenarios retrieve credentials from:
 *   - IntegrationDecryptor.getEffectiveTwilioCredentials(orgId)
 *   - BYOC: queries org_credentials table
 *   - Managed: queries twilio_subaccounts table
 *   - NEVER uses environment variables (no fallback)
 *
 * This ensures:
 * ✅ Complete credential isolation per organization
 * ✅ No cross-org credential leakage
 * ✅ BYOC users use their own accounts
 * ✅ Managed users use their allocated accounts
 * ✅ Single source of truth eliminates env var confusion
 *
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import twilio from 'twilio';
import { requireAuth } from '../middleware/auth';
import { IntegrationDecryptor } from '../services/integration-decryptor';
import { ManagedTelephonyService } from '../services/managed-telephony-service';
import { VapiClient } from '../services/vapi-client';
import logger from '../services/logger';

const router = Router();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Import a verified caller ID number into Vapi so it can be used for outbound calls.
 *
 * This bridges the gap between Twilio verification and Vapi's outbound call system:
 *   1. Import the Twilio number into Vapi → get a UUID (phoneNumberId)
 *   2. Store the UUID in verified_caller_ids.vapi_phone_number_id
 *   3. Update the org's outbound agent so outbound calls use this number immediately
 *
 * IDEMPOTENT: If the number already exists in Vapi (HTTP 400), we look it up by phone
 * number and use the existing UUID. This prevents the delete-and-re-verify failure loop.
 * Pattern reused from: backend/src/routes/phone-numbers.ts:87-117
 */
async function importVerifiedNumberToVapi(
  orgId: string,
  phoneNumber: string
): Promise<{ success: boolean; vapiPhoneNumberId?: string; error?: string }> {
  try {
    // Get org's Twilio credentials for the import
    const credentials = await IntegrationDecryptor.getEffectiveTwilioCredentials(orgId);

    const vapiClient = new VapiClient(process.env.VAPI_PRIVATE_KEY);

    // Idempotent import: try import, on 400 "already exists" look up existing UUID
    let vapiPhoneNumberId: string | null = null;

    try {
      const importResult = await vapiClient.importTwilioNumber({
        phoneNumber,
        twilioAccountSid: credentials.accountSid,
        twilioAuthToken: credentials.authToken,
        name: `Verified Caller ID - ${phoneNumber}`
      });
      vapiPhoneNumberId = importResult?.id || null;
    } catch (importErr: any) {
      // Vapi returns 400 if number already imported — handle idempotently
      // Same pattern as phone-numbers.ts:87-117
      if (importErr.response?.status === 400 ||
          importErr.message?.includes('status code 400') ||
          importErr.message?.includes('already in use') ||
          importErr.message?.includes('Existing Phone Number')) {
        logger.info('verified-caller-id', 'Number already in Vapi, looking up existing ID', { orgId, phoneNumber });
        const numbers = await vapiClient.listPhoneNumbers();
        const existing = numbers.find((n: any) => n.number === phoneNumber);
        if (existing) {
          vapiPhoneNumberId = existing.id;
          logger.info('verified-caller-id', 'Found existing Vapi number', { orgId, vapiPhoneNumberId });
        }
      }
      // If not a duplicate error, vapiPhoneNumberId stays null
      if (!vapiPhoneNumberId) {
        logger.warn('verified-caller-id', 'Vapi import failed', { orgId, error: importErr.message });
      }
    }

    if (!vapiPhoneNumberId) {
      return { success: false, error: 'Could not import or find number in Vapi' };
    }

    // Store the Vapi phone number UUID in verified_caller_ids
    const { error: updateError } = await supabase
      .from('verified_caller_ids')
      .update({ vapi_phone_number_id: vapiPhoneNumberId })
      .eq('org_id', orgId)
      .eq('phone_number', phoneNumber);

    if (updateError) {
      logger.error('verified-caller-id', 'Failed to store vapi_phone_number_id in DB — cleaning up orphaned Vapi number', {
        orgId, vapiPhoneNumberId, error: updateError
      });
      // Clean up the orphaned Vapi number
      try { await vapiClient.deletePhoneNumber(vapiPhoneNumberId); } catch { /* best-effort */ }
      return { success: false, error: 'DB update failed after Vapi import' };
    }

    // Update the org's outbound agent to use this number immediately
    try {
      const { data: outboundAgent } = await supabase
        .from('agents')
        .select('id')
        .eq('org_id', orgId)
        .eq('role', 'outbound')
        .maybeSingle();

      if (outboundAgent) {
        await supabase
          .from('agents')
          .update({ vapi_phone_number_id: vapiPhoneNumberId })
          .eq('id', outboundAgent.id);

        logger.info('verified-caller-id', 'Updated outbound agent with verified caller ID', {
          orgId, agentId: outboundAgent.id, vapiPhoneNumberId
        });
      }
    } catch (agentErr: any) {
      logger.warn('verified-caller-id', 'Could not update outbound agent (non-fatal)', {
        orgId, error: agentErr.message
      });
    }

    // Verify the agent was actually updated (catches silent write failures)
    try {
      const { data: verifyAgent } = await supabase
        .from('agents')
        .select('vapi_phone_number_id')
        .eq('org_id', orgId)
        .eq('role', 'outbound')
        .maybeSingle();

      if (verifyAgent && verifyAgent.vapi_phone_number_id !== vapiPhoneNumberId) {
        await supabase
          .from('agents')
          .update({ vapi_phone_number_id: vapiPhoneNumberId })
          .eq('org_id', orgId)
          .eq('role', 'outbound');
        logger.warn('verified-caller-id', 'Agent had stale phone ID — force-updated', {
          orgId, old: verifyAgent.vapi_phone_number_id, new: vapiPhoneNumberId
        });
      }
    } catch { /* best-effort verification */ }

    logger.info('verified-caller-id', 'Successfully imported verified number into Vapi', {
      orgId, phoneNumber: phoneNumber.slice(-4), vapiPhoneNumberId
    });

    return { success: true, vapiPhoneNumberId };
  } catch (err: any) {
    logger.warn('verified-caller-id', 'Vapi import failed (non-fatal — verification still valid)', {
      orgId, phoneNumber: phoneNumber.slice(-4), error: err.message
    });
    return { success: false, error: err.message };
  }
}

/**
 * POST /api/verified-caller-id/verify
 * Initiate phone number verification via Twilio Caller ID validation
 *
 * ✅ CRITICAL ARCHITECTURE: ORGANIZATION CREDENTIALS ARE SINGLE SOURCE OF TRUTH
 *
 * This endpoint uses the ORGANIZATION'S STORED CREDENTIALS, not environment variables.
 * This supports both:
 * - BYOC (Bring Your Own Carrier): Organization provides their own Twilio account credentials
 * - Managed Telephony: Organization uses platform-provided managed numbers (stored in org_credentials table)
 *
 * Credential retrieval flow:
 * 1. Extract orgId from authenticated user
 * 2. Call IntegrationDecryptor.getEffectiveTwilioCredentials(orgId)
 * 3. Checks telephony_mode: managed → twilio_subaccounts, byoc → org_credentials
 * 4. If credentials not found, error is returned (user must configure in settings)
 * 5. Credentials are decrypted and used to create Twilio client
 *
 * This ensures:
 * - Each organization's Twilio credentials are completely isolated
 * - BYOC users use their own credentials
 * - Managed users use their allocated credentials
 * - No cross-org credential leakage
 */
router.post('/verify', requireAuth, async (req: Request, res: Response) => {
  try {
    const { phoneNumber, countryCode = 'US' } = req.body;
    const orgId = (req.user as any)?.orgId;

    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    // Validate phone number format (basic E.164 check)
    if (!phoneNumber.startsWith('+')) {
      return res.status(400).json({ error: 'Phone number must be in E.164 format (e.g., +15551234567)' });
    }

    logger.info('verified-caller-id', 'Initiating caller ID verification', { orgId, phoneNumber });

    // ✅ CRITICAL: Retrieve ORGANIZATION'S stored Twilio credentials
    // This supports both BYOC (org's own account) and managed telephony (platform-allocated)
    // NEVER falls back to environment variables - org_credentials table is the single source of truth
    let credentials;
    try {
      credentials = await IntegrationDecryptor.getEffectiveTwilioCredentials(orgId);
    } catch (error: any) {
      logger.error('verified-caller-id', 'Failed to get Twilio credentials', { orgId, error: error.message });
      return res.status(400).json({ error: 'Twilio credentials not configured. Please connect your Twilio account in integrations.' });
    }

    // Create Twilio client
    const twilioClient = twilio(credentials.accountSid, credentials.authToken);

    // STEP 1: Check if number is already verified in Twilio (prevents duplicate verification error)
    logger.info('verified-caller-id', 'Checking if number already verified in Twilio', { phoneNumber });

    let existingCallerIds;
    try {
      existingCallerIds = await twilioClient.outgoingCallerIds.list({
        phoneNumber: phoneNumber,
        limit: 1
      });
    } catch (err: any) {
      logger.warn('verified-caller-id', 'Could not check existing caller IDs', { error: err.message });
      existingCallerIds = [];
    }

    // If already verified in Twilio, skip verification call and mark as verified
    if (existingCallerIds && existingCallerIds.length > 0) {
      const twilioCallerIdSid = existingCallerIds[0].sid;
      logger.info('verified-caller-id', 'Number already verified in Twilio, updating database', {
        phoneNumber, twilioCallerIdSid
      });

      // Update or create database record as verified (include twilio_caller_id_sid)
      const { data: existingRecord } = await supabase
        .from('verified_caller_ids')
        .select('id')
        .eq('org_id', orgId)
        .eq('phone_number', phoneNumber)
        .maybeSingle();

      if (existingRecord) {
        await supabase
          .from('verified_caller_ids')
          .update({
            status: 'verified',
            twilio_caller_id_sid: twilioCallerIdSid,
            verified_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', existingRecord.id);
      } else {
        await supabase
          .from('verified_caller_ids')
          .insert({
            org_id: orgId,
            phone_number: phoneNumber,
            country_code: countryCode,
            status: 'verified',
            twilio_caller_id_sid: twilioCallerIdSid,
            verified_at: new Date().toISOString()
          });
      }

      // Import into Vapi so outbound calls use this number
      const vapiImport = await importVerifiedNumberToVapi(orgId, phoneNumber);

      return res.json({
        success: true,
        verified: true,
        message: vapiImport.success
          ? `${phoneNumber} is verified! Outbound calls will show this number.`
          : `${phoneNumber} is verified but could not be linked to outbound calls yet. Try refreshing the page.`,
        phoneNumber: phoneNumber,
        status: 'verified',
        vapiLinked: vapiImport.success
      });
    }

    // STEP 2: Number not verified in Twilio - initiate verification call
    // Create Twilio validation request for outgoing caller ID verification
    // This will trigger an automated call to the phone number with a 6-digit code
    // Using validationRequests API (correct Twilio SDK method)
    let validation: any;
    try {
      validation = await twilioClient.validationRequests.create({
        phoneNumber: phoneNumber,
        friendlyName: `Voxanne AI - ${phoneNumber}`
      });

      logger.info('verified-caller-id', 'Outgoing Caller ID created - FULL RESPONSE', {
        fullValidationObject: validation // Log entire Twilio response
      });
    } catch (validationError: any) {
      const errorMsg = validationError?.message || String(validationError);
      const errorCode = validationError?.code;

      logger.error('verified-caller-id', 'Failed to initiate caller ID verification', {
        error: errorMsg,
        code: errorCode,
        status: validationError?.status,
        phoneNumber: phoneNumber,
        orgId: orgId
      });

      // Handle Geo Permissions error (international calling blocked)
      if (errorCode === 13227 || errorMsg.includes('International Permission') || errorMsg.includes('Geo Permission')) {
        const { data: orgData } = await supabase
          .from('organizations')
          .select('telephony_mode')
          .eq('id', orgId)
          .single();

        if (orgData?.telephony_mode === 'managed') {
          try {
            // Auto-enable Geo Permissions inheritance and retry
            await ManagedTelephonyService.enableGeoPermissionInheritance(
              credentials.accountSid,
              credentials.authToken
            );
            await new Promise(resolve => setTimeout(resolve, 5000));
            validation = await twilioClient.validationRequests.create({
              phoneNumber,
              friendlyName: `Voxanne AI - ${phoneNumber}`
            });
            // Retry succeeded — skip remaining error handling, fall through to DB storage
          } catch (retryErr: any) {
            logger.error('verified-caller-id', 'Geo Permissions auto-fix retry failed', { error: retryErr.message });
            return res.status(400).json({
              error: 'International calling permissions are being configured. Please try again in 1 minute.',
              code: 13227
            });
          }
        } else {
          return res.status(400).json({
            error: 'Your Twilio account does not have permission to call this country. Enable Geo Permissions in your Twilio Console.',
            code: errorCode,
            helpUrl: 'https://console.twilio.com/us1/develop/voice/settings/geo-permissions'
          });
        }
      }

      // If validation was set by a successful retry above, skip remaining error handling
      if (!validation) {
      // Parse Twilio error codes and provide helpful guidance
      if (errorCode === 20003 || errorMsg.includes('Authentication Error')) {
        return res.status(400).json({
          error: 'Twilio authentication failed. Please verify your Twilio credentials are correct in your integrations.',
          code: errorCode
        });
      } else if (errorCode === 21211 || errorMsg.includes('invalid phone')) {
        return res.status(400).json({
          error: 'Invalid phone number format. Use E.164 format (e.g., +15551234567)',
          code: errorCode
        });
      } else if (errorMsg.includes('unverified') || errorCode === 21613) {
        return res.status(400).json({
          error: 'Your Twilio account is not verified for this phone number. Please verify this number first in your Twilio Console: https://console.twilio.com/us1/phone-numbers/verified-caller-ids',
          code: errorCode,
          helpUrl: 'https://www.twilio.com/docs/voice/api/outgoing-caller-ids'
        });
      } else if (errorMsg.includes('Trial') || errorMsg.includes('trial')) {
        return res.status(400).json({
          error: 'Trial Twilio accounts have limited verification capabilities. To receive verification calls, you must first upgrade your account or manually verify this number in the Twilio Console.',
          code: errorCode,
          helpUrl: 'https://console.twilio.com/us1/phone-numbers/verified-caller-ids',
          solution: 'Go to Twilio Console > Phone Numbers > Verified Caller IDs > Verify a Number'
        });
      }

      return res.status(400).json({
        error: `Failed to initiate verification: ${errorMsg}`,
        code: errorCode,
        troubleshoot: 'Please ensure your Twilio account is upgraded (not trial) and that you have permission to verify phone numbers.'
      });
      } // end if (!validation)
    }

    // Store verification record in database
    const { data: existingRecord, error: selectError } = await supabase
      .from('verified_caller_ids')
      .select('id')
      .eq('org_id', orgId)
      .eq('phone_number', phoneNumber)
      .maybeSingle();

    if (selectError) {
      logger.error('verified-caller-id', 'Error checking existing verification', { selectError });
    }

    if (existingRecord) {
      // Update existing record
      const { error: updateError } = await supabase
        .from('verified_caller_ids')
        .update({
          verification_sid: validation.sid,
          status: validation.validationStatus === 'verified' ? 'verified' : 'pending',
          country_code: countryCode,
          verified_at: validation.validationStatus === 'verified' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingRecord.id);

      if (updateError) {
        logger.error('verified-caller-id', 'Error updating verification record', { error: updateError, orgId });
        return res.status(500).json({ error: 'Failed to update verification record in database' });
      }
    } else {
      // Insert new record
      const { error: insertError } = await supabase
        .from('verified_caller_ids')
        .insert({
          org_id: orgId,
          phone_number: phoneNumber,
          country_code: countryCode,
          verification_sid: validation.sid,
          status: validation.validationStatus === 'verified' ? 'verified' : 'pending',
          verified_at: validation.validationStatus === 'verified' ? new Date().toISOString() : null
        });

      if (insertError) {
        logger.error('verified-caller-id', 'Error creating verification record', { error: insertError, orgId });
        return res.status(500).json({ error: 'Failed to create verification record in database' });
      }
    }

    logger.info('verified-caller-id', `Verification initiated successfully for ${phoneNumber}`, {
      orgId,
      phoneNumber,
      sid: validation.sid,
      status: validation.validationStatus
    });

    // Check if already verified
    if (validation.validationStatus === 'verified') {
      res.json({
        success: true,
        verified: true,
        message: 'Phone number is already verified!',
        phoneNumber: phoneNumber,
        status: 'verified'
      });
    } else {
      // Still pending verification - user will receive a call
      res.json({
        success: true,
        verified: false,
        message: 'Verification call initiated! You will receive an automated call within 1-2 minutes from +14157234000 (Twilio).',
        validationCode: validation.validationCode, // CRITICAL: Display this code to user
        details: {
          from: '+14157234000',
          expectedWait: '1-2 minutes',
          action: 'When Twilio calls, the automated voice will ask you to enter a code. Enter the code shown on this screen using your phone keypad.',
          tip: 'Keep this page open to see your verification code.'
        },
        phoneNumber: phoneNumber,
        validationSid: validation.sid,
        status: validation.validationStatus
      });
    }

  } catch (error: any) {
    logger.error('verified-caller-id', 'Error in caller ID verification', { error });
    res.status(500).json({ error: error.message || 'Verification failed' });
  }
});

/**
 * POST /api/verified-caller-id/confirm
 * Check if phone number verification completed via Twilio API.
 *
 * Twilio caller ID verification is phone-based: user enters the 6-digit code
 * on their phone keypad during the automated call. This endpoint checks Twilio
 * to see if the verification was successful.
 */
router.post('/confirm', requireAuth, async (req: Request, res: Response) => {
  try {
    const { phoneNumber } = req.body;
    const orgId = (req.user as any)?.orgId;

    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    logger.info('verified-caller-id', 'Checking caller ID verification status', { orgId, phoneNumber });

    // Get org credentials (same method as verify endpoint)
    let credentials;
    try {
      credentials = await IntegrationDecryptor.getEffectiveTwilioCredentials(orgId);
    } catch (error: any) {
      logger.error('verified-caller-id', 'Failed to get credentials for confirm', { orgId, error: error.message });
      return res.status(400).json({ error: 'Twilio credentials not configured.' });
    }

    const twilioClient = twilio(credentials.accountSid, credentials.authToken);

    // Check Twilio directly for verified caller ID
    const callerIds = await twilioClient.outgoingCallerIds.list({
      phoneNumber: phoneNumber,
      limit: 1
    });

    if (callerIds.length > 0) {
      const twilioCallerIdSid = callerIds[0].sid;

      // Number is verified in Twilio — update our DB (include twilio_caller_id_sid)
      const { error: updateError } = await supabase
        .from('verified_caller_ids')
        .update({
          status: 'verified',
          twilio_caller_id_sid: twilioCallerIdSid,
          verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('org_id', orgId)
        .eq('phone_number', phoneNumber);

      if (updateError) {
        logger.error('verified-caller-id', 'Error updating verification status', { error: updateError });
      }

      logger.info('verified-caller-id', 'Caller ID verified successfully', { orgId, phoneNumber, twilioCallerIdSid });

      // Import into Vapi so outbound calls use this number
      const vapiImport = await importVerifiedNumberToVapi(orgId, phoneNumber);

      return res.json({
        success: true,
        message: vapiImport.success
          ? `Verified! Outbound calls will now show ${phoneNumber} as Caller ID.`
          : `${phoneNumber} is verified but could not be linked to outbound calls yet. Try refreshing the page.`,
        phoneNumber,
        verifiedAt: new Date().toISOString(),
        vapiLinked: vapiImport.success
      });
    }

    // Not yet verified in Twilio
    logger.info('verified-caller-id', 'Caller ID not yet verified in Twilio', { orgId, phoneNumber });
    return res.status(400).json({
      error: 'Verification not yet complete. Please answer the call and enter the code on your phone keypad, then try again.',
      retryable: true
    });

  } catch (error: any) {
    logger.error('verified-caller-id', 'Error confirming verification', { error });
    res.status(500).json({ error: error.message || 'Confirmation failed' });
  }
});

/**
 * GET /api/verified-caller-id/list
 * Get all verified numbers for the organization
 */
router.get('/list', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = (req.user as any)?.orgId;

    const { data, error } = await supabase
      .from('verified_caller_ids')
      .select('id, phone_number, country_code, verified_at, status, vapi_phone_number_id')
      .eq('org_id', orgId)
      .order('verified_at', { ascending: false });

    if (error) {
      logger.error('verified-caller-id', 'Error fetching verified numbers', { error });
      return res.status(500).json({ error: 'Failed to fetch verified numbers' });
    }

    res.json({
      numbers: data || [],
      count: data?.length || 0
    });

  } catch (error: any) {
    logger.error('verified-caller-id', 'Error listing verified numbers', { error });
    res.status(500).json({ error: error.message || 'Failed to list numbers' });
  }
});

/**
 * Full cleanup of a verified caller ID:
 *   1. Twilio: Remove from outgoingCallerIds
 *   2. Vapi: Delete the imported phone number
 *   3. Agent: Reset vapi_phone_number_id on the outbound agent
 *   4. DB: Delete the verified_caller_ids record
 *
 * Steps 1-3 are best-effort — DB delete (step 4) must succeed for 200 response.
 */
async function cleanupVerifiedCallerId(
  orgId: string,
  record: { id: string; phone_number: string; twilio_caller_id_sid?: string; vapi_phone_number_id?: string }
): Promise<{ twilioRemoved: boolean; vapiRemoved: boolean; agentReset: boolean; dbDeleted: boolean }> {
  const cleanup = { twilioRemoved: false, vapiRemoved: false, agentReset: false, dbDeleted: false };

  // Step 1: Remove from Twilio outgoingCallerIds
  if (record.twilio_caller_id_sid) {
    try {
      const credentials = await IntegrationDecryptor.getEffectiveTwilioCredentials(orgId);
      const twilioClient = twilio(credentials.accountSid, credentials.authToken);
      await twilioClient.outgoingCallerIds(record.twilio_caller_id_sid).remove();
      cleanup.twilioRemoved = true;
      logger.info('verified-caller-id', 'Removed from Twilio outgoingCallerIds', {
        orgId, sid: record.twilio_caller_id_sid
      });
    } catch (err: any) {
      logger.warn('verified-caller-id', 'Twilio cleanup failed (best-effort)', {
        orgId, sid: record.twilio_caller_id_sid, error: err.message
      });
    }
  }

  // Step 2: Delete imported phone number from Vapi
  if (record.vapi_phone_number_id) {
    try {
      const vapiClient = new VapiClient(process.env.VAPI_PRIVATE_KEY);
      await vapiClient.deletePhoneNumber(record.vapi_phone_number_id);
      cleanup.vapiRemoved = true;
      logger.info('verified-caller-id', 'Removed from Vapi', {
        orgId, vapiPhoneNumberId: record.vapi_phone_number_id
      });
    } catch (err: any) {
      logger.warn('verified-caller-id', 'Vapi cleanup failed (best-effort)', {
        orgId, vapiPhoneNumberId: record.vapi_phone_number_id, error: err.message
      });
    }

    // Step 3: Reset outbound agent's vapi_phone_number_id if it points to this number
    try {
      const { data: agent } = await supabase
        .from('agents')
        .select('id')
        .eq('org_id', orgId)
        .eq('vapi_phone_number_id', record.vapi_phone_number_id)
        .maybeSingle();

      if (agent) {
        await supabase
          .from('agents')
          .update({ vapi_phone_number_id: null })
          .eq('id', agent.id);
        cleanup.agentReset = true;
        logger.info('verified-caller-id', 'Reset outbound agent phone number', {
          orgId, agentId: agent.id
        });
      }
    } catch (err: any) {
      logger.warn('verified-caller-id', 'Agent reset failed (best-effort)', {
        orgId, error: err.message
      });
    }
  } else {
    // Step 2b: No stored Vapi ID — search Vapi for orphaned number and clean it up.
    // This handles the case where a previous import succeeded in Vapi but the DB
    // update failed, leaving vapi_phone_number_id NULL while the number persists in Vapi.
    try {
      const vapiClient = new VapiClient(process.env.VAPI_PRIVATE_KEY);
      const numbers = await vapiClient.listPhoneNumbers();
      const orphaned = numbers.find((n: any) => n.number === record.phone_number);
      if (orphaned) {
        await vapiClient.deletePhoneNumber(orphaned.id);
        cleanup.vapiRemoved = true;
        logger.info('verified-caller-id', 'Cleaned up orphaned Vapi number', {
          orgId, vapiPhoneNumberId: orphaned.id, phoneNumber: record.phone_number
        });

        // Also reset the agent if it was pointing to this orphaned number
        try {
          const { data: agent } = await supabase
            .from('agents')
            .select('id')
            .eq('org_id', orgId)
            .eq('vapi_phone_number_id', orphaned.id)
            .maybeSingle();

          if (agent) {
            await supabase
              .from('agents')
              .update({ vapi_phone_number_id: null })
              .eq('id', agent.id);
            cleanup.agentReset = true;
            logger.info('verified-caller-id', 'Reset agent from orphaned Vapi number', {
              orgId, agentId: agent.id
            });
          }
        } catch { /* best-effort */ }
      }
    } catch (err: any) {
      logger.warn('verified-caller-id', 'Orphan Vapi cleanup failed (best-effort)', {
        orgId, error: err.message
      });
    }
  }

  // Step 4: Delete the DB record (must succeed)
  const { error: deleteError } = await supabase
    .from('verified_caller_ids')
    .delete()
    .eq('id', record.id)
    .eq('org_id', orgId);

  if (deleteError) {
    throw new Error(`DB delete failed: ${deleteError.message}`);
  }
  cleanup.dbDeleted = true;

  return cleanup;
}

/**
 * DELETE /api/verified-caller-id/:id
 * Remove a verified caller ID with full Twilio + Vapi + agent cleanup
 */
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = (req.user as any)?.orgId;

    // Fetch the full record for cleanup
    const { data: record, error: fetchError } = await supabase
      .from('verified_caller_ids')
      .select('id, phone_number, twilio_caller_id_sid, vapi_phone_number_id')
      .eq('id', id)
      .eq('org_id', orgId)
      .maybeSingle();

    if (fetchError || !record) {
      return res.status(404).json({ error: 'Verified number not found' });
    }

    const cleanup = await cleanupVerifiedCallerId(orgId, record);

    logger.info('verified-caller-id', 'Verified caller ID fully cleaned up', { orgId, id, cleanup });

    res.json({
      success: true,
      message: `Removed ${record.phone_number} from verified caller IDs, Twilio, and outbound calls. You can now verify a different number.`,
      cleanup
    });

  } catch (error: any) {
    logger.error('verified-caller-id', 'Error deleting verified number', { error: error.message });
    res.status(500).json({ error: error.message || 'Deletion failed' });
  }
});

/**
 * DELETE /api/verified-caller-id
 * Delete/unverify a phone number with full Twilio + Vapi + agent cleanup
 */
router.delete('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { phoneNumber } = req.body;
    const orgId = (req.user as any)?.orgId;

    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    logger.info('verified-caller-id', 'Deleting caller ID verification with full cleanup', { orgId, phoneNumber });

    // Fetch the full record for cleanup
    const { data: record, error: fetchError } = await supabase
      .from('verified_caller_ids')
      .select('id, phone_number, twilio_caller_id_sid, vapi_phone_number_id')
      .eq('org_id', orgId)
      .eq('phone_number', phoneNumber)
      .maybeSingle();

    if (fetchError || !record) {
      return res.status(404).json({ error: 'Verified number not found' });
    }

    const cleanup = await cleanupVerifiedCallerId(orgId, record);

    logger.info('verified-caller-id', 'Caller ID verification fully cleaned up', { orgId, phoneNumber, cleanup });

    res.json({
      success: true,
      message: `Removed ${phoneNumber} from verified caller IDs, Twilio, and outbound calls. You can now verify a different number.`,
      cleanup
    });

  } catch (error: any) {
    logger.error('verified-caller-id', 'Error in delete endpoint', { error: error.message });
    res.status(500).json({ error: error.message || 'Deletion failed' });
  }
});

export default router;
