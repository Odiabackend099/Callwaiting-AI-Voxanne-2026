/**
 * Check user's org_id in database
 * Run with: npx tsx src/scripts/check-user-org.ts YOUR_EMAIL
 */

import { supabase } from '../services/supabase-client';

const userEmail = process.argv[2];

if (!userEmail) {
  console.error('Usage: npx tsx src/scripts/check-user-org.ts YOUR_EMAIL');
  process.exit(1);
}

async function checkUserOrg() {
  console.log(`\n🔍 Checking org_id for user: ${userEmail}\n`);

  // Get user from auth.users
  const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
  
  if (authError) {
    console.error('❌ Error fetching users:', authError.message);
    return;
  }

  const user = authData.users.find(u => u.email === userEmail);
  
  if (!user) {
    console.error(`❌ User not found: ${userEmail}`);
    return;
  }

  console.log('✅ User found in auth.users');
  console.log(`   User ID: ${user.id}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   app_metadata:`, JSON.stringify(user.app_metadata, null, 2));
  console.log(`   user_metadata:`, JSON.stringify(user.user_metadata, null, 2));

  // Get user from profiles
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', userEmail)
    .single();

  if (profileError) {
    console.error('\n❌ Error fetching profile:', profileError.message);
  } else {
    console.log('\n✅ User profile found');
    console.log(`   Profile org_id: ${profile.org_id}`);
    console.log(`   Profile data:`, JSON.stringify(profile, null, 2));
  }

  // Check if org_id exists in app_metadata
  if (!user.app_metadata?.org_id) {
    console.log('\n⚠️  ISSUE FOUND: app_metadata.org_id is missing!');
    console.log('   This is why the frontend shows "unknown" as orgId');
    
    if (profile?.org_id) {
      console.log(`\n💡 SOLUTION: Update app_metadata with org_id from profile: ${profile.org_id}`);
      console.log('   Run this SQL in Supabase Dashboard:');
      console.log(`
UPDATE auth.users
SET raw_app_meta_data = jsonb_set(
  COALESCE(raw_app_meta_data, '{}'::jsonb),
  '{org_id}',
  '"${profile.org_id}"'::jsonb
)
WHERE email = '${userEmail}';
      `);
    }
  } else {
    console.log(`\n✅ app_metadata.org_id exists: ${user.app_metadata.org_id}`);
  }
}

checkUserOrg();
