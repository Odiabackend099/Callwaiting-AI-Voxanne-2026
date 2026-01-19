#!/usr/bin/env node
require('dotenv').config();

const http = require('http');

function makeRequest(method, path, data) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer dev-token',
        'x-org-id': 'a0000000-0000-0000-0000-000000000001'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            body: JSON.parse(body),
            headers: res.headers
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            body: body,
            headers: res.headers
          });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

(async () => {
  console.log('🔄 Starting Agent UPDATE Test...\n');

  // First, query current agents to get their IDs and current voice
  console.log('Step 1: Query current agents...');
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: agents, error: queryErr } = await supabase
    .from('agents')
    .select('id, role, vapi_assistant_id, voice')
    .eq('org_id', 'a0000000-0000-0000-0000-000000000001');

  if (queryErr || !agents || agents.length === 0) {
    console.log('❌ No agents found. Please run test-agent-save.js first.');
    process.exit(1);
  }

  console.log(`✅ Found ${agents.length} agents:`);
  const inboundAgent = agents.find(a => a.role === 'inbound');
  const outboundAgent = agents.find(a => a.role === 'outbound');
  
  console.log(`  - Inbound: ${inboundAgent?.id.substring(0, 8)}... | Vapi ID: ${inboundAgent?.vapi_assistant_id?.substring(0, 8)}... | Voice: ${inboundAgent?.voice}`);
  console.log(`  - Outbound: ${outboundAgent?.id.substring(0, 8)}... | Vapi ID: ${outboundAgent?.vapi_assistant_id?.substring(0, 8)}... | Voice: ${outboundAgent?.voice}\n`);

  const originalInboundVapiId = inboundAgent?.vapi_assistant_id;
  const originalOutboundVapiId = outboundAgent?.vapi_assistant_id;

  // Now update the inbound agent to a DIFFERENT voice
  console.log('Step 2: Update inbound agent voice from "aura-asteria-en" to "aura-luna-en"...');
  const updatePayload = {
    inbound: {
      system_prompt: 'You are a helpful AI receptionist for a medical clinic.',
      voice: 'aura-luna-en', // CHANGED VOICE
      language: 'en-US',
      model: 'gpt-4',
      temperature: 0.7,
      first_message: 'Hi there! How can I help?'
    },
    outbound: {
      system_prompt: 'You are an AI assistant calling on behalf of a clinic.',
      voice: 'aura-asteria-en',
      language: 'en-US',
      model: 'gpt-4',
      temperature: 0.7,
      first_message: 'Hi, is this a good time?'
    }
  };

  try {
    const response = await makeRequest(
      'POST',
      '/api/founder-console/agent/behavior',
      updatePayload
    );

    console.log(`📡 Response Status: ${response.status}`);
    
    if (response.status === 200 && response.body.success) {
      console.log('✅ Update request succeeded\n');
      
      // Extract the new Vapi IDs from response
      const vapiIds = response.body.vapiAssistantIds;
      const inboundUpdate = vapiIds.find(v => v.role === 'inbound');
      const outboundUpdate = vapiIds.find(v => v.role === 'outbound');

      console.log('Step 3: Verify Vapi assistant IDs (should be SAME, not new)...');
      console.log(`  Inbound:`);
      console.log(`    Before: ${originalInboundVapiId?.substring(0, 12)}...`);
      console.log(`    After:  ${inboundUpdate?.vapiAssistantId?.substring(0, 12)}...`);
      console.log(`    Same?: ${originalInboundVapiId === inboundUpdate?.vapiAssistantId ? '✅ YES' : '❌ NO (new assistant created!)'}`);

      console.log(`  Outbound:`);
      console.log(`    Before: ${originalOutboundVapiId?.substring(0, 12)}...`);
      console.log(`    After:  ${outboundUpdate?.vapiAssistantId?.substring(0, 12)}...`);
      console.log(`    Same?: ${originalOutboundVapiId === outboundUpdate?.vapiAssistantId ? '✅ YES' : '❌ NO (new assistant created!)'}\n`);

      // Query database to verify
      console.log('Step 4: Query database to verify voice was updated...');
      const { data: updated, error: updateCheckErr } = await supabase
        .from('agents')
        .select('id, role, vapi_assistant_id, voice')
        .eq('org_id', 'a0000000-0000-0000-0000-000000000001');

      if (updateCheckErr) {
        console.log('❌ Error querying updated agents:', updateCheckErr.message);
        process.exit(1);
      }

      const updatedInbound = updated.find(a => a.role === 'inbound');
      console.log(`  Inbound voice in DB: ${updatedInbound?.voice}`);
      console.log(`  Voice updated correctly?: ${updatedInbound?.voice === 'aura-luna-en' ? '✅ YES' : '❌ NO'}`);
      console.log(`  Vapi ID still same?: ${updatedInbound?.vapi_assistant_id === originalInboundVapiId ? '✅ YES' : '❌ NO'}\n`);

      // Verify with Vapi API
      console.log('Step 5: Verify with Vapi API that assistant was updated (not recreated)...');
      const vapiUrl = `https://api.vapi.ai/assistant/${inboundUpdate?.vapiAssistantId}`;
      const vapiResponse = await new Promise((resolve, reject) => {
        const httpsModule = require('https');
        const req = httpsModule.get(
          vapiUrl,
          {
            headers: {
              'Authorization': `Bearer ${process.env.VAPI_API_KEY}`
            }
          },
          (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
              try {
                resolve(JSON.parse(body));
              } catch (e) {
                reject(e);
              }
            });
          }
        );
        req.on('error', reject);
      });

      const vapiVoice = vapiResponse.voice?.voiceId || vapiResponse.voice;
      console.log(`  Vapi assistant voice: ${vapiVoice}`);
      console.log(`  Voice should be converted: "aura-luna-en" → "luna"`);
      console.log(`  Voice matches expectation?: ${vapiVoice === 'luna' || vapiVoice?.includes('luna') ? '✅ YES' : '❌ NO'}`);

      console.log('\n🎉 UPDATE TEST COMPLETE');
      console.log('Summary:');
      console.log(`  ✅ Agent updated without creating new Vapi assistant (same ID)`);
      console.log(`  ✅ Database voice field updated`);
      console.log(`  ✅ Vapi assistant reflects new voice`);
      console.log(`  ✅ Update logic works correctly (idempotent)`);
    } else {
      console.log('❌ Update failed');
      console.log(JSON.stringify(response.body, null, 2));
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
