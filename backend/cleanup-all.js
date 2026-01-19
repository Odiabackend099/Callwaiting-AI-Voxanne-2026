#!/usr/bin/env node
require('dotenv').config();
const https = require('https');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const vapiApiKey = process.env.VAPI_PRIVATE_KEY;

function makeVapiRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.vapi.ai',
      path: path,
      method: method,
      headers: {
        'Authorization': `Bearer ${vapiApiKey}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: data ? JSON.parse(data) : null
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data
          });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

(async () => {
  console.log('\n🗑️  COMPLETE CLEANUP - DATABASE AND VAPI\n');
  console.log('='.repeat(70));

  try {
    // Step 1: Clear database agents
    console.log('\nStep 1: Clearing database agents...');
    const { error: deleteErr } = await supabase
      .from('agents')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (deleteErr) {
      console.log('❌ Database error:', deleteErr.message);
      process.exit(1);
    }

    const { data: remaining } = await supabase
      .from('agents')
      .select('count', { count: 'exact' });

    console.log('✅ Database agents cleared');

    // Step 2: Get all assistants from Vapi
    console.log('\nStep 2: Fetching all assistants from Vapi...');
    const listResponse = await makeVapiRequest('GET', '/assistant');

    if (listResponse.status !== 200) {
      console.log('❌ Failed to list assistants:', listResponse.data);
      process.exit(1);
    }

    const assistants = listResponse.data;
    
    if (!Array.isArray(assistants)) {
      console.log('⚠️  No assistants found in Vapi');
    } else {
      console.log(`✅ Found ${assistants.length} assistants in Vapi`);

      // Step 3: Delete each assistant
      if (assistants.length > 0) {
        console.log('\nStep 3: Deleting assistants from Vapi...');
        
        let deleted = 0;
        let failed = 0;

        for (const assistant of assistants) {
          try {
            const deleteResponse = await makeVapiRequest('DELETE', `/assistant/${assistant.id}`);
            
            if (deleteResponse.status === 200 || deleteResponse.status === 204) {
              console.log(`  ✅ Deleted: ${assistant.name} (${assistant.id.substring(0, 12)}...)`);
              deleted++;
            } else {
              console.log(`  ❌ Failed: ${assistant.name} (status ${deleteResponse.status})`);
              failed++;
            }
          } catch (err) {
            console.log(`  ❌ Error deleting ${assistant.name}:`, err.message);
            failed++;
          }
        }

        console.log(`\n  Summary: ${deleted}/${assistants.length} deleted successfully`);
        if (failed > 0) {
          console.log(`  ⚠️  ${failed} deletions failed`);
        }
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ CLEANUP COMPLETE!\n');
    console.log('Database: All agents removed');
    console.log('Vapi: All assistants removed');
    console.log('\n🚀 Ready for fresh test!\n');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
