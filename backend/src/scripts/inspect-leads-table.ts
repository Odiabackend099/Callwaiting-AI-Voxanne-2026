
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function inspectLeads() {
    console.log('🔍 Inspecting Leads Table...\n');

    // Check if leads table exists
    const { data: leads, error } = await supabase
        .from('leads')
        .select('*')
        .limit(5);

    if (error) {
        console.error('❌ Error fetching leads:', error.message);
        // If leads doesn't exist, maybe it's contacts?
        console.log('   Checking contacts table as fallback...');
        const { data: contacts, error: contactError } = await supabase
            .from('contacts')
            .select('*')
            .limit(5);

        if (contactError) {
            console.error('   ❌ Error fetching contacts:', contactError.message);
        } else {
            console.log(`   ✅ Contacts table exists with ${contacts?.length} records.`);
        }
        return;
    }

    console.log(`✅ Leads table exists with ${leads?.length} records.`);

    // Search for Sebastian in leads
    console.log('\n👤 Searching for Sebastian in leads...');
    const { data: sebastian, error: searchError } = await supabase
        .from('leads')
        .select('*')
        .ilike('name', '%Sebastian%');

    if (searchError) {
        console.error('❌ Error searching Sebastian:', searchError.message);
    } else if (sebastian && sebastian.length > 0) {
        console.log('✅ Found Sebastian in leads:', sebastian);
        // Check appointments for this lead
        const leadId = sebastian[0].id;
        const { data: appts } = await supabase
            .from('appointments')
            .select('*')
            .eq('contact_id', leadId);
        console.log('   📅 Appointments:', appts);
    } else {
        console.log('❌ Sebastian NOT found in leads.');
    }

    // Search for Austin in leads
    console.log('\n👤 Searching for Austin in leads...');
    const { data: austin } = await supabase
        .from('leads')
        .select('*')
        .ilike('name', '%Austin%');

    if (austin && austin.length > 0) {
        console.log('✅ Found Austin in leads:', austin);
    }
}

inspectLeads();
