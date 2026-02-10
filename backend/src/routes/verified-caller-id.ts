import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { authenticateRequest } from '../middleware/auth';
import { IntegrationDecryptor } from '../services/integration-decryptor';
import { log } from '../services/logger';

const router = Router();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/verified-caller-id/verify
 * Initiate phone number verification via Twilio Caller ID validation
 */
router.post('/verify', authenticateRequest, async (req: Request, res: Response) => {
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

    log.info('Initiating caller ID verification', { orgId, phoneNumber });

    // Get Twilio client for this organization
    const twilioClient = await IntegrationDecryptor.getTwilioClient(orgId);

    if (!twilioClient) {
      return res.status(400).json({ error: 'Twilio credentials not configured. Please connect your Twilio account first.' });
    }

    // Create Twilio validation request
    // This will trigger an automated call to the phone number with a 6-digit code
    const validation = await twilioClient.validationRequests.create({
      phoneNumber: phoneNumber,
      friendlyName: `Voxanne AI Verification for ${phoneNumber}`
    });

    // Store verification record in database
    const { data: existingRecord, error: selectError } = await supabase
      .from('verified_caller_ids')
      .select('id')
      .eq('org_id', orgId)
      .eq('phone_number', phoneNumber)
      .maybeSingle();

    if (selectError) {
      log.error('Error checking existing verification', selectError);
    }

    if (existingRecord) {
      // Update existing record
      const { error: updateError } = await supabase
        .from('verified_caller_ids')
        .update({
          verification_sid: validation.sid,
          verification_code: validation.validationCode,
          status: 'pending',
          country_code: countryCode,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingRecord.id);

      if (updateError) {
        log.error('Error updating verification record', updateError);
        return res.status(500).json({ error: 'Failed to update verification record' });
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
          verification_code: validation.validationCode,
          status: 'pending'
        });

      if (insertError) {
        log.error('Error creating verification record', insertError);
        return res.status(500).json({ error: 'Failed to create verification record' });
      }
    }

    log.info('Verification initiated successfully', { orgId, phoneNumber, sid: validation.sid });

    res.json({
      success: true,
      message: 'Verification call initiated. You will receive a call with a 6-digit code.',
      validationCode: validation.validationCode // For testing/dev (remove in production)
    });

  } catch (error: any) {
    log.error('Error in caller ID verification', error);
    res.status(500).json({ error: error.message || 'Verification failed' });
  }
});

/**
 * POST /api/verified-caller-id/confirm
 * Confirm phone number verification with 6-digit code
 */
router.post('/confirm', authenticateRequest, async (req: Request, res: Response) => {
  try {
    const { phoneNumber, code } = req.body;
    const orgId = (req.user as any)?.orgId;

    if (!phoneNumber || !code) {
      return res.status(400).json({ error: 'Phone number and verification code are required' });
    }

    log.info('Confirming caller ID verification', { orgId, phoneNumber });

    // Get verification record
    const { data: record, error: selectError } = await supabase
      .from('verified_caller_ids')
      .select('*')
      .eq('org_id', orgId)
      .eq('phone_number', phoneNumber)
      .eq('status', 'pending')
      .maybeSingle();

    if (selectError || !record) {
      log.error('Verification record not found', { orgId, phoneNumber, selectError });
      return res.status(404).json({ error: 'Verification record not found. Please request a new verification code.' });
    }

    // Check if code matches
    if (record.verification_code !== code) {
      log.warn('Invalid verification code', { orgId, phoneNumber });

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
      log.error('Error updating verification status', updateError);
      return res.status(500).json({ error: 'Failed to confirm verification' });
    }

    log.info('Caller ID verified successfully', { orgId, phoneNumber });

    res.json({
      success: true,
      message: `✅ Verified! Outbound calls will now show ${phoneNumber} as Caller ID.`,
      phoneNumber,
      verifiedAt: new Date().toISOString()
    });

  } catch (error: any) {
    log.error('Error confirming verification', error);
    res.status(500).json({ error: error.message || 'Confirmation failed' });
  }
});

/**
 * GET /api/verified-caller-id/list
 * Get all verified numbers for the organization
 */
router.get('/list', authenticateRequest, async (req: Request, res: Response) => {
  try {
    const orgId = (req.user as any)?.orgId;

    const { data, error } = await supabase
      .from('verified_caller_ids')
      .select('id, phone_number, country_code, verified_at, status')
      .eq('org_id', orgId)
      .order('verified_at', { ascending: false });

    if (error) {
      log.error('Error fetching verified numbers', error);
      return res.status(500).json({ error: 'Failed to fetch verified numbers' });
    }

    res.json({
      numbers: data || [],
      count: data?.length || 0
    });

  } catch (error: any) {
    log.error('Error listing verified numbers', error);
    res.status(500).json({ error: error.message || 'Failed to list numbers' });
  }
});

/**
 * DELETE /api/verified-caller-id/:id
 * Remove a verified caller ID
 */
router.delete('/:id', authenticateRequest, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = (req.user as any)?.orgId;

    const { error } = await supabase
      .from('verified_caller_ids')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId); // Security: only delete own org's numbers

    if (error) {
      log.error('Error deleting verified number', error);
      return res.status(500).json({ error: 'Failed to delete verified number' });
    }

    log.info('Verified caller ID deleted', { orgId, id });

    res.json({ success: true, message: 'Verified number removed' });

  } catch (error: any) {
    log.error('Error deleting verified number', error);
    res.status(500).json({ error: error.message || 'Deletion failed' });
  }
});

export default router;
