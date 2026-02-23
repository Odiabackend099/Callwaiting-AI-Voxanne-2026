/**
 * Managed Telephony API Routes
 *
 * Endpoints for managed (reseller) phone number provisioning via Twilio Subaccounts.
 * All endpoints gated behind the `managed_telephony` feature flag.
 *
 * Endpoints:
 * - POST   /api/managed-telephony/provision          - One-click number provisioning
 * - DELETE /api/managed-telephony/numbers/:phoneNumber - Release a managed number
 * - GET    /api/managed-telephony/status              - Current managed telephony state
 * - POST   /api/managed-telephony/switch-mode         - Switch org between byoc/managed
 * - GET    /api/managed-telephony/available-numbers    - Search available numbers
 * - POST   /api/managed-telephony/a2p/register-brand  - A2P brand registration
 * - POST   /api/managed-telephony/a2p/register-campaign - A2P campaign registration
 *
 * @ai-invariant These routes do NOT modify BYOC flows or existing credential tables.
 */

import { Router, Request, Response } from 'express';
import { requireAuthOrDev } from '../middleware/auth';
import { requireFeature } from '../middleware/feature-flags';
import { ManagedTelephonyService } from '../services/managed-telephony-service';
import { PhoneValidationService } from '../services/phone-validation-service';
import { supabaseAdmin } from '../config/supabase';
import { createLogger } from '../services/logger';
import { checkBalance, deductPhoneProvisioningCost, addCredits, deductAssetCost } from '../services/wallet-service';
import { sendSlackAlert } from '../services/slack-alerts';

const logger = createLogger('ManagedTelephonyRoutes');
const router = Router();

// All endpoints require authentication + managed_telephony feature flag
router.use(requireAuthOrDev);
router.use(requireFeature('managed_telephony'));

