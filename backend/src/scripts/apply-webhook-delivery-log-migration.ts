/**
 * Apply webhook_delivery_log Migration
 *
 * Creates the webhook_delivery_log table for tracking webhook processing
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

async function applyMigration() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Read migration file
  const migrationPath = path.join(__dirname, '../../migrations/20260127_webhook_delivery_tracking.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

  console.log('Applying webhook_delivery_log migration...');
  console.log('Migration SQL:');
  console.log(migrationSQL);
  console.log('');

  try {
    // Execute migration
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: migrationSQL
    });

    if (error) {
      console.error('Migration failed:', error);

      // Try direct query if RPC doesn't exist
      console.log('Trying direct query execution...');

      const lines = migrationSQL.split(';').filter(line => line.trim());

      for (const statement of lines) {
        if (!statement.trim()) continue;

        console.log(`Executing: ${statement.substring(0, 100)}...`);

        const { error: stmtError } = await supabase.rpc('exec', {
          query: statement
        }) as any;

        if (stmtError) {
          console.error('Statement failed:', stmtError);
        }
      }
    } else {
      console.log('✅ Migration applied successfully');
    }

    // Verify table exists
    const { data: tableCheck, error: tableError } = await supabase
      .from('webhook_delivery_log')
      .select('id')
      .limit(1);

    if (tableError) {
      console.error('⚠️  Warning: Table verification failed:', tableError.message);
      console.log('The table may not exist yet. You may need to apply the migration manually.');
      console.log('');
      console.log('Manual steps:');
      console.log('1. Open Supabase Dashboard > SQL Editor');
      console.log('2. Paste the migration SQL from:');
      console.log(`   ${migrationPath}`);
      console.log('3. Run the query');
    } else {
      console.log('✅ Table webhook_delivery_log verified');
    }

  } catch (error) {
    console.error('Error applying migration:', error);
    process.exit(1);
  }
}

applyMigration()
  .then(() => {
    console.log('Migration complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
