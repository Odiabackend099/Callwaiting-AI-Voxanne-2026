/**
 * Script: Update JWT app_metadata for All Users to Include org_id
 * Date: 2025-01-10
 * Purpose: Set org_id in JWT app_metadata for all existing users (Phase 5 of Warden migration)
 * Context: Zero-Trust Warden Phase 1 - Identity Migration
 * 
 * PREREQUISITES:
 *   1. Default organization exists: 'a0000000-0000-0000-0000-000000000001'
 *   2. All users' data has been backfilled with org_id (Phase 3 complete)
 * 
 * USAGE:
 *   npx tsx backend/scripts/update-user-org-metadata.ts
 * 
 * ENVIRONMENT VARIABLES:
 *   - SUPABASE_URL: Supabase project URL
 *   - SUPABASE_SERVICE_ROLE_KEY: Service role key (admin access required)
 */

/**
 * Script: Update JWT app_metadata for All Users to Include org_id
 * Date: 2025-01-10
 * Purpose: Set org_id in JWT app_metadata for all existing users (Phase 5 of Warden migration)
 * Context: Zero-Trust Warden Phase 1 - Identity Migration
 * 
 * PREREQUISITES:
 *   1. Default organization exists: 'a0000000-0000-0000-0000-000000000001'
 *   2. All users' data has been backfilled with org_id (Phase 3 complete)
 * 
 * USAGE:
 *   cd backend
 *   npx tsx scripts/update-user-org-metadata.ts
 * 
 * ENVIRONMENT VARIABLES (loaded from backend/.env):
 *   - SUPABASE_URL: Supabase project URL
 *   - SUPABASE_SERVICE_ROLE_KEY: Service role key (admin access required)
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from backend/.env (must be before any other imports that use process.env)
dotenv.config();

const DEFAULT_ORG_ID = 'a0000000-0000-0000-0000-000000000001';

async function updateUserOrgMetadata() {
  // Validate environment variables
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing required environment variables:');
    console.error('   SUPABASE_URL:', supabaseUrl ? '✅' : '❌ MISSING');
    console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅' : '❌ MISSING');
    process.exit(1);
  }

  // Create Supabase admin client
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  console.log('🔄 Starting JWT app_metadata update for all users...\n');

  try {
    // Fetch all users (paginated to handle large user bases)
    let page = 0;
    const pageSize = 100;
    let hasMore = true;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    while (hasMore) {
      const { data: users, error: listError } = await supabase.auth.admin.listUsers({
        page,
        perPage: pageSize
      });

      if (listError) {
        console.error(`❌ Error fetching users (page ${page}):`, listError.message);
        hasMore = false;
        continue;
      }

      if (!users || users.users.length === 0) {
        hasMore = false;
        break;
      }

      console.log(`📄 Processing page ${page + 1} (${users.users.length} users)...`);

      // Process each user in this page
      for (const user of users.users) {
        try {
          // Check if user already has org_id in app_metadata
          const currentOrgId = user.app_metadata?.org_id;
          
          if (currentOrgId === DEFAULT_ORG_ID) {
            // User already has correct org_id, skip
            totalSkipped++;
            continue;
          }

          // Update user's app_metadata with org_id
          const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
            user.id,
            {
              app_metadata: {
                ...user.app_metadata,
                org_id: DEFAULT_ORG_ID
              }
            }
          );

          if (updateError) {
            console.error(`❌ Failed to update user ${user.id} (${user.email}):`, updateError.message);
            totalErrors++;
          } else {
            console.log(`✅ Updated user ${user.id} (${user.email}) - org_id: ${DEFAULT_ORG_ID}`);
            totalUpdated++;
          }

          // Rate limiting: Add small delay to avoid overwhelming the API
          await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay between updates

        } catch (error: any) {
          console.error(`❌ Error processing user ${user.id}:`, error.message);
          totalErrors++;
        }
      }

      // Check if there are more pages
      hasMore = users.users.length === pageSize;
      page++;

      // Rate limiting: Add delay between pages
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay between pages
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 UPDATE SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Successfully updated: ${totalUpdated} users`);
    console.log(`⏭️  Skipped (already has org_id): ${totalSkipped} users`);
    console.log(`❌ Errors: ${totalErrors} users`);
    console.log(`📈 Total processed: ${totalUpdated + totalSkipped + totalErrors} users`);
    console.log('='.repeat(60) + '\n');

    // Verify update: Test auth_org_id() function
    console.log('🔍 Verifying update...');
    console.log('   (To test, authenticate as a user and run: SELECT public.auth_org_id();)');
    console.log('   (Should return:', DEFAULT_ORG_ID, ')\n');

    if (totalErrors === 0) {
      console.log('✅ All users processed successfully!');
      process.exit(0);
    } else {
      console.log(`⚠️  Completed with ${totalErrors} errors. Please review errors above.`);
      process.exit(1);
    }

  } catch (error: any) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  updateUserOrgMetadata().catch((error) => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
}

export { updateUserOrgMetadata };
