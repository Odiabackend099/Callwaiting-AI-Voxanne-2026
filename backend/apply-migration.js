#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Use DATABASE_URL from .env file
const DATABASE_URL = 'postgresql://postgres:Eguale@2021?@db.lbjymlodxprzqgtyqtcq.supabase.co:5432/postgres';

async function applyMigration() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔄 Connecting to Supabase database...');
    await client.connect();
    console.log('✅ Connected!\n');

    console.log('📄 Reading migration file...');
    const sqlPath = path.join(__dirname, 'supabase/migrations/20260201_create_sms_delivery_log.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('⚡ Executing migration SQL...\n');
    await client.query(sql);

    console.log('✅ Migration executed successfully!\n');

    // Verify table was created
    console.log('🔍 Verifying table creation...');
    const verify = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_name = 'sms_delivery_log'
      LIMIT 1
    `);

    if (verify.rows.length > 0) {
      console.log('✅ sms_delivery_log table verified!\n');

      // Verify indexes
      const indexes = await client.query(`
        SELECT COUNT(*) as count FROM pg_indexes
        WHERE tablename = 'sms_delivery_log'
      `);
      console.log(`✅ ${indexes.rows[0].count} indexes created\n`);

      // Verify functions
      const functions = await client.query(`
        SELECT COUNT(*) as count FROM pg_proc
        WHERE proname IN ('get_sms_delivery_stats', 'get_dead_letter_sms', 'cleanup_old_sms_delivery_logs')
      `);
      console.log(`✅ ${functions.rows[0].count} helper functions created\n`);

      console.log('🎉 MIGRATION COMPLETE!\n');
      console.log('Test SMS queue health:');
      console.log('curl https://callwaitingai-backend-sjbi.onrender.com/api/monitoring/sms-queue-health\n');
    } else {
      console.error('❌ Table verification failed');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    if (error.code) console.error('Error code:', error.code);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
