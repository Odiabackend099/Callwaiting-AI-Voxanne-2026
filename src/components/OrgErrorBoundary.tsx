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
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="mb-4">
            <div className="w-12 h-12 mx-auto border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin"></div>
          </div>
          <h1 className="text-lg font-semibold text-slate-800 mb-2">Validating access...</h1>
          <p className="text-sm text-slate-600">Verifying your organization</p>
        </div>
      </div>
    );
  }

  // Show error state if validation failed
  if (!orgValid || orgError) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-red-50 to-orange-50">
        <div className="max-w-md w-full mx-auto px-6 text-center">
          <div className="mb-6">
            <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4v2m0-6a4 4 0 100 8 4 4 0 000-8z" />
              </svg>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-red-800 mb-3">Organization Not Found</h1>

          {orgError && (
            <p className="text-red-700 mb-6 leading-relaxed">
              {orgError}
            </p>
          )}

          {!orgId && (
            <p className="text-red-700 mb-6 leading-relaxed">
              Your account does not have an organization assigned. Please contact your administrator.
            </p>
          )}

          <div className="space-y-3">
            <button
              onClick={() => signOut()}
              className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors duration-200"
            >
              Sign Out & Try Again
            </button>

            <a
              href="/"
              className="block w-full px-4 py-3 bg-slate-200 hover:bg-slate-300 text-slate-800 font-medium rounded-lg transition-colors duration-200"
            >
              Back to Home
            </a>
          </div>

          <p className="text-xs text-red-600 mt-6">
            Error ID: {orgId ? 'VALIDATION_FAILED' : 'NO_ORG_ID'}
          </p>
        </div>
      </div>
    );
  }

  // Validation passed - render children
  return children;
}
