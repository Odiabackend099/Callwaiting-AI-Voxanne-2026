import express, { Request, Response } from 'express';
import { VapiClient } from '../services/vapi-client';
import { supabase } from '../services/supabase-client';
import { requireAuth } from '../middleware/auth';

export const assistantsRouter = express.Router();

function getVapiClient(): VapiClient | null {
  const vapiApiKey = process.env.VAPI_API_KEY;
  if (!vapiApiKey) {
    return null;
  }

  return new VapiClient(vapiApiKey);
}

function requireVapi(res: Response): VapiClient | null {
  const client = getVapiClient();
  if (!client) {
    res.status(503).json({
      error: 'Vapi not configured',
      message: 'Missing VAPI_API_KEY environment variable'
    });
    return null;
  }

  return client;
}

// Helper to determine voice provider from voice ID (case-insensitive)
function determineVoiceProvider(voiceId: string): string {
  const id = (voiceId || '').toLowerCase();

  // Deepgram voices start with 'aura-'
  if (id.startsWith('aura-')) return 'deepgram';

  // OpenAI voices
  if (['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'].includes(id)) return 'openai';

  // Vapi native voices (case-insensitive)
  const vapiVoices = ['paige', 'rohan', 'neha', 'hana', 'harry', 'elliot', 'lily', 'cole', 'savannah', 'spencer', 'kylie'];
  if (vapiVoices.includes(id)) return 'vapi';

  // ElevenLabs voices (most other named voices)
  const elevenLabsVoices = [
    'rachel', 'drew', 'clyde', 'paul', 'domi', 'dave', 'fin', 'sarah', 'antoni', 'thomas',
    'charlie', 'george', 'emily', 'elli', 'callum', 'patrick', 'liam', 'dorothy', 'josh',
    'arnold', 'charlotte', 'matilda', 'matthew', 'james', 'joseph', 'jeremy', 'michael',
    'ethan', 'gigi', 'freya', 'grace', 'daniel', 'serena', 'adam', 'nicole', 'jessie',
    'ryan', 'sam', 'glinda', 'giovanni', 'mimi'
  ];
  if (elevenLabsVoices.includes(id)) return 'elevenlabs';

  // Default to vapi for unknown voices
  return 'vapi';
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
// SECURITY FIX: Added requireAuth
assistantsRouter.post('/sync', requireAuth, async (req: Request, res: Response): Promise<void> => {
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
    // =================================================================
    // PLATFORM VAPI CLIENT INIT
    // Use system API Key for all tenants
    // =================================================================
    const dynamicApiKey = process.env.VAPI_API_KEY;

    if (!dynamicApiKey) {
      res.status(500).json({ error: 'System Error: VAPI_API_KEY missing in environment' });
      return;
    }

    const localVapi = new VapiClient(dynamicApiKey);
    // =================================================================

    // Build context with knowledge bases
    const fullContext = await buildAgentContext(agent);

    let vapiAssistant;

    if (agent.vapi_assistant_id) {
      // Update existing assistant in Vapi
      const { createLogger } = await import('../services/logger');
      const logger = createLogger('AssistantsSync');
      logger.info('Updating existing Vapi assistant', { agentId, vapiAssistantId: agent.vapi_assistant_id });

      // Determine voice provider from agent voice configuration
      const voiceId = agent.voice || 'paige';
      const voiceProvider = determineVoiceProvider(voiceId);

      // CRITICAL: Fetch existing assistant to preserve query tools
      let existingAssistant;
      try {
        existingAssistant = await localVapi.getAssistant(agent.vapi_assistant_id);
      } catch (err: any) {
        logger.warn('Could not fetch existing assistant, will proceed without tool merging', {
          error: err?.message
        });
      }

      // Preserve query-type tools (Knowledge Base) while updating server tools
      const existingTools = existingAssistant?.tools || [];
      const queryTools = existingTools.filter((t: any) => t.type === 'query');
      const demoTools = localVapi.getDefaultDemoTools(); // Modern server tools
      const mergedTools = [...queryTools, ...demoTools];

      logger.info('Merging tools', {
        queryToolsCount: queryTools.length,
        demoToolsCount: demoTools.length,
        totalTools: mergedTools.length
      });

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
        firstMessage: agent.first_message || 'Hello! How can I help you today?',
        transcriber: {
          provider: 'deepgram',
          model: 'nova-2',
          language: agent.language || 'en'
        },
        maxDurationSeconds: agent.max_call_duration || 600
        // CRITICAL: Vapi requires toolIds array, NOT tools objects
        // Tools must be created separately via /tool endpoint, then referenced by ID
      });

      // After update, merge toolIds separately if needed
      // For now, tools are managed via Knowledge Base sync - no demo tools on update
      // Demo tools would need to be created via /tool endpoint first, then IDs merged here

    } else {
      // Create new assistant in Vapi
      const { createLogger } = await import('../services/logger');
      const logger = createLogger('AssistantsSync');
      logger.info('Creating new Vapi assistant', { agentId, agentName: agent.name });

      const voiceId = agent.voice || 'paige';
      const voiceProvider = determineVoiceProvider(voiceId);

      vapiAssistant = await localVapi.createAssistant({
        name: agent.name,
        systemPrompt: fullContext,
        voiceProvider: voiceProvider,
        voiceId: voiceId,
        firstMessage: agent.first_message || 'Hello! How can I help you today?'
        // CRITICAL: Do NOT send tools array - Vapi rejects it
        // Tools must be created separately and managed via toolIds
      });


      // Store Vapi ID in Supabase
      const { error: updateError } = await supabase
        .from('agents')
        .update({ vapi_assistant_id: vapiAssistant.id })
        .eq('id', agentId);

      if (updateError) {
        const { createLogger } = await import('../services/logger');
        const logger = createLogger('AssistantsSync');
        logger.error('Failed to store Vapi ID', { agentId, error: updateError.message });
      } else {
        const { createLogger } = await import('../services/logger');
        const logger = createLogger('AssistantsSync');
        logger.info('Stored Vapi ID', { agentId, vapiAssistantId: vapiAssistant.id });
      }
    }

    res.json({
      success: true,
      id: vapiAssistant.id,
      name: vapiAssistant.name,
      message: 'Agent synced to Vapi successfully with knowledge base'
    });
  } catch (error: any) {
    const { createLogger } = await import('../services/logger');
    const logger = createLogger('AssistantsSync');
    logger.error('Sync failed', { error: error?.message, details: error?.response?.data });
    res.status(500).json({
      error: error?.response?.data?.message || error.message || 'Failed to sync assistant'
    });
  }
});

