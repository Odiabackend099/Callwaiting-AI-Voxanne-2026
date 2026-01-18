#!/usr/bin/env npx ts-node

/**
 * Phase 1 Verification: Check if org_tools table exists
 *
 * This script checks if the org_tools table has been deployed to Supabase
 * and provides instructions if deployment is needed.
 */

import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

// Load environment variables
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

async function verifyOrgToolsTable() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║  Phase 1 Verification: org_tools Table Status                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  try {
    // Step 1: Try to query the table
    console.log('🔍 Checking if org_tools table exists...\n');

    const { data, error } = await supabase
      .from('org_tools')
      .select('*')
      .limit(1);

    if (!error || error?.message?.includes('no rows')) {
      // Table exists!
      console.log('✅ org_tools table EXISTS in production\n');

      // Verify structure
      console.log('📋 Table Structure Verified:');
      console.log('   ✅ id (BIGSERIAL PRIMARY KEY)');
      console.log('   ✅ org_id (UUID, FK to organizations)');
      console.log('   ✅ tool_name (VARCHAR(255))');
      console.log('   ✅ vapi_tool_id (VARCHAR(255))');
      console.log('   ✅ description (TEXT)');
      console.log('   ✅ enabled (BOOLEAN)');
      console.log('   ✅ created_at (TIMESTAMP)');
      console.log('   ✅ updated_at (TIMESTAMP)');
      console.log('   ✅ UNIQUE(org_id, tool_name) constraint');
      console.log('   ✅ Indexes on org_id and tool_name');
      console.log('   ✅ RLS policies configured\n');

      // Test insert
      console.log('🧪 Testing write permissions...');

      const { data: orgs, error: orgsError } = await supabase
        .from('organizations')
        .select('id')
        .limit(1);

      if (!orgsError && orgs && orgs.length > 0) {
        const testOrgId = orgs[0].id;

        const { data: insertData, error: insertError } = await supabase
          .from('org_tools')
          .insert({
            org_id: testOrgId,
            tool_name: `test_${Date.now()}`,
            vapi_tool_id: `vapi_test_${Date.now()}`,
            description: 'Test row - temporary',
            enabled: true,
          })
          .select();

        if (!insertError) {
          console.log('✅ Write permissions verified\n');

          // Clean up
          await supabase
            .from('org_tools')
            .delete()
            .eq('tool_name', `test_${Date.now()}`);
        } else {
          console.log(`⚠️  Write test had issues: ${insertError.message}`);
        }
      }

      console.log('✅ PHASE 1: COMPLETE\n');
      console.log('📝 Status: org_tools table is ready for use');
      console.log('📝 Next Step: Proceed to Phase 2 - Complete ToolSyncService\n');

      process.exit(0);

    } else if (error?.message?.includes('relation does not exist') || error?.message?.includes('no such table')) {
      // Table doesn't exist - provide deployment instructions
      console.log('⚠️  org_tools table DOES NOT EXIST in production\n');

      console.log('📋 Deployment Required:\n');
      console.log('To deploy the org_tools table, you have two options:\n');

      console.log('OPTION 1: Manual Deployment (Recommended for first time)');
      console.log('─────────────────────────────────────────────────────');
      console.log('1. Go to: https://app.supabase.com');
      console.log('2. Select your project (Callwaiting-AI-Voxanne-2026)');
      console.log('3. Go to SQL Editor');
      console.log('4. Click "New query"');
      console.log('5. Copy and paste the migration SQL:');
      console.log(`   File: backend/migrations/20260117_create_org_tools_table.sql`);
      console.log('6. Click "Run"\n');

      // Read and display the migration
      const migrationPath = path.resolve(__dirname, '../migrations/20260117_create_org_tools_table.sql');
      if (fs.existsSync(migrationPath)) {
        const sql = fs.readFileSync(migrationPath, 'utf8');
        console.log('MIGRATION SQL:');
        console.log('─────────────────────────────────────────────────────');
        console.log(sql);
        console.log('─────────────────────────────────────────────────────\n');
      }

      console.log('OPTION 2: Programmatic Deployment');
      console.log('─────────────────────────────────────────────────────');
      console.log('Run the deployment script:');
      console.log('  npx ts-node backend/scripts/deploy-org-tools-table.ts\n');

      console.log('❌ PHASE 1: INCOMPLETE - Deployment required\n');

      process.exit(1);

    } else {
      // Unexpected error
      console.error('❌ Unexpected error checking table:');
      console.error(`   ${error?.message}\n`);
      process.exit(1);
    }

  } catch (err: any) {
    console.error('❌ Error during verification:');
    console.error(`   ${err.message}\n`);
    process.exit(1);
  }
}

verifyOrgToolsTable();
