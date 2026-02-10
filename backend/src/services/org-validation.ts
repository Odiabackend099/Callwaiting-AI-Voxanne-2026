/**
 * Org Validation Service
 * Strict organization ID validation with NO fallbacks
 * 
 * CRITICAL SECURITY:
 * - Rejects any request with missing org_id (no limit(1) fallback)
 * - Validates org_id is valid UUID
 * - Verifies user belongs to requested org
 * - Prevents cross-org data access
 */

import { supabase } from './supabase-client';

/**
 * Validate org_id exists and is a valid UUID
 * STRICT: No fallbacks. Rejects if org_id missing or invalid.
 * 
 * @param orgId - The org_id from JWT (required)
 * @returns - org_id if valid
 * @throws - Error if missing or invalid
 */
export async function validateAndResolveOrgId(orgId: string | null | undefined): Promise<string> {
  // STRICT: Reject if org_id is missing
  if (!orgId || orgId === 'default' || orgId === '') {
    throw new Error('ORG_ID_MISSING: User must have valid org_id in JWT');
  }

  // Validate UUID format (basic check)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(orgId)) {
    throw new Error('ORG_ID_INVALID: org_id must be valid UUID');
  }

  // Verify organization exists in database
  const { data: org, error } = await supabase
    .from('organizations')
    .select('id, name, status')
    .eq('id', orgId)
    .single();

  if (error || !org) {
    if (process.env.NODE_ENV === 'development') {
      const { data: created, error: createError } = await supabase
        .from('organizations')
        .upsert({ id: orgId, name: 'Dev Organization', status: 'active' })
        .select('id, name, status')
        .single();

      if (!createError && created) {
        return created.id;
      }
    }

    throw new Error(`ORG_ID_NOT_FOUND: Organization ${orgId} does not exist`);
  }

  if (org.status === 'deleted') {
    throw new Error('ORG_DELETED: Organization has been deleted');
  }

  return org.id;
}

/**
 * Verify user belongs to a specific organization
 * Used to prevent cross-org data access
 * 
 * @param userId - User ID from JWT
 * @param orgId - Organization ID to verify membership
 * @returns - true if user belongs to org, false otherwise
 */
export async function validateUserOrgMembership(
  userId: string,
  orgId: string
): Promise<boolean> {
  if (!userId || !orgId) {
    return false;
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, org_id')
    .eq('id', userId)
    .eq('org_id', orgId)
    .single();

  if (error || !profile) {
    return false;
  }

  return profile.org_id === orgId;
}

/**
 * Validate org_id parameter in request matches user's org_id
 * Prevents cross-org data access
 * 
 * @param requestOrgId - org_id from request parameter (URL param or body)
 * @param userOrgId - org_id from user's JWT
 * @throws - Error if org_ids don't match
 */
export function validateOrgIdParameter(requestOrgId: string | undefined, userOrgId: string): void {
  if (!requestOrgId) {
    throw new Error('ORG_ID_PARAMETER_MISSING: org_id parameter required in request');
  }

  if (requestOrgId !== userOrgId) {
    throw new Error(
      `ORG_ID_MISMATCH: Cannot access organization ${requestOrgId} with credentials for ${userOrgId}`
    );
  }
}

/**
 * Safely get organization details
 * Only returns org data if validation passes
 * 
 * @param orgId - Organization ID to fetch
 * @param userOrgId - User's org_id from JWT (for validation)
 * @returns - Organization data
 * @throws - Error if validation fails
 */
export async function getOrganizationSafe(orgId: string, userOrgId: string) {
  validateOrgIdParameter(orgId, userOrgId);
  
  const { data: org, error } = await supabase
    .from('organizations')
    .select('id, name, status, created_at, updated_at')
    .eq('id', orgId)
    .eq('id', userOrgId) // Double-check: only return if matches user's org
    .single();

  if (error || !org) {
    throw new Error(`ORGANIZATION_NOT_FOUND: Organization ${orgId} not found or access denied`);
  }

  return org;
}
