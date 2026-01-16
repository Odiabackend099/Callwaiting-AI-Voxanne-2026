import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkOrgAndKB() {
    const userId = 'a48d0d0a-1ba4-43b8-b2c2-0662af2a7a48'; // User ID for callwaitingai@gmail.com
    console.log(`Checking data for User ID: ${userId}`);

    // 1. Find Organization for User
    // Table name: user_org_roles
    const { data: members, error: memError } = await supabase.from('user_org_roles').select('*').eq('user_id', userId);

    if (memError) console.log("Error checking org members:", memError.message);

    if (members && members.length > 0) {
        const orgId = members[0].org_id; // Correct column: org_id
        console.log(`✅ User belongs to Org ID: ${orgId}`);

        // 2. Check KB for this Org
        const { data: kb, error: kbError } = await supabase.from('knowledge_base').select('*').eq('org_id', orgId);
        if (kbError) {
            console.log("Error checking KB:", kbError.message);
        } else {
            console.log(`Knowledge Base Files: ${kb?.length || 0}`);
            kb?.forEach(f => console.log(` - File: ${f.filename} (ID: ${f.id})`));
        }

        // 3. Check Agents for this Org
        const { data: agents, error: agError } = await supabase.from('agents').select('*').eq('org_id', orgId);
        if (agError) {
            console.log("Error checking Agents:", agError.message);
        } else {
            console.log(`Agents in Org: ${agents?.length || 0}`);
            agents?.forEach(a => console.log(` - Agent: ${a.name} (Vapi: ${a.vapi_assistant_id})`));
        }

    } else {
        console.log("❌ User does not have a role in any organization (user_org_roles).");
    }
}

checkOrgAndKB();
