import axios from 'axios';
import { config } from './src/config/index';

async function updateWebhookUrl() {
  const assistantId = '1f2c1e48-3c41-4a8d-9ddc-cdf6a7303ada';
  const ngrokUrl = 'https://sobriquetical-zofia-abysmally.ngrok-free.dev';
  const newWebhookUrl = `${ngrokUrl}/api/webhooks/vapi`;

  const vapiClient = axios.create({
    baseURL: 'https://api.vapi.ai',
    headers: {
      'Authorization': `Bearer ${config.VAPI_PRIVATE_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  try {
    console.log('📋 Getting current assistant configuration...\n');

    const getResponse = await vapiClient.get(`/assistant/${assistantId}`);
    const assistant = getResponse.data;

    console.log(`✅ Current Assistant: ${assistant.name}`);
    console.log(`   Current serverUrl: ${assistant.serverUrl || 'NOT SET'}\n`);

    console.log('🔧 Updating webhook URL...\n');

    const updatePayload = {
      serverUrl: newWebhookUrl,
      serverMessages: assistant.serverMessages || [
        'function-call',
        'hang',
        'status-update',
        'end-of-call-report',
        'transcript'
      ]
    };

    console.log(`New webhook URL: ${newWebhookUrl}\n`);

    const patchResponse = await vapiClient.patch(
      `/assistant/${assistantId}`,
      updatePayload
    );

    console.log('✅ Webhook URL updated successfully!\n');

    console.log('📋 Verifying update...\n');
    const verifyResponse = await vapiClient.get(`/assistant/${assistantId}`);
    const updated = verifyResponse.data;

    console.log(`✅ Verified serverUrl: ${updated.serverUrl}\n`);
    console.log('🎉 Assistant is now ready to receive webhooks from Vapi!');
    console.log('\n' + '='.repeat(60));
    console.log('✅ WEBHOOK CONFIGURATION COMPLETE');
    console.log('='.repeat(60));
    console.log('\nNext steps:');
    console.log('1. Verify ngrok tunnel is still running');
    console.log('2. Open browser test at http://localhost:3000/dashboard/test-agent');
    console.log('3. Try booking an appointment again');
    console.log('4. Check if booking succeeds and appears in Google Calendar');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

updateWebhookUrl().catch(console.error);
