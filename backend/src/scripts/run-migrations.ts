#!/usr/bin/env ts-node
/**
 * Direct Migration Runner using pg library
 *
 * Run: npx ts-node src/scripts/run-migrations.ts
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ Missing DATABASE_URL environment variable');
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false }
});

async function runMigration(filePath: string, name: string): Promise<boolean> {
  console.log(`\n📄 Running: ${name}`);
  console.log('   ' + '-'.repeat(60));

  if (!fs.existsSync(filePath)) {
    console.error(`   ❌ File not found: ${filePath}`);
    return false;
  }

  const sql = fs.readFileSync(filePath, 'utf8');

  try {
    const client = await pool.connect();
    try {
      await client.query(sql);
      console.log('   ✅ Migration executed successfully');
      return true;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error(`   ❌ Migration failed: ${error.message}`);
    console.error(`   ${error.stack}`);
    return false;
  }
}

async function main() {
  console.log('\n🔧 Applying User Signup Fix Migrations\n');
  console.log('='.repeat(60));

  const migrationsDir = path.join(__dirname, '../../supabase/migrations');

  // Migration 1: Backfill
  const success1 = await runMigration(
    path.join(migrationsDir, '20260209_backfill_orphaned_users.sql'),
    'Migration 1: Backfill Orphaned Users'
  );

  if (!success1) {
    console.error('\n❌ Migration 1 failed. Aborting.');
    process.exit(1);
  }

  // Migration 2: Fix trigger
  const success2 = await runMigration(
    path.join(migrationsDir, '20260209_fix_auto_org_trigger.sql'),
    'Migration 2: Fix Auto-Organization Trigger'
  );

  if (!success2) {
    console.error('\n❌ Migration 2 failed. Aborting.');
    process.exit(1);
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n✅ All Migrations Applied Successfully!\n');

  await pool.end();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Failed:', error.message);
    process.exit(1);
  });
