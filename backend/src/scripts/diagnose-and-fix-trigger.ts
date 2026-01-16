/**
 * DIAGNOSE AND FIX DATABASE TRIGGER
 * 
 * Checks if the on_auth_user_created trigger is active
 * and creates missing organizations for existing users
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../config';

const supabaseUrl = (config.SUPABASE_URL || '').trim();
const supabaseKey = (config.SUPABASE_SERVICE_ROLE_KEY || '')
  .trim()
  .replace(/[\r\n\t\x00-\x1F\x7F]/g, '');

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnoseAndFix() {
  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log('║     DIAGNOSE AND FIX DATABASE TRIGGER ISSUE           ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  try {
    // STEP 1: Check for users without organizations
    console.log('STEP 1: Checking for users without organizations...\n');

    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.log(`❌ Error fetching auth users: ${authError.message}`);
      throw authError;
    }

    if (!authUsers || authUsers.users.length === 0) {
      console.log('✅ No auth users found');
      return;
    }

    console.log(`Found ${authUsers.users.length} users in auth\n`);

    // Get all profiles
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, org_id');

    if (profileError) {
      console.log(`⚠️  Error fetching profiles: ${profileError.message}`);
    }

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

    // Find users without profiles
    const usersWithoutProfiles = authUsers.users.filter(u => !profileMap.has(u.id));

    console.log(`Users WITHOUT profiles: ${usersWithoutProfiles.length}`);
    if (usersWithoutProfiles.length > 0) {
      console.log('⚠️  The database trigger did NOT fire for these users:\n');
      usersWithoutProfiles.forEach(u => {
        console.log(`   - ${u.email} (ID: ${u.id})`);
      });
    }

    // STEP 2: Create organizations for users without profiles
    if (usersWithoutProfiles.length > 0) {
      console.log('\n\nSTEP 2: Creating organizations for users without profiles...\n');

      for (const user of usersWithoutProfiles) {
        // Create organization
        const { data: org, error: orgError } = await supabase
          .from('organizations')
          .insert({
            name: `${user.email} Organization`,
            status: 'active',
            email: user.email
          })
          .select()
          .single();

        if (orgError) {
          console.log(`❌ Failed to create org for ${user.email}: ${orgError.message}`);
          continue;
        }

        // Create profile
        const { error: profileInsertError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email,
            org_id: org.id,
            role: 'owner'
          });

        if (profileInsertError) {
          console.log(`❌ Failed to create profile for ${user.email}: ${profileInsertError.message}`);
        } else {
          console.log(`✅ Created org and profile for ${user.email}`);
          console.log(`   Organization ID: ${org.id}`);
        }
      }
    }

    // STEP 3: Verify fix
    console.log('\n\nSTEP 3: Verification...\n');

    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('email, org_id');

    const orphaned = allProfiles?.filter(p => !p.org_id) || [];
    
    if (orphaned.length === 0) {
      console.log('✅ All profiles have organizations!');
    } else {
      console.log(`⚠️  ${orphaned.length} profiles still without org_id:`);
      orphaned.forEach(p => console.log(`   - ${p.email}`));
    }

    console.log('\n╔═══════════════════════════════════════════════════════╗');
    console.log('║                  DIAGNOSIS COMPLETE                   ║');
    console.log('╚═══════════════════════════════════════════════════════╝\n');

    console.log('⚠️  NOTE: The database trigger may not be active.');
    console.log('     This was a manual fix to create missing organizations.');
    console.log('\n✅ Next: Sign out and sign back in to see the updated organization.\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

diagnoseAndFix()
  .then(() => {
    console.log('✅ Script completed\n');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
  });
