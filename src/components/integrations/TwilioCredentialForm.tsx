/**
 * Twilio Credential Configuration Form
 *
 * Allows users to:
 * - Enter Account SID and Auth Token
 * - Enter SMS phone number (E.164 format)
 * - Enter WhatsApp number (optional)
 * - Test connection before saving
 * - View masked credentials
 */

'use client';

import React, { useState } from 'react';
import { Eye, EyeOff, AlertCircle, CheckCircle, Loader2, X } from 'lucide-react';

interface TwilioCredentialFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

interface FormData {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
  whatsappNumber: string;
}

interface FormState {
  data: FormData;
  showAuthToken: boolean;
  isSaving: boolean;
  isTesting: boolean;
  error: string | null;
  success: boolean;
  testResult: {
    connected: boolean;
    message?: string;
    maskedPhone?: string;
  } | null;
}

const E164_REGEX = /^\+[1-9]\d{1,14}$/;

export function TwilioCredentialForm({ onSuccess, onCancel }: TwilioCredentialFormProps) {
  const [state, setState] = useState<FormState>({
    data: {
      accountSid: '',
      authToken: '',
      phoneNumber: '',
      whatsappNumber: '',
    },
    showAuthToken: false,
    isSaving: false,
    isTesting: false,
    error: null,
    success: false,
    testResult: null,
  });

  const handleInputChange = (field: keyof FormData, value: string) => {
    setState((prev) => ({
      ...prev,
      data: { ...prev.data, [field]: value },
      error: null, // Clear error on input change
    }));
  };

  const formatPhoneNumber = (input: string): string => {
    // Remove all non-digit characters except leading +
    let cleaned = input.replace(/\D/g, '');
    if (!cleaned) return '';

    // Add + if not present
    if (!input.startsWith('+')) {
      cleaned = '+' + cleaned;
    } else {
      cleaned = '+' + cleaned;
    }

    return cleaned;
  };

  const validateForm = (): boolean => {
    if (!state.data.accountSid.trim()) {
      setState((prev) => ({ ...prev, error: 'Account SID is required' }));
      return false;
    }

    if (!state.data.authToken.trim()) {
      setState((prev) => ({ ...prev, error: 'Auth Token is required' }));
      return false;
    }

    if (!state.data.phoneNumber.trim()) {
      setState((prev) => ({ ...prev, error: 'SMS phone number is required' }));
      return false;
    }

    const formattedPhone = formatPhoneNumber(state.data.phoneNumber);
    if (!E164_REGEX.test(formattedPhone)) {
      setState((prev) => ({
        ...prev,
        error: 'Phone number must be in E.164 format (e.g., +12025551234)',
      }));
      return false;
    }

    if (state.data.whatsappNumber.trim()) {
      const formattedWhatsApp = formatPhoneNumber(state.data.whatsappNumber);
      if (!E164_REGEX.test(formattedWhatsApp)) {
        setState((prev) => ({
          ...prev,
          error: 'WhatsApp number must be in E.164 format (e.g., +12025551234)',
        }));
        return false;
      }
    }

    return true;
  };

  const handleTestConnection = async () => {
    if (!validateForm()) return;

    try {
      setState((prev) => ({ ...prev, isTesting: true, error: null, testResult: null }));

      const formattedPhone = formatPhoneNumber(state.data.phoneNumber);
      const formattedWhatsApp = state.data.whatsappNumber
        ? formatPhoneNumber(state.data.whatsappNumber)
        : undefined;

      const response = await fetch('/api/integrations/twilio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountSid: state.data.accountSid.trim(),
          authToken: state.data.authToken.trim(),
          phoneNumber: formattedPhone,
          whatsappNumber: formattedWhatsApp,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setState((prev) => ({
          ...prev,
          error: result.error || 'Failed to verify credentials',
          testResult: { connected: false },
        }));
        return;
      }

      setState((prev) => ({
        ...prev,
        testResult: {
          connected: true,
          message: 'Connection successful',
          maskedPhone: result.data?.phoneNumber,
        },
        success: true,
      }));

      // Auto-close after 2 seconds
      setTimeout(() => {
        onSuccess();
      }, 2000);
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to verify credentials',
        testResult: { connected: false },
      }));
    } finally {
      setState((prev) => ({ ...prev, isTesting: false }));
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900">Configure Twilio</h2>
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
          {/* Account SID Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Account SID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={state.data.accountSid}
              onChange={(e) => handleInputChange('accountSid', e.target.value)}
              placeholder="AC..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all"
              disabled={state.success}
            />
            <p className="mt-1 text-xs text-gray-500">
              Find in your <a href="https://console.twilio.com" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">Twilio Console</a> under Account Info
            </p>
          </div>

          {/* Auth Token Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Auth Token <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={state.showAuthToken ? 'text' : 'password'}
                value={state.data.authToken}
                onChange={(e) => handleInputChange('authToken', e.target.value)}
                placeholder="••••••••••••••••"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all"
                disabled={state.success}
              />
              <button
                type="button"
                onClick={() => setState((prev) => ({ ...prev, showAuthToken: !prev.showAuthToken }))}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
              >
                {state.showAuthToken ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Keep this secret! Only expose in backend code
            </p>
          </div>

          {/* SMS Phone Number Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              SMS Phone Number <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={state.data.phoneNumber}
              onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
              placeholder="+1 (202) 555-1234"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all"
              disabled={state.success}
            />
            <p className="mt-1 text-xs text-gray-500">
              Format: E.164 format (e.g., +12025551234). The number your users will see when receiving SMS.
            </p>
          </div>

          {/* WhatsApp Number Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              WhatsApp Number <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="tel"
              value={state.data.whatsappNumber}
              onChange={(e) => handleInputChange('whatsappNumber', e.target.value)}
              placeholder="+1 (202) 555-1234"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all"
              disabled={state.success}
            />
            <p className="mt-1 text-xs text-gray-500">
              Leave blank if you don't use WhatsApp. Must be in E.164 format.
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

          {/* Test Result Success */}
          {state.testResult?.connected && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-green-900">Connection Successful</h3>
                  <p className="text-sm text-green-800 mt-1">{state.testResult.message}</p>
                  {state.testResult.maskedPhone && (
                    <p className="text-sm text-green-800 mt-2">
                      <span className="font-medium">Phone Number:</span> {state.testResult.maskedPhone}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900">
              <span className="font-medium">What happens next:</span>
              <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                <li>Your credentials will be encrypted and stored securely</li>
                <li>SMS and WhatsApp messages will be sent from your configured number</li>
                <li>All API calls will use your Twilio account</li>
              </ul>
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 p-6 bg-gray-50 flex items-center justify-end gap-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors font-medium text-gray-700 disabled:opacity-50"
          disabled={state.isTesting || state.isSaving || state.success}
        >
          Cancel
        </button>
        <button
          onClick={handleTestConnection}
          disabled={
            state.isTesting ||
            state.success ||
            !state.data.accountSid.trim() ||
            !state.data.authToken.trim() ||
            !state.data.phoneNumber.trim()
          }
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {state.isTesting && <Loader2 className="w-4 h-4 animate-spin" />}
          {state.success ? 'Saved!' : 'Test & Save'}
        </button>
      </div>
    </div>
  );
}
