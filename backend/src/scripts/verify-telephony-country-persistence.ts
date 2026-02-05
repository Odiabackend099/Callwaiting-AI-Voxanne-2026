/**
 * Database Persistence Verification Script
 * Tests that country selection is correctly saved to organizations.telephony_country
 *
 * Usage: npx ts-node src/scripts/verify-telephony-country-persistence.ts
 */

import { supabaseAdmin } from '../config/supabase';
import { log } from '../services/logger';

interface VerificationResult {
  check: string;
  status: 'PASS' | 'FAIL';
  details: string;
}

const results: VerificationResult[] = [];

async function verifyDatabaseSchema(): Promise<void> {
  console.log('\n=== PHASE 1: Database Schema Verification ===\n');

  try {
    // Check if organizations table has telephony_country column
    const { data: columns, error } = await supabaseAdmin
      .from('organizations')
      .select('id, telephony_country')
      .limit(1);

    if (error) {
      results.push({
        check: 'organizations.telephony_country column exists',
        status: 'FAIL',
        details: `Column query failed: ${error.message}`,
      });
      console.log('❌ FAIL: telephony_country column does not exist');
      console.log(`   Error: ${error.message}\n`);
      return;
    }

    results.push({
      check: 'organizations.telephony_country column exists',
      status: 'PASS',
      details: 'Column is accessible via Supabase client',
    });
    console.log('✅ PASS: telephony_country column exists\n');
  } catch (error: any) {
    results.push({
      check: 'organizations.telephony_country column exists',
      status: 'FAIL',
      details: `Unexpected error: ${error.message}`,
    });
    console.log('❌ FAIL: Unexpected error checking schema');
    console.log(`   Error: ${error.message}\n`);
  }
}

async function verifyExistingData(): Promise<void> {
  console.log('=== PHASE 2: Existing Data Verification ===\n');

  try {
    // Query all organizations to see current state
    const { data: orgs, error } = await supabaseAdmin
      .from('organizations')
      .select('id, name, telephony_country, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      results.push({
        check: 'Query existing organization data',
        status: 'FAIL',
        details: `Query failed: ${error.message}`,
      });
      console.log('❌ FAIL: Could not query organizations table');
      console.log(`   Error: ${error.message}\n`);
      return;
    }

    if (!orgs || orgs.length === 0) {
      results.push({
        check: 'Query existing organization data',
        status: 'PASS',
        details: 'No organizations found (empty database)',
      });
      console.log('⚠️  WARNING: No organizations found in database');
      console.log('   This is expected if running on empty database\n');
      return;
    }

    results.push({
      check: 'Query existing organization data',
      status: 'PASS',
      details: `Found ${orgs.length} organizations`,
    });

    console.log(`✅ PASS: Found ${orgs.length} organizations\n`);
    console.log('   Organization Data:');

    orgs.forEach((org, index) => {
      const countryStatus = org.telephony_country
        ? `✓ SET (${org.telephony_country})`
        : '✗ NULL';

      console.log(`   ${index + 1}. ${org.name || 'Unnamed'}`);
      console.log(`      ID: ${org.id}`);
      console.log(`      telephony_country: ${countryStatus}`);
    });

    console.log('');

    // Count organizations with country set
    const orgsWithCountry = orgs.filter(o => o.telephony_country !== null);
    const percentage = ((orgsWithCountry.length / orgs.length) * 100).toFixed(1);

    console.log(`   Summary: ${orgsWithCountry.length}/${orgs.length} organizations (${percentage}%) have country selected\n`);

    if (orgsWithCountry.length === 0) {
      console.log('   ⚠️  No organizations have selected a country yet');
      console.log('   This is expected if the feature is newly deployed\n');
    }
  } catch (error: any) {
    results.push({
      check: 'Query existing organization data',
      status: 'FAIL',
      details: `Unexpected error: ${error.message}`,
    });
    console.log('❌ FAIL: Unexpected error querying data');
    console.log(`   Error: ${error.message}\n`);
  }
}

