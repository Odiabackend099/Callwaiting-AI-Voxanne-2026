import axios from 'axios';

const vapiKey = 'b22e1e1e-17f3-447e-8a6a-a9f6d4a8e3cc';
const assistantId = 'bee0ecd5-4f32-43f0-ac1a-81e2b3c26f13';

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
