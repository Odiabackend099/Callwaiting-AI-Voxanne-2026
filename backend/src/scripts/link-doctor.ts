
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { EncryptionService } from '../services/encryption';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function linkDoctor() {
    console.log('🩺 Link Doctor: Checking Google Calendar Tokens...\n');

    // Get all credentials
    const { data: credentials, error } = await supabase
        .from('org_credentials')
        .select('*')
        .eq('provider', 'google_calendar')
        .eq('is_active', true);

    if (error) {
        console.error('❌ Error fetching credentials:', error.message);
        return;
    }

    console.log(`Found ${credentials?.length} active connections.\n`);

    for (const cred of credentials || []) {
        console.log(`🏥 Checking Org: ${cred.org_id}`);
        console.log(`   Email (Column): ${cred.connected_email || 'MISSING'}`);

        if (!cred.encrypted_config) {
            console.log('   ❌ No encrypted config found!');
            continue;
        }

        try {
            // Decrypt config
            // Note: EncryptionService might need initialization or secrets
            // We assume it works with env vars loaded
            const config = EncryptionService.decryptObject(cred.encrypted_config);

            const hasAccessToken = !!config.accessToken || !!config.access_token;
            const hasRefreshToken = !!config.refreshToken || !!config.refresh_token;
            const expiryDate = config.expiresAt || config.expiry_date;
            const configEmail = config.email;

            console.log(`   📧 Email (Config): ${configEmail || 'MISSING'}`);
            console.log(`   🔑 Access Token: ${hasAccessToken ? '✅ Present' : '❌ MISSING'}`);
            console.log(`   🔄 Refresh Token: ${hasRefreshToken ? '✅ Present' : '❌ MISSING (Ghost Token Risk!)'}`);

            if (expiryDate) {
                const expires = new Date(expiryDate);
                const now = new Date();
                const minutesLeft = Math.round((expires.getTime() - now.getTime()) / 60000);

                if (minutesLeft < 0) {
                    console.log(`   ⏰ Token Expired: ${Math.abs(minutesLeft)} minutes ago`);
                } else {
                    console.log(`   ⏳ Expires in: ${minutesLeft} minutes`);
                }
            } else {
                console.log('   ⚠️ No expiry date found');
            }

            // Check for issues
            const hasEmail = !!(cred.connected_email || configEmail);
            const issues = [];

            if (!hasRefreshToken) {
                issues.push('Missing Refresh Token (Ghost Token!)');
            }
            if (!hasEmail) {
                issues.push('Missing Email (userinfo.email scope not requested)');
            }

            if (issues.length > 0) {
                console.log(`   🚨 DIAGNOSIS: ${issues.join(', ')}`);
                console.log('   💡 FIX: User must re-link to grant missing permissions.');
            } else {
                console.log('   ✅ DIAGNOSIS: Healthy Connection');
            }

        } catch (decryptError: any) {
            console.log(`   ❌ Decryption Failed: ${decryptError.message}`);
        }
        console.log('--------------------------------------------------');
    }
}

linkDoctor();
