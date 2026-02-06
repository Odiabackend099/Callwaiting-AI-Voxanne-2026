import { Router } from 'express';
import { supabase } from '../services/supabase-client';
import { requireAuth } from '../middleware/auth';
import { log as logger } from '../services/logger';

const router = Router();

/**
 * GET /api/agent-diagnostics/:orgId
 *
 * Returns all agent configuration data for debugging
 * Helps diagnose issues with browser test and live call test assistant selection
 */
router.get('/:orgId', requireAuth, async (req, res) => {
  try {
    const { orgId } = req.params;

    // Verify user has access to this org
    if (req.user?.orgId !== orgId) {
      logger.warn('[Agent Diagnostics] Access denied', {
        requested_org_id: orgId,
        user_org_id: req.user?.orgId,
        user_id: req.user?.id
      });
      return res.status(403).json({ error: 'Access denied to this organization' });
    }

    logger.info('[Agent Diagnostics] Fetching agent configuration', {
      org_id: orgId,
      user_id: req.user?.id
    });

    // 1. Get organization record
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, vapi_assistant_id, vapi_phone_number_id, email')
      .eq('id', orgId)
      .single();

    if (orgError) {
      logger.error('[Agent Diagnostics] Failed to fetch organization', {
        org_id: orgId,
        error: orgError.message
      });
      return res.status(500).json({ error: 'Failed to fetch organization data' });
    }

    // 2. Get all agents for this org
    const { data: agents, error: agentsError } = await supabase
      .from('agents')
      .select('*')
      .eq('org_id', orgId)
      .order('role, created_at DESC');

    if (agentsError) {
      logger.error('[Agent Diagnostics] Failed to fetch agents', {
        org_id: orgId,
        error: agentsError.message
      });
      return res.status(500).json({ error: 'Failed to fetch agents' });
    }

    // 3. Get assistant mappings
    const { data: mappings, error: mappingsError } = await supabase
      .from('assistant_org_mapping')
      .select('*')
      .eq('org_id', orgId);

    if (mappingsError) {
      logger.warn('[Agent Diagnostics] Failed to fetch assistant mappings', {
        org_id: orgId,
        error: mappingsError.message
      });
      // Continue without mappings (non-critical)
    }

    // 4. Count agents by role
    const agentCounts = agents.reduce((acc, agent) => {
      acc[agent.role] = (acc[agent.role] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // 5. Identify issues
    const issues: string[] = [];

    // Check for multiple inbound/outbound agents
    if (agentCounts.inbound > 1) {
      issues.push(`Multiple inbound agents found (${agentCounts.inbound}). Only the most recent active one will be used.`);
    }
    if (agentCounts.outbound > 1) {
      issues.push(`Multiple outbound agents found (${agentCounts.outbound}). Only the most recent active one will be used.`);
    }

    // Check for agents missing vapi_assistant_id
    agents
      .filter(a => !a.vapi_assistant_id)
      .forEach(a => {
        issues.push(`Agent ${a.id} (${a.role}) missing vapi_assistant_id - needs to be saved in Agent Configuration`);
      });

    // Check for agents missing required config
    agents.forEach(a => {
      if (!a.system_prompt) {
        issues.push(`Agent ${a.id} (${a.role}) missing system_prompt`);
      }
      if (!a.first_message) {
        issues.push(`Agent ${a.id} (${a.role}) missing first_message`);
      }
      if (!a.voice) {
        issues.push(`Agent ${a.id} (${a.role}) missing voice configuration`);
      }
    });

    // 6. Prepare response with detailed agent info (sensitive data redacted for security)
    const sanitizedAgents = agents.map(agent => ({
      id: agent.id,
      role: agent.role,
      name: agent.name,
      vapi_assistant_id: agent.vapi_assistant_id || null,
      vapi_phone_number_id: agent.vapi_phone_number_id || null,
      voice: agent.voice,
      voice_provider: agent.voice_provider,
      active: agent.active,
      created_at: agent.created_at,
      updated_at: agent.updated_at,
      has_system_prompt: !!agent.system_prompt,
      has_first_message: !!agent.first_message,
      system_prompt_length: agent.system_prompt?.length || 0,
      first_message_preview: agent.first_message?.substring(0, 80) || 'N/A'
    }));

    logger.info('[Agent Diagnostics] Diagnostic complete', {
      org_id: orgId,
      total_agents: agents.length,
      agent_counts: agentCounts,
      issues_count: issues.length
    });

    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      org: {
        id: org.id,
        name: org.name,
        email: org.email,
        vapi_assistant_id: org.vapi_assistant_id || null,
        vapi_phone_number_id: org.vapi_phone_number_id || null
      },
      agents: sanitizedAgents,
      mappings: mappings || [],
      agentCounts,
      issues,
      recommendations: generateRecommendations(agents, agentCounts, issues)
    });
  } catch (error: any) {
    logger.error('[Agent Diagnostics] Unexpected error', {
      org_id: req.params.orgId,
      error: error.message,
      stack: error.stack
    });
    return res.status(500).json({ error: 'Internal server error during diagnostics' });
  }
});

/**
 * Generate actionable recommendations based on agent configuration state
 */
function generateRecommendations(
  agents: any[],
  agentCounts: Record<string, number>,
  issues: string[]
): string[] {
  const recommendations: string[] = [];

  // No inbound agent
  if (!agentCounts.inbound || agentCounts.inbound === 0) {
    recommendations.push('Configure an inbound agent in Agent Configuration to enable browser test.');
  }

  // No outbound agent
  if (!agentCounts.outbound || agentCounts.outbound === 0) {
    recommendations.push('Configure an outbound agent in Agent Configuration to enable live call test.');
  }

  // Multiple agents of same role
  if (agentCounts.inbound > 1) {
    recommendations.push('Consider marking old inbound agents as inactive (active=false) or deleting them to avoid confusion.');
  }
  if (agentCounts.outbound > 1) {
    recommendations.push('Consider marking old outbound agents as inactive (active=false) or deleting them to avoid confusion.');
  }

  // Missing vapi_assistant_id
  const missingAssistantId = agents.filter(a => !a.vapi_assistant_id);
  if (missingAssistantId.length > 0) {
    recommendations.push(`${missingAssistantId.length} agent(s) missing vapi_assistant_id. Re-save these agents in Agent Configuration to sync with Vapi.`);
  }

  // Missing critical config
  const incompleteConfig = agents.filter(a => !a.system_prompt || !a.first_message || !a.voice);
  if (incompleteConfig.length > 0) {
    recommendations.push(`${incompleteConfig.length} agent(s) have incomplete configuration. Ensure all required fields are filled.`);
  }

  // All clear
  if (issues.length === 0 && recommendations.length === 0) {
    recommendations.push('✅ All agent configurations look good! No issues detected.');
  }

  return recommendations;
}

export default router;
