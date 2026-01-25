
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function verifyAppointment() {
    console.log('🔍 Verifying Appointment in Database...\n');

    const searchCriteria = {
        patientName: 'Austin',
        phone: '+2348141995397',
        targetDate: '2026-01-30',
        targetTime: '10:00'
    };

    console.log('Search Criteria:', searchCriteria);

    // 1. Find Contact
    console.log('\n👤 Searching for Contact...');

    // Normalize phone for search (remove +)
    const phoneSearch = searchCriteria.phone.replace('+', '');

    const { data: contacts, error: contactError } = await supabase
        .from('contacts')
        .select('*')
        .or(`phone.ilike.%${phoneSearch}%,name.ilike.%${searchCriteria.patientName}%`)
        .limit(5);

    if (contactError) {
        console.error('❌ Error searching contacts:', contactError.message);
        return;
    }

    if (!contacts || contacts.length === 0) {
        console.log('❌ No contact found matching phone or name.');
        return;
    }

    console.log(`✅ Found ${contacts.length} potential contact(s):`);

    for (const contact of contacts) {
        console.log(`   - Contact ID: ${contact.id}`);
        console.log(`     Name: ${contact.name}`);
        console.log(`     Phone: ${contact.phone}`);
        console.log(`     Org: ${contact.org_id}`);

        // 2. Find Appointments for this Contact
        const { data: appts, error: apptError } = await supabase
            .from('appointments')
            .select('*')
            .eq('contact_id', contact.id)
            .order('created_at', { ascending: false });

        if (apptError) {
            console.error(`     ❌ Error fetching appointments: ${apptError.message}`);
            continue;
        }

        if (appts && appts.length > 0) {
            console.log(`     📅 Found ${appts.length} appointment(s):`);
            appts.forEach(appt => {
                console.log(`       - Appt ID: ${appt.id}`);
                console.log(`         Scheduled: ${appt.scheduled_at}`);
                console.log(`         Status: ${appt.status}`);
                console.log(`         Created: ${appt.created_at}`);

                // Check if it matches target date
                if (appt.scheduled_at.includes(searchCriteria.targetDate)) {
                    console.log('         ✅ MATCHES TARGET DATE!');
                }
            });
        } else {
            console.log('     ⚠️  No appointments found for this contact.');
        }
    }
}

verifyAppointment();
