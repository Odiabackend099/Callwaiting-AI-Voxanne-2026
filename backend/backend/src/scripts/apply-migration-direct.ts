#!/usr/bin/env ts-node
/**
 * Apply migration directly using Postgres client
 */

import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const connectionString = process.env.DATABASE_URL ||
  `postgresql://postgres.lbjymlodxprzqgtyqtcq:${process.env.SUPABASE_DB_PASSWORD}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;

async function applyMigration() {
  const client = new Client({ connectionString });

  try {
    console.log('📦 Connecting to database...\n');
    await client.connect();
    console.log('✅ Connected\n');

    // Read migration file
    const migrationPath = path.join(__dirname, '../../supabase/migrations/20260212_vapi_webhook_idempotency.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📝 Executing migration SQL...\n');

    // Execute the entire migration in one transaction
    await client.query('BEGIN');
    await client.query(migrationSQL);
    await client.query('COMMIT');

    console.log('✅ Migration applied successfully!\n');

  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    console.error('\n📋 Manual application required:');
    console.error('   1. Open: https://supabase.com/dashboard/project/lbjymlodxprzqgtyqtcq/sql');
    console.error('   2. Paste contents of: backend/supabase/migrations/20260212_vapi_webhook_idempotency.sql');
    console.error('   3. Click "Run"\n');
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
