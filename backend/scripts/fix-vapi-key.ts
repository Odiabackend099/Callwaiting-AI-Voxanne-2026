
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

async function updateKey() {
    const envKey = process.env.VAPI_API_KEY;
    if (!envKey) {
        console.error('No VAPI_API_KEY in env');
        process.exit(1);
    }

    // Update all vapi integrations
    const { error } = await supabase
        .from('integrations')
        .update({
            config: {
                vapi_api_key: envKey,
                vapi_secret_key: envKey // Ensure both fields are set for compatibility
            }
        })
        .eq('provider', 'vapi');

    if (error) {
        console.error('Failed to update:', error);
    } else {
        console.log('✅ Successfully updated Vapi API Key in database to match environment.');
    }
}

updateKey();
