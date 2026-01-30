/**
 * Ensure Organization Exists Service
 *
 * CRITICAL FIX: Auto-creates organization if it doesn't exist
 * Prevents "Organization Not Found" errors when org creation trigger fails
 *
 * Usage:
 * ```typescript
 * const orgId = await ensureOrgExists(userId, userOrgId);
 * ```
 *
 * Returns: orgId (either from database or newly created)
 * Throws: Error only if critical validation fails
 */

import { supabase } from './supabase-client';
import { v4 as uuidv4 } from 'uuid';

export interface EnsureOrgResult {
  orgId: string;
  created: boolean;
  reason: string;
}

/**
 * Ensures organization exists for a user
 * If org doesn't exist, automatically creates it
 *
 * @param userId - User ID from JWT
 * @param userOrgId - Org ID from JWT app_metadata (may be missing/wrong)
 * @returns - EnsureOrgResult with orgId and status
 */
export async function ensureOrgExists(
  userId: string,
  userOrgId?: string
): Promise<EnsureOrgResult> {
  // VALIDATION: Must have userId
  if (!userId) {
    throw new Error('INVALID_USER_ID: Cannot ensure org without user ID');
  }

  // STEP 1: Check what's in user's profile in database
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, org_id')
    .eq('id', userId)
    .single();

  if (profileError && profileError.code !== 'PGRST116') {
    // PGRST116 = "no rows found" which is okay
    console.error('[EnsureOrgExists] Error fetching profile:', profileError);
  }

  // Get the real org_id from database
  const databaseOrgId = profile?.org_id;

  // STEP 2: If profile has org_id in database, verify it exists
  if (databaseOrgId) {
    // Check if org exists in database
    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .eq('id', databaseOrgId)
      .single();

    if (org) {
      // ✅ SUCCESS: Org exists, all good
      return {
        orgId: databaseOrgId,
        created: false,
        reason: 'Organization exists in database'
      };
    } else {
      // ❌ INCONSISTENCY: Profile points to missing org
      // This is a data corruption issue - log it and fix
      console.error('[EnsureOrgExists] INCONSISTENCY: Profile has org_id but org missing', {
        userId,
        profileOrgId: databaseOrgId
      });

      // Fall through to org creation below
    }
  }

  // STEP 3: No org found - create one now
  // This handles:
  // - Signup trigger failed
  // - Profile has NULL org_id
  // - Org was deleted

  const newOrgId = uuidv4();
  const orgName = `Organization ${newOrgId.substring(0, 8)}`;

  // Create the organization
  const { error: orgError } = await supabase
    .from('organizations')
    .insert({
      id: newOrgId,
      name: orgName,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

  if (orgError) {
    console.error('[EnsureOrgExists] Error creating organization:', orgError);
    throw new Error(`ORGANIZATION_CREATION_FAILED: ${orgError.message}`);
  }

  // Update user's profile with new org_id
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ org_id: newOrgId })
    .eq('id', userId);

  if (updateError) {
    console.error('[EnsureOrgExists] Error updating profile with org_id:', updateError);
    // Don't throw - org was created, just profile update failed
    // Frontend will retry
  }

  console.log('[EnsureOrgExists] Created organization', {
    userId,
    newOrgId,
    reason: databaseOrgId ? 'database_inconsistency' : 'missing_org'
  });

  return {
    orgId: newOrgId,
    created: true,
    reason: databaseOrgId
      ? 'Organization recreated (was deleted or missing)'
      : 'Organization created on first access'
  };
}

/**
 * Validate that user and org exist together
 * Non-destructive - doesn't auto-create
 *
 * @param userId - User ID from JWT
 * @param orgId - Org ID to validate
 * @returns - true if valid, false otherwise
 */
export async function validateUserOrgExists(userId: string, orgId: string): Promise<boolean> {
  if (!userId || !orgId) {
    return false;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, org_id')
    .eq('id', userId)
    .eq('org_id', orgId)
    .single();

  if (!profile) {
    return false;
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('id', orgId)
    .single();

  return !!org;
}
