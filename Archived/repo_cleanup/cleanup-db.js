#!/usr/bin/env node

/**
 * Phase 1: Database Cleanup Script
 * Scorched Earth - Truncate all test data
 * 
 * Usage: node cleanup-db.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './backend/.env' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  console.error('   SUPABASE_URL:', SUPABASE_URL);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING');
  process.exit(1);
}

console.log('Using Service Role Key for database cleanup (bypasses RLS)\n');

const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function cleanupDatabase() {
  console.log('🧹 Starting database cleanup...\n');

  try {
    // Step 1: Truncate tables
    console.log('Step 1: Truncating tables...');
    const truncateSQL = `
      TRUNCATE TABLE appointments CASCADE;
      TRUNCATE TABLE leads CASCADE;
      TRUNCATE TABLE contacts CASCADE;
    `;

    // Use REST API to bypass RLS and delete records
    console.log('   Deleting appointments...');
    await supabaseService.from('appointments').delete().gt('id', '');
    
    console.log('   Deleting leads...');
    await supabaseService.from('leads').delete().gt('id', '');
    
    console.log('   Deleting contacts...');
    await supabaseService.from('contacts').delete().gt('id', '');
    
    console.log('✅ Tables truncated via deletion (bypassing RLS)');

    // Step 2: Verify Sara Org exists
    console.log('\nStep 2: Verifying Sara Org exists...');
    const { data: saraOrg, error: orgError } = await supabaseService
      .from('organizations')
      .select('id, name, created_at')
      .eq('id', '46cf2995-2bee-44e3-838b-24151486fe4e')
      .single();

    if (orgError || !saraOrg) {
      console.error('❌ Sara Org not found!');
      console.error('Error:', orgError?.message);
      process.exit(1);
    }

    console.log('✅ Sara Org found:');
    console.log(`   ID: ${saraOrg.id}`);
    console.log(`   Name: ${saraOrg.name}`);
    console.log(`   Created: ${saraOrg.created_at}`);

    // Step 3: Verify Twilio credentials exist
    console.log('\nStep 3: Checking Twilio credentials...');
    const { data: twilioCredentials, error: twilioError } = await supabaseService
      .from('organization_api_credentials')
      .select('id, credential_type, created_at')
      .eq('org_id', '46cf2995-2bee-44e3-838b-24151486fe4e')
      .eq('credential_type', 'twilio')
      .single();

    if (twilioError || !twilioCredentials) {
      console.warn('⚠️  Twilio credentials not found. This will cause SMS to fail.');
    } else {
      console.log('✅ Twilio credentials found');
      console.log(`   Created: ${twilioCredentials.created_at}`);
    }

    // Step 4: Verify Google Calendar credentials exist
    console.log('\nStep 4: Checking Google Calendar credentials...');
    const { data: googleCredentials, error: googleError } = await supabaseService
      .from('organization_api_credentials')
      .select('id, credential_type, created_at')
      .eq('org_id', '46cf2995-2bee-44e3-838b-24151486fe4e')
      .eq('credential_type', 'google')
      .single();

    if (googleError || !googleCredentials) {
      console.warn('⚠️  Google Calendar credentials not found. This will cause calendar sync to fail.');
    } else {
      console.log('✅ Google Calendar credentials found');
      console.log(`   Created: ${googleCredentials.created_at}`);
    }

    // Step 5: Verify tables are empty
    console.log('\nStep 5: Verifying tables are empty...');
    const { count: appointmentCount } = await supabaseService
      .from('appointments')
      .select('*', { count: 'exact', head: true });
    
    const { count: leadCount } = await supabaseService
      .from('leads')
      .select('*', { count: 'exact', head: true });

    const { count: contactCount } = await supabaseService
      .from('contacts')
      .select('*', { count: 'exact', head: true });

    console.log(`   Appointments: ${appointmentCount} records`);
    console.log(`   Leads: ${leadCount} records`);
    console.log(`   Contacts: ${contactCount} records`);

    if (appointmentCount === 0 && leadCount === 0 && contactCount === 0) {
      console.log('\n✅ Database cleanup SUCCESSFUL');
      console.log('🎯 Ready for Austin booking test');
      process.exit(0);
    } else {
      console.error('\n❌ Some tables still have records');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Database cleanup FAILED');
    console.error(error);
    process.exit(1);
  }
}

cleanupDatabase();
