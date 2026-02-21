/**
 * Diagnostic Script: Appointments Not Displaying in Dashboard
 *
 * TestSprite Discovery: Appointments created successfully but not visible in dashboard
 *
 * This script tests 4 potential bottlenecks:
 * 1. Database layer (raw query bypassing RLS)
 * 2. RLS policies (user-level query)
 * 3. API endpoint (backend route)
 * 4. Frontend query (client-side filtering)
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Validate environment variables
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing required environment variables:');
  if (!SUPABASE_URL) console.error('   - SUPABASE_URL');
  if (!SUPABASE_SERVICE_ROLE_KEY) console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_ANON_KEY) console.error('   - NEXT_PUBLIC_SUPABASE_ANON_KEY');
  console.error('\nEnsure backend/.env file exists and contains these variables.');
  process.exit(1);
}

const TEST_ORG_ID = 'ad9306a9-4d8a-4685-a667-cbeb7eb01a07';
const TEST_EMAIL = 'test@demo.com';

interface DiagnosticResult {
  layer: string;
  status: 'pass' | 'fail';
  count: number;
  error?: string;
  details?: any;
}

async function diagnoseAppointmentsIssue() {
  console.log('🔍 Diagnosing Appointments Display Issue');
  console.log('━'.repeat(60));
  console.log(`Test Org ID: ${TEST_ORG_ID}`);
  console.log(`Test Email: ${TEST_EMAIL}\n`);

  const results: DiagnosticResult[] = [];

  // Initialize Supabase clients
  const serviceRoleClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // ========================================
  // Test 1: Raw Database Query (Service Role)
  // ========================================
  console.log('Test 1: Raw Database Query (Service Role - bypasses RLS)');
  console.log('─'.repeat(60));

  try {
    const { data: rawData, error: rawError } = await serviceRoleClient
      .from('appointments')
      .select('*')
      .eq('org_id', TEST_ORG_ID)
      .order('scheduled_at', { ascending: true });

    if (rawError) {
      results.push({
        layer: 'Database (Service Role)',
        status: 'fail',
        count: 0,
        error: rawError.message
      });
      console.log(`❌ Query failed: ${rawError.message}\n`);
    } else {
      results.push({
        layer: 'Database (Service Role)',
        status: 'pass',
        count: rawData?.length || 0,
        details: rawData?.slice(0, 3) // First 3 appointments
      });
      console.log(`✅ Found ${rawData?.length || 0} appointments in database`);
      if (rawData && rawData.length > 0) {
        console.log(`   Sample: ${rawData[0].scheduled_at} - ${rawData[0].status}`);
      }
      console.log();
    }
  } catch (err: any) {
    results.push({
      layer: 'Database (Service Role)',
      status: 'fail',
      count: 0,
      error: err.message
    });
    console.log(`❌ Exception: ${err.message}\n`);
  }

  // ========================================
  // Test 2: User-Level Query (RLS Enforced)
  // ========================================
  console.log('Test 2: User-Level Query (RLS Enforced)');
  console.log('─'.repeat(60));

  try {
    // Get test user's JWT token
    const { data: authData, error: authError } = await anonClient.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: 'demo123'
    });

    if (authError) {
      results.push({
        layer: 'Authentication',
        status: 'fail',
        count: 0,
        error: authError.message
      });
      console.log(`❌ Authentication failed: ${authError.message}\n`);
    } else {
      console.log(`✅ Authenticated as ${TEST_EMAIL}`);

      // Query with authenticated user
      const authenticatedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: {
          headers: {
            Authorization: `Bearer ${authData.session?.access_token}`
          }
        }
      });

      const { data: userData, error: userError } = await authenticatedClient
        .from('appointments')
        .select('*')
        .order('scheduled_at', { ascending: true });

      if (userError) {
        results.push({
          layer: 'RLS Query (User Level)',
          status: 'fail',
          count: 0,
          error: userError.message
        });
        console.log(`❌ RLS query failed: ${userError.message}\n`);
      } else {
        results.push({
          layer: 'RLS Query (User Level)',
          status: 'pass',
          count: userData?.length || 0,
          details: userData?.slice(0, 3)
        });
        console.log(`✅ Found ${userData?.length || 0} appointments via RLS`);
        if (userData && userData.length > 0) {
          console.log(`   Sample: ${userData[0].scheduled_at} - ${userData[0].status}`);
        }
        console.log();
      }
    }
  } catch (err: any) {
    results.push({
      layer: 'RLS Query (User Level)',
      status: 'fail',
      count: 0,
      error: err.message
    });
    console.log(`❌ Exception: ${err.message}\n`);
  }

  // ========================================
  // Test 3: RLS Policies Check
  // ========================================
  console.log('Test 3: RLS Policies Check');
  console.log('─'.repeat(60));

  try {
    const { data: policies, error: policiesError } = await serviceRoleClient
      .from('pg_policies')
      .select('*')
      .eq('tablename', 'appointments');

    if (policiesError) {
      results.push({
        layer: 'RLS Policies',
        status: 'fail',
        count: 0,
        error: policiesError.message
      });
      console.log(`❌ Failed to fetch RLS policies: ${policiesError.message}\n`);
    } else {
      const selectPolicies = policies?.filter((p: any) => p.cmd === 'SELECT') || [];
      results.push({
        layer: 'RLS Policies',
        status: selectPolicies.length > 0 ? 'pass' : 'fail',
        count: selectPolicies.length,
        details: selectPolicies.map((p: any) => p.policyname)
      });
      console.log(`✅ Found ${selectPolicies.length} SELECT policies on appointments table`);
      if (selectPolicies.length > 0) {
        selectPolicies.forEach((p: any) => {
          console.log(`   - ${p.policyname}`);
        });
      } else {
        console.log(`⚠️  WARNING: No SELECT policies found - RLS may be blocking reads`);
      }
      console.log();
    }
  } catch (err: any) {
    // Fallback: Query system catalog directly
    try {
      const { data: systemPolicies } = await serviceRoleClient.rpc('pg_catalog.pg_policies');
      console.log(`✅ Found ${systemPolicies?.length || 0} total RLS policies in database\n`);
    } catch {
      console.log(`⚠️  Could not fetch RLS policies (non-blocking)\n`);
    }
  }

  // ========================================
  // Test 4: API Endpoint Check
  // ========================================
  console.log('Test 4: API Endpoint Check');
  console.log('─'.repeat(60));

  try {
    // Get JWT token for API call
    const { data: authData } = await anonClient.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: 'demo123'
    });

    if (!authData.session?.access_token) {
      console.log(`❌ No JWT token available for API call\n`);
      results.push({
        layer: 'API Endpoint',
        status: 'fail',
        count: 0,
        error: 'No JWT token'
      });
    } else {
      const response = await fetch('https://voxanneai.onrender.com/api/appointments', {
        headers: {
          'Authorization': `Bearer ${authData.session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        results.push({
          layer: 'API Endpoint',
          status: 'fail',
          count: 0,
          error: `HTTP ${response.status}: ${errorText}`
        });
        console.log(`❌ API request failed: HTTP ${response.status}`);
        console.log(`   Response: ${errorText}\n`);
      } else {
        const apiData = await response.json();
        const count = Array.isArray(apiData) ? apiData.length : 0;
        results.push({
          layer: 'API Endpoint',
          status: 'pass',
          count: count,
          details: Array.isArray(apiData) ? apiData.slice(0, 3) : apiData
        });
        console.log(`✅ API returned ${count} appointments`);
        if (Array.isArray(apiData) && apiData.length > 0) {
          console.log(`   Sample: ${apiData[0].scheduled_at} - ${apiData[0].status}`);
        }
        console.log();
      }
    }
  } catch (err: any) {
    results.push({
      layer: 'API Endpoint',
      status: 'fail',
      count: 0,
      error: err.message
    });
    console.log(`❌ Exception: ${err.message}\n`);
  }

  // ========================================
  // Summary & Diagnosis
  // ========================================
  console.log('\n' + '━'.repeat(60));
  console.log('📊 Diagnostic Summary');
  console.log('━'.repeat(60));

  console.log('\n| Layer                      | Status | Count | Details');
  console.log('|----------------------------|--------|-------|----------');
  results.forEach(r => {
    const statusIcon = r.status === 'pass' ? '✅' : '❌';
    const paddedLayer = r.layer.padEnd(26);
    const paddedCount = String(r.count).padEnd(5);
    const details = r.error || (r.status === 'pass' ? 'OK' : 'Failed');
    console.log(`| ${paddedLayer} | ${statusIcon}     | ${paddedCount} | ${details}`);
  });

  console.log('\n' + '━'.repeat(60));
  console.log('💡 Root Cause Analysis');
  console.log('━'.repeat(60) + '\n');

  const dbResult = results.find(r => r.layer === 'Database (Service Role)');
  const rlsResult = results.find(r => r.layer === 'RLS Query (User Level)');
  const apiResult = results.find(r => r.layer === 'API Endpoint');

  if (!dbResult || dbResult.status === 'fail') {
    console.log('🔴 CRITICAL: No appointments exist in database');
    console.log('   Action: Verify test data creation script');
    console.log('   File: backend/src/scripts/create-test-appointments.ts\n');
  } else if (dbResult.count === 0) {
    console.log('🟡 WARNING: Database is empty for test org');
    console.log('   Action: Create test appointments');
    console.log('   Command: npm run create-test-data\n');
  } else if (!rlsResult || rlsResult.status === 'fail' || rlsResult.count === 0) {
    console.log('🔴 CRITICAL: RLS policies blocking user access');
    console.log('   Action: Fix RLS policies on appointments table');
    console.log('   File: backend/supabase/migrations/20260220_fix_appointments_rls.sql');
    console.log('   SQL:');
    console.log('   ```sql');
    console.log('   CREATE POLICY "Users can view own org appointments"');
    console.log('   ON appointments FOR SELECT');
    console.log('   USING (');
    console.log('     org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())');
    console.log('   );');
    console.log('   ```\n');
  } else if (!apiResult || apiResult.status === 'fail') {
    console.log('🔴 CRITICAL: API endpoint not working');
    console.log(`   Error: ${apiResult?.error || 'Unknown'}`);
    console.log('   Action: Check backend routes configuration');
    console.log('   File: backend/src/routes/appointments.ts');
    console.log('   Verify: Endpoint mounted in backend/src/server.ts\n');
  } else if (apiResult.count === 0 && dbResult.count > 0) {
    console.log('🔴 CRITICAL: API endpoint returns empty array despite DB data');
    console.log('   Action: Check API query filters (likely missing org_id)');
    console.log('   File: backend/src/routes/appointments.ts');
    console.log('   Fix: Ensure .eq("org_id", orgId) filter is applied\n');
  } else {
    console.log('✅ All layers working correctly!');
    console.log('   Database: ' + dbResult.count + ' appointments');
    console.log('   RLS Query: ' + rlsResult.count + ' appointments');
    console.log('   API Endpoint: ' + apiResult.count + ' appointments');
    console.log('\n   Issue may be in frontend query or component rendering.');
    console.log('   Check: src/app/dashboard/appointments/page.tsx\n');
  }

  console.log('━'.repeat(60));
  console.log('✅ Diagnosis complete');
  console.log('━'.repeat(60) + '\n');

  // Return results for programmatic use
  return results;
}

// Run diagnostic if executed directly
if (require.main === module) {
  diagnoseAppointmentsIssue()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Diagnostic failed:', err);
      process.exit(1);
    });
}

export { diagnoseAppointmentsIssue };
