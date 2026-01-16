#!/usr/bin/env node

/**
 * Phase 1 Execution - Identity Crisis Fix
 * Executes all SQL commands for Phase 1 migration
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://lbjymlodxprzqgtyqtcq.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxianltbG9keHByenFndHlxdGNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM0OTUzMSwiZXhwIjoyMDc4OTI1NTMxfQ.5B2bBOUgXw2qC6QpIkU2DNZiqMW20y8MzgLQ56LEtFA';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function executePhase1() {
  console.log('🚀 PHASE 1: Identity Crisis Fix\n');
  
  try {
    // 1. Check current table structure
    console.log('1️⃣  Checking profiles table structure...');
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .limit(1);
    
    if (profilesError) {
      console.log(`   ⚠️  ${profilesError.message}`);
    } else {
      const columns = profiles.length > 0 ? Object.keys(profiles[0]) : [];
      console.log(`   ✅ Found columns: ${columns.join(', ')}`);
      
      if (columns.includes('tenant_id')) {
        console.log('   📌 Found tenant_id column - needs renaming');
      }
      if (columns.includes('org_id')) {
        console.log('   📌 Found org_id column - already standardized');
      }
    }
    
    // 2. Check organizations table
    console.log('\n2️⃣  Checking organizations table...');
    const { data: orgs, error: orgsError } = await supabase
      .from('organizations')
      .select('id, name, status')
      .limit(1);
    
    if (orgsError) {
      console.log(`   ⚠️  ${orgsError.message}`);
    } else {
      console.log(`   ✅ Organizations table exists (${orgs.length} records found)`);
    }
    
    // 3. Check if trigger exists
    console.log('\n3️⃣  Checking for auto-org trigger...');
    const { data: triggerCheck } = await supabase
      .rpc('check_trigger_exists', { trigger_name: 'on_auth_user_created' })
      .catch(() => ({ data: false }));
    
    if (triggerCheck) {
      console.log('   ✅ Trigger already exists');
    } else {
      console.log('   📌 Trigger needs to be created');
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('📋 PHASE 1 READY TO EXECUTE');
    console.log('='.repeat(70));
    console.log('\n📝 To execute the full migration, you have two options:\n');
    
    console.log('OPTION 1: Supabase Dashboard (Easiest)');
    console.log('─────────────────────────────────────');
    console.log('1. Open: https://app.supabase.com/project/lbjymlodxprzqgtyqtcq/sql/new');
    console.log('2. Copy contents from: migrations/phase1_identity_crisis_fix.sql');
    console.log('3. Paste and click "Run"\n');
    
    console.log('OPTION 2: Supabase CLI');
    console.log('──────────────────────');
    console.log('npm install -g @supabase/cli');
    console.log('supabase link --project-ref lbjymlodxprzqgtyqtcq');
    console.log('supabase db push migrations/phase1_identity_crisis_fix.sql\n');
    
    console.log('='.repeat(70));
    console.log('✅ After execution, run the verification queries:');
    console.log('='.repeat(70));
    console.log(`
-- 1. Check org_id column exists
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name='profiles' AND column_name='org_id';

-- 2. Check trigger exists
SELECT trigger_name FROM information_schema.triggers 
WHERE trigger_name='on_auth_user_created';

-- 3. Check RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables 
WHERE tablename IN ('profiles', 'organizations');
    `);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

executePhase1();