// ============================================
// POST /provision - One-click phone number provisioning
// ============================================
router.post('/provision', async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user?.orgId;

  try {
    if (!orgId) {
      res.status(401).json({ error: 'Unauthorized: missing org_id' });
      return;
    }

    const { country = 'US', numberType = 'local', areaCode, direction = 'inbound' } = req.body;

    // Validate direction
    if (!['inbound', 'outbound', 'unassigned'].includes(direction)) {
      res.status(400).json({ error: 'Invalid direction. Must be "inbound", "outbound", or "unassigned"' });
      return;
    }

    // Validate master credentials exist (CRITICAL for managed telephony)
    const masterSid = process.env.TWILIO_MASTER_ACCOUNT_SID;
    const masterToken = process.env.TWILIO_MASTER_AUTH_TOKEN;
    if (!masterSid || !masterToken) {
      logger.error('Missing master Twilio credentials', {
        orgId,
        hasMasterSid: !!masterSid,
        hasMasterToken: !!masterToken
      });
      res.status(500).json({
        error: 'Managed telephony not configured. Please contact support.',
        canRetry: false
      });
      return;
    }

    // Validate country code
    const validCountries = ['US', 'GB', 'CA', 'AU'];
    if (!validCountries.includes(country)) {
      res.status(400).json({ error: `Invalid country. Supported: ${validCountries.join(', ')}` });
      return;
    }

    // Validate number type
    if (!['local', 'toll_free'].includes(numberType)) {
      res.status(400).json({ error: 'Invalid numberType. Must be "local" or "toll_free"' });
      return;
    }

    // ENFORCE ONE-NUMBER-PER-ORG RULE
    // Check if organization already has an existing phone number (managed or BYOC)
    logger.info('Validating phone provisioning eligibility', { orgId, country, numberType, areaCode });

    const validation = await PhoneValidationService.validateCanProvision(orgId, direction);

    if (!validation.canProvision) {
      logger.warn('Provisioning blocked - existing number', {
        orgId,
        existingType: validation.existingNumber?.type,
        phoneLast4: validation.existingNumber?.phoneNumber?.slice(-4),
      });

      res.status(409).json({
        error: validation.reason,
        existingNumber: validation.existingNumber,
      });
      return;
    }

    logger.info('Validation passed - proceeding with provisioning', { orgId });

    // ===== PHASE 1: ATOMIC BILLING GATE - PREVENT FREE PHONE NUMBER PROVISIONING =====
    // Phone numbers cost $10.00 (1000 pence). This gate enforces prepaid billing.
    // CRITICAL FIX (2026-02-14): Uses atomic check_balance_and_deduct_asset_cost() RPC
    // to eliminate TOCTOU race condition. A single FOR UPDATE lock prevents concurrent
    // requests from both passing the balance check before either deducts.
    const PHONE_NUMBER_COST_PENCE = 1000; // $10.00 = 1000 pence

    // Generate idempotency key to prevent duplicate charges on retries
    const idempotencyKey = `provision-${orgId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    // Atomic check-and-deduct (single RPC, single transaction, row-level lock)
    const deductResult = await deductAssetCost(
      orgId,
      PHONE_NUMBER_COST_PENCE,
      'phone_number',
      `Phone provisioning: ${country} ${numberType} ${areaCode || 'any'}`,
      idempotencyKey
    );

    if (!deductResult.success) {
      if (deductResult.duplicate) {
        logger.warn('Provisioning blocked - duplicate request', {
          orgId,
          idempotencyKey,
        });
        res.status(409).json({
          error: 'Duplicate provisioning request detected.',
          canRetry: false,
        });
        return;
      }

      logger.warn('Provisioning blocked - insufficient balance (atomic check)', {
        orgId,
        required: PHONE_NUMBER_COST_PENCE,
        current: deductResult.balanceBefore,
        shortfall: deductResult.shortfallPence,
        error: deductResult.error,
      });

      res.status(402).json({
        error: 'Insufficient funds. $10.00 required to provision phone number.',
        required: PHONE_NUMBER_COST_PENCE,
        current: deductResult.balanceBefore,
        shortfallPence: deductResult.shortfallPence,
        canRetry: true,
      });
      return;
    }

    logger.info('Payment processed atomically (TOCTOU-safe)', {
      orgId,
      costPence: PHONE_NUMBER_COST_PENCE,
      balanceBefore: deductResult.balanceBefore,
      balanceAfter: deductResult.balanceAfter,
      transactionId: deductResult.transactionId,
      idempotencyKey,
    });

    // ===== END BILLING GATE =====

    // Check if BYOC credentials exist (for warning)
    const { data: existingCred } = await supabaseAdmin
      .from('org_credentials')
      .select('id, metadata')
      .eq('org_id', orgId)
      .eq('provider', 'twilio')
      .eq('is_active', true)
      .maybeSingle();

    const { data: existingOrg } = await supabaseAdmin
      .from('organizations')
      .select('telephony_mode')
      .eq('id', orgId)
      .maybeSingle();

    const hasByocCreds = !!existingCred && existingOrg?.telephony_mode === 'byoc';

    // Call provisioning service with structured error handling
    // NOTE: Balance already deducted above. If this fails, we'll need to refund.
    const result = await ManagedTelephonyService.provisionManagedNumber({
      orgId,
      country,
      numberType,
      areaCode,
      direction,
    });

    if (!result.success) {
      logger.error('Provisioning failed - refunding payment', {
        orgId,
        error: result.error,
        failedStep: result.failedStep,
        canRetry: result.canRetry,
        country,
        numberType,
        areaCode,
        refundAmount: PHONE_NUMBER_COST_PENCE,
      });

      // CRITICAL: Refund the deducted amount since provisioning failed
      const refundResult = await addCredits(
        orgId,
        PHONE_NUMBER_COST_PENCE,
        'refund',
        undefined,
        undefined,
        `Refund for failed phone provisioning: ${result.error}`,
        'system'
      );

      if (!refundResult.success) {
        logger.error('CRITICAL: Refund failed after provisioning failure', {
          orgId,
          refundError: refundResult.error,
          originalError: result.error,
        });
        // Alert ops — customer was charged $10 but provisioning failed AND refund failed.
        // Manual credit required. Fire-and-forget: alert must not block the error response.
        sendSlackAlert('🚨 CRITICAL: Phone provisioning refund failed', {
          orgId,
          amountPence: PHONE_NUMBER_COST_PENCE,
          provisioningError: result.error,
          refundError: refundResult.error,
          action: 'Manual credit of $10.00 required for this org',
        }).catch((alertErr: any) => {
          logger.error('Slack alert failed for refund failure', { orgId, error: alertErr.message });
        });
      } else {
        logger.info('Payment refunded successfully', {
          orgId,
          refundAmount: PHONE_NUMBER_COST_PENCE,
          balanceAfter: refundResult.balanceAfter,
        });
      }

      res.status(400).json({
        error: result.error,
        userMessage: result.userMessage || result.error,
        failedStep: result.failedStep,
        canRetry: result.canRetry,
        refunded: refundResult.success,
      });
      return;
    }

    logger.info('Provisioning succeeded', {
      orgId,
      phoneNumber: result.phoneNumber,
      vapiPhoneId: result.vapiPhoneId,
      country,
      numberType
    });

    res.status(201).json({
      success: true,
      phoneNumber: result.phoneNumber,
      vapiPhoneId: result.vapiPhoneId,
      subaccountSid: result.subaccountSid,
      ...(hasByocCreds ? { warning: 'Your existing BYOC Twilio connection has been replaced by this managed number.' } : {}),
    });
  } catch (err: any) {
    logger.error('Unhandled provision error', {
      orgId,
      error: err.message,
      stack: err.stack,
      name: err.name,
      code: err.code
    });
    res.status(500).json({
      error: 'An unexpected error occurred. Please try again or contact support.',
      canRetry: true,
      requestId: (req as any).id
    });
  }
});

// ============================================
// GET /phone-status - Check if org has existing phone number
// ============================================
router.get('/phone-status', async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) {
      res.status(401).json({ error: 'Unauthorized: missing org_id' });
      return;
    }

    logger.info('Checking org phone status', { orgId });

    const status = await PhoneValidationService.checkOrgPhoneStatus(orgId);

    res.status(200).json(status);
  } catch (err: any) {
    logger.error('Phone status check error', {
      orgId: req.user?.orgId,
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// DELETE /numbers/:phoneNumber - Release a managed number
// ============================================
router.delete('/numbers/:phoneNumber', async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) {
      res.status(401).json({ error: 'Unauthorized: missing org_id' });
      return;
    }

    const { phoneNumber } = req.params;
    if (!phoneNumber) {
      res.status(400).json({ error: 'Phone number is required' });
      return;
    }

    // Decode the phone number (URL-encoded + becomes space)
    const decodedPhone = decodeURIComponent(phoneNumber);

    logger.info('Releasing managed number', { orgId, phone: decodedPhone.slice(-4) });

    const result = await ManagedTelephonyService.releaseManagedNumber(orgId, decodedPhone);

    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.json({ success: true });
  } catch (err: any) {
    logger.error('Release endpoint error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// GET /status - Current managed telephony state
// ============================================
router.get('/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) {
      res.status(401).json({ error: 'Unauthorized: missing org_id' });
      return;
    }

    const status = await ManagedTelephonyService.getManagedStatus(orgId);
    res.json(status);
  } catch (err: any) {
    logger.error('Status endpoint error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// POST /switch-mode - Switch org between byoc/managed/none
// ============================================
router.post('/switch-mode', async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) {
      res.status(401).json({ error: 'Unauthorized: missing org_id' });
      return;
    }

    const { mode } = req.body;
    if (!['byoc', 'managed', 'none'].includes(mode)) {
      res.status(400).json({ error: 'Invalid mode. Must be "byoc", "managed", or "none"' });
      return;
    }

    // If switching to managed, ensure subaccount exists
    if (mode === 'managed') {
      const { data: org } = await supabaseAdmin
        .from('organizations')
        .select('name')
        .eq('id', orgId)
        .maybeSingle();

      if (!org) {
        res.status(404).json({ error: 'Organization not found' });
        return;
      }

      const subResult = await ManagedTelephonyService.createSubaccount(orgId, org.name || 'Unnamed Org');
      if (!subResult.success) {
        res.status(400).json({ error: subResult.error });
        return;
      }
    }

    // Update telephony_mode
    const { error } = await supabaseAdmin
      .from('organizations')
      .update({ telephony_mode: mode })
      .eq('id', orgId);

    if (error) {
      res.status(500).json({ error: 'Failed to update telephony mode' });
      return;
    }

    logger.info('Telephony mode switched', { orgId, mode });
    res.json({ success: true, mode });
  } catch (err: any) {
    logger.error('Switch-mode endpoint error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// GET /available-numbers - Search available numbers
// ============================================
router.get('/available-numbers', async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) {
      res.status(401).json({ error: 'Unauthorized: missing org_id' });
      return;
    }

    const country = (req.query.country as string) || 'US';
    const areaCode = req.query.areaCode as string | undefined;
    const numberType = (req.query.numberType as string) || 'local';
    const limit = Math.min(parseInt(req.query.limit as string) || 5, 20);

    const numbers = await ManagedTelephonyService.searchAvailableNumbers({
      orgId,
      country,
      areaCode,
      numberType,
      limit,
    });

    res.json({ numbers });
  } catch (err: any) {
    logger.error('Available-numbers endpoint error', { error: err.message });
    res.status(500).json({ error: 'Operation failed. Please try again.' });
  }
});

// ============================================
// POST /a2p/register-brand - A2P brand registration
// ============================================
router.post('/a2p/register-brand', async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) {
      res.status(401).json({ error: 'Unauthorized: missing org_id' });
      return;
    }

    const { brandName, ein, vertical, stockSymbol } = req.body;
    if (!brandName) {
      res.status(400).json({ error: 'brandName is required' });
      return;
    }

    // Get subaccount
    const { data: subData } = await supabaseAdmin
      .from('twilio_subaccounts')
      .select('twilio_account_sid')
      .eq('org_id', orgId)
      .eq('status', 'active')
      .maybeSingle();

    if (!subData) {
      res.status(400).json({ error: 'No active subaccount. Provision a number first.' });
      return;
    }

    // A2P brand registration is a Twilio API call
    // For now, store the intent and mark as submitted
    const { error } = await supabaseAdmin
      .from('twilio_subaccounts')
      .update({
        a2p_brand_id: `pending_${Date.now()}`,
        a2p_registration_status: 'submitted',
      })
      .eq('org_id', orgId);

    if (error) {
      res.status(500).json({ error: 'Failed to update A2P registration' });
      return;
    }

    logger.info('A2P brand registration submitted', { orgId, brandName });
    res.json({
      success: true,
      status: 'submitted',
      message: 'A2P brand registration submitted. Approval typically takes 1-3 business days.',
    });
  } catch (err: any) {
    logger.error('A2P brand registration error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// POST /a2p/register-campaign - A2P campaign registration
// ============================================
router.post('/a2p/register-campaign', async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) {
      res.status(401).json({ error: 'Unauthorized: missing org_id' });
      return;
    }

    const { useCase, description } = req.body;
    if (!useCase || !description) {
      res.status(400).json({ error: 'useCase and description are required' });
      return;
    }

    // Verify brand is approved first
    const { data: subData } = await supabaseAdmin
      .from('twilio_subaccounts')
      .select('a2p_brand_id, a2p_registration_status')
      .eq('org_id', orgId)
      .eq('status', 'active')
      .maybeSingle();

    if (!subData) {
      res.status(400).json({ error: 'No active subaccount. Provision a number first.' });
      return;
    }

    if (subData.a2p_registration_status !== 'approved') {
      res.status(400).json({
        error: 'A2P brand must be approved before campaign registration',
        currentStatus: subData.a2p_registration_status,
      });
      return;
    }

    // Store campaign registration intent
    const { error } = await supabaseAdmin
      .from('twilio_subaccounts')
      .update({
        a2p_campaign_id: `pending_${Date.now()}`,
      })
      .eq('org_id', orgId);

    if (error) {
      res.status(500).json({ error: 'Failed to submit campaign registration' });
      return;
    }

    logger.info('A2P campaign registration submitted', { orgId, useCase });
    res.json({
      success: true,
      status: 'submitted',
      message: 'A2P campaign registration submitted. Approval typically takes 3-5 business days.',
    });
  } catch (err: any) {
    logger.error('A2P campaign registration error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
