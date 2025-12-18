/**
 * Configure Vapi Webhook Script
 * Programmatically sets up Vapi assistant to use RAG webhook
 * Run this once to configure the assistant
 */

import axios from 'axios';

const VAPI_API_KEY = process.env.VAPI_API_KEY;
const VAPI_ASSISTANT_ID = process.env.VAPI_ASSISTANT_ID;
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:3001/api/vapi/webhook';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

if (!VAPI_API_KEY) {
  console.error('❌ VAPI_API_KEY environment variable not set');
  process.exit(1);
}

if (!VAPI_ASSISTANT_ID) {
  console.error('❌ VAPI_ASSISTANT_ID environment variable not set');
  process.exit(1);
}

const vapiClient = axios.create({
  baseURL: 'https://api.vapi.ai',
  headers: {
    'Authorization': `Bearer ${VAPI_API_KEY}`,
    'Content-Type': 'application/json'
  }
});

/**
 * Configure Vapi assistant with RAG webhook
 */
async function configureVapiWebhook() {
  try {
    console.log('🔄 Fetching current assistant configuration...');

    // Get current assistant
    const getResponse = await vapiClient.get(`/assistant/${VAPI_ASSISTANT_ID}`);
    const assistant = getResponse.data;

    console.log('✅ Current assistant fetched');
    console.log(`   Name: ${assistant.name}`);
    console.log(`   Model: ${assistant.model?.provider}`);

    // Update assistant with webhook configuration
    const updatedAssistant = {
      ...assistant,
      // Add webhook that gets called before generating response
      serverMessages: [
        {
          type: 'request-start',
          url: WEBHOOK_URL,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      ],
      // Enhance system prompt to use KB context
      systemPrompt: `${assistant.systemPrompt || 'You are a helpful assistant.'}

When responding to questions, you will receive relevant knowledge base information. Use this information to provide accurate, detailed answers about our products and services.

If knowledge base information is provided, prioritize it in your response. If the user asks something not covered in the knowledge base, say so honestly.`,
      // Add tools for KB search if needed
      tools: [
        ...(assistant.tools || []),
        {
          type: 'function',
          function: {
            name: 'search_knowledge_base',
            description: 'Search the knowledge base for relevant information',
            parameters: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'The search query'
                }
              },
              required: ['query']
            }
          }
        }
      ]
    };

    console.log('🔄 Updating assistant with webhook configuration...');

    const updateResponse = await vapiClient.patch(
      `/assistant/${VAPI_ASSISTANT_ID}`,
      updatedAssistant
    );

    console.log('✅ Assistant updated successfully');
    console.log(`   Webhook URL: ${WEBHOOK_URL}`);
    console.log(`   System prompt enhanced with KB instructions`);

    return updateResponse.data;
  } catch (error: any) {
    console.error('❌ Failed to configure Vapi webhook');
    console.error(`   Error: ${error?.response?.data?.message || error?.message}`);
    process.exit(1);
  }
}

/**
 * Test the webhook configuration
 */
async function testWebhook() {
  try {
    console.log('\n🔄 Testing webhook configuration...');

    const testPayload = {
      message: 'What is the pricing for Call Waiting AI?',
      assistantId: VAPI_ASSISTANT_ID,
      orgId: 'test-org-id'
    };

    const response = await axios.post(`${BACKEND_URL}/api/vapi/webhook`, testPayload);

    if (response.data.success) {
      console.log('✅ Webhook test successful');
      console.log(`   Chunks retrieved: ${response.data.chunkCount}`);
      console.log(`   Context available: ${response.data.hasContext}`);

      if (response.data.context) {
        console.log(`   Context preview: ${response.data.context.substring(0, 100)}...`);
      }
    } else {
      console.warn('⚠️  Webhook returned non-success response');
      console.log(response.data);
    }
  } catch (error: any) {
    console.error('❌ Webhook test failed');
    console.error(`   Error: ${error?.message}`);
    console.log('   Note: This is expected if backend is not running');
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Vapi Webhook Configuration Script');
  console.log('=====================================\n');

  console.log('Configuration:');
  console.log(`  VAPI_ASSISTANT_ID: ${VAPI_ASSISTANT_ID}`);
  console.log(`  WEBHOOK_URL: ${WEBHOOK_URL}`);
  console.log(`  BACKEND_URL: ${BACKEND_URL}\n`);

  await configureVapiWebhook();
  await testWebhook();

  console.log('\n✅ Configuration complete!');
  console.log('\nNext steps:');
  console.log('1. Verify the webhook is active in Vapi dashboard');
  console.log('2. Make a test call to your Vapi number');
  console.log('3. Ask a question about Call Waiting AI pricing or features');
  console.log('4. The AI should now use the Knowledge Base to answer');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
