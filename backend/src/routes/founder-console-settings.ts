/**
 * CallWaiting AI Settings Routes
 * 
 * Manages Vapi/Twilio integration credentials and configuration.
 * Keys are stored encrypted in the database, never exposed to frontend.
 * 
 * Single-tenant organization: you are the only user.
 */

import express, { Request, Response } from 'express';
import { supabase } from '../services/supabase-client';
import { configureVapiWebhook, verifyWebhookConfiguration } from '../services/vapi-webhook-configurator';
import { log } from '../services/logger';
import { VapiClient } from '../services/vapi-client';
import { requireAuthOrDev } from '../middleware/auth';
import { invalidateOrgSettingsCache } from '../services/cache';

const router = express.Router();

// Apply auth middleware to all routes (dev mode allows unauthenticated access)
router.use(requireAuthOrDev);

interface IntegrationSettings {
  vapi_api_key?: string;
  vapi_webhook_secret?: string;
  twilio_account_sid?: string;
  twilio_auth_token?: string;
  twilio_from_number?: string;
}

/**
 * GET /api/founder-console/settings
 * Retrieve integration settings (without exposing raw keys)
 *
 * Returns: { vapiConfigured, twilioConfigured, lastVerified }
 */
router.get('/settings', async (req: Request, res: Response): Promise<void> => {
  try {
    // Use orgId from authenticated user (set by requireAuthOrDev middleware)
    const orgId = req.user?.orgId || 'founder-console'; // Fallback to legacy org_id for backward compatibility

    const { data: settings, error } = await supabase
      .from('integration_settings')
      .select('vapi_api_key, twilio_account_sid, last_verified_at')
      .eq('org_id', orgId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('[Settings] Error fetching integration settings', error);
      res.status(500).json({ error: 'Internal server error' });
      return;
    }

    // Return only non-sensitive info
    res.status(200).json({
      vapiConfigured: !!settings?.vapi_api_key,
      twilioConfigured: !!settings?.twilio_account_sid,
      lastVerified: settings?.last_verified_at || null
    });
  } catch (error: any) {
    console.error('[Settings] Error in GET /settings', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/founder-console/settings
 * Save integration settings (Vapi/Twilio keys)
 *
 * Request: {
 *   vapi_api_key?: string,
 *   vapi_webhook_secret?: string,
 *   twilio_account_sid?: string,
 *   twilio_auth_token?: string,
 *   twilio_from_number?: string
 * }
 *
 * Response: { success: true }
 */
router.post('/settings', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      vapi_api_key,
      vapi_assistant_id,
      vapi_webhook_secret,
      twilio_account_sid,
      twilio_auth_token,
      twilio_from_number
    } = req.body;

    // Use orgId from authenticated user (set by requireAuthOrDev middleware)
    const orgId = req.user?.orgId;
    if (!orgId) {
      res.status(401).json({ error: 'No organization ID found. Please authenticate.' });
      return;
    }

    // Validate E.164 format if provided
    const validateE164 = (number: string | undefined): boolean => {
      if (!number) return true;
      return /^\+[1-9]\d{1,14}$/.test(number);
    };

    if (!validateE164(twilio_from_number)) {
      res.status(400).json({ error: 'Twilio number must be E.164 format (e.g., +234...)' });
      return;
    }

    // Check if settings already exist
    const { data: existing } = await supabase
      .from('integration_settings')
      .select('id')
      .eq('org_id', orgId)
      .maybeSingle();

    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    // Only include fields that were provided
    if (vapi_api_key !== undefined) updateData.vapi_api_key = vapi_api_key;
    if (vapi_webhook_secret !== undefined) updateData.vapi_webhook_secret = vapi_webhook_secret;
    if (twilio_account_sid !== undefined) updateData.twilio_account_sid = twilio_account_sid;
    if (twilio_auth_token !== undefined) updateData.twilio_auth_token = twilio_auth_token;
    if (twilio_from_number !== undefined) updateData.twilio_from_number = twilio_from_number;

    let error;

    if (existing) {
      // Update existing settings
      const result = await supabase
        .from('integration_settings')
        .update(updateData)
        .eq('org_id', orgId);
      error = result.error;
    } else {
      // Create new settings
      const result = await supabase
        .from('integration_settings')
        .insert({
          org_id: orgId,
          ...updateData
        });
      error = result.error;
    }

    if (error) {
      log.error('Settings', 'Error saving integration settings', { error: error.message });
      res.status(500).json({ error: 'Failed to save settings' });
      return;
    }

    // Invalidate org settings cache after update
    invalidateOrgSettingsCache(orgId);

    // CRITICAL: When the UI saves a Vapi API key, also upsert into integrations.
    // The web-test and call flows read Vapi credentials from public.integrations.
    if (typeof vapi_api_key === 'string') {
      const { data: existingVapiIntegration, error: existingVapiIntegrationError } = await supabase
        .from('integrations')
        .select('config')
        .eq('provider', 'vapi')
        .eq('org_id', orgId)
        .maybeSingle();

      if (existingVapiIntegrationError) {
        log.error('Settings', 'Failed to read existing Vapi integration', { error: existingVapiIntegrationError.message });
      }

      const existingConfig = (existingVapiIntegration as any)?.config || {};
      const newConfig = {
        ...existingConfig,
        // keep both keys in sync for backward compatibility
        vapi_api_key,
        vapi_secret_key: vapi_api_key
      };

      const { error: upsertError } = await supabase
        .from('integrations')
        .upsert(
          {
            org_id: orgId,
            provider: 'vapi',
            connected: true,
            last_checked_at: new Date().toISOString(),
            config: newConfig
          },
          { onConflict: 'org_id,provider' }
        );

      if (upsertError) {
        log.error('Settings', 'Failed to upsert Vapi integration from settings save', { error: upsertError.message });
      } else {
        log.info('Settings', 'Vapi integration updated from settings save', { orgId: orgId });
      }
    }

    // ========== CRITICAL FIX: Populate agent config tables ==========
    // When user saves API keys, also populate inbound_agent_config and outbound_agent_config
    // This ensures webhook can load credentials for Twilio calls
    if (vapi_api_key || twilio_account_sid) {
      try {
        // Get both inbound and outbound agents
        const { data: inboundAgent } = await supabase
          .from('agents')
          .select('id, vapi_assistant_id, system_prompt, first_message, voice, language, max_call_duration')
          .eq('role', 'inbound')
          .eq('org_id', orgId)
          .maybeSingle();

        const { data: outboundAgent } = await supabase
          .from('agents')
          .select('id, vapi_assistant_id, system_prompt, first_message, voice, language, max_call_duration')
          .eq('role', 'outbound')
          .eq('org_id', orgId)
          .maybeSingle();

        const hasVapiKey = typeof vapi_api_key === 'string' && vapi_api_key.trim().length > 0;
        const safeVapiKey = hasVapiKey ? vapi_api_key.trim().replace(/[^\x20-\x7E]/g, '') : null;
        const vapi = safeVapiKey ? new VapiClient(safeVapiKey) : null;

        const ensureVapiAssistant = async (agentRow: any, role: 'inbound' | 'outbound'): Promise<string | null> => {
          if (!vapi || !agentRow) return null;

          const existingId = agentRow?.vapi_assistant_id ? String(agentRow.vapi_assistant_id) : null;

          if (existingId) {
            try {
              await vapi.getAssistant(existingId);
              return existingId;
            } catch (e: any) {
              const status = e?.response?.status;
              if (status !== 404) {
                log.error('Settings', 'Failed to validate assistant in Vapi (non-blocking)', {
                  orgId: orgId,
                  role,
                  assistantId: existingId,
                  status,
                  error: e?.message
                });
                return existingId;
              }
            }
          }

          try {
            // CRITICAL: Ensure system prompt is never empty - Vapi defaults to silence if empty
            const defaultSystemPrompt = role === 'inbound'
              ? 'You are a professional clinic coordinator. You are helpful, friendly, and professional. Answer questions about our clinic services and schedule appointments.'
              : 'You are a professional sales development representative. You are persuasive, friendly, and professional. Your goal is to schedule consultations.';

            const created = await vapi.createAssistant({
              name: role === 'inbound' ? 'Voxanne (Inbound Coordinator)' : 'Voxanne (Outbound SDR)',
              systemPrompt: agentRow?.system_prompt?.trim() || defaultSystemPrompt,
              voiceProvider: 'vapi',
              voiceId: agentRow?.voice || (role === 'inbound' ? 'Kylie' : 'jennifer'),
              language: agentRow?.language || 'en',
              firstMessage: agentRow?.first_message || 'Hello! How can I help you today?',
              maxDurationSeconds: agentRow?.max_call_duration || 600
            });

            const newId = created?.id ? String(created.id) : null;
            if (!newId) {
              log.error('Settings', 'Vapi createAssistant returned no id (non-blocking)', {
                orgId: orgId,
                role
              });
              return null;
            }

            const { error: updateAgentError } = await supabase
              .from('agents')
              .update({
                vapi_assistant_id: newId,
                updated_at: new Date().toISOString()
              })
              .eq('id', agentRow.id);

            if (updateAgentError) {
              log.error('Settings', 'Failed to persist newly created assistant id (non-blocking)', {
                orgId: orgId,
                role,
                error: updateAgentError.message
              });
            }

            log.info('Settings', 'Created Vapi assistant for role', {
              orgId: orgId,
              role,
              assistantId: newId.slice(0, 20) + '...'
            });

            return newId;
          } catch (e: any) {
            log.error('Settings', 'Failed to create assistant in Vapi (non-blocking)', {
              orgId: orgId,
              role,
              error: e?.message,
              status: e?.response?.status
            });
            return null;
          }
        };

        const ensuredInboundAssistantId = await ensureVapiAssistant(inboundAgent, 'inbound');
        const ensuredOutboundAssistantId = await ensureVapiAssistant(outboundAgent, 'outbound');

        // Configure webhooks and recording for both assistants
        if (safeVapiKey && ensuredInboundAssistantId) {
          try {
            const inboundWebhookResult = await configureVapiWebhook(safeVapiKey, ensuredInboundAssistantId);
            log.info('Settings', 'Inbound assistant webhook configured', {
              assistantId: ensuredInboundAssistantId,
              success: inboundWebhookResult.success
            });
          } catch (e: any) {
            log.warn('Settings', 'Failed to configure inbound assistant webhook (non-blocking)', {
              assistantId: ensuredInboundAssistantId,
              error: e?.message
            });
          }
        }

        if (safeVapiKey && ensuredOutboundAssistantId) {
          try {
            const outboundWebhookResult = await configureVapiWebhook(safeVapiKey, ensuredOutboundAssistantId);
            log.info('Settings', 'Outbound assistant webhook configured', {
              assistantId: ensuredOutboundAssistantId,
              success: outboundWebhookResult.success
            });
          } catch (e: any) {
            log.warn('Settings', 'Failed to configure outbound assistant webhook (non-blocking)', {
              assistantId: ensuredOutboundAssistantId,
              error: e?.message
            });
          }
        }

        // Get Twilio inbound credentials from integrations (if different from outbound)
        const { data: twilioInbound } = await supabase
          .from('integrations')
          .select('config')
          .eq('provider', 'twilio_inbound')
          .eq('org_id', orgId)
          .maybeSingle();

        // Populate inbound_agent_config
        if (inboundAgent) {
          await supabase
            .from('inbound_agent_config')
            .upsert({
              org_id: orgId,
              vapi_api_key: vapi_api_key || null,
              vapi_assistant_id: ensuredInboundAssistantId || inboundAgent.vapi_assistant_id,
              twilio_account_sid: twilioInbound?.config?.accountSid || twilio_account_sid || null,
              twilio_auth_token: twilioInbound?.config?.authToken || twilio_auth_token || null,
              twilio_phone_number: twilioInbound?.config?.phoneNumber || twilio_from_number || null,
              system_prompt: inboundAgent.system_prompt,
              first_message: inboundAgent.first_message,
              voice_id: inboundAgent.voice,
              language: inboundAgent.language,
              max_call_duration: inboundAgent.max_call_duration,
              is_active: true,
              last_synced_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }, { onConflict: 'org_id' });

          log.info('Settings', 'Populated inbound_agent_config', {
            orgId: orgId,
            assistantId: (ensuredInboundAssistantId || inboundAgent.vapi_assistant_id || '').slice(0, 20) + '...'
          });
        }

        // Populate outbound_agent_config (only update Vapi credentials, preserve personality settings)
        if (outboundAgent) {
          // First, check if outbound_agent_config already exists
          const { data: existingOutboundConfig } = await supabase
            .from('outbound_agent_config')
            .select('id, system_prompt, first_message, voice_id, language, max_call_duration')
            .eq('org_id', orgId)
            .maybeSingle();

          // Only use agents table values if config doesn't exist yet
          const systemPrompt = existingOutboundConfig?.system_prompt || outboundAgent.system_prompt;
          const firstMessage = existingOutboundConfig?.first_message || outboundAgent.first_message;
          const voiceId = existingOutboundConfig?.voice_id || outboundAgent.voice;
          const language = existingOutboundConfig?.language || outboundAgent.language;
          const maxDuration = existingOutboundConfig?.max_call_duration || outboundAgent.max_call_duration;

          await supabase
            .from('outbound_agent_config')
            .upsert({
              org_id: orgId,
              vapi_api_key: vapi_api_key || null,
              vapi_assistant_id: ensuredOutboundAssistantId || outboundAgent.vapi_assistant_id,
              twilio_account_sid: twilio_account_sid || null,
              twilio_auth_token: twilio_auth_token || null,
              twilio_phone_number: twilio_from_number || null,
              system_prompt: systemPrompt,
              first_message: firstMessage,
              voice_id: voiceId,
              language: language,
              max_call_duration: maxDuration,
              is_active: true,
              last_synced_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }, { onConflict: 'org_id' });

          log.info('Settings', 'Populated outbound_agent_config', {
            orgId: orgId,
            assistantId: (ensuredOutboundAssistantId || outboundAgent.vapi_assistant_id || '').slice(0, 20) + '...',
            preservedExistingConfig: Boolean(existingOutboundConfig)
          });
        }

        const hasAllTwilio = Boolean(twilio_account_sid && twilio_auth_token && twilio_from_number);
        const inboundAssistantId = ensuredInboundAssistantId || inboundAgent?.vapi_assistant_id;

        if (hasVapiKey && hasAllTwilio && inboundAssistantId && vapi) {
          let vapiPhoneNumberId: string | null = null;
          try {
            const existingNumbers = await vapi.listPhoneNumbers();
            const normalized = String(twilio_from_number).trim();
            const existing = Array.isArray(existingNumbers)
              ? existingNumbers.find((p: any) => p?.number === normalized || p?.phoneNumber === normalized)
              : null;

            if (existing?.id) {
              vapiPhoneNumberId = existing.id;
            } else {
              const imported = await vapi.importTwilioNumber({
                phoneNumber: normalized,
                twilioAccountSid: String(twilio_account_sid),
                twilioAuthToken: String(twilio_auth_token)
              });
              if (imported?.id) {
                vapiPhoneNumberId = imported.id;
              }
            }
          } catch (e: any) {
            log.error('Settings', 'Failed to import/find Vapi phone number (non-blocking)', {
              orgId: orgId,
              error: e?.message
            });
          }

          if (vapiPhoneNumberId) {
            try {
              const { data: currentVapiIntegration } = await supabase
                .from('integrations')
                .select('config')
                .eq('provider', 'vapi')
                .eq('org_id', orgId)
                .maybeSingle();

              const now = new Date().toISOString();
              const merged = {
                ...((currentVapiIntegration as any)?.config || {}),
                vapi_phone_number_id: vapiPhoneNumberId,
                vapi_phone_numberId: vapiPhoneNumberId
              };

              const { error: upsertPhoneIdError } = await supabase
                .from('integrations')
                .upsert(
                  {
                    org_id: orgId,
                    provider: 'vapi',
                    connected: true,
                    last_checked_at: now,
                    config: merged,
                    updated_at: now
                  },
                  { onConflict: 'org_id,provider' }
                );

              if (upsertPhoneIdError) {
                log.error('Settings', 'Failed to persist vapi_phone_number_id (non-blocking)', {
                  orgId: orgId,
                  error: upsertPhoneIdError.message
                });
              }
            } catch (e: any) {
              log.error('Settings', 'Failed to upsert vapi_phone_number_id (non-blocking)', {
                orgId: orgId,
                error: e?.message
              });
            }

            try {
              await vapi.updatePhoneNumber(vapiPhoneNumberId, {
                assistantId: inboundAssistantId
              });
              log.info('Settings', 'Linked Vapi phone number to inbound assistant', {
                orgId: orgId,
                phoneNumberId: vapiPhoneNumberId,
                assistantId: inboundAssistantId.slice(0, 20) + '...'
              });
            } catch (e: any) {
              log.error('Settings', 'Failed to link Vapi phone number to inbound assistant (non-blocking)', {
                orgId: orgId,
                error: e?.message
              });
            }
          }
        }
      } catch (configError: any) {
        // Log but don't fail the request - config tables are secondary
        log.error('Settings', 'Failed to populate agent config tables (non-blocking)', {
          error: configError.message,
          orgId: orgId
        });
      }
    }

    log.info('Settings', 'Integration settings saved', {
      vapiConfigured: !!vapi_api_key,
      twilioConfigured: !!twilio_account_sid
    });

    // ========== LEGACY: Agent sync removed ==========
    // NOTE: This sync endpoint is no longer needed because:
    // 1. The agents table is now the single source of truth (SSOT)
    // 2. Agent configuration is saved directly to agents table via /agent/behavior
    // 3. inbound_agent_config and outbound_agent_config tables are deprecated
    // 4. No sync is needed - agents table is always up to date
    log.info('Settings', 'Skipping legacy agent sync - agents table is SSOT', { orgId: orgId });

    // Auto-configure Vapi webhook if API key and assistant ID were provided
    let webhookConfigResult = null;
    if (vapi_api_key && vapi_assistant_id) {
      log.info('Settings', 'Auto-configuring Vapi webhook', { assistantId: vapi_assistant_id });
      webhookConfigResult = await configureVapiWebhook(vapi_api_key, vapi_assistant_id);

      if (webhookConfigResult.success) {
        log.info('Settings', 'Webhook configured automatically', { assistantId: vapi_assistant_id });
      } else {
        log.warn('Settings', 'Webhook configuration failed', {
          error: webhookConfigResult.message
        });
      }
    } else if (vapi_api_key && !vapi_assistant_id) {
      log.warn('Settings', 'Vapi API key provided but no assistant ID, skipping webhook configuration');
    }

    res.status(200).json({
      success: true,
      webhookConfigured: webhookConfigResult?.success || false,
      webhookMessage: webhookConfigResult?.message
    });
  } catch (error: any) {
    console.error('[Settings] Error in POST /settings', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Internal helper: Get integration settings for backend use
 * This is NOT exposed via HTTP; used by other backend routes
 * @param orgId Optional org ID (defaults to 'founder-console' for backward compatibility)
 */
export async function getIntegrationSettings(orgId: string = 'founder-console'): Promise<IntegrationSettings | null> {
  try {
    const { data, error } = await supabase
      .from('integration_settings')
      .select('vapi_api_key, vapi_webhook_secret, twilio_account_sid, twilio_auth_token, twilio_from_number')
      .eq('org_id', orgId)
      .maybeSingle();

    if (error) {
      console.error('[Settings] Error fetching integration settings', error);
      return null;
    }

    return data || null;
  } catch (error: any) {
    console.error('[Settings] Error in getIntegrationSettings', error);
    return null;
  }
}

/**
 * POST /api/founder-console/settings/test-hot-lead-sms
 * Send test SMS to verify hot lead alert configuration
 */
router.post('/settings/test-hot-lead-sms', async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.orgId || 'founder-console';
    const { alertPhone } = req.body;

    if (!alertPhone) {
      res.status(400).json({ error: 'Alert phone number required' });
      return;
    }

    // Validate E.164 format
    if (!/^\+[1-9]\d{1,14}$/.test(alertPhone)) {
      res.status(400).json({ error: 'Invalid phone format. Use E.164 (e.g., +12345678900)' });
      return;
    }

    // Import sendHotLeadSMS
    const { sendHotLeadSMS } = await import('../services/sms-notifications');

    // Send test SMS
    const messageId = await sendHotLeadSMS(alertPhone, {
      name: 'Test Customer',
      phone: '+12345678900',
      service: 'Botox Consultation',
      summary: 'This is a test alert. Your hot lead SMS notifications are configured correctly!'
    });

    log('Settings', 'Test hot lead SMS sent', {
      orgId,
      alertPhone,
      messageId
    });

    res.json({
      success: true,
      messageId,
      message: 'Test SMS sent successfully'
    });
  } catch (error: any) {
    log('Settings', 'Failed to send test hot lead SMS', {
      error: error?.message
    });
    res.status(500).json({
      error: 'Failed to send test SMS',
      message: error?.message || 'Unknown error'
    });
  }
});

export default router;
