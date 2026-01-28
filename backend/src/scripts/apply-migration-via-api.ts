/**
 * Apply Migration via Supabase Management API
 *
 * This script uses Supabase's Management API to execute SQL directly
 * Bypasses the need for direct PostgreSQL connection
 */

import { createClient } from '@supabase/supabase-js';

async function applyMigrationViaAPI() {
  console.log('🚀 Applying webhook_delivery_log migration via Management API...\n');

  const supabaseUrl = process.env.SUPABASE_URL?.replace(/'/g, '') || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/'/g, '') || '';

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  console.log(`✅ Supabase URL: ${supabaseUrl}`);
  console.log(`✅ Service Key: ${supabaseKey.substring(0, 20)}...`);

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Migration SQL
  const migrationSQL = `
    CREATE TABLE IF NOT EXISTS webhook_delivery_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id),
      event_type TEXT NOT NULL,
      event_id TEXT NOT NULL,
      received_at TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'dead_letter')),
      attempts INTEGER NOT NULL DEFAULT 0,
      last_attempt_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      error_message TEXT,
      job_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_webhook_delivery_org_id ON webhook_delivery_log(org_id);
    CREATE INDEX IF NOT EXISTS idx_webhook_delivery_status ON webhook_delivery_log(status);
    CREATE INDEX IF NOT EXISTS idx_webhook_delivery_created_at ON webhook_delivery_log(created_at);
  `.trim();

  console.log('\n📄 Migration SQL:');
  console.log('─'.repeat(80));
  console.log(migrationSQL);
  console.log('─'.repeat(80));
  console.log('');

  // Try to create a temporary function to execute the SQL
  console.log('🔧 Attempting to create temporary SQL execution function...\n');

  try {
    // First, create an RPC function that can execute arbitrary SQL (if we have permissions)
    const createFunctionSQL = `
      CREATE OR REPLACE FUNCTION exec_migration_sql(sql_query text)
      RETURNS void AS $$
      BEGIN
        EXECUTE sql_query;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `;

    // Try to call this via RPC (this will fail if function doesn't exist)
    const { error: rpcError } = await supabase.rpc('exec_migration_sql', {
      sql_query: migrationSQL
    }) as any;

    if (rpcError) {
      console.log(`⚠️  Cannot execute SQL directly via RPC: ${rpcError.message}`);
      console.log('');
      throw new Error('Manual migration required');
    }

    console.log('✅ Migration applied successfully via RPC!');

  } catch (error: any) {
    console.log('❌ Automatic migration failed\n');
    console.log('═'.repeat(80));
    console.log('📋 MANUAL MIGRATION REQUIRED');
    console.log('═'.repeat(80));
    console.log('');
    console.log('Due to network/permissions limitations, please apply this migration manually:');
    console.log('');
    console.log('STEPS:');
    console.log('------');
    console.log('1. Open your browser to: https://supabase.com/dashboard/project/lbjymlodxprzqgtyqtcq');
    console.log('2. Navigate to: SQL Editor (left sidebar)');
    console.log('3. Click "New Query"');
    console.log('4. Copy and paste the SQL below:');
    console.log('');
    console.log('─'.repeat(80));
    console.log(migrationSQL);
    console.log('─'.repeat(80));
    console.log('');
    console.log('5. Click "Run" or press Cmd+Enter');
    console.log('6. Verify you see: "Success. No rows returned"');
    console.log('');
    console.log('═'.repeat(80));
    console.log('');

    // Try to verify if table exists (in case it was created before)
    console.log('🔍 Checking if table already exists...\n');

    const { data, error: checkError } = await supabase
      .from('webhook_delivery_log')
      .select('id')
      .limit(1);

    if (!checkError) {
      console.log('✅ Table webhook_delivery_log ALREADY EXISTS!');
      console.log('✅ Migration was likely applied previously.');
      console.log('\n🎉 No action needed - you\'re good to go!');
      process.exit(0);
    }

    if (checkError?.message?.includes('relation') && checkError?.message?.includes('does not exist')) {
      console.log('⚠️  Table does NOT exist yet.');
      console.log('📝 Please follow the manual steps above to create it.\n');
      process.exit(1);
    }

    console.log(`⚠️  Table check returned unexpected error: ${checkError?.message}`);
    console.log('Please verify table status in Supabase Dashboard.\n');
    process.exit(1);
  }

  // Verify table was created
  console.log('\n🔍 Verifying table creation...');

  const { data, error: verifyError } = await supabase
    .from('webhook_delivery_log')
    .select('id')
    .limit(1);

  if (verifyError) {
    console.log(`❌ Verification failed: ${verifyError.message}`);
    process.exit(1);
  }

  console.log('✅ Table webhook_delivery_log verified!');
  console.log('\n🎉 Migration completed successfully!');
  process.exit(0);
}

// Run migration
applyMigrationViaAPI().catch(error => {
  console.error('\n💥 Fatal error:', error.message);
  process.exit(1);
});
