import axios from 'axios';
import { config } from './src/config/index';

/**
 * Correct Vapi Tool Registration using the exact API format from Vapi docs
 *
 * Reference: https://docs.vapi.ai/tools/custom-tools
 *
 * Format for POST /tool:
 * {
 *   "type": "function",
 *   "function": {
 *     "name": "...",
 *     "description": "...",
 *     "parameters": {...}
 *   },
 *   "server": {
 *     "url": "...",
 *     "method": "POST"
 *   }
 * }
 */

async function registerToolsVapiFormat() {
  console.log('🔧 Registering Tools - Vapi API Format\n');

  const assistantId = '1f2c1e48-3c41-4a8d-9ddc-cdf6a7303ada';

  const vapiClient = axios.create({
    baseURL: 'https://api.vapi.ai',
    headers: {
      'Authorization': `Bearer ${config.VAPI_PRIVATE_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  try {
    console.log('Step 1: Creating tool with correct Vapi API structure\n');

    // CORRECT format per Vapi documentation
    const toolPayload = {
      type: 'function',
      function: {
        name: 'bookClinicAppointment',
        description: 'Books a clinic appointment',
        parameters: {
          type: 'object',
          properties: {
            appointmentDate: {
              type: 'string',
              description: 'Date in YYYY-MM-DD format'
            },
            appointmentTime: {
              type: 'string',
              description: 'Time in HH:MM format'
            },
            patientName: {
              type: 'string',
              description: 'Full name of the patient'
            },
            patientEmail: {
              type: 'string',
              description: 'Email address of the patient'
            },
            serviceType: {
              type: 'string',
              description: 'Type of service'
            }
          },
          required: ['appointmentDate', 'appointmentTime', 'patientName', 'patientEmail']
        }
      },
      server: {
        url: `${config.BACKEND_URL}/api/vapi-tools/tools/bookClinicAppointment`
        // NOTE: Removed "method" - Vapi might default to POST or handle it differently
      }
    };

    console.log('Tool Payload:');
    console.log(JSON.stringify(toolPayload, null, 2));
    console.log('\n');

    const createResponse = await vapiClient.post('/tool', toolPayload);
    const toolId = createResponse.data.id;

    console.log(`✅ Tool created successfully!\n`);
    console.log(`Tool ID: ${toolId}\n`);

    console.log('Step 2: Linking tool to assistant via PATCH\n');

    // PATCH with model.toolIds
    const patchPayload = {
      model: {
        toolIds: [toolId]
      }
    };

    const patchResponse = await vapiClient.patch(`/assistant/${assistantId}`, patchPayload);

    console.log('✅ Assistant updated with tool!\n');

    console.log('Step 3: Verifying\n');

    const verifyResponse = await vapiClient.get(`/assistant/${assistantId}`);
    const linkedTools = verifyResponse.data.model?.toolIds || [];

    console.log(`✅ Assistant now has ${linkedTools.length} tools linked`);
    linkedTools.forEach((id: string, i: number) => {
      console.log(`  ${i + 1}. ${id}`);
    });

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      console.error('\nVapi Response:');
      console.error(JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

registerToolsVapiFormat().catch(console.error);
