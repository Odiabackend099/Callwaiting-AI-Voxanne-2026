'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { authedBackendFetch } from '@/lib/authed-backend-fetch';

/**
 * useOrgValidation Hook
 * 
 * STRICT org_id validation with NO fallbacks:
 * 1. Extracts org_id ONLY from JWT app_metadata (single source of truth)
 * 2. Validates UUID format
 * 3. Confirms org exists in database via API call
 * 4. Detects cross-org mismatches
 * 5. Redirects to login on validation failure
 * 
 * This hook is the ONLY place that validates org_id for the frontend.
 * All other components should use useOrg() which wraps this hook.
 */
export function useOrgValidation() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [validationLoading, setValidationLoading] = useState(true);
  const [orgValid, setOrgValid] = useState(false);
  const [orgError, setOrgError] = useState<string | null>(null);

  // STRICT: Extract org_id ONLY from JWT app_metadata (no fallbacks to user_metadata or localStorage)
  const orgId = useMemo(() => {
    if (!user) return undefined;
    
    // Only app_metadata is trusted (set by server, immutable)
    // user_metadata comes from client and can be forged
    const id = user.app_metadata?.org_id as string | undefined;
    
    return id || undefined;
  }, [user]);

  // Validate org_id on app load and when user changes
  useEffect(() => {
    if (authLoading) return; // Wait for auth to finish

    // If no user, stop validation
    if (!user) {
      setValidationLoading(false);
      setOrgValid(false);
      setOrgError('No authenticated user');
      return;
    }

    // If no org_id, this user has no organization
    if (!orgId) {
      setValidationLoading(false);
      setOrgValid(false);
      setOrgError('User has no organization assigned. Contact your administrator.');
      
      // After a brief delay, redirect to login (don't trap user)
      const timer = setTimeout(() => {
        router.push('/login');
      }, 2000);
      
      return () => clearTimeout(timer);
    }

    const validateOrg = async () => {
      setValidationLoading(true);
      setOrgError(null);

      try {
        // Validate UUID format before API call (quick fail)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(orgId)) {
          const error = `Invalid organization ID format: ${orgId}`;
          console.error('[useOrgValidation] UUID validation failed:', error);
          setOrgError(error);
          setOrgValid(false);
          setValidationLoading(false);

          // Redirect after brief delay
          setTimeout(() => {
            router.push('/login?error=invalid_org_id');
          }, 1500);
          return;
        }

        // Confirm org exists in database via API
        // SECURITY FIX: Using authedBackendFetch which includes JWT automatically
        try {
          const data = await authedBackendFetch<{ success: boolean; orgId: string; validated: boolean }>(
            `/api/orgs/validate/${orgId}`,
            { method: 'GET' }
          );

          // Validation succeeded
          if (data.success && data.orgId === orgId) {
            console.debug('[useOrgValidation] Organization validation succeeded:', orgId);
            setOrgValid(true);
            setOrgError(null);
            setValidationLoading(false);
            return;
          } else {
            const error = 'Organization validation returned unexpected result';
            console.error('[useOrgValidation]', error, data);
            setOrgError(error);
            setOrgValid(false);
            setValidationLoading(false);

            setTimeout(() => {
              router.push('/login?error=validation_failed');
            }, 1500);
            return;
          }
        } catch (err: any) {
          let errorMessage = 'Organization validation failed';

          // Extract error from authedBackendFetch response
          if (err?.status === 404) {
            errorMessage = `Organization ${orgId} does not exist`;
          } else if (err?.status === 403) {
            errorMessage = 'You do not have access to this organization';
          } else if (err?.status === 401) {
            errorMessage = 'Authentication required. Please log in again.';
          } else if (err?.message) {
            errorMessage = err.message;
          }

          console.error('[useOrgValidation] API validation failed:', {
            status: err?.status,
            message: errorMessage,
            orgId,
            error: err
          });

          setOrgError(errorMessage);
          setOrgValid(false);
          setValidationLoading(false);

          // Redirect based on error type
          const redirectUrl = err?.status === 401
            ? '/login'
            : `/login?error=${encodeURIComponent(errorMessage)}`;

          setTimeout(() => {
            router.push(redirectUrl);
          }, 1500);
          return;
        }
      } finally {
        setValidationLoading(false);
      }
    };

    validateOrg();
  }, [authLoading, user, orgId]);

  return {
    orgId,
    orgValid,
    orgError,
    loading: authLoading || validationLoading,
  };
}
