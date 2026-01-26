/**
 * Hybrid Telephony API Routes
 *
 * Handles Twilio Caller ID verification and GSM forwarding code generation
 * for the Hybrid Telephony BYOC feature.
 *
 * Endpoints:
 * - POST /api/telephony/verify-caller-id/initiate - Start verification call
 * - POST /api/telephony/verify-caller-id/confirm - Confirm 6-digit code
 * - GET /api/telephony/verified-numbers - List verified numbers
 * - DELETE /api/telephony/verified-numbers/:id - Remove verified number
 * - POST /api/telephony/forwarding-config - Create/update forwarding config
 * - GET /api/telephony/forwarding-config - Get current config
 * - GET /api/telephony/forwarding-code - Generate GSM code
 * - POST /api/telephony/forwarding-config/confirm - User confirms setup
 */

import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase-client';
import { requireAuthOrDev } from '../middleware/auth';
import { TelephonyService } from '../services/telephony-service';
import { generateForwardingCodes, CarrierCodeConfig } from '../services/gsm-code-generator';
import { IntegrationDecryptor } from '../services/integration-decryptor';
import twilio from 'twilio';
import type { TwilioClient, RateLimitEntry, AuthenticatedRequest } from '../types/telephony-types';
import { createLogger } from '../services/logger';

const logger = createLogger('TelephonyRoutes');

const router = Router();

// ============================================
// RATE LIMITING
// ============================================

/**
 * In-memory rate limit cache for verification attempts
 * Key: "orgId:phoneNumber"
 * Value: { count, resetAt }
 *
 * Limits: 3 attempts per phone number per hour
 *
 * Note: For production scale, consider Redis
 */
const verificationAttempts = new Map<string, RateLimitEntry>();

// Cleanup expired entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of verificationAttempts.entries()) {
    if (value.resetAt < now) {
      verificationAttempts.delete(key);
    }
  }
}, 10 * 60 * 1000);

// ============================================
// VALIDATION HELPERS
// ============================================

function validateE164PhoneNumber(phoneNumber: string): boolean {
  const e164Regex = /^\+[1-9]\d{6,14}$/;
  return e164Regex.test(phoneNumber);
}

function maskPhoneNumber(phone: string): string {
  if (phone.length < 6) return '***';
  return phone.slice(0, 3) + '****' + phone.slice(-4);
}

/**
 * Check if Twilio has verified the caller ID with retry logic
 * Handles race condition where Twilio may not have processed verification yet
 *
 * @param twilioClient - Initialized Twilio client
 * @param phoneNumber - Phone number to check (E.164 format)
 * @param maxRetries - Maximum retry attempts (default: 3)
 * @returns Twilio caller ID SID if verified, null otherwise
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
      // Continue to retry on API errors
    }
  }

  return null;
}

// ============================================
// CALLER ID VERIFICATION ENDPOINTS
// ============================================

/**
 * POST /api/telephony/verify-caller-id/initiate
 * Start the verification process by calling Twilio's validationRequests API
 */
