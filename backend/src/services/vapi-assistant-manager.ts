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
import { createClient } from '@supabase/supabase-js';
import { log } from './logger';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
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
   * Ensure Vapi assistant exists for org (idempotent operation)
   *
   * Strategy:
   * 1. Check if assistant_id exists in agents table
   * 2. If yes, verify it still exists in Vapi (GET /assistant/:id)
   * 3. If found in Vapi: Update it with latest config (PATCH)
   * 4. If not found (404): Create new assistant (POST)
   * 5. If no assistant_id: Create new assistant
   * 6. Register mapping in assistant_org_mapping table
   *
   * @param orgId - Organization ID
   * @param role - Assistant role (inbound or outbound)
   * @param config - Assistant configuration
   * @returns Result object with assistantId and creation info
   * @throws Error if operation fails
   */
  static async ensureAssistant(
    orgId: string,
    role: 'inbound' | 'outbound',
    config: AssistantConfig
  ): Promise<EnsureAssistantResult> {
    try {
      // Step 1: Get Vapi credentials
      const vapiCreds = await IntegrationDecryptor.getVapiCredentials(orgId);
      const vapi = new VapiClient(vapiCreds.apiKey);

      // Step 2: Check if assistant_id exists in agents table
      const { data: agent, error: agentError } = await supabase
        .from('agents')
        .select('id, vapi_assistant_id')
        .eq('org_id', orgId)
        .eq('role', role)
        .maybeSingle();

      if (agentError) {
        throw new Error(`Failed to query agents table: ${agentError.message}`);
      }

      let assistantId: string | null = agent?.vapi_assistant_id || null;
      let wasDeleted = false;

      // Step 3: Verify assistant exists in Vapi (if we have an ID)
      if (assistantId) {
        try {
          const existing = await vapi.getAssistant(assistantId);

          // Assistant exists - update it with latest config
          log.info('VapiAssistantManager', 'Assistant exists, updating config', {
            orgId,
            role,
            assistantId,
          });

          await vapi.updateAssistant(assistantId, {
            name: config.name,
            model: {
              provider: config.modelProvider || 'openai',
              model: config.modelName || 'gpt-4',
              messages: [
                {
                  role: 'system',
                  content: config.systemPrompt,
                },
              ],
            },
            voice: {
              provider: config.voiceProvider || 'vapi',
              voiceId: config.voiceId || 'Paige',
            },
            firstMessage: config.firstMessage || 'Hello! How can I help you today?',
            maxDurationSeconds: config.maxDurationSeconds || 600,
            ...(config.serverUrl && { serverUrl: config.serverUrl }),
            ...(config.serverMessages && { serverMessages: config.serverMessages }),
            ...(config.transcriber && { transcriber: config.transcriber }),
            ...(config.functions && { functions: config.functions }),
          });

          log.info('VapiAssistantManager', 'Assistant updated successfully', {
            orgId,
            role,
            assistantId,
          });

          return {
            assistantId,
            isNew: false,
            wasDeleted: false,
          };
        } catch (error: any) {
          if (error?.response?.status === 404) {
            // Assistant was deleted from Vapi - need to create new one
            log.warn('VapiAssistantManager', 'Assistant not found in Vapi (was deleted), creating new', {
              orgId,
              role,
              oldAssistantId: assistantId,
            });
            assistantId = null;
            wasDeleted = true;
          } else if (error?.message?.includes('Unknown error')) {
            // Vapi API error - retry with new assistant
            log.warn('VapiAssistantManager', 'Vapi API error, will create new assistant', {
              orgId,
              role,
              oldAssistantId: assistantId,
              error: error?.message,
            });
            assistantId = null;
          } else {
            // Other error - rethrow
            throw error;
          }
        }
      }

      // Step 4: Create new assistant if needed
      if (!assistantId) {
        log.info('VapiAssistantManager', 'Creating new Vapi assistant', {
          orgId,
          role,
          name: config.name,
        });

        const created = await vapi.createAssistant({
          name: config.name,
          systemPrompt: config.systemPrompt,
          firstMessage: config.firstMessage || 'Hello! How can I help you today?',
          voiceId: config.voiceId || 'Paige',
          voiceProvider: config.voiceProvider || 'vapi',
          modelProvider: config.modelProvider || 'openai',
          modelName: config.modelName || 'gpt-4',
          language: config.language || 'en',
          maxDurationSeconds: config.maxDurationSeconds || 600,
          serverUrl: config.serverUrl,
          serverMessages: config.serverMessages,
          transcriber: config.transcriber || {
            provider: 'deepgram',
            model: 'nova-2',
            language: 'en-US'
          },
          functions: config.functions,
        });

        assistantId = created.id;

        log.info('VapiAssistantManager', 'New Vapi assistant created', {
          orgId,
          role,
          assistantId,
          name: config.name,
        });

        // Step 5: Save assistant_id to agents table
        if (agent?.id) {
          // Update existing agent row
          const { error: updateError } = await supabase
            .from('agents')
            .update({
              vapi_assistant_id: assistantId,
              updated_at: new Date().toISOString(),
            })
            .eq('id', agent.id);

          if (updateError) {
            log.error('VapiAssistantManager', 'Failed to save assistant_id to agents', {
              agentId: agent.id,
              assistantId,
              error: updateError.message,
            });
            throw new Error(`Failed to save assistant_id: ${updateError.message}`);
          }

          log.info('VapiAssistantManager', 'Saved assistant_id to existing agent', {
            agentId: agent.id,
            assistantId,
          });
        } else {
          // Create new agent row
          const { error: insertError } = await supabase
            .from('agents')
            .insert({
              org_id: orgId,
              role,
              name: config.name,
              vapi_assistant_id: assistantId,
              system_prompt: config.systemPrompt,
              first_message: config.firstMessage || 'Hello! How can I help you today?',
              voice: config.voiceId || 'Paige',
              language: config.language || 'en',
              max_call_duration: config.maxDurationSeconds || 600,
            });

          if (insertError) {
            log.error('VapiAssistantManager', 'Failed to create agent row', {
              orgId,
              role,
              assistantId,
              error: insertError.message,
            });
            throw new Error(`Failed to create agent: ${insertError.message}`);
          }

          log.info('VapiAssistantManager', 'Created new agent row', {
            orgId,
            role,
            assistantId,
          });
        }
      }

      // Step 6: Register assistant-to-org mapping
      await IntegrationDecryptor.registerAssistantMapping(
        assistantId,
        orgId,
        role,
        config.name
      );

      return {
        assistantId,
        isNew: !agent?.vapi_assistant_id,
        wasDeleted,
      };
    } catch (error: any) {
      log.error('VapiAssistantManager', 'Failed to ensure assistant', {
        orgId,
        role,
        error: error?.message,
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
        voiceProvider: updates.voiceProvider,
        modelProvider: updates.modelProvider,
        modelName: updates.modelName,
        serverUrl: updates.serverUrl,
        serverMessages: updates.serverMessages,
        transcriber: updates.transcriber,
        functions: updates.functions,
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
   * Delete assistant (soft delete - marks as inactive)
   *
   * @param orgId - Organization ID
   * @param role - Assistant role
   */
  static async deleteAssistant(
    orgId: string,
    role: 'inbound' | 'outbound'
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('agents')
        .update({
          active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('org_id', orgId)
        .eq('role', role);

      if (error) {
        throw error;
      }

      log.info('VapiAssistantManager', 'Assistant marked as inactive', {
        orgId,
        role,
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
