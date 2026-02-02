import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
const envPath = path.join(__dirname, '..', '.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath, 'utf-8'));

const supabaseUrl = envConfig.SUPABASE_URL;
const supabaseKey = envConfig.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

console.log('✅ Environment variables loaded');
console.log(`📍 Supabase URL: ${supabaseUrl}`);

// Import Supabase client
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(supabaseUrl, supabaseKey);

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

async function applyMigrations() {
  console.log('\n🚀 Starting database migrations...\n');

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
      // Execute SQL directly via Supabase admin API
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
        console.error(`❌ Migration failed: ${migration.name}`);
        console.error(`   Error: ${error}`);
        process.exit(1);
      }

      console.log(`✅ Migration applied successfully\n`);
    } catch (err: any) {
      console.error(`❌ Error executing migration: ${migration.name}`);
      console.error(`   Error: ${err.message}`);
      process.exit(1);
    }
  }

  // Verify migrations
  console.log('🔍 Verifying migrations...\n');

  try {
    // Check if view exists
    const viewCheck = await supabase
      .from('view_actionable_leads')
      .select('*')
      .limit(1);
    
    if (!viewCheck.error) {
      console.log('✅ view_actionable_leads exists and is accessible');
    } else {
      console.log('⚠️  view_actionable_leads check returned:', viewCheck.error.message);
    }
  } catch (err: any) {
    console.log('⚠️  Could not verify view_actionable_leads');
  }

  console.log('\n🎉 All migrations applied successfully!');
  console.log('\nNext steps:');
  console.log('1. Verify in Supabase dashboard that all objects exist');
  console.log('2. Test dashboard performance improvements');
  console.log('3. Monitor call list loading times');
}

applyMigrations().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
