/**
 * Helper Script: Retrieve Test Organization ID
 *
 * Purpose: Get the org_id for the test@demo.com account
 * Used by TestSprite tests to set up test data and verify multi-tenant isolation
 *
 * Usage:
 *   cd backend
 *   npx ts-node src/scripts/get-test-org-id.ts
 *
 * Expected Output:
 *   Test Org ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TEST_EMAIL = 'test@demo.com';

// Validate environment variables
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: Missing required environment variables');
  console.error('   Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

async function getTestOrgId() {
  try {
    // Create Supabase client with service role key
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log(`🔍 Looking up organization for ${TEST_EMAIL}...`);

    // Query profiles table for test account
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('org_id, full_name, email')
      .eq('email', TEST_EMAIL)
      .single();

    if (profileError) {
      if (profileError.code === 'PGRST116') {
        console.error(`❌ Error: Test account not found (${TEST_EMAIL})`);
        console.error('   Please ensure the test account exists in the database');
        process.exit(1);
      }
      throw profileError;
    }

    if (!profile.org_id) {
      console.error('❌ Error: Test account found but org_id is NULL');
      console.error('   This indicates a database integrity issue');
      console.error('   Please check the on_auth_user_created trigger');
      process.exit(1);
    }

    // Verify organization exists
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, email, created_at')
      .eq('id', profile.org_id)
      .single();

    if (orgError || !org) {
      console.error('❌ Error: Organization not found for org_id:', profile.org_id);
      process.exit(1);
    }

    // Success - print results
    console.log('\n✅ Test Account Found');
    console.log('━'.repeat(60));
    console.log(`Email:        ${profile.email}`);
    console.log(`Name:         ${profile.full_name || '(not set)'}`);
    console.log(`Org ID:       ${profile.org_id}`);
    console.log(`Org Name:     ${org.name}`);
    console.log(`Org Email:    ${org.email}`);
    console.log(`Created:      ${new Date(org.created_at).toLocaleString()}`);
    console.log('━'.repeat(60));

    // Export for use in scripts
    console.log('\n📋 Export for TestSprite:');
    console.log(`export TEST_ORG_ID="${profile.org_id}"`);

    // Also check for test data
    console.log('\n📊 Test Data Summary:');

    const { count: contactCount } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', profile.org_id);

    const { count: callCount } = await supabase
      .from('calls')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', profile.org_id);

    const { count: appointmentCount } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', profile.org_id);

    const { count: agentCount } = await supabase
      .from('agents')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', profile.org_id);

    console.log(`  Contacts:     ${contactCount || 0}`);
    console.log(`  Calls:        ${callCount || 0}`);
    console.log(`  Appointments: ${appointmentCount || 0}`);
    console.log(`  Agents:       ${agentCount || 0}`);

    // Return org_id for programmatic use
    return profile.org_id;

  } catch (error) {
    console.error('❌ Unexpected Error:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  getTestOrgId()
    .then((orgId) => {
      console.log(`\n✅ Success: Test Org ID = ${orgId}`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Failed to retrieve test org ID:', error);
      process.exit(1);
    });
}

export default getTestOrgId;