router.post('/verify-caller-id/initiate', requireAuthOrDev, async (req: Request, res: Response): Promise<void> => {
  const requestId = (req as any).requestId || `req_${Date.now()}`;

  try {
    const userId = req.user?.id;
    const orgId = req.user?.orgId;

    if (!userId || !orgId) {
      res.status(401).json({ error: 'Not authenticated', requestId });
      return;
    }

    const { phoneNumber, friendlyName } = req.body;

    // Validation
    if (!phoneNumber) {
      res.status(400).json({ error: 'Phone number is required', requestId });
      return;
    }

    if (!validateE164PhoneNumber(phoneNumber)) {
      res.status(400).json({
        error: 'Invalid phone number format. Must be E.164 format (e.g., +15551234567)',
        requestId
      });
      return;
    }

    // Rate limiting: 3 attempts per phone number per hour
    const rateLimitKey = `${orgId}:${phoneNumber}`;
    const now = Date.now();
    const attempt = verificationAttempts.get(rateLimitKey);

    if (attempt && attempt.resetAt > now) {
      if (attempt.count >= 3) {
        const retryAfterSeconds = Math.ceil((attempt.resetAt - now) / 1000);
        res.status(429).json({
          error: 'Too many verification attempts. Please try again later.',
          retryAfter: retryAfterSeconds,
          requestId
        });
        return;
      }
      attempt.count++;
    } else {
      verificationAttempts.set(rateLimitKey, {
        count: 1,
        resetAt: now + 60 * 60 * 1000 // 1 hour
      });
    }

    // Delegate to service layer
    const result = await TelephonyService.initiateVerification({
      orgId,
      phoneNumber,
      friendlyName
    });

    res.status(200).json({ ...result, requestId });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const statusCode = errorMessage.includes('already verified') ? 400 :
                       errorMessage.includes('not configured') ? 400 :
                       500;
    res.status(statusCode).json({ error: errorMessage, requestId });
  }
});

/**
 * POST /api/telephony/verify-caller-id/confirm
 * Confirm the verification by checking if Twilio has verified the number
 */
router.post('/verify-caller-id/confirm', requireAuthOrDev, async (req: Request, res: Response): Promise<void> => {
  const requestId = (req as any).requestId || `req_${Date.now()}`;

  try {
    const userId = req.user?.id;
    const orgId = req.user?.orgId;

    if (!userId || !orgId) {
      res.status(401).json({ error: 'Not authenticated', requestId });
      return;
    }

    const { verificationId, phoneNumber } = req.body;

    if (!verificationId && !phoneNumber) {
      res.status(400).json({ error: 'verificationId or phoneNumber is required', requestId });
      return;
    }

    // Delegate to service layer
    const result = await TelephonyService.confirmVerification({
      orgId,
      verificationId,
      phoneNumber
    });

    res.status(200).json({ ...result, requestId });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const statusCode = errorMessage.includes('not found') ? 404 :
                       errorMessage.includes('expired') ? 400 :
                       errorMessage.includes('Maximum') ? 400 :
                       errorMessage.includes('not yet complete') ? 400 :
                       500;

    const response: { error: string; requestId: string; attemptsRemaining?: number } = {
      error: errorMessage,
      requestId
    };

    if (error && typeof error === 'object' && 'attemptsRemaining' in error) {
      response.attemptsRemaining = (error as { attemptsRemaining: number }).attemptsRemaining;
    }

    res.status(statusCode).json(response);
  }
});

/**
 * GET /api/telephony/verified-numbers
 * List all verified caller IDs for the org
 */
