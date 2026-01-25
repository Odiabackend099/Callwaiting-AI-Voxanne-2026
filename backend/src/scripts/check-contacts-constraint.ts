
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkConstraints() {
    console.log('🔍 Checking Contacts Table Constraints...\n');

    // We can't easily query pg_indexes via client, so we'll test it.
    // Try to insert a duplicate phone for the same org.

    const orgId = '46cf2995-2bee-44e3-838b-24151486fe4e';
    const phone = '+19998887777'; // The one we created in the atomic test

    console.log(`Attempting duplicate insert for phone: ${phone}`);

    const { data, error } = await supabase
        .from('contacts')
        .insert({
            org_id: orgId,
            name: 'Duplicate Test',
            phone: phone,
            email: 'duplicate@test.com'
        })
        .select();

    if (error) {
        console.log('❌ Insert failed (Expected if constraint exists):');
        console.log(`   Code: ${error.code}`);
        console.log(`   Message: ${error.message}`);

        if (error.code === '23505') { // Unique violation
            console.log('✅ Unique constraint CONFIRMED on contacts table.');
        } else {
            console.log('⚠️ Unexpected error code. Constraint might be missing or other issue.');
        }
    } else {
        console.log('⚠️ Insert SUCCESS (Constraint MISSING).');
        console.log('   We created a duplicate contact. Cleaning up...');
        await supabase.from('contacts').delete().eq('id', data[0].id);
    }
}

checkConstraints();
