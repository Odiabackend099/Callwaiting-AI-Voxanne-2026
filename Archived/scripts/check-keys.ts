
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

async function checkIntegrations() {
    const { data, error } = await supabase
        .from('integrations')
        .select('*')
        .eq('provider', 'vapi');

    if (error) {
        console.error('DB Error:', error);
        return;
    }

    const envKey = process.env.VAPI_API_KEY;
    console.log('ENV Key:', envKey ? `${envKey.substring(0, 8)}...` : 'Missing');

    if (data && data.length > 0) {
        data.forEach(row => {
            const config = row.config || {};
            const dbKey = config.vapi_api_key || config.vapi_secret_key;
            console.log(`DB Key (Org ${row.org_id}):`, dbKey ? `${dbKey.substring(0, 8)}...` : 'Missing');

            if (dbKey !== envKey) {
                console.error('MISMATCH DETECTED!');
            } else {
                console.log('Keys match.');
            }
        });
    } else {
        console.log('No Vapi integration found in DB.');
    }
}

checkIntegrations();
