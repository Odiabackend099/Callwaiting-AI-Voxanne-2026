#!/usr/bin/env ts-node
/**
 * Apply migrations via Supabase Management API
 * Uses the API documented in .agent/supabase-mcp.md
 */

import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

const PROJECT_REF = 'lbjymlodxprzqgtyqtcq';
const ACCESS_TOKEN = 'sbp_fb6d4524ee1a54f6715fa5df2a0f2de97b71beb8';
const API_URL = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

async function executeMigration(filePath: string, name: string): Promise<boolean> {
  console.log(`\n📄 ${name}`);
  console.log('   ' + '-'.repeat(60));

  if (!fs.existsSync(filePath)) {
    console.error(`   ❌ File not found: ${filePath}`);
    return false;
  }

  const sql = fs.readFileSync(filePath, 'utf8');

  try {
    const response = await axios.post(
      API_URL,
      { query: sql },
      {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`   ✅ Migration executed successfully`);
    if (response.data && response.data.length > 0) {
      console.log(`   Response:`, JSON.stringify(response.data, null, 2));
    }
    return true;
  } catch (error: any) {
    if (error.response) {
      console.error(`   ❌ Migration failed: ${error.response.data?.message || error.message}`);
      console.error(`   Details:`, error.response.data);
    } else {
      console.error(`   ❌ Migration failed: ${error.message}`);
    }
    return false;
  }
}

async function main() {
  console.log('\n🔧 Applying User Signup Fix Migrations via Supabase API\n');
  console.log('='.repeat(60));

  const migrationsDir = path.join(__dirname, '../../supabase/migrations');

  // Migration 1: Backfill orphaned users
  const success1 = await executeMigration(
    path.join(migrationsDir, '20260209_backfill_orphaned_users.sql'),
    'Migration 1: Backfill Orphaned Users'
  );

  if (!success1) {
    console.error('\n❌ Migration 1 failed. Aborting.');
    process.exit(1);
  }

  // Migration 2: Fix auto-organization trigger
  const success2 = await executeMigration(
    path.join(migrationsDir, '20260209_fix_auto_org_trigger.sql'),
    'Migration 2: Fix Auto-Organization Trigger'
  );

  if (!success2) {
    console.error('\n❌ Migration 2 failed. Aborting.');
    process.exit(1);
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n✅ All Migrations Applied Successfully!\n');
  console.log('Next Steps:');
  console.log('1. Run verification script: npx ts-node src/scripts/verify-user-signup.ts');
  console.log('2. Test login at http://localhost:3000/login with ceo@demo.com');
  console.log('3. Try creating a new user via signup form\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Failed:', error.message);
    process.exit(1);
  });
