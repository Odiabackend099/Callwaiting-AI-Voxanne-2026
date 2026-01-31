/**
 * Backend Integration API Routes
 * GET /api/integrations/:provider - Fetch decrypted credentials
 * 
 * Uses IntegrationDecryptor to retrieve and decrypt credentials from the database.
 * Returns 404 if provider not configured (no fallback data).
 */

import { Router, Request, Response } from 'express';
import { IntegrationDecryptor } from '../services/integration-decryptor';
import { requireAuth } from '../middleware/auth';
import { log } from '../services/logger';

const router = Router();

/**
 * GET /api/integrations/:provider
 * 
 * Fetch decrypted credentials for a specific provider.
 * 
 * @param provider - Provider type (TWILIO, GOOGLE, VAPI, OUTLOOK)
 * @returns { config: {...} } with decrypted credentials or 404 if unconfigured
 */
router.get('/:provider', requireAuth, async (req: Request, res: Response) => {
  try {
    const { provider } = req.params;
    const orgId = req.user?.orgId; // Set by requireAuth middleware

    if (!orgId) {
      return res.status(401).json({ error: 'Missing org context' });
    }

    const validProviders = ['TWILIO', 'GOOGLE', 'VAPI', 'OUTLOOK'];
    const providerNorm = provider?.toUpperCase();

    if (!validProviders.includes(providerNorm)) {
      return res.status(400).json({ error: `Invalid provider: ${provider}` });
    }

    log.info('IntegrationsAPI', `Fetching ${providerNorm} credentials`, { orgId, provider });

    try {
      let config: any;

      // Route to appropriate decryption method
      switch (providerNorm) {
        case 'TWILIO':
          config = await IntegrationDecryptor.getTwilioCredentials(orgId);
          break;

        case 'GOOGLE':
          config = await IntegrationDecryptor.getGoogleCalendarCredentials(orgId);
          break;

        case 'VAPI':
          config = await IntegrationDecryptor.getVapiCredentials(orgId);
          break;

        case 'OUTLOOK':
          config = await IntegrationDecryptor.getOutlookCredentials(orgId);
          break;

        default:
          return res.status(400).json({ error: `Unsupported provider: ${providerNorm}` });
      }

      log.info('IntegrationsAPI', `Successfully retrieved ${providerNorm} config`, {
        orgId,
        provider: providerNorm,
        hasAccountSid: !!(config as any).accountSid,
        hasPhoneNumber: !!(config as any).phoneNumber,
      });

      return res.status(200).json({ config });
    } catch (integrationError: any) {
      // Check if it's a "not found" error (credentials not configured)
      const errorMsg = integrationError?.message || '';
      const isNotFound = errorMsg.includes('not found') || errorMsg.includes('Not found');

      if (isNotFound) {
        log.warn('IntegrationsAPI', `${providerNorm} not configured for org`, { orgId });
        return res.status(404).json({ error: `${providerNorm} not configured` });
      }

      throw integrationError;
    }
  } catch (error: any) {
    log.error('IntegrationsAPI', 'Error fetching integration', {
      error: error?.message,
      provider: req.params.provider,
    });

    return res.status(500).json({
      error: error?.message || 'Failed to fetch integration',
    });
  }
});

export default router;
