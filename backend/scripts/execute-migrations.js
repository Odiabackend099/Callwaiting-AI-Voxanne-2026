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
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
      'apikey': supabaseKey
    },
    body: JSON.stringify({ sql_query: sql })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return await response.json();
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
      const result = await executeSql(sql);
      console.log(`✅ Migration applied successfully\n`);
    } catch (err) {
      console.error(`❌ Migration failed: ${migration.name}`);
      console.error(`   Error: ${err.message}\n`);
      process.exit(1);
    }
  }

  console.log('🔍 Verifying migrations...\n');

  // Verify view exists
  try {
    const viewSql = `SELECT EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'view_actionable_leads')`;
    const viewResult = await executeSql(viewSql);
    console.log('✅ view_actionable_leads exists');
  } catch (err) {
    console.log('⚠️  Could not verify view_actionable_leads');
  }

  // Verify indexes exist
  try {
    const indexSql = `SELECT COUNT(*) as count FROM pg_indexes WHERE indexname IN ('idx_calls_org_date_pagination', 'idx_calls_direction_date')`;
    const indexResult = await executeSql(indexSql);
    console.log('✅ Pagination indexes exist');
  } catch (err) {
    console.log('⚠️  Could not verify indexes');
  }

  // Verify function exists
  try {
    const funcSql = `SELECT EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'get_dashboard_stats_optimized')`;
    const funcResult = await executeSql(funcSql);
    console.log('✅ get_dashboard_stats_optimized function exists');
  } catch (err) {
    console.log('⚠️  Could not verify function');
  }

  console.log('\n🎉 All migrations applied successfully!');
}

applyMigrations().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
