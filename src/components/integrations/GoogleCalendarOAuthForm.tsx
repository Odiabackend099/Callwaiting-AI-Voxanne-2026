/**
 * Google Calendar OAuth Configuration Form
 *
 * Handles OAuth 2.0 authentication flow for Google Calendar access.
 * User clicks "Connect with Google" button which opens Google consent screen.
 * After authorization, credentials are stored securely.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Loader2, X } from 'lucide-react';

interface GoogleCalendarOAuthFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

interface FormState {
  isConnecting: boolean;
  error: string | null;
  success: boolean;
  message: string | null;
}

export function GoogleCalendarOAuthForm({ onSuccess, onCancel }: GoogleCalendarOAuthFormProps) {
  const [state, setState] = useState<FormState>({
    isConnecting: false,
    error: null,
    success: false,
    message: null,
  });

  // Handle OAuth callback (redirect back from Google)
  useEffect(() => {
    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const state_param = params.get('state');

      if (code) {
        try {
          setState((prev) => ({ ...prev, isConnecting: true, error: null }));

          const response = await fetch('/api/auth/google-calendar/callback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, state: state_param }),
          });

          const result = await response.json();

          if (!response.ok) {
            throw new Error(result.error || 'Failed to complete Google authentication');
          }

          setState((prev) => ({
            ...prev,
            success: true,
            message: 'Google Calendar connected successfully',
          }));

          // Auto-close after 2 seconds
          setTimeout(() => {
            onSuccess();
          }, 2000);
        } catch (err) {
          setState((prev) => ({
            ...prev,
            error: err instanceof Error ? err.message : 'Failed to complete authentication',
          }));
        } finally {
          setState((prev) => ({ ...prev, isConnecting: false }));
        }
      }
    };

    handleCallback();
  }, [onSuccess]);

  const handleConnectGoogle = async () => {
    try {
      setState((prev) => ({ ...prev, isConnecting: true, error: null }));

      const response = await fetch('/api/auth/google-calendar/authorize', {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error('Failed to initiate Google authentication');
      }

      const data = await response.json();

      // Redirect to Google consent screen
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        throw new Error('No authorization URL returned');
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to initiate authentication',
        isConnecting: false,
      }));
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900">Connect Google Calendar</h2>
        <button
          onClick={onCancel}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-6">
          {/* Info Box */}
          <div className="p-4 bg-cyan-50 border border-cyan-200 rounded-lg">
            <p className="text-sm text-cyan-900 mb-3">
              <span className="font-medium">What we access:</span>
            </p>
            <ul className="space-y-2 text-sm text-cyan-900">
              <li className="flex items-start gap-2">
                <span className="font-bold">✓</span>
                <span>Create, read, and modify events in your Google Calendar</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold">✓</span>
                <span>Check your calendar availability for appointment scheduling</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold">✓</span>
                <span>View calendar names and settings</span>
              </li>
            </ul>
          </div>

          {/* Permissions Info */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900">
              <span className="font-medium">What we DON'T access:</span>
              <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                <li>Your Gmail messages or contacts</li>
                <li>Other Google accounts or services</li>
                <li>Your password</li>
              </ul>
            </p>
          </div>

          {/* Error Alert */}
          {state.error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-red-900">Error</h3>
                <p className="text-sm text-red-800 mt-1">{state.error}</p>
              </div>
            </div>
          )}

          {/* Success Alert */}
          {state.success && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-green-900">Connected Successfully</h3>
                <p className="text-sm text-green-800 mt-1">{state.message}</p>
              </div>
            </div>
          )}

          {/* Connection Instructions */}
          {!state.success && !state.isConnecting && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-3">How to connect:</h3>
              <ol className="space-y-2 text-sm text-gray-700">
                <li>
                  <span className="font-medium">1. Click "Connect with Google"</span> below
                </li>
                <li>
                  <span className="font-medium">2. Sign in</span> with your Google account (if needed)
                </li>
                <li>
                  <span className="font-medium">3. Review</span> the permissions request
                </li>
                <li>
                  <span className="font-medium">4. Click "Allow"</span> to grant access
                </li>
                <li>
                  <span className="font-medium">5. You'll be redirected</span> back automatically
                </li>
              </ol>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 p-6 bg-gray-50 flex items-center justify-end gap-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors font-medium text-gray-700 disabled:opacity-50"
          disabled={state.isConnecting || state.success}
        >
          Cancel
        </button>
        <button
          onClick={handleConnectGoogle}
          disabled={state.isConnecting || state.success}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {state.isConnecting && <Loader2 className="w-4 h-4 animate-spin" />}
          {state.success ? 'Connected!' : 'Connect with Google'}
        </button>
      </div>
    </div>
  );
}
