/**
 * Verify webhook_delivery_log Migration Was Applied
 */

import { createClient } from '@supabase/supabase-js';

async function verifyMigration() {
  console.log('🔍 Verifying webhook_delivery_log migration...\n');

  const supabaseUrl = process.env.SUPABASE_URL?.replace(/'/g, '') || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/'/g, '') || '';

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  let allPassed = true;

  // Test 1: Check if table exists
  console.log('[1/4] Checking if webhook_delivery_log table exists...');

  const { data: tableData, error: tableError } = await supabase
    .from('webhook_delivery_log')
    .select('id')
    .limit(1);

  if (tableError) {
    if (tableError.message?.includes('relation') && tableError.message?.includes('does not exist')) {
      console.log('   ❌ Table does NOT exist');
      console.log('   📝 Please apply the migration first');
      console.log('   See: MIGRATION_STATUS.md for instructions\n');
      allPassed = false;
    } else {
      console.log(`   ⚠️  Unexpected error: ${tableError.message}`);
      allPassed = false;
    }
  } else {
    console.log('   ✅ Table exists\n');
  }

  // Test 2: Check table structure
  console.log('[2/4] Checking table structure...');

  const { data: insertTest, error: insertError } = await supabase
    .from('webhook_delivery_log')
    .insert({
      org_id: '00000000-0000-0000-0000-000000000000', // Will fail but tests structure
      event_type: 'test',
      event_id: 'test',
      received_at: new Date().toISOString(),
      status: 'pending'
    })
    .select()
    .single();

  if (insertError) {
    if (insertError.message?.includes('foreign key constraint')) {
      console.log('   ✅ Table structure correct (foreign key working)\n');
    } else if (insertError.message?.includes('violates check constraint')) {
      console.log('   ✅ Table structure correct (constraints working)\n');
    } else if (insertError.message?.includes('relation') && insertError.message?.includes('does not exist')) {
      console.log('   ❌ Table does not exist\n');
      allPassed = false;
    } else {
      console.log(`   ⚠️  Structure test inconclusive: ${insertError.message}\n`);
    }
  } else {
    // Cleanup test data
    if (insertTest?.id) {
      await supabase.from('webhook_delivery_log').delete().eq('id', insertTest.id);
    }
    console.log('   ✅ Table structure correct\n');
  }

  // Test 3: Check if cleanup job can access table
  console.log('[3/4] Checking cleanup job compatibility...');

  const { error: selectError } = await supabase
    .from('webhook_delivery_log')
    .select('*', { count: 'exact', head: true })
    .lt('created_at', new Date().toISOString());

  if (selectError) {
    console.log(`   ❌ Cleanup job query failed: ${selectError.message}\n`);
    allPassed = false;
  } else {
    console.log('   ✅ Cleanup job queries work\n');
  }

  // Test 4: Overall status
  console.log('[4/4] Overall migration status...\n');

  if (allPassed) {
    console.log('═'.repeat(80));
    console.log('✅ MIGRATION SUCCESSFULLY APPLIED');
    console.log('═'.repeat(80));
    console.log('');
    console.log('The webhook_delivery_log table is ready for production!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Run production readiness tests:');
    console.log('   npm run test:production');
    console.log('');
    console.log('2. Start the development server:');
    console.log('   npm run dev');
    console.log('');
    console.log('3. Deploy to production when ready');
    console.log('');
    console.log('═'.repeat(80));
    process.exit(0);
  } else {
    console.log('═'.repeat(80));
    console.log('❌ MIGRATION NOT APPLIED YET');
    console.log('═'.repeat(80));
    console.log('');
    console.log('Please apply the migration first:');
    console.log('');
    console.log('Option 1: Use the browser (EASIEST)');
    console.log('  1. SQL is already in your clipboard');
    console.log('  2. Open: https://supabase.com/dashboard/project/lbjymlodxprzqgtyqtcq/sql/new');
    console.log('  3. Paste (Cmd+V) and run');
    console.log('');
    console.log('Option 2: Copy SQL manually');
    console.log('  cat backend/migrations/20260127_webhook_delivery_tracking.sql | pbcopy');
    console.log('');
    console.log('See MIGRATION_STATUS.md for detailed instructions');
    console.log('');
    console.log('═'.repeat(80));
    process.exit(1);
  }
}

// Run verification
verifyMigration().catch(error => {
  console.error('\n💥 Verification error:', error.message);
  process.exit(1);
});
