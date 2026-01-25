
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkRecentContacts() {
    console.log('🔍 Checking Recent Contacts (Last 1 Hour)...\n');

    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();

    const { data: contacts, error } = await supabase
        .from('contacts')
        .select('*')
        .gt('created_at', oneHourAgo)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('❌ Error fetching contacts:', error.message);
        return;
    }

    console.log(`✅ Found ${contacts?.length} recent contacts:`);
    contacts?.forEach(c => {
        console.log(`- Name: ${c.name}`);
        console.log(`  Phone: ${c.phone}`);
        console.log(`  Org: ${c.org_id}`);
        console.log(`  Created: ${c.created_at}`);
        console.log('---');
    });

    // Also check appointments
    console.log('\n🔍 Checking Recent Appointments (Last 1 Hour)...');
    const { data: appts } = await supabase
        .from('appointments')
        .select('*')
        .gt('created_at', oneHourAgo)
        .order('created_at', { ascending: false });

    console.log(`✅ Found ${appts?.length} recent appointments:`);
    appts?.forEach(a => {
        console.log(`- Scheduled: ${a.scheduled_at}`);
        console.log(`  Contact ID: ${a.contact_id}`);
        console.log(`  Status: ${a.status}`);
        console.log(`  Created: ${a.created_at}`);
        console.log('---');
    });
}

checkRecentContacts();
