
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const ORG_ID = '46cf2995-2bee-44e3-838b-24151486fe4e';

async function debugMembership() {
    console.log(`🔍 Inspecting Profiles for Org: ${ORG_ID}\n`);

    // 1. Get all profiles for this org
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('org_id', ORG_ID);

    if (error) {
        console.error('❌ Error fetching profiles:', error.message);
        return;
    }

    console.log(`Found ${profiles?.length || 0} profiles linked to this org:`);
    profiles?.forEach(p => {
        console.log(`- User ID: ${p.id}`);
        console.log(`  Email: ${p.email}`); // Assuming email is in profiles, if not we'll see undefined
        console.log(`  Role: ${p.role}`);
        console.log('---');
    });

    // 2. Check if there are any profiles at all to see structure
    const { data: anyProfile } = await supabase
        .from('profiles')
        .select('*')
        .limit(1);

    if (anyProfile && anyProfile.length > 0) {
        console.log('\n📋 Profile Schema Sample:', Object.keys(anyProfile[0]).join(', '));
    } else {
        console.log('\n⚠️ Profiles table appears empty.');
    }
}

debugMembership();
