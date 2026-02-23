import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const supabaseUrl = 'https://lbjymlodxprzqgtyqtcq.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxianltbG9keHByenFndHlxdGNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM0OTUzMSwiZXhwIjoyMDc4OTI1NTMxfQ.5B2bBOUgXw2qC6QpIkU2DNZiqMW20y8MzgLQ56LEtFA';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  db: { schema: 'public' }
});

async function executeSQL(sql: string, description: string) {
  console.log(`\n[*] ${description}`);
  try {
    // Use rpc to execute - we'll try with a wrapping function
    const { data, error } = await supabase
      .from('pg_catalog.pg_tables')
      .select('*')
      .limit(1);
    
    if (error) throw error;
    
    console.log(`  ✓ Database connection verified`);
    return true;
  } catch (e: any) {
    console.error(`  ✗ Error: ${e.message}`);
    return false;
  }
}

async function main() {
  console.log('=== Migration Executor ===');
  console.log(`Supabase URL: ${supabaseUrl}`);
  
  // Read migration
  const migration = fs.readFileSync('./supabase/migrations/20260222_add_routing_direction.sql', 'utf8');
  console.log(`\nMigration size: ${migration.length} bytes`);
  console.log(`Lines: ${migration.split('\n').length}`);
  
  // Test connection first
  const connected = await executeSQL('SELECT 1', 'Testing Supabase connection...');
  
  if (!connected) {
    console.error('\n✗ Cannot connect to Supabase');
    process.exit(1);
  }
  
  console.log('\n✓ Connected successfully');
  console.log('\nNote: To apply this migration, use:');
  console.log('  supabase db push --include-all');
  console.log('  OR');
  console.log('  Use Supabase SQL Editor in web dashboard');
  console.log('  Then paste the SQL from: ./supabase/migrations/20260222_add_routing_direction.sql');
}

main();
