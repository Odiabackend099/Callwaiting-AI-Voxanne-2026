/**
 * Tool Synchronization Service
 *
 * Automatically registers and manages tools for Vapi assistants.
 * This is the "Invisible Hand" that ensures every assistant has the required tools
 * without manual intervention.
 *
 * Triggered by:
 * - Assistant creation
 * - Assistant update
 * - Prompt save
 * - Tool blueprint changes
 *
 * Phase 7 Feature: Tool versioning via definition hashes
 * - Tracks SHA-256 hash of tool definitions
 * - Automatically re-registers tools when definitions change
 * - Enables safe, zero-downtime tool updates
 */

import * as crypto from 'crypto';
import { VapiClient } from './vapi-client';
import { IntegrationDecryptor } from './integration-decryptor';
import { getUnifiedBookingTool } from '../config/unified-booking-tool';
import { supabase } from './supabase-client';
import { log } from './logger';

export interface ToolSyncOptions {
  orgId: string;
  assistantId: string;
  vapiApiKey?: string;
  backendUrl?: string;
  skipIfExists?: boolean; // If true, don't sync if tool already registered
}

export interface ToolSyncResult {
  success: boolean;
  toolId?: string;
  assistantId: string;
  message: string;
  toolsRegistered: number;
}

export class ToolSyncService {
  /**
   * Calculate SHA-256 hash of a tool definition for versioning
   * @param toolDef - Tool definition object
   * @returns SHA-256 hash as hex string
   */
  static getToolDefinitionHash(toolDef: any): string {
    const content = JSON.stringify(toolDef);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Synchronize all system tools for an organization's assistant
   *
   * This is the primary method that handles:
   * 1. Fetching all system tools from blueprint
   * 2. For each tool: register with Vapi (if not exists)
   * 3. Link tool to assistant
   * 4. Update database with tool references
   *
   * @param options - Synchronization options
   * @returns Sync result with details
   */
  static async syncAllToolsForAssistant(
    options: ToolSyncOptions
  ): Promise<ToolSyncResult> {
    const syncStartTime = Date.now();

    try {
      const {
        orgId,
        assistantId,
        backendUrl = process.env.BACKEND_URL || 'http://localhost:3001',
        skipIfExists = false
      } = options;

      log.info('ToolSyncService', '🔄 Starting tool synchronization', {
        orgId,
        assistantId,
        backendUrl,
        mode: 'platform'  // Platform mode: backend is sole Vapi provider
      });

      // Get backend's Vapi API key (platform is sole provider in multi-tenant mode)
      const vapiApiKey = process.env.VAPI_PRIVATE_KEY;
      if (!vapiApiKey) {
        throw new Error('VAPI_PRIVATE_KEY not configured in backend environment - platform cannot sync tools');
      }

      const vapi = new VapiClient(vapiApiKey);

      // Get system tools blueprint
      const systemTools = await this.getSystemToolsBlueprint();

      if (systemTools.length === 0) {
        log.warn('ToolSyncService', 'No system tools found in blueprint');
        return {
          success: true,
          assistantId,
          message: 'No tools to sync',
          toolsRegistered: 0
        };
      }

      log.info('ToolSyncService', `Found ${systemTools.length} tools in blueprint`, {
        tools: systemTools.map(t => t.name)
      });

      // Get existing tools for this org
      const existingTools = await this.getOrgTools(orgId);

      let toolsRegistered = 0;
      const registeredToolIds: string[] = [];

      // Sync each tool
      for (const toolBlueprint of systemTools) {
        try {
          const existingTool = existingTools.find(t => t.name === toolBlueprint.name);

          if (existingTool && skipIfExists) {
            log.info('ToolSyncService', '⏭️ Skipping existing tool', {
              toolName: toolBlueprint.name,
              toolId: existingTool.vapi_tool_id
            });
            registeredToolIds.push(existingTool.vapi_tool_id);
            continue;
          }

          // Register or update tool
          const toolId = await this.syncSingleTool(
            orgId,
            toolBlueprint,
            backendUrl
          );

          registeredToolIds.push(toolId);
          toolsRegistered++;

          log.info('ToolSyncService', '✅ Tool synced', {
            toolName: toolBlueprint.name,
            toolId
          });
        } catch (toolError: any) {
          log.error('ToolSyncService', 'Failed to sync tool', {
            toolName: toolBlueprint.name,
            error: toolError.message
          });
          // Continue with other tools even if one fails
        }
      }

      // Link all tools to assistant
      if (registeredToolIds.length > 0) {
        await this.linkToolsToAssistant(
          vapi,
          assistantId,
          registeredToolIds
        );

        log.info('ToolSyncService', '✅ Tools linked to assistant', {
          assistantId,
          toolCount: registeredToolIds.length
        });
      }

      const syncTime = Date.now() - syncStartTime;

      log.info('ToolSyncService', '🎉 TOOL SYNC COMPLETE', {
        orgId,
        assistantId,
        toolsRegistered,
        executionTimeMs: syncTime
      });

      return {
        success: true,
        assistantId,
        message: `Synced ${toolsRegistered} tools in ${syncTime}ms`,
        toolsRegistered
      };
    } catch (error: any) {
      const syncTime = Date.now() - syncStartTime;

      log.error('ToolSyncService', 'Tool sync failed', {
        error: error.message,
        executionTimeMs: syncTime
      });

      throw error;
    }
  }

  /**
   * Sync a single tool for an organization with retry logic
   *
   * In multi-tenant platform mode, tools are registered ONCE globally using the backend's
   * Vapi API key, then linked to each organization's assistants. This method handles
   * registration and linking.
   */
  private static async syncSingleTool(
    orgId: string,
    toolBlueprint: any,
    backendUrl: string
  ): Promise<string> {
    // For now, we only support bookClinicAppointment
    if (toolBlueprint.name !== 'bookClinicAppointment') {
      throw new Error(`Unsupported tool: ${toolBlueprint.name}`);
    }

    // Step 1: Use backend's Vapi API key (platform is sole provider)
    // In multi-tenant platform mode, the backend has the single Vapi API key
    const vapiApiKey = process.env.VAPI_PRIVATE_KEY;
    if (!vapiApiKey) {
      throw new Error('VAPI_PRIVATE_KEY not configured in backend environment - platform cannot register tools');
    }

    const vapi = new VapiClient(vapiApiKey);

    // Step 2: Build tool definition with webhook URL
    const toolDef = getUnifiedBookingTool(backendUrl);
    const currentHash = this.getToolDefinitionHash(toolDef);

    // Step 3: Check if tool already registered GLOBALLY (by any org)
    // In platform mode, tools are registered once and shared across orgs
    const { data: globalTools, error: globalCheckError } = await supabase
      .from('org_tools')
      .select('vapi_tool_id, definition_hash, org_id')
      .eq('tool_name', 'bookClinicAppointment')
      .limit(1);

    let existingToolId: string | null = null;
    let existingHash: string | null = null;

    if (!globalCheckError && globalTools && globalTools.length > 0) {
      existingToolId = globalTools[0].vapi_tool_id;
      existingHash = globalTools[0].definition_hash;

      if (existingHash === currentHash) {
        log.info('ToolSyncService', '📌 Tool already registered globally with current definition', {
          orgId,
          toolId: existingToolId,
          hash: currentHash.substring(0, 8),
          registeredByOrg: globalTools[0].org_id.substring(0, 8)
        });
        return existingToolId;
      } else {
        // Definition changed - need to re-register
        log.info('ToolSyncService', '🔄 Tool definition changed - re-registering globally', {
          orgId,
          oldHash: existingHash?.substring(0, 8),
          newHash: currentHash.substring(0, 8)
        });
      }
    }

    log.info('ToolSyncService', '📤 Registering tool with Vapi API', {
      orgId,
      toolName: toolBlueprint.name,
      backendUrl
    });

    // Step 4: Register tool with Vapi with retry logic
    let toolId: string;
    try {
      const toolResponse = await this.registerToolWithRetry(vapi, toolDef, orgId);
      toolId = toolResponse.id;

      log.info('ToolSyncService', '✅ Tool registered with Vapi', {
        orgId,
        toolId,
        toolName: 'bookClinicAppointment'
      });
    } catch (err: any) {
      log.error('ToolSyncService', '❌ Failed to register tool with Vapi', {
        orgId,
        toolName: toolBlueprint.name,
        error: err.message
      });
      throw err;
    }

    // Step 5: Save org's reference to the (globally-registered) tool
    try {
      // In platform mode, the same tool (same toolId) is shared across all orgs
      // Each org gets an entry in org_tools linking to the global tool
      const { error: saveError } = await supabase
        .from('org_tools')
        .upsert({
          org_id: orgId,
          tool_name: 'bookClinicAppointment',
          vapi_tool_id: toolId,
          description: toolBlueprint.description,
          enabled: true,
          definition_hash: currentHash,  // Phase 7: Track tool definition version
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (saveError) {
        log.warn('ToolSyncService', '⚠️  Failed to save org tool reference to database', {
          orgId,
          toolId,
          error: saveError.message
        });
        // Continue anyway - tool is registered with Vapi, just not in our tracking table
      } else {
        log.info('ToolSyncService', '💾 Org tool reference saved to org_tools table', {
          orgId,
          toolId,
          registeredGlobally: !existingToolId  // true if we just registered it
        });
      }
    } catch (err: any) {
      log.warn('ToolSyncService', '⚠️  Database save error (continuing anyway)', {
        error: err.message
      });
    }

    return toolId;
  }

  /**
   * Register tool with Vapi API with exponential backoff retry logic
   */
  private static async registerToolWithRetry(
    vapi: VapiClient,
    toolDef: any,
    orgId: string,
    maxRetries: number = 3
  ): Promise<any> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        log.info('ToolSyncService', `🔄 Vapi API call attempt ${attempt}/${maxRetries}`, {
          orgId,
          toolName: toolDef.function.name
        });

        // Access the Vapi client's axios instance directly
        const response = await (vapi as any).client.post('/tool', toolDef);

        log.info('ToolSyncService', '✅ Vapi API request succeeded', {
          orgId,
          attempt,
          toolId: response.data.id
        });

        return response.data;
      } catch (error: any) {
        lastError = error;
        const status = error.response?.status;
        const message = error.response?.data?.message || error.message;

        log.warn('ToolSyncService', `⚠️  Attempt ${attempt} failed`, {
          orgId,
          status,
          message,
          attempt,
          maxRetries
        });

        // Don't retry on 4xx errors (except 429 for rate limit)
        if (status && status >= 400 && status < 500 && status !== 429) {
          throw new Error(`Vapi API error (${status}): ${message}`);
        }

        // If this was the last attempt, throw
        if (attempt === maxRetries) {
          throw new Error(
            `Failed to register tool with Vapi after ${maxRetries} attempts: ${message}`
          );
        }

        // Exponential backoff: 2^attempt * 1000ms (2s, 4s, 8s)
        const delayMs = Math.pow(2, attempt) * 1000;
        log.info('ToolSyncService', `⏳ Retrying in ${delayMs}ms...`, {
          orgId,
          nextAttempt: attempt + 1
        });

        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    // This should never be reached, but just in case
    throw lastError || new Error('Unknown error registering tool with Vapi');
  }

  /**
   * Link tools to assistant via Vapi API using modern toolIds pattern
   *
   * Modern Vapi API (v3.0+) uses model.toolIds instead of embedding tools directly.
   * This updates the assistant to link the registered tools.
   */
  private static async linkToolsToAssistant(
    vapi: VapiClient,
    assistantId: string,
    toolIds: string[]
  ): Promise<void> {
    if (!toolIds || toolIds.length === 0) {
      log.warn('ToolSyncService', 'No tool IDs provided for linking', {
        assistantId
      });
      return;
    }

    try {
      log.info('ToolSyncService', '🔗 Linking tools to assistant', {
        assistantId,
        toolCount: toolIds.length,
        toolIds: toolIds.slice(0, 3)  // Log first 3 for brevity
      });

      // Call Vapi API to update assistant with toolIds
      const updatePayload = {
        model: {
          toolIds: toolIds
        }
      };

      // Use the updateAssistant method which handles retries and errors
      await vapi.updateAssistant(assistantId, updatePayload);

      log.info('ToolSyncService', '✅ Tools linked to assistant successfully', {
        assistantId,
        toolCount: toolIds.length
      });
    } catch (error: any) {
      log.error('ToolSyncService', '❌ Failed to link tools to assistant', {
        assistantId,
        toolCount: toolIds.length,
        error: error.message,
        note: 'Tools are registered with Vapi but may need manual linking in dashboard'
      });

      // Don't throw - tools are still registered, just not linked
      // User can manually link in Vapi dashboard or next save attempt may succeed
    }
  }

  /**
   * Get system tools blueprint
   *
   * In the future, this will fetch from a `system_tools` table.
   * For now, we return the hardcoded booking tool.
   */
  private static async getSystemToolsBlueprint(): Promise<any[]> {
    // TODO: Fetch from system_tools table in Supabase
    // For MVP, we hardcode the booking tool

    return [
      {
        name: 'bookClinicAppointment',
        description: 'Book a confirmed appointment for a patient',
        enabled: true
      }
    ];
  }

  /**
   * Get all tools registered for an organization
   */
  private static async getOrgTools(orgId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('org_tools')
      .select('*')
      .eq('org_id', orgId);

    if (error) {
      log.error('ToolSyncService', 'Failed to fetch org tools', {
        error: error.message
      });
      return [];
    }

    return data || [];
  }

  /**
   * Debug helper - show tool sync status for org
   */
  static async getToolSyncStatus(orgId: string): Promise<any> {
    const tools = await this.getOrgTools(orgId);

    return {
      orgId,
      toolsRegistered: tools.length,
      tools: tools.map(t => ({
        name: t.tool_name,
        vapiId: t.vapi_tool_id,
        createdAt: t.created_at
      }))
    };
  }
}
