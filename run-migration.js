#!/usr/bin/env node
/**
 * Run SMS Delivery Log Migration
 * Usage: SUPABASE_URL=https://... SUPABASE_SERVICE_ROLE_KEY=... node run-migration.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read migration SQL
const migrationSQL = fs.readFileSync(
  path.join(__dirname, 'backend/supabase/migrations/20260201_create_sms_delivery_log.sql'),
  'utf8'
);

// Get credentials from environment
const supabaseUrl = process.env.SUPABASE_URL || 'https://lbjymlodxprzqgtyqtcq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error('❌ ERROR: SUPABASE_SERVICE_ROLE_KEY not set');
  console.error('Set it from your Render environment variables and try again');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration() {
  console.log('🔄 Applying SMS delivery log migration...\n');

  try {
    // Execute the migration SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    });

    if (error) {
      // Fallback: Try executing via REST API
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({ sql: migrationSQL })
      });

      if (!response.ok) {
        throw new Error(`Migration failed: ${error.message}`);
      }
    }

    console.log('✅ Migration applied successfully!\n');
    console.log('Verifying...\n');

    // Verify table was created
    const { data: tables, error: verifyError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_name', 'sms_delivery_log')
      .limit(1);

    if (verifyError) {
      console.warn('⚠️  Could not verify table creation');
    } else if (tables && tables.length > 0) {
      console.log('✅ sms_delivery_log table verified');
    }

    console.log('\n🎉 Migration complete!');
    console.log('\nNext: Wait for Render redeploy to complete, then test:');
    console.log('curl https://callwaitingai-backend-sjbi.onrender.com/api/monitoring/sms-queue-health');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\nPlease apply manually using psql:');
    console.error('psql "$DATABASE_URL" < backend/supabase/migrations/20260201_create_sms_delivery_log.sql');
    process.exit(1);
  }
}

runMigration();
