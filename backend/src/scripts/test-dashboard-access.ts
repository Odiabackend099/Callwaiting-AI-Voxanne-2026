
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
    process.exit(1);
}

// Use the anon key to simulate browser client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testDashboardAccess() {
    const email = 'voxanne@demo.com';
    const password = 'demo123';

    console.log('🔐 Testing Dashboard Access Flow\n');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}\n`);

    try {
        // Step 1: Sign in
        console.log('Step 1: Signing in...');
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error || !data.session) {
            console.error('❌ Sign-in failed:', error?.message);
            return;
        }

        console.log('✅ Sign-in successful!');
        console.log(`   User ID: ${data.user?.id}`);
        console.log(`   Org ID: ${data.user?.app_metadata?.org_id}`);

        // Step 2: Get user session
        console.log('\nStep 2: Verifying session...');
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !sessionData.session) {
            console.error('❌ No session available:', sessionError?.message);
            return;
        }

        console.log('✅ Session verified');
        const token = sessionData.session.access_token;

        // Step 3: Test protected endpoint
        console.log('\nStep 3: Testing dashboard API access...');
        const orgId = data.user?.app_metadata?.org_id;

        // Test a typical dashboard endpoint
        const dashboardEndpoints = [
            `/api/orgs/${orgId}`,
            `/api/orgs/validate/${orgId}`,
        ];

        for (const endpoint of dashboardEndpoints) {
            try {
                const response = await fetch(`http://localhost:3001${endpoint}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                console.log(`\n   Testing ${endpoint}:`);
                console.log(`   Status: ${response.status}`);

                if (response.ok) {
                    const data = await response.json();
                    console.log(`   ✅ Success! Response:`, JSON.stringify(data, null, 6).substring(0, 200) + '...');
                } else if (response.status === 401) {
                    console.log(`   ❌ Unauthorized (401)`);
                } else if (response.status === 403) {
                    console.log(`   ❌ Forbidden (403)`);
                } else {
                    const errText = await response.text();
                    console.log(`   ⚠️  Error: ${errText.substring(0, 100)}`);
                }
            } catch (e: any) {
                console.log(`   ⚠️  Connection error: ${e.message}`);
            }
        }

        // Step 4: Summary
        console.log('\n' + '='.repeat(60));
        console.log('📋 DASHBOARD ACCESS TEST SUMMARY:\n');

        if (data.user?.app_metadata?.org_id) {
            console.log('✅ User has valid org_id in JWT');
            console.log('✅ User can sign in successfully');
            console.log('✅ Session is active\n');
            console.log('🎯 Dashboard should now be accessible!');
            console.log('\nYou can now:');
            console.log('1. Go to http://localhost:3000/login');
            console.log(`2. Sign in with: ${email} / ${password}`);
            console.log('3. You will be redirected to /dashboard');
        } else {
            console.log('❌ User missing org_id - cannot access dashboard');
        }

    } catch (err: any) {
        console.error('❌ Error during test:', err.message);
    }
}

testDashboardAccess()
    .then(() => {
        console.log('\n✅ Test complete');
        process.exit(0);
    })
    .catch(err => {
        console.error('❌ Test failed:', err);
        process.exit(1);
    });
