#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lbjymlodxprzqgtyqtcq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxianltbG9keHByenFndHlxdGNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM0OTUzMSwiZXhwIjoyMDc4OTI1NTMxfQ.5B2bBOUgXw2qC6QpIkU2DNZiqMW20y8MzgLQ56LEtFA';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function applyMigration() {
  console.log('🔄 Applying SMS delivery log migration...\n');

  try {
    // Step 1: Create table
    console.log('Creating sms_delivery_log table...');
    const { error: tableError } = await supabase.rpc('exec', {
      sql: `
        CREATE TABLE IF NOT EXISTS sms_delivery_log (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          job_id TEXT NOT NULL UNIQUE,
          org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          recipient_phone TEXT NOT NULL,
          message TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('processing', 'delivered', 'failed', 'dead_letter')),
          attempt_number INTEGER NOT NULL DEFAULT 1,
          delivery_time_ms INTEGER,
          twilio_sid TEXT,
          error_message TEXT,
          metadata JSONB,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `
    });

    if (tableError && !tableError.message.includes('already exists')) {
      throw tableError;
    }
    console.log('✅ Table created\n');

    // Verify table was created
    const { data: tables } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_name', 'sms_delivery_log')
      .limit(1);

    if (tables && tables.length > 0) {
      console.log('✅ Migration successful!');
      console.log('\n🎉 sms_delivery_log table is ready!');
      console.log('\nNext: Test the SMS queue health endpoint');
      console.log('curl https://callwaitingai-backend-sjbi.onrender.com/api/monitoring/sms-queue-health\n');
    } else {
      console.log('⚠️  Table created but verification failed');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.log('\nTrying direct SQL execution via Supabase SQL Editor:');
    console.log('1. Go to: https://supabase.com/dashboard/project/lbjymlodxprzqgtyqtcq/editor');
    console.log('2. Copy and paste the contents of:');
    console.log('   backend/supabase/migrations/20260201_create_sms_delivery_log.sql');
    console.log('3. Click "Run"');
    process.exit(1);
  }
}

applyMigration();
