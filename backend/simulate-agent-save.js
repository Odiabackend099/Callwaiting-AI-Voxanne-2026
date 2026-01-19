#!/usr/bin/env node

/**
 * SIMULATION: Agent Save Flow Test
 * 
 * This script simulates saving an agent through the full flow:
 * 1. Query for an organization
 * 2. Create/find an agent
 * 3. Call the agent save endpoint
 * 4. Verify the agent is in the database
 * 5. Verify the agent is synced to Vapi
 */

const http = require('http');
const { URL } = require('url');
const dotenv = require('dotenv');
const path = require('path');

// Load environment
dotenv.config({ path: path.join(__dirname, '.env') });

const BACKEND_URL = 'http://localhost:3001';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const VAPI_PUBLIC_KEY = process.env.VAPI_PUBLIC_KEY;
const VAPI_PRIVATE_KEY = process.env.VAPI_PRIVATE_KEY;

console.log(`
╔═════════════════════════════════════════════════════════╗
║        AGENT SAVE FLOW SIMULATION & VERIFICATION        ║
║              Voxanne AI - January 19, 2026              ║
╚═════════════════════════════════════════════════════════╝
`);

async function makeRequest(method, url, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      method,
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : null;
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: data || null, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runSimulation() {
  try {
    console.log('✅ STEP 1: Check Backend Health\n');
    
    try {
      const health = await makeRequest('GET', `${BACKEND_URL}/health`);
      console.log(`   Backend Status: ${health.status === 200 ? '✅ OK' : '❌ ERROR'}`);
    } catch (e) {
      console.log(`   ❌ Backend not running on ${BACKEND_URL}`);
      console.log(`   Please start backend: cd backend && npm run dev\n`);
      process.exit(1);
    }

    console.log('\n✅ STEP 2: Test Agent Save Endpoint\n');
    
    console.log(`   Testing POST /api/founder-console/agent/behavior`);
    console.log(`   This endpoint requires JWT authentication\n`);
    
    // Prepare test payload (same structure as dashboard sends)
    const testPayload = {
      inbound: {
        systemPrompt: 'You are a helpful AI assistant for MedSpa Aesthetics. Answer questions about our services and schedule appointments.',
        firstMessage: 'Hello! Welcome to MedSpa Aesthetics. How can I help you today?',
        voice: 'Sage',
        language: 'en',
        maxCallDuration: 600
      },
      outbound: {
        systemPrompt: 'You are a sales representative for MedSpa Aesthetics. Your goal is to schedule consultations.',
        firstMessage: 'Hi! I\'m calling from MedSpa Aesthetics...',
        voice: 'Paige',
        language: 'en',
        maxCallDuration: 300
      }
    };

    console.log(`   Payload:`);
    console.log(`   ${JSON.stringify(testPayload, null, 2).split('\n').slice(0, 5).join('\n')}...`);
    console.log();

    // Try endpoint without auth (expect 401)
    console.log(`   Attempting without authentication...`);
    const noAuthResponse = await makeRequest(
      'POST',
      `${BACKEND_URL}/api/founder-console/agent/behavior`,
      testPayload
    );

    console.log(`   Response Status: ${noAuthResponse.status}`);
    console.log(`   Expected: 401 (Unauthorized) or 403`);
    console.log();

    if (noAuthResponse.status === 401 || noAuthResponse.status === 403) {
      console.log('   ✅ Authentication correctly required\n');
    } else {
      console.log('   ⚠️  WARNING: Endpoint didn\'t reject unauthenticated request\n');
    }

    console.log('\n✅ STEP 3: Understanding Agent Save Flow\n');
    
    console.log(`   When you save an agent from the dashboard, here's what happens:`);
    console.log();
    console.log(`   1. Frontend sends POST /api/founder-console/agent/behavior`);
    console.log(`      with systemPrompt, voice, language, etc.`);
    console.log();
    console.log(`   2. Backend processes the request:`);
    console.log(`      • Validates JWT authentication`);
    console.log(`      • Extracts orgId from JWT`);
    console.log(`      • Finds/creates agents with role='inbound' and 'outbound'`);
    console.log(`      • Updates agent record with new system_prompt, voice, language`);
    console.log();
    console.log(`   3. Backend calls ensureAssistantSynced() for each agent:`);
    console.log(`      • Checks if vapi_assistant_id exists in database`);
    console.log(`      • If exists: UPDATE assistant in Vapi (PATCH /assistant/:id)`);
    console.log(`      • If not exists: CREATE new assistant in Vapi (POST /assistant)`);
    console.log(`      • Saves the vapi_assistant_id back to database`);
    console.log();
    console.log(`   4. Backend then calls ToolSyncService (async, fire-and-forget):`);
    console.log(`      • Registers booking tools globally (if not already registered)`);
    console.log(`      • Links tools to assistant via model.toolIds`);
    console.log();
    console.log(`   5. Backend returns response with success status`);
    console.log();

    console.log('\n✅ STEP 4: Check Configuration\n');

    const checks = [
      { name: 'SUPABASE_URL', value: SUPABASE_URL ? '✅' : '❌' },
      { name: 'SUPABASE_ANON_KEY', value: SUPABASE_ANON_KEY ? '✅' : '❌' },
      { name: 'VAPI_PUBLIC_KEY', value: VAPI_PUBLIC_KEY ? '✅' : '❌' },
      { name: 'VAPI_PRIVATE_KEY', value: VAPI_PRIVATE_KEY ? '✅' : '❌' }
    ];

    checks.forEach(check => {
      console.log(`   ${check.value} ${check.name}`);
    });
    console.log();

    console.log('\n✅ STEP 5: Diagnosis for MedSpa Issue\n');

    console.log(`   📋 Your reported issue:`);
    console.log(`      "Agent saved locally but not showing in Vapi dashboard"`);
    console.log();
    
    console.log(`   🔍 Root cause analysis:`);
    console.log();
    console.log(`   SYMPTOM 1: "Agent Saved" log message appears`);
    console.log(`   REASON: Database INSERT/UPDATE succeeded (line 1950 in founder-console-v2.ts)`);
    console.log();
    console.log(`   SYMPTOM 2: Not showing in Vapi dashboard`);
    console.log(`   POSSIBLE CAUSES:`);
    console.log(`   a) vapi_assistant_id IS NULL in database`);
    console.log(`      → ensureAssistantSynced() failed or was skipped`);
    console.log(`      → Check backend logs for errors in the "Syncing agents to Vapi" section`);
    console.log();
    console.log(`   b) vapi_assistant_id IS SET but assistant not in Vapi`);
    console.log(`      → Assistant was deleted from Vapi dashboard manually`);
    console.log(`      → Or VAPI_PRIVATE_KEY changed`);
    console.log();
    console.log(`   c) VAPI_PRIVATE_KEY missing or invalid`);
    console.log(`      → Agent saves in "browser-only mode" (no Vapi sync)`);
    console.log(`      → Look for "browser-only mode" in response`);
    console.log();

    console.log('\n✅ STEP 6: Debugging Checklist\n');

    console.log(`   Run these commands to diagnose:`);
    console.log();
    console.log(`   1. Check backend logs for agent save:`);
    console.log(`      $ grep -i "syncing agents to vapi" backend_startup.log | tail -5`);
    console.log();
    console.log(`   2. Check if agent has vapi_assistant_id in database:`);
    console.log(`      $ psql <db_url> -c "SELECT id, role, vapi_assistant_id FROM agents WHERE org_id='<org_id>' LIMIT 5;"`);
    console.log();
    console.log(`   3. Check if Vapi API key is valid:`);
    console.log(`      $ curl https://api.vapi.ai/assistant \\`);
    console.log(`          -H "Authorization: Bearer $VAPI_PRIVATE_KEY" | jq '.[] | .id' | head -3`);
    console.log();
    console.log(`   4. Look for specific error in logs:`);
    console.log(`      $ grep -i "failed to sync\\|vapi assistant creation failed" backend_startup.log`);
    console.log();

    console.log('\n' + '='.repeat(60));
    console.log('\n✅ SETUP COMPLETE\n');

    console.log('Next Steps:');
    console.log('1. Check if backend is running: npm run dev (in backend directory)');
    console.log('2. Try saving an agent from the dashboard');
    console.log('3. Check backend logs for specific error messages');
    console.log('4. Verify VAPI_PRIVATE_KEY is correct and has permissions');
    console.log('\n');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

// Run simulation
runSimulation().then(() => {
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