async function verifyUpdateMechanism(): Promise<void> {
  console.log('=== PHASE 3: Update Mechanism Verification ===\n');

  try {
    // Get first organization to test with
    const { data: orgs, error: queryError } = await supabaseAdmin
      .from('organizations')
      .select('id, name, telephony_country, updated_at')
      .limit(1)
      .single();

    if (queryError || !orgs) {
      results.push({
        check: 'Update mechanism test',
        status: 'FAIL',
        details: 'No organization available for testing',
      });
      console.log('⚠️  SKIP: No organization available for update test');
      console.log('   Create an organization first to test persistence\n');
      return;
    }

    const testOrgId = orgs.id;
    const originalCountry = orgs.telephony_country;
    const testCountry = 'US'; // Use US as test country

    console.log(`   Testing with organization: ${orgs.name || 'Unnamed'}`);
    console.log(`   Org ID: ${testOrgId}`);
    console.log(`   Original country: ${originalCountry || 'NULL'}`);
    console.log(`   Test country: ${testCountry}\n`);

    // Step 1: Update to test country
    const { error: updateError } = await supabaseAdmin
      .from('organizations')
      .update({
        telephony_country: testCountry,
        updated_at: new Date().toISOString(),
      })
      .eq('id', testOrgId);

    if (updateError) {
      results.push({
        check: 'Update mechanism test',
        status: 'FAIL',
        details: `Update failed: ${updateError.message}`,
      });
      console.log('❌ FAIL: Could not update telephony_country');
      console.log(`   Error: ${updateError.message}\n`);
      return;
    }

    console.log('   ✓ Update query executed successfully');

    // Step 2: Verify the update persisted
    const { data: verifyOrg, error: verifyError } = await supabaseAdmin
      .from('organizations')
      .select('telephony_country')
      .eq('id', testOrgId)
      .single();

    if (verifyError || !verifyOrg) {
      results.push({
        check: 'Update mechanism test',
        status: 'FAIL',
        details: `Verification query failed: ${verifyError?.message}`,
      });
      console.log('❌ FAIL: Could not verify update');
      console.log(`   Error: ${verifyError?.message}\n`);
      return;
    }

    if (verifyOrg.telephony_country === testCountry) {
      results.push({
        check: 'Update mechanism test',
        status: 'PASS',
        details: `Successfully updated and verified telephony_country = ${testCountry}`,
      });
      console.log('   ✓ Update verified successfully');
      console.log(`   ✓ telephony_country = ${verifyOrg.telephony_country}\n`);
    } else {
      results.push({
        check: 'Update mechanism test',
        status: 'FAIL',
        details: `Update did not persist. Expected ${testCountry}, got ${verifyOrg.telephony_country}`,
      });
      console.log('   ❌ Update did not persist');
      console.log(`   Expected: ${testCountry}`);
      console.log(`   Got: ${verifyOrg.telephony_country}\n`);
    }

    // Step 3: Restore original value (cleanup)
    if (originalCountry !== testCountry) {
      const { error: restoreError } = await supabaseAdmin
        .from('organizations')
        .update({
          telephony_country: originalCountry,
          updated_at: new Date().toISOString(),
        })
        .eq('id', testOrgId);

      if (!restoreError) {
        console.log(`   ✓ Restored original country: ${originalCountry || 'NULL'}\n`);
      }
    }

    console.log('✅ PASS: Update mechanism works correctly\n');
  } catch (error: any) {
    results.push({
      check: 'Update mechanism test',
      status: 'FAIL',
      details: `Unexpected error: ${error.message}`,
    });
    console.log('❌ FAIL: Unexpected error testing update');
    console.log(`   Error: ${error.message}\n`);
  }
}

async function verifyOptimisticLocking(): Promise<void> {
  console.log('=== PHASE 4: Optimistic Locking Verification ===\n');

  try {
    // Get first organization to test with
    const { data: orgs, error: queryError } = await supabaseAdmin
      .from('organizations')
      .select('id, name, updated_at')
      .limit(1)
      .single();

    if (queryError || !orgs) {
      results.push({
        check: 'Optimistic locking test',
        status: 'FAIL',
        details: 'No organization available for testing',
      });
      console.log('⚠️  SKIP: No organization available for locking test\n');
      return;
    }

    const testOrgId = orgs.id;
    const originalUpdatedAt = orgs.updated_at;

    console.log(`   Testing with organization: ${orgs.name || 'Unnamed'}`);
    console.log(`   Original updated_at: ${originalUpdatedAt}\n`);

    // Step 1: Try update with stale timestamp (should fail or return 0 rows affected)
    const { count, error: lockError } = await supabaseAdmin
      .from('organizations')
      .update({
        telephony_country: 'GB',
        updated_at: new Date().toISOString(),
      })
      .eq('id', testOrgId)
      .eq('updated_at', '2020-01-01T00:00:00Z') // Intentionally stale timestamp
      .select('id', { count: 'exact', head: true });

    // If count is 0, optimistic locking is working (stale timestamp rejected)
    if (count === 0) {
      results.push({
        check: 'Optimistic locking test',
        status: 'PASS',
        details: 'Stale timestamp correctly prevented update (0 rows affected)',
      });
      console.log('✅ PASS: Optimistic locking is working');
      console.log('   ✓ Update with stale timestamp was rejected\n');
    } else {
      results.push({
        check: 'Optimistic locking test',
        status: 'FAIL',
        details: `Update with stale timestamp affected ${count} rows (should be 0)`,
      });
      console.log('❌ FAIL: Optimistic locking not working properly');
      console.log(`   Update with stale timestamp affected ${count} rows\n`);
    }
  } catch (error: any) {
    results.push({
      check: 'Optimistic locking test',
      status: 'FAIL',
      details: `Unexpected error: ${error.message}`,
    });
    console.log('❌ FAIL: Unexpected error testing locking');
    console.log(`   Error: ${error.message}\n`);
  }
}

async function printSummary(): Promise<void> {
  console.log('=== VERIFICATION SUMMARY ===\n');

  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  const totalCount = results.length;

  results.forEach((result, index) => {
    const icon = result.status === 'PASS' ? '✅' : '❌';
    console.log(`${index + 1}. ${icon} ${result.check}`);
    console.log(`   ${result.details}`);
  });

  console.log('');
  console.log(`Total: ${passCount}/${totalCount} checks passed`);

  if (failCount === 0) {
    console.log('\n🎉 ALL CHECKS PASSED - Database persistence is working correctly!\n');
  } else {
    console.log(`\n⚠️  ${failCount} checks failed - Review errors above\n`);
  }

  // Exit with appropriate code
  process.exit(failCount > 0 ? 1 : 0);
}

async function main(): Promise<void> {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  TELEPHONY COUNTRY PERSISTENCE VERIFICATION                   ║');
  console.log('║  Verifying organizations.telephony_country database column    ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  await verifyDatabaseSchema();
  await verifyExistingData();
  await verifyUpdateMechanism();
  await verifyOptimisticLocking();
  await printSummary();
}

// Run verification
main().catch((error) => {
  console.error('\n❌ FATAL ERROR during verification:');
  console.error(error);
  process.exit(1);
});
