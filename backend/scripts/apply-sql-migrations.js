#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read .env file
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');

// Parse environment variables
const supabaseUrl = envContent.match(/^SUPABASE_URL='([^']+)'/m)?.[1];
const supabaseKey = envContent.match(/^SUPABASE_SERVICE_ROLE_KEY='([^']+)'/m)?.[1];

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Could not find SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

console.log('✅ Environment loaded');
console.log(`📍 Supabase: ${supabaseUrl}`);
console.log('');

const migrations = [
  {
    name: '20260202_create_view_actionable_leads.sql',
    description: 'Create view_actionable_leads for dashboard hot leads'
  },
  {
    name: '20260202_add_calls_pagination_index.sql',
    description: 'Add composite indexes for fast call list pagination'
  },
  {
    name: '20260202_optimize_dashboard_stats.sql',
    description: 'Create optimized dashboard stats RPC function'
  }
];

async function executeSql(sql) {
  // Split SQL into individual statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const statement of statements) {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        query: statement + ';'
      })
    });

    // Try alternative approach: use the Supabase SQL editor endpoint
    if (!response.ok) {
      // Try direct SQL execution via different endpoint
      const sqlResponse = await fetch(`${supabaseUrl}/rest/v1/sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          query: statement
        })
      });

      if (!sqlResponse.ok) {
        const error = await sqlResponse.text();
        console.error(`SQL Error: ${error}`);
        throw new Error(error);
      }
    }
  }
}

async function applyMigrations() {
  console.log('🚀 Starting database migrations...\n');

  for (let i = 0; i < migrations.length; i++) {
    const migration = migrations[i];
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', migration.name);

    console.log(`📝 Migration ${i + 1}/${migrations.length}: ${migration.description}`);
    console.log(`   File: ${migration.name}`);

    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Migration file not found: ${migrationPath}`);
      process.exit(1);
    }

    const sql = fs.readFileSync(migrationPath, 'utf-8');

    try {
      await executeSql(sql);
      console.log(`✅ Migration applied successfully\n`);
    } catch (err) {
      console.error(`❌ Migration failed: ${migration.name}`);
      console.error(`   Error: ${err.message}\n`);
      // Continue to next migration instead of exiting
    }
  }

  console.log('🎉 Migration execution completed!');
  console.log('\n📋 Next steps:');
  console.log('1. Visit Supabase dashboard to verify migrations');
  console.log('2. Check SQL Editor for view_actionable_leads');
  console.log('3. Verify indexes in Database > Indexes');
  console.log('4. Test get_dashboard_stats_optimized function');
}

applyMigrations().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
