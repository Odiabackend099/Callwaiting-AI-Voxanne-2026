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

    // Get managed telephony status (now direction-aware)
    const managedStatus = await ManagedTelephonyService.getManagedStatus(orgId);

    // Split numbers by routing direction
    const inboundNumbers = managedStatus.numbers.filter(n => n.routingDirection === 'inbound');
    const outboundNumbers = managedStatus.numbers.filter(n => n.routingDirection === 'outbound');

    // Backward-compatible: first inbound number (existing behavior)
    const hasManagedNumber = inboundNumbers.length > 0;
    const managedNumber = hasManagedNumber ? inboundNumbers[0] : null;

    // Outbound managed number (new)
    const hasOutboundManagedNumber = outboundNumbers.length > 0;
    const outboundManagedNumber = hasOutboundManagedNumber ? outboundNumbers[0] : null;

    // Get verified caller ID status (Lane 2: Outbound)
    const { data: verifiedNumbers, error: verifiedError } = await supabaseAdmin
      .from('verified_caller_ids')
      .select('id, phone_number, status, verified_at, vapi_phone_number_id')
      .eq('org_id', orgId)
      .eq('status', 'verified')
      .order('verified_at', { ascending: false })
      .limit(1);

    if (verifiedError) {
      logger.error('Failed to fetch verified caller IDs', { orgId, error: verifiedError });
    }

    const hasVerifiedNumber = verifiedNumbers && verifiedNumbers.length > 0;
    const verifiedNumber = hasVerifiedNumber ? verifiedNumbers[0] : null;

    // Check for pending verification (recovery for navigate-away scenario)
    // Only returned when there's no verified number — allows frontend to auto-recover
    let pendingVerification: { phoneNumber: string; createdAt: string; id: string } | null = null;
    if (!hasVerifiedNumber) {
      try {
        const { data: pendingRecords } = await supabaseAdmin
          .from('verified_caller_ids')
          .select('id, phone_number, created_at')
          .eq('org_id', orgId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1);

        if (pendingRecords && pendingRecords.length > 0) {
          const pending = pendingRecords[0];
          const ageMs = Date.now() - new Date(pending.created_at).getTime();
          const MAX_PENDING_AGE_MS = 30 * 60 * 1000; // 30 minutes

          if (ageMs < MAX_PENDING_AGE_MS) {
            pendingVerification = {
              phoneNumber: pending.phone_number,
              createdAt: pending.created_at,
              id: pending.id,
            };
          } else {
            // Auto-cleanup stale pending records (older than 30 min)
            await supabaseAdmin
              .from('verified_caller_ids')
              .delete()
              .eq('id', pending.id)
              .eq('org_id', orgId);
            logger.info('Auto-cleaned stale pending verification', { orgId, id: pending.id });
          }
        }
      } catch {
        // Best-effort — pending check is non-critical
      }
    }

    // Get forwarding configuration (if any)
    let forwardingConfig = null;
    try {
      const { data: fwdConfig } = await supabaseAdmin
        .from('hybrid_forwarding_configs')
        .select('forwarding_type, carrier, status, ring_time_seconds, generated_activation_code, generated_deactivation_code')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fwdConfig) {
        forwardingConfig = {
          forwardingType: fwdConfig.forwarding_type,
          carrier: fwdConfig.carrier,
          status: fwdConfig.status,
          ringTimeSeconds: fwdConfig.ring_time_seconds,
          activationCode: fwdConfig.generated_activation_code,
          deactivationCode: fwdConfig.generated_deactivation_code,
        };
      }
    } catch {
      // Best-effort — forwarding config is non-critical
    }

    // Return combined response (backward-compatible + new direction-aware fields)
    res.json({
      inbound: {
        hasManagedNumber,
        managedNumber: managedNumber?.phoneNumber || null,
        managedNumberStatus: managedNumber?.status || null,
        vapiPhoneId: managedNumber?.vapiPhoneId || null,
        countryCode: managedNumber?.countryCode || null,
        forwardingConfig,
      },
      outbound: {
        hasVerifiedNumber,
        verifiedNumber: verifiedNumber?.phone_number || null,
        verifiedAt: verifiedNumber?.verified_at || null,
        verifiedId: verifiedNumber?.id || null,
        vapiLinked: !!verifiedNumber?.vapi_phone_number_id,
        pendingVerification,
        // New: outbound managed number (separate from verified caller ID)
        hasManagedOutboundNumber: hasOutboundManagedNumber,
        managedOutboundNumber: outboundManagedNumber?.phoneNumber || null,
        managedOutboundVapiPhoneId: outboundManagedNumber?.vapiPhoneId || null,
      },
      mode: managedStatus.mode,
      // New: all numbers grouped by direction (for multi-number UI)
      numbers: {
        inbound: inboundNumbers,
        outbound: outboundNumbers,
        all: managedStatus.numbers,
      },
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
