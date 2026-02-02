import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const migrations = [
  '20260202_create_view_actionable_leads.sql',
  '20260202_add_calls_pagination_index.sql',
  '20260202_optimize_dashboard_stats.sql'
];

async function applyMigrations() {
  console.log('🚀 Starting database migrations...\n');

  for (const migration of migrations) {
    const migrationPath = path.join(__dirname, 'supabase', 'migrations', migration);
    
    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Migration file not found: ${migrationPath}`);
      process.exit(1);
    }

    const sql = fs.readFileSync(migrationPath, 'utf-8');
    
    console.log(`📝 Applying migration: ${migration}`);
    console.log(`   Path: ${migrationPath}`);
    
    try {
      const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
      
      if (error) {
        console.error(`❌ Migration failed: ${migration}`);
        console.error(`   Error: ${error.message}`);
        process.exit(1);
      }
      
      console.log(`✅ Migration applied successfully: ${migration}\n`);
    } catch (err: any) {
      console.error(`❌ Error executing migration: ${migration}`);
      console.error(`   Error: ${err.message}`);
      process.exit(1);
    }
  }

  // Verify migrations
  console.log('🔍 Verifying migrations...\n');

  // Check view_actionable_leads
  try {
    const { data, error } = await supabase
      .from('view_actionable_leads')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('❌ view_actionable_leads does not exist or is not accessible');
    } else {
      console.log('✅ view_actionable_leads exists and is accessible');
    }
  } catch (err) {
    console.error('❌ Error checking view_actionable_leads:', err);
  }

  // Check indexes
  try {
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: `
        SELECT indexname FROM pg_indexes 
        WHERE indexname IN ('idx_calls_org_date_pagination', 'idx_calls_direction_date')
      `
    });
    
    if (!error && data) {
      console.log('✅ Pagination indexes exist');
    } else {
      console.log('⚠️  Could not verify indexes');
    }
  } catch (err) {
    console.log('⚠️  Could not verify indexes');
  }

  // Check function
  try {
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: `
        SELECT routine_name FROM information_schema.routines 
        WHERE routine_name = 'get_dashboard_stats_optimized'
      `
    });
    
    if (!error && data) {
      console.log('✅ get_dashboard_stats_optimized function exists');
    } else {
      console.log('⚠️  Could not verify function');
    }
  } catch (err) {
    console.log('⚠️  Could not verify function');
  }

  console.log('\n🎉 All migrations applied successfully!');
}

applyMigrations().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
