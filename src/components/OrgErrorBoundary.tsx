'use client';

import React, { useRef, useEffect } from 'react';
import { useOrgValidation } from '@/hooks/useOrgValidation';
import { useAuth } from '@/contexts/AuthContext';

/**
 * OrgErrorBoundary Component (2026 Optimized)
 *
 * Wraps dashboard and protected routes with optimistic rendering:
 * - Shows children immediately if we have an orgId (trust JWT)
 * - Only shows loader on TRUE cold start (never rendered before)
 * - Background validation catches any issues without blocking UI
 *
 * Key 2026 Best Practice: Optimistic rendering with background validation
 *
 * Usage:
 * ```tsx
 * <OrgErrorBoundary>
 *   <Dashboard />
 * </OrgErrorBoundary>
 * ```
 */
export function OrgErrorBoundary({ children }: { children: React.ReactNode }) {
  const { orgId, orgValid, orgError, loading } = useOrgValidation();
  const { signOut } = useAuth();

  // Track if we've ever successfully rendered children
  // This persists across re-renders but resets on page refresh
  const hasRenderedChildrenRef = useRef(false);

  // Update ref when validation passes
  useEffect(() => {
    if (orgValid) {
      hasRenderedChildrenRef.current = true;
    }
  }, [orgValid]);

  // OPTIMISTIC RENDERING LOGIC:
  // 1. If validation passed (orgValid) -> show children
  // 2. If we rendered before AND have orgId AND no error -> show children (trust cached/JWT state)
  // 3. Otherwise, check if we should show loader or error
  const shouldShowChildren = orgValid || (hasRenderedChildrenRef.current && orgId && !orgError);

  // Show loading state ONLY on TRUE cold start:
  // - Still loading
  // - Never rendered children before
  // - Don't have an orgId yet (JWT not parsed)
  if (loading && !hasRenderedChildrenRef.current && !orgId) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="text-center">
          <div className="mb-6">
            <div className="w-14 h-14 mx-auto border-4 border-slate-800 border-t-emerald-400 rounded-full animate-spin"></div>
          </div>
          <h1 className="text-xl font-semibold text-slate-50 mb-2 tracking-tight">Loading dashboard...</h1>
          <p className="text-sm text-slate-400 tracking-tight">Setting up your workspace</p>
        </div>
      </div>
    );
  }

  // Show children optimistically if conditions met
  if (shouldShowChildren) {
    return children;
  }

  // Show error state ONLY if validation definitively failed (not loading, has error)
  if (!loading && (!orgValid || orgError)) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="max-w-md w-full mx-auto px-6 text-center">
          <div className="mb-6">
            <div className="w-16 h-16 mx-auto bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center backdrop-blur-sm">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4v2m0-6a4 4 0 100 8 4 4 0 000-8z" />
              </svg>
            </div>
          </div>

          <h1 className="text-2xl font-semibold text-slate-50 mb-3 tracking-tight">Organization Not Found</h1>

          {orgError && (
            <p className="text-sm text-red-300 mb-6 leading-relaxed tracking-tight">
              {orgError}
            </p>
          )}

          {!orgId && (
            <p className="text-sm text-red-300 mb-6 leading-relaxed tracking-tight">
              Your account does not have an organization assigned. Please contact your administrator.
            </p>
          )}

          <div className="space-y-3">
            <button
              onClick={() => signOut()}
              className="w-full px-4 py-3 bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-medium rounded-xl transition-all shadow-lg shadow-red-500/30 tracking-tight"
            >
              Sign Out & Try Again
            </button>

            <a
              href="/"
              className="block w-full px-4 py-3 bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/50 text-slate-200 font-medium rounded-xl transition-all backdrop-blur-sm tracking-tight"
            >
              Back to Home
            </a>
          </div>

          <p className="text-xs text-slate-500 mt-6 tracking-tight">
            Error ID: {orgId ? 'VALIDATION_FAILED' : 'NO_ORG_ID'}
          </p>
        </div>
      </div>
    );
  }

  // Validation passed - render children
  return children;
}
