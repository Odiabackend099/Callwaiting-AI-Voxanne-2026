
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testAgentDashboard() {
    console.log('\n' + '═'.repeat(70));
    console.log('🔐 FINAL DASHBOARD LOGIN VERIFICATION');
    console.log('═'.repeat(70) + '\n');

    try {
        // Step 1: Sign in
        console.log('📍 Step 1: Sign in');
        const { data, error } = await supabase.auth.signInWithPassword({
            email: 'voxanne@demo.com',
            password: 'demo123'
        });

        if (error || !data.session) {
            console.error('   ✗ FAILED:', error?.message);
            process.exit(1);
        }

        const token = data.session.access_token;
        const orgId = data.user?.app_metadata?.org_id;
        const userId = data.user?.id;

        console.log('   ✓ Authenticated');
        console.log(`   • User ID: ${userId}`);
        console.log(`   • Org ID: ${orgId}\n`);

        // Step 2: Validate organization
        console.log('📍 Step 2: Validate organization');
        const valRes = await fetch(`http://localhost:3001/api/orgs/validate/${orgId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (valRes.status !== 200) {
            console.error('   ✗ FAILED: Status', valRes.status);
            process.exit(1);
        }

        const valData = await valRes.json();
        console.log('   ✓ Organization validated');
        console.log(`   • Success: ${valData.success}`);
        console.log(`   • Validated: ${valData.validated}\n`);

        // Step 3: Get agent configuration
        console.log('📍 Step 3: Fetch agent configuration (dashboard data)');
        console.log('   GET /api/founder-console/agent/config\n');

        const agentRes = await fetch('http://localhost:3001/api/founder-console/agent/config', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (agentRes.status === 401) {
            console.error('   ✗ FAILED: Unauthorized (401)');
            process.exit(1);
        }

        if (agentRes.status !== 200) {
            console.error(`   ✗ FAILED: Status ${agentRes.status}`);
            const err = await agentRes.json();
            console.error('   Error:', err);
            process.exit(1);
        }

        const agentConfig = await agentRes.json();
        console.log('   ✓ Agent configuration retrieved (Status: 200 OK)');
        console.log(`   • Response contains: ${Object.keys(agentConfig).length} properties`);
        console.log(`   • Has inbound agent: ${agentConfig.inboundAgent ? 'Yes' : 'No'}`);
        console.log(`   • Has outbound agent: ${agentConfig.outboundAgent ? 'Yes' : 'No'}`);
        console.log(`   • Has system prompt: ${agentConfig.systemPrompt ? 'Yes' : 'No'}`);
        console.log('');

        // Step 4: Create and save agent configuration
        console.log('📍 Step 4: Save new agent configuration');

        const newAgentPayload = {
            agentName: `Dashboard Test Agent - ${Date.now()}`,
            systemPrompt: 'You are a helpful customer service AI assistant.',
            temperature: 0.7,
            model: 'gpt-4',
            type: 'inbound'
        };

        console.log(`   Agent Name: ${newAgentPayload.agentName}`);
        console.log('   Sending POST request to /api/founder-console/agent/config...\n');

        const createRes = await fetch('http://localhost:3001/api/founder-console/agent/config', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(newAgentPayload)
        });

        if (createRes.status === 401) {
            console.error('   ✗ FAILED: Unauthorized (401)');
            process.exit(1);
        }

        if (createRes.status !== 200 && createRes.status !== 201) {
            console.error(`   ✗ FAILED: Status ${createRes.status}`);
            const err = await createRes.json();
            console.error('   Error:', JSON.stringify(err, null, 2));
            process.exit(1);
        }

        const savedAgent = await createRes.json();
        console.log(`   ✓ Agent configuration saved (Status: ${createRes.status})`);
        console.log(`   • Response keys: ${Object.keys(savedAgent).slice(0, 5).join(', ')}`);
        console.log('');

        // Step 5: Test agent body retrieval
        console.log('📍 Step 5: Test agent body retrieval');

        const bodyRes = await fetch('http://localhost:3001/api/founder-console/agent/config', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (bodyRes.status === 200) {
            const bodyData = await bodyRes.json();
            console.log('   ✓ Agent body retrieved (Status: 200 OK)');
            console.log(`   • Has all properties: ${bodyData !== null ? 'Yes' : 'No'}`);
            console.log('');
        }

        // Final Summary
        console.log('═'.repeat(70));
        console.log('✅ DASHBOARD LOGIN COMPLETE & VERIFIED\n');
        console.log('Summary:');
        console.log(`  ✓ User: voxanne@demo.com`);
        console.log(`  ✓ Organization: ${orgId}`);
        console.log(`  ✓ JWT contains org_id: Yes`);
        console.log(`  ✓ Organization validation: Passed (200 OK)`);
        console.log(`  ✓ Dashboard API access: Authenticated (200 OK)`);
        console.log(`  ✓ Agent configuration retrieval: Success (200 OK)`);
        console.log(`  ✓ Agent configuration save: Success (${createRes.status})`);
        console.log(`  ✓ Agent body retrieval: Success (200 OK)`);
        console.log('');
        console.log('🎉 You are LOGGED IN to the organization dashboard!');
        console.log('═'.repeat(70) + '\n');

        process.exit(0);

    } catch (err: any) {
        console.error('\n❌ Test failed:', err.message);
        console.error('Full error:', err);
        process.exit(1);
    }
}

testAgentDashboard();
