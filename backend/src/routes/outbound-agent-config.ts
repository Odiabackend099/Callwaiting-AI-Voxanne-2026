/**
 * Outbound Agent Configuration Routes
 * Manages outbound agent personality settings (system prompt, voice, etc.)
 * Single-number policy: outbound caller ID always comes from inbound config; outbound Twilio credentials/numbers are not configured here.
 */

import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase-client';
import { requireAuthOrDev } from '../middleware/auth';
import { createLogger } from '../services/logger';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';

const router = Router();
const logger = createLogger('OutboundAgentConfig');

// Rate limiting for config changes
const configLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: 'Too many configuration changes, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'GET' // Only apply to mutations
});

// Validation schema for outbound agent config (personality only)
const outboundAgentConfigSchema = z.object({
  vapi_api_key: z.string().optional().or(z.literal('')).transform(val => val || undefined),
  vapi_assistant_id: z.string().optional().or(z.literal('')).transform(val => val || undefined),
  system_prompt: z.string().min(1, 'System prompt is required'),
  first_message: z.string().min(1, 'First message is required'),
  voice_id: z.string().default('Paige'),
  language: z.string().default('en-US'),
  max_call_duration: z.coerce.number().int().positive().default(600),
  is_active: z.boolean().default(true)
});

type OutboundAgentConfig = z.infer<typeof outboundAgentConfigSchema>;

/**
 * GET /api/founder-console/outbound-agent-config
 * Retrieve outbound agent configuration (without exposing raw keys)
 */
router.get('/', requireAuthOrDev, async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { data: config, error } = await supabase
      .from('outbound_agent_config')
      .select('*')
      .eq('org_id', orgId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No config found - return empty config
        res.status(200).json({
          id: null,
          org_id: orgId,
          vapi_api_key: null,
          vapi_assistant_id: null,
          twilio_account_sid: null,
          twilio_auth_token: null,
          twilio_phone_number: null,
          system_prompt: null,
          first_message: null,
          voice_id: 'Paige',
          language: 'en-US',
          max_call_duration: 600,
          is_active: true,
          last_synced_at: null,
          created_at: null,
          updated_at: null
        });
        return;
      }

      logger.error('GET / Failed to fetch config', { orgId, error: error.message });
      res.status(500).json({ error: 'Failed to fetch configuration' });
      return;
    }

    // Mask sensitive keys before returning
    const maskedConfig = {
      ...config,
      vapi_api_key: config.vapi_api_key ? maskKey(config.vapi_api_key) : null,
      // Single-number policy: outbound Twilio fields are not used
      twilio_account_sid: null,
      twilio_auth_token: null,
      twilio_phone_number: null
    };

    res.status(200).json(maskedConfig);
  } catch (error: any) {
    logger.error('GET / Error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/founder-console/outbound-agent-config
 * Create or update outbound agent configuration
 */
router.post('/', configLimiter, requireAuthOrDev, async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Validate request body
    let validated: OutboundAgentConfig;
    try {
      validated = outboundAgentConfigSchema.parse(req.body);
    } catch (validationError: any) {
      res.status(400).json({
        error: 'Validation failed',
        details: validationError.errors
      });
      return;
    }

    // Check if config already exists
    const { data: existing } = await supabase
      .from('outbound_agent_config')
      .select('id')
      .eq('org_id', orgId)
      .single();

    if (existing) {
      // Update existing config
      const { data: updated, error: updateError } = await supabase
        .from('outbound_agent_config')
        .update({
          ...validated,
          // Single-number policy: never persist outbound Twilio fields
          twilio_account_sid: null,
          twilio_auth_token: null,
          twilio_phone_number: null,
          updated_at: new Date().toISOString()
        })
        .eq('org_id', orgId)
        .select('*')
        .single();

      if (updateError) {
        logger.error('POST / Update failed', { orgId, error: updateError.message });
        res.status(500).json({ error: 'Failed to update configuration' });
        return;
      }

      logger.info('POST / Config updated', { orgId, configId: updated.id });
      res.status(200).json({
        ...updated,
        vapi_api_key: maskKey(updated.vapi_api_key),
        twilio_account_sid: null,
        twilio_auth_token: null,
        twilio_phone_number: null
      });
    } else {
      // Create new config
      const { data: created, error: createError } = await supabase
        .from('outbound_agent_config')
        .insert({
          org_id: orgId,
          ...validated,
          // Single-number policy: never persist outbound Twilio fields
          twilio_account_sid: null,
          twilio_auth_token: null,
          twilio_phone_number: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('*')
        .single();

      if (createError) {
        logger.error('POST / Create failed', { orgId, error: createError.message });
        res.status(500).json({ error: 'Failed to create configuration' });
        return;
      }

      logger.info('POST / Config created', { orgId, configId: created.id });
      res.status(201).json({
        ...created,
        vapi_api_key: maskKey(created.vapi_api_key),
        twilio_account_sid: null,
        twilio_auth_token: null,
        twilio_phone_number: null
      });
    }
  } catch (error: any) {
    logger.error('POST / Error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/founder-console/outbound-agent-config
 * Update specific fields of outbound agent configuration
 */
router.put('/', requireAuthOrDev, async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Validate request body (allow partial updates)
    const partialSchema = outboundAgentConfigSchema.partial();
    let validated: Partial<OutboundAgentConfig>;
    try {
      validated = partialSchema.parse(req.body);
    } catch (validationError: any) {
      res.status(400).json({
        error: 'Validation failed',
        details: validationError.errors
      });
      return;
    }

    const { data: updated, error } = await supabase
      .from('outbound_agent_config')
      .update({
        ...validated,
        // Single-number policy: never persist outbound Twilio fields
        twilio_account_sid: null,
        twilio_auth_token: null,
        twilio_phone_number: null,
        updated_at: new Date().toISOString()
      })
      .eq('org_id', orgId)
      .select('*')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        res.status(404).json({ error: 'Configuration not found' });
        return;
      }

      logger.error('PUT / Update failed', { orgId, error: error.message });
      res.status(500).json({ error: 'Failed to update configuration' });
      return;
    }

    logger.info('PUT / Config updated', { orgId, configId: updated.id });
    res.status(200).json({
      ...updated,
      vapi_api_key: maskKey(updated.vapi_api_key),
      twilio_account_sid: null,
      twilio_auth_token: null,
      twilio_phone_number: null
    });
  } catch (error: any) {
    logger.error('PUT / Error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/founder-console/outbound-agent-config
 * Delete outbound agent configuration
 */
router.delete('/', requireAuthOrDev, async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { error } = await supabase
      .from('outbound_agent_config')
      .delete()
      .eq('org_id', orgId);

    if (error) {
      logger.error('DELETE / Delete failed', { orgId, error: error.message });
      res.status(500).json({ error: 'Failed to delete configuration' });
      return;
    }

    logger.info('DELETE / Config deleted', { orgId });
    res.status(200).json({ success: true });
  } catch (error: any) {
    logger.error('DELETE / Error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Helper function to mask sensitive keys
 */
function maskKey(key: string | undefined | null): string {
  if (!key) return '';
  if (key.length <= 8) return '••••••••';
  return key.substring(0, 4) + '••••••••' + key.substring(key.length - 4);
}

export default router;
