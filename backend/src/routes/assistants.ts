import express, { Request, Response } from 'express';
import { VapiClient } from '../services/vapi-client';
import { supabase } from '../services/supabase-client';

export const assistantsRouter = express.Router();

const vapiApiKey = process.env.VAPI_API_KEY;
if (!vapiApiKey) {
  throw new Error('Missing VAPI_API_KEY environment variable');
}

const vapi = new VapiClient(vapiApiKey);

// Helper to determine voice provider from voice ID (case-insensitive)
function determineVoiceProvider(voiceId: string): string {
  const voiceProviderMap: { [key: string]: string } = {
    'rohan': 'vapi',
    'neha': 'vapi',
    'hana': 'vapi',
    'harry': 'vapi',
    'elliot': 'vapi',
    'lily': 'vapi',
    'paige': 'vapi',
    'cole': 'vapi',
    'savannah': 'vapi',
    'spencer': 'vapi',
    'kylie': 'vapi',
    'jennifer': 'playht',
    'alloy': 'openai',
    'aura-asteria-en': 'deepgram',
    'aura-luna-en': 'deepgram'
  };
  return voiceProviderMap[(voiceId || '').toLowerCase()] || 'vapi';
}

// ============================================
// KNOWLEDGE BASE INTEGRATION
// ============================================

interface AgentKnowledgeConfig {
  inbound: string[];
  outbound: string[];
}

// Define priority order for knowledge base categories by agent role
const knowledgeBasePriority: AgentKnowledgeConfig = {
  inbound: [
    'ai_guidelines',
    'compliance_legal',
    'operations',
    'features',
    'products_services',
    'pricing',
    'company_info',
    'team',
    'dashboard_config'
  ],
  outbound: [
    'ai_guidelines',
    'pricing',
    'products_services',
    'features',
    'company_info',
    'team',
    'compliance_legal',
    'operations',
    'dashboard_config'
  ]
};

/**
 * Build agent context by concatenating system prompt with knowledge bases
 * Respects token limits by loading in priority order
 */
async function buildAgentContext(agent: any): Promise<string> {
  // Start with system prompt
  let context = agent.system_prompt || '';

  // Determine agent role (default to inbound)
  const agentRole = agent.role || 'inbound';
  const priorityOrder = knowledgeBasePriority[agentRole as keyof AgentKnowledgeConfig] ||
    knowledgeBasePriority.inbound;

  try {
    // Get all active knowledge bases for this organization
    const { data: allKbs, error: kbError } = await supabase
      .from('knowledge_base')
      .select('id, filename, content, category')
      .eq('org_id', agent.org_id)
      .eq('active', true);

    if (kbError) {
      console.error('Error fetching knowledge bases:', kbError);
      return context;
    }

    if (!allKbs || allKbs.length === 0) {
      console.log('No knowledge bases found for agent');
      return context;
    }

    // Group by category
    const kbsByCategory: { [key: string]: any[] } = {};
    allKbs.forEach(kb => {
      if (!kbsByCategory[kb.category]) {
        kbsByCategory[kb.category] = [];
      }
      kbsByCategory[kb.category].push(kb);
    });

    // Add knowledge bases in priority order (respecting token limits)
    const maxTokens = 100000; // Vapi/Groq limit
    const estimatedTokensPerChar = 0.25; // Rough estimate
    let currentTokenCount = (context.length * estimatedTokensPerChar);
    const tokenBuffer = 5000; // Reserve 5k tokens for conversation history
    const availableTokens = maxTokens - tokenBuffer - currentTokenCount;

    // If we've already blown through the budget with the base prompt, skip KBs
    if (availableTokens <= 0) {
      console.warn('[buildAgentContext] No available tokens for knowledge bases, returning base system prompt only');
      return context;
    }

    console.log(`[buildAgentContext] Agent: ${agent.name}, Role: ${agentRole}`);
    console.log(`[buildAgentContext] Current tokens: ${Math.round(currentTokenCount)}, Available: ${Math.round(availableTokens)}`);

    for (const category of priorityOrder) {
      const kbsInCategory = kbsByCategory[category] || [];

      if (kbsInCategory.length === 0) {
        continue;
      }

      // Calculate size of this category
      const categoryContent = kbsInCategory.map(kb => kb.content).join('\n\n');
      const categoryTokens = categoryContent.length * estimatedTokensPerChar;

      if (currentTokenCount + categoryTokens > availableTokens) {
        console.warn(`[buildAgentContext] Token limit approaching. Skipping category: ${category}`);
        console.warn(`  Current: ${Math.round(currentTokenCount)}, Would add: ${Math.round(categoryTokens)}, Available: ${Math.round(availableTokens)}`);
        continue;
      }

      // Add category header and content
      context += `\n\n## ${category.toUpperCase()}\n${categoryContent}`;
      currentTokenCount += categoryTokens;

      console.log(`[buildAgentContext] Added ${category}: ${kbsInCategory.length} documents, +${Math.round(categoryTokens)} tokens`);
    }

    console.log(`[buildAgentContext] Final token count: ${Math.round(currentTokenCount)}`);
  } catch (error) {
    console.error('Error building knowledge context:', error);
  }

  return context;
}

