/**
 * DIAGNOSTIC SCRIPT: Organization Creation Issue
 *
 * This script investigates why users are not getting organizations created
 * when they sign up in the Supabase dashboard.
 *
 * ROOT CAUSE: Database trigger handle_new_user_setup() may not be active
 * or may be throwing silently
 *
 * RUN: npm run ts-node backend/src/scripts/diagnose-org-issue.ts
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../config';

const supabaseUrl = (config.SUPABASE_URL || '').trim();
const supabaseKey = (config.SUPABASE_SERVICE_ROLE_KEY || '').trim().replace(/[\r\n\t\x00-\x1F\x7F]/g, '');

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnoseOrgIssue() {
  console.log('🔍 ORGANIZATION CREATION DIAGNOSTIC\n');
  console.log('========================================\n');

  // Step 1: Check if trigger exists
  console.log('Step 1: Checking if trigger handle_new_user_setup exists...');
  const { data: triggers, error: triggerError } = await supabase.rpc('get_all_triggers', {});

  if (triggerError) {
    console.warn('⚠️ Could not query triggers (RPC may not exist)');
  } else {
    const hasTrigger = triggers?.some((t: any) => t.trigger_name === 'on_auth_user_created');
    if (hasTrigger) {
      console.log('✅ Trigger on_auth_user_created EXISTS');
    } else {
      console.log('❌ Trigger on_auth_user_created MISSING - This is the problem!');
    }
  }

  // Step 2: Check for test user in Supabase Auth
  console.log('\nStep 2: Checking for test users in auth.users...');
  const { data: users, error: usersError } = await supabase
    .from('profiles')
    .select('id, email, org_id')
    .eq('email', 'doctor@clinic.com')
    .limit(5);

  if (usersError) {
    console.log('❌ Error querying profiles:', usersError);
  } else if (users && users.length > 0) {
    console.log(`✅ Found ${users.length} profile(s):`);
    users.forEach((u: any) => {
      console.log(`   - Email: ${u.email}, org_id: ${u.org_id ? '✅ Present' : '❌ MISSING'}`);
    });
  } else {
    console.log('ℹ️ No profiles found for doctor@clinic.com');
  }

  // Step 3: Check organizations table
  console.log('\nStep 3: Checking organizations table...');
  const { data: orgs, error: orgsError } = await supabase
    .from('organizations')
    .select('id, name, status')
    .limit(5);

  if (orgsError) {
    console.log('❌ Error querying organizations:', orgsError);
  } else if (orgs && orgs.length > 0) {
    console.log(`✅ Found ${orgs.length} organization(s):`);
    orgs.forEach((org: any) => {
      console.log(`   - ID: ${org.id}, Name: ${org.name}, Status: ${org.status}`);
    });
  } else {
    console.log('❌ No organizations found - Trigger may not be working!');
  }

  // Step 4: Test organization a0000000-0000-0000-0000-000000000001
  console.log('\nStep 4: Checking for test org a0000000-0000-0000-0000-000000000001...');
  const { data: testOrg, error: testOrgError } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', 'a0000000-0000-0000-0000-000000000001')
    .single();

  if (testOrgError?.code === 'PGRST116') {
    console.log('❌ Test organization does NOT exist - This is the 404 error!');
    console.log('   FIX: Need to create this organization manually');
  } else if (testOrgError) {
    console.log('❌ Error querying test org:', testOrgError);
  } else {
    console.log('✅ Test organization EXISTS:', testOrg);
  }

  // Step 5: Check JWT setup for any users
  console.log('\nStep 5: Checking JWT app_metadata for profiles...');
  const { data: sampleProfiles, error: sampleError } = await supabase
    .from('profiles')
    .select('id, email, org_id')
    .limit(3);

  if (sampleError) {
    console.log('❌ Error querying profiles:', sampleError);
  } else if (sampleProfiles && sampleProfiles.length > 0) {
    console.log('Sample profiles from database:');
    sampleProfiles.forEach((p: any) => {
      console.log(`   - ${p.email}: org_id = ${p.org_id || 'NULL'}`);
    });
  }

  // Step 6: Recommendations
  console.log('\n========================================');
  console.log('📋 DIAGNOSIS SUMMARY\n');
  console.log('ROOT CAUSE POSSIBILITIES:');
  console.log('1. ❌ Trigger not created - Run Phase 1 migration');
  console.log('2. ❌ Org created but not in JWT - app_metadata missing org_id');
  console.log('3. ❌ Test org manually deleted - Need to recreate');
  console.log('4. ⚠️  Auth trigger exists but failing silently - Check logs');
}

diagnoseOrgIssue()
  .then(() => {
    console.log('\n✅ Diagnostic complete');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Diagnostic failed:', err);
    process.exit(1);
  });
