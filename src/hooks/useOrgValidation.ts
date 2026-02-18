'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { authedBackendFetch } from '@/lib/authed-backend-fetch';
import useSWR from 'swr';

/**
 * useOrgValidation Hook (2026 Optimized)
 *
 * STRICT org_id validation with SWR caching:
 * 1. Extracts org_id ONLY from JWT app_metadata (single source of truth)
 * 2. Validates UUID format (synchronous, instant)
 * 3. Uses SWR with session storage for caching (no re-validation on tab switch)
 * 4. Confirms org exists in database via API call (cached)
 * 5. Redirects to login on validation failure
 *
 * Key 2026 Best Practices:
 * - revalidateOnFocus: false (no validation when returning to tab)
 * - Session storage persistence (instant cold starts)
 * - Optimistic trust: assume valid if orgId exists in JWT
 *
 * This hook is the ONLY place that validates org_id for the frontend.
 * All other components should use useOrg() which wraps this hook.
 */

// ============================================================================
// Session Storage Caching Layer
// ============================================================================

const ORG_VALIDATION_CACHE_KEY = 'voxanne_org_validation';
const VALIDATION_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface CachedValidation {
  orgId: string;
  userId: string;
  validatedAt: number;
  orgName?: string;
}

function getCachedValidation(orgId: string, userId: string): CachedValidation | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = sessionStorage.getItem(ORG_VALIDATION_CACHE_KEY);
    if (!cached) return null;
    const data: CachedValidation = JSON.parse(cached);
    // Validate cache: same org, same user, not expired
    if (
      data.orgId === orgId &&
      data.userId === userId &&
      Date.now() - data.validatedAt < VALIDATION_CACHE_TTL_MS
    ) {
      return data;
    }
    // Cache expired or mismatched - clear it
    sessionStorage.removeItem(ORG_VALIDATION_CACHE_KEY);
    return null;
  } catch {
    return null;
  }
}

function setCachedValidation(orgId: string, userId: string, orgName?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const data: CachedValidation = {
      orgId,
      userId,
      validatedAt: Date.now(),
      orgName,
    };
    sessionStorage.setItem(ORG_VALIDATION_CACHE_KEY, JSON.stringify(data));
  } catch {
    // Silently fail - caching is optional
  }
}

function clearCachedValidation(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(ORG_VALIDATION_CACHE_KEY);
  } catch {
    // Silently fail
  }
}

// ============================================================================
// Network Error Detection
// ============================================================================

function isNetworkOrTimeoutError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  // TypeError with no .status = fetch failed (network unreachable, DNS failure, backend down)
  // AbortError = request timed out
  const hasStatus = typeof (err as any).status === 'number';
  return !hasStatus && (err instanceof TypeError || err.name === 'AbortError');
}

// ============================================================================
// UUID Validation (synchronous)
// ============================================================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

// ============================================================================
// SWR Fetcher
// ============================================================================

interface ValidationResponse {
  success: boolean;
  orgId: string;
  orgName?: string;
  validated?: boolean;
}

const orgValidationFetcher = async (key: string): Promise<ValidationResponse> => {
  // Extract orgId from SWR key format: "org_validation::${orgId}"
  const orgId = key.split('::')[1];

  if (!orgId || !isValidUUID(orgId)) {
    throw new Error(`Invalid organization ID format: ${orgId}`);
  }

  return authedBackendFetch<ValidationResponse>(
    `/api/orgs/validate/${orgId}`,
    { method: 'GET' }
  );
};

// ============================================================================
// Main Hook
// ============================================================================