// Sync database agent to Vapi (create or update)
assistantsRouter.post('/sync', async (req: Request, res: Response): Promise<void> => {
  try {
    const { agentId } = req.body;

    if (!agentId) {
      res.status(400).json({ error: 'Missing agentId' });
      return;
    }

    // Get agent from Supabase
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .single();

    if (agentError || !agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    // =================================================================
    // DYNAMIC VAPI CLIENT INIT
    // Fetch the correct Vapi API Key from DB (Integrations table)
    // to ensure we create the assistant in the SAME account that calls it.
    // =================================================================
    const { data: vapiIntegration } = await supabase
      .from('integrations')
      .select('config')
      .eq('provider', 'vapi')
      .limit(1)
      .single();

    const dynamicApiKey = vapiIntegration?.config?.vapi_api_key || process.env.VAPI_API_KEY;

    if (!dynamicApiKey) {
      res.status(500).json({ error: 'Vapi API Key not configured in Integrations or Environment' });
      return;
    }

    const localVapi = new VapiClient(dynamicApiKey);
    // =================================================================

    // Build context with knowledge bases
    const fullContext = await buildAgentContext(agent);

    let vapiAssistant;

    if (agent.vapi_assistant_id) {
      // Update existing assistant in Vapi
      console.log('[POST /assistants/sync] Updating existing Vapi assistant:', agent.vapi_assistant_id);

      // Determine voice provider from agent voice configuration
      const voiceId = agent.voice || 'paige';
      const voiceProvider = determineVoiceProvider(voiceId);

      vapiAssistant = await localVapi.updateAssistant(agent.vapi_assistant_id, {
        name: agent.name,
        model: {
          provider: 'openai',
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: fullContext
            }
          ]
        },
        voice: {
          provider: voiceProvider,
          voiceId: voiceId
        },
        functions: localVapi.getDefaultDemoFunctions()
      });
    } else {
      // Create new assistant in Vapi
      console.log('[POST /assistants/sync] Creating new Vapi assistant:', agent.name);

      const voiceId = agent.voice || 'paige';
      const voiceProvider = determineVoiceProvider(voiceId);

      vapiAssistant = await localVapi.createAssistant({
        name: agent.name,
        systemPrompt: fullContext,
        voiceProvider: voiceProvider,
        voiceId: voiceId,
        firstMessage: agent.first_message || 'Hello! How can I help you today?'
      });

      // Store Vapi ID in Supabase
      const { error: updateError } = await supabase
        .from('agents')
        .update({ vapi_assistant_id: vapiAssistant.id })
        .eq('id', agentId);

      if (updateError) {
        console.error('[POST /assistants/sync] Failed to store Vapi ID:', updateError);
      } else {
        console.log('[POST /assistants/sync] Stored Vapi ID:', vapiAssistant.id);
      }
    }

    res.json({
      success: true,
      id: vapiAssistant.id,
      name: vapiAssistant.name,
      message: 'Agent synced to Vapi successfully with knowledge base'
    });
  } catch (error: any) {
    console.error('[POST /assistants/sync] Error:', error?.response?.data || error.message);
    res.status(500).json({
      error: error?.response?.data?.message || error.message || 'Failed to sync assistant'
    });
  }
});

// Get assistant details
assistantsRouter.get('/:assistantId', async (req: Request, res: Response) => {
  try {
    const { assistantId } = req.params;

    const assistant = await vapi.getAssistant(assistantId);
    res.json(assistant);
  } catch (error: any) {
    console.error('[GET /assistants/:id] Error:', error.message);
    res.status(500).json({
      error: error.message || 'Failed to fetch assistant'
    });
  }
});

