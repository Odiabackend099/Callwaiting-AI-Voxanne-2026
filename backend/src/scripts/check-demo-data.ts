import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkData() {
  try {
    // Find demo org
    const { data: orgs, error: orgError } = await supabase
      .from('organizations')
      .select('id, name')
      .ilike('name', '%demo%')
      .limit(5);

    console.log('\n=== Organizations with "demo" in name ===');
    console.log(JSON.stringify(orgs, null, 2));

    if (!orgs || orgs.length === 0) {
      console.log('\nNo demo organizations found. Checking all orgs...');
      const { data: allOrgs } = await supabase
        .from('organizations')
        .select('id, name')
        .limit(10);
      console.log(JSON.stringify(allOrgs, null, 2));
    }

    // Check if voxanne@demo.com profile exists
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, org_id')
      .eq('email', 'voxanne@demo.com')
      .single();

    console.log('\n=== Profile for voxanne@demo.com ===');
    console.log(JSON.stringify(profile, null, 2));

    if (profile?.org_id) {
      // Count calls for this org
      const { count } = await supabase
        .from('calls')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', profile.org_id);

      console.log(`\n=== Call count for org ${profile.org_id} ===`);
      console.log(`Total calls: ${count}`);

      // Get sample calls
      const { data: calls } = await supabase
        .from('calls')
        .select('id, caller_name, phone_number, call_direction, status, sentiment_label, sentiment_score, created_at')
        .eq('org_id', profile.org_id)
        .order('created_at', { ascending: false })
        .limit(5);

      console.log('\n=== Sample calls (last 5) ===');
      console.log(JSON.stringify(calls, null, 2));

      // Check contacts
      const { count: contactCount } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', profile.org_id);

      console.log(`\n=== Contact count: ${contactCount} ===`);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

checkData();
