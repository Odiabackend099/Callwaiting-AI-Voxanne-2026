/**
 * Agent Sync Routes
 * 
 * Enforces dashboard as single source of truth for agents.
 * Only two agents are allowed: inbound and outbound.
 * Any other agents are removed from the database.
 * 
 * This ensures the agents table is always in sync with the dashboard configuration.
 */

import express, { Request, Response } from 'express';
import { supabase } from '../services/supabase-client';
import { log } from '../services/logger';
import { VapiClient } from '../services/vapi-client';

const router = express.Router();

const ALLOWED_ROLES = ['inbound', 'outbound'];

/**
 * POST /api/founder-console/sync-agents
 * 
 * Enforces dashboard as single source of truth:
 * 1. Reads inbound_agent_config and outbound_agent_config from dashboard
 * 2. Syncs these to agents table (creating/updating as needed)
 * 3. Removes any other agents not in the dashboard
 * 4. Updates Vapi assistants to match dashboard config
 * 
 * This is called automatically when user saves API keys or agent config.
 */
router.post('/sync-agents', async (req: Request, res: Response): Promise<void> => {
  const requestId = `sync-${Date.now()}`;
  
  try {
    log.info('AgentSync', 'Starting agent sync from dashboard', { requestId });

    // @ai-invariant: DEPRECATED - This route is COMMENTED OUT in server.ts (line 284).
    // If re-enabled, the .limit(1).single() below MUST be replaced with org_id
    // resolution from the authenticated user's JWT. See founder-console-v2.ts:891-895
    // for the correct pattern.
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .limit(1)
      .single();

    if (orgError || !org?.id) {
      log.error('AgentSync', 'Failed to get organization', { requestId, error: orgError?.message });
      res.status(500).json({ error: 'Failed to get organization' });
      return;
    }

    const orgId = org.id;

    // Step 1: Read dashboard configs (source of truth)
    const { data: inboundConfig, error: inboundError } = await supabase
      .from('inbound_agent_config')
      .select('*')
      .eq('org_id', orgId)
      .maybeSingle();

    const { data: outboundConfig, error: outboundError } = await supabase
      .from('outbound_agent_config')
      .select('*')
      .eq('org_id', orgId)
      .maybeSingle();

    if (inboundError || outboundError) {
      log.error('AgentSync', 'Failed to read dashboard configs', {
        requestId,
        inboundError: inboundError?.message,
        outboundError: outboundError?.message
      });
      res.status(500).json({ error: 'Failed to read dashboard configurations' });
      return;
    }

    log.info('AgentSync', 'Read dashboard configs', {
      requestId,
      hasInbound: Boolean(inboundConfig),
      hasOutbound: Boolean(outboundConfig)
    });

    // Step 2: Sync inbound agent from dashboard
    let inboundAgentId: string | null = null;
    if (inboundConfig) {
      const { data: existingInbound } = await supabase
        .from('agents')
        .select('id')
        .eq('org_id', orgId)
        .eq('role', 'inbound')
        .maybeSingle();

      if (existingInbound) {
        // Update existing inbound agent
        const { error: updateError } = await supabase
          .from('agents')
          .update({
            name: 'Voxanne (Inbound Coordinator)',
            system_prompt: inboundConfig.system_prompt,
            first_message: inboundConfig.first_message,
            voice: inboundConfig.voice_id,
            language: inboundConfig.language,
            max_call_duration: inboundConfig.max_call_duration,
            vapi_assistant_id: inboundConfig.vapi_assistant_id,
            active: inboundConfig.is_active,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingInbound.id);

        if (updateError) {
          log.error('AgentSync', 'Failed to update inbound agent', {
            requestId,
            error: updateError.message
          });
        } else {
          inboundAgentId = existingInbound.id;
          log.info('AgentSync', 'Updated inbound agent from dashboard', {
            requestId,
            agentId: inboundAgentId
          });
        }
      } else {
        // Create new inbound agent
        const { data: created, error: createError } = await supabase
          .from('agents')
          .insert({
            org_id: orgId,
            role: 'inbound',
            name: 'Voxanne (Inbound Coordinator)',
            system_prompt: inboundConfig.system_prompt,
            first_message: inboundConfig.first_message,
            voice: inboundConfig.voice_id,
            language: inboundConfig.language,
            max_call_duration: inboundConfig.max_call_duration,
            vapi_assistant_id: inboundConfig.vapi_assistant_id,
            active: inboundConfig.is_active,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select('id')
          .single();

        if (createError) {
          log.error('AgentSync', 'Failed to create inbound agent', {
            requestId,
            error: createError.message
          });
        } else {
          inboundAgentId = created.id;
          log.info('AgentSync', 'Created inbound agent from dashboard', {
            requestId,
            agentId: inboundAgentId
          });
        }
      }
    }

    // Step 3: Sync outbound agent from dashboard
    let outboundAgentId: string | null = null;
    if (outboundConfig) {
      const { data: existingOutbound } = await supabase
        .from('agents')
        .select('id')
        .eq('org_id', orgId)
        .eq('role', 'outbound')
        .maybeSingle();

      if (existingOutbound) {
        // Update existing outbound agent
        const { error: updateError } = await supabase
          .from('agents')
          // @ai-invariant DO NOT REMOVE vapi_phone_number_id or vapi_assistant_id from this payload.
          // These fields are required for outbound calls to work. See .claude/CLAUDE.md "CRITICAL INVARIANTS".
          .update({
            name: 'Voxanne (Outbound SDR)',
            system_prompt: outboundConfig.system_prompt,
            first_message: outboundConfig.first_message,
            voice: outboundConfig.voice_id,
            language: outboundConfig.language,
            max_call_duration: outboundConfig.max_call_duration,
            vapi_assistant_id: outboundConfig.vapi_assistant_id,
            vapi_phone_number_id: outboundConfig.vapi_phone_number_id,
            active: outboundConfig.is_active,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingOutbound.id);

        if (updateError) {
          log.error('AgentSync', 'Failed to update outbound agent', {
            requestId,
            error: updateError.message
          });
        } else {
          outboundAgentId = existingOutbound.id;
          log.info('AgentSync', 'Updated outbound agent from dashboard', {
            requestId,
            agentId: outboundAgentId
          });
        }
      } else {
        // Create new outbound agent
        const { data: created, error: createError } = await supabase
          .from('agents')
          // @ai-invariant DO NOT REMOVE vapi_phone_number_id or vapi_assistant_id from this payload.
          // These fields are required for outbound calls to work. See .claude/CLAUDE.md "CRITICAL INVARIANTS".
          .insert({
            org_id: orgId,
            role: 'outbound',
            name: 'Voxanne (Outbound SDR)',
            system_prompt: outboundConfig.system_prompt,
            first_message: outboundConfig.first_message,
            voice: outboundConfig.voice_id,
            language: outboundConfig.language,
            max_call_duration: outboundConfig.max_call_duration,
            vapi_assistant_id: outboundConfig.vapi_assistant_id,
            vapi_phone_number_id: outboundConfig.vapi_phone_number_id,
            active: outboundConfig.is_active,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select('id')
          .single();

        if (createError) {
          log.error('AgentSync', 'Failed to create outbound agent', {
            requestId,
            error: createError.message
          });
        } else {
          outboundAgentId = created.id;
          log.info('AgentSync', 'Created outbound agent from dashboard', {
            requestId,
            agentId: outboundAgentId
          });
        }
      }
    }

    // Step 4: Remove any "alien" agents not in dashboard (not inbound or outbound)
    const { data: allAgents, error: allAgentsError } = await supabase
      .from('agents')
      .select('id, role')
      .eq('org_id', orgId);

    if (!allAgentsError && allAgents) {
      const agentIdsToDelete = allAgents
        .filter(agent => !ALLOWED_ROLES.includes(agent.role))
        .map(agent => agent.id);

      if (agentIdsToDelete.length > 0) {
        log.warn('AgentSync', 'Removing alien agents not in dashboard', {
          requestId,
          count: agentIdsToDelete.length,
          ids: agentIdsToDelete
        });

        const { error: deleteError } = await supabase
          .from('agents')
          .delete()
          .in('id', agentIdsToDelete);

        if (deleteError) {
          log.error('AgentSync', 'Failed to delete alien agents', {
            requestId,
            error: deleteError.message
          });
        } else {
          log.info('AgentSync', 'Successfully removed alien agents', {
            requestId,
            count: agentIdsToDelete.length
          });
        }
      }
    }

    // Step 5: Update Vapi assistants if API key is available
    const vapiApiKey = inboundConfig?.vapi_api_key || outboundConfig?.vapi_api_key;
    if (vapiApiKey) {
      const vapi = new VapiClient(vapiApiKey);

      // Update inbound assistant if it exists
      if (inboundConfig?.vapi_assistant_id) {
        try {
          await vapi.updateAssistant(inboundConfig.vapi_assistant_id, {
            name: 'Voxanne (Inbound Coordinator)',
            model: {
              provider: 'openai',
              model: 'gpt-4',
              messages: [{ role: 'system', content: inboundConfig.system_prompt }]
            },
            voice: {
              provider: 'vapi',
              voiceId: inboundConfig.voice_id
            },
            firstMessage: inboundConfig.first_message,
            language: inboundConfig.language,
            maxDurationSeconds: inboundConfig.max_call_duration
          });

          log.info('AgentSync', 'Updated inbound Vapi assistant', {
            requestId,
            assistantId: inboundConfig.vapi_assistant_id.slice(0, 20) + '...'
          });
        } catch (e: any) {
          log.warn('AgentSync', 'Failed to update inbound Vapi assistant (non-blocking)', {
            requestId,
            error: e?.message
          });
        }
      }

      // Update outbound assistant if it exists
      if (outboundConfig?.vapi_assistant_id) {
        try {
          await vapi.updateAssistant(outboundConfig.vapi_assistant_id, {
            name: 'Voxanne (Outbound SDR)',
            model: {
              provider: 'openai',
              model: 'gpt-4',
              messages: [{ role: 'system', content: outboundConfig.system_prompt }]
            },
            voice: {
              provider: 'vapi',
              voiceId: outboundConfig.voice_id
            },
            firstMessage: outboundConfig.first_message,
            language: outboundConfig.language,
            maxDurationSeconds: outboundConfig.max_call_duration
          });

          log.info('AgentSync', 'Updated outbound Vapi assistant', {
            requestId,
            assistantId: outboundConfig.vapi_assistant_id.slice(0, 20) + '...'
          });
        } catch (e: any) {
          log.warn('AgentSync', 'Failed to update outbound Vapi assistant (non-blocking)', {
            requestId,
            error: e?.message
          });
        }
      }
    }

    log.info('AgentSync', 'Agent sync completed successfully', {
      requestId,
      inboundAgentId,
      outboundAgentId
    });

    res.status(200).json({
      success: true,
      message: 'Agents synced from dashboard',
      inboundAgentId,
      outboundAgentId,
      requestId
    });
  } catch (error: any) {
    log.error('AgentSync', 'Unexpected error during agent sync', {
      requestId,
      error: error?.message,
      stack: error?.stack
    });
    res.status(500).json({
      error: 'Failed to sync agents',
      requestId
    });
  }
});

export default router;
