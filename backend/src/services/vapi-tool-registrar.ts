/**
 * Vapi Tool Registrar
 * Registers the bookClinicAppointment tool with a Vapi assistant
 */

import { VapiClient } from './vapi-client';
import { log } from './logger';

export class VapiToolRegistrar {
  /**
   * Register the bookClinicAppointment tool with an assistant
   * @param assistantId - Vapi assistant ID
   * @param vapiApiKey - Vapi API key
   * @param backendUrl - Backend URL where the tool endpoint is hosted
   */
  static async registerBookingTool(
    assistantId: string,
    vapiApiKey: string,
    backendUrl: string
  ): Promise<{ toolId: string }> {
    const vapi = new VapiClient(vapiApiKey);

    try {
      // Get current assistant config
      const assistant = await vapi.getAssistant(assistantId);

      log.info('VapiToolRegistrar', 'Fetched assistant', {
        assistantId,
        currentToolIds: assistant.model?.toolIds || []
      });

      // Define the bookClinicAppointment tool
      const bookingTool = {
        type: 'function',
        function: {
          name: 'bookClinicAppointment',
          description: 'Books a clinic appointment on the patient\'s preferred date and time. Updates Google Calendar and creates a booking record.',
          parameters: {
            type: 'object',
            properties: {
              appointmentDate: {
                type: 'string',
                description: 'Date of the appointment in YYYY-MM-DD format (e.g., 2026-01-19)'
              },
              appointmentTime: {
                type: 'string',
                description: 'Time of the appointment in HH:MM format (e.g., 09:00)'
              },
              patientEmail: {
                type: 'string',
                description: 'Email address of the patient'
              },
              patientPhone: {
                type: 'string',
                description: 'Phone number of the patient (optional)'
              },
              duration: {
                type: 'number',
                description: 'Duration of the appointment in minutes (default: 30)',
                default: 30
              }
            },
            required: ['appointmentDate', 'appointmentTime', 'patientEmail']
          }
        },
        server: {
          url: `${backendUrl}/api/vapi-tools/tools/bookClinicAppointment`
        }
      };

      // Create the tool in Vapi
      const toolResponse = await (vapi as any).client.post('/tools', bookingTool);

      const toolId = toolResponse.id;

      log.info('VapiToolRegistrar', 'Tool created in Vapi', {
        toolId,
        assistantId
      });

      // Get current assistant's toolIds
      const existingToolIds = assistant.model?.toolIds || [];
      const newToolIds = [...existingToolIds, toolId];

      // Update assistant to include the new tool
      const updatePayload = {
        model: {
          provider: assistant.model?.provider,
          model: assistant.model?.model,
          messages: assistant.model?.messages,
          toolIds: newToolIds
        }
      };

      await vapi.updateAssistant(assistantId, updatePayload);

      log.info('VapiToolRegistrar', 'Assistant updated with new tool', {
        assistantId,
        toolId,
        newToolIds
      });

      return { toolId };
    } catch (error: any) {
      log.error('VapiToolRegistrar', 'Failed to register booking tool', {
        error: error.message,
        assistantId
      });
      throw error;
    }
  }
}
