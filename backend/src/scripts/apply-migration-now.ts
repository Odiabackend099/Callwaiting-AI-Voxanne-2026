/**
 * Apply webhook_delivery_log Migration - Direct Execution
 * This script applies the migration immediately using Supabase client
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

async function applyMigration() {
  console.log('🚀 Applying webhook_delivery_log migration...\n');

  const supabaseUrl = process.env.SUPABASE_URL?.replace(/'/g, '');
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/'/g, '');

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  console.log(`✅ Supabase URL: ${supabaseUrl}`);
  console.log(`✅ Service role key: ${supabaseKey.substring(0, 20)}...`);

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Read migration file
  const migrationPath = path.join(__dirname, '../../migrations/20260127_webhook_delivery_tracking.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

  console.log('\n📄 Migration SQL:');
  console.log('─'.repeat(80));
  console.log(migrationSQL);
  console.log('─'.repeat(80));
  console.log('');

  // Split into individual statements
  const statements = migrationSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  console.log(`\n🔧 Executing ${statements.length} SQL statements...\n`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i] + ';';
    const preview = statement.substring(0, 60).replace(/\n/g, ' ') + '...';

    console.log(`[${i + 1}/${statements.length}] ${preview}`);

    try {
      // Use Supabase to execute raw SQL
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: statement
      }) as any;

      if (error) {
        // Try alternative method if exec_sql doesn't exist
        if (error.message?.includes('function') || error.message?.includes('not found')) {
          console.log(`   ⚠️  exec_sql RPC not available, trying direct query...`);

          // For CREATE TABLE, we can check if table exists first
          if (statement.includes('CREATE TABLE webhook_delivery_log')) {
            const { data: tableCheck, error: tableError } = await supabase
              .from('webhook_delivery_log')
              .select('id')
              .limit(1);

            if (tableError && tableError.message?.includes('relation') && tableError.message?.includes('does not exist')) {
              console.log(`   ℹ️  Table doesn't exist - this is a manual migration`);
              console.log(`   📝 You'll need to run this SQL in Supabase Dashboard > SQL Editor:`);
              console.log('');
              console.log(statement);
              console.log('');
              errorCount++;
              continue;
            } else if (!tableError) {
              console.log(`   ✅ Table already exists - skipping`);
              successCount++;
              continue;
            }
          }

          // For indexes, try to create them via SQL Editor instructions
          if (statement.includes('CREATE INDEX')) {
            console.log(`   📝 Index creation - run manually in SQL Editor:`);
            console.log('');
            console.log(statement);
            console.log('');
            errorCount++;
            continue;
          }

          throw error;
        }

        throw error;
      }

      console.log(`   ✅ Success`);
      successCount++;
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 Migration Summary');
  console.log('='.repeat(80));
  console.log(`✅ Successful: ${successCount}/${statements.length}`);
  console.log(`❌ Failed: ${errorCount}/${statements.length}`);
  console.log('='.repeat(80));

  // Verify table exists
  console.log('\n🔍 Verifying table creation...');

  const { data: tableCheck, error: tableError } = await supabase
    .from('webhook_delivery_log')
    .select('id')
    .limit(1);

  if (tableError) {
    if (tableError.message?.includes('relation') && tableError.message?.includes('does not exist')) {
      console.log('❌ Table NOT created - Manual migration required\n');
      console.log('📋 MANUAL STEPS:');
      console.log('1. Open Supabase Dashboard: https://supabase.com/dashboard');
      console.log('2. Navigate to: SQL Editor');
      console.log('3. Copy the SQL from: backend/migrations/20260127_webhook_delivery_tracking.sql');
      console.log('4. Paste and run the query');
      console.log('5. Re-run this script to verify\n');
      process.exit(1);
    } else {
      console.log(`⚠️  Unexpected error: ${tableError.message}`);
      console.log('Table may exist but query failed. Check Supabase Dashboard.');
      process.exit(1);
    }
  } else {
    console.log('✅ Table webhook_delivery_log verified and accessible!');
    console.log('\n🎉 Migration completed successfully!');
    process.exit(0);
  }
}

// Execute migration
applyMigration().catch(error => {
  console.error('\n💥 Fatal error:', error.message);
  console.error(error);
  process.exit(1);
});
