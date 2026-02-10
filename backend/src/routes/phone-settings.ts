/**
 * Phone Settings API Routes
 *
 * Combined endpoint for the unified Phone Settings dashboard page.
 * Returns both inbound (managed number) and outbound (verified caller ID) status in a single call.
 *
 * Endpoints:
 * - GET /api/phone-settings/status - Get combined inbound + outbound phone status
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { ManagedTelephonyService } from '../services/managed-telephony-service';
import { supabaseAdmin } from '../config/supabase';
import { createLogger } from '../services/logger';

const logger = createLogger('PhoneSettingsRoutes');
const router = Router();

// All endpoints require authentication
router.use(requireAuth);

/**
 * GET /api/phone-settings/status
 *
 * Returns combined status for the unified Phone Settings page:
 * - Inbound lane: Managed phone number (if provisioned)
 * - Outbound lane: Verified caller ID (if verified)
 * - Current telephony mode: managed | byoc | none
 *
 * This replaces the need for 2 separate API calls from the frontend.
 */
router.get('/status', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user?.orgId;

  try {
    if (!orgId) {
      res.status(401).json({ error: 'Unauthorized: missing org_id' });
      return;
    }

    // Get managed telephony status (Lane 1: Inbound)
    const managedStatus = await ManagedTelephonyService.getManagedStatus(orgId);

    // Extract managed number data
    const hasManagedNumber = managedStatus.numbers.length > 0;
    const managedNumber = hasManagedNumber ? managedStatus.numbers[0] : null;

    // Get verified caller ID status (Lane 2: Outbound)
    const { data: verifiedNumbers, error: verifiedError } = await supabaseAdmin
      .from('verified_caller_ids')
      .select('id, phone_number, status, verified_at')
      .eq('org_id', orgId)
      .eq('status', 'verified')
      .order('verified_at', { ascending: false })
      .limit(1);

    if (verifiedError) {
      logger.error('Failed to fetch verified caller IDs', { orgId, error: verifiedError });
    }

    const hasVerifiedNumber = verifiedNumbers && verifiedNumbers.length > 0;
    const verifiedNumber = hasVerifiedNumber ? verifiedNumbers[0] : null;

    // Return combined response
    res.json({
      inbound: {
        hasManagedNumber,
        managedNumber: managedNumber?.phoneNumber || null,
        managedNumberStatus: managedNumber?.status || null,
        vapiPhoneId: managedNumber?.vapiPhoneId || null,
        countryCode: managedNumber?.countryCode || null,
      },
      outbound: {
        hasVerifiedNumber,
        verifiedNumber: verifiedNumber?.phone_number || null,
        verifiedAt: verifiedNumber?.verified_at || null,
        verifiedId: verifiedNumber?.id || null,
      },
      mode: managedStatus.mode,
    });

  } catch (error: any) {
    logger.error('Error fetching phone settings status', {
      orgId,
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      error: 'Failed to fetch phone settings status',
      message: error.message,
    });
  }
});

export default router;
