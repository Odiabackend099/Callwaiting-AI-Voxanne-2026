/**
 * Call Type Detector Service
 * Determines if a call is inbound or outbound based on Twilio phone numbers
 * Inbound: call received on inbound Twilio number
 * Outbound: call initiated from our inbound Twilio number (single-number policy)
 */

import { supabase } from './supabase-client';
import { createLogger } from './logger';
import { getCachedInboundConfig } from './cache';

const logger = createLogger('CallTypeDetector');

/**
 * Normalizes phone numbers for comparison
 * Handles various formats: +1234567890, (123) 456-7890, 123-456-7890, etc.
 * @param phone - Phone number in any format
 * @returns Normalized phone number (digits only, with + prefix if present)
 */
function normalizePhoneForComparison(phone?: string): string {
  if (!phone) return '';
  
  // Preserve + prefix if present
  const hasPlus = phone.startsWith('+');
  const digitsOnly = phone.replace(/\D/g, '');
  
  return hasPlus ? '+' + digitsOnly : digitsOnly;
}

interface CallTypeDetectionResult {
  callType: 'inbound' | 'outbound';
  twilioNumber: string;
  configId: string;
  reason: string;
}

/**
 * Detect if a call is inbound or outbound based on Twilio phone numbers
 * @param orgId - Organization ID
 * @param toNumber - The "to" number from the call (who received it)
 * @param fromNumber - The "from" number from the call (who initiated it)
 * @returns Call type detection result
 */
export async function detectCallType(
  orgId: string,
  toNumber?: string,
  fromNumber?: string
): Promise<CallTypeDetectionResult | null> {
  try {
    // Single-number policy: the inbound config is the source of truth for the Twilio number.
    // If a call is TO our number -> inbound. Otherwise treat it as outbound.
    // Use cached config to avoid DB query on every call (cached for 5 minutes)
    const inboundConfig = await getCachedInboundConfig(orgId);

    if (!inboundConfig) {
      logger.warn('Unable to detect call type: inbound config missing', {
        orgId
      });
      return null;
    }

    // Normalize phone numbers for comparison
    const toNumberNormalized = normalizePhoneForComparison(toNumber);
    const fromNumberNormalized = normalizePhoneForComparison(fromNumber);
    const inboundPhoneNormalized = normalizePhoneForComparison((inboundConfig as any)?.twilio_phone_number);

    logger.debug('Comparing phone numbers', {
      orgId,
      toNumber: toNumberNormalized,
      fromNumber: fromNumberNormalized,
      inboundPhone: inboundPhoneNormalized
    });

    // Logic: If toNumber matches inbound config, it's an inbound call
    if (inboundConfig && toNumberNormalized === inboundPhoneNormalized) {
      logger.info('Detected INBOUND call', {
        orgId,
        toNumber: toNumberNormalized,
        configId: (inboundConfig as any).id
      });

      return {
        callType: 'inbound',
        twilioNumber: (inboundConfig as any).twilio_phone_number,
        configId: (inboundConfig as any).id,
        reason: 'toNumber matches inbound Twilio number'
      };
    }

    logger.info('Detected OUTBOUND call (single-number policy)', {
      orgId,
      toNumber: toNumberNormalized,
      fromNumber: fromNumberNormalized,
      inboundPhone: inboundPhoneNormalized
    });

    return {
      callType: 'outbound',
      twilioNumber: (inboundConfig as any).twilio_phone_number,
      configId: 'outbound',
      reason: 'toNumber does not match inbound Twilio number'
    };
  } catch (error: any) {
    logger.error('Error detecting call type', {
      orgId,
      error: error.message
    });
    return null;
  }
}

/**
 * Get agent config for a specific call type
 * @param orgId - Organization ID
 * @param callType - 'inbound' or 'outbound'
 * @returns Agent config or null
 */
export async function getAgentConfigForCallType(
  orgId: string,
  callType: 'inbound' | 'outbound'
) {
  try {
    const agentRole = callType; // 'inbound' or 'outbound'

    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .eq('org_id', orgId)
      .eq('role', agentRole)
      .single();

    if (error) {
      logger.warn(`No ${callType} config found`, {
        orgId,
        error: error.message
      });
      return null;
    }

    return data;
  } catch (error: any) {
    logger.error('Error fetching config', {
      orgId,
      callType,
      error: error.message
    });
    return null;
  }
}
