'use client';

import { useOrgValidation } from './useOrgValidation';

/**
 * useOrg Hook
 * 
 * Returns the validated organization ID for the current user.
 * 
 * - Returns null while loading or validating
 * - Returns null if validation failed (user already redirected to login by useOrgValidation)
 * - Returns org_id string if validation passed
 * 
 * This hook wraps useOrgValidation and provides backward compatibility
 * with components that expect null during loading/validation.
 * 
 * For new code, prefer useOrgValidation() for access to validation state.
 */
export function useOrg() {
  const { orgId, orgValid, loading } = useOrgValidation();

  // Return null while loading or validating
  if (loading || !orgValid) {
    return null;
  }

  // Return org_id if validation passed
  return orgId ?? null;
}
