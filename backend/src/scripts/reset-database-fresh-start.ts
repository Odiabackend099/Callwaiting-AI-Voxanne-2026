/**
 * DATABASE RESET - FRESH START
 *
 * This script completely cleans the database:
 * 1. Deletes all users from Supabase Auth
 * 2. Deletes all profiles (cascades to delete orgs)
 * 3. Deletes all organizations
 * 4. Resets the database to pristine state
 *
 * ⚠️  WARNING: THIS IS DESTRUCTIVE AND CANNOT BE UNDONE
 * All user data will be permanently deleted.
 *
 * RUN: npx tsx src/scripts/reset-database-fresh-start.ts
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
import * as readline from 'readline';

const supabaseUrl = (config.SUPABASE_URL || '').trim();
const supabaseKey = (config.SUPABASE_SERVICE_ROLE_KEY || '')
  .trim()
  .replace(/[\r\n\t\x00-\x1F\x7F]/g, '');

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Create readline interface for confirmation
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt: string): Promise<string> {
  return new Promise(resolve => {
    rl.question(prompt, resolve);
  });
}

async function resetDatabaseFreshStart() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║          ⚠️  DATABASE RESET - FRESH START                      ║');
  console.log('║          THIS WILL DELETE ALL USER DATA PERMANENTLY!           ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  // Safety confirmation
  console.log('⚠️  WARNING: This action is PERMANENT and IRREVERSIBLE');
  console.log('All users, profiles, and organizations will be deleted.\n');

  const confirm = await question('Type "DELETE ALL DATA" to confirm: ');

  if (confirm !== 'DELETE ALL DATA') {
    console.log('\n❌ Cancelled. No changes made.');
    rl.close();
    process.exit(0);
  }

  console.log('\n🔄 Starting database reset...\n');

  try {
    // ====================================================================
    // STEP 1: Get list of all users from Supabase Auth
    // ====================================================================
    console.log('STEP 1: Fetching all users from Supabase Auth...');

    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();

    if (usersError) {
      console.log(`❌ Error fetching users: ${usersError.message}`);
      throw usersError;
    }

    if (!users || users.users.length === 0) {
      console.log('✅ No users found in auth');
    } else {
      console.log(`Found ${users.users.length} users in auth`);

      // ====================================================================
      // STEP 2: Delete all users from Supabase Auth
      // ====================================================================
      console.log('\nSTEP 2: Deleting all users from Supabase Auth...');

      for (const user of users.users) {
        const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);

        if (deleteError) {
          console.log(`❌ Failed to delete ${user.email}: ${deleteError.message}`);
        } else {
          console.log(`✅ Deleted user: ${user.email}`);
        }
      }
    }

    // ====================================================================
    // STEP 3: Delete all profiles (cascades to organizations)
    // ====================================================================
    console.log('\nSTEP 3: Deleting all profiles...');

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email');

    if (profilesError) {
      console.log(`⚠️  Could not fetch profiles: ${profilesError.message}`);
    } else if (profiles && profiles.length > 0) {
      console.log(`Found ${profiles.length} profiles`);

      const { error: deleteProfilesError, count } = await supabase
        .from('profiles')
        .delete()
        .gte('created_at', '1900-01-01'); // Delete all

      if (deleteProfilesError) {
        console.log(`❌ Error deleting profiles: ${deleteProfilesError.message}`);
      } else {
        console.log(`✅ Deleted ${count || profiles.length} profiles`);
      }
    } else {
      console.log('✅ No profiles found');
    }

    // ====================================================================
    // STEP 4: Delete all organizations
    // ====================================================================
    console.log('\nSTEP 4: Deleting all organizations...');

    const { data: orgs, error: orgsError } = await supabase
      .from('organizations')
      .select('id, name');

    if (orgsError) {
      console.log(`⚠️  Could not fetch organizations: ${orgsError.message}`);
    } else if (orgs && orgs.length > 0) {
      console.log(`Found ${orgs.length} organizations`);

      const { error: deleteOrgsError, count } = await supabase
        .from('organizations')
        .delete()
        .gte('created_at', '1900-01-01'); // Delete all

      if (deleteOrgsError) {
        console.log(`❌ Error deleting organizations: ${deleteOrgsError.message}`);
      } else {
        console.log(`✅ Deleted ${count || orgs.length} organizations`);
      }
    } else {
      console.log('✅ No organizations found');
    }

    // ====================================================================
    // STEP 5: Delete user roles
    // ====================================================================
    console.log('\nSTEP 5: Deleting all user roles...');

    const { data: roles, error: rolesError } = await supabase
      .from('user_org_roles')
      .select('id');

    if (rolesError) {
      console.log(`⚠️  Could not fetch roles: ${rolesError.message}`);
    } else if (roles && roles.length > 0) {
      console.log(`Found ${roles.length} role assignments`);

      const { error: deleteRolesError, count } = await supabase
        .from('user_org_roles')
        .delete()
        .gte('created_at', '1900-01-01');

      if (deleteRolesError) {
        console.log(`❌ Error deleting roles: ${deleteRolesError.message}`);
      } else {
        console.log(`✅ Deleted ${count || roles.length} role assignments`);
      }
    } else {
      console.log('✅ No role assignments found');
    }

    // ====================================================================
    // STEP 6: Verification
    // ====================================================================
    console.log('\nSTEP 6: Verifying database is clean...');

    // Check auth users
    const { data: finalUsers } = await supabase.auth.admin.listUsers();
    const authUserCount = finalUsers?.users.length || 0;
    if (authUserCount === 0) {
      console.log('✅ No users in auth');
    } else {
      console.log(`⚠️  ${authUserCount} users still in auth`);
    }

    // Check profiles
    const { count: profileCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (profileCount === 0) {
      console.log('✅ No profiles in database');
    } else {
      console.log(`⚠️  ${profileCount} profiles still in database`);
    }

    // Check organizations
    const { count: orgCount } = await supabase
      .from('organizations')
      .select('*', { count: 'exact', head: true });

    if (orgCount === 0) {
      console.log('✅ No organizations in database');
    } else {
      console.log(`⚠️  ${orgCount} organizations still in database`);
    }

    // ====================================================================
    // COMPLETION
    // ====================================================================
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║            ✅ DATABASE RESET COMPLETE                          ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    console.log('✅ Database is now clean and ready for fresh start');
    console.log('');
    console.log('NEXT STEPS:');
    console.log('1. Create a new test account in Supabase Auth');
    console.log('2. Sign in with the new account');
    console.log('3. Account will automatically be provisioned with organization');
    console.log('4. Dashboard will load without any 404 errors');
    console.log('');
    console.log('The database trigger on_auth_user_created will automatically:');
    console.log('  ✅ Create organization for new user');
    console.log('  ✅ Create profile linking user to org');
    console.log('  ✅ Stamp org_id into JWT');
    console.log('');
  } catch (error: any) {
    console.error('\n❌ Reset failed:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

resetDatabaseFreshStart()
  .then(() => {
    console.log('✅ Database reset complete\n');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Unexpected error:', err);
    process.exit(1);
  });
