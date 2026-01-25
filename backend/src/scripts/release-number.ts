
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { config } from '../config/index';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const vapiPrivateKey = process.env.VAPI_PRIVATE_KEY;

if (!supabaseUrl || !supabaseServiceKey || !vapiPrivateKey) {
    console.error('❌ Missing credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const ORG_ID = '46cf2995-2bee-44e3-838b-24151486fe4e';
const PHONE_NUMBER = '+14422526073';

async function releaseNumber() {
    console.log(`\n🗑️  RELEASING NUMBER: ${PHONE_NUMBER}\n`);

    // 1. Find Number in Vapi
    console.log('1️⃣  Searching in Vapi...');
    try {
        const listRes = await fetch('https://api.vapi.ai/phone-number', {
            headers: {
                'Authorization': `Bearer ${vapiPrivateKey}`,
                'Content-Type': 'application/json'
            }
        });

        if (!listRes.ok) throw new Error(`Vapi List Failed: ${listRes.statusText}`);

        const numbers = await listRes.json();
        const match = numbers.find((p: any) => p.number === PHONE_NUMBER);

        if (match) {
            console.log(`   ✅ Found in Vapi (ID: ${match.id})`);
            console.log('   🗑️  Deleting from Vapi...');

            const deleteRes = await fetch(`https://api.vapi.ai/phone-number/${match.id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${vapiPrivateKey}`
                }
            });

            if (deleteRes.ok) {
                console.log('   ✅ Deleted from Vapi');
            } else {
                console.error(`   ❌ Failed to delete from Vapi: ${await deleteRes.text()}`);
            }
        } else {
            console.log('   ℹ️  Not found in Vapi (already released?)');
        }
    } catch (error: any) {
        console.error('   ❌ Vapi Error:', error.message);
    }

    console.log('\n---------------------------------------------------\n');

    // 2. Clean Database
    console.log('2️⃣  Cleaning Database...');

    // Delete from integrations (twilio_inbound)
    const { error: intError } = await supabase
        .from('integrations')
        .delete()
        .eq('org_id', ORG_ID)
        .eq('provider', 'twilio_inbound');

    if (intError) console.error('   ❌ Failed to delete from integrations:', intError.message);
    else console.log('   ✅ Deleted from integrations (twilio_inbound)');

    // Delete from user_phone_numbers
    const { error: upnError } = await supabase
        .from('user_phone_numbers')
        .delete()
        .eq('org_id', ORG_ID)
        .eq('phone_number', PHONE_NUMBER);

    if (upnError) console.error('   ❌ Failed to delete from user_phone_numbers:', upnError.message);
    else console.log('   ✅ Deleted from user_phone_numbers');

    // Note: We DO NOT delete from org_credentials (provider='twilio') because those are the API Keys.
    // The user likely wants to keep the keys but reset the *number assignment*.
    // If they want to delete keys too, they can do that in the dashboard.
    // But the prompt said "Delete the number", not "Delete the credentials".

    console.log('\n---------------------------------------------------\n');
    console.log('🚀 CLEANUP COMPLETE');
}

releaseNumber().catch(console.error);
