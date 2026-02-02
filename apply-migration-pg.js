#!/usr/bin/env node
const fs = require('fs');
const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres.lbjymlodxprzqgtyqtcq:Eguale%402021%3F@aws-0-us-east-1.pooler.supabase.com:5432/postgres';

async function applyMigration() {
  const client = new Client({ connectionString: DATABASE_URL });

  try {
    console.log('🔄 Connecting to database...');
    await client.connect();
    console.log('✅ Connected!\n');

    console.log('📄 Reading migration file...');
    const sql = fs.readFileSync('backend/supabase/migrations/20260201_create_sms_delivery_log.sql', 'utf8');

    console.log('⚡ Executing migration...\n');
    const result = await client.query(sql);

    console.log('✅ Migration applied successfully!\n');

    // Verify
    console.log('🔍 Verifying...');
    const verify = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_name = 'sms_delivery_log'
    `);

    if (verify.rows.length > 0) {
      console.log('✅ Table sms_delivery_log verified!\n');
      console.log('🎉 Migration complete!');
      console.log('\nTest the SMS queue:');
      console.log('curl https://callwaitingai-backend-sjbi.onrender.com/api/monitoring/sms-queue-health\n');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
