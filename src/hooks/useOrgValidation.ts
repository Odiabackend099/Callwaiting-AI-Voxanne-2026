'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

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
        const response = await fetch(`/api/orgs/validate/${orgId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          // Credentials ensures JWT is sent to validate user's access
          credentials: 'include',
        });

        if (!response.ok) {
          let errorMessage = 'Organization validation failed';
          
          if (response.status === 404) {
            errorMessage = `Organization ${orgId} does not exist`;
          } else if (response.status === 403) {
            errorMessage = 'You do not have access to this organization';
          } else if (response.status === 401) {
            errorMessage = 'Authentication required. Please log in again.';
          }

          console.error('[useOrgValidation] API validation failed:', {
            status: response.status,
            message: errorMessage,
            orgId
          });

          setOrgError(errorMessage);
          setOrgValid(false);
          setValidationLoading(false);

          // Redirect based on error type
          const redirectUrl = response.status === 401 
            ? '/login'
            : `/login?error=${encodeURIComponent(errorMessage)}`;

          setTimeout(() => {
            router.push(redirectUrl);
          }, 1500);
          return;
        }

        // Validation succeeded
        const data = await response.json();
        
        if (data.success && data.orgId === orgId) {
          console.debug('[useOrgValidation] Organization validation succeeded:', orgId);
          setOrgValid(true);
          setOrgError(null);
        } else {
          const error = 'Organization validation returned unexpected result';
          console.error('[useOrgValidation]', error, data);
          setOrgError(error);
          setOrgValid(false);

          setTimeout(() => {
            router.push('/login?error=validation_failed');
          }, 1500);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown validation error';
        console.error('[useOrgValidation] Validation error:', errorMessage, err);
        setOrgError(`Validation error: ${errorMessage}`);
        setOrgValid(false);

        // Retry on network errors (not fatal)
        // Don't redirect immediately; let component handle retry logic
      } finally {
        setValidationLoading(false);
      }
    };

    validateOrg();
  }, [authLoading, user, orgId, router]);

  return {
    orgId,
    orgValid,
    orgError,
    loading: authLoading || validationLoading,
  };
}
