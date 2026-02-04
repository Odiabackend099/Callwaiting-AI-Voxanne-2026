/**
 * VapiAssistantManager Service
 *
 * Implements idempotent assistant creation/updating with check-then-upsert pattern.
 * This ensures:
 * 1. No duplicate assistants are created
 * 2. Changes to prompts are immediately pushed (PATCH not POST)
 * 3. Deleted assistants are recreated automatically
 * 4. Clean Vapi dashboard with exactly 2N assistants (N = number of orgs)
 */

import { VapiClient } from './vapi-client';
import { IntegrationDecryptor } from './integration-decryptor';
import { IntegrationSettingsService } from './integration-settings'; // Use Settings Service for fallback support
import { enhanceSystemPrompt } from './prompt-injector';
import { ToolSyncService } from './tool-sync-service';
import { getSuperSystemPrompt, getTemporalContext } from './super-system-prompt';
import { resolveBackendUrl } from '../utils/resolve-backend-url';
import { createClient } from '@supabase/supabase-js';
import { log } from './logger';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
    },
  }
);

// ============================================
// Type Definitions
// ============================================

export interface AssistantConfig {
  name: string;
  systemPrompt: string;
  firstMessage?: string;
  voiceId?: string;
  voiceProvider?: string;
  modelProvider?: string;
  modelName?: string;
  language?: string;
  maxDurationSeconds?: number;
  serverUrl?: string;
  serverMessages?: any[];
  transcriber?: any;
  functions?: any[];
}

export interface EnsureAssistantResult {
  assistantId: string;
  isNew: boolean;
  wasDeleted: boolean;
}

// ============================================
// VapiAssistantManager Class
// ============================================

export class VapiAssistantManager {
  /**
   * Helper to resolve voice configuration using voice registry SSOT
   *
   * Handles:
   * - Valid active voices → Pass through with provider from voice registry
   * - Invalid voice/provider combinations → Falls back to Rohan (default Vapi native)
   * - Empty voice IDs → Defaults to Rohan
   * - Any voice not in SSOT → Rejects and defaults to Rohan
   *
   * Uses voice registry as single source of truth for 100+ voices across 7 providers
   * No legacy voice mapping - only current active voices allowed
   */
  private static async resolveVoiceConfig(config: AssistantConfig): Promise<{ provider: string; voiceId: string }> {
    try {
      const { isValidVoice, getVoiceById } = require('../config/voice-registry');

      const voiceId = config.voiceId || 'Rohan';
      const voiceProvider = config.voiceProvider || 'vapi';

      // Check if voice/provider combination is valid
      if (isValidVoice(voiceId, voiceProvider)) {
        log.debug('VapiAssistantManager', 'Voice configuration valid', {
          voiceId,
          provider: voiceProvider
        });
        return { voiceId, provider: voiceProvider };
      }

      // Voice not found in SSOT registry - default to Rohan (Vapi native)
      log.warn('VapiAssistantManager', 'Invalid voice configuration, using default', {
        original: voiceId,
        originalProvider: voiceProvider,
        defaultVoice: 'Rohan',
        defaultProvider: 'vapi',
        reason: 'voice_not_in_ssot'
      });

      return {
        voiceId: 'Rohan',
        provider: 'vapi'
      };
    } catch (error: any) {
      log.warn('VapiAssistantManager', 'Error resolving voice config, using defaults', {
        error: error?.message,
        voiceId: config.voiceId
      });

      // Fallback to Rohan if voice registry has issues
      return {
        voiceId: 'Rohan',
        provider: 'vapi'
      };
    }
  }