export function useOrgValidation() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const hasRedirectedRef = useRef(false);
  const routerRef = useRef(router);

  // Keep router ref updated
  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  // STRICT: Extract org_id ONLY from JWT app_metadata (no fallbacks)
  const orgId = useMemo(() => {
    if (!user) return undefined;
    // Only app_metadata is trusted (set by server, immutable)
    const id = user.app_metadata?.org_id as string | undefined;
    return id || undefined;
  }, [user]);

  const userId = user?.id;

  // Check session cache first (synchronous, instant - no network request)
  const cachedValidation = useMemo(() => {
    if (!orgId || !userId) return null;
    return getCachedValidation(orgId, userId);
  }, [orgId, userId]);

  // Determine if UUID format is valid (synchronous check)
  const isUUIDValid = useMemo(() => {
    if (!orgId) return false;
    return isValidUUID(orgId);
  }, [orgId]);

  // SWR key: only fetch if we have orgId, valid UUID, AND no valid cache
  // null key = don't fetch
  const swrKey = orgId && userId && isUUIDValid && !cachedValidation
    ? `org_validation::${orgId}`
    : null;

  const { data, error, isLoading } = useSWR(swrKey, orgValidationFetcher, {
    // CRITICAL: Don't re-validate on tab switch (fixes "Validating access..." on tab return)
    revalidateOnFocus: false,
    // Don't re-validate on network reconnect
    revalidateOnReconnect: false,
    // Deduplicate requests for 5 minutes
    dedupingInterval: 300000,
    // Only retry once on failure
    errorRetryCount: 1,
    // Don't auto-retry validation errors (they're usually permanent)
    shouldRetryOnError: false,
    // Cache successful validation in session storage
    onSuccess: (data) => {
      if (data.success && orgId && userId) {
        setCachedValidation(orgId, userId, data.orgName);
      }
    },
    onError: () => {
      // Clear cache on error to force re-validation next time
      clearCachedValidation();
    },
  });

  // Compute validation state
  const isValidFromCache = !!cachedValidation;
  const isValidFromSWR = !!(data?.success && data?.orgId === orgId);
  const orgValid = isValidFromCache || isValidFromSWR;

  // Only show loading if:
  // 1. Auth is still loading, OR
  // 2. We're fetching validation AND we don't have cached result
  const validationLoading = !authLoading && !isValidFromCache && isLoading;

  // Compute error state
  const orgError = useMemo(() => {
    // No user - not an error state (handled by auth)
    if (!user) return null;
    // No org_id in JWT
    if (!orgId) return 'User has no organization assigned. Contact your administrator.';
    // Invalid UUID format
    if (!isUUIDValid) return `Invalid organization ID format: ${orgId}`;
    // SWR returned an error
    if (error) {
      const err = error as any;
      if (err?.status === 404) return `Organization ${orgId} does not exist`;
      if (err?.status === 403) return 'You do not have access to this organization';
      if (err?.status === 401) return 'Authentication required. Please log in again.';
      // Network/timeout errors: backend is unreachable, not an org issue
      if (isNetworkOrTimeoutError(err)) return 'NETWORK_ERROR';
      return err?.message || 'Organization validation failed';
    }
    // SWR returned unexpected result
    if (data && !data.success) return 'Organization validation returned unexpected result';
    return null;
  }, [user, orgId, isUUIDValid, error, data]);

  // Handle validation failure - redirect to login (only once)
  useEffect(() => {
    // Don't redirect while auth is loading or if we already redirected
    if (authLoading || hasRedirectedRef.current) return;

    // No user - AuthContext handles this redirect
    if (!user) return;

    // Validation passed (cached or SWR) - no redirect needed
    if (orgValid) return;

    // Still loading validation - wait
    if (isLoading) return;

    // No org_id in JWT - redirect after brief delay
    if (!orgId) {
      hasRedirectedRef.current = true;
      const timer = setTimeout(() => {
        routerRef.current.push('/login?error=no_org_id');
      }, 1500);
      return () => clearTimeout(timer);
    }

    // Invalid UUID format - redirect
    if (!isUUIDValid) {
      hasRedirectedRef.current = true;
      const timer = setTimeout(() => {
        routerRef.current.push('/login?error=invalid_org_id');
      }, 1500);
      return () => clearTimeout(timer);
    }

    // SWR error - redirect based on error type
    if (error) {
      // Don't redirect on network errors — backend is down, user auth is fine
      if (isNetworkOrTimeoutError(error)) return;

      hasRedirectedRef.current = true;
      const err = error as any;
      const redirectUrl = err?.status === 401
        ? '/login'
        : `/login?error=${encodeURIComponent(orgError || 'validation_failed')}`;

      const timer = setTimeout(() => {
        routerRef.current.push(redirectUrl);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [authLoading, user, orgId, isUUIDValid, orgValid, isLoading, error, orgError]);

  const isNetworkError = orgError === 'NETWORK_ERROR';

  return {
    orgId,
    orgValid,
    orgError,
    isNetworkError,
    loading: authLoading || validationLoading,
  };
}
