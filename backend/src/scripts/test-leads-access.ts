
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function inspectFunction() {
    console.log('🔍 Inspecting book_appointment_atomic Definition...\n');

    const { data, error } = await supabase
        .rpc('get_function_def', { func_name: 'book_appointment_atomic' });

    if (error) {
        console.error('❌ Error fetching function def (RPC method failed):', error.message);

        // Fallback: Try to create a temp function to read pg_proc? 
        // Or just assume we can't read it easily without direct SQL access.
        // Let's try to infer by calling it with invalid data and seeing the error?
        // No, that's risky.

        // Let's try to query information_schema if possible (usually restricted)
        // Actually, we can just try to run a simple test call to it and see what happens?
        // No, we want to know what table it writes to.
    } else {
        console.log('✅ Function Definition:');
        console.log(data);
    }
}

// Since we can't easily read pg_proc via client without a helper, 
// let's try to create a helper function first?
// Or better, let's just try to INSERT a dummy lead into 'leads' and see if it works.
// If 'leads' is the table, we should be able to write to it.

async function testLeadsInsert() {
    console.log('\n🧪 Testing Insert into Leads...');
    const { data, error } = await supabase
        .from('leads')
        .insert({
            org_id: '46cf2995-2bee-44e3-838b-24151486fe4e',
            name: 'Test Lead',
            phone: '+1234567890',
            email: 'test@example.com'
        })
        .select();

    if (error) {
        console.error('❌ Insert failed:', error.message);
    } else {
        console.log('✅ Insert successful:', data);
        // Clean up
        await supabase.from('leads').delete().eq('id', data[0].id);
    }
}

testLeadsInsert();
