
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function testAtomicBooking() {
    console.log('🧪 Testing book_appointment_atomic RPC...\n');

    const uniquePhone = '+19998887777';
    const uniqueName = 'Atomic Test User';
    const orgId = '46cf2995-2bee-44e3-838b-24151486fe4e';

    const rpcParams = {
        p_org_id: orgId,
        p_patient_name: uniqueName,
        p_patient_email: 'atomic@test.com',
        p_patient_phone: uniquePhone,
        p_service_type: 'test_service',
        p_scheduled_at: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        p_duration_minutes: 30
    };

    console.log('Calling RPC with:', rpcParams);

    const { data, error } = await supabase.rpc('book_appointment_atomic', rpcParams);

    if (error) {
        console.error('❌ RPC Failed:', error.message);
        return;
    }

    console.log('✅ RPC Success:', data);

    // Check where it went
    console.log('\n🔍 Checking tables...');

    // Check leads
    const { data: leads } = await supabase
        .from('leads')
        .select('*')
        .eq('phone', uniquePhone);

    if (leads && leads.length > 0) {
        console.log('✅ Found in LEADS table:', leads[0]);
    } else {
        console.log('❌ Not found in LEADS table.');
    }

    // Check contacts
    const { data: contacts } = await supabase
        .from('contacts')
        .select('*')
        .eq('phone', uniquePhone);

    if (contacts && contacts.length > 0) {
        console.log('✅ Found in CONTACTS table:', contacts[0]);
    } else {
        console.log('❌ Not found in CONTACTS table.');
    }

    // Check appointments
    // We need the ID from the RPC result to check appointments
    // The RPC result structure depends on the function definition
    // Migration says it returns JSON with 'appointment_id'
}

testAtomicBooking();
