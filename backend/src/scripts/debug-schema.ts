
import { supabase } from '../services/supabase-client';

async function checkSchema() {
    console.log('Checking agents table schema...');

    // Try to select the status column specifically
    const { data, error } = await supabase
        .from('agents')
        .select('id, status, name')
        .limit(1);

    if (error) {
        console.error('Error fetching agents:', error);
    } else {
        console.log('Successfully fetched agents:', data);
    }

    // Initial call often fails if cache is stale, sometimes purely making a request helps, 
    // but usually we need the NOTIFY command.
    // Since we can't easily run raw SQL from the client without an RPC, 
    // we will just log the status here.
}

checkSchema();