  /**
   * Ensure Vapi assistant exists for org (idempotent operation)
   *
   * Strategy:
   * 1. Get Vapi credentials (uses IntegrationSettingsService with fallback)
   * 2. Check if assistant_id exists in agents table
   * 3. If yes, verify it still exists in Vapi (GET /assistant/:id)
   * 4. If found in Vapi: Update it with latest config (PATCH)
   * 5. If not found (404): Create new assistant (POST)
   * 6. If no assistant_id: Create new assistant
   * 7. Register mapping in assistant_org_mapping table
   *
   * Error Handling:
   * - Voice normalization prevents 400 "Voice Not Found" errors
   * - Credential fallback ensures keys are always available
   * - 404s trigger automatic recreation
   *
   * @param orgId - Organization ID
   * @param role - Assistant role (inbound or outbound)
   * @param config - Assistant configuration
   * @returns Result object with assistantId and creation info
   * @throws Error if operation fails unrecoverably
   */
  static async ensureAssistant(
    orgId: string,
    role: 'inbound' | 'outbound',
    config: AssistantConfig
  ): Promise<EnsureAssistantResult> {
    const operationId = `${orgId}-${role}-${Date.now()}`;
    
    try {
      log.info('VapiAssistantManager', '📋 Starting ensureAssistant operation', {
        operationId,
        orgId,
        role,
        agentName: config.name,
      });

      // Step 1: Get Vapi credentials (with fallback support)
      let vapiCreds;
      try {
        vapiCreds = await IntegrationSettingsService.getVapiCredentials(orgId);
        log.info('VapiAssistantManager', '✅ Vapi credentials retrieved', {
          operationId,
          hasApiKey: !!vapiCreds.apiKey,
          hasAssistantId: !!vapiCreds.assistantId,
        });
      } catch (credError: any) {
        log.error('VapiAssistantManager', '❌ Failed to get Vapi credentials', {
          operationId,
          error: credError?.message,
        });
        throw new Error(`Failed to get Vapi credentials for org ${orgId}: ${credError?.message}`);
      }

      const vapi = new VapiClient(vapiCreds.apiKey);

      // Step 2: Resolve voice configuration using voice registry (prevents 400 errors)
      const voiceConfig = await this.resolveVoiceConfig(config);
      log.info('VapiAssistantManager', '🎤 Voice configuration resolved', {
        operationId,
        original: `${config.voiceProvider}/${config.voiceId}`,
        resolved: `${voiceConfig.provider}/${voiceConfig.voiceId}`,
      });

      // Step 3: Check if assistant_id exists in agents table
      let agent;
      try {
        const { data: agentData, error: agentError } = await supabase
          .from('agents')
          .select('id, vapi_assistant_id')
          .eq('org_id', orgId)
          .eq('role', role)
          .maybeSingle();

        if (agentError) {
          log.warn('VapiAssistantManager', '⚠️ Failed to query agents table', {
            operationId,
            error: agentError.message,
          });
          // Continue with null agent - will create new one
          agent = null;
        } else {
          agent = agentData;
          log.info('VapiAssistantManager', '📊 Agent lookup complete', {
            operationId,
            found: !!agent,
            hasAssistantId: !!agent?.vapi_assistant_id,
          });
        }
      } catch (dbError: any) {
        log.error('VapiAssistantManager', '❌ Database error during agent lookup', {
          operationId,
          error: dbError?.message,
        });
        throw new Error(`Failed to query agents table: ${dbError?.message}`);
      }

      let assistantId: string | null = agent?.vapi_assistant_id || null;
      let wasDeleted = false;

      // Step 4: Verify assistant exists in Vapi (if we have an ID)
      if (assistantId) {
        try {
          log.info('VapiAssistantManager', '🔍 Verifying assistant exists in Vapi', {
            operationId,
            assistantId,
          });

          const existing = await vapi.getAssistant(assistantId);

          // Assistant exists - update it with latest config
          log.info('VapiAssistantManager', '✅ Assistant found in Vapi, updating config', {
            operationId,
            assistantId,
          });

          // Fetch org settings for timezone, business hours, and clinic name
          const { data: org, error: orgError } = await supabase
            .from('organizations')
            .select('timezone, name, business_hours')
            .eq('id', orgId)
            .single();

          if (orgError) {
            log.error('VapiAssistantManager', '❌ Failed to fetch org settings', {
              operationId,
              orgId,
              error: orgError.message,
            });
            throw new Error(`Failed to fetch org settings: ${orgError.message}`);
          }

          const orgTimezone = org.timezone || 'America/Los_Angeles'; // Fallback to PST if not set
          const orgBusinessHours = org.business_hours || '9 AM - 6 PM'; // Fallback to default hours
          const orgName = org.name || 'our clinic'; // Fallback to generic name

          log.info('VapiAssistantManager', '✅ Org settings fetched', {
            operationId,
            orgId,
            timezone: orgTimezone,
            businessHours: orgBusinessHours,
            clinicName: orgName,
          });

          // Get temporal context for system prompt (now with dynamic timezone)
          const { currentDate, currentTime } = getTemporalContext(orgTimezone);

          // Generate super system prompt with user template embedded
          const systemPromptContent = getSuperSystemPrompt({
            userTemplate: config.systemPrompt,
            orgId,
            currentDate,
            currentTime,
            timezone: orgTimezone, // ✅ DYNAMIC from org settings
            businessHours: orgBusinessHours, // ✅ DYNAMIC from org settings
            clinicName: orgName, // ✅ DYNAMIC from org settings
            maxDuration: config.maxDurationSeconds || 600,
          });

          const updatePayload: any = {
            name: config.name,
            model: {
              provider: config.modelProvider || 'openai',
              model: config.modelName || 'gpt-4',
              messages: [
                {
                  role: 'system',
                  content: systemPromptContent,
                },
              ],
            },
            voice: {
              provider: voiceConfig.provider,
              voiceId: voiceConfig.voiceId,
            },
            firstMessage: config.firstMessage || 'Hello! How can I help you today?',
            maxDurationSeconds: config.maxDurationSeconds || 600,
          };

          // Auto-attach webhook URL if not provided
          if (!config.serverUrl) {
            updatePayload.serverUrl = `${resolveBackendUrl()}/api/vapi/webhook`;
          } else if (config.serverUrl) {
            updatePayload.serverUrl = config.serverUrl;
          }

          // NOTE: Tools are now registered separately by ToolSyncService
          // Don't modify toolIds during updates - they're managed independently

          // Add time-based server messages for call duration awareness
          updatePayload.serverMessages = [
            {
              type: 'status-update',
              conditions: [
                {
                  param: 'call.duration',
                  operator: 'gt',
                  value: 480 // 8 minutes
                }
              ],
              content: 'SYSTEM: Call approaching 8 minutes. Begin wrapping up naturally.'
            },
            {
              type: 'status-update',
              conditions: [
                {
                  param: 'call.duration',
                  operator: 'gt',
                  value: 540 // 9 minutes
                }
              ],
              content: 'SYSTEM: Call at 9 minutes. Inform patient of time limit and offer to finish up.'
            },
            ...(config.serverMessages || []) // Merge with any user-provided server messages
          ];

          // Add transcriber if provided
          if (config.transcriber) {
            updatePayload.transcriber = config.transcriber;
          }

          try {
            await vapi.updateAssistant(assistantId, updatePayload);

            log.info('VapiAssistantManager', '✅ Assistant updated successfully', {
              operationId,
              assistantId,
            });

            return {
              assistantId,
              isNew: false,
              wasDeleted: false,
            };
          } catch (updateError: any) {
            const status = updateError?.response?.status;
            const errorMsg = updateError?.response?.data?.message || updateError?.message;

            log.warn('VapiAssistantManager', '⚠️ Update failed, will retry with new assistant', {
              operationId,
              assistantId,
              status,
              error: errorMsg,
            });

            // Assume assistant is in bad state - will be recreated
            assistantId = null;
            wasDeleted = status === 404;
          }
        } catch (error: any) {
          const status = error?.response?.status;
          const errorMsg = error?.response?.data?.message || error?.message;

          if (status === 404) {
            // Assistant was deleted from Vapi - need to create new one
            log.warn('VapiAssistantManager', '🔄 Assistant not found in Vapi (404), will recreate', {
              operationId,
              oldAssistantId: assistantId,
              error: errorMsg,
            });
            assistantId = null;
            wasDeleted = true;
          } else if (status >= 500) {
            // Server error - log and retry
            log.error('VapiAssistantManager', '❌ Vapi server error, will retry', {
              operationId,
              status,
              error: errorMsg,
            });
            throw error;
          } else if (errorMsg?.includes('circuit breaker')) {
            // Circuit breaker open - retry later
            log.error('VapiAssistantManager', '❌ Vapi API circuit breaker is open', {
              operationId,
              error: errorMsg,
            });
            throw error;
          } else if (errorMsg?.includes('voice')) {
            // Voice-related error - should have been caught by normalization
            log.error('VapiAssistantManager', '❌ Voice configuration error despite normalization', {
              operationId,
              error: errorMsg,
              voiceConfig,
            });
            throw error;
          } else {
            // Unknown error - rethrow
            log.error('VapiAssistantManager', '❌ Unexpected Vapi API error', {
              operationId,
              status,
              error: errorMsg,
            });
            throw error;
          }
        }
      }

      // Step 5: Create new assistant if needed
      if (!assistantId) {
        try {
          log.info('VapiAssistantManager', '🆕 Creating new Vapi assistant', {
            operationId,
            name: config.name,
            role,
          });

          // Fetch org settings for timezone, business hours, and clinic name (same as UPDATE path)
          const { data: org, error: orgError } = await supabase
            .from('organizations')
            .select('timezone, name, business_hours')
            .eq('id', orgId)
            .single();

          if (orgError) {
            log.error('VapiAssistantManager', '❌ Failed to fetch org settings', {
              operationId,
              orgId,
              error: orgError.message,
            });
            throw new Error(`Failed to fetch org settings: ${orgError.message}`);
          }

          const orgTimezone = org.timezone || 'America/Los_Angeles'; // Fallback to PST if not set
          const orgBusinessHours = org.business_hours || '9 AM - 6 PM'; // Fallback to default hours
          const orgName = org.name || 'our clinic'; // Fallback to generic name

          log.info('VapiAssistantManager', '✅ Org settings fetched for new assistant', {
            operationId,
            orgId,
            timezone: orgTimezone,
            businessHours: orgBusinessHours,
            clinicName: orgName,
          });

          // Get temporal context for system prompt (same as UPDATE path, now with dynamic timezone)
          const { currentDate, currentTime } = getTemporalContext(orgTimezone);

          // Generate super system prompt with user template embedded (consistent with UPDATE path)
          const systemPromptContent = getSuperSystemPrompt({
            userTemplate: config.systemPrompt,
            orgId,
            currentDate,
            currentTime,
            timezone: orgTimezone, // ✅ DYNAMIC from org settings
            businessHours: orgBusinessHours, // ✅ DYNAMIC from org settings
            clinicName: orgName, // ✅ DYNAMIC from org settings
            maxDuration: config.maxDurationSeconds || 600,
          });

          const createPayload: any = {
            name: config.name,
            systemPrompt: systemPromptContent,
            firstMessage: config.firstMessage || 'Hello! How can I help you today?',
            voiceId: voiceConfig.voiceId,
            voiceProvider: voiceConfig.provider,
            modelProvider: config.modelProvider || 'openai',
            modelName: config.modelName || 'gpt-4',
            language: config.language || 'en',
            maxDurationSeconds: config.maxDurationSeconds || 600,
            transcriber: config.transcriber || {
              provider: 'deepgram',
              model: 'nova-2',
              language: 'en-US'
            }
          };

          // Auto-attach webhook URL if not provided
          if (!config.serverUrl) {
            createPayload.serverUrl = `${resolveBackendUrl()}/api/vapi/webhook`;
          } else if (config.serverUrl) {
            createPayload.serverUrl = config.serverUrl;
          }

          // Set up model with system prompt (tools will be registered separately by ToolSyncService)
          createPayload.model = {
            provider: config.modelProvider || 'openai',
            model: config.modelName || 'gpt-4',
            messages: [
              {
                role: 'system',
                content: systemPromptContent,
              },
            ],
            toolIds: []  // Empty initially - ToolSyncService will populate this
          };

          // Add server messages if provided
          if (config.serverMessages) {
            createPayload.serverMessages = config.serverMessages;
          }

          const created = await vapi.createAssistant(createPayload);

          assistantId = created.id;

          log.info('VapiAssistantManager', '✅ New Vapi assistant created', {
            operationId,
            assistantId,
            name: config.name,
          });
        } catch (createError: any) {
          const status = createError?.response?.status;
          const errorMsg = createError?.response?.data?.message || createError?.message;

          log.error('VapiAssistantManager', '❌ Failed to create assistant', {
            operationId,
            status,
            error: errorMsg,
            payload: { name: config.name, voice: voiceConfig },
          });

          throw new Error(`Failed to create Vapi assistant: ${errorMsg}`);
        }
      }

      // Step 6: Save assistant_id to agents table
      try {
        if (agent?.id) {
          // Update existing agent row
          log.info('VapiAssistantManager', '💾 Updating agent record', {
            operationId,
            agentId: agent.id,
            assistantId,
          });

          const { error: updateError } = await supabase
            .from('agents')
            .update({
              vapi_assistant_id: assistantId,
              name: config.name,
              system_prompt: config.systemPrompt,
              first_message: config.firstMessage,
              voice: voiceConfig.voiceId,
              voice_provider: voiceConfig.provider,
              language: config.language,
              max_call_duration: config.maxDurationSeconds,
              updated_at: new Date().toISOString(),
            })
            .eq('id', agent.id);

          if (updateError) {
            log.error('VapiAssistantManager', '❌ Failed to update agent record', {
              operationId,
              agentId: agent.id,
              assistantId,
              error: updateError.message,
            });
            throw new Error(`Failed to save assistant_id: ${updateError.message}`);
          }

          log.info('VapiAssistantManager', '✅ Agent record updated', {
            operationId,
            agentId: agent.id,
            assistantId,
          });
        } else {
          // Create new agent row
          log.info('VapiAssistantManager', '💾 Creating new agent record', {
            operationId,
            orgId,
            role,
            assistantId,
          });

          const { error: insertError } = await supabase
            .from('agents')
            .insert({
              org_id: orgId,
              role,
              name: config.name,
              vapi_assistant_id: assistantId,
              system_prompt: config.systemPrompt,
              first_message: config.firstMessage || 'Hello! How can I help you today?',
              voice: voiceConfig.voiceId,
              voice_provider: voiceConfig.provider,
              language: config.language || 'en',
              max_call_duration: config.maxDurationSeconds || 600,
            });

          if (insertError) {
            log.error('VapiAssistantManager', '❌ Failed to create agent record', {
              operationId,
              orgId,
              role,
              assistantId,
              error: insertError.message,
            });
            throw new Error(`Failed to create agent: ${insertError.message}`);
          }

          log.info('VapiAssistantManager', '✅ Agent record created', {
            operationId,
            orgId,
            role,
            assistantId,
          });
        }
      } catch (dbError: any) {
        log.error('VapiAssistantManager', '❌ Database operation failed', {
          operationId,
          error: dbError?.message,
        });
        throw dbError;
      }

      // Step 7: Register assistant-to-org mapping
      try {
        await IntegrationDecryptor.registerAssistantMapping(
          assistantId,
          orgId,
          role,
          config.name
        );
        log.info('VapiAssistantManager', '✅ Assistant mapping registered', {
          operationId,
          assistantId,
        });
      } catch (mappingError: any) {
        log.warn('VapiAssistantManager', '⚠️ Failed to register assistant mapping (non-critical)', {
          operationId,
          error: mappingError?.message,
        });
        // Non-critical - continue
      }

      // Step 8: Fire-and-forget tool synchronization
      // This ensures tools are registered without blocking the response
      (async () => {
        try {
          log.info('VapiAssistantManager', '🔄 Starting async tool sync', {
            operationId,
            assistantId,
            role
          });

          await ToolSyncService.syncAllToolsForAssistant({
            orgId,
            assistantId,
            backendUrl: resolveBackendUrl(),
            skipIfExists: false  // Always sync to pick up definition changes
          });

          log.info('VapiAssistantManager', '✅ Async tool sync completed', {
            operationId,
            assistantId
          });
        } catch (syncErr: any) {
          log.error('VapiAssistantManager', '❌ Async tool sync failed (non-blocking)', {
            operationId,
            assistantId,
            error: syncErr.message
          });
          // Error is logged but doesn't fail the assistant save operation
        }
      })();

      log.info('VapiAssistantManager', '✅ ensureAssistant completed successfully', {
        operationId,
        assistantId,
        isNew: !agent?.vapi_assistant_id,
        wasDeleted,
      });

      return {
        assistantId,
        isNew: !agent?.vapi_assistant_id,
        wasDeleted,
      };
    } catch (error: any) {
      log.error('VapiAssistantManager', '❌ ensureAssistant failed', {
        operationId,
        orgId,
        role,
        error: error?.message,
        stack: error?.stack?.split('\n').slice(0, 3).join('\n'),
      });
      throw error;
    }
  }

