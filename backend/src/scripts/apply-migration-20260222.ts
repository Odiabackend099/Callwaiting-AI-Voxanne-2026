import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const supabaseUrl = process.env.SUPABASE_URL || 'https://lbjymlodxprzqgtyqtcq.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function main() {
  console.log('Applying migration 20260222_add_routing_direction...\n');
  
  // Read and split migration into individual statements
  const migrationPath = './supabase/migrations/20260222_add_routing_direction.sql';
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
  
  // Split into statements - use a simple approach: split by ;$$ for function definitions
  // and ; for regular statements
  const statements: string[] = [];
  let current = '';
  let inFunction = false;
  
  const lines = migrationSQL.split('\n');
  
  for (const line of lines) {
    if (line.includes('CREATE') || line.includes('CREATE OR REPLACE')) {
      inFunction = true;
    }
    
    current += line + '\n';
    
    if (inFunction && line.trim() === '$$;') {
      statements.push(current.trim());
      current = '';
      inFunction = false;
    } else if (!inFunction && line.trim().endsWith(';') && line.trim() !== ';' && !line.trim().startsWith('--')) {
      statements.push(current.trim());
      current = '';
    }
  }
  
  if (current.trim()) {
    statements.push(current.trim());
  }
  
  console.log(`Found ${statements.length} statements\n`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    
    if (!stmt.trim() || stmt.trim().startsWith('--')) {
      continue;
    }
    
    console.log(`[${i+1}/${statements.length}] Executing...`);
    console.log(`  ${stmt.substring(0, 80)}${stmt.length > 80 ? '...' : ''}`);
    
    try {
      // Use the raw fetch API to execute SQL
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/migrate`, {
        method: 'POST',
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sql: stmt })
      });
      
      if (!response.ok) {
        const data = await response.json();
        console.log(`  ✗ Error: ${data.message}`);
        failCount++;
      } else {
        console.log('  ✓ Success');
        successCount++;
      }
    } catch (e: any) {
      console.error(`  ✗ Exception: ${e.message}`);
      failCount++;
    }
  }
  
  console.log(`\n=== Result ===`);
  console.log(`Successful: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  
  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch(e => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
