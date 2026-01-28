/**
 * Apply Migration Script
 *
 * Applies a SQL migration file to the database
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('❌ Usage: npx tsx src/scripts/apply-migration.ts <migration-file>');
  process.exit(1);
}

async function applyMigration() {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
    }

    console.log(`📝 Applying migration: ${migrationFile}\n`);

    // Read migration file
    const migrationPath = join(process.cwd(), 'migrations', migrationFile);
    const sql = readFileSync(migrationPath, 'utf-8');

    console.log('SQL to execute:');
    console.log('─'.repeat(60));
    console.log(sql);
    console.log('─'.repeat(60));
    console.log('');

    // Initialize Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Execute migration
    console.log('⚙️ Executing migration...');
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql }).maybeSingle();

    if (error) {
      // Try direct execution if RPC doesn't exist
      console.log('⚠️ RPC method not available, trying alternative...\n');

      // Split by semicolons and execute each statement
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        if (!statement) continue;

        console.log(`Executing: ${statement.substring(0, 80)}...`);
        const result: any = await supabase.rpc('exec_sql', { sql: statement });

        if (result.error) {
          throw new Error(`Failed to execute statement: ${result.error.message}`);
        }
      }
    }

    console.log('\n✅ Migration applied successfully!');

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

applyMigration();