  /**
   * Get assistant configuration from database
   *
   * @param orgId - Organization ID
   * @param role - Assistant role
   * @returns Assistant configuration or null if not found
   */
  static async getAssistantConfig(
    orgId: string,
    role: 'inbound' | 'outbound'
  ): Promise<Partial<AssistantConfig> | null> {
    try {
      const { data, error } = await supabase
        .from('agents')
        .select(
          'name, system_prompt, first_message, voice, language, max_call_duration'
        )
        .eq('org_id', orgId)
        .eq('role', role)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      return {
        name: data.name,
        systemPrompt: data.system_prompt,
        firstMessage: data.first_message,
        voiceId: data.voice,
        language: data.language,
        maxDurationSeconds: data.max_call_duration,
      };
    } catch (error: any) {
      log.error('VapiAssistantManager', 'Failed to get assistant config', {
        orgId,
        role,
        error: error?.message,
      });
      return null;
    }
  }

  /**
   * Update assistant configuration and sync to Vapi
   *
   * @param orgId - Organization ID
   * @param role - Assistant role
   * @param updates - Partial configuration to update
   * @returns Updated assistant ID
   * @throws Error if update fails
   */
  static async updateAssistantConfig(
    orgId: string,
    role: 'inbound' | 'outbound',
    updates: Partial<AssistantConfig>
  ): Promise<string> {
    try {
      // Get current config
      const current = await this.getAssistantConfig(orgId, role);

      if (!current) {
        throw new Error(`No assistant found for org ${orgId} with role ${role}`);
      }

      // Merge with updates
      const merged: AssistantConfig = {
        name: updates.name || current.name || 'Assistant',
        systemPrompt: updates.systemPrompt || current.systemPrompt || '',
        firstMessage: updates.firstMessage || current.firstMessage,
        voiceId: updates.voiceId || current.voiceId,
        language: updates.language || current.language,
        maxDurationSeconds: updates.maxDurationSeconds || current.maxDurationSeconds,
        voiceProvider: updates.voiceProvider || current.voiceProvider,
        modelProvider: updates.modelProvider || current.modelProvider,
        modelName: updates.modelName || current.modelName,
        serverUrl: updates.serverUrl || current.serverUrl,
        serverMessages: updates.serverMessages || current.serverMessages,
        transcriber: updates.transcriber || current.transcriber,
        functions: updates.functions || current.functions,
      };

      // Ensure assistant exists (will create if needed)
      const result = await this.ensureAssistant(orgId, role, merged);

      // Update database config
      const { error } = await supabase
        .from('agents')
        .update({
          system_prompt: merged.systemPrompt,
          first_message: merged.firstMessage,
          voice: merged.voiceId,
          language: merged.language,
          max_call_duration: merged.maxDurationSeconds,
          updated_at: new Date().toISOString(),
        })
        .eq('org_id', orgId)
        .eq('role', role);

      if (error) {
        log.warn('VapiAssistantManager', 'Failed to update agents table', {
          orgId,
          role,
          error: error.message,
        });
        // Non-critical - continue
      }

      log.info('VapiAssistantManager', 'Assistant config updated', {
        orgId,
        role,
        assistantId: result.assistantId,
      });

      return result.assistantId;
    } catch (error: any) {
      log.error('VapiAssistantManager', 'Failed to update assistant config', {
        orgId,
        role,
        error: error?.message,
      });
      throw error;
    }
  }

