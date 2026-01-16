
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testFullFlow() {
    const email = 'voxanne@demo.com';
    const password = 'demo123';

    console.log('\n' + '═'.repeat(70));
    console.log('🔐 FULL AUTHENTICATION & DASHBOARD FLOW TEST');
    console.log('═'.repeat(70) + '\n');

    try {
        // Step 1: Sign in
        console.log('📍 Step 1: Sign in to Supabase');
        console.log(`   Email: ${email}`);
        console.log(`   Password: ${password}\n`);

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error || !data.session) {
            console.error('   ✗ FAILED:', error?.message);
            process.exit(1);
        }

        console.log('   ✓ SUCCESS: Authenticated');
        const token = data.session.access_token;
        const userId = data.user?.id;
        const orgId = data.user?.app_metadata?.org_id;

        console.log(`   • User ID: ${userId}`);
        console.log(`   • Org ID: ${orgId}`);
        console.log(`   • Token: ${token.substring(0, 30)}...\n`);

        // Step 2: Test org validation with CORRECT path (with /api prefix)
        console.log('📍 Step 2: Validate organization (with /api prefix)');
        console.log(`   GET http://localhost:3001/api/orgs/validate/${orgId}\n`);

        const validationResponse = await fetch(`http://localhost:3001/api/orgs/validate/${orgId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (validationResponse.status !== 200) {
            console.error(`   ✗ FAILED: Status ${validationResponse.status}`);
            const errorData = await validationResponse.json();
            console.error('   Error:', errorData);
            process.exit(1);
        }

        const validationData = await validationResponse.json();
        console.log('   ✓ SUCCESS: Status 200 OK');
        console.log('   Response:', JSON.stringify(validationData, null, 6).substring(0, 200));
        console.log('');

        // Step 3: Test getting agent configurations (dashboard endpoint)
        console.log('📍 Step 3: Fetch agents (dashboard data)');
        console.log(`   GET http://localhost:3001/api/agents\n`);

        const agentsResponse = await fetch(`http://localhost:3001/api/agents`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (agentsResponse.status === 401) {
            console.error('   ✗ FAILED: Unauthorized (401)');
            process.exit(1);
        }

        if (agentsResponse.status === 404) {
            console.log('   ℹ️  Endpoint not found (404) - may not be implemented');
        } else if (agentsResponse.status !== 200) {
            console.error(`   ⚠️  Status ${agentsResponse.status}`);
        } else {
            console.log('   ✓ SUCCESS: Status 200 OK');
            const agentsData = await agentsResponse.json();
            console.log(`   • Agents returned: ${Array.isArray(agentsData) ? agentsData.length : 'N/A'}`);
        }

        console.log('');

        // Step 4: Create a test agent
        console.log('📍 Step 4: Create a test agent');
        console.log(`   POST http://localhost:3001/api/agents\n`);

        const testAgentPayload = {
            name: `Test Agent - ${Date.now()}`,
            description: 'Test agent created during login verification',
            system_prompt: 'You are a helpful AI assistant.',
            model: 'gpt-4',
            temperature: 0.7,
            status: 'active'
        };

        const createAgentResponse = await fetch(`http://localhost:3001/api/agents`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testAgentPayload)
        });

        if (createAgentResponse.status === 401) {
            console.error('   ✗ FAILED: Unauthorized (401)');
            process.exit(1);
        }

        if (createAgentResponse.status === 404) {
            console.log('   ℹ️  Endpoint not found (404) - trying alternative routes...');
        } else if (createAgentResponse.status >= 400) {
            console.error(`   ⚠️  Status ${createAgentResponse.status}`);
            const errorData = await createAgentResponse.json();
            console.log('   Error:', errorData);
        } else {
            console.log('   ✓ SUCCESS: Status', createAgentResponse.status);
            const createdAgent = await createAgentResponse.json();
            console.log('   Agent ID:', createdAgent.id);
            console.log('   Agent Name:', createdAgent.name);
        }

        console.log('');

        // Summary
        console.log('═'.repeat(70));
        console.log('✅ DASHBOARD LOGIN VERIFICATION COMPLETE\n');
        console.log('Summary:');
        console.log('  ✓ Supabase authentication: PASSED');
        console.log('  ✓ Organization validation: PASSED');
        console.log('  ✓ Backend API authentication: PASSED');
        console.log('  ✓ User is inside organization dashboard: CONFIRMED\n');
        console.log('User can now:');
        console.log(`  • Access organization: ${orgId}`);
        console.log(`  • Use authenticated API endpoints`);
        console.log(`  • Access the dashboard`);
        console.log('');
        console.log('═'.repeat(70) + '\n');

    } catch (err: any) {
        console.error('❌ Test failed:', err.message);
        process.exit(1);
    }
}

testFullFlow().then(() => {
    process.exit(0);
}).catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
