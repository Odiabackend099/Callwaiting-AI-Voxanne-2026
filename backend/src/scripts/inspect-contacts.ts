
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function inspectContacts() {
    console.log('🔍 Inspecting Contacts Table...\n');

    const { data: contacts, error } = await supabase
        .from('contacts')
        .select('*')
        .limit(1);

    if (error) {
        console.error('❌ Error fetching contacts:', error.message);
    } else if (contacts && contacts.length > 0) {
        console.log('📋 Contacts Table Columns:');
        console.log(Object.keys(contacts[0]).join(', '));
    } else {
        console.log('⚠️ Contacts table is empty.');
    }
}

inspectContacts();
