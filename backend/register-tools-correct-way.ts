import axios from 'axios';
import { supabase } from './src/services/supabase-client';
import { config } from './src/config/index';

/**
 * Correct Vapi Tool Registration Flow (2026):
 * 1. Create each tool via POST /tool (get tool IDs back)
 * 2. PATCH assistant with model.toolIds array containing those IDs
 *
 * This is the only way to register custom server-type tools programmatically.
 */

async function registerToolsCorrectly() {
  console.log('🔧 Registering Tools - Correct Vapi API Flow\n');

  const assistantId = '1f2c1e48-3c41-4a8d-9ddc-cdf6a7303ada';
  const agentId = '20bac455-7b1e-4d93-88bc-18dac0fdcc21';

  const vapiClient = axios.create({
    baseURL: 'https://api.vapi.ai',
    headers: {
      'Authorization': `Bearer ${config.VAPI_PRIVATE_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  try {
    // Define tools that need to be registered
    const toolDefinitions = [
      {
        name: 'bookClinicAppointment',
        description: 'Books a clinic appointment on the patient\'s preferred date and time. Creates a booking record in the database and syncs the event to Google Calendar. Use this tool to finalize the appointment booking.',
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
          url: `${config.BACKEND_URL}/api/vapi-tools/tools/bookClinicAppointment`,
          method: 'POST'
        }
      }
    ];

    console.log('Step 1: Creating tools via POST /tool\n');

    const createdToolIds: string[] = [];

    for (const toolDef of toolDefinitions) {
      try {
        console.log(`Creating tool: ${toolDef.name}...`);
        const response = await vapiClient.post('/tool', toolDef);
        const toolId = response.data.id;
        createdToolIds.push(toolId);
        console.log(`✅ Tool created with ID: ${toolId}\n`);
      } catch (error: any) {
        console.error(`❌ Failed to create tool ${toolDef.name}:`, error.response?.data || error.message);
        throw error;
      }
    }

    console.log(`\nStep 2: Updating assistant with toolIds via PATCH\n`);

    // CRITICAL: Use model.toolIds in the PATCH payload, NOT top-level "tools"
    const updatePayload = {
      model: {
        toolIds: createdToolIds
      }
    };

    console.log(`Updating assistant ${assistantId} with ${createdToolIds.length} tool IDs...\n`);

    const patchResponse = await vapiClient.patch(`/assistant/${assistantId}`, updatePayload);

    console.log('✅ Assistant updated successfully\n');

    console.log(`Step 3: Verifying tools are linked\n`);

    const verifyResponse = await vapiClient.get(`/assistant/${assistantId}`);
    const linkedToolIds = verifyResponse.data.model?.toolIds || [];

    console.log(`✅ Success! Assistant now has ${linkedToolIds.length} tools linked:\n`);
    linkedToolIds.forEach((id: string, i: number) => {
      console.log(`  ${i + 1}. ${id}`);
    });

    console.log('\n✅ Tool registration complete!\n');
    console.log('Summary:');
    console.log(`  Assistant ID: ${assistantId}`);
    console.log(`  Tools Created: ${createdToolIds.length}`);
    console.log(`  Tools Linked: ${linkedToolIds.length}`);
    console.log('\nThe inbound assistant is now ready for booking!');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

registerToolsCorrectly().catch(console.error);
