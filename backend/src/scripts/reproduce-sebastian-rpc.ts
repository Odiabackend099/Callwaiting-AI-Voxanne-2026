
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function reproduceSebastian() {
    console.log('🧪 Reproducing Sebastian Booking...\n');

    const phone = '+2348141995397'; // Austin's phone
    const name = 'Sebastian';
    const orgId = '46cf2995-2bee-44e3-838b-24151486fe4e';
    const scheduledAt = '2026-03-01T12:00:00Z'; // March 1st

    const rpcParams = {
        p_org_id: orgId,
        p_patient_name: name,
        p_patient_email: 'sebastian@gmail.com',
        p_patient_phone: phone,
        p_service_type: 'Botox',
        p_scheduled_at: scheduledAt,
        p_duration_minutes: 30
    };

    console.log('Calling RPC with:', rpcParams);

    const { data, error } = await supabase.rpc('book_appointment_atomic', rpcParams);

    if (error) {
        console.error('❌ RPC Failed:', error.message);
        return;
    }

    console.log('✅ RPC Success:', data);

    // Verify update
    console.log('\n🔍 Verifying Contact Update...');
    const { data: contact } = await supabase
        .from('contacts')
        .select('*')
        .eq('phone', phone)
        .single();

    console.log('Contact Name:', contact?.name); // Should be Sebastian
    console.log('Contact ID:', contact?.id);

    // Verify appointment
    console.log('\n🔍 Verifying Appointment...');
    const { data: appts } = await supabase
        .from('appointments')
        .select('*')
        .eq('contact_id', contact?.id)
        .order('created_at', { ascending: false });

    console.log('Appointments:', appts?.length);
    appts?.forEach(a => console.log(`- ${a.scheduled_at} (${a.status})`));
}

reproduceSebastian();
