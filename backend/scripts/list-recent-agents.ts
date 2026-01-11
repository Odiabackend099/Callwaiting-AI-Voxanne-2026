import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function listRecentAgents() {
    console.log('\n🔎 Listing top 5 most recently updated agents...');

    // Get latest updated agents
    const { data: agents, error } = await supabase
        .from('agents')
        .select('id, name, updated_at, vapi_assistant_id')
        .order('updated_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error("❌ DB Error:", error.message);
        return;
    }

    console.table(agents);
}

listRecentAgents();