  /**
   * Hard delete assistant from database and Vapi
   * Implements comprehensive cleanup with error recovery:
   * 1. Fetch agent details before deletion
   * 2. Check for active calls (safety check)
   * 3. Delete from Vapi (best effort - don't block on failure)
   * 4. Unassign phone number if assigned
   * 5. Delete from database (CASCADE handles assistant_org_mapping)
   * 6. Audit log the deletion
   *
   * @param orgId - Organization ID
   * @param role - Assistant role ('inbound' | 'outbound')
   * @throws Error if active calls exist or database cleanup fails
   */
  static async deleteAssistant(
    orgId: string,
    role: 'inbound' | 'outbound'
  ): Promise<void> {
    try {
      // 1. Get assistant details before deletion
      const { data: agent, error: fetchError } = await supabase
        .from('agents')
        .select('id, vapi_assistant_id, vapi_phone_number_id')
        .eq('org_id', orgId)
        .eq('role', role)
        .maybeSingle();

      if (fetchError) {
        throw fetchError;
      }

      if (!agent) {
        log.warn('VapiAssistantManager', 'Agent not found for deletion', {
          orgId,
          role,
        });
        return; // No agent to delete
      }

      // 2. Check for active calls (safety check)
      const { data: activeCalls, error: callError } = await supabase
        .from('calls')
        .select('id')
        .eq('org_id', orgId)
        .eq('status', 'active')
        .limit(1);

      if (callError) {
        throw callError;
      }

      if (activeCalls && activeCalls.length > 0) {
        throw new Error('Cannot delete agent with active calls. Please wait for calls to complete.');
      }

      // 3. Delete from Vapi (best effort - don't block on failure)
      if (agent.vapi_assistant_id) {
        try {
          const vapiKey = process.env.VAPI_PRIVATE_KEY;
          if (!vapiKey) {
            throw new Error('VAPI_PRIVATE_KEY not configured');
          }

          const vapi = new VapiClient(vapiKey);
          await vapi.deleteAssistant(agent.vapi_assistant_id);

          log.info('VapiAssistantManager', 'Assistant deleted from Vapi', {
            orgId,
            role,
            assistantId: agent.vapi_assistant_id,
          });
        } catch (vapiError: any) {
          // Log but continue - we still want to clean up database
          log.error('VapiAssistantManager', 'Failed to delete from Vapi (continuing with DB cleanup)', {
            orgId,
            role,
            assistantId: agent.vapi_assistant_id,
            error: vapiError?.message,
          });
        }
      }

      // 4. Clear phone number assignment (if any)
      if (agent.vapi_phone_number_id) {
        try {
          const vapiKey = process.env.VAPI_PRIVATE_KEY;
          if (!vapiKey) {
            throw new Error('VAPI_PRIVATE_KEY not configured');
          }

          const vapi = new VapiClient(vapiKey);

          // Unassign phone number by updating to null assistant
          await vapi.updatePhoneNumber(agent.vapi_phone_number_id, {
            assistantId: null
          });

          log.info('VapiAssistantManager', 'Phone number unassigned', {
            orgId,
            phoneNumberId: agent.vapi_phone_number_id,
          });
        } catch (phoneError: any) {
          log.error('VapiAssistantManager', 'Failed to unassign phone number', {
            orgId,
            phoneNumberId: agent.vapi_phone_number_id,
            error: phoneError?.message,
          });
        }
      }

      // 5. Delete from database (CASCADE will handle assistant_org_mapping)
      const { error: deleteError } = await supabase
        .from('agents')
        .delete()
        .eq('id', agent.id);

      if (deleteError) {
        throw deleteError;
      }

      // 6. Audit log the deletion
      try {
        await supabase
          .from('audit_logs')
          .insert({
            org_id: orgId,
            action: 'agent.deleted',
            resource_type: 'agent',
            resource_id: agent.id,
            details: {
              role,
              vapi_assistant_id: agent.vapi_assistant_id,
              vapi_phone_number_id: agent.vapi_phone_number_id,
            },
          });
      } catch (auditError: any) {
        // Don't fail deletion if audit logging fails
        log.warn('VapiAssistantManager', 'Failed to audit log deletion', {
          orgId,
          role,
          error: auditError?.message,
        });
      }

      log.info('VapiAssistantManager', 'Agent successfully deleted', {
        orgId,
        role,
        agentId: agent.id,
      });
    } catch (error: any) {
      log.error('VapiAssistantManager', 'Failed to delete assistant', {
        orgId,
        role,
        error: error?.message,
      });
      throw error;
    }
  }
}

export default VapiAssistantManager;
