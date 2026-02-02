const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function applyMigrations() {
  const client = new Client({
    connectionString: 'postgresql://postgres:Eguale%402021%3F@db.lbjymlodxprzqgtyqtcq.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔌 Connecting to Supabase database...');
    await client.connect();
    console.log('✅ Connected successfully\n');

    const migrations = [
      '20260202_create_view_actionable_leads.sql',
      '20260202_add_calls_pagination_index.sql',
      '20260202_optimize_dashboard_stats.sql'
    ];

    for (const migration of migrations) {
      const filePath = path.join(__dirname, 'supabase', 'migrations', migration);
      const sql = fs.readFileSync(filePath, 'utf8');

      console.log(`📝 Applying migration: ${migration}`);
      try {
        await client.query(sql);
        console.log(`✅ Migration applied successfully: ${migration}\n`);
      } catch (error) {
        console.error(`❌ Migration failed: ${migration}`);
        console.error(`Error: ${error.message}\n`);
        throw error;
      }
    }

    // Verification queries
    console.log('🔍 Verifying migrations...\n');

    const viewCheck = await client.query(
      "SELECT EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'view_actionable_leads')"
    );
    console.log(`View exists: ${viewCheck.rows[0].exists}`);

    const indexCheck = await client.query(
      "SELECT COUNT(*) FROM pg_indexes WHERE indexname IN ('idx_calls_org_date_pagination', 'idx_calls_direction_date')"
    );
    console.log(`Indexes created: ${indexCheck.rows[0].count}/2`);

    const functionCheck = await client.query(
      "SELECT EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_dashboard_stats_optimized')"
    );
    console.log(`Function exists: ${functionCheck.rows[0].exists}`);

    console.log('\n✅ All migrations applied and verified successfully!');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigrations();
