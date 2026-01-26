'use client';

import React from 'react';
import { useOrgValidation } from '@/hooks/useOrgValidation';
import { useAuth } from '@/contexts/AuthContext';

/**
 * OrgErrorBoundary Component
 * 
 * Wraps dashboard and protected routes to ensure user has a valid organization.
 * Shows error message and logout button if org validation fails.
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

  // Show loading state while validating
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="text-center">
          <div className="mb-6">
            <div className="w-14 h-14 mx-auto border-4 border-slate-800 border-t-emerald-400 rounded-full animate-spin"></div>
          </div>
          <h1 className="text-xl font-semibold text-slate-50 mb-2 tracking-tight">Validating access...</h1>
          <p className="text-sm text-slate-400 tracking-tight">Verifying your organization</p>
        </div>
      </div>
    );
  }

  // Show error state if validation failed
  if (!orgValid || orgError) {
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
