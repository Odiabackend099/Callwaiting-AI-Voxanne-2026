import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

async function main() {
  const supabaseUrl = 'https://lbjymlodxprzqgtyqtcq.supabase.co';
  const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxianltbG9keHByenFndHlxdGNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM0OTUzMSwiZXhwIjoyMDc4OTI1NTMxfQ.5B2bBOUgXw2qC6QpIkU2DNZiqMW20y8MzgLQ56LEtFA';

  console.log('Applying migration 20260222_add_routing_direction...\n');
  
  const migrationPath = './supabase/migrations/20260222_add_routing_direction.sql';
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
  
  // Simple split: statements end with );  or ;$$ or just ;
  const parts = migrationSQL.split(/;\s*\n/);
  
  const statements = parts
    .map((s: string) => s.trim() + ';')
    .filter((s: string) => s.trim().length > 2 && !s.trim().startsWith('--'));
  
  console.log(`Found ${statements.length} statements\n`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    
    console.log(`[${i+1}/${statements.length}] Executing (${stmt.length} bytes)...`);
    
    try {
      // Try making a simple HTTP call to test connectivity first
      if (i === 0) {
        const testResponse = await fetch(`${supabaseUrl}/rest/v1/`, {
          headers: {
            'apikey': serviceRoleKey,
            'Authorization': `Bearer ${serviceRoleKey}`
          }
        });
        console.log(`  [*] Connectivity test: ${testResponse.status}`);
      }
      
      // Try executing the statement via a custom RPC if it existed
      // Since it doesn't, we can only show what would be executed
      console.log(`  Statement preview:`);
      console.log(`  ${stmt.substring(0, 100)}${stmt.length > 100 ? '...' : ''}`);
      
    } catch (e: any) {
      console.error(`  ✗ Exception: ${e.message}`);
      failCount++;
    }
  }
  
  console.log(`\n=== Summary ===`);
  console.log(`Total statements: ${statements.length}`);
  console.log('\nTo apply this migration, use the Supabase SQL Editor or run:');
  console.log('  supabase db push');
}

main().catch(e => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
