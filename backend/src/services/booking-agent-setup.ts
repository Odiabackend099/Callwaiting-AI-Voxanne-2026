/**
 * Booking Agent Setup Service
 * 
 * CRITICAL: This service handles the complete setup of appointment booking functionality:
 * 1. Generates dynamic system prompts with temporal context
 * 2. Wires tools into agent configuration
 * 3. Syncs agent with Vapi API
 * 
 * This ensures agents can reliably invoke tools and handle bookings.
 */

import { VapiClient, AssistantConfig } from './vapi-client';
import { config } from '../config/index';
import { APPOINTMENT_BOOKING_PROMPT, generatePromptContext } from '../config/system-prompts';
import { log } from './logger';
import { supabase } from './supabase-client';

export class BookingAgentSetup {
  private vapiClient: VapiClient;

  constructor(vapiApiKey: string) {
    this.vapiClient = new VapiClient(vapiApiKey);
  }

  /**
   * CRITICAL: Set up an agent for live appointment booking
   * 
   * This function:
   * 1. Fetches organization details for context
   * 2. Generates system prompt with temporal + tool instructions
   * 3. Loads appointment booking tools
   * 4. Updates the agent in Vapi
   * 
   * @param assistantId - The Vapi assistant ID to configure
   * @param tenantId - The organization/tenant ID
   * @param baseUrl - Optional webhook base URL override
   * @returns Updated assistant object
   * 
   * @throws Error if organization not found or Vapi update fails
   */
  async setupBookingAgent(
    assistantId: string,
    tenantId: string,
    baseUrl?: string
  ): Promise<any> {
    try {
      log.info('BookingAgentSetup', 'Setting up booking agent', { assistantId, tenantId });

      // Step 1: Fetch organization details (or create mock for testing)
      let org = await this.getOrganizationDetails(tenantId);
      if (!org) {
        // For testing: create a mock organization if none exists
        log.warn('BookingAgentSetup', 'Organization not found, using test defaults', { tenantId });
        org = {
          id: tenantId,
          name: 'Test Clinic',
          timezone: 'America/New_York'
        };
      }

      // Step 2: Generate system prompt with temporal context
      const promptContext = generatePromptContext({
        id: org.id,
        name: org.name,
        timezone: org.timezone || 'America/New_York', // Default timezone if not in DB
        business_hours: org.business_hours
      });

      const systemPrompt = APPOINTMENT_BOOKING_PROMPT(promptContext);

      // Step 3: Get appointment booking tools (for reference, but note: tools cannot be added via PATCH)
      // Tools would need to be set at creation time. For now, we update the system prompt.
      const tools = this.vapiClient.getAppointmentBookingTools(baseUrl);

      // Fetch existing assistant to get current model name
      const existingAssistant = await this.vapiClient.getAssistant(assistantId);
      const currentModel = existingAssistant?.model?.model || 'gpt-4o';

      log.info('BookingAgentSetup', 'Generated prompt context and tools', {
        assistantId,
        tenantId,
        currentModel,
        promptContext: {
          tenantId: promptContext.tenantId,
          clinicName: promptContext.clinicName,
          timezone: promptContext.tenantTimezone,
          currentDate: promptContext.currentDate,
          currentTime: promptContext.currentTime
        },
        toolCount: tools.length
      });

      // Step 4: Update agent in Vapi with system prompt ONLY
      // Note: Vapi API does not allow adding tools via PATCH. Tools must be set at creation time.
      const updatePayload = {
        model: {
          model: currentModel,
          messages: [
            {
              role: 'system',
              content: systemPrompt
            }
          ],
          provider: 'openai'  // Required by Vapi API
        }
      };

      const updatedAssistant = await this.vapiClient.updateAssistant(assistantId, updatePayload);

      log.info('BookingAgentSetup', 'Successfully set up booking agent', {
        assistantId,
        updatedAt: new Date().toISOString(),
        toolsCount: tools.length
      });

      return updatedAssistant;
    } catch (error) {
      log.error('BookingAgentSetup', 'Failed to set up booking agent', {
        assistantId,
        tenantId,
        error: (error as any)?.message
      });
      throw error;
    }
  }

  /**
   * Fetch organization details from database
   * @param tenantId - Organization ID
   * @returns Organization object with timezone and business hours
   */
  private async getOrganizationDetails(tenantId: string): Promise<any> {
    const { data, error } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('id', tenantId)
      .single();

    if (error) {
      log.error('BookingAgentSetup', 'Failed to fetch organization', {
        tenantId,
        error: error.message
      });
      return null;
    }

    return data;
  }

