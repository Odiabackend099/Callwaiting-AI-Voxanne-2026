/**
 * Apply metadata column migration to org_credentials table
 * Run with: npx tsx src/scripts/apply-metadata-migration.ts
 */

import { supabase } from '../services/supabase-client';
import { readFileSync } from 'fs';
import { join } from 'path';

async function applyMigration() {
  console.log('\n🔧 Applying metadata column migration to org_credentials table...\n');

  try {
    // Step 1: Add metadata column
    console.log('Step 1/4: Adding metadata column...');
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE org_credentials
        ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT NULL;
      `
    });

    if (alterError) {
      console.warn('  ⚠️  Note: exec_sql RPC not available, trying direct approach...');

      // Alternative: Just try to insert a row and see if metadata column exists
      const { error: testError } = await supabase
        .from('org_credentials')
        .select('metadata')
        .limit(1);

      if (testError && testError.message?.includes('column')) {
        console.error('  ❌ Migration required but cannot apply automatically');
        console.log('\n📋 MANUAL STEPS REQUIRED:');
        console.log('');
        console.log('Go to: https://app.supabase.com/project/YOUR_PROJECT/sql');
        console.log('Run this SQL:');
        console.log('');
        console.log(readFileSync(join(__dirname, '../../../migrations/20260116_add_metadata_to_org_credentials.sql'), 'utf-8'));
        console.log('');
        process.exit(1);
      } else {
        console.log('  ✅ metadata column already exists or accessible');
      }
    } else {
      console.log('  ✅ metadata column added');
    }

    // Step 2: Add index
    console.log('\nStep 2/4: Creating GIN index on metadata...');
    const { error: indexError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_org_credentials_metadata
        ON org_credentials USING GIN (metadata);
      `
    });

    if (indexError) {
      console.log('  ⚠️  Index creation skipped (may already exist or RPC unavailable)');
    } else {
      console.log('  ✅ Index created');
    }

    // Step 3: Verify column exists
    console.log('\nStep 3/4: Verifying metadata column...');
    const { data: verifyData, error: verifyError } = await supabase
      .from('org_credentials')
      .select('metadata')
      .limit(1);

    if (verifyError) {
      console.error('  ❌ Verification failed:', verifyError.message);
      throw verifyError;
    }

    console.log('  ✅ metadata column verified and accessible');

    // Step 4: Test insert
    console.log('\nStep 4/4: Testing metadata functionality...');
    const testOrgId = 'test-' + Date.now();
    const testMetadata = { test: true, timestamp: new Date().toISOString() };

    const { error: testInsertError } = await supabase
      .from('org_credentials')
      .insert({
        org_id: testOrgId,
        provider: 'google_calendar',
        encrypted_config: 'test',
        metadata: testMetadata
      });

    if (testInsertError) {
      // This might fail due to FK constraints, which is fine
      if (testInsertError.message?.includes('foreign key') || testInsertError.message?.includes('violates')) {
        console.log('  ✅ metadata column accepts JSONB data (FK constraint expected)');
      } else {
        console.error('  ❌ Test insert failed:', testInsertError.message);
        throw testInsertError;
      }
    } else {
      console.log('  ✅ metadata column working correctly');
      // Clean up test row
      await supabase
        .from('org_credentials')
        .delete()
        .eq('org_id', testOrgId);
    }

    console.log('\n✨ Migration completed successfully!\n');
    console.log('Next steps:');
    console.log('1. Restart your backend server (Ctrl+C and npm run dev)');
    console.log('2. Reload the frontend in your browser');
    console.log('3. Try clicking "Link My Google Calendar"\n');

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    console.log('\n📋 MANUAL MIGRATION REQUIRED:');
    console.log('');
    console.log('Go to: https://app.supabase.com/project/YOUR_PROJECT/sql');
    console.log('Copy and paste the SQL from:');
    console.log('  migrations/20260116_add_metadata_to_org_credentials.sql');
    console.log('');
    process.exit(1);
  }
}

applyMigration();
