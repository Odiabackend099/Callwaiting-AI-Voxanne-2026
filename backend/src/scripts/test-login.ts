
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

async function testLogin() {
    const email = 'voxanne@demo.com';
    const password = 'demo123';

    console.log('🔐 Testing Login Flow\n');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}\n`);

    try {
        console.log('Step 1: Attempting sign-in with Supabase...');
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            console.error('❌ Sign-in failed:', error.message);
            console.error('Error details:', error);
            return;
        }

        if (!data.user) {
            console.error('❌ No user returned from sign-in');
            return;
        }

        console.log('✅ Sign-in successful!');
        console.log('\nUser Details:');
        console.log(`  - ID: ${data.user.id}`);
        console.log(`  - Email: ${data.user.email}`);
        console.log(`  - Email Confirmed: ${data.user.email_confirmed_at ? 'Yes' : 'No'}`);

        if (data.user.app_metadata) {
            console.log(`  - App Metadata:`, JSON.stringify(data.user.app_metadata, null, 2));
        }

        if (!data.session) {
            console.error('❌ No session returned from sign-in');
            return;
        }

        console.log('\nSession Details:');
        console.log(`  - Access Token: ${data.session.access_token.substring(0, 20)}...`);
        console.log(`  - Token Type: ${data.session.token_type}`);
        console.log(`  - Expires In: ${data.session.expires_in} seconds`);

        // Try to extract org_id from JWT
        const tokenParts = data.session.access_token.split('.');
        if (tokenParts.length === 3) {
            try {
                const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
                console.log('\nJWT Payload:');
                console.log(`  - User ID: ${payload.sub}`);
                console.log(`  - Email: ${payload.email}`);
                if (payload.app_metadata?.org_id) {
                    console.log(`  - Org ID: ${payload.app_metadata.org_id}`);
                } else {
                    console.log('  - ⚠️  Missing org_id in app_metadata!');
                }
            } catch (e) {
                console.error('Could not decode JWT payload');
            }
        }

        // Now test backend auth
        console.log('\n\nStep 2: Testing Backend Authentication...');
        console.log(`Testing with token: ${data.session.access_token.substring(0, 20)}...`);

        const backendUrl = 'http://localhost:3001';
        const response = await fetch(`${backendUrl}/api/status`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${data.session.access_token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log(`Backend response status: ${response.status}`);
        const responseData = await response.json();
        console.log('Backend response:', JSON.stringify(responseData, null, 2));

        if (response.ok) {
            console.log('✅ Backend authentication successful!');
        } else {
            console.error('❌ Backend authentication failed!');
        }

    } catch (err: any) {
        console.error('❌ Error during login test:', err.message);
        console.error('Full error:', err);
    }
}

testLogin()
    .then(() => {
        console.log('\n✅ Login test complete');
        process.exit(0);
    })
    .catch(err => {
        console.error('❌ Test failed:', err);
        process.exit(1);
    });
