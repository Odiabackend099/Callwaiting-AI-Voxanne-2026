/**
 * Simple Phase 1 Tool Sync - Direct Vapi API
 */

const axios = require('axios');
require('dotenv').config();

const VAPI_API_KEY = process.env.VAPI_PRIVATE_KEY;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

if (!VAPI_API_KEY) {
  console.error('❌ VAPI_PRIVATE_KEY not set in .env');
  process.exit(1);
}

// Tool definitions
const transferCallTool = {
  type: 'function',
  function: {
    name: 'transferCall',
    description: 'Transfers caller to human agent. Use when: 1) User asks for human, 2) User is angry/frustrated, 3) Request too complex for AI.',
    parameters: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description: '1-sentence summary of issue for human agent'
        },
        department: {
          type: 'string',
          enum: ['general', 'billing', 'medical'],
          description: 'Which department to transfer to'
        }
      },
      required: ['summary', 'department']
    }
  },
  server: {
    url: `${BACKEND_URL}/api/vapi/tools/transferCall`
  },
  async: true
};

const lookupCallerTool = {
  type: 'function',
  function: {
    name: 'lookupCaller',
    description: 'Looks up caller information in CRM by phone, email, or name.',
    parameters: {
      type: 'object',
      properties: {
        searchKey: {
          type: 'string',
          description: 'Phone number, email, or name to search for'
        },
        searchType: {
          type: 'string',
          enum: ['phone', 'email', 'name'],
          description: 'Type of search to perform'
        }
      },
      required: ['searchKey', 'searchType']
    }
  },
  server: {
    url: `${BACKEND_URL}/api/vapi/tools/lookupCaller`
  },
  async: false
};

async function registerTool(toolDef, toolName) {
  try {
    console.log(`[INFO] Registering: ${toolName}`);
    
    const listResponse = await axios.get('https://api.vapi.ai/tool', {
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    const existingTool = listResponse.data.find(t => t.function?.name === toolName);
    
    if (existingTool) {
      console.log(`  Found existing tool (${existingTool.id}), updating...`);
      
      await axios.patch(
        `https://api.vapi.ai/tool/${existingTool.id}`,
        toolDef,
        {
          headers: {
            'Authorization': `Bearer ${VAPI_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log(`✅ Updated: ${toolName} (${existingTool.id})`);
      return existingTool.id;
    } else {
      const createResponse = await axios.post(
        'https://api.vapi.ai/tool',
        toolDef,
        {
          headers: {
            'Authorization': `Bearer ${VAPI_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log(`✅ Created: ${toolName} (${createResponse.data.id})`);
      return createResponse.data.id;
    }
  } catch (error) {
    console.error(`❌ Failed to register ${toolName}:`, error.response?.data || error.message);
    throw error;
  }
}

async function attachToAssistant(toolIds) {
  try {
    console.log('\\n[INFO] Fetching assistants...');
    
    const assistantsResponse = await axios.get('https://api.vapi.ai/assistant', {
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!assistantsResponse.data || assistantsResponse.data.length === 0) {
      throw new Error('No assistants found');
    }
    
    const assistant = assistantsResponse.data[0];
    console.log(`[INFO] Updating assistant: ${assistant.name || assistant.id}`);
    
    const existingToolIds = assistant.model?.toolIds || [];
    const allToolIds = [...new Set([...existingToolIds, ...toolIds])];
    
    console.log(`[INFO] Attaching ${allToolIds.length} tools...`);
    
    await axios.patch(
      `https://api.vapi.ai/assistant/${assistant.id}`,
      {
        model: {
          ...assistant.model,
          toolIds: allToolIds
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${VAPI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log(`✅ Assistant updated with ${allToolIds.length} tools`);
  } catch (error) {
    console.error('❌ Failed to attach tools:', error.response?.data || error.message);
    throw error;
  }
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║           Phase 1 Tool Sync - Brain Upgrade              ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\\n');
  
  console.log(`Backend URL: ${BACKEND_URL}\\n`);
  
  try {
    const toolIds = [];
    
    toolIds.push(await registerTool(transferCallTool, 'transferCall'));
    toolIds.push(await registerTool(lookupCallerTool, 'lookupCaller'));
    
    await attachToAssistant(toolIds);
    
    console.log('\\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║                    Sync Complete                          ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\\n');
    
    console.log('✅ Phase 1 tools are now live in Vapi!');
    console.log('\\n📞 Next Step: Make a live call to test:');
    console.log('   1. Identity Injection: Call from +15551234567');
    console.log('   2. Warm Transfer: Say "I need to speak to a human"');
    console.log('\\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\\n❌ Sync failed');
    process.exit(1);
  }
}

main();
