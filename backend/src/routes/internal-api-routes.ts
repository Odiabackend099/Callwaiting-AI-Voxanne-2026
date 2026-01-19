/**
 * Internal API Routes for Webhook Configuration
 * These endpoints are used by automation scripts to programmatically configure Vapi webhooks
 * 
 * Routes:
 * - POST /api/internal/configure-vapi-webhook - Configure Vapi assistant webhook
 * - POST /api/internal/verify-vapi-webhook - Verify webhook configuration
 */

import { Router } from 'express';
import { configureVapiWebhook, verifyWebhookConfiguration } from '../services/vapi-webhook-configurator';
import { log } from '../services/logger';

const router = Router();

/**
 * Configure Vapi webhook
 * POST /api/internal/configure-vapi-webhook
 * 
 * Body:
 * {
 *   "vapiApiKey": "string",
 *   "vapiAssistantId": "string",
 *   "webhookUrl": "string (optional)"
 * }
 */
router.post('/configure-vapi-webhook', async (req, res) => {
  try {
    const { vapiApiKey, vapiAssistantId, webhookUrl } = req.body;

    if (!vapiApiKey || !vapiAssistantId) {
      return res.status(400).json({
        success: false,
        error: 'Missing vapiApiKey or vapiAssistantId'
      });
    }

    log.info('InternalAPI', 'Configuring Vapi webhook', {
      assistantId: vapiAssistantId.substring(0, 8) + '...'
    });

    const result = await configureVapiWebhook(vapiApiKey, vapiAssistantId);

    return res.status(200).json({
      success: result.success,
      message: result.message,
      assistantId: result.assistantId
    });
  } catch (error: any) {
    log.error('InternalAPI', 'Failed to configure webhook', {
      error: error.message
    });

    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to configure webhook'
    });
  }
});

/**
 * Verify Vapi webhook configuration
 * POST /api/internal/verify-vapi-webhook
 * 
 * Body:
 * {
 *   "vapiApiKey": "string",
 *   "vapiAssistantId": "string"
 * }
 */
router.post('/verify-vapi-webhook', async (req, res) => {
  try {
    const { vapiApiKey, vapiAssistantId } = req.body;

    if (!vapiApiKey || !vapiAssistantId) {
      return res.status(400).json({
        success: false,
        error: 'Missing vapiApiKey or vapiAssistantId'
      });
    }

    log.info('InternalAPI', 'Verifying Vapi webhook', {
      assistantId: vapiAssistantId.substring(0, 8) + '...'
    });

    const configured = await verifyWebhookConfiguration(vapiApiKey, vapiAssistantId);

    return res.status(200).json({
      success: true,
      configured: configured,
      message: configured 
        ? 'Webhook is properly configured' 
        : 'Webhook configuration not found'
    });
  } catch (error: any) {
    log.error('InternalAPI', 'Failed to verify webhook', {
      error: error.message
    });

    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to verify webhook'
    });
  }
});

export default router;
