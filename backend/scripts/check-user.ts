import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkUser() {
    const email = 'callwaitingai@gmail.com';
    console.log(`Checking for user: ${email}`);

    // 1. Check Auth Users
    const { data: { users }, error } = await supabase.auth.admin.listUsers();

    if (error) {
        console.error('Error listing users:', error);
        return;
    }

    const user = users.find(u => u.email === email);

    if (!user) {
        console.log('❌ User not found in auth.users');
        return;
    }

    console.log(`✅ User Found: ${user.id}`);

    // 2. Check Agents
    const { data: agents } = await supabase.from('agents').select('*').eq('user_id', user.id);
    console.log(`Agents found: ${agents?.length || 0}`);
    if (agents && agents.length > 0) {
        agents.forEach(a => console.log(` - Agent: ${a.name} (Vapi ID: ${a.vapi_assistant_id})`));
    }

    // 3. Check KB Files
    const { data: kbFiles, error: kbError } = await supabase.from('knowledge_base').select('*').eq('user_id', user.id);

    if (kbError) {
        console.log("Error checking KB files:", kbError.message);
    } else {
        console.log(`Knowledge Base Files: ${kbFiles?.length || 0}`);
        kbFiles?.forEach(f => console.log(` - File: ${f.filename} (ID: ${f.id})`));
    }
}

checkUser();
