#!/usr/bin/env node

/**
 * Agent Save Test Simulator
 * Simulates an agent save request to trigger Vapi sync
 * Captures the response and logs any errors
 */

const http = require('http');
const fs = require('fs');
require('dotenv').config();

const BACKEND_URL = 'http://localhost:3001';
const ORG_ID = 'a0000000-0000-0000-0000-000000000001'; // Dev Org

// Create a test JWT token
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';

const token = jwt.sign(
  {
    sub: 'test-user-123',
    email: 'test@voxanne.com',
    app_metadata: {
      org_id: ORG_ID
    }
  },
  JWT_SECRET,
  { expiresIn: '1h' }
);

console.log('🔄 Starting Agent Save Test Simulation...\n');
console.log('📋 Test Parameters:');
console.log('   Backend URL:', BACKEND_URL);
console.log('   Organization:', ORG_ID);
console.log('   Endpoint: /api/founder-console/agent/behavior');
console.log('   Method: POST\n');

// Test payload
const payload = {
  inbound: {
    system_prompt: `You are a friendly AI receptionist for a medical clinic.
Your name is CallWaiting AI.
Help patients schedule appointments, answer basic questions about the clinic, and transfer calls when needed.
Always be professional and helpful.`,
    voice: 'aura-asteria-en',
    language: 'en-US',
    model: 'gpt-4',
    temperature: 0.7
  },
  outbound: {
    system_prompt: `You are a helpful AI assistant making outbound calls.
Your job is to follow up with patients about their appointments and gather feedback.
Always be polite and respectful.`,
    voice: 'aura-asteria-en',
    language: 'en-US',
    model: 'gpt-4',
    temperature: 0.7
  }
};

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/founder-console/agent/behavior',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'X-Org-Id': ORG_ID
  }
};

const req = http.request(options, (res) => {
  let data = '';

  console.log('📡 Response received:');
  console.log(`   Status: ${res.statusCode}`);
  console.log(`   Headers: ${JSON.stringify(res.headers)}\n`);

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      console.log('📊 Response Body:');
      console.log(JSON.stringify(response, null, 2));

      // Analyze response
      console.log('\n✅ Analysis:');
      if (response.success === false) {
        console.log('   ❌ Agent save FAILED');
        console.log('   Error:', response.error);
      } else if (response.mode === 'browser-only') {
        console.log('   ⚠️  Browser-only mode (Vapi not synced)');
        console.log('   Reason:', response.vapiSynced === false ? 'Vapi disabled' : 'Unknown');
      } else if (response.vapiSynced === true) {
        console.log('   ✅ Agent SUCCESSFULLY synced to Vapi');
        console.log('   Details:', {
          inboundId: response.inboundAgent?.vapi_assistant_id?.substring(0, 8) + '...',
          outboundId: response.outboundAgent?.vapi_assistant_id?.substring(0, 8) + '...'
        });
      } else if (response.vapiSynced === false) {
        console.log('   ❌ Agent sync to Vapi FAILED');
        console.log('   This means the agent exists in database but NOT in Vapi');
      } else {
        console.log('   ⚠️  Unknown response status');
      }

      console.log('\n🔍 Next step: Check backend logs for detailed error messages');
    } catch (error) {
      console.error('❌ Failed to parse response:', error.message);
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request failed:', error.message);
  if (error.code === 'ECONNREFUSED') {
    console.error('   Backend is not running on port 3001');
    console.error('   Start it with: cd backend && npm run dev');
  }
});

req.on('timeout', () => {
  req.abort();
  console.error('❌ Request timeout after 30 seconds');
});

req.setTimeout(30000);

console.log('📤 Sending request...\n');
req.write(JSON.stringify(payload));
req.end();
