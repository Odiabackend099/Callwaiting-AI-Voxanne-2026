/**
 * Onboarding Wizard API Routes
 *
 * Endpoints for the multi-step onboarding wizard:
 * - POST /api/onboarding/event    — Record telemetry event (fire-and-forget)
 * - GET  /api/onboarding/status   — Check if user needs onboarding
 * - POST /api/onboarding/complete — Mark onboarding as complete
 * - POST /api/onboarding/provision-number — Provision phone number during celebration
 */

import { Router, Request, Response } from 'express';
import { requireAuth, requireAuthOrDev } from '../middleware/auth';
import { supabase } from '../services/supabase-client';
import { createLogger } from '../services/logger';
import { ManagedTelephonyService } from '../services/managed-telephony-service';
import { PhoneValidationService } from '../services/phone-validation-service';
import { deductAssetCost, addCredits } from '../services/wallet-service';

const logger = createLogger('OnboardingRoutes');
const router = Router();

// Dynamic auth middleware that checks NODE_ENV at request time (not module load time)
// This allows tests to set NODE_ENV before making requests
router.use(async (req, res, next) => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  if (isDevelopment) {
    await requireAuthOrDev(req, res, next);
  } else {
    await requireAuth(req, res, next);
  }
});

// Valid onboarding event names
const VALID_EVENTS = [
  'started',
  'clinic_named',
  'specialty_chosen',
  'payment_viewed',
  'payment_success',
  'test_call_completed',
] as const;

type OnboardingEventName = typeof VALID_EVENTS[number];

// ============================================
// POST /event — Record telemetry event
// ============================================
router.post('/event', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user?.orgId;
  const userId = req.user?.id;

  if (!orgId || !userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const { event_name, step_index, metadata, session_id } = req.body;

    // Validate event name
    if (!event_name || !VALID_EVENTS.includes(event_name as OnboardingEventName)) {
      res.status(400).json({
        error: 'Invalid event_name',
        valid: VALID_EVENTS,
      });
      return;
    }

    // Validate step index (5 steps total, 0-indexed → valid range 0–4)
    if (typeof step_index !== 'number' || step_index < 0 || step_index > 4) {
      res.status(400).json({ error: 'Invalid step_index (must be 0-4)' });
      return;
    }

    const { error } = await supabase.from('onboarding_events').insert({
      org_id: orgId,
      user_id: userId,
      event_name,
      step_index,
      metadata: metadata || {},
      session_id: session_id || null,
    });

    if (error) {
      logger.error('Failed to insert onboarding event', {
        orgId,
        event_name,
        error: error.message,
      });
      // Still return success — telemetry should never block the user
      res.json({ success: true });
      return;
    }

    logger.info('Onboarding event recorded', { orgId, event_name, step_index });
    res.json({ success: true });
  } catch (err: any) {
    logger.error('Onboarding event error', { orgId, error: err.message });
    // Fire-and-forget — always return success
    res.json({ success: true });
  }
});

// ============================================
// GET /status — Check if user needs onboarding
// ============================================
router.get('/status', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user?.orgId;

  if (!orgId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('onboarding_completed_at')
      .eq('id', orgId)
      .maybeSingle();

    if (error) {
      logger.error('Failed to check onboarding status', {
        orgId,
        error: error.message,
      });
      // Default to not needing onboarding on error (don't block existing users)
      res.json({ needs_onboarding: false, completed_at: null });
      return;
    }

    const completedAt = data?.onboarding_completed_at;
    res.json({
      needs_onboarding: !completedAt,
      completed_at: completedAt || null,
    });
  } catch (err: any) {
    logger.error('Onboarding status error', { orgId, error: err.message });
    res.json({ needs_onboarding: false, completed_at: null });
  }
});

// ============================================
// POST /complete — Mark onboarding as complete
// ============================================
router.post('/complete', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user?.orgId;

  if (!orgId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const { clinic_name, specialty } = req.body;

    const updatePayload: Record<string, any> = {
      onboarding_completed_at: new Date().toISOString(),
    };

    if (clinic_name && typeof clinic_name === 'string') {
      updatePayload.clinic_name = clinic_name.trim().slice(0, 200);
    }
    if (specialty && typeof specialty === 'string') {
      updatePayload.specialty = specialty.trim().slice(0, 100);
    }

    const { error } = await supabase
      .from('organizations')
      .update(updatePayload)
      .eq('id', orgId);

    if (error) {
      logger.error('Failed to complete onboarding', {
        orgId,
        error: error.message,
      });
      res.status(500).json({ error: 'Failed to complete onboarding' });
      return;
    }

    logger.info('Onboarding completed', { orgId, clinic_name, specialty });
    res.json({ success: true });
  } catch (err: any) {
    logger.error('Onboarding complete error', { orgId, error: err.message });
    res.status(500).json({ error: 'Failed to complete onboarding' });
  }
});

