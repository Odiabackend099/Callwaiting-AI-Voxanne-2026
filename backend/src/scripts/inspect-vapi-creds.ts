
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables BEFORE other imports
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { createClient } from '@supabase/supabase-js';

const ORG_ID = "46cf2995-2bee-44e3-838b-24151486fe4e";

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function inspectCredentials() {
    console.log("🔍 Inspecting Vapi Credentials for Org:", ORG_ID);

    // Check integration_settings
    const { data: settings, error: settingsError } = await supabase
        .from('integration_settings')
        .select('*')
        .eq('org_id', ORG_ID)
        .eq('provider', 'vapi');

    console.log("integration_settings:", settings);
    if (settingsError) console.error("Error:", settingsError);

    // Check integrations (legacy?)
    const { data: integrations, error: integrationsError } = await supabase
        .from('integrations')
        .select('*')
        .eq('org_id', ORG_ID)
        .eq('provider', 'vapi');

    console.log("integrations:", integrations);
    if (integrationsError) console.error("Error:", integrationsError);
}

inspectCredentials();
