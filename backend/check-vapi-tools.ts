import axios from 'axios';

const VAPI_API_KEY = 'Bearer d7df31fc-4956-4c3f-866f-0b13d050d5d7';
const ASSISTANT_ID = '919b36f6-8203-4c40-93f5-e7dbf3a13833';

async function checkTools() {
  try {
    console.log('\n=== CHECKING VAPI ASSISTANT TOOLS ===\n');

    const response = await axios.get(
      `https://api.vapi.ai/assistant/${ASSISTANT_ID}`,
      { headers: { Authorization: VAPI_API_KEY } }
    );

    const assistant = response.data;
    console.log(`Assistant: ${assistant.name}`);
    console.log(`ID: ${assistant.id}`);
    console.log(`Webhook URL: ${assistant.serverUrl || 'NOT SET'}`);
    console.log(`Tools: ${assistant.tools?.length || 0}\n`);

    if (assistant.tools && assistant.tools.length > 0) {
      console.log('Registered Tools:');
      assistant.tools.forEach((tool: any, idx: number) => {
        console.log(`  [${idx + 1}] ${tool.type}: ${tool.name || tool.asyncToolName}`);
        if (tool.type === 'function') {
          console.log(`      URL: ${tool.server?.url || 'INLINE'}`);
        }
      });
    } else {
      console.log('❌ NO TOOLS REGISTERED');
    }

  } catch (error: any) {
    console.error('Error:', error.response?.data || error.message);
  }
}

checkTools();