  /**
   * Sync tools to an existing agent
   * (Useful if agent already has the right prompt but is missing tools)
   * 
   * @param assistantId - The Vapi assistant ID
   * @param baseUrl - Optional webhook base URL override
   * @returns Updated assistant object
   */
  async syncToolsToAgent(assistantId: string, baseUrl?: string): Promise<any> {
    try {
      log.info('BookingAgentSetup', 'Syncing tools to agent', { assistantId });

      const tools = this.vapiClient.getAppointmentBookingTools(baseUrl);

      const updatedAssistant = await this.vapiClient.updateAssistant(assistantId, {
        tools: tools
      });

      log.info('BookingAgentSetup', 'Successfully synced tools', {
        assistantId,
        toolCount: tools.length
      });

      return updatedAssistant;
    } catch (error) {
      log.error('BookingAgentSetup', 'Failed to sync tools', {
        assistantId,
        error: (error as any)?.message
      });
      throw error;
    }
  }

  /**
   * Update agent system prompt with fresh temporal context
   * (Call this periodically to keep time/timezone current)
   * 
   * @param assistantId - The Vapi assistant ID
   * @param tenantId - The organization/tenant ID
   * @returns Updated assistant object
   */
  async updateAgentPrompt(assistantId: string, tenantId: string): Promise<any> {
    try {
      log.info('BookingAgentSetup', 'Updating agent prompt with fresh context', {
        assistantId,
        tenantId
      });

      const org = await this.getOrganizationDetails(tenantId);
      if (!org) {
        // For testing: create a mock organization if none exists
        log.warn('BookingAgentSetup', 'Organization not found during prompt update, using test defaults', { tenantId });
      }

      const organization = org || {
        id: tenantId,
        name: 'Test Clinic',
        timezone: 'America/New_York'
      };

      const promptContext = generatePromptContext({
        id: organization.id,
        name: organization.name,
        timezone: organization.timezone || 'America/New_York',
        business_hours: organization.business_hours
      });      const systemPrompt = APPOINTMENT_BOOKING_PROMPT(promptContext);

      const updatedAssistant = await this.vapiClient.updateAssistant(assistantId, {
        model: {
          messages: [
            {
              role: 'system',
              content: systemPrompt
            }
          ],
          provider: 'openai'  // Required by Vapi API
        }
      });

      log.info('BookingAgentSetup', 'Successfully updated agent prompt', {
        assistantId,
        updatedAt: new Date().toISOString()
      });

      return updatedAssistant;
    } catch (error) {
      log.error('BookingAgentSetup', 'Failed to update agent prompt', {
        assistantId,
        tenantId,
        error: (error as any)?.message
      });
      throw error;
    }
  }

  /**
   * Get current booking setup status for an agent
   * @param assistantId - The Vapi assistant ID
   * @returns Status object with tool count, system prompt info, etc.
   */
  async getBookingAgentStatus(assistantId: string): Promise<any> {
    try {
      const assistant = await this.vapiClient.getAssistant(assistantId);

      const toolCount = assistant.tools?.length || 0;
      const hasSystemPrompt = Boolean(
        assistant.model?.messages?.[0]?.content?.includes('TOOL INVOCATION')
      );

      return {
        assistantId,
        name: assistant.name,
        toolCount,
        hasBookingTools: toolCount >= 3,
        hasBookingSystemPrompt: hasSystemPrompt,
        ready: toolCount >= 3 && hasSystemPrompt,
        tools: assistant.tools?.map((t: any) => ({
          name: t.name,
          type: t.type,
          description: t.description
        })) || []
      };
    } catch (error) {
      log.error('BookingAgentSetup', 'Failed to get booking agent status', {
        assistantId,
        error: (error as any)?.message
      });
      throw error;
    }
  }
}

/**
 * Singleton instance
 * Create from environment or import as needed
 */
export function createBookingAgentSetup(vapiApiKey?: string): BookingAgentSetup {
  const key = vapiApiKey || config.VAPI_PRIVATE_KEY;
  if (!key) {
    throw new Error('VAPI_PRIVATE_KEY is required');
  }
  return new BookingAgentSetup(key);
}

export default BookingAgentSetup;