// ============================================
// POST /provision-number — Auto-provision phone number
// ============================================
router.post('/provision-number', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user?.orgId;

  if (!orgId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // Declare OUTSIDE try so the catch block can read it for the refund guard
  let walletDebited = false;
  const PHONE_NUMBER_COST_PENCE = 1000; // £10.00

  try {
    const { area_code } = req.body;
    const direction: 'inbound' = 'inbound';

    // Validate master Twilio credentials (fast fail before touching billing)
    if (!process.env.TWILIO_MASTER_ACCOUNT_SID || !process.env.TWILIO_MASTER_AUTH_TOKEN) {
      logger.error('Missing master Twilio credentials for onboarding provisioning', { orgId });
      res.status(500).json({ error: 'Phone provisioning not available. Please contact support.' });
      return;
    }

    // Check if org already has a number
    const validation = await PhoneValidationService.validateCanProvision(orgId, direction);
    if (!validation.canProvision) {
      // If they already have a number, return it instead of erroring
      if (validation.existingNumber?.phoneNumber) {
        res.json({
          success: true,
          phoneNumber: validation.existingNumber.phoneNumber,
          alreadyProvisioned: true,
        });
        return;
      }
      res.status(409).json({ error: validation.reason });
      return;
    }

    // Atomic billing: deduct phone cost before provisioning
    const idempotencyKey = `onboarding-provision-${orgId}-${Date.now()}`;

    const deductResult = await deductAssetCost(
      orgId,
      PHONE_NUMBER_COST_PENCE,
      'phone_number',
      `Onboarding: Inbound AI phone number`,
      idempotencyKey
    );

    if (!deductResult.success) {
      logger.warn('Insufficient balance for phone provisioning', {
        orgId,
        error: deductResult.error,
      });
      res.status(402).json({
        error: 'Insufficient balance for phone number. Please top up your wallet.',
      });
      return;
    }

    // Wallet is now debited — any subsequent throw must be caught and refunded
    walletDebited = true;

    // Provision the number via the static managed-telephony service
    const result = await ManagedTelephonyService.provisionManagedNumber({
      orgId,
      country: 'US',
      numberType: 'local',
      areaCode: area_code || undefined,
      direction,
    });

    if (!result.success) {
      logger.error('Phone provisioning failed during onboarding', {
        orgId,
        error: result.error,
      });
      // Refund the deducted cost — wallet must not be left in a debited state
      await addCredits(
        orgId,
        PHONE_NUMBER_COST_PENCE,
        'refund',
        undefined,
        undefined,
        'Refund: phone provisioning failed during onboarding',
        'system:onboarding'
      );
      res.status(500).json({ error: 'Failed to provision phone number. Please try again.' });
      return;
    }

    logger.info('Phone provisioned during onboarding', {
      orgId,
      phoneNumber: result.phoneNumber,
      areaCode: area_code,
    });

    res.json({
      success: true,
      phoneNumber: result.phoneNumber,
    });
  } catch (err: any) {
    logger.error('Onboarding provision error', { orgId, error: err.message });

    // If the wallet was already debited before the throw (e.g. Twilio network timeout),
    // issue a refund so the user is not charged for a number they didn't receive.
    if (walletDebited) {
      try {
        await addCredits(
          orgId,
          1000, // PHONE_NUMBER_COST_PENCE — can't reference const from outer scope after throw
          'refund',
          undefined,
          undefined,
          'Refund: phone provisioning threw during onboarding',
          'system:onboarding'
        );
        logger.info('Wallet refunded after provision throw', { orgId });
      } catch (refundErr: any) {
        logger.error('CRITICAL: Failed to refund wallet after provision throw', {
          orgId,
          refundError: refundErr.message,
        });
      }
    }

    res.status(500).json({ error: 'Failed to provision phone number. Please try again.' });
  }
});

export default router;