// List assistants
assistantsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const assistants = await vapi.listAssistants();
    res.json(assistants);
  } catch (error: any) {
    console.error('[GET /assistants] Error:', error.message);
    res.status(500).json({
      error: error.message || 'Failed to list assistants'
    });
  }
});

// List available voices
assistantsRouter.get('/voices/available', async (req: Request, res: Response) => {
  try {
    // Return curated list of available voices
    const voices = [
      { id: 'rohan', name: 'Rohan', gender: 'male', provider: 'vapi' },
      { id: 'neha', name: 'Neha', gender: 'female', provider: 'vapi' },
      { id: 'hana', name: 'Hana', gender: 'female', provider: 'vapi' },
      { id: 'harry', name: 'Harry', gender: 'male', provider: 'vapi' },
      { id: 'elliot', name: 'Elliot', gender: 'male', provider: 'vapi' },
      { id: 'lily', name: 'Lily', gender: 'female', provider: 'vapi' },
      { id: 'paige', name: 'Paige', gender: 'female', provider: 'vapi', isDefault: true },
      { id: 'cole', name: 'Cole', gender: 'male', provider: 'vapi' },
      { id: 'savannah', name: 'Savannah', gender: 'female', provider: 'vapi' },
      { id: 'spencer', name: 'Spencer', gender: 'male', provider: 'vapi' }
    ];

    res.json(voices);
  } catch (error: any) {
    console.error('[GET /assistants/voices/available] Error:', error.message);
    res.status(500).json({
      error: error.message || 'Failed to list voices'
    });
  }
});

// Auto-sync partial updates
assistantsRouter.post('/auto-sync', async (req: Request, res: Response): Promise<void> => {
  const { agentId, updates } = req.body;
  // updates = { name?, systemPrompt?, voice?, firstMessage? }

  try {
    // 1. Update local database
    const { data: agent, error: dbError } = await supabase
      .from('agents')
      .update({
        ...updates,
        sync_status: 'syncing',
        // updated_at: new Date().toISOString() // Assuming updated_at exists or is handled by trigger
      })
      .eq('id', agentId)
      .select()
      .single();

    if (dbError) throw dbError;

    // 2. Get VAPI API key (using fallback to env for now if not in integrations)
    // In production we should prioritize the integration key
    const { data: integration } = await supabase
      .from('integrations')
      .select('config')
      .eq('org_id', agent.org_id)
      .eq('provider', 'vapi')
      .single();

    const apiKey = integration?.config?.vapi_api_key || process.env.VAPI_API_KEY;
    if (!apiKey) throw new Error('No VAPI API key configured');

    const client = new VapiClient(apiKey);

    // 3. Build VAPI update payload
    const vapiUpdates: any = {};
    if (updates.name) vapiUpdates.name = updates.name;
    if (updates.firstMessage) vapiUpdates.firstMessage = updates.firstMessage;

    if (updates.systemPrompt) {
      // Rebuild context with KB
      const context = await buildAgentContext(agent);
      vapiUpdates.model = {
        provider: 'openai',
        model: 'gpt-4',
        messages: [{ role: 'system', content: context }]
      };
    }

    if (updates.voice) {
      const provider = determineVoiceProvider(updates.voice);
      vapiUpdates.voice = {
        provider,
        voiceId: updates.voice
      };
    }

    // 4. Sync to VAPI
    if (agent.vapi_assistant_id) {
      await client.updateAssistant(agent.vapi_assistant_id, vapiUpdates);
    } else {
      // Create if doesn't exist
      const context = await buildAgentContext(agent);
      const voiceId = agent.voice || 'paige';
      const voiceProvider = determineVoiceProvider(voiceId);
      const newAssistant = await client.createAssistant({
        name: agent.name,
        systemPrompt: context,
        voiceProvider,
        voiceId,
        firstMessage: agent.first_message
      });

      await supabase
        .from('agents')
        .update({ vapi_assistant_id: newAssistant.id })
        .eq('id', agentId);
    }

    // 5. Mark as synced
    await supabase
      .from('agents')
      .update({
        sync_status: 'synced',
        last_synced_at: new Date().toISOString(),
        sync_error: null
      })
      .eq('id', agentId);

    res.json({ success: true, status: 'synced' });

  } catch (error: any) {
    // Mark as failed
    await supabase
      .from('agents')
      .update({
        sync_status: 'failed',
        sync_error: error.message
      })
      .eq('id', agentId);

    console.error('[POST /assistants/auto-sync] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default assistantsRouter;
