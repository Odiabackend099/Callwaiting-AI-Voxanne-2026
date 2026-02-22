/**
 * Phone Number Resolver Service
 *
 * @ai-invariant DO NOT REMOVE OR BYPASS THIS SERVICE.
 * This is the single correct way to resolve a Vapi phone number ID for outbound calls.
 * Raw phone strings like "+12125551234" are NOT valid Vapi phoneNumberIds — only UUIDs are.
 *
 * Resolution strategy (highest priority first):
 *   0. Check verified_caller_ids for a verified number with vapi_phone_number_id set
 *      → Explicit user choice for outbound caller ID — highest priority
 *   1. Check managed_phone_numbers for an active number with vapi_phone_id set
 *      → Short-circuit for managed orgs
 *   2. Get org's Twilio phone number from org_credentials (SSOT for credentials)
 *   3. List all Vapi phone numbers and find a match
 *   4. Fall back to first available Vapi phone number
 *   5. Return null if no phone numbers exist at all
 *
 * When resolved, the caller should store the phone number ID back to the agents table
 * so subsequent calls skip the resolution step.
 */

import { VapiClient } from './vapi-client';
import { IntegrationDecryptor } from './integration-decryptor';
import { createLogger } from './logger';
import { withTimeout } from '../utils/timeout-helper';
import { supabaseAdmin } from '../config/supabase';

const logger = createLogger('PhoneNumberResolver');

const RESOLVE_TIMEOUT_MS = 10_000; // 10 seconds — fail fast if Vapi API is hung

export async function resolveOrgPhoneNumberId(
  orgId: string,
  vapiApiKey: string
): Promise<{ phoneNumberId: string | null; callerNumber?: string }> {
  return withTimeout(
    resolveOrgPhoneNumberIdInner(orgId, vapiApiKey),
    RESOLVE_TIMEOUT_MS,
    `Phone number resolution timed out after ${RESOLVE_TIMEOUT_MS / 1000}s for org ${orgId}`
  );
}

async function resolveOrgPhoneNumberIdInner(
  orgId: string,
  vapiApiKey: string
): Promise<{ phoneNumberId: string | null; callerNumber?: string }> {
  try {
    // Step 0: Check verified_caller_ids for org's verified number with Vapi ID
    // This is highest priority — user explicitly verified this number for outbound calls
    try {
      const { data: verifiedCaller } = await supabaseAdmin
        .from('verified_caller_ids')
        .select('vapi_phone_number_id, phone_number')
        .eq('org_id', orgId)
        .eq('status', 'verified')
        .not('vapi_phone_number_id', 'is', null)
        .limit(1)
        .maybeSingle();

      if (verifiedCaller?.vapi_phone_number_id) {
        logger.info('Resolved verified caller ID (Step 0 — user-configured)', {
          orgId,
          vapiPhoneNumberId: verifiedCaller.vapi_phone_number_id,
          phoneLast4: verifiedCaller.phone_number?.slice(-4),
        });
        return { phoneNumberId: verifiedCaller.vapi_phone_number_id, callerNumber: verifiedCaller.phone_number };
      }
    } catch {
      // Best-effort; fall through to managed numbers
    }

    // Step 1: Check managed_phone_numbers for an active OUTBOUND number with vapi_phone_id
    // Only outbound-tagged numbers should be used for outbound calls
    // Short-circuits the entire BYOC resolution chain for managed orgs
    try {
      const { data: managedNumber } = await supabaseAdmin
        .from('managed_phone_numbers')
        .select('vapi_phone_id, phone_number')
        .eq('org_id', orgId)
        .eq('status', 'active')
        .eq('routing_direction', 'outbound')
        .not('vapi_phone_id', 'is', null)
        .limit(1)
        .maybeSingle();

      if (managedNumber?.vapi_phone_id) {
        logger.info('Resolved managed outbound phone number (Step 1 short-circuit)', {
          orgId,
          vapiPhoneNumberId: managedNumber.vapi_phone_id,
          phoneLast4: managedNumber.phone_number?.slice(-4),
        });
        return { phoneNumberId: managedNumber.vapi_phone_id, callerNumber: managedNumber.phone_number };
      }

      // Fallback: if no outbound-tagged number exists, try any active managed number
      // This preserves backward compatibility for existing single-number orgs
      const { data: anyManagedNumber } = await supabaseAdmin
        .from('managed_phone_numbers')
        .select('vapi_phone_id, phone_number')
        .eq('org_id', orgId)
        .eq('status', 'active')
        .not('vapi_phone_id', 'is', null)
        .limit(1)
        .maybeSingle();

      if (anyManagedNumber?.vapi_phone_id) {
        logger.info('Resolved managed phone number fallback (Step 1 — no outbound-tagged number)', {
          orgId,
          vapiPhoneNumberId: anyManagedNumber.vapi_phone_id,
          phoneLast4: anyManagedNumber.phone_number?.slice(-4),
        });
        return { phoneNumberId: anyManagedNumber.vapi_phone_id, callerNumber: anyManagedNumber.phone_number };
      }
    } catch {
      // Step 1 is best-effort; fall through to BYOC chain
    }

    // Step 2: Get org's Twilio phone number from org_credentials (SSOT for credentials)
    let twilioPhoneNumber: string | undefined;
    try {
      const twilioCreds = await IntegrationDecryptor.getTwilioCredentials(orgId);
      twilioPhoneNumber = twilioCreds.phoneNumber;
      logger.info('Resolved Twilio phone from org_credentials', {
        orgId,
        phoneLast4: twilioPhoneNumber?.slice(-4)
      });
    } catch {
      logger.info('No Twilio credentials in org_credentials for org, will try Vapi phone list', { orgId });
    }

    // Step 3: List all Vapi phone numbers and find a match
    const vapiClient = new VapiClient(vapiApiKey);
    const vapiNumbers = await vapiClient.listPhoneNumbers();

    if (!vapiNumbers || vapiNumbers.length === 0) {
      logger.warn('No Vapi phone numbers available', { orgId });
      return { phoneNumberId: null };
    }

    // Step 4: Try to match org's Twilio number against Vapi phone list
    if (twilioPhoneNumber) {
      const matched = vapiNumbers.find(
        (n: any) => n.number === twilioPhoneNumber || n.number === twilioPhoneNumber?.replace(/\s/g, '')
      );
      if (matched) {
        logger.info('Matched Twilio number to Vapi phone number', {
          orgId,
          vapiPhoneNumberId: matched.id,
          number: matched.number?.slice(-4)
        });
        return { phoneNumberId: matched.id, callerNumber: matched.number };
      }
    }

    // Step 5: Fall back to first available Vapi number
    const fallback = vapiNumbers[0];
    logger.info('Using first available Vapi phone number as fallback', {
      orgId,
      vapiPhoneNumberId: fallback.id,
      number: fallback.number?.slice(-4)
    });
    return { phoneNumberId: fallback.id, callerNumber: fallback.number };
  } catch (err: any) {
    logger.error('Failed to resolve org phone number', { orgId, error: err?.message });
    return { phoneNumberId: null };
  }
}