router.get('/verified-numbers', requireAuthOrDev, async (req: Request, res: Response): Promise<void> => {
  const requestId = (req as any).requestId || `req_${Date.now()}`;

  try {
    const orgId = req.user?.orgId;

    if (!orgId) {
      res.status(401).json({ error: 'Not authenticated', requestId });
      return;
    }

    // Use Supabase foreign key query to fetch numbers with their configs in one query
    const { data: numbers, error } = await supabase
      .from('verified_caller_ids')
      .select(`
        id,
        phone_number,
        friendly_name,
        status,
        verified_at,
        created_at,
        hybrid_forwarding_configs!verified_caller_id(
          status
        )
      `)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Failed to fetch verified numbers', { requestId, error });
      res.status(500).json({ error: 'Failed to fetch verified numbers', requestId });
      return;
    }

    // Map the nested config data to flat structure
    const numbersWithConfig = (numbers || []).map((n: any) => ({
      id: n.id,
      phone_number: n.phone_number,
      friendly_name: n.friendly_name,
      status: n.status,
      verified_at: n.verified_at,
      created_at: n.created_at,
      hasForwardingConfig: n.hybrid_forwarding_configs && n.hybrid_forwarding_configs.length > 0,
      forwardingStatus: n.hybrid_forwarding_configs?.[0]?.status || null
    }));

    res.status(200).json({
      success: true,
      numbers: numbersWithConfig,
      requestId
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Unexpected error in list', { requestId, error: errorMessage });
    res.status(500).json({ error: 'Internal server error', requestId });
  }
});

/**
 * DELETE /api/telephony/verified-numbers/:id
 * Remove a verified caller ID
 */
router.delete('/verified-numbers/:id', requireAuthOrDev, async (req: Request, res: Response): Promise<void> => {
  const requestId = (req as any).requestId || `req_${Date.now()}`;

  try {
    const orgId = req.user?.orgId;
    const { id } = req.params;

    if (!orgId) {
      res.status(401).json({ error: 'Not authenticated', requestId });
      return;
    }

    // Delegate to service layer
    await TelephonyService.deleteVerifiedNumber(orgId, id);

    res.status(200).json({
      success: true,
      message: 'Verified number removed successfully',
      requestId
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const statusCode = errorMessage.includes('not found') ? 404 : 500;
    res.status(statusCode).json({ error: errorMessage, requestId });
  }
});

// ============================================
// FORWARDING CONFIGURATION ENDPOINTS
// ============================================

/**
 * POST /api/telephony/forwarding-config
 * Create or update forwarding configuration
 */
router.post('/forwarding-config', requireAuthOrDev, async (req: Request, res: Response): Promise<void> => {
  const requestId = (req as any).requestId || `req_${Date.now()}`;

  try {
    const orgId = req.user?.orgId;

    if (!orgId) {
      res.status(401).json({ error: 'Not authenticated', requestId });
      return;
    }

    const { verifiedCallerId, forwardingType, carrier, ringTimeSeconds } = req.body;

    // Validation
    if (!verifiedCallerId) {
      res.status(400).json({ error: 'verifiedCallerId is required', requestId });
      return;
    }

    if (!forwardingType || !['total_ai', 'safety_net'].includes(forwardingType)) {
      res.status(400).json({ error: 'forwardingType must be "total_ai" or "safety_net"', requestId });
      return;
    }

    if (!carrier || !['att', 'tmobile', 'verizon', 'sprint', 'other_gsm', 'other_cdma', 'international'].includes(carrier)) {
      res.status(400).json({ error: 'Invalid carrier', requestId });
      return;
    }

    // Delegate to service layer
    const result = await TelephonyService.createForwardingConfig({
      orgId,
      verifiedCallerId,
      forwardingType,
      carrier,
      ringTimeSeconds
    });

    res.status(200).json({ ...result, requestId });
  } catch (error: any) {
    const statusCode = error.message.includes('not found') ? 404 :
                       error.message.includes('not yet verified') ? 400 :
                       error.message.includes('not configured') ? 400 :
                       500;
    res.status(statusCode).json({ error: error.message, requestId });
  }
});

/**
 * GET /api/telephony/forwarding-config
 * Get current forwarding configuration
 */
router.get('/forwarding-config', requireAuthOrDev, async (req: Request, res: Response): Promise<void> => {
  const requestId = (req as any).requestId || `req_${Date.now()}`;

  try {
    const orgId = req.user?.orgId;

    if (!orgId) {
      res.status(401).json({ error: 'Not authenticated', requestId });
      return;
    }

    const { data: configs, error } = await supabase
      .from('hybrid_forwarding_configs')
      .select(`
        id,
        sim_phone_number,
        forwarding_type,
        carrier,
        twilio_forwarding_number,
        ring_time_seconds,
        generated_activation_code,
        generated_deactivation_code,
        status,
        user_confirmed_setup,
        confirmed_at,
        created_at,
        verified_caller_id
      `)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Failed to fetch forwarding configs', { requestId, error });
      res.status(500).json({ error: 'Failed to fetch configurations', requestId });
      return;
    }

    res.status(200).json({
      success: true,
      configs: configs || [],
      requestId
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Unexpected error in get forwarding-config', { requestId, error: errorMessage });
    res.status(500).json({ error: 'Internal server error', requestId });
  }
});

/**
 * GET /api/telephony/forwarding-code
 * Generate GSM code for a specific config
 */
router.get('/forwarding-code', requireAuthOrDev, async (req: Request, res: Response): Promise<void> => {
  const requestId = (req as any).requestId || `req_${Date.now()}`;

  try {
    const orgId = req.user?.orgId;
    const configId = req.query.configId as string;

    if (!orgId) {
      res.status(401).json({ error: 'Not authenticated', requestId });
      return;
    }

    if (!configId) {
      res.status(400).json({ error: 'configId query parameter is required', requestId });
      return;
    }

    const { data: config, error } = await supabase
      .from('hybrid_forwarding_configs')
      .select('*')
      .eq('id', configId)
      .eq('org_id', orgId)
      .maybeSingle();

    if (error || !config) {
      res.status(404).json({ error: 'Forwarding config not found', requestId });
      return;
    }

    // Regenerate codes (in case destination number changed)
    const codeConfig: CarrierCodeConfig = {
      carrier: config.carrier as any,
      forwardingType: config.forwarding_type,
      destinationNumber: config.twilio_forwarding_number,
      ringTimeSeconds: config.forwarding_type === 'safety_net' ? config.ring_time_seconds : undefined
    };

    const codes = generateForwardingCodes(codeConfig);

    // Generate user-friendly instructions
    const instructions = generateInstructions(config.carrier, config.forwarding_type);

    res.status(200).json({
      success: true,
      codes: {
        activation: codes.activation,
        deactivation: codes.deactivation,
        instructions
      },
      carrier: config.carrier,
      forwardingType: config.forwarding_type,
      simPhoneNumber: config.sim_phone_number,
      twilioNumber: config.twilio_forwarding_number,
      requestId
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Unexpected error in forwarding-code', { requestId, error: errorMessage });
    res.status(500).json({ error: 'Internal server error', requestId });
  }
});

/**
 * POST /api/telephony/forwarding-config/confirm
 * User confirms they successfully dialed the GSM code
 */
router.post('/forwarding-config/confirm', requireAuthOrDev, async (req: Request, res: Response): Promise<void> => {
  const requestId = (req as any).requestId || `req_${Date.now()}`;

  try {
    const orgId = req.user?.orgId;
    const { configId } = req.body;

    if (!orgId) {
      res.status(401).json({ error: 'Not authenticated', requestId });
      return;
    }

    if (!configId) {
      res.status(400).json({ error: 'configId is required', requestId });
      return;
    }

    // Delegate to service layer
    await TelephonyService.confirmSetup(orgId, configId);

    res.status(200).json({
      success: true,
      message: 'Forwarding configuration activated successfully',
      requestId
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const statusCode = errorMessage.includes('not found') ? 404 : 500;
    res.status(statusCode).json({ error: errorMessage, requestId });
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function generateInstructions(carrier: string, forwardingType: string): string[] {
  const baseInstructions = [
    'Open your phone\'s dialer app (Phone app)',
    'Enter the activation code exactly as shown',
    'Press the call button to execute the code',
    'Wait for a confirmation tone or message'
  ];

  const carrierNotes: Record<string, string[]> = {
    verizon: [
      ...baseInstructions,
      'Note: Verizon uses *71 for conditional forwarding (no ring time adjustment available)',
      'To deactivate, dial *73'
    ],
    att: [
      ...baseInstructions,
      'AT&T may show "Call Forwarding Activated" message',
      'If *004* fails, try separate codes: *90 (busy) and *92 (no answer)'
    ],
    tmobile: [
      ...baseInstructions,
      'T-Mobile fully supports GSM forwarding codes',
      'You should hear a confirmation beep'
    ],
    default: baseInstructions
  };

  return carrierNotes[carrier] || carrierNotes.default;
}

export default router;
