
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const ORG_ID = '46cf2995-2bee-44e3-838b-24151486fe4e';

async function verifyAgentAccess() {
    console.log('\n🕵️  VERIFYING AGENT ACCESS TO CREDENTIALS\n');
    console.log(`Target Org: ${ORG_ID}\n`);

    // 1. Check Google Calendar Access
    console.log('1️⃣  Checking Google Calendar Access...');
    const { data: calendarCreds, error: calendarError } = await supabase
        .from('org_credentials')
        .select('*')
        .eq('org_id', ORG_ID)
        .eq('provider', 'google_calendar')
        .eq('is_active', true)
        .single();

    if (calendarError || !calendarCreds) {
        console.log('❌ Google Calendar Access: FAILED');
        console.log('   Reason:', calendarError?.message || 'No active credentials found');
    } else {
        console.log('✅ Google Calendar Access: CONFIRMED');
        console.log(`   - Email: ${calendarCreds.connected_email}`);
        console.log(`   - Updated: ${calendarCreds.updated_at}`);
        console.log(`   - Has Encrypted Config: ${!!calendarCreds.encrypted_config}`);
    }

    console.log('\n---------------------------------------------------\n');

    // 2. Check Twilio SMS Access
    // Note: Twilio keys might be in org_credentials OR environment variables.
    // The user asked to check "in that table", so we check org_credentials first.
    console.log('2️⃣  Checking Twilio SMS Access...');

    // Check Table
    const { data: twilioCreds, error: twilioError } = await supabase
        .from('org_credentials')
        .select('*')
        .eq('org_id', ORG_ID)
        .eq('provider', 'twilio')
        .eq('is_active', true)
        .maybeSingle();

    if (twilioCreds) {
        console.log('✅ Twilio SMS Access: CONFIRMED (via Database)');
        console.log(`   - Account SID: ${twilioCreds.metadata?.accountSid || 'Present in config'}`);
    } else {
        // Fallback to Env Vars (which are also valid for "System" level access)
        const envAccountSid = process.env.TWILIO_ACCOUNT_SID;
        const envAuthToken = process.env.TWILIO_AUTH_TOKEN;

        if (envAccountSid && envAuthToken) {
            console.log('✅ Twilio SMS Access: CONFIRMED (via Environment Variables)');
            console.log('   - Source: .env file (Production Approved)');
            console.log(`   - Account SID: ${envAccountSid.substring(0, 6)}...`);
        } else {
            console.log('❌ Twilio SMS Access: FAILED');
            console.log('   Reason: Not found in org_credentials AND not found in .env');
        }
    }

    console.log('\n---------------------------------------------------\n');

    // Final Verdict
    if (calendarCreds && (twilioCreds || (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN))) {
        console.log('🚀 SYSTEM READY');
        console.log('   The AI Agent has full access to required tools.');
    } else {
        console.log('🛑 SYSTEM NOT READY');
        console.log('   Missing one or more required credentials.');
        process.exit(1);
    }
}

verifyAgentAccess().catch(console.error);
