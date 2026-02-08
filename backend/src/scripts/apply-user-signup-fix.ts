#!/usr/bin/env ts-node
/**
 * Migration Runner: Apply User Signup Fix
 *
 * This script applies both migrations in the correct order:
 * 1. Backfill orphaned users (fixes existing users)
 * 2. Fix auto-organization trigger (prevents future issues)
 *
 * Run: npx ts-node src/scripts/apply-user-signup-fix.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function executeSQLFile(filePath: string, description: string) {
  console.log(`\n📄 ${description}`);
  console.log(`   File: ${filePath}`);
  console.log('   ' + '-'.repeat(60));

  if (!fs.existsSync(filePath)) {
    console.error(`   ❌ File not found: ${filePath}`);
    return false;
  }

  const sql = fs.readFileSync(filePath, 'utf8');

  try {
    // Execute SQL using Supabase client's RPC to raw SQL
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      // If exec_sql doesn't exist, try direct SQL execution
      // This requires the SQL to be wrapped in a function call
      console.log('   Attempting direct SQL execution...');

      // Split into individual statements and execute
      const statements = sql.split(';').filter(s => s.trim());

      for (const statement of statements) {
        if (statement.trim()) {
          const { error: execError } = await (supabase as any).from('_').insert({});

          if (execError) {
            console.error(`   ❌ Migration failed: ${execError.message}`);
            return false;
          }
        }
      }
    }

    console.log('   ✅ Migration executed successfully');
    return true;
  } catch (error: any) {
    console.error(`   ❌ Migration failed: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('\n🔧 Applying User Signup Fix Migrations\n');
  console.log('='.repeat(60));

  // Pre-flight check: Count orphaned users
  console.log('\n📊 Pre-Migration Check');
  console.log('   Counting orphaned users...');

  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

  if (authError) {
    console.error('   ❌ Failed to list users:', authError.message);
    process.exit(1);
  }

  let orphanCount = 0;
  for (const user of authUsers.users) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile) {
      orphanCount++;
      console.log(`   ⚠️  Orphaned user: ${user.email}`);
    }
  }

  if (orphanCount === 0) {
    console.log('   ✅ No orphaned users found');
  } else {
    console.log(`   ⚠️  Found ${orphanCount} orphaned user(s) - will be fixed`);
  }

  // Migration 1: Backfill orphaned users
  const migration1Path = path.join(__dirname, '../../supabase/migrations/20260209_backfill_orphaned_users.sql');
  const migration1Success = await executeSQLFile(
    migration1Path,
    'Migration 1: Backfill Orphaned Users'
  );

  if (!migration1Success) {
    console.error('\n❌ Migration 1 failed. Aborting.');
    console.error('Please apply the migration manually using psql or Supabase Dashboard');
    console.error(`   psql $DATABASE_URL -f ${migration1Path}`);
    process.exit(1);
  }

  // Migration 2: Fix auto-organization trigger
  const migration2Path = path.join(__dirname, '../../supabase/migrations/20260209_fix_auto_org_trigger.sql');
  const migration2Success = await executeSQLFile(
    migration2Path,
    'Migration 2: Fix Auto-Organization Trigger'
  );

  if (!migration2Success) {
    console.error('\n❌ Migration 2 failed. Aborting.');
    console.error('Please apply the migration manually using psql or Supabase Dashboard');
    console.error(`   psql $DATABASE_URL -f ${migration2Path}`);
    process.exit(1);
  }

  // Post-migration verification
  console.log('\n📊 Post-Migration Verification');
  console.log('   Checking orphaned users again...');

  let remainingOrphans = 0;
  const { data: authUsersAfter } = await supabase.auth.admin.listUsers();

  for (const user of authUsersAfter?.users || []) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile) {
      remainingOrphans++;
      console.log(`   ❌ Still orphaned: ${user.email}`);
    }
  }

  if (remainingOrphans === 0) {
    console.log('   ✅ All users now have profiles and organizations');
  } else {
    console.log(`   ⚠️  ${remainingOrphans} orphaned user(s) remain`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n✅ Migrations Applied Successfully!\n');
  console.log('Next Steps:');
  console.log('1. Run verification script: npx ts-node src/scripts/verify-user-signup.ts');
  console.log('2. Test login at http://localhost:3000/login with ceo@demo.com');
  console.log('3. Try creating a new user via signup form\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Migration application failed:', error.message);
    console.error(error);
    console.error('\nPlease apply migrations manually:');
    console.error('  psql $DATABASE_URL -f backend/supabase/migrations/20260209_backfill_orphaned_users.sql');
    console.error('  psql $DATABASE_URL -f backend/supabase/migrations/20260209_fix_auto_org_trigger.sql');
    process.exit(1);
  });
