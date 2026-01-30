/**
 * Fix Missing Organization IDs
 *
 * This script fixes users who don't have org_id assigned.
 * It assigns them to the Development Org and updates their JWT app_metadata.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../config';

const supabaseUrl = (config.SUPABASE_URL || '').trim();
const supabaseKey = (config.SUPABASE_SERVICE_ROLE_KEY || '').trim().replace(/[\r\n\t\x00-\x1F\x7F]/g, '');

const supabase = createClient(supabaseUrl, supabaseKey);

const DEV_ORG_ID = 'a0000000-0000-0000-0000-000000000001';

async function fixMissingOrgIds() {
  console.log('🔧 Fixing Missing Organization IDs\n');
  console.log('========================================\n');

  // Step 1: Find profiles without org_id
  console.log('Step 1: Finding profiles without org_id...');
  const { data: profilesWithoutOrg, error: profilesError } = await supabase
    .from('profiles')
    .select('id, email, org_id')
    .is('org_id', null);

  if (profilesError) {
    console.error('❌ Error querying profiles:', profilesError);
    process.exit(1);
  }

  if (!profilesWithoutOrg || profilesWithoutOrg.length === 0) {
    console.log('✅ All profiles have org_id assigned!');
    process.exit(0);
  }

  console.log(`⚠️  Found ${profilesWithoutOrg.length} profile(s) without org_id:`);
  profilesWithoutOrg.forEach((p: any) => {
    console.log(`   - ${p.email} (ID: ${p.id})`);
  });

  // Step 2: Verify Development Org exists
  console.log('\nStep 2: Verifying Development Org exists...');
  const { data: devOrg, error: devOrgError } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('id', DEV_ORG_ID)
    .single();

  if (devOrgError || !devOrg) {
    console.error('❌ Development Org not found!');
    console.error('   Please create it first with ID:', DEV_ORG_ID);
    process.exit(1);
  }

  console.log(`✅ Development Org exists: ${devOrg.name}`);

  // Step 3: Update profiles with org_id
  console.log('\nStep 3: Updating profiles with org_id...');
  for (const profile of profilesWithoutOrg) {
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ org_id: DEV_ORG_ID })
      .eq('id', profile.id);

    if (updateError) {
      console.error(`   ❌ Failed to update ${profile.email}:`, updateError.message);
    } else {
      console.log(`   ✅ Updated ${profile.email} → org_id: ${DEV_ORG_ID}`);
    }
  }

  // Step 4: Update JWT app_metadata for each user
  console.log('\nStep 4: Updating JWT app_metadata...');
  for (const profile of profilesWithoutOrg) {
    try {
      // Update user metadata in auth.users
      const { error: authError } = await supabase.auth.admin.updateUserById(
        profile.id,
        {
          app_metadata: { org_id: DEV_ORG_ID }
        }
      );

      if (authError) {
        console.error(`   ❌ Failed to update JWT for ${profile.email}:`, authError.message);
      } else {
        console.log(`   ✅ Updated JWT for ${profile.email}`);
      }
    } catch (err: any) {
      console.error(`   ❌ Error updating JWT for ${profile.email}:`, err.message);
    }
  }

  // Step 5: Verify all profiles now have org_id
  console.log('\nStep 5: Verifying all profiles have org_id...');
  const { data: stillMissing } = await supabase
    .from('profiles')
    .select('id, email')
    .is('org_id', null);

  if (stillMissing && stillMissing.length > 0) {
    console.log(`⚠️  ${stillMissing.length} profile(s) still missing org_id:`);
    stillMissing.forEach((p: any) => {
      console.log(`   - ${p.email}`);
    });
  } else {
    console.log('✅ All profiles now have org_id!');
  }

  console.log('\n========================================');
  console.log('✅ Fix complete!\n');
  console.log('⚠️  IMPORTANT: Users must log out and log back in for JWT changes to take effect.');
  console.log('   Or the frontend should refresh the session token.\n');
}

fixMissingOrgIds()
  .then(() => {
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Fix failed:', err);
    process.exit(1);
  });
