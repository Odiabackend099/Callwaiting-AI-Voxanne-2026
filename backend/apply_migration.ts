import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = 'https://lbjymlodxprzqgtyqtcq.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxianltbG9keHByenFndHlxdGNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM0OTUzMSwiZXhwIjoyMDc4OTI1NTMxfQ.5B2bBOUgXw2qC6QpIkU2DNZiqMW20y8MzgLQ56LEtFA';

console.log('Supabase URL:', supabaseUrl);
console.log('Service Role Key:', serviceRoleKey.substring(0, 50) + '...');

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function executeMigration() {
  try {
    const migrationPath = path.join('./supabase/migrations/20260222_add_routing_direction.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('\n=== Executing Migration ===');
    console.log('File:', migrationPath);
    console.log('Lines:', migrationSQL.split('\n').length);
    console.log('Size:', migrationSQL.length, 'bytes');
    
    // Try to execute using the raw HTTP endpoint
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/sql_execute`, {
      method: 'POST',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql: migrationSQL })
    });

    const result = await response.json();
    
    console.log('\nResponse Status:', response.status);
    console.log('Response:', JSON.stringify(result, null, 2));
    
    if (!response.ok) {
      console.error('\n✗ ERROR: Migration failed');
      process.exit(1);
    }
    
    console.log('\n✓ SUCCESS: Migration executed');
    
  } catch (error: any) {
    console.error('\n✗ FATAL ERROR:', error.message);
    process.exit(1);
  }
}

executeMigration();
