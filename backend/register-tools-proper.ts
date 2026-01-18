import axios from 'axios';
import { config } from './src/config/index';

async function registerToolsWithAssistant() {
  console.log('📋 Registering Tools for Inbound Assistant\n');

  const assistantId = '1f2c1e48-3c41-4a8d-9ddc-cdf6a7303ada';
  const orgId = '46cf2995-2bee-44e3-838b-24151486fe4e';

  const tools = [
    {
      type: 'server',
      name: 'bookClinicAppointment',
      description: 'Books a clinic appointment on the patient\'s preferred date and time. Creates a booking record in the database and syncs the event to Google Calendar. Use this tool to finalize the appointment booking.',
      server: {
        url: `${config.BACKEND_URL}/api/vapi-tools/tools/bookClinicAppointment`,
        method: 'POST'
      },
      messages: {
        requestStart: [
          'Booking your appointment now...',
          'Just a moment while I save that to the calendar...',
          'Recording your appointment...'
        ],
        requestComplete: [
          'Perfect! Your appointment is confirmed and added to your calendar.',
          'All set! I\'ve booked your appointment and sent a confirmation.',
          'Great! Your appointment is confirmed for that date and time.'
        ],
        requestFailed: [
          'I\'m having trouble booking that appointment. Let me try again...',
          'Unable to complete the booking at the moment. Can you provide your email again?'
        ]
      }
    }
  ];

  try {
    const vapiClient = axios.create({
      baseURL: 'https://api.vapi.ai',
      headers: {
        'Authorization': `Bearer ${config.VAPI_PRIVATE_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    console.log('Step 1: Creating tool in Vapi\n');

    for (const tool of tools) {
      console.log(`Creating tool: ${tool.name}...`);
      const toolResponse = await vapiClient.post('/tool', tool);
      const toolId = toolResponse.data.id;
      console.log(`✅ Tool created with ID: ${toolId}\n`);

      console.log(`Step 2: Attaching tool to assistant\n`);

      // Update assistant to include this tool
      const updatePayload = {
        toolIds: [toolId]
      };

      try {
        const updateResponse = await vapiClient.patch(`/assistant/${assistantId}`, updatePayload);
        console.log(`✅ Tool attached to assistant\n`);
      } catch (attachError: any) {
        if (attachError.response?.data?.message?.includes('toolIds')) {
          // Try with different approach - get assistant first
          console.log('Note: toolIds endpoint might not work. Trying alternative...\n');
        }
        throw attachError;
      }
    }

    console.log('✅ All tools registered successfully!');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      console.error('   Response:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

registerToolsWithAssistant().catch(console.error);
