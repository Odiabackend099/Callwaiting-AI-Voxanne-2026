#!/usr/bin/env tsx

/**
 * Execute Migration via Supabase Management API
 * Directly executes SQL using service role key
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

// Extract project ref from URL
const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

if (!projectRef) {
  console.error('❌ Could not extract project ref from URL:', SUPABASE_URL);
  process.exit(1);
}

console.log(`\n🔧 Executing Migration via Supabase API`);
console.log(`   Project: ${projectRef}`);
console.log('');

async function executeMigration() {
  // Read the SIMPLE migration SQL
  const migrationPath = path.resolve(__dirname, '../../migrations/20260128_fix_kb_vector_SIMPLE.sql');

  if (!fs.existsSync(migrationPath)) {
    console.error('❌ Migration file not found:', migrationPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('📄 Migration loaded');
  console.log(`   File: ${path.basename(migrationPath)}`);
  console.log(`   Size: ${sql.length} characters`);
  console.log('');

  // Execute SQL via PostgREST
  console.log('🚀 Executing SQL statements...');
  console.log('');

  // Split into individual statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i] + ';';

    // Skip comments
    if (stmt.startsWith('--')) continue;

    console.log(`Statement ${i + 1}/${statements.length}: ${stmt.substring(0, 60)}...`);

    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({ query: stmt })
      });

      if (response.ok) {
        const result = await response.text();
        console.log(`   ✅ Success`);
        successCount++;
      } else {
        const error = await response.text();
        console.log(`   ⚠️  Failed: ${response.status} - ${error.substring(0, 100)}`);
        failCount++;
      }
    } catch (err: any) {
      console.log(`   ❌ Error: ${err.message}`);
      failCount++;
    }
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`📊 Execution Summary`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`   Success: ${successCount}`);
  console.log(`   Failed: ${failCount}`);
  console.log(`   Total: ${statements.length}`);
  console.log('');

  if (failCount > 0) {
    console.log('⚠️  Some statements failed.');
    console.log('');
    console.log('This is expected - Supabase REST API has limitations for DDL.');
    console.log('');
    console.log('Alternative: Use psql or Supabase CLI');
    console.log('');
    console.log('Install Supabase CLI:');
    console.log('  npm install -g supabase');
    console.log('');
    console.log('Then run:');
    console.log(`  supabase db execute --project-ref ${projectRef} --file migrations/20260128_fix_kb_vector_SIMPLE.sql`);
    console.log('');
  } else {
    console.log('✅ All statements executed successfully!');
  }
}

executeMigration();
