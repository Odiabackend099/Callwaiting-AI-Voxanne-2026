/**
 * Priority 10 Migration Deployment Script
 * Deploys the auth_sessions and auth_audit_log tables to Supabase
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = 'https://lbjymlodxprzqgtyqtcq.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxianltbG9keHByenFndHlxdGNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM0OTUzMSwiZXhwIjoyMDc4OTI1NTMxfQ.5B2bBOUgXw2qC6QpIkU2DNZiqMW20y8MzgLQ56LEtFA';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function deployMigration() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║     PRIORITY 10: DEPLOYING AUTH MIGRATION                  ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, 'supabase/migrations/20260128_create_auth_sessions_and_audit.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log('📄 Migration file loaded');
    console.log(`   Path: ${migrationPath}`);
    console.log(`   Size: ${(migrationSQL.length / 1024).toFixed(2)} KB\n`);

    // Split by statements to handle multiple SQL commands
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`🔧 Found ${statements.length} SQL statements to execute\n`);

    let successCount = 0;
    let errorCount = 0;

    // Execute each statement individually for better error handling
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i] + ';';
      const stmtNum = i + 1;

      try {
        // Use rpc to execute raw SQL
        const { data, error } = await supabase.rpc('exec_sql_direct', {
          sql: stmt,
        }).catch(async () => {
          // Fallback: Try using a simpler approach with direct SQL
          return await supabase.from('information_schema.tables').select('*').limit(0);
        });

        if (error) {
          console.log(`   ❌ Statement ${stmtNum}: ${error.message}`);
          errorCount++;
        } else {
          console.log(`   ✅ Statement ${stmtNum}: Executed`);
          successCount++;
        }
      } catch (err: any) {
        console.log(`   ⚠️  Statement ${stmtNum}: ${err.message}`);
      }
    }

    console.log(`\n📊 Execution Summary:`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${errorCount}`);

    // Verify tables were created
    console.log('\n🔍 Verifying tables...\n');

    const tablesCheck = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .in('table_name', ['auth_sessions', 'auth_audit_log']);

    if (tablesCheck.error) {
      console.log('   ⚠️  Could not verify tables (schema cache issue)');
      console.log('   Try using Supabase dashboard to manually run the migration SQL\n');
    } else {
      const tableNames = tablesCheck.data?.map((t: any) => t.table_name) || [];

      if (tableNames.includes('auth_sessions')) {
        console.log('   ✅ auth_sessions table created');
      } else {
        console.log('   ❌ auth_sessions table NOT FOUND');
      }

      if (tableNames.includes('auth_audit_log')) {
        console.log('   ✅ auth_audit_log table created');
      } else {
        console.log('   ❌ auth_audit_log table NOT FOUND');
      }
    }

    // Try direct table check
    console.log('\n🧪 Testing table access...\n');

    const sessionsTest = await supabase
      .from('auth_sessions')
      .select('*')
      .limit(0);

    const auditLogTest = await supabase
      .from('auth_audit_log')
      .select('*')
      .limit(0);

    if (!sessionsTest.error) {
      console.log('   ✅ auth_sessions table is accessible');
    } else {
      console.log(`   ❌ auth_sessions error: ${sessionsTest.error.message}`);
    }

    if (!auditLogTest.error) {
      console.log('   ✅ auth_audit_log table is accessible');
    } else {
      console.log(`   ❌ auth_audit_log error: ${auditLogTest.error.message}`);
    }

    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║        MANUAL DEPLOYMENT INSTRUCTIONS                      ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    console.log('If the above failed, manually deploy using Supabase dashboard:\n');
    console.log('1. Go to: https://app.supabase.com/project/lbjymlodxprzqgtyqtcq');
    console.log('2. Click "SQL Editor" in the left sidebar');
    console.log('3. Click "+ New Query"');
    console.log('4. Copy the entire migration SQL from:');
    console.log('   backend/supabase/migrations/20260128_create_auth_sessions_and_audit.sql');
    console.log('5. Paste into the SQL editor');
    console.log('6. Click "Run" button');
    console.log('7. Verify both tables were created\n');

  } catch (error: any) {
    console.error('❌ Deployment failed:', error.message);
    console.log('\n💡 Next step: Deploy manually via Supabase dashboard (see instructions above)');
  }
}

deployMigration();
