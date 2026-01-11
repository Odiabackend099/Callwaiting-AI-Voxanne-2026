/**
 * Vapi Credential Configuration Form
 *
 * Allows users to:
 * - Enter and validate Vapi API key
 * - Enter webhook secret (optional)
 * - Test connection before saving
 * - View auto-created assistant IDs
 */

'use client';

import React, { useState } from 'react';
import { Eye, EyeOff, AlertCircle, CheckCircle, Loader2, X } from 'lucide-react';

interface VapiCredentialFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

interface FormData {
  apiKey: string;
  webhookSecret: string;
}

interface FormState {
  data: FormData;
  showApiKey: boolean;
  showWebhookSecret: boolean;
  isSaving: boolean;
  isTesting: boolean;
  error: string | null;
  success: boolean;
  testResult: {
    connected: boolean;
    message?: string;
  } | null;
  assistantIds: {
    inbound?: string;
    outbound?: string;
  } | null;
}

export function VapiCredentialForm({ onSuccess, onCancel }: VapiCredentialFormProps) {
  const [state, setState] = useState<FormState>({
    data: { apiKey: '', webhookSecret: '' },
    showApiKey: false,
    showWebhookSecret: false,
    isSaving: false,
    isTesting: false,
    error: null,
    success: false,
    testResult: null,
    assistantIds: null,
  });

  const handleInputChange = (field: keyof FormData, value: string) => {
    setState((prev) => ({
      ...prev,
      data: { ...prev.data, [field]: value },
      error: null, // Clear error on input change
    }));
  };

  const validateForm = (): boolean => {
    if (!state.data.apiKey.trim()) {
      setState((prev) => ({ ...prev, error: 'API key is required' }));
      return false;
    }

    if (state.data.apiKey.trim().length < 20) {
      setState((prev) => ({ ...prev, error: 'API key appears to be invalid (too short)' }));
      return false;
    }

    return true;
  };

  const handleTestConnection = async () => {
    if (!validateForm()) return;

    try {
      setState((prev) => ({ ...prev, isTesting: true, error: null, testResult: null }));

      const response = await fetch('/api/integrations/vapi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: state.data.apiKey.trim(),
          webhookSecret: state.data.webhookSecret.trim() || undefined,
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
        testResult: { connected: true, message: 'Connection successful' },
        assistantIds: {
          inbound: result.data?.inboundAssistantId,
          outbound: result.data?.outboundAssistantId,
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
        <h2 className="text-2xl font-bold text-gray-900">Configure Vapi</h2>
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
          {/* API Key Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              API Key <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={state.showApiKey ? 'text' : 'password'}
                value={state.data.apiKey}
                onChange={(e) => handleInputChange('apiKey', e.target.value)}
                placeholder="sk_..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                disabled={state.success}
              />
              <button
                type="button"
                onClick={() => setState((prev) => ({ ...prev, showApiKey: !prev.showApiKey }))}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
              >
                {state.showApiKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Get your API key from <a href="https://console.vapi.ai" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">console.vapi.ai</a>
            </p>
          </div>

          {/* Webhook Secret Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Webhook Secret <span className="text-gray-400">(optional)</span>
            </label>
            <div className="relative">
              <input
                type={state.showWebhookSecret ? 'text' : 'password'}
                value={state.data.webhookSecret}
                onChange={(e) => handleInputChange('webhookSecret', e.target.value)}
                placeholder="whs_..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                disabled={state.success}
              />
              <button
                type="button"
                onClick={() =>
                  setState((prev) => ({ ...prev, showWebhookSecret: !prev.showWebhookSecret }))
                }
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
              >
                {state.showWebhookSecret ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Recommended for webhook signature verification
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
              <div className="flex items-start gap-3 mb-3">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-green-900">Connection Successful</h3>
                  <p className="text-sm text-green-800 mt-1">{state.testResult.message}</p>
                </div>
              </div>

              {/* Auto-created Assistants Info */}
              {state.assistantIds && (
                <div className="mt-3 space-y-2 text-sm">
                  <div className="p-3 bg-white rounded border border-green-200">
                    <p className="text-gray-600">
                      <span className="font-medium">Inbound Assistant ID:</span>
                      <br />
                      <code className="text-xs bg-gray-100 p-1 rounded block mt-1 break-all">
                        {state.assistantIds.inbound || 'Creating...'}
                      </code>
                    </p>
                  </div>
                  <div className="p-3 bg-white rounded border border-green-200">
                    <p className="text-gray-600">
                      <span className="font-medium">Outbound Assistant ID:</span>
                      <br />
                      <code className="text-xs bg-gray-100 p-1 rounded block mt-1 break-all">
                        {state.assistantIds.outbound || 'Creating...'}
                      </code>
                    </p>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    These assistants have been automatically created in your Vapi account. You can configure them in the Vapi console.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Info Box */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900">
              <span className="font-medium">What happens next:</span>
              <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                <li>Your API key will be encrypted and stored securely</li>
                <li>Inbound and outbound voice agents will be automatically created</li>
                <li>Webhook signature verification will be enabled if you provide a secret</li>
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
          disabled={state.isTesting || state.success || !state.data.apiKey.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {state.isTesting && <Loader2 className="w-4 h-4 animate-spin" />}
          {state.success ? 'Saved!' : 'Test & Save'}
        </button>
      </div>
    </div>
  );
}
