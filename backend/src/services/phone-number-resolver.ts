/**
 * Phone Number Resolver Service
 *
 * @ai-invariant DO NOT REMOVE OR BYPASS THIS SERVICE.
 * This is the single correct way to resolve a Vapi phone number ID for outbound calls.
 * Raw phone strings like "+12125551234" are NOT valid Vapi phoneNumberIds — only UUIDs are.
 *
 * Resolution strategy:
 *   1. Get org's Twilio phone number from org_credentials (SSOT for credentials)
 *   2. List all Vapi phone numbers and find a match
 *   3. Fall back to first available Vapi phone number
 *   4. Return null if no phone numbers exist at all
 *
 * When resolved, the caller should store the phone number ID back to the agents table
 * so subsequent calls skip the resolution step.
 */

import { VapiClient } from './vapi-client';
import { IntegrationDecryptor } from './integration-decryptor';
import { createLogger } from './logger';
import { withTimeout } from '../utils/timeout-helper';

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
    // Step 1: Get org's Twilio phone number from org_credentials (SSOT for credentials)
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

    // Step 2: List all Vapi phone numbers and find a match
    const vapiClient = new VapiClient(vapiApiKey);
    const vapiNumbers = await vapiClient.listPhoneNumbers();

    if (!vapiNumbers || vapiNumbers.length === 0) {
      logger.warn('No Vapi phone numbers available', { orgId });
      return { phoneNumberId: null };
    }

    // Step 3: Try to match org's Twilio number against Vapi phone list
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

    // Step 4: Fall back to first available Vapi number
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
