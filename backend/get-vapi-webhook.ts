import axios from 'axios';

const vapiKey = process.env.VAPI_PRIVATE_KEY;
const assistantId = process.env.VAPI_ASSISTANT_ID || 'bee0ecd5-4f32-43f0-ac1a-81e2b3c26f13';

if (!vapiKey) {
  console.error('❌ Error: VAPI_PRIVATE_KEY environment variable is not set');
  console.error('   Please add VAPI_PRIVATE_KEY to your .env file');
  process.exit(1);
}

async function checkWebhook() {
  try {
    const response = await axios.get(
      `https://api.vapi.ai/assistant/${assistantId}`,
      {
        headers: {
          'Authorization': `Bearer ${vapiKey}`
        }
      }
    );

    const assistant = response.data;

    console.log('\n=== VAPI ASSISTANT WEBHOOK CONFIG ===\n');
    console.log(`Assistant ID: ${assistant.id}`);
    console.log(`Assistant Name: ${assistant.name}`);
    console.log(`Webhook URL: ${assistant.serverUrl || 'NOT SET'}`);

    if (assistant.serverUrl) {
      console.log(`\nWebhook is configured to: ${assistant.serverUrl}`);
    } else {
      console.log(`\nWARNING: No webhook URL configured!`);
    }

  } catch (error: any) {
    console.error('Error:', error.response?.data || error.message);
  }
}

checkWebhook();
