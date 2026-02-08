#!/usr/bin/env ts-node
/**
 * Verification Script: User Signup Auto-Organization Fix
 *
 * This script verifies that the user signup fix is working correctly:
 * 1. Checks if orphaned users exist (should be 0 after backfill)
 * 2. Verifies ceo@demo.com is fixed
 * 3. Tests creating a new user to ensure trigger works
 * 4. Verifies new user has profile + organization
 *
 * Run: npx ts-node src/scripts/verify-user-signup.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function main() {
  console.log('\n🔍 User Signup Auto-Organization Verification\n');
  console.log('='.repeat(60));

  // Step 1: Check for orphaned users
  console.log('\n📊 Step 1: Checking for orphaned users...');
  const { data: orphanedUsers, error: orphanError } = await supabase
    .rpc('count_orphaned_users', {}, { count: 'exact' })
    .throwOnError();

  if (orphanError) {
    // Function may not exist, try direct query
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error('❌ Failed to list users:', authError.message);
      process.exit(1);
    }

    let orphanCount = 0;
    for (const user of authUsers.users) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (!profile) {
        orphanCount++;
        console.log(`  ⚠️  Orphaned user found: ${user.email} (${user.id})`);
      }
    }

    if (orphanCount === 0) {
      console.log('  ✅ No orphaned users found!');
    } else {
      console.log(`  ❌ Found ${orphanCount} orphaned user(s). Backfill may not have run.`);
    }
  }

  // Step 2: Verify ceo@demo.com is fixed
  console.log('\n📊 Step 2: Verifying ceo@demo.com...');

  const { data: authUser, error: ceoAuthError } = await supabase.auth.admin.listUsers();
  const ceoUser = authUser?.users.find(u => u.email === 'ceo@demo.com');

  if (!ceoUser) {
    console.log('  ⚠️  User ceo@demo.com not found in auth.users');
  } else {
    const { data: ceoProfile, error: ceoProfileError } = await supabase
      .from('profiles')
      .select('id, email, org_id')
      .eq('id', ceoUser.id)
      .maybeSingle();

    if (ceoProfileError || !ceoProfile) {
      console.log('  ❌ ceo@demo.com has NO profile');
    } else {
      console.log(`  ✅ ceo@demo.com has profile (ID: ${ceoProfile.id})`);

      const { data: ceoOrg, error: ceoOrgError } = await supabase
        .from('organizations')
        .select('id, name, email')
        .eq('id', ceoProfile.org_id)
        .maybeSingle();

      if (ceoOrgError || !ceoOrg) {
        console.log('  ❌ ceo@demo.com profile has INVALID org_id');
      } else {
        console.log(`  ✅ ceo@demo.com has organization: ${ceoOrg.name}`);
      }

      // Check JWT metadata
      const jwtOrgId = ceoUser.app_metadata?.org_id;
      if (jwtOrgId === ceoProfile.org_id) {
        console.log(`  ✅ JWT metadata contains correct org_id: ${jwtOrgId}`);
      } else {
        console.log(`  ❌ JWT metadata org_id mismatch: ${jwtOrgId} vs ${ceoProfile.org_id}`);
      }
    }
  }

  // Step 3: Test creating a new user
  console.log('\n📊 Step 3: Testing new user creation...');

  const testEmail = `test-trigger-${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!@#';

  console.log(`  Creating test user: ${testEmail}`);

  const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true
  });

  if (createError || !newUser.user) {
    console.log(`  ❌ Failed to create test user: ${createError?.message}`);
  } else {
    console.log(`  ✅ Created test user (ID: ${newUser.user.id})`);

    // Wait a moment for trigger to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 4: Verify test user has profile + org
    console.log('\n📊 Step 4: Verifying test user has profile + organization...');

    const { data: testProfile, error: testProfileError } = await supabase
      .from('profiles')
      .select('id, email, org_id')
      .eq('id', newUser.user.id)
      .maybeSingle();

    if (testProfileError || !testProfile) {
      console.log('  ❌ Test user has NO profile - TRIGGER FAILED!');
      console.error('  Error:', testProfileError?.message);
    } else {
      console.log(`  ✅ Test user has profile (org_id: ${testProfile.org_id})`);

      const { data: testOrg, error: testOrgError } = await supabase
        .from('organizations')
        .select('id, name, email')
        .eq('id', testProfile.org_id)
        .maybeSingle();

      if (testOrgError || !testOrg) {
        console.log('  ❌ Test user profile has INVALID org_id - TRIGGER PARTIALLY FAILED!');
      } else {
        console.log(`  ✅ Test user has organization: ${testOrg.name}`);
      }

      // Check JWT metadata
      const { data: refreshedUser } = await supabase.auth.admin.getUserById(newUser.user.id);
      const testJwtOrgId = refreshedUser.user?.app_metadata?.org_id;

      if (testJwtOrgId === testProfile.org_id) {
        console.log(`  ✅ JWT metadata contains correct org_id: ${testJwtOrgId}`);
      } else {
        console.log(`  ❌ JWT metadata org_id mismatch: ${testJwtOrgId} vs ${testProfile.org_id}`);
      }
    }

    // Cleanup: Delete test user
    console.log('\n🧹 Cleanup: Deleting test user...');
    await supabase.auth.admin.deleteUser(newUser.user.id);
    await supabase.from('profiles').delete().eq('id', newUser.user.id);
    if (testProfile?.org_id) {
      await supabase.from('organizations').delete().eq('id', testProfile.org_id);
    }
    console.log('  ✅ Test user deleted');
  }

  // Final Summary
  console.log('\n' + '='.repeat(60));
  console.log('\n✅ Verification Complete!\n');
  console.log('Next Steps:');
  console.log('1. If any checks failed, review the migration logs');
  console.log('2. Test manual login at http://localhost:3000/login');
  console.log('3. Try creating a new user via signup form');
  console.log('4. Verify dashboard loads correctly for ceo@demo.com\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Verification failed:', error.message);
    console.error(error);
    process.exit(1);
  });
