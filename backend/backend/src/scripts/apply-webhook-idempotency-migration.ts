#!/usr/bin/env ts-node
/**
 * Apply webhook idempotency migration
 * Creates processed_webhook_events table and helper functions
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = process.env.SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
});

async function applyMigration() {
  console.log('📦 Applying webhook idempotency migration...\n');

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '../../supabase/migrations/20260212_vapi_webhook_idempotency.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('✅ Migration file loaded');
    console.log(`   Path: ${migrationPath}`);
    console.log(`   Size: ${migrationSQL.length} bytes\n`);

    // Split SQL into individual statements (simple approach)
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';

      // Skip comments
      if (statement.trim().startsWith('--')) {
        continue;
      }

      console.log(`[${i + 1}/${statements.length}] Executing...`);

      const { data, error } = await supabase.rpc('_execute_sql' as any, {
        sql: statement
      });

      if (error) {
        // Try direct query instead
        const { error: queryError } = await (supabase as any).from('_').select('*').limit(0);

        console.log(`⚠️  RPC method not available, using alternative approach`);
        console.log(`   Statement: ${statement.substring(0, 80)}...`);

        // For this migration, we'll need to apply it manually
        // Log the statement for manual application
        console.log(`\n📋 Please apply this statement manually in Supabase SQL Editor:`);
        console.log(`\n${statement}\n`);
      } else {
        console.log(`✅ Success`);
      }
    }

    console.log('\n🎉 Migration application complete!');
    console.log('\n⚠️  Note: If RPC errors occurred, apply the full migration manually:');
    console.log(`   1. Open Supabase SQL Editor: https://supabase.com/dashboard/project/lbjymlodxprzqgtyqtcq/sql`);
    console.log(`   2. Copy contents from: backend/supabase/migrations/20260212_vapi_webhook_idempotency.sql`);
    console.log(`   3. Paste and run the SQL\n`);

  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

applyMigration();
