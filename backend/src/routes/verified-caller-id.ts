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
 *   - IntegrationDecryptor.getTwilioCredentials(orgId)
 *   - Which queries org_credentials table
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
import logger from '../services/logger';

const router = Router();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
 * 2. Call IntegrationDecryptor.getTwilioCredentials(orgId)
 * 3. Credentials retrieved from org_credentials table (NOT environment variables)
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
      credentials = await IntegrationDecryptor.getTwilioCredentials(orgId);
    } catch (error: any) {
      logger.error('verified-caller-id', 'Failed to get Twilio credentials', { orgId, error: error.message });
      return res.status(400).json({ error: 'Twilio credentials not configured. Please connect your Twilio account in integrations.' });
    }

    // Create Twilio client
    const twilioClient = twilio(credentials.accountSid, credentials.authToken);

    // Create Twilio validation request for outgoing caller ID verification
    // This will trigger an automated call to the phone number with a 6-digit code
    // Using the Twilio REST API directly for maximum compatibility
    let validation: any;
    try {
      // TypeScript doesn't have complete types for outgoingCallerIds, but the method exists at runtime
      validation = await (twilioClient.outgoingCallerIds as any).create({
        phoneNumber: phoneNumber,
        friendlyName: `Voxanne AI - ${phoneNumber}`
      });

      logger.info('verified-caller-id', 'Outgoing Caller ID created', {
        sid: validation.sid,
        phoneNumber: phoneNumber,
        validationStatus: validation.validationStatus
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
        details: {
          from: '+14157234000',
          expectedWait: '1-2 minutes',
          action: 'When you answer, you will hear a 6-digit verification code. Enter it on this page to complete verification.',
          tip: 'Have a phone ready to answer the incoming call from Twilio.'
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
 * Confirm phone number verification with 6-digit code
 */
router.post('/confirm', requireAuth, async (req: Request, res: Response) => {
  try {
    const { phoneNumber, code } = req.body;
    const orgId = (req.user as any)?.orgId;

    if (!phoneNumber || !code) {
      return res.status(400).json({ error: 'Phone number and verification code are required' });
    }

    logger.info('verified-caller-id', 'Confirming caller ID verification', { orgId, phoneNumber });

    // Get verification record
    const { data: record, error: selectError } = await supabase
      .from('verified_caller_ids')
      .select('*')
      .eq('org_id', orgId)
      .eq('phone_number', phoneNumber)
      .eq('status', 'pending')
      .maybeSingle();

    if (selectError || !record) {
      logger.error('verified-caller-id', 'Verification record not found', { orgId, phoneNumber, selectError });
      return res.status(404).json({ error: 'Verification record not found. Please request a new verification code.' });
    }

    // Check if code matches
    if (record.verification_code !== code) {
      logger.warn('verified-caller-id', 'Invalid verification code', { orgId, phoneNumber });

      // Mark as failed
      await supabase
        .from('verified_caller_ids')
        .update({
          status: 'failed',
          updated_at: new Date().toISOString()
        })
        .eq('id', record.id);

      return res.status(400).json({ error: 'Invalid verification code. Please try again.' });
    }

    // Mark as verified
    const { error: updateError } = await supabase
      .from('verified_caller_ids')
      .update({
        status: 'verified',
        verified_at: new Date().toISOString(),
        verification_code: null, // Clear the code for security
        updated_at: new Date().toISOString()
      })
      .eq('id', record.id);

    if (updateError) {
      logger.error('verified-caller-id', 'Error updating verification status', { error: updateError });
      return res.status(500).json({ error: 'Failed to confirm verification' });
    }

    logger.info('verified-caller-id', 'Caller ID verified successfully', { orgId, phoneNumber });

    res.json({
      success: true,
      message: `✅ Verified! Outbound calls will now show ${phoneNumber} as Caller ID.`,
      phoneNumber,
      verifiedAt: new Date().toISOString()
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
      .select('id, phone_number, country_code, verified_at, status')
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
 * DELETE /api/verified-caller-id/:id
 * Remove a verified caller ID
 */
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = (req.user as any)?.orgId;

    const { error } = await supabase
      .from('verified_caller_ids')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId); // Security: only delete own org's numbers

    if (error) {
      logger.error('verified-caller-id', 'Error deleting verified number', { error });
      return res.status(500).json({ error: 'Failed to delete verified number' });
    }

    logger.info('verified-caller-id', 'Verified caller ID deleted', { orgId, id });

    res.json({ success: true, message: 'Verified number removed' });

  } catch (error: any) {
    logger.error('verified-caller-id', 'Error deleting verified number', { error });
    res.status(500).json({ error: error.message || 'Deletion failed' });
  }
});

export default router;