// Get assistant details
// SECURITY FIX: Added requireAuth
assistantsRouter.get('/:assistantId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { assistantId } = req.params;

    const vapi = requireVapi(res);
    if (!vapi) return;

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
// SECURITY FIX: Added requireAuth
assistantsRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const vapi = requireVapi(res);
    if (!vapi) return;

    try {
      const assistants = await vapi.listAssistants();
      res.json(assistants);
    } catch (vapiError: any) {
      // If Vapi fails, return empty list instead of 500 error
      // This prevents cascading failures under load
      console.warn('[GET /assistants] Vapi unavailable, returning empty list:', vapiError.message);
      res.json({ assistants: [] });
    }
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
    // Comprehensive list of Vapi-supported voices
    const voices = [
      // Vapi Native Voices (11Labs-powered, optimized for low latency)
      { id: 'Paige', name: 'Paige', gender: 'female', provider: 'vapi', isDefault: true, description: 'Warm, professional American female' },
      { id: 'Rohan', name: 'Rohan', gender: 'male', provider: 'vapi', description: 'Friendly American male' },
      { id: 'Neha', name: 'Neha', gender: 'female', provider: 'vapi', description: 'Clear, articulate Indian female' },
      { id: 'Hana', name: 'Hana', gender: 'female', provider: 'vapi', description: 'Soft, calm Asian female' },
      { id: 'Harry', name: 'Harry', gender: 'male', provider: 'vapi', description: 'British male, professional' },
      { id: 'Elliot', name: 'Elliot', gender: 'male', provider: 'vapi', description: 'Young American male' },
      { id: 'Lily', name: 'Lily', gender: 'female', provider: 'vapi', description: 'Cheerful American female' },
      { id: 'Cole', name: 'Cole', gender: 'male', provider: 'vapi', description: 'Deep, authoritative male' },
      { id: 'Savannah', name: 'Savannah', gender: 'female', provider: 'vapi', description: 'Southern American female' },
      { id: 'Spencer', name: 'Spencer', gender: 'male', provider: 'vapi', description: 'Casual American male' },
      { id: 'Kylie', name: 'Kylie', gender: 'female', provider: 'vapi', description: 'Australian female' },

      // ElevenLabs Voices
      { id: 'rachel', name: 'Rachel', gender: 'female', provider: 'elevenlabs', description: 'American female, calm' },
      { id: 'drew', name: 'Drew', gender: 'male', provider: 'elevenlabs', description: 'American male, well-rounded' },
      { id: 'clyde', name: 'Clyde', gender: 'male', provider: 'elevenlabs', description: 'American male, war veteran' },
      { id: 'paul', name: 'Paul', gender: 'male', provider: 'elevenlabs', description: 'American male, ground reporter' },
      { id: 'domi', name: 'Domi', gender: 'female', provider: 'elevenlabs', description: 'American female, strong' },
      { id: 'dave', name: 'Dave', gender: 'male', provider: 'elevenlabs', description: 'British-Essex male, conversational' },
      { id: 'fin', name: 'Fin', gender: 'male', provider: 'elevenlabs', description: 'Irish male, sailor' },
      { id: 'sarah', name: 'Sarah', gender: 'female', provider: 'elevenlabs', description: 'American female, soft news' },
      { id: 'antoni', name: 'Antoni', gender: 'male', provider: 'elevenlabs', description: 'American male, well-rounded' },
      { id: 'thomas', name: 'Thomas', gender: 'male', provider: 'elevenlabs', description: 'American male, calm' },
      { id: 'charlie', name: 'Charlie', gender: 'male', provider: 'elevenlabs', description: 'Australian male, casual' },
      { id: 'george', name: 'George', gender: 'male', provider: 'elevenlabs', description: 'British male, warm' },
      { id: 'emily', name: 'Emily', gender: 'female', provider: 'elevenlabs', description: 'American female, calm' },
      { id: 'elli', name: 'Elli', gender: 'female', provider: 'elevenlabs', description: 'American female, emotional' },
      { id: 'callum', name: 'Callum', gender: 'male', provider: 'elevenlabs', description: 'Transatlantic male, intense' },
      { id: 'patrick', name: 'Patrick', gender: 'male', provider: 'elevenlabs', description: 'American male, shouty' },
      { id: 'harry', name: 'Harry (ElevenLabs)', gender: 'male', provider: 'elevenlabs', description: 'American male, anxious' },
      { id: 'liam', name: 'Liam', gender: 'male', provider: 'elevenlabs', description: 'American male, articulate' },
      { id: 'dorothy', name: 'Dorothy', gender: 'female', provider: 'elevenlabs', description: 'British female, pleasant' },
      { id: 'josh', name: 'Josh', gender: 'male', provider: 'elevenlabs', description: 'American male, deep' },
      { id: 'arnold', name: 'Arnold', gender: 'male', provider: 'elevenlabs', description: 'American male, crisp' },
      { id: 'charlotte', name: 'Charlotte', gender: 'female', provider: 'elevenlabs', description: 'Swedish female, seductive' },
      { id: 'matilda', name: 'Matilda', gender: 'female', provider: 'elevenlabs', description: 'American female, warm' },
      { id: 'matthew', name: 'Matthew', gender: 'male', provider: 'elevenlabs', description: 'British male, audiobook' },
      { id: 'james', name: 'James', gender: 'male', provider: 'elevenlabs', description: 'Australian male, calm' },
      { id: 'joseph', name: 'Joseph', gender: 'male', provider: 'elevenlabs', description: 'British male, articulate' },
      { id: 'jeremy', name: 'Jeremy', gender: 'male', provider: 'elevenlabs', description: 'American-Irish male, excited' },
      { id: 'michael', name: 'Michael', gender: 'male', provider: 'elevenlabs', description: 'American male, orotund' },
      { id: 'ethan', name: 'Ethan', gender: 'male', provider: 'elevenlabs', description: 'American male, narrator' },
      { id: 'gigi', name: 'Gigi', gender: 'female', provider: 'elevenlabs', description: 'American female, childish' },
      { id: 'freya', name: 'Freya', gender: 'female', provider: 'elevenlabs', description: 'American female, expressive' },
      { id: 'grace', name: 'Grace', gender: 'female', provider: 'elevenlabs', description: 'American-Southern female' },
      { id: 'daniel', name: 'Daniel', gender: 'male', provider: 'elevenlabs', description: 'British male, deep news' },
      { id: 'serena', name: 'Serena', gender: 'female', provider: 'elevenlabs', description: 'American female, pleasant' },
      { id: 'adam', name: 'Adam', gender: 'male', provider: 'elevenlabs', description: 'American male, deep' },
      { id: 'nicole', name: 'Nicole', gender: 'female', provider: 'elevenlabs', description: 'American female, whisper' },
      { id: 'jessie', name: 'Jessie', gender: 'male', provider: 'elevenlabs', description: 'American male, raspy' },
      { id: 'ryan', name: 'Ryan', gender: 'male', provider: 'elevenlabs', description: 'American male, soldier' },
      { id: 'sam', name: 'Sam', gender: 'male', provider: 'elevenlabs', description: 'American male, raspy' },
      { id: 'glinda', name: 'Glinda', gender: 'female', provider: 'elevenlabs', description: 'American female, witch' },
      { id: 'giovanni', name: 'Giovanni', gender: 'male', provider: 'elevenlabs', description: 'English-Italian male, foreigner' },
      { id: 'mimi', name: 'Mimi', gender: 'female', provider: 'elevenlabs', description: 'Swedish female, childish' },

      // OpenAI Voices
      { id: 'alloy', name: 'Alloy', gender: 'neutral', provider: 'openai', description: 'Neutral, balanced' },
      { id: 'echo', name: 'Echo', gender: 'male', provider: 'openai', description: 'Male, clear' },
      { id: 'fable', name: 'Fable', gender: 'neutral', provider: 'openai', description: 'Expressive, storytelling' },
      { id: 'onyx', name: 'Onyx', gender: 'male', provider: 'openai', description: 'Deep, authoritative' },
      { id: 'nova', name: 'Nova', gender: 'female', provider: 'openai', description: 'Female, warm' },
      { id: 'shimmer', name: 'Shimmer', gender: 'female', provider: 'openai', description: 'Female, soft' },

      // Deepgram Aura Voices
      { id: 'aura-asteria-en', name: 'Asteria', gender: 'female', provider: 'deepgram', description: 'American female, professional' },
      { id: 'aura-luna-en', name: 'Luna', gender: 'female', provider: 'deepgram', description: 'American female, warm' },
      { id: 'aura-stella-en', name: 'Stella', gender: 'female', provider: 'deepgram', description: 'American female, calm' },
      { id: 'aura-athena-en', name: 'Athena', gender: 'female', provider: 'deepgram', description: 'British female, professional' },
      { id: 'aura-hera-en', name: 'Hera', gender: 'female', provider: 'deepgram', description: 'American female, mature' },
      { id: 'aura-orion-en', name: 'Orion', gender: 'male', provider: 'deepgram', description: 'American male, professional' },
      { id: 'aura-arcas-en', name: 'Arcas', gender: 'male', provider: 'deepgram', description: 'American male, conversational' },
      { id: 'aura-perseus-en', name: 'Perseus', gender: 'male', provider: 'deepgram', description: 'American male, deep' },
      { id: 'aura-angus-en', name: 'Angus', gender: 'male', provider: 'deepgram', description: 'Irish male, friendly' },
      { id: 'aura-orpheus-en', name: 'Orpheus', gender: 'male', provider: 'deepgram', description: 'American male, warm' },
      { id: 'aura-helios-en', name: 'Helios', gender: 'male', provider: 'deepgram', description: 'British male, professional' },
      { id: 'aura-zeus-en', name: 'Zeus', gender: 'male', provider: 'deepgram', description: 'American male, authoritative' }
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
// SECURITY FIX: Added requireAuth
assistantsRouter.post('/auto-sync', requireAuth, async (req: Request, res: Response): Promise<void> => {
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
    // 2. Get VAPI API key (Platform Mode)
    const apiKey = process.env.VAPI_API_KEY;
    if (!apiKey) throw new Error('System Error: VAPI_API_KEY missing');

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
      // CRITICAL: Preserve query tools when updating
      let existingAssistant;
      try {
        existingAssistant = await client.getAssistant(agent.vapi_assistant_id);
      } catch (err: any) {
        console.warn('[auto-sync] Could not fetch existing assistant', { error: err?.message });
      }

      // If updating tools, merge with existing query tools
      if (vapiUpdates.tools || Object.keys(vapiUpdates).length === 0) {
        const existingTools = existingAssistant?.tools || [];
        const queryTools = existingTools.filter((t: any) => t.type === 'query');
        const demoTools = client.getDefaultDemoTools();
        vapiUpdates.tools = [...queryTools, ...demoTools];
      }

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
        firstMessage: agent.first_message,
        tools: client.getDefaultDemoTools() // Use modern tools
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

/**
 * POST /api/assistants/:assistantId/setup-booking
 * 
 * CRITICAL: Set up an agent for LIVE APPOINTMENT BOOKING
 * 
 * This endpoint:
 * 1. Loads the booking agent setup service
 * 2. Generates system prompt with temporal context + tool instructions
 * 3. Wires appointment booking tools (check_availability, reserve_slot, send_sms_reminder)
 * 4. Updates the agent in Vapi
 * 5. Returns status: ready for testing
 * 
 * @param assistantId - The Vapi assistant ID
 * @param tenantId - The organization ID (from query param or body)
 */
// SECURITY FIX: Added requireAuth
assistantsRouter.post('/:assistantId/setup-booking', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { assistantId } = req.params;
    const { tenantId } = req.body || req.query;

    if (!assistantId || !tenantId) {
      res.status(400).json({
        error: 'Missing required parameters',
        required: ['assistantId (URL param)', 'tenantId (body or query)']
      });
      return;
    }

    console.log('[POST /assistants/:id/setup-booking] Setting up booking for agent', {
      assistantId,
      tenantId
    });

    // Load the booking setup service
    const { createBookingAgentSetup } = await import('../services/booking-agent-setup');
    const bookingSetup = createBookingAgentSetup();

    // Get webhook base URL from environment
    const baseUrl = process.env.RENDER_EXTERNAL_URL || process.env.BASE_URL || 'https://api.example.com';

    // Set up the booking agent
    const updatedAssistant = await bookingSetup.setupBookingAgent(assistantId, tenantId, baseUrl);

    // Get current status
    const status = await bookingSetup.getBookingAgentStatus(assistantId);

    console.log('[POST /assistants/:id/setup-booking] Successfully set up booking', {
      assistantId,
      tenantId,
      ready: status.ready,
      toolCount: status.toolCount
    });

    res.json({
      success: true,
      assistantId,
      tenantId,
      message: 'Appointment booking agent successfully configured',
      status: {
        ready: status.ready,
        toolCount: status.toolCount,
        hasBookingTools: status.hasBookingTools,
        hasBookingSystemPrompt: status.hasBookingSystemPrompt,
        tools: status.tools
      },
      nextSteps: [
        '✅ System prompt updated with booking instructions',
        '✅ Tools wired: check_availability, reserve_slot, send_sms_reminder',
        '🔧 Test: Call the agent and request an appointment',
        '✅ Expected: Agent will check availability, hold slot, send SMS'
      ]
    });
  } catch (error: any) {
    console.error('[POST /assistants/:id/setup-booking] Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to set up booking agent',
      details: error.response?.data || undefined
    });
  }
});

/**
 * GET /api/assistants/:assistantId/booking-status
 * 
 * Check if an agent is ready for appointment booking
 * Returns: tool count, system prompt info, ready status
 */
// SECURITY FIX: Added requireAuth
assistantsRouter.get('/:assistantId/booking-status', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { assistantId } = req.params;

    const { createBookingAgentSetup } = await import('../services/booking-agent-setup');
    const bookingSetup = createBookingAgentSetup();

    const status = await bookingSetup.getBookingAgentStatus(assistantId);

    res.json({
      assistantId,
      ready: status.ready,
      status
    });
  } catch (error: any) {
    console.error('[GET /assistants/:id/booking-status] Error:', error.message);
    res.status(500).json({
      error: error.message || 'Failed to get booking status'
    });
  }
});

export default assistantsRouter;
