/**
 * Webhook Organization Resolver
 *
 * This utility resolves the organization ID from a Vapi webhook request.
 * It implements the first critical step of the webhook handler:
 * resolve org_id BEFORE any credential access.
 */

import { log } from '../services/logger';
import { IntegrationDecryptor } from '../services/integration-decryptor';
import { verifyVapiSignature } from './vapi-webhook-signature';

export interface ResolvedOrgContext {
  orgId: string;
  assistantId: string;
  isValid: boolean;
  error?: string;
}

/**
 * Resolve organization from Vapi webhook request
 *
 * Strategy:
 * 1. Extract assistantId from request body
 * 2. Use IntegrationDecryptor to resolve org_id from assistantId via assistant_org_mapping
 * 3. Return org context for webhook handler
 *
 * @param req - Express request object
 * @returns Organization context or null if resolution fails
 */
export async function resolveOrgFromWebhook(req: any): Promise<ResolvedOrgContext | null> {
  try {
    // Step 1: Extract assistantId from request
    const { assistantId, call } = req.body;

    // Try multiple locations where assistantId might be
    const resolvedAssistantId =
      assistantId ||
      call?.assistantId ||
      call?.metadata?.assistantId;

    if (!resolvedAssistantId) {
      log.warn('webhook-org-resolver', 'No assistantId found in webhook request');
      return null;
    }

    // Step 2: Resolve org_id from assistantId
    const orgId = await IntegrationDecryptor.resolveOrgFromAssistant(resolvedAssistantId);

    if (!orgId) {
      log.warn('webhook-org-resolver', 'Failed to resolve org from assistantId', {
        assistantId: resolvedAssistantId,
      });
      return null;
    }

    log.debug('webhook-org-resolver', 'Successfully resolved org from webhook', {
      orgId,
      assistantId: resolvedAssistantId,
    });

    return {
      orgId,
      assistantId: resolvedAssistantId,
      isValid: true,
    };
  } catch (error: any) {
    log.error('webhook-org-resolver', 'Error resolving org from webhook', {
      error: error?.message,
    });
    return null;
  }
}

/**
 * Verify Vapi webhook signature using org-specific credentials
 *
 * This function:
 * 1. Gets Vapi credentials for the org using IntegrationDecryptor
 * 2. Verifies the webhook signature using the org's webhook secret
 * 3. Returns verification result
 *
 * @param req - Express request object with signature headers
 * @param orgId - Organization ID
 * @returns true if signature is valid, false otherwise
 */
export async function verifyVapiWebhookSignature(
  req: any,
  orgId: string
): Promise<boolean> {
  try {
    // Get Vapi credentials for this org
    const vapiCreds = await IntegrationDecryptor.getVapiCredentials(orgId);

    // Get signature components from request headers
    const signature = req.headers['x-vapi-signature'] as string;
    const timestamp = req.headers['x-vapi-timestamp'] as string;
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);

    if (!signature || !timestamp) {
      log.warn('webhook-org-resolver', 'Missing signature or timestamp headers', {
        orgId,
        hasSignature: !!signature,
        hasTimestamp: !!timestamp,
      });
      return false;
    }

    // Verify using org-specific webhook secret
    const isValid = verifyVapiSignature({
      secret: vapiCreds.webhookSecret || process.env.VAPI_WEBHOOK_SECRET!,
      signature,
      timestamp,
      rawBody,
    });

    if (!isValid) {
      log.warn('webhook-org-resolver', 'Invalid webhook signature', {
        orgId,
        hasValidSignature: false,
      });
      return false;
    }

    log.debug('webhook-org-resolver', 'Webhook signature verified', {
      orgId,
    });

    return true;
  } catch (error: any) {
    log.error('webhook-org-resolver', 'Signature verification error', {
      orgId,
      error: error?.message,
    });
    return false;
  }
}

/**
 * Get SMS credentials for org
 * Used in webhook handlers that send SMS notifications
 */
export async function getSmsCredentialsForOrg(orgId: string) {
  try {
    return await IntegrationDecryptor.getTwilioCredentials(orgId);
  } catch (error: any) {
    log.warn('webhook-org-resolver', 'Failed to get SMS credentials', {
      orgId,
      error: error?.message,
    });
    return null;
  }
}

/**
 * Get calendar credentials for org
 * Used in webhook handlers that interact with Google Calendar
 */
export async function getCalendarCredentialsForOrg(orgId: string) {
  try {
    return await IntegrationDecryptor.getGoogleCalendarCredentials(orgId);
  } catch (error: any) {
    log.warn('webhook-org-resolver', 'Failed to get calendar credentials', {
      orgId,
      error: error?.message,
    });
    return null;
  }
}
